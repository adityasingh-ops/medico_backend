# Multi-stage build, following the Node.js Docker best practices
# (https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)

# Stage 1: install all deps and compile TypeScript
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 2: production deps only (no TypeScript, Jest, ts-node)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Stage 3: runtime image
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=5858
# Patch OS packages; npm is not needed at runtime and only adds CVEs
RUN apk upgrade --no-cache && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# Set by CI so /version and every log line say which commit is running
ARG GIT_SHA=unknown
ENV GIT_SHA=$GIT_SHA \
    APP_VERSION=$GIT_SHA

# Built-in non-root user from the node image
USER node
EXPOSE 5858
# Exec form: node is PID 1 and receives SIGTERM directly
CMD ["node", "dist/server.js"]
