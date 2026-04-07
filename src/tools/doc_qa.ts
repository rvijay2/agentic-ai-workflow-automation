import * as fs from 'fs';
import * as path from 'path';
import { Tool } from './registry';
import { Blackboard, Citation } from '../agent/types';

const DOCS_DIR = path.join(process.cwd(), 'docs');

function loadAllDocText(): string {
  if (!fs.existsSync(DOCS_DIR)) return '';
  const files = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith('.txt') || f.endsWith('.md'));
  return files.map(f => fs.readFileSync(path.join(DOCS_DIR, f), 'utf-8')).join('\n\n');
}

function extractRelevantSnippets(text: string, question: string, topK: number): string[] {
  const sentences = text.split(/[.\n]+/).filter(s => s.trim().length > 20);
  const qWords = new Set(question.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3));

  const scored = sentences.map(s => {
    const words = s.toLowerCase().split(/\s+/);
    const overlap = words.filter(w => qWords.has(w)).length;
    return { sentence: s.trim(), score: overlap };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(s => s.sentence);
}

export const docQaTool: Tool = {
  name: 'doc_qa',
  description: 'Answer questions using extracted snippets from docs (RAG-lite)',
  async execute(args, blackboard: Blackboard): Promise<{ answer: string; snippets: string[]; citations: Citation[] }> {
    const question = String(args.question || '');
    const topK = Number(args.topK ?? 3);

    let text = loadAllDocText();
    for (const result of blackboard.stepResults) {
      if (result.toolName === 'doc_search' && result.success && result.output) {
        const out = result.output as { results: Array<{ content: string; file: string }> };
        if (out.results) {
          text += '\n' + out.results.map(r => r.content).join('\n');
        }
      }
    }

    const snippets = extractRelevantSnippets(text, question, topK);
    const answer = snippets.length > 0
      ? `Based on the documents: ${snippets.join(' | ')}`
      : 'No relevant information found in the knowledge base.';

    const citations: Citation[] = snippets.map((s, i) => ({
      source: `doc_qa_snippet_${i + 1}`,
      excerpt: s.slice(0, 200),
    }));

    return { answer, snippets, citations };
  },
};
