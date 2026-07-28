#!/usr/bin/env node
/**
 * Buzines public deploy via Localtunnel (https://localtunnel.github.io/www/)
 * Serves a production build (not ng serve) — dev/Vite HMR breaks through tunnels.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const frontendDir = path.join(root, 'frontend');
const envFile = path.join(frontendDir, 'src', 'environments', 'environment.ts');
const distDir = path.join(frontendDir, 'dist', 'frontend', 'browser');
const urlsFile = path.join(root, 'public-urls.txt');
const FRONTEND_PORT = 4201;

function ltAvailable() {
  const check = spawnSync('lt', ['--version'], { shell: true, encoding: 'utf8' });
  return check.status === 0;
}

function startTunnel(port) {
  return new Promise((resolve, reject) => {
    const args = ['--port', String(port), '--local-host', '127.0.0.1'];
    const useLt = ltAvailable();
    const cmd = useLt ? 'lt' : 'npx';
    const fullArgs = useLt ? args : ['--yes', 'localtunnel', ...args];

    if (!useLt) {
      console.warn('Tip: npm install -g localtunnel  then use: lt --port', port);
    }

    const child = spawn(cmd, fullArgs, {
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
  fs.writeFileSync(
    envFile,
    `export const environment = {
  production: false,
  apiUrl: '${apiUrl}',
  wsUrl: '${wsUrl}',
};
`,
    'utf8',
  );
}

function killPort(port) {
  const find = spawnSync('netstat', ['-ano'], { shell: true, encoding: 'utf8' });
  const pids = new Set();
  for (const line of find.stdout.split('\n')) {
    if (!line.includes(`:${port}`) || !line.includes('LISTENING')) continue;
    const pid = Number(line.trim().split(/\s+/).pop());
    if (pid > 0) pids.add(pid);
  }
  for (const pid of pids) {
    spawnSync('taskkill', ['/PID', String(pid), '/F'], { shell: true, stdio: 'ignore' });
  }
}

function waitForPort(port, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const check = spawnSync(
        'powershell',
        [
          '-NoProfile',
          '-Command',
          `(Test-NetConnection -ComputerName 127.0.0.1 -Port ${port} -WarningAction SilentlyContinue).TcpTestSucceeded`,
        ],
        { shell: true, encoding: 'utf8' },
      );
      if (check.stdout?.trim() === 'True') return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error(`Port ${port} did not open in time`));
      setTimeout(tick, 500);
    };
    tick();
  });
}

function buildFrontend() {
  console.log('Building frontend for public access...');
  const result = spawnSync('npm', ['run', 'build', '--', '--configuration=development'], {
    cwd: frontendDir,
    shell: true,
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error('Frontend build failed');
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    throw new Error(`Build output missing: ${distDir}`);
  }
}

function startStaticServer(port) {
  console.log(`Serving built frontend on http://127.0.0.1:${port}`);
  killPort(port);
  const child = spawn(
    'npx',
    ['--yes', 'serve', '-s', distDir, '-l', String(port), '--no-clipboard'],
    { shell: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PORT: String(port) } },
  );
  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  child.on('exit', (code) => {
    if (code) console.error(`Static server exited with code ${code}`);
  });
  return child;
}

async function main() {
  console.log('Localtunnel — expose local Buzines to the internet\n');

  console.log('Starting API tunnel: lt --port 3000');
  const api = await startTunnel(3000);
  console.log('API URL:', api.url);

  const apiBase = `${api.url}/api/v1`;
  patchEnvironment(apiBase, `${api.url}/events`);

  buildFrontend();
  const staticServer = startStaticServer(FRONTEND_PORT);
  await waitForPort(FRONTEND_PORT);

  console.log('Starting Web tunnel: lt --port 4201');
  const web = await startTunnel(FRONTEND_PORT);
  console.log('Web URL:', web.url);

  const summary = [
    '=== BUZINES PUBLIC URLS (Localtunnel) ===',
    `Frontend: ${web.url}`,
    `Backend:  ${api.url}`,
    `API:      ${apiBase}`,
    '',
    'Frontend is a production build (stable through tunnels).',
    'Share the Frontend URL while this window stays open.',
    'First visit may ask for tunnel password — use your public IP from https://loca.lt',
    '',
    'Manual quickstart:',
    '  lt --port 3000   (backend)',
    '  lt --port 4201   (frontend static)',
    '',
    `Saved: ${urlsFile}`,
  ].join('\n');

  fs.writeFileSync(urlsFile, summary, 'utf8');
  console.log('\n' + summary);

  const cleanup = () => {
    api.child.kill();
    web.child.kill();
    staticServer.kill();
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
