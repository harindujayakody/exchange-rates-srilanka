# LKR Rates: one container serving the web app, the API and the Telegram bot.
# Build: docker build -t lkr-rates .   Run: see docker-compose.yml

# 1) Build the web app, and collect the four font files the bot's share images use.
FROM node:22-bookworm-slim AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build \
 && mkdir -p /fonts/@fontsource-variable/inter/files /fonts/@fontsource-variable/jetbrains-mono/files /fonts/@fontsource/poppins/files \
 && cp node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2 /fonts/@fontsource-variable/inter/files/ \
 && cp node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2 /fonts/@fontsource-variable/jetbrains-mono/files/ \
 && cp node_modules/@fontsource/poppins/files/poppins-latin-700-normal.woff2 node_modules/@fontsource/poppins/files/poppins-latin-800-normal.woff2 /fonts/@fontsource/poppins/files/

# 2) Runtime: the zero-dependency server plus the optional canvas library for bot images.
FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server.mjs bot.mjs cardimage.mjs ./
COPY web/src/card.js web/src/card.js
COPY web/public/logo.png web/public/logo.png
COPY --from=web /app/web/dist web/dist
COPY --from=web /fonts/ web/node_modules/
# Rates, history, usage and bot subscribers live in /data: mount a volume there so they survive redeploys.
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=60s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
