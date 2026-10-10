# TrackED web client — builds the React/Vite SPA and serves it with nginx.
#
# Build context is this directory (`frontend/`): in Coolify set the app's
# "Base Directory" to `frontend` and leave the Dockerfile path as `Dockerfile`.
#
# nginx does more than serve static files: it reverse-proxies /api and /uploads
# to the API container, so the browser only ever talks to this one origin. That
# is what lets the SPA use relative URLs (no VITE_API_URL, no CORS).
FROM node:22-alpine AS build

WORKDIR /app

# Dependencies first, so editing source does not invalidate the install layer.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

# Target of the /api and /uploads proxy. Override in Coolify with the API
# service's internal Docker hostname. Must have no trailing slash. The nginx
# image substitutes this into the template at container start.
ENV BACKEND_URL=http://tracked-api:5000

# Named default.conf.template so the rendered output replaces nginx's stock
# default.conf (written to /etc/nginx/conf.d/default.conf by the entrypoint).
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
