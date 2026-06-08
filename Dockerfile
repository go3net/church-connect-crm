# Church Connect CRM — deterministic build (bypasses Nixpacks cache quirks)
FROM node:20-bookworm-slim AS base
WORKDIR /app
# prisma needs openssl + CA certs at build and runtime
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# install deps (postinstall runs `prisma generate`, so the schema must be present)
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# build
COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
EXPOSE 3000

# apply migrations then serve (PORT is provided by Railway)
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
