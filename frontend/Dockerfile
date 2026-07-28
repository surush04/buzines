FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG API_URL=https://buzines-api-production.up.railway.app/api/v1
ENV API_URL=${API_URL}
RUN node scripts/patch-env.mjs
RUN npm run build

FROM node:22-alpine
WORKDIR /app

RUN npm install -g serve@14

COPY --from=builder /app/dist/frontend/browser ./dist
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080
CMD ["./start.sh"]
