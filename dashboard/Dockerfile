# Aegis Mission Control — Next.js (standalone) for Cloud Run.
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install
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
