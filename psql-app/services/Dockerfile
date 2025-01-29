FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

ARG PORT=5000
ENV PORT=${PORT}

COPY . .

EXPOSE ${PORT}

# New Relic Configuration
ENV NEW_RELIC_NO_CONFIG_FILE=true
ENV NEW_RELIC_DISTRIBUTED_TRACING_ENABLED=true
ENV NEW_RELIC_LOG=stdout

HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=3 CMD curl -f http://localhost:${PORT}/health || exit 1

CMD ["node", "--max-old-space-size=2048", "app.js"]
