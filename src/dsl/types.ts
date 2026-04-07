export interface DslStep {
  id: string;
  name: string;
  tool: string;
  args: Record<string, unknown>;
  dependsOn?: string[];
  retryCount?: number;
  timeoutMs?: number;
  onError?: 'stop' | 'continue' | 'retry';
}

export interface WorkflowDef {
  name: string;
  version: string;
  description?: string;
  inputs?: Record<string, { type: string; default?: unknown; required?: boolean }>;
  steps: DslStep[];
  outputs?: Record<string, string>;
}

export interface CompiledWorkflow {
  def: WorkflowDef;
  executionOrder: string[];
  estimatedSteps: number;
  valid: boolean;
  validationErrors: string[];
}
