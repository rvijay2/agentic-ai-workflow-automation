import { Plan, PlanStep, ToolName } from './types';
import { randomUUID } from 'crypto';

export interface PlannerConfig {
  openAiApiKey?: string;
  model?: string;
}

const TOOL_TRIGGERS: Array<{ keywords: string[]; tool: ToolName; descriptionTemplate: string; argsTemplate: Record<string, unknown> }> = [
  {
    keywords: ['doc', 'search', 'runbook', 'policy', 'manual', 'guide', 'read', 'onboard', 'hire', 'checklist', 'documentation'],
    tool: 'doc_search',
    descriptionTemplate: 'Search knowledge base documents for relevant information',
    argsTemplate: { query: '__REQUEST__', topK: 5 },
  },
  {
    keywords: ['answer', 'question', 'qa', 'explain', 'what is', 'how to', 'summarize docs'],
    tool: 'doc_qa',
    descriptionTemplate: 'Extract answers from document snippets using RAG-lite',
    argsTemplate: { question: '__REQUEST__', topK: 3 },
  },
  {
    keywords: ['csv', 'profile', 'anomaly', 'churn', 'metric', 'customer', 'data', 'analyze', 'statistics', 'outlier'],
    tool: 'csv_profile',
    descriptionTemplate: 'Profile CSV data and detect anomalies',
    argsTemplate: { file: 'examples/data/customers.csv', zScoreThreshold: 2.5 },
  },
  {
    keywords: ['json', 'schema', 'validate', 'config', 'configuration', 'infer'],
    tool: 'json_schema_infer',
    descriptionTemplate: 'Infer JSON schema and validate configuration',
    argsTemplate: { file: 'examples/data/employee_config.json' },
  },
  {
    keywords: ['log', 'incident', 'rca', 'root cause', 'error', 'failure', 'crash', 'alert', 'ingest'],
    tool: 'doc_search',
    descriptionTemplate: 'Search logs and runbooks for incident patterns',
    argsTemplate: { query: '__REQUEST__', topK: 5, corpus: 'logs' },
  },
  {
    keywords: ['workflow', 'dsl', 'compile', 'automate', 'pipeline'],
    tool: 'workflow_dsl_compile',
    descriptionTemplate: 'Compile workflow DSL definition',
    argsTemplate: { file: 'examples/data/sample_workflow.yaml' },
  },
  {
    keywords: ['fetch', 'http', 'url', 'web', 'api'],
    tool: 'http_fetch',
    descriptionTemplate: 'Fetch data from URL or fixture',
    argsTemplate: { url: 'http://localhost/fixtures/status.json' },
  },
];

function detectIntent(request: string): Set<ToolName> {
  const lower = request.toLowerCase();
  const tools = new Set<ToolName>();
  for (const trigger of TOOL_TRIGGERS) {
    if (trigger.keywords.some(kw => lower.includes(kw))) {
      tools.add(trigger.tool);
    }
  }
  tools.add('report_render');
  return tools;
}

