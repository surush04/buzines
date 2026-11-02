import fs from 'node:fs';

const envFile = 'src/environments/environment.production.ts';
const apiUrl = process.env.API_URL?.trim();
const wsOverride = process.env.WS_URL?.trim();

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
