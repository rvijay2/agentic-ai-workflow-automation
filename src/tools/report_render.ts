import * as fs from 'fs';
import * as path from 'path';
import { Tool } from './registry';
import { Blackboard, Citation, StepResult } from '../agent/types';

const RUNS_DIR = path.join(process.cwd(), 'runs');

function formatCitation(c: Citation, idx: number): string {
  return `[${idx + 1}] **${c.source}**: ${c.excerpt.replace(/\n/g, ' ').slice(0, 150)}`;
}

function buildMarkdownReport(blackboard: Blackboard, title: string, _sections: string[]): string {
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push(`**Run ID:** ${blackboard.runId}`);
  lines.push(`**Request:** ${blackboard.request}`);
  lines.push(`**Status:** ${blackboard.status}`);
  lines.push(`**Date:** ${new Date().toISOString()}`);
  lines.push('');

  lines.push('## Executive Summary');
  const successCount = blackboard.stepResults.filter(r => r.success).length;
  const totalCount = blackboard.stepResults.length;
  lines.push(`Completed ${successCount}/${totalCount} steps successfully.`);
  lines.push('');

  lines.push('## Step Results');
  for (const result of blackboard.stepResults) {
    const status = result.success ? '✅' : '❌';
    lines.push(`### ${status} ${result.stepId} — ${result.toolName}`);
    lines.push(`- Duration: ${result.durationMs}ms | Retries: ${result.retries}`);
    if (result.success && result.output) {
      const outputStr = JSON.stringify(result.output, null, 2);
      const output = result.output as Record<string, unknown>;
      if (output.summary) lines.push(`- Summary: ${output.summary}`);
      else if (output.answer) lines.push(`- Answer: ${output.answer}`);
      else lines.push(`\`\`\`json\n${outputStr.slice(0, 500)}\n\`\`\``);
    }
    if (!result.success) lines.push(`- Error: ${result.error}`);
  }
  lines.push('');

  const csvResults = blackboard.stepResults.filter((r: StepResult) => r.toolName === 'csv_profile' && r.success);
  if (csvResults.length > 0) {
    lines.push('## Data Profile');
    for (const r of csvResults) {
      const out = r.output as { summary: string; columns: Array<{ name: string; type: string; mean?: number; stdDev?: number; anomalies?: number[] }> };
      lines.push('```');
      lines.push(out.summary);
      lines.push('```');
      const anomalyCols = out.columns.filter(c => c.anomalies && c.anomalies.length > 0);
      if (anomalyCols.length > 0) {
        lines.push('\n**Anomaly Highlights:**');
        for (const col of anomalyCols) {
          lines.push(`- Column \`${col.name}\`: ${col.anomalies!.length} anomalous rows (Z-score > threshold)`);
        }
      }
    }
    lines.push('');
  }

  const qaResults = blackboard.stepResults.filter((r: StepResult) => r.toolName === 'doc_qa' && r.success);
  if (qaResults.length > 0) {
    lines.push('## Key Findings (from Documents)');
    for (const r of qaResults) {
      const out = r.output as { answer: string; snippets: string[] };
      lines.push(`> ${out.answer}`);
      lines.push('');
    }
  }

  const dslResults = blackboard.stepResults.filter((r: StepResult) => r.toolName === 'workflow_dsl_compile' && r.success);
  if (dslResults.length > 0) {
    lines.push('## Workflow Plan');
    for (const r of dslResults) {
      const out = r.output as { def: { name: string }; executionOrder: string[]; valid: boolean; validationErrors: string[] };
      lines.push(`**Workflow:** ${out.def.name}`);
      lines.push(`**Execution Order:** ${out.executionOrder.join(' → ')}`);
      lines.push(`**Valid:** ${out.valid}`);
      if (!out.valid) lines.push(`**Errors:** ${out.validationErrors.join(', ')}`);
    }
    lines.push('');
  }

  if (blackboard.citations.length > 0) {
    lines.push('## Citations');
    lines.push('*All findings are grounded in the following sources:*');
    lines.push('');
    const uniqueCitations = blackboard.citations.slice(0, 10);
    for (let i = 0; i < uniqueCitations.length; i++) {
      lines.push(formatCitation(uniqueCitations[i], i));
    }
    lines.push('');
  }

  return lines.join('\n');
}

export const reportRenderTool: Tool = {
  name: 'report_render',
  description: 'Render a markdown report and JSON summary grounded in tool outputs',
  async execute(args, blackboard: Blackboard): Promise<{ reportPath: string; summaryPath: string; markdownReport: string; citations: Citation[] }> {
    const title = String(args.title || 'Agent Report');
    const sections = (args.sections as string[]) || ['findings'];
    const outputFile = String(args.outputFile || 'agent_report');

    const markdownReport = buildMarkdownReport(blackboard, title, sections);
    blackboard.finalReport = markdownReport;

    const summary = {
      runId: blackboard.runId,
      request: blackboard.request,
      status: blackboard.status,
      stepsCompleted: blackboard.stepResults.filter(r => r.success).length,
      stepsTotal: blackboard.stepResults.length,
      citationCount: blackboard.citations.length,
      completedAt: new Date().toISOString(),
      toolsUsed: [...new Set(blackboard.stepResults.map(r => r.toolName))],
    };
    blackboard.finalSummary = summary;

    if (!fs.existsSync(RUNS_DIR)) fs.mkdirSync(RUNS_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(RUNS_DIR, `${outputFile}_${timestamp}.md`);
    const summaryPath = path.join(RUNS_DIR, `${outputFile}_${timestamp}.json`);
    const tracePath = path.join(RUNS_DIR, `${outputFile}_${timestamp}_trace.json`);

    fs.writeFileSync(reportPath, markdownReport);
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    fs.writeFileSync(tracePath, JSON.stringify({
      ...summary,
      plan: blackboard.plan,
      stepResults: blackboard.stepResults,
      variables: blackboard.variables,
      citations: blackboard.citations,
    }, null, 2));

    const citations: Citation[] = [{
      source: 'report_render',
      excerpt: `Report saved to ${reportPath}`,
    }];

    return { reportPath, summaryPath, markdownReport, citations };
  },
};
