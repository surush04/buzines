# buzines-web on Railway — build from repo root (Root Directory = empty)
# buzines-api uses backend/ with its own Dockerfile

FROM node:22-alpine AS builder
WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .

ARG API_URL=https://buzines-api-production.up.railway.app/api/v1
ENV API_URL=${API_URL}
RUN node scripts/patch-env.mjs
RUN npm run build

FROM node:22-alpine
WORKDIR /app

RUN npm install -g serve@14

COPY --from=builder /app/dist/frontend/browser ./dist

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "serve -s dist -l ${PORT:-8080}"]
