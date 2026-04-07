import * as path from 'path';
import * as fs from 'fs';
import { createBlackboard } from '../src/agent/blackboard';
import { csvProfileTool } from '../src/tools/csv_profile';
import { jsonSchemaInferTool } from '../src/tools/json_schema_infer';
import { workflowDslCompileTool } from '../src/tools/workflow_dsl_compile';
import { docSearchTool } from '../src/tools/doc_search';
import { httpFetchTool } from '../src/tools/http_fetch';

const blackboard = createBlackboard('test request');

describe('csv_profile tool', () => {
  it('profiles a valid CSV file', async () => {
    const csvPath = path.join(process.cwd(), 'examples/data/customers.csv');
    if (!fs.existsSync(csvPath)) return;
    const result = await csvProfileTool.execute({ file: csvPath, zScoreThreshold: 2.5 }, blackboard);
    const r = result as { rowCount: number; columnCount: number; anomalyCount: number };
    expect(r.rowCount).toBeGreaterThan(0);
    expect(r.columnCount).toBeGreaterThan(0);
    expect(typeof r.anomalyCount).toBe('number');
  });

  it('throws on missing file', async () => {
    await expect(csvProfileTool.execute({ file: '/nonexistent.csv' }, blackboard)).rejects.toThrow();
  });
});

describe('json_schema_infer tool', () => {
  it('infers schema from valid JSON', async () => {
    const jsonPath = path.join(process.cwd(), 'examples/data/employee_config.json');
    if (!fs.existsSync(jsonPath)) return;
    const result = await jsonSchemaInferTool.execute({ file: jsonPath }, blackboard);
    const r = result as { schema: { type: string }; valid: boolean; errors: string[] };
    expect(r.schema.type).toBe('object');
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
});

describe('workflow_dsl_compile tool', () => {
  it('compiles a valid YAML workflow', async () => {
    const yamlPath = path.join(process.cwd(), 'examples/data/onboarding_workflow.yaml');
    if (!fs.existsSync(yamlPath)) return;
    const result = await workflowDslCompileTool.execute({ file: yamlPath }, blackboard);
    const r = result as { valid: boolean; executionOrder: string[] };
    expect(r.valid).toBe(true);
    expect(r.executionOrder.length).toBeGreaterThan(0);
  });
});

describe('doc_search tool', () => {
  it('returns results or empty array (docs may not exist in test env)', async () => {
    const result = await docSearchTool.execute({ query: 'onboarding checklist', topK: 3 }, blackboard);
    const r = result as { results: unknown[] };
    expect(Array.isArray(r.results)).toBe(true);
  });
});

describe('http_fetch tool (offline)', () => {
  it('returns fixture data or offline fallback', async () => {
    const result = await httpFetchTool.execute({ url: 'http://localhost/fixtures/system_status.json' }, blackboard);
    const r = result as { source: string; data: unknown };
    expect(r.source).toBe('fixture');
    expect(r.data).toBeDefined();
  });
});
