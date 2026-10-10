# TrackED API — Express + Mongoose + server-side face matching.
#
# Build context is this directory (`backend/`): in Coolify set the app's
# "Base Directory" to `backend` and leave the Dockerfile path as `Dockerfile`.
#
# The face matcher uses the pure-JS TensorFlow backend (@tensorflow/tfjs, with
# @tensorflow/tfjs-node aliased to it in package.json) and bcryptjs, so no
# native compilation is needed and alpine works without a build toolchain.
FROM node:22-alpine

# TRACKED_NO_AUTO_FREE stops the in-process port-recovery logic in server.js
# from killing processes inside the container. The package.json prestart hook
# is likewise bypassed by running `node server.js` directly below.
ENV NODE_ENV=production \
    PORT=5000 \
    TRACKED_NO_AUTO_FREE=1

WORKDIR /app

# Dependencies first, so editing source does not invalidate the install layer.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Application source, including the committed face models (models/face, ~7 MB).
COPY . .

# Upload target for multer (profile pictures, enrolled face photos, excuse and
# complaint attachments) and the mount point for the Coolify volume. Created and
# chowned here so a fresh Docker volume inherits a writable ownership.
RUN mkdir -p /app/uploads && chown -R node:node /app

USER node
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
