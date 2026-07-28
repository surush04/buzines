FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Override in Railway: Settings → Variables → API_URL
ARG API_URL=https://buzines-api-production.up.railway.app/api/v1
ENV API_URL=${API_URL}
RUN node -e "const fs=require('fs');const p='src/environments/environment.production.ts';const u=process.env.API_URL;const w=u.replace(/\\/api\\/v1\\/?$/,'/events');let c=fs.readFileSync(p,'utf8');c=c.replace(/apiUrl: '[^']*'/,\"apiUrl: '\"+u+\"'\");c=c.replace(/wsUrl: '[^']*'/,\"wsUrl: '\"+w+\"'\");fs.writeFileSync(p,c);"

RUN npm run build

FROM node:22-alpine
WORKDIR /app

RUN npm install -g serve@14

COPY --from=builder /app/dist/frontend/browser ./dist

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["sh", "-c", "serve -s dist -l ${PORT:-8080}"]
