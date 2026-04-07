import * as fs from 'fs';
import * as path from 'path';
import { Tool } from './registry';
import { Blackboard, Citation } from '../agent/types';

const FIXTURES_DIR = path.join(process.cwd(), 'fixtures');

const URL_ALLOWLIST = [
  'api.github.com',
  'jsonplaceholder.typicode.com',
];

function isAllowed(url: string): boolean {
  try {
    const u = new URL(url);
    return URL_ALLOWLIST.some(allowed => u.hostname.includes(allowed));
  } catch {
    return false;
  }
}

function fixtureKeyFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.replace(/^\//, '').replace(/\//g, '_').replace(/\.[^.]+$/, '');
  } catch {
    return 'default';
  }
}

export const httpFetchTool: Tool = {
  name: 'http_fetch',
  description: 'Fetch URLs; in offline mode reads from fixtures/',
  async execute(args, _blackboard: Blackboard): Promise<{ url: string; data: unknown; source: string; citations: Citation[] }> {
    const url = String(args.url || '');
    const offlineMode = !process.env.ONLINE_MODE;

    if (offlineMode) {
      const fixtureKey = fixtureKeyFromUrl(url);
      const jsonPath = path.join(FIXTURES_DIR, `${fixtureKey}.json`);
      const txtPath = path.join(FIXTURES_DIR, `${fixtureKey}.txt`);

      if (fs.existsSync(jsonPath)) {
        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        return {
          url, data, source: 'fixture',
          citations: [{ source: `fixture:${fixtureKey}.json`, excerpt: JSON.stringify(data).slice(0, 200) }],
        };
      }
      if (fs.existsSync(txtPath)) {
        const data = fs.readFileSync(txtPath, 'utf-8');
        return {
          url, data, source: 'fixture',
          citations: [{ source: `fixture:${fixtureKey}.txt`, excerpt: data.slice(0, 200) }],
        };
      }
      return {
        url, data: { status: 'offline_demo', message: 'No fixture found for this URL' }, source: 'fixture',
        citations: [{ source: 'offline_fixture_fallback', excerpt: 'No fixture found for URL: ' + url }],
      };
    }

    if (!isAllowed(url)) {
      throw new Error(`URL not in allowlist: ${url}`);
    }

    const https = await import('https');
    const http = await import('http');
    const u = new URL(url);
    const client = u.protocol === 'https:' ? https : http;

    const data = await new Promise<string>((resolve, reject) => {
      client.get(url, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve(body));
      }).on('error', reject);
    });

    let parsed: unknown;
    try { parsed = JSON.parse(data); } catch { parsed = data; }

    return {
      url, data: parsed, source: 'live',
      citations: [{ source: url, excerpt: String(data).slice(0, 200) }],
    };
  },
};
