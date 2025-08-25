# Alternative Dockerfile specifically for Railway deployment
# This version uses npm install instead of npm ci to avoid lockfile sync issues

FROM node:18-alpine as builder

# Set working directory
WORKDIR /app

# Copy package files
COPY client/package*.json ./client/

# Install client dependencies and build
WORKDIR /app/client
RUN npm install
COPY client/ ./
RUN npm run build

# Production stage
FROM node:18-alpine as production

# Install system dependencies
RUN apk add --no-cache dumb-init

# Create app directory and user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
WORKDIR /app

# Copy server files
COPY server/ ./server/

# Install server dependencies using npm install (more forgiving than npm ci)
WORKDIR /app/server
RUN npm install --omit=dev && npm cache clean --force

# Copy built client from builder stage
COPY --from=builder /app/client/dist ./client-dist

# Set ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3001) + '/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Expose port
EXPOSE ${PORT:-3001}

# Start server with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]