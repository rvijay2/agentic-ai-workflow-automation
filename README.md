# Agentic AI Workflow Automation

> **Production-style multi-tool, multi-step AI agent** that plans, executes, and cites sources for complex enterprise workflows — fully functional in offline demo mode (no API key needed).

[![CI](https://github.com/your-org/agentic-ai-workflow-automation/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/agentic-ai-workflow-automation/actions)

---

## Architecture

```
src/
  agent/
    types.ts               # Shared types: Blackboard, Plan, Step, Citation
    blackboard.ts          # Shared state store across all steps
    planner.ts             # Offline deterministic planner + optional OpenAI planner
    executor.ts            # Topological execution loop: retry/backoff/timeout
  tools/
    registry.ts            # Tool registration
    doc_search.ts          # TF-IDF full-text search over docs/
    doc_qa.ts              # RAG-lite: extract answers from snippets
    csv_profile.ts         # CSV statistics + Z-score anomaly detection
    json_schema_infer.ts   # Infer + validate JSON schemas
    workflow_dsl_compile.ts # Compile YAML workflow DSL
    http_fetch.ts          # Offline fixture reader / online allowlisted fetch
    report_render.ts       # Markdown report + JSON summary writer
  dsl/
    types.ts               # DSL type definitions
    executor.ts            # DSL step executor
  cli/
    index.ts               # CLI entry point
  web/
    server.ts              # Express web UI server
    public/index.html      # Single-page UI
```

## Quick Start

```bash
# Install dependencies
npm install

# Run a scenario (offline, no API key needed)
npm run example:onboard
npm run example:rca
npm run example:churn

# Or custom request
npm run agent -- "Onboard a new hire and validate their config"

# Start web UI
npm run web
# Open http://localhost:3000

# Run tests
npm test

# Lint
npm run lint
```

## Three Built-In Scenarios

### 1. New Hire Onboarding
Reads HR/IT policy docs → extracts checklist → validates employee JSON config → compiles YAML workflow → produces a grounded report with citations.

### 2. Incident Root Cause Analysis (RCA)
Ingests system logs → searches runbooks for known patterns → profiles incident metrics CSV → extracts root cause → fetches system status → renders RCA report.

### 3. Customer Churn Investigation
Profiles customer CSV data → detects statistical anomalies (Z-score) → searches retention policies → extracts recommended actions → validates segment JSON → renders action plan report.

## Key Design Decisions

| Concern | Decision |
|---------|----------|
| **Planning** | Offline deterministic planner with scenario detection; optional OpenAI LLM planner |
| **State** | Shared Blackboard pattern — all tools read/write shared state |
| **Execution** | Topological sort respects `dependsOn`; exponential backoff retries |
| **Search** | TF-IDF over chunked documents — no vector DB needed |
| **Citations** | Every tool emits `Citation[]` objects, aggregated in the Blackboard |
| **Offline** | All tools work with local fixtures/files — no external dependencies |
| **Reports** | Markdown + JSON summary written to `runs/` with full execution trace |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | Optional. Enables LLM-based planning mode. |
| `ONLINE_MODE` | Set to any value to enable live HTTP fetches (uses allowlist). |
| `PORT` | Web server port (default: 3000). |

## Project Structure

```
docs/           # Knowledge base documents for doc_search and doc_qa
examples/data/  # Sample CSVs, JSON configs, YAML workflows
fixtures/       # Offline HTTP fixture responses
runs/           # Output reports and traces (gitignored)
tests/          # Jest test suite
src/            # TypeScript source
```

## License

MIT
