import * as fs from 'fs';
import * as path from 'path';
import { Tool } from './registry';
import { Blackboard, Citation } from '../agent/types';

const DOCS_DIR = path.join(process.cwd(), 'docs');
const LOGS_DIR = path.join(process.cwd(), 'examples', 'data', 'logs');

interface DocChunk {
  file: string;
  content: string;
  score: number;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 2);
}

function computeTF(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  for (const [k, v] of tf) tf.set(k, v / tokens.length);
  return tf;
}

function computeIDF(docs: string[][]): Map<string, number> {
  const N = docs.length;
  const df = new Map<string, number>();
  for (const tokens of docs) {
    const unique = new Set(tokens);
    for (const t of unique) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const idf = new Map<string, number>();
  for (const [t, count] of df) {
    idf.set(t, Math.log((N + 1) / (count + 1)) + 1);
  }
  return idf;
}

function tfidfScore(queryTokens: string[], docTokens: string[], idf: Map<string, number>): number {
  const tf = computeTF(docTokens);
  let score = 0;
  for (const qt of queryTokens) {
    score += (tf.get(qt) ?? 0) * (idf.get(qt) ?? 0);
  }
  return score;
}

function loadDocs(corpus: string): Array<{ file: string; content: string }> {
  const dir = corpus === 'logs' ? LOGS_DIR : DOCS_DIR;
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt') || f.endsWith('.md') || f.endsWith('.log'));
  return files.map(f => ({
    file: f,
    content: fs.readFileSync(path.join(dir, f), 'utf-8'),
  }));
}

function chunkText(text: string, chunkSize = 500): string[] {
  const sentences = text.split(/[.\n]+/);
  const chunks: string[] = [];
  let current = '';
  for (const s of sentences) {
    if (current.length + s.length > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      current = s;
    } else {
      current += ' ' + s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export const docSearchTool: Tool = {
  name: 'doc_search',
  description: 'Full-text search over docs/ using TF-IDF ranking',
  async execute(args, _blackboard: Blackboard): Promise<{ results: DocChunk[]; citations: Citation[] }> {
    const query = String(args.query || '');
    const topK = Number(args.topK ?? 5);
    const corpus = String(args.corpus || 'docs');

    const docs = loadDocs(corpus);
    if (docs.length === 0) {
      return { results: [], citations: [] };
    }

    const allChunks: Array<{ file: string; content: string }> = [];
    for (const doc of docs) {
      const chunks = chunkText(doc.content);
      for (const chunk of chunks) {
        allChunks.push({ file: doc.file, content: chunk });
      }
    }

    const queryTokens = tokenize(query);
    const docTokenArrays = allChunks.map(c => tokenize(c.content));
    const idf = computeIDF(docTokenArrays);

    const scored: DocChunk[] = allChunks.map((chunk, i) => ({
      file: chunk.file,
      content: chunk.content,
      score: tfidfScore(queryTokens, docTokenArrays[i], idf),
    }));

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, topK);

    const citations: Citation[] = top.map(r => ({
      source: r.file,
      excerpt: r.content.slice(0, 200),
      relevanceScore: r.score,
    }));

    return { results: top, citations };
  },
};
