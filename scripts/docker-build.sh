#!/bin/bash

# Docker Build Script for Web Crawler AI
# This script handles common Docker build issues

set -e

echo "🐳 Web Crawler AI - Docker Build Script"
echo "========================================"

# Function to print colored output
print_info() {
    echo -e "\033[1;34m[INFO]\033[0m $1"
}

print_success() {
    echo -e "\033[1;32m[SUCCESS]\033[0m $1"
}

print_error() {
    echo -e "\033[1;31m[ERROR]\033[0m $1"
}

print_warning() {
    echo -e "\033[1;33m[WARNING]\033[0m $1"
}

# Clean up any existing containers
print_info "Cleaning up existing containers..."
docker compose down --remove-orphans 2>/dev/null || true

# Remove any dangling images
print_info "Removing dangling Docker images..."
docker image prune -f 2>/dev/null || true

# Check if lockfiles are problematic
print_info "Checking for problematic lockfiles..."
if [ -f "package-lock.json" ]; then
    # Check if lockfile is very old
    if find package-lock.json -mtime +30 -type f 2>/dev/null | grep -q .; then
        print_warning "package-lock.json is older than 30 days, consider regenerating"
    fi
fi

if [ -f "frontend/package-lock.json" ]; then
    if find frontend/package-lock.json -mtime +30 -type f 2>/dev/null | grep -q .; then
        print_warning "frontend/package-lock.json is older than 30 days, consider regenerating"
    fi
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found, copying from .env.example"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_info "Created .env file from .env.example"
        print_warning "Please edit .env file and add your OPENAI_API_KEY before building"
    else
        print_error ".env.example not found, creating minimal .env"
        cat > .env << EOF
NODE_ENV=production
OPENAI_API_KEY=your_openai_api_key_here
PORT=3000
NEXT_PUBLIC_API_URL=http://localhost:3000/api
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
EOF
        print_warning "Created minimal .env file. Please add your OPENAI_API_KEY!"
    fi
fi

# Build mode selection
MODE=${1:-production}

case $MODE in
    "dev"|"development")
        print_info "Building development environment..."
        docker compose -f docker compose.dev.yaml build --no-cache
        print_success "Development build completed!"
        print_info "To start: docker compose -f docker compose.dev.yaml up"
        ;;
    "prod"|"production")
        print_info "Building production environment..."
        docker compose build --no-cache
        print_success "Production build completed!"
        print_info "To start: docker compose up -d"
        ;;
    "clean")
        print_info "Performing clean build (removing all images)..."
        docker compose down --rmi all --volumes --remove-orphans 2>/dev/null || true
        docker system prune -af
        print_success "Clean completed!"
        ;;
    *)
        print_error "Unknown mode: $MODE"
        echo "Usage: $0 [dev|prod|clean]"
        echo "  dev/development  - Build development environment"
        echo "  prod/production  - Build production environment (default)"
        echo "  clean           - Clean all Docker images and rebuild"
        exit 1
        ;;
esac

# Final instructions
echo ""
print_success "Docker build process completed!"
echo ""
print_info "Next steps:"
case $MODE in
    "dev"|"development")
        echo "  1. Start development environment: docker compose -f docker compose.dev.yaml up"
        echo "  2. Access frontend: http://localhost:3001"
        echo "  3. Access backend: http://localhost:3000"
        ;;
    "prod"|"production")
        echo "  1. Start production environment: docker compose up -d"
        echo "  2. View logs: docker compose logs -f"
        echo "  3. Access frontend: http://localhost:3001"
        echo "  4. Access backend: http://localhost:3000"
        ;;
esac
echo ""
print_info "Health checks:"
echo "  - Backend health: curl http://localhost:3000/health"
echo "  - Frontend health: curl http://localhost:3001"
echo ""

if grep -q "your_openai_api_key_here" .env 2>/dev/null; then
    print_warning "⚠️  Remember to update your OPENAI_API_KEY in .env file!"
fi