FROM node:22-bookworm-slim

# mediasoup may compile native components during install.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ pkg-config ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

# Copy workspace manifests first for better build cache reuse.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/server-node/package.json packages/server-node/package.json
COPY packages/media/package.json packages/media/package.json

RUN npm ci

COPY . .

# Build TypeScript once at image build time.
RUN npm run build

ENV NODE_ENV=production
ARG SERVICE=core
ENV SERVICE=${SERVICE}

CMD ["/bin/sh", "-lc", "case \"$SERVICE\" in core) npm run serve:core ;; node|server-node) npm run serve:node ;; media) npm run serve:media ;; *) echo \"Unknown backend service: $SERVICE\" >&2; exit 1 ;; esac"]
