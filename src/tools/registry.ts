import { ToolName } from '../agent/types';
import { Blackboard } from '../agent/types';

export interface Tool {
  name: ToolName;
  description: string;
  execute(args: Record<string, unknown>, blackboard: Blackboard): Promise<unknown>;
}

import { docSearchTool } from './doc_search';
import { docQaTool } from './doc_qa';
import { csvProfileTool } from './csv_profile';
import { jsonSchemaInferTool } from './json_schema_infer';
import { workflowDslCompileTool } from './workflow_dsl_compile';
import { httpFetchTool } from './http_fetch';
import { reportRenderTool } from './report_render';

export const toolRegistry: Record<ToolName, Tool> = {
  doc_search: docSearchTool,
  doc_qa: docQaTool,
  csv_profile: csvProfileTool,
  json_schema_infer: jsonSchemaInferTool,
  workflow_dsl_compile: workflowDslCompileTool,
  http_fetch: httpFetchTool,
  report_render: reportRenderTool,
};
