# Aegis Mission Control — Next.js (standalone) for Cloud Run.
# pnpm is pinned via package.json "packageManager" (corepack) so the container build
# matches local and doesn't pull a pnpm that needs a newer Node than this image.
FROM node:20-alpine AS build
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN corepack install && (pnpm install --frozen-lockfile || pnpm install)
COPY . ./
# Bake the control-plane API base in at build time for Live mode (optional).
ARG NEXT_PUBLIC_AEGIS_API=""
ENV NEXT_PUBLIC_AEGIS_API=$NEXT_PUBLIC_AEGIS_API
RUN pnpm build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 8080
CMD ["node", "server.js"]
