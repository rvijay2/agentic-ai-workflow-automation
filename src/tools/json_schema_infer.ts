import * as fs from 'fs';
import * as path from 'path';
import { Tool } from './registry';
import { Blackboard, Citation } from '../agent/types';

type JsonSchema = {
  type: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  enum?: unknown[];
  nullable?: boolean;
};

function inferSchema(value: unknown): JsonSchema {
  if (value === null) return { type: 'null' };
  if (Array.isArray(value)) {
    const itemSchemas = value.slice(0, 5).map(inferSchema);
    const itemType = itemSchemas.length > 0 ? itemSchemas[0] : { type: 'unknown' };
    return { type: 'array', items: itemType };
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const properties: Record<string, JsonSchema> = {};
    for (const [k, v] of Object.entries(obj)) {
      properties[k] = inferSchema(v);
    }
    return { type: 'object', properties, required: Object.keys(obj) };
  }
  if (typeof value === 'number') return { type: 'number' };
  if (typeof value === 'boolean') return { type: 'boolean' };
  return { type: 'string' };
}

function validateAgainstSchema(value: unknown, schema: JsonSchema, path = '$'): string[] {
  const errors: string[] = [];
  if (schema.type === 'object' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if (schema.required) {
      for (const req of schema.required) {
        if (!(req in obj)) errors.push(`Missing required field: ${path}.${req}`);
      }
    }
    if (schema.properties) {
      for (const [k, propSchema] of Object.entries(schema.properties)) {
        if (k in obj) errors.push(...validateAgainstSchema(obj[k], propSchema, `${path}.${k}`));
      }
    }
  } else if (schema.type === 'array' && !Array.isArray(value)) {
    errors.push(`Expected array at ${path}`);
  } else if (!['object', 'array', 'null'].includes(schema.type) && typeof value !== schema.type) {
    errors.push(`Type mismatch at ${path}: expected ${schema.type}, got ${typeof value}`);
  }
  return errors;
}

export const jsonSchemaInferTool: Tool = {
  name: 'json_schema_infer',
  description: 'Infer JSON schema from a file and validate its structure',
  async execute(args, _blackboard: Blackboard): Promise<{ schema: JsonSchema; valid: boolean; errors: string[]; citations: Citation[] }> {
    const filePath = path.isAbsolute(String(args.file))
      ? String(args.file)
      : path.join(process.cwd(), String(args.file));

    if (!fs.existsSync(filePath)) {
      throw new Error(`JSON file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    const schema = inferSchema(data);
    const errors = validateAgainstSchema(data, schema);

    const citations: Citation[] = [{
      source: path.basename(filePath),
      excerpt: `Schema inferred: ${JSON.stringify(schema).slice(0, 300)}`,
    }];

    return { schema, valid: errors.length === 0, errors, citations };
  },
};
