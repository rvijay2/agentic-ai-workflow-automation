import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Tool } from './registry';
import { Blackboard, Citation } from '../agent/types';
import { WorkflowDef, CompiledWorkflow, DslStep } from '../dsl/types';

function topologicalSort(steps: DslStep[]): string[] {
  const stepMap = new Map(steps.map(s => [s.id, s]));
  const visited = new Set<string>();
  const result: string[] = [];

  function visit(id: string): void {
    if (visited.has(id)) return;
    visited.add(id);
    const step = stepMap.get(id);
    if (step?.dependsOn) {
      for (const dep of step.dependsOn) visit(dep);
    }
    result.push(id);
  }

  for (const step of steps) visit(step.id);
  return result;
}

function validateWorkflow(def: WorkflowDef): string[] {
  const errors: string[] = [];
  const stepIds = new Set(def.steps.map(s => s.id));

  if (!def.name) errors.push('Workflow must have a name');
  if (!def.steps || def.steps.length === 0) errors.push('Workflow must have at least one step');

  for (const step of def.steps) {
    if (!step.id) errors.push(`Step missing id`);
    if (!step.tool) errors.push(`Step ${step.id} missing tool`);
    if (step.dependsOn) {
      for (const dep of step.dependsOn) {
        if (!stepIds.has(dep)) errors.push(`Step ${step.id} depends on unknown step: ${dep}`);
      }
    }
  }

  return errors;
}

export const workflowDslCompileTool: Tool = {
  name: 'workflow_dsl_compile',
  description: 'Compile a YAML workflow DSL into executable steps',
  async execute(args, _blackboard: Blackboard): Promise<CompiledWorkflow & { citations: Citation[] }> {
    const filePath = path.isAbsolute(String(args.file))
      ? String(args.file)
      : path.join(process.cwd(), String(args.file));

    if (!fs.existsSync(filePath)) {
      throw new Error(`Workflow DSL file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const def = yaml.load(content) as WorkflowDef;

    const validationErrors = validateWorkflow(def);
    const executionOrder = validationErrors.length === 0
      ? topologicalSort(def.steps)
      : def.steps.map(s => s.id);

    const compiled: CompiledWorkflow = {
      def,
      executionOrder,
      estimatedSteps: def.steps.length,
      valid: validationErrors.length === 0,
      validationErrors,
    };

    const citations: Citation[] = [{
      source: path.basename(filePath),
      excerpt: `Workflow "${def.name}" compiled: ${def.steps.length} steps, execution order: ${executionOrder.join(' → ')}`,
    }];

    return { ...compiled, citations };
  },
};
