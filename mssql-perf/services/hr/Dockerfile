FROM node:18-alpine

WORKDIR /app

# Install required packages
RUN apk add --no-cache wget

# Copy package files first for layer caching
COPY package.json .
RUN npm install

# Copy application code
COPY src ./src

#newrelic instrumentation
ENV NEW_RELIC_NO_CONFIG_FILE=true
ENV NEW_RELIC_DISTRIBUTED_TRACING_ENABLED=true
ENV NEW_RELIC_LOG=stdout

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "src/app.js"]
