import { Blackboard, Citation, Plan, StepResult } from './types';
import { randomUUID } from 'crypto';

export function createBlackboard(request: string): Blackboard {
  return {
    runId: randomUUID(),
    request,
    plan: null,
    variables: {},
    artifacts: {},
    citations: [],
    stepResults: [],
    status: 'pending',
    startedAt: new Date().toISOString(),
  };
}

export function setVariable(bb: Blackboard, key: string, value: unknown): void {
  bb.variables[key] = value;
}

export function getVariable(bb: Blackboard, key: string): unknown {
  return bb.variables[key];
}

export function addArtifact(bb: Blackboard, key: string, value: unknown): void {
  bb.artifacts[key] = value;
}

export function addCitations(bb: Blackboard, citations: Citation[]): void {
  bb.citations.push(...citations);
}

export function recordStepResult(bb: Blackboard, result: StepResult): void {
  bb.stepResults.push(result);
  if (result.success && result.output !== undefined) {
    bb.variables[`step_${result.stepId}_output`] = result.output;
  }
  if (result.citations) {
    addCitations(bb, result.citations);
  }
}

export function setPlan(bb: Blackboard, plan: Plan): void {
  bb.plan = plan;
}
