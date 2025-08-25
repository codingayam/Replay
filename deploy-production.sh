#!/bin/bash

# Production deployment script for Replay application
# This script deploys both frontend (Vercel) and backend (Railway)

set -e  # Exit on any error

echo "🚀 Starting production deployment for Replay..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if required tools are installed
command -v vercel >/dev/null 2>&1 || { echo -e "${RED}❌ Vercel CLI is required but not installed. Install with: npm i -g vercel${NC}" >&2; exit 1; }
command -v railway >/dev/null 2>&1 || { echo -e "${RED}❌ Railway CLI is required but not installed. Install with: npm i -g @railway/cli${NC}" >&2; exit 1; }

# Function to print status
print_status() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Step 1: Clean and prepare
print_status "Cleaning previous builds..."
rm -rf client/dist
rm -rf server/node_modules/.cache

# Step 2: Install dependencies and test
print_status "Installing client dependencies..."
cd client
npm ci --prefer-offline --no-audit

print_status "Running client tests..."
npm run test:ci || {
    print_error "Client tests failed!"
    exit 1
}

print_status "Building client for production..."
npm run build || {
    print_error "Client build failed!"
    exit 1
}

cd ..

print_status "Installing server dependencies..."
cd server
npm ci --prefer-offline --no-audit

print_status "Running server tests..."
npm run test:ci || {
    print_warning "Server tests failed, but continuing..."
}

cd ..

# Step 3: Deploy to Railway (backend)
print_status "Deploying backend to Railway..."
railway up || {
    print_error "Railway deployment failed!"
    exit 1
}

print_success "Backend deployed to Railway!"

# Wait for Railway deployment to be ready
print_status "Waiting for backend to be ready..."
sleep 30

# Health check for backend
if curl -f https://replay-production-fab1.up.railway.app/health >/dev/null 2>&1; then
    print_success "Backend health check passed!"
else
    print_warning "Backend health check failed, but continuing with frontend deployment..."
fi

# Step 4: Deploy to Vercel (frontend)
print_status "Deploying frontend to Vercel..."
vercel --prod --yes || {
    print_error "Vercel deployment failed!"
    exit 1
}

print_success "Frontend deployed to Vercel!"

# Step 5: Final verification
print_status "Performing final verification..."

# Check frontend
if curl -f https://replay.agrix.ai/ >/dev/null 2>&1; then
    print_success "Frontend is accessible!"
else
    print_error "Frontend verification failed!"
    exit 1
fi

# Final success message
echo
echo "🎉 Deployment completed successfully!"
echo
echo "📱 Frontend URL: https://replay.agrix.ai/"
echo "🔧 Backend URL:  https://replay-production-fab1.up.railway.app/"
echo "💚 Health Check: https://replay-production-fab1.up.railway.app/health"
echo
echo "🔍 Next steps:"
echo "  1. Test the application thoroughly"
echo "  2. Monitor logs for any issues"
echo "  3. Check both frontend and backend functionality"
echo

exit 0