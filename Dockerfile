FROM node:20-alpine AS base
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-fund --no-audit

COPY . .

ENV NODE_ENV=production
EXPOSE 8080

USER node

CMD ["node", "src/server.js"]
