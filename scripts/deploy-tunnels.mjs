#!/usr/bin/env node
/**
 * Starts free public tunnels and updates frontend API URL.
 * Requires backend (:3000) and frontend (:4201) already running locally.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const envFile = path.join(root, 'frontend', 'src', 'environments', 'environment.ts');
const urlsFile = path.join(root, 'public-urls.txt');

function startTunnel(port) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['--yes', 'localtunnel', '--port', String(port)], {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let buf = '';
    const timer = setTimeout(() => reject(new Error(`Tunnel timeout for port ${port}`)), 60000);
    const onData = (chunk) => {
      buf += chunk.toString();
      const match = buf.match(/https:\/\/[^\s]+\.loca\.lt/);
      if (match) {
        clearTimeout(timer);
        resolve({ url: match[0], child });
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', reject);
  });
}

function patchEnvironment(apiUrl, wsUrl) {
  const content = `export const environment = {
  production: false,
  apiUrl: '${apiUrl}',
  wsUrl: '${wsUrl}',
};
`;
  fs.writeFileSync(envFile, content, 'utf8');
}

async function main() {
  console.log('Starting API tunnel (port 3000)...');
  const api = await startTunnel(3000);
  console.log('API:', api.url);

  console.log('Starting Web tunnel (port 4201)...');
  const web = await startTunnel(4201);
  console.log('Web:', web.url);

  const apiBase = `${api.url}/api/v1`;
  const wsBase = `${api.url}/events`;
  patchEnvironment(apiBase, wsBase);

  const summary = [
    '=== BUZINES PUBLIC URLS (free, temporary) ===',
    `Frontend: ${web.url}`,
    `Backend:  ${api.url}`,
    `API:      ${apiBase}`,
    '',
    'First visit may ask tunnel password — enter your public IP from https://loca.lt',
    'Keep this terminal open. Press Ctrl+C to stop tunnels.',
    `Saved: ${urlsFile}`,
  ].join('\n');

  fs.writeFileSync(urlsFile, summary, 'utf8');
  console.log('\n' + summary);

  const cleanup = () => {
    api.child.kill();
    web.child.kill();
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
