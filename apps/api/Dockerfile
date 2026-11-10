FROM node:24.22.1-bookworm-slim AS build
WORKDIR /workspace
RUN npm install --global pnpm@10.34.5
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm --filter @kwartrack/api... install --frozen-lockfile
COPY apps/api/tsconfig.json apps/api/tsconfig.json
COPY apps/api/src apps/api/src
RUN pnpm --filter @kwartrack/api build

FROM node:24.22.1-bookworm-slim
ENV APP_ENV=local API_HOST=0.0.0.0 API_PORT=3000 AWS_ENDPOINT_URL=http://floci:4566
WORKDIR /workspace/apps/api
COPY --from=build --chown=node:node /workspace/node_modules /workspace/node_modules
COPY --from=build --chown=node:node /workspace/apps/api/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/apps/api/package.json ./package.json
COPY --from=build --chown=node:node /workspace/apps/api/dist ./dist
COPY --chown=node:node apps/api/drizzle ./drizzle
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
