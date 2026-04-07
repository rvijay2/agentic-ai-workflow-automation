# Agentic AI Workflow Automation

> **Production-style multi-tool, multi-step AI agent** that plans, executes, and cites sources for complex enterprise workflows — fully functional in **offline demo mode** (no API key needed), with optional OpenAI tool-calling upgrade.

[![CI](https://github.com/rvijay2/agentic-ai-workflow-automation/actions/workflows/ci.yml/badge.svg)](https://github.com/rvijay2/agentic-ai-workflow-automation/actions)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![Node](https://img.shields.io/badge/Node-20-green)
![Tests](https://img.shields.io/badge/tests-13%20passing-brightgreen)

---

## 📋 Table of Contents
1. [Quick Start](#quick-start)
2. [Architecture](#architecture)
3. [Agent Loop](#agent-loop)
4. [Workflow DSL](#workflow-dsl)
5. [Tools](#tools)
6. [Three End-to-End Scenarios](#three-end-to-end-scenarios)
7. [Run with Docker](#run-with-docker)
8. [Environment Variables](#environment-variables)
9. [Interview Writeup](#interview-writeup)

---

## Quick Start

```bash
# Install dependencies (Node 18+)
npm install

# Run all 3 example scenarios (offline, no API key needed)
npm run example:onboard     # Scenario A: New hire onboarding
npm run example:rca         # Scenario B: Incident root cause analysis
npm run example:churn       # Scenario C: Customer churn investigation

# Run any custom request
npm run agent -- "Analyze our product usage CSV and draft a retention action plan"

# Start web UI
npm run web
# → Open http://localhost:3000

# Tests & lint
npm test
npm run lint
```

### With OpenAI (optional)
```bash
export OPENAI_API_KEY=sk-...
npm run agent -- "Onboard a new hire and produce a report"
# → Uses GPT-4o-mini for planning instead of the deterministic planner
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI / Web UI                         │
│              npm run agent -- "..."  |  localhost:3000       │
└─────────────────────┬───────────────────────────────────────┘
                      │ request (natural language)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                       PLANNER                               │
│  • Offline: keyword detection → deterministic plan          │
│  • Online: OpenAI GPT tool-calling                         │
│  • Generates 2 candidate plans, selects best (utility/cost) │
└─────────────────────┬───────────────────────────────────────┘
                      │ Plan (steps + dependsOn graph)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                       EXECUTOR                              │
│  • Topological step ordering                                │
│  • Per-step retry / exponential backoff                     │
│  • Error classification: retryable vs fatal                 │
│  • Timeout per step (configurable)                          │
└──────────┬──────────────────────────────────────────────────┘
           │  tool calls
     ┌─────▼──────────────────────────────────────────────┐
     │                    TOOLS                           │
     │  doc_search   csv_profile   json_schema_infer      │
     │  doc_qa       workflow_dsl_compile   http_fetch     │
     │  report_render                                     │
     └──────────────────────────────────────────────────┬─┘
                                                        │ outputs + citations
                                                        ▼
                                        ┌───────────────────────┐
                                        │      BLACKBOARD        │
                                        │  • variables           │
                                        │  • artifacts           │
                                        │  • citations[]         │
                                        │  • stepResults[]       │
                                        └───────────┬───────────┘
                                                    │ final state
                                                    ▼
                                       runs/<timestamp>.md   (report)
                                       runs/<timestamp>.json (summary)
                                       runs/<timestamp>_trace.json
```

### Source Layout

```
src/
  agent/
    types.ts               # Blackboard, Plan, PlanStep, Citation, StepResult
    blackboard.ts          # Shared mutable state: variables, artifacts, citations
    planner.ts             # Candidate plan generation + best-plan selection
    executor.ts            # Topological execution with retry/backoff/timeout
  tools/
    registry.ts            # Tool name → implementation map
    doc_search.ts          # TF-IDF search over docs/ (chunked)
    doc_qa.ts              # RAG-lite: sentence overlap extraction
    csv_profile.ts         # Column statistics + Z-score anomaly detection
    json_schema_infer.ts   # Recursive schema inference + validation
    workflow_dsl_compile.ts # YAML DSL compiler + topological validator
    http_fetch.ts          # Offline fixture reader / online allowlisted fetch
    report_render.ts       # Grounded markdown + JSON report writer
  dsl/
    types.ts               # WorkflowDef, DslStep, CompiledWorkflow
    executor.ts            # DSL step executor (separate from agent executor)
  cli/
    index.ts               # Commander CLI entry point
  web/
    server.ts              # Express REST API + static file server
    public/index.html      # Single-page UI (vanilla JS, no framework)
docs/                      # Knowledge base (onboarding, security, runbooks, retention)
examples/
  data/                    # Sample CSV, JSON, YAML DSL files
  prompts/                 # Example natural-language requests
  runs/                    # Committed example run outputs
fixtures/                  # Offline responses for http_fetch
tests/                     # Jest test suite (13 tests)
```

---

## Agent Loop

The core agent loop executes as follows:

```
1. Parse request (natural language string)
        │
        ▼
2. Planning (planner.ts)
   ├── Offline: detect keywords → map to tools → build ordered PlanSteps
   │   └── Generate 2 candidate plans (comprehensive vs focused)
   │       └── Select best: score = utilityScore / estimatedCostScore
   └── OpenAI: send request + available tool list → receive JSON plan
        │
        ▼
3. Execution loop (executor.ts)
   For each step in topological order:
   ├── Resolve args (interpolate $blackboard_vars)
   ├── Call tool.execute(args, blackboard)
   ├── On failure:
   │   ├── Classify error: retryable (timeout, ECONNREFUSED) | fatal (not found, invalid)
   │   └── Retry with exponential backoff (500ms, 1s, 2s, ...)
   └── Record StepResult in Blackboard (output + citations)
        │
        ▼
4. report_render step
   ├── Collect all step outputs from Blackboard
   ├── Extract citations from every tool output
   ├── Build markdown report grounded in tool outputs (no hallucinated numbers)
   └── Write .md + .json + _trace.json to runs/
        │
        ▼
5. Output to stdout + saved files
```

**Key reliability properties:**
- Each step's output is stored in `blackboard.variables[step_<id>_output]` for downstream steps
- Citations are aggregated from every tool — the final report only contains facts from tool outputs
- Retries use exponential backoff: delay = `baseRetryDelayMs × 2^(attempt-1)`
- A step classified as "fatal" (e.g. file not found) is not retried
- Circular dependencies are detected and broken gracefully (fallback: run step anyway)

---

## Workflow DSL

The project includes a YAML-based workflow DSL that defines multi-step automations declaratively.

### Example DSL (`examples/data/onboarding_workflow.yaml`):
```yaml
name: new-hire-onboarding
version: "1.0"
description: Automate the standard new hire onboarding process

inputs:
  employee_email:
    type: string
    required: true
  department:
    type: string
    default: "Engineering"

steps:
  - id: search_policies
    name: Search HR and IT Policies
    tool: doc_search
    args:
      query: "onboarding checklist required steps access"
      topK: 5

  - id: validate_config
    name: Validate Employee JSON Config
    tool: json_schema_infer
    args:
      file: examples/data/employee_config.json

  - id: extract_checklist
    name: Extract Onboarding Checklist
    tool: doc_qa
    args:
      question: "What are all the required steps for onboarding a new hire?"
    dependsOn:
      - search_policies

  - id: generate_report
    name: Generate Onboarding Report
    tool: report_render
    args:
      title: "New Hire Onboarding Report"
      outputFile: onboarding_report
    dependsOn:
      - search_policies
      - validate_config
      - extract_checklist

outputs:
  report: generate_report.reportPath
```

### How the DSL works:
1. **`workflow_dsl_compile` tool** reads the YAML and:
   - Validates required fields (name, steps, tool references)
   - Performs topological sort on `dependsOn` graph → deterministic execution order
   - Returns a `CompiledWorkflow` with `executionOrder: string[]`
2. The agent can **generate a DSL** from a natural language request (planner includes a DSL compile step)
3. Or the agent can **execute a provided DSL** file directly

### Available DSL workflows:
| File | Purpose |
|------|---------|
| `onboarding_workflow.yaml` | New hire onboarding automation |
| `churn_workflow.yaml` | Customer churn detection + intervention |
| `rca_workflow.yaml` | Incident root cause analysis |

---

## Tools

| Tool | Inputs | Outputs | Algorithm |
|------|--------|---------|-----------|
| `doc_search` | `query`, `topK`, `corpus` | `results[]`, `citations[]` | TF-IDF over chunked text files in `docs/` or `examples/data/logs/` |
| `doc_qa` | `question`, `topK` | `answer`, `snippets[]`, `citations[]` | Sentence-level overlap scoring against doc corpus + blackboard context |
| `csv_profile` | `file`, `zScoreThreshold` | `columns[]`, `anomalyCount`, `summary` | Column stats (mean/stddev/min/max) + Z-score anomaly detection |
| `json_schema_infer` | `file` | `schema`, `valid`, `errors[]` | Recursive type inference + structural validation |
| `workflow_dsl_compile` | `file` | `CompiledWorkflow`, `executionOrder` | YAML parse + topological sort (DFS) + validation |
| `http_fetch` | `url` | `data`, `source` | Offline: reads from `fixtures/`; Online: fetches allowlisted URLs |
| `report_render` | `title`, `sections`, `outputFile` | `reportPath`, `summaryPath`, `markdownReport` | Assembles report from blackboard state, writes to `runs/` |

All tools emit `citations: Citation[]` — source file + excerpt — ensuring the final report is fully grounded.

---

## Three End-to-End Scenarios

### Scenario A: New Hire Onboarding (`npm run example:onboard`)
```
Request: "Onboard a new hire: read docs, generate checklist, validate config, produce report"

Step 1 [doc_search]           Search onboarding policy + security policy docs
Step 2 [doc_qa]               Extract specific checklist items (depends on step 1)
Step 3 [json_schema_infer]    Validate employee_config.json structure
Step 4 [workflow_dsl_compile] Compile onboarding_workflow.yaml → execution order
Step 5 [report_render]        Grounded report with citations (depends on 1-4)

Output: runs/onboarding_report_<timestamp>.md
        runs/onboarding_report_<timestamp>.json
```

Sample output → `examples/runs/scenario_a_onboarding_run.md`

### Scenario B: Incident RCA (`npm run example:rca`)
```
Request: "Incident RCA: ingest logs, search runbooks, compute metrics, draft RCA"

Step 1 [doc_search]   Ingest system.log — search for ERROR/CRITICAL patterns
Step 2 [doc_search]   Search runbook docs for mitigation patterns (depends on 1)
Step 3 [csv_profile]  Profile incident_metrics.csv — detect anomalous hours
Step 4 [doc_qa]       Extract root cause from runbook snippets (depends on 2)
Step 5 [http_fetch]   Fetch system status (offline: reads fixtures/system_status.json)
Step 6 [report_render] RCA report with timeline, anomalies, citations (depends on 1-5)

Output: runs/rca_report_<timestamp>.md
```

Sample output → `examples/runs/scenario_b_rca_run.md`

### Scenario C: Customer Churn Investigation (`npm run example:churn`)
```
Request: "Customer churn investigation: profile CSV, detect anomalies, find policy, action plan"

Step 1 [csv_profile]          Profile customers.csv (15 rows, 9 columns, Z-score anomalies)
Step 2 [doc_search]           Search retention policy docs (depends on 1)
Step 3 [doc_qa]               Extract recommended actions per churn tier (depends on 2)
Step 4 [json_schema_infer]    Validate customer_segments.json schema
Step 5 [workflow_dsl_compile] Compile churn_workflow.yaml
Step 6 [report_render]        Action plan with anomaly highlights + policy citations (depends on 1-5)

Output: runs/churn_report_<timestamp>.md
```

Sample output → `examples/runs/scenario_c_churn_run.md`

---

## Run with Docker

### Docker Compose (recommended — no Node needed)
```bash
# Clone repo
git clone https://github.com/rvijay2/agentic-ai-workflow-automation.git
cd agentic-ai-workflow-automation

# Start the web UI
docker compose up --build

# Open http://localhost:3000
```

### Docker with OpenAI key
```bash
OPENAI_API_KEY=sk-... docker compose up --build
```

### Run a scenario via Docker
```bash
docker compose run --rm agent npx ts-node src/cli/index.ts "Onboard a new hire"
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | _(unset)_ | If set, enables GPT-based planning mode |
| `ONLINE_MODE` | _(unset)_ | If set, enables live HTTP fetches (allowlisted URLs only) |
| `PORT` | `3000` | Web server port |

---

## Interview Writeup

### Problem Statement
Enterprise teams waste significant time on repetitive multi-step workflows: searching internal knowledge bases, validating configurations, analyzing data files, fetching status from APIs, and compiling findings into reports. These workflows require **coordinating multiple tools** and **tracking intermediate results** — tasks that are error-prone and slow when done manually.

The Agentic AI Workflow Automation system solves this by deploying an autonomous agent that:
1. **Plans** a sequence of tool-calls from a single natural language request
2. **Executes** each step, passing intermediate results between tools
3. **Tracks state** on a shared Blackboard (variables + citations)
4. **Produces** a grounded, fully-cited report — no hallucinated numbers

### Backend Flow (step by step)
```
User request  →  Planner (offline or LLM)  →  Plan (steps with dependsOn)
     ↓
Executor (topological sort):
  For each ready step:
    → Resolve args from Blackboard
    → Call tool.execute(args, blackboard)
    → Retry with exponential backoff on failure
    → Record output + citations to Blackboard
     ↓
report_render:
  → Collect all outputs from Blackboard
  → Build structured markdown (only facts from tool outputs)
  → Save .md + .json + _trace.json to runs/
```

### Algorithms & Techniques

| Component | Algorithm / Technique | Why |
|-----------|----------------------|-----|
| Doc Search | **TF-IDF** (term frequency × inverse document frequency) over chunked text | No vector DB needed; deterministic; interpretable scores |
| Doc QA | **Sentence overlap scoring** (keyword intersection) | RAG-lite without embeddings; fast and fully offline |
| CSV Profiling | **Z-score anomaly detection** (|value - mean| / stddev > threshold) | Well-known statistical method; tunable threshold; no ML model needed |
| JSON Schema | **Recursive type inference** (structural pattern matching) | Works on any JSON without a pre-defined schema |
| DSL Compilation | **Depth-first topological sort** (DFS with visited set) | Guarantees valid execution order; detects cycles |
| Planning | **Keyword → tool routing** (offline) or **OpenAI function calling** (online) | Deterministic fallback ensures zero-dependency demo |
| Plan Selection | **Utility/Cost ratio** (utilityScore / estimatedCostScore) | Multi-criteria plan ranking with a single comparable score |
| Retry Logic | **Exponential backoff** (delay = base × 2^attempt) | Standard reliability pattern for transient failures |
| Error Classification | **Keyword-based** (timeout/ECONNREFUSED = retryable; not found/invalid = fatal) | Avoids pointless retries on permanent errors |
| State Management | **Blackboard pattern** | All tools share one mutable state object; downstream steps read upstream outputs |

### Reliability Design
- **Retries with backoff**: up to 3 retries per step, delay doubles each time
- **Timeouts**: each step has a configurable max execution time (default 30s)
- **Error classification**: `retryable` vs `fatal` prevents infinite retry loops
- **Partial success**: if some steps fail, the report renders with the data that was collected
- **Full audit trail**: every run produces a `_trace.json` with the complete plan + all step outputs + citations

### Why It's Useful & Efficient
- **Reduces context switching**: one command replaces 5–10 manual operations
- **Reproducible**: same request produces the same plan (offline mode); traces are saved
- **Auditable**: every fact in the output is linked to a specific tool output (citation)
- **Offline-first**: works entirely without internet or API keys for demos
- **Extensible**: add a new tool by implementing `Tool.execute()` and registering it in `registry.ts`
- **70% reduction** in manual workflow orchestration time (estimated, based on step count vs manual equivalent)

### Why These Technology Choices
| Choice | Rationale |
|--------|-----------|
| **TypeScript/Node** | Strong typing for complex data flows; large ecosystem; fast iteration |
| **No vector DB** | TF-IDF + sentence overlap covers the use case without infrastructure overhead |
| **YAML DSL** | Human-readable; composable; compiles to deterministic execution order |
| **Blackboard pattern** | Clean separation between tools; no direct tool-to-tool dependencies |
| **Express for web** | Minimal, well-understood; keeps dependencies lean |
| **Jest for tests** | Standard Node testing; fast; integrates with ts-jest |

---

## License

MIT
