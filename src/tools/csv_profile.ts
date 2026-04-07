import * as fs from 'fs';
import * as path from 'path';
import { Tool } from './registry';
import { Blackboard, Citation } from '../agent/types';

interface ColumnStats {
  name: string;
  count: number;
  nullCount: number;
  mean?: number;
  stdDev?: number;
  min?: number;
  max?: number;
  type: 'numeric' | 'text';
  anomalies?: number[];
}

interface CsvProfile {
  file: string;
  rowCount: number;
  columnCount: number;
  columns: ColumnStats[];
  anomalyCount: number;
  summary: string;
  citations: Citation[];
}

function parseCSV(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else { current += char; }
    }
    result.push(current.trim());
    return result;
  });
  return { headers, rows };
}

function computeStats(values: number[]): { mean: number; stdDev: number; min: number; max: number } {
  const n = values.length;
  if (n === 0) return { mean: 0, stdDev: 0, min: 0, max: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  return { mean, stdDev, min: Math.min(...values), max: Math.max(...values) };
}

function detectAnomalies(values: number[], mean: number, stdDev: number, threshold: number): number[] {
  return values
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => stdDev > 0 && Math.abs(v - mean) / stdDev > threshold)
    .map(({ i }) => i);
}

export const csvProfileTool: Tool = {
  name: 'csv_profile',
  description: 'Profile CSV: compute column stats, detect anomalies via Z-score',
  async execute(args, _blackboard: Blackboard): Promise<CsvProfile> {
    const filePath = path.isAbsolute(String(args.file))
      ? String(args.file)
      : path.join(process.cwd(), String(args.file));
    const zThreshold = Number(args.zScoreThreshold ?? 2.5);

    if (!fs.existsSync(filePath)) {
      throw new Error(`CSV file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const { headers, rows } = parseCSV(content);

    const columns: ColumnStats[] = headers.map((name, colIdx) => {
      const rawValues = rows.map(r => r[colIdx] ?? '');
      const numericValues = rawValues
        .map(v => parseFloat(v.replace(/[$,%]/g, '')))
        .filter(v => !isNaN(v));

      const nullCount = rawValues.filter(v => !v || v === 'null' || v === 'N/A').length;

      if (numericValues.length > rawValues.length * 0.5) {
        const { mean, stdDev, min, max } = computeStats(numericValues);
        const anomalies = detectAnomalies(numericValues, mean, stdDev, zThreshold);
        return { name, count: rawValues.length, nullCount, mean: +mean.toFixed(4), stdDev: +stdDev.toFixed(4), min, max, type: 'numeric' as const, anomalies };
      }
      return { name, count: rawValues.length, nullCount, type: 'text' as const };
    });

    const totalAnomalies = columns.reduce((sum, c) => sum + (c.anomalies?.length ?? 0), 0);
    const numericCols = columns.filter(c => c.type === 'numeric');

    const summary = [
      `CSV Profile: ${path.basename(filePath)}`,
      `Rows: ${rows.length}, Columns: ${headers.length}`,
      `Numeric columns: ${numericCols.map(c => `${c.name} (mean=${c.mean}, σ=${c.stdDev})`).join('; ')}`,
      `Total anomalies detected (|Z| > ${zThreshold}): ${totalAnomalies}`,
    ].join('\n');

    const citations: Citation[] = [{
      source: path.basename(filePath),
      excerpt: summary,
    }];

    return { file: path.basename(filePath), rowCount: rows.length, columnCount: headers.length, columns, anomalyCount: totalAnomalies, summary, citations };
  },
};
