FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY contracts ./contracts
COPY fixtures ./fixtures
COPY services ./services
COPY scripts ./scripts

EXPOSE 8787

CMD ["node", "services/mock-api/server.mjs"]
