export type ToolName =
  | 'doc_search'
  | 'doc_qa'
  | 'csv_profile'
  | 'json_schema_infer'
  | 'workflow_dsl_compile'
  | 'http_fetch'
  | 'report_render';

export interface ToolCall {
  tool: ToolName;
  args: Record<string, unknown>;
}

export interface PlanStep {
  id: string;
  description: string;
  toolCall: ToolCall;
  dependsOn?: string[];
  retryCount?: number;
  timeoutMs?: number;
}

export interface Plan {
  id: string;
  request: string;
  steps: PlanStep[];
  estimatedCostScore: number;
  utilityScore: number;
}

export interface StepResult {
  stepId: string;
  toolName: ToolName;
  success: boolean;
  output: unknown;
  error?: string;
  durationMs: number;
  retries: number;
  citations?: Citation[];
}

export interface Citation {
  source: string;
  excerpt: string;
  relevanceScore?: number;
}

export interface Blackboard {
  runId: string;
  request: string;
  plan: Plan | null;
  variables: Record<string, unknown>;
  artifacts: Record<string, unknown>;
  citations: Citation[];
  stepResults: StepResult[];
  status: 'pending' | 'running' | 'success' | 'failed';
  startedAt: string;
  completedAt?: string;
  finalReport?: string;
  finalSummary?: unknown;
}
