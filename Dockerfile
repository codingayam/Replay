# Optimized multi-stage production Dockerfile for Railway
FROM node:18-alpine as builder

# Increase memory for Node.js processes to prevent OOM
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install client dependencies with optimization flags
WORKDIR /app/client
RUN npm ci --no-audit --no-fund --prefer-offline

# Copy client source files
COPY client/ ./

# Set production environment and build with production config
ENV NODE_ENV=production
RUN npm run build -- --config vite.config.production.ts || (echo "Build failed. Checking for TypeScript errors..." && npx tsc --noEmit --listFiles | head -20 && exit 1)

# Production dependencies stage - optimized for Railway memory constraints
FROM node:18-alpine as deps

# Set memory limits and optimize for low-memory environments
ENV NODE_OPTIONS="--max-old-space-size=1024 --max-semi-space-size=128"
ENV NPM_CONFIG_MAXSOCKETS=1

# Install only essential system packages
RUN apk add --no-cache --virtual .build-deps \
    python3 \
    make \
    g++ \
    && apk del .build-deps

WORKDIR /app

# Copy server package files
COPY server/package*.json ./server/

# Install server dependencies with aggressive memory optimization
WORKDIR /app/server
RUN npm config set registry https://registry.npmjs.org/ && \
    npm config set maxsockets 1 && \
    npm ci --omit=dev --no-audit --no-fund --prefer-offline --progress=false && \
    npm cache clean --force --silent && \
    npm config delete maxsockets

# Production stage
FROM node:18-alpine as production

# Install system dependencies
RUN apk add --no-cache dumb-init

# Create app directory and user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
WORKDIR /app

# Copy server source files
COPY server/ ./server/

# Copy production node_modules from deps stage
COPY --from=deps /app/server/node_modules ./server/node_modules

# Copy built client from builder stage
COPY --from=builder /app/client/dist ./server/client-dist

# Set ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

# Set working directory to server
WORKDIR /app/server

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3001) + '/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Expose port
EXPOSE ${PORT:-3001}

# Start server with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]