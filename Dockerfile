# yt-dlp follows Instagram's changes: keep it recent.
ARG YT_DLP_VERSION=2026.08.19

# Build: install, build the web UI, then gather the server and its production
# dependencies alone in /out. Runs on the build machine's own CPU: what it
# produces is JavaScript, the same for every platform.
FROM --platform=$BUILDPLATFORM node:24-slim AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @spotarr/web build \
 && pnpm --filter @spotarr/server deploy --prod --legacy /out/apps/server \
 && cp -r apps/web/dist /out/apps/web-dist

# yt-dlp, one binary per CPU (musl builds, for Alpine).
FROM scratch AS yt-dlp-amd64
ARG YT_DLP_VERSION
ADD --chmod=755 https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}/yt-dlp_musllinux /yt-dlp
FROM scratch AS yt-dlp-arm64
ARG YT_DLP_VERSION
ADD --chmod=755 https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}/yt-dlp_musllinux_aarch64 /yt-dlp
FROM yt-dlp-${TARGETARCH} AS yt-dlp

# Run: Bun runs the TypeScript as is, on Alpine, the smallest base. Alpine's
# ffmpeg and ffprobe share their libraries; Debian's ffmpeg pulled 450 MB.
FROM oven/bun:1.4.3-alpine
RUN apk add --no-cache ffmpeg
COPY --from=yt-dlp /yt-dlp /usr/local/bin/yt-dlp
COPY --from=build /out/apps/server /app/apps/server
COPY --from=build /out/apps/web-dist /app/apps/web/dist
WORKDIR /app/apps/server
ENV PORT=3000 DATA_DIR=/data
EXPOSE 3000
CMD ["bun", "src/index.ts"]
