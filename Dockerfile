# ---- Base ----
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
COPY package.json pnpm-lock.yaml* ./
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else pnpm install; fi
COPY . .
RUN pnpm exec prisma generate

# ---- Development (hot reload) ----
FROM base AS development
ENV NODE_ENV=development
EXPOSE 3001
CMD ["pnpm", "run", "start:dev"]

# ---- Build ----
FROM base AS build
RUN pnpm run build

# ---- Production ----
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl libc6-compat
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
COPY package.json pnpm-lock.yaml* ./
# Instala apenas deps de produção (express/multer agora estão em dependencies)
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --prod --frozen-lockfile; else pnpm install --prod; fi
COPY prisma ./prisma
RUN pnpm exec prisma generate || npx prisma generate || true
COPY --from=build /app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/src/main.js"]
