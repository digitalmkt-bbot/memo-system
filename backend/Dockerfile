FROM node:20-slim

# Chromium for Puppeteer + openssl for Prisma
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium fonts-liberation libnss3 libatk-bridge2.0-0 libgtk-3-0 \
    libasound2 libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 openssl \
    && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm install
RUN npx prisma generate
COPY . .
RUN npm run build
EXPOSE 3000
# Apply schema + seed (idempotent) then start
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && (npx prisma db seed || echo 'seed failed — continuing so the app still starts') && node dist/main.js"]
