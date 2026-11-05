FROM node:24.18.1-bookworm-slim AS build

WORKDIR /app

RUN npm install -g npm@11.16.0

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .

# Prisma Config membutuhkan DATABASE_URL saat generate.
# URL ini dummy dan tidak digunakan untuk mengakses database.
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" \
    sh -c 'npm run build && npm run tools:build'

FROM build AS migrate

CMD ["npm", "run", "prisma:deploy"]

FROM node:24.18.1-bookworm-slim AS app

WORKDIR /app

ENV NODE_ENV=production

RUN npm install -g npm@11.16.0

COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

USER node

CMD ["node", "dist/main.js"]