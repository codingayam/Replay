# Multi-stage production Dockerfile for Railway
FROM node:18-alpine as builder

# Set working directory
WORKDIR /app

# Copy everything first to ensure paths work
COPY . .

# Install and build client
WORKDIR /app/client
RUN npm ci
RUN npm run build

# Production stage
FROM node:18-alpine as production

# Install system dependencies
RUN apk add --no-cache dumb-init

# Create app directory and user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
WORKDIR /app

# Copy everything to ensure server files are present
COPY . .

# Install server dependencies
WORKDIR /app/server
RUN npm ci --only=production && npm cache clean --force

# Copy built client from builder stage
COPY --from=builder /app/client/dist /app/server/client-dist

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