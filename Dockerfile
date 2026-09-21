FROM node:20-bookworm-slim

# Install system dependencies for native modules and media processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install all dependencies (production + build tools)
RUN npm install

# Copy application codebase
COPY . .

# Build frontend production bundle
RUN npm run build

# Expose container port
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

# Run unified server
CMD ["node", "server.js"]
