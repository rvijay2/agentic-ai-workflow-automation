import { CompiledWorkflow } from './types';
import { toolRegistry } from '../tools/registry';
import { Blackboard } from '../agent/types';

export async function executeDsl(compiled: CompiledWorkflow, blackboard: Blackboard): Promise<Record<string, unknown>> {
  const outputs: Record<string, unknown> = {};

  for (const stepId of compiled.executionOrder) {
    const step = compiled.def.steps.find(s => s.id === stepId);
    if (!step) continue;

    const tool = toolRegistry[step.tool as keyof typeof toolRegistry];
    if (!tool) {
      outputs[stepId] = { error: `Unknown tool: ${step.tool}` };
      continue;
    }

    try {
      const result = await tool.execute(step.args, blackboard);
      outputs[stepId] = result;
      blackboard.variables[`dsl_${stepId}`] = result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      outputs[stepId] = { error: errorMsg };
      if (step.onError === 'stop') break;
    }
  }

  return outputs;
}
