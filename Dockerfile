# Multi-stage Dockerfile for Replay application
# Stage 1: Build the React client
FROM node:18-alpine AS client-builder

WORKDIR /app

# Copy client package files
COPY client/package*.json ./client/
RUN cd client && npm ci --only=production

# Copy client source and build
COPY client/ ./client/
RUN cd client && npm run build

# Stage 2: Setup the Node.js server
FROM node:18-alpine AS server

# Install security updates and dumb-init for proper signal handling
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

WORKDIR /app

# Copy server package files and install dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --only=production && npm cache clean --force

# Copy server source
COPY server/ ./server/

# Copy built client from previous stage
COPY --from=client-builder /app/client/dist ./client/dist

# Create necessary directories and set permissions
RUN mkdir -p /app/server/data/audio /app/server/data/images /app/server/data/day_audio && \
    chown -R nodeuser:nodejs /app

# Switch to non-root user
USER nodeuser

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the server
CMD ["node", "server/server.js"]