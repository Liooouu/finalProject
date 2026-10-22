FROM node:22-alpine AS web

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ARG VITE_GOOGLE_MAPS_EMBED_KEY=
ENV VITE_GOOGLE_MAPS_EMBED_KEY=$VITE_GOOGLE_MAPS_EMBED_KEY
RUN npm run build

FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=8080 \
    TRACKED_NO_AUTO_FREE=1

WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY backend/ ./
COPY --from=web /app/frontend/dist /app/frontend-dist
RUN chown -R node:node /app

USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
