import express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { createBlackboard, setPlan } from '../agent/blackboard';
import { createPlan } from '../agent/planner';
import { executePlan } from '../agent/executor';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/run', async (req, res) => {
  const { request } = req.body as { request: string };
  if (!request) {
    res.status(400).json({ error: 'request is required' });
    return;
  }

  const blackboard = createBlackboard(request);
  const plan = await createPlan(request, { openAiApiKey: process.env.OPENAI_API_KEY });
  setPlan(blackboard, plan);
  await executePlan(plan, blackboard, { verbose: false });

  res.json({
    runId: blackboard.runId,
    status: blackboard.status,
    plan: blackboard.plan,
    stepResults: blackboard.stepResults,
    finalReport: blackboard.finalReport,
    finalSummary: blackboard.finalSummary,
    citations: blackboard.citations,
  });
});

app.get('/api/runs', (_req, res) => {
  const runsDir = path.join(process.cwd(), 'runs');
  if (!fs.existsSync(runsDir)) { res.json([]); return; }
  const files = fs.readdirSync(runsDir).filter(f => f.endsWith('.json'));
  res.json(files);
});

app.listen(PORT, () => {
  console.log(`🌐 Web UI running at http://localhost:${PORT}`);
});
