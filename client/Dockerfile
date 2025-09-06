# Stage 1 — Install deps
FROM node:20-alpine AS deps
WORKDIR /app

# Install only dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2 — Build app
FROM node:20-alpine AS builder
WORKDIR /app

# Copy only source code (exclude .next via .dockerignore)
COPY . .
COPY --from=deps /app/node_modules ./node_modules

# Ensure no stale artifacts
RUN rm -rf .next

# Build (with Turbopack since you use it)
RUN npm run build

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

CMD ["npm", "run", "start"]
