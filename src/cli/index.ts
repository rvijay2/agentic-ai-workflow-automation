#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { createBlackboard, setPlan } from '../agent/blackboard';
import { createPlan } from '../agent/planner';
import { executePlan } from '../agent/executor';

const program = new Command();

program
  .name('agent')
  .description('Agentic AI Workflow Automation CLI')
  .version('1.0.0');

program
  .argument('<request>', 'Natural-language request for the agent')
  .option('--no-verbose', 'Suppress verbose output')
  .option('--model <model>', 'OpenAI model to use', 'gpt-4o-mini')
  .option('--max-retries <n>', 'Max retries per step', '3')
  .option('--timeout <ms>', 'Timeout per step in ms', '30000')
  .action(async (request: string, options: { verbose: boolean; model: string; maxRetries: string; timeout: string }) => {
    const apiKey = process.env.OPENAI_API_KEY;

    console.log(chalk.bold.blue('\n╔══════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║   Agentic AI Workflow Automation Engine  ║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════╝\n'));

    if (apiKey) {
      console.log(chalk.green('🔑 OpenAI API key detected — using LLM planning mode'));
    } else {
      console.log(chalk.yellow('🔌 No API key — using offline deterministic planner'));
    }

    console.log(chalk.white(`\n📋 Request: "${request}"\n`));

    const blackboard = createBlackboard(request);

    console.log(chalk.blue('🧠 Planning...'));
    const plan = await createPlan(request, {
      openAiApiKey: apiKey,
      model: options.model,
    });

    setPlan(blackboard, plan);
    console.log(chalk.green(`✓ Plan created: ${plan.steps.length} steps`));
    console.log(chalk.gray(`  Cost score: ${plan.estimatedCostScore}, Utility: ${plan.utilityScore}`));

    await executePlan(plan, blackboard, {
      maxRetries: parseInt(options.maxRetries),
      defaultTimeoutMs: parseInt(options.timeout),
      verbose: options.verbose,
    });

    const successful = blackboard.stepResults.filter(r => r.success).length;
    const total = blackboard.stepResults.length;

    console.log(chalk.bold('\n═══════════════════════════════════════════'));
    console.log(chalk.bold(`✅ Run complete: ${successful}/${total} steps succeeded`));
    console.log(chalk.bold(`📁 Run ID: ${blackboard.runId}`));

    if (blackboard.finalReport) {
      const reportResult = blackboard.stepResults.find(r => r.toolName === 'report_render' && r.success);
      if (reportResult?.output) {
        const out = reportResult.output as { reportPath: string; summaryPath: string };
        console.log(chalk.green(`📄 Report: ${out.reportPath}`));
        console.log(chalk.green(`📊 Summary: ${out.summaryPath}`));
      }
    }

    const runsDir = path.join(process.cwd(), 'runs');
    if (!fs.existsSync(runsDir)) fs.mkdirSync(runsDir, { recursive: true });
    const tracePath = path.join(runsDir, `${blackboard.runId}_blackboard.json`);
    fs.writeFileSync(tracePath, JSON.stringify(blackboard, null, 2));
    console.log(chalk.gray(`🔍 Full trace: ${tracePath}`));

    if (blackboard.finalReport) {
      console.log('\n' + chalk.bold.cyan('━━━ REPORT PREVIEW ━━━'));
      console.log(blackboard.finalReport.slice(0, 1500));
      if (blackboard.finalReport.length > 1500) console.log(chalk.gray('... (truncated, see full report file)'));
    }

    process.exit(blackboard.status === 'failed' ? 1 : 0);
  });

program.parse();
