#!/bin/bash

# Replay Deployment Script
# This script handles deployment to both Vercel (frontend) and Railway (backend)

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    if ! command -v vercel &> /dev/null; then
        print_warning "Vercel CLI is not installed. Install with: npm install -g vercel"
    fi
    
    if ! command -v railway &> /dev/null; then
        print_warning "Railway CLI is not installed. Install with: npm install -g @railway/cli"
    fi
}

# Run tests
run_tests() {
    print_status "Running tests..."
    
    # Install dependencies
    print_status "Installing root dependencies..."
    npm ci
    
    print_status "Installing client dependencies..."
    cd client && npm ci && cd ..
    
    print_status "Installing server dependencies..."
    cd server && npm ci && cd ..
    
    # Run tests
    print_status "Running client tests..."
    cd client && npm run test:ci && cd ..
    
    print_status "Running server tests..."
    cd server && npm run test:ci && cd ..
    
    print_success "All tests passed!"
}

# Build client
build_client() {
    print_status "Building client..."
    cd client && npm run build && cd ..
    print_success "Client built successfully!"
}

# Deploy to Vercel
deploy_vercel() {
    print_status "Deploying frontend to Vercel..."
    
    if command -v vercel &> /dev/null; then
        cd client
        vercel --prod --yes
        cd ..
        print_success "Frontend deployed to Vercel!"
    else
        print_error "Vercel CLI not installed. Skipping frontend deployment."
        return 1
    fi
}

# Deploy to Railway
deploy_railway() {
    print_status "Deploying backend to Railway..."
    
    if command -v railway &> /dev/null; then
        cd server
        railway up
        cd ..
        print_success "Backend deployed to Railway!"
    else
        print_error "Railway CLI not installed. Skipping backend deployment."
        return 1
    fi
}

# Health checks
health_check() {
    print_status "Running health checks..."
    
    sleep 10  # Wait for deployments to become available
    
    # Check backend health
    print_status "Checking backend health..."
    if curl -f -s https://replay-production-a5ab.up.railway.app/health > /dev/null; then
        print_success "Backend is healthy!"
    else
        print_error "Backend health check failed!"
        return 1
    fi
    
    # Check frontend
    print_status "Checking frontend..."
    if curl -f -s https://replay.agrix.ai/ > /dev/null || curl -f -s https://replay.vercel.app/ > /dev/null; then
        print_success "Frontend is accessible!"
    else
        print_error "Frontend health check failed!"
        return 1
    fi
}

# Main deployment function
deploy() {
    print_status "Starting deployment process..."
    
    check_dependencies
    
    # Run tests unless --skip-tests flag is passed
    if [[ "$1" != "--skip-tests" ]]; then
        run_tests
    else
        print_warning "Skipping tests (--skip-tests flag detected)"
    fi
    
    build_client
    
    # Deploy in parallel if possible
    if command -v vercel &> /dev/null && command -v railway &> /dev/null; then
        print_status "Deploying to both platforms..."
        deploy_vercel &
        deploy_railway &
        wait  # Wait for both deployments to complete
    else
        # Deploy sequentially if tools are missing
        deploy_vercel || print_warning "Frontend deployment skipped"
        deploy_railway || print_warning "Backend deployment skipped"
    fi
    
    health_check
    
    print_success "🚀 Deployment complete!"
    print_status "Frontend: https://replay.agrix.ai/"
    print_status "Backend: https://replay-production-a5ab.up.railway.app/"
}

# Handle script arguments
case "${1:-deploy}" in
    "test")
        run_tests
        ;;
    "build")
        build_client
        ;;
    "deploy")
        deploy "$2"
        ;;
    "health")
        health_check
        ;;
    "help"|"--help"|"-h")
        echo "Replay Deployment Script"
        echo ""
        echo "Usage: $0 [command] [options]"
        echo ""
        echo "Commands:"
        echo "  test      Run tests only"
        echo "  build     Build client only"
        echo "  deploy    Full deployment (default)"
        echo "  health    Run health checks only"
        echo "  help      Show this help message"
        echo ""
        echo "Options for deploy:"
        echo "  --skip-tests  Skip running tests before deployment"
        ;;
    *)
        print_error "Unknown command: $1"
        echo "Use '$0 help' for usage information."
        exit 1
        ;;
esac