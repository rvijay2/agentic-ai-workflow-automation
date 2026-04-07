import { Blackboard, Plan, PlanStep, StepResult } from './types';
import { recordStepResult } from './blackboard';
import { toolRegistry } from '../tools/registry';
import chalk from 'chalk';

export interface ExecutorConfig {
  maxRetries?: number;
  baseRetryDelayMs?: number;
  defaultTimeoutMs?: number;
  verbose?: boolean;
}

const DEFAULT_CONFIG: Required<ExecutorConfig> = {
  maxRetries: 3,
  baseRetryDelayMs: 500,
  defaultTimeoutMs: 30000,
  verbose: true,
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function classifyError(err: unknown): 'retryable' | 'fatal' {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('timeout') || msg.includes('ECONNREFUSED') || msg.includes('rate limit')) {
    return 'retryable';
  }
  if (msg.includes('not found') || msg.includes('invalid') || msg.includes('permission')) {
    return 'fatal';
  }
  return 'retryable';
}

async function executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Tool execution timed out after ${timeoutMs}ms`)), timeoutMs);
    fn().then(
      (result) => { clearTimeout(timer); resolve(result); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

async function executeStep(
  step: PlanStep,
  blackboard: Blackboard,
  config: Required<ExecutorConfig>
): Promise<StepResult> {
  const tool = toolRegistry[step.toolCall.tool];
  const maxRetries = step.retryCount ?? config.maxRetries;
  const timeoutMs = step.timeoutMs ?? config.defaultTimeoutMs;

  if (!tool) {
    return {
      stepId: step.id,
      toolName: step.toolCall.tool,
      success: false,
      output: null,
      error: `Unknown tool: ${step.toolCall.tool}`,
      durationMs: 0,
      retries: 0,
    };
  }

  let lastError: string = '';
  let retries = 0;
  const startTime = Date.now();

  const resolvedArgs = resolveArgs(step.toolCall.args, blackboard);

  while (retries <= maxRetries) {
    try {
      if (config.verbose && retries > 0) {
        console.log(chalk.yellow(`  ↻ Retry ${retries}/${maxRetries} for step ${step.id}`));
      }

      const output = await executeWithTimeout(() => tool.execute(resolvedArgs, blackboard), timeoutMs);
      const durationMs = Date.now() - startTime;

      const result: StepResult = {
        stepId: step.id,
        toolName: step.toolCall.tool,
        success: true,
        output,
        durationMs,
        retries,
        citations: (output as { citations?: StepResult['citations'] })?.citations,
      };

      return result;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      const errorClass = classifyError(err);

      if (errorClass === 'fatal' || retries >= maxRetries) {
        break;
      }

      retries++;
      const delay = config.baseRetryDelayMs * Math.pow(2, retries - 1);
      await sleep(delay);
    }
  }

  return {
    stepId: step.id,
    toolName: step.toolCall.tool,
    success: false,
    output: null,
    error: lastError,
    durationMs: Date.now() - startTime,
    retries,
  };
}

function resolveArgs(args: Record<string, unknown>, blackboard: Blackboard): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string' && value.startsWith('$')) {
      const varName = value.slice(1);
      resolved[key] = blackboard.variables[varName] ?? value;
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

export async function executePlan(
  plan: Plan,
  blackboard: Blackboard,
  config: ExecutorConfig = {}
): Promise<void> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  blackboard.status = 'running';

  const completed = new Set<string>();

  if (cfg.verbose) {
    console.log(chalk.blue(`\n🤖 Agent executing plan with ${plan.steps.length} steps...\n`));
  }

  const queue = [...plan.steps];
  let maxIterations = plan.steps.length * 3;

  while (queue.length > 0 && maxIterations-- > 0) {
    let advanced = false;

    for (let i = 0; i < queue.length; i++) {
      const step = queue[i];
      const deps = step.dependsOn ?? [];
      const depsReady = deps.every(d => completed.has(d));

      if (!depsReady) continue;

      queue.splice(i, 1);
      i--;
      advanced = true;

      if (cfg.verbose) {
        console.log(chalk.cyan(`  ▶ [${step.id}] ${step.description}`));
        console.log(chalk.gray(`    Tool: ${step.toolCall.tool}`));
      }

      const result = await executeStep(step, blackboard, cfg);
      recordStepResult(blackboard, result);
      completed.add(step.id);

      if (cfg.verbose) {
        if (result.success) {
          console.log(chalk.green(`  ✓ [${step.id}] completed in ${result.durationMs}ms`));
        } else {
          console.log(chalk.red(`  ✗ [${step.id}] failed: ${result.error}`));
        }
      }
    }

    if (!advanced && queue.length > 0) {
      const step = queue.shift()!;
      if (cfg.verbose) {
        console.log(chalk.yellow(`  ⚠ [${step.id}] Running with unmet deps`));
      }
      const result = await executeStep(step, blackboard, cfg);
      recordStepResult(blackboard, result);
      completed.add(step.id);
    }
  }

  const failed = blackboard.stepResults.filter(r => !r.success);
  blackboard.status = failed.length === blackboard.stepResults.length ? 'failed' : 'success';
  blackboard.completedAt = new Date().toISOString();
}
