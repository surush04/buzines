import fs from 'node:fs';

const envFile = 'src/environments/environment.production.ts';
const liveApiUrl = 'https://buzines-1.onrender.com/api/v1';
const offlineHosts = [
  'https://buzines-api-production.up.railway.app',
  'https://buzines-api.onrender.com',
];
const configuredApiUrl = process.env.API_URL?.trim()?.replace(/\/$/, '');
const apiUrl = offlineHosts.some(
  (host) => configuredApiUrl === host || configuredApiUrl === `${host}/api/v1`,
)
  ? liveApiUrl
  : configuredApiUrl;
const wsOverride = process.env.WS_URL?.trim();

if (configuredApiUrl && configuredApiUrl !== apiUrl) {
  console.warn(`API_URL ${configuredApiUrl} is offline. Using ${apiUrl}.`);
}

if (!apiUrl) {
  console.warn(
    'API_URL is not set. Production build will keep the REPLACE_WITH_CLOUDFLARE_PUBLIC_HOST placeholder.',
  );
  process.exit(0);
}

const wsUrl =
  wsOverride || apiUrl.replace(/\/api\/v1\/?$/, '/events');

if (apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1')) {
  console.error('API_URL must not use localhost or 127.0.0.1 in production.');
  process.exit(1);
}

let content = fs.readFileSync(envFile, 'utf8');
content = content.replace(/apiUrl: '[^']*'/, `apiUrl: '${apiUrl}'`);
content = content.replace(/wsUrl: '[^']*'/, `wsUrl: '${wsUrl}'`);
fs.writeFileSync(envFile, content);

console.log('Patched production environment');
console.log('API URL:', apiUrl);
console.log('WS URL (Socket.IO over HTTPS/WSS):', wsUrl);
