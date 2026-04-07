import { createBlackboard, setVariable, getVariable, recordStepResult } from '../src/agent/blackboard';
import { generateCandidatePlans, selectBestPlan } from '../src/agent/planner';
import { StepResult } from '../src/agent/types';

describe('blackboard', () => {
  it('creates a blackboard with correct initial state', () => {
    const bb = createBlackboard('test request');
    expect(bb.request).toBe('test request');
    expect(bb.status).toBe('pending');
    expect(bb.stepResults).toHaveLength(0);
    expect(bb.citations).toHaveLength(0);
  });

  it('sets and gets variables', () => {
    const bb = createBlackboard('test');
    setVariable(bb, 'foo', 'bar');
    expect(getVariable(bb, 'foo')).toBe('bar');
  });

  it('records step results and updates variables', () => {
    const bb = createBlackboard('test');
    const result: StepResult = {
      stepId: 'step_1',
      toolName: 'doc_search',
      success: true,
      output: { results: [] },
      durationMs: 100,
      retries: 0,
    };
    recordStepResult(bb, result);
    expect(bb.stepResults).toHaveLength(1);
    expect(bb.variables['step_step_1_output']).toBeDefined();
  });
});

describe('planner', () => {
  it('generates candidate plans for onboarding request', () => {
    const plans = generateCandidatePlans('Onboard a new hire: read docs, generate checklist, validate config');
    expect(plans.length).toBeGreaterThan(0);
    expect(plans[0].steps.length).toBeGreaterThan(0);
  });

  it('generates candidate plans for RCA request', () => {
    const plans = generateCandidatePlans('Incident RCA: ingest logs and find root cause');
    expect(plans[0].steps.some(s => s.toolCall.tool === 'doc_search')).toBe(true);
  });

  it('generates candidate plans for churn request', () => {
    const plans = generateCandidatePlans('Customer churn investigation: profile CSV data');
    expect(plans[0].steps.some(s => s.toolCall.tool === 'csv_profile')).toBe(true);
  });

  it('selects the best plan based on utility/cost ratio', () => {
    const plans = generateCandidatePlans('Customer churn investigation');
    const best = selectBestPlan(plans);
    expect(best).toBeDefined();
    expect(best.steps.length).toBeGreaterThan(0);
  });
});
