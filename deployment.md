# Railway Deployment Guide

This document provides instructions for deploying the Replay application to Railway.

## Overview

The deployment uses a multi-stage Docker build optimized for Railway's infrastructure constraints:
- **Builder stage**: Compiles the React TypeScript client
- **Dependencies stage**: Installs server production dependencies with memory optimizations
- **Production stage**: Runs the Express server serving both API and static client files

## Memory Optimizations

The build process includes several optimizations to prevent OOM kills on Railway:

### Build Stage
- `NODE_OPTIONS="--max-old-space-size=2048"` for client build
- `npm ci --no-audit --no-fund --prefer-offline` to reduce memory usage
- Production environment variables loaded during build

### Dependencies Stage
- `NODE_OPTIONS="--max-old-space-size=1024 --max-semi-space-size=128"` 
- `NPM_CONFIG_MAXSOCKETS=1` to limit concurrent downloads
- `npm ci --omit=dev --progress=false` for minimal memory footprint

## Environment Variables

### Required Railway Environment Variables
Set these in your Railway project settings:

```bash
# Database & Authentication
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI Services
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
REPLICATE_API_TOKEN=your_replicate_token

# Server Configuration
NODE_ENV=production
PORT=${{RAILWAY_PORT}}
```

### Build-time Variables
The client build uses these variables (set in `.env.production`):
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_URL=https://your-railway-domain.railway.app
```

## Deployment Steps

### 1. Railway Project Setup
1. Connect your GitHub repository to Railway
2. Set root directory to `/` (repository root)
3. Railway will auto-detect the Dockerfile

### 2. Configure Environment Variables
Add all required environment variables in Railway dashboard under Variables tab.

### 3. Custom Domain (Optional)
1. Add your custom domain in Railway dashboard
2. Update `VITE_API_URL` in client `.env.production` to match your domain
3. Configure CORS settings in server if needed

### 4. Deploy
Railway will automatically build and deploy when you push to your connected branch.

## Build Process

The Docker build follows these stages:

1. **Builder Stage**:
   ```dockerfile
   # Install client dependencies
   npm ci --no-audit --no-fund --prefer-offline
   
   # Build React app with TypeScript compilation
   npm run build
   ```

2. **Dependencies Stage**:
   ```dockerfile
   # Install server production dependencies with memory constraints
   npm ci --omit=dev --no-audit --no-fund --prefer-offline --progress=false
   ```

3. **Production Stage**:
   ```dockerfile
   # Copy built client to server/client-dist
   # Copy server node_modules
   # Start Express server
   node server.js
   ```

## Troubleshooting

### Build Failures

#### "Exit code 1" - Client Build Failed
- Check TypeScript compilation errors
- Verify environment variables are set correctly
- Check for missing dependencies

#### "Exit code 137" - Process Killed (OOM)
- The memory optimizations in the Dockerfile should prevent this
- If it persists, try reducing concurrent processes further

### Runtime Issues

#### Health Check Failures
- Server exposes `/health` endpoint on configured PORT
- Railway health checks timeout after 30 seconds

#### Static File Serving
- Client files are served from `/server/client-dist`
- Express serves SPA with fallback to `index.html`

### Performance Monitoring

Railway provides built-in monitoring for:
- Memory usage
- CPU usage
- Response times
- Error rates

Check the Observability tab in Railway dashboard for metrics.

## File Structure After Build

```
/app/server/
├── server.js                 # Express server entry point
├── node_modules/            # Production dependencies only
├── client-dist/             # Built React app
│   ├── index.html
│   ├── assets/
│   └── ...
└── [other server files]
```

## Security Considerations

- All API routes require Supabase JWT authentication
- CORS configured for production domain
- Helmet middleware for security headers
- Rate limiting enabled
- File uploads restricted and validated