# syntax=docker/dockerfile:1

FROM node:24.11.1-bookworm-slim AS build

WORKDIR /app
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1

COPY src/shared/ui/package*.json src/shared/ui/
COPY src/shared/http/package*.json src/shared/http/
COPY src/admin/package*.json src/admin/
COPY src/backend/package*.json src/backend/

RUN npm ci --include=dev --no-audit --no-fund --prefix src/shared/ui \
    && npm ci --include=dev --no-audit --no-fund --prefix src/shared/http \
    && npm ci --include=dev --no-audit --no-fund --prefix src/admin \
    && npm ci --include=dev --no-audit --no-fund --prefix src/backend

COPY package.json package.json
COPY scripts/stage-admin-public.mjs scripts/stage-admin-public.mjs
COPY src/admin src/admin
COPY src/backend src/backend
COPY src/shared src/shared

RUN npm run build --prefix src/admin \
    && node scripts/stage-admin-public.mjs \
    && npm run build --prefix src/backend \
    && npm prune --omit=dev --prefix src/backend

FROM node:24.11.1-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    ADMIN_DIST=/app/src/backend/public

COPY package.json package.json
COPY --from=build /app/src/backend/package*.json src/backend/
COPY --from=build /app/src/backend/node_modules src/backend/node_modules
COPY --from=build /app/src/backend/dist src/backend/dist
COPY --from=build /app/src/backend/public src/backend/public
COPY --from=build /app/src/shared/media/dist src/shared/media/dist
COPY --from=build /app/src/shared/watch/dist src/shared/watch/dist
COPY src/shared/media/package.json src/shared/media/package.json
COPY src/shared/watch/package.json src/shared/watch/package.json
COPY tools/ffmpeg tools/ffmpeg
RUN chmod +x tools/ffmpeg/linux-x64/bin/ffmpeg tools/ffmpeg/linux-x64/bin/ffprobe

USER node
EXPOSE 8080
CMD ["node", "src/backend/dist/server.js"]