function buildOfflinePlan(request: string, _scenarioHint: string): Plan {
  const lower = request.toLowerCase();
  const steps: PlanStep[] = [];

  if (lower.includes('onboard') || lower.includes('new hire') || lower.includes('checklist')) {
    steps.push({
      id: 'step_1',
      description: 'Search onboarding docs and HR policies',
      toolCall: { tool: 'doc_search', args: { query: 'new hire onboarding checklist', topK: 5 } },
    });
    steps.push({
      id: 'step_2',
      description: 'Extract onboarding requirements using doc QA',
      toolCall: { tool: 'doc_qa', args: { question: 'What are the required steps for onboarding a new hire?', topK: 3 } },
      dependsOn: ['step_1'],
    });
    steps.push({
      id: 'step_3',
      description: 'Validate employee JSON configuration',
      toolCall: { tool: 'json_schema_infer', args: { file: 'examples/data/employee_config.json' } },
    });
    steps.push({
      id: 'step_4',
      description: 'Compile onboarding workflow DSL',
      toolCall: { tool: 'workflow_dsl_compile', args: { file: 'examples/data/onboarding_workflow.yaml' } },
    });
    steps.push({
      id: 'step_5',
      description: 'Render final onboarding report with checklist and citations',
      toolCall: {
        tool: 'report_render',
        args: {
          title: 'New Hire Onboarding Report',
          sections: ['onboarding_checklist', 'config_validation', 'workflow_plan'],
          outputFile: 'onboarding_report',
        },
      },
      dependsOn: ['step_1', 'step_2', 'step_3', 'step_4'],
    });

  } else if (lower.includes('rca') || lower.includes('incident') || lower.includes('log')) {
    steps.push({
      id: 'step_1',
      description: 'Ingest and search system logs for error patterns',
      toolCall: { tool: 'doc_search', args: { query: 'error critical failure exception', topK: 8, corpus: 'logs' } },
    });
    steps.push({
      id: 'step_2',
      description: 'Search runbooks for known incident patterns',
      toolCall: { tool: 'doc_search', args: { query: 'incident response runbook mitigation', topK: 5 } },
      dependsOn: ['step_1'],
    });
    steps.push({
      id: 'step_3',
      description: 'Profile incident metrics CSV',
      toolCall: { tool: 'csv_profile', args: { file: 'examples/data/incident_metrics.csv', zScoreThreshold: 2.0 } },
    });
    steps.push({
      id: 'step_4',
      description: 'Extract root cause analysis from runbooks using doc QA',
      toolCall: { tool: 'doc_qa', args: { question: 'What is the root cause and mitigation for this type of error?', topK: 3 } },
      dependsOn: ['step_2'],
    });
    steps.push({
      id: 'step_5',
      description: 'Fetch system status from fixture',
      toolCall: { tool: 'http_fetch', args: { url: 'http://localhost/fixtures/system_status.json' } },
    });
    steps.push({
      id: 'step_6',
      description: 'Render RCA report with citations from logs and runbooks',
      toolCall: {
        tool: 'report_render',
        args: {
          title: 'Incident Root Cause Analysis Report',
          sections: ['log_analysis', 'runbook_findings', 'metrics_summary', 'rca_draft'],
          outputFile: 'rca_report',
        },
      },
      dependsOn: ['step_1', 'step_2', 'step_3', 'step_4', 'step_5'],
    });

  } else if (lower.includes('churn') || lower.includes('customer') || lower.includes('csv')) {
    steps.push({
      id: 'step_1',
      description: 'Profile customer CSV data and detect anomalies',
      toolCall: { tool: 'csv_profile', args: { file: 'examples/data/customers.csv', zScoreThreshold: 2.5 } },
    });
    steps.push({
      id: 'step_2',
      description: 'Search policy docs for churn reduction strategies',
      toolCall: { tool: 'doc_search', args: { query: 'customer churn retention policy action plan', topK: 5 } },
      dependsOn: ['step_1'],
    });
    steps.push({
      id: 'step_3',
      description: 'Extract key churn factors using doc QA',
      toolCall: { tool: 'doc_qa', args: { question: 'What are the main causes of customer churn and recommended actions?', topK: 3 } },
      dependsOn: ['step_2'],
    });
    steps.push({
      id: 'step_4',
      description: 'Validate customer segment JSON schema',
      toolCall: { tool: 'json_schema_infer', args: { file: 'examples/data/customer_segments.json' } },
    });
    steps.push({
      id: 'step_5',
      description: 'Compile churn intervention workflow DSL',
      toolCall: { tool: 'workflow_dsl_compile', args: { file: 'examples/data/churn_workflow.yaml' } },
    });
    steps.push({
      id: 'step_6',
      description: 'Render customer churn action plan report',
      toolCall: {
        tool: 'report_render',
        args: {
          title: 'Customer Churn Investigation Report',
          sections: ['csv_profile', 'anomaly_highlights', 'policy_recommendations', 'action_plan'],
          outputFile: 'churn_report',
        },
      },
      dependsOn: ['step_1', 'step_2', 'step_3', 'step_4', 'step_5'],
    });

  } else {
    const tools = detectIntent(request);
    let idx = 1;
    for (const tool of tools) {
      if (tool === 'report_render') continue;
      steps.push({
        id: `step_${idx}`,
        description: `Execute ${tool} for the request`,
        toolCall: { tool, args: { query: request } },
      });
      idx++;
    }
    steps.push({
      id: `step_${idx}`,
      description: 'Render final report',
      toolCall: {
        tool: 'report_render',
        args: { title: 'Agent Report', sections: ['findings'], outputFile: 'agent_report' },
      },
      dependsOn: steps.map(s => s.id),
    });
  }

  return {
    id: randomUUID(),
    request,
    steps,
    estimatedCostScore: steps.length * 10,
    utilityScore: 90,
  };
}

export function generateCandidatePlans(request: string): Plan[] {
  const plan1 = buildOfflinePlan(request, 'comprehensive');

  const plan2 = { ...plan1 };
  plan2.id = randomUUID();
  plan2.steps = plan1.steps.slice(0, Math.max(2, plan1.steps.length - 1));
  plan2.estimatedCostScore = plan2.steps.length * 10;
  plan2.utilityScore = 70;

  return [plan1, plan2];
}

export function selectBestPlan(plans: Plan[]): Plan {
  let best = plans[0];
  let bestScore = best.utilityScore / (best.estimatedCostScore || 1);
  for (const plan of plans.slice(1)) {
    const score = plan.utilityScore / (plan.estimatedCostScore || 1);
    if (score > bestScore) {
      best = plan;
      bestScore = score;
    }
  }
  return best;
}

export async function createPlan(request: string, config: PlannerConfig): Promise<Plan> {
  if (config.openAiApiKey) {
    try {
      return await createOpenAIPlan(request, config);
    } catch (err) {
      console.warn('[planner] OpenAI planning failed, falling back to offline planner:', err);
    }
  }
  const candidates = generateCandidatePlans(request);
  return selectBestPlan(candidates);
}

async function createOpenAIPlan(request: string, config: PlannerConfig): Promise<Plan> {
  const https = await import('https');
  const systemPrompt = `You are an AI workflow planner. Given a request, output a JSON plan with steps.
Each step has: id, description, toolCall (tool name + args), optionally dependsOn.
Available tools: doc_search, doc_qa, csv_profile, json_schema_infer, workflow_dsl_compile, http_fetch, report_render.
Always end with a report_render step. Output only valid JSON, no markdown.`;

  const body = JSON.stringify({
    model: config.model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Create a plan for: ${request}` },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 2000,
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.openAiApiKey}`,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.message?.content;
            const planData = JSON.parse(content);
            resolve({
              id: randomUUID(),
              request,
              steps: planData.steps || [],
              estimatedCostScore: planData.estimatedCostScore || 50,
              utilityScore: planData.utilityScore || 90,
            });
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
