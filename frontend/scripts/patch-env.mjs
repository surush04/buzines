import fs from 'node:fs';

const envFile = 'src/environments/environment.production.ts';
const apiUrl = process.env.API_URL ?? 'https://buzines-api-production.up.railway.app/api/v1';
const wsUrl = apiUrl.replace(/\/api\/v1\/?$/, '/events');

let content = fs.readFileSync(envFile, 'utf8');
content = content.replace(/apiUrl: '[^']*'/, `apiUrl: '${apiUrl}'`);
content = content.replace(/wsUrl: '[^']*'/, `wsUrl: '${wsUrl}'`);
fs.writeFileSync(envFile, content);

console.log('API URL:', apiUrl);
