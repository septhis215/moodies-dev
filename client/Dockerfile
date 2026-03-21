# Stage 1 — Install deps
FROM node:20-alpine AS deps
WORKDIR /app

# Install only dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2 — Build app
FROM node:20-alpine AS builder
WORKDIR /app

# Target environment: staging (default) | production
ARG APP_ENV=staging
ENV APP_ENV=${APP_ENV}

# Copy only source code (exclude .next via .dockerignore)
COPY . .
COPY --from=deps /app/node_modules ./node_modules

# Ensure no stale artifacts
RUN rm -rf .next

# Build with the env file for the target environment
RUN npm run build:${APP_ENV}

# Stage 3 — Production runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
EXPOSE 3000

# Copy only what’s needed
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=deps /app/node_modules ./node_modules

# Runtime env vars are injected by docker-compose via env_file.
# NEXT_PUBLIC_* vars are already baked into the build output.
CMD ["node_modules/.bin/next", "start"]
