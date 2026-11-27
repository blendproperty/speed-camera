FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --chown=node:node package.json next.config.mjs ./
COPY --chown=node:node lib ./lib
COPY --chown=node:node db ./db
COPY --chown=node:node scripts ./scripts
USER node
EXPOSE 3000
CMD ["node","node_modules/next/dist/bin/next","start","--hostname","0.0.0.0"]
