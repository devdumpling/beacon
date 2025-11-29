# Beacon - Task Runner
# Install Just: https://github.com/casey/just

set dotenv-load
set positional-arguments

# Default: show available commands
default:
    @just --list

# ─────────────────────────────────────────────────────────────
# Development
# ─────────────────────────────────────────────────────────────

# Start all services for local development
dev: db-up
    #!/usr/bin/env bash
    trap 'kill 0' EXIT
    just dev-api &
    just dev-dashboard &
    wait

# Start Gleam API in watch mode
dev-api:
    cd apps/api && gleam run -m beacon

# Start SvelteKit dashboard
dev-dashboard:
    pnpm --filter dashboard dev

# ─────────────────────────────────────────────────────────────
# Build
# ─────────────────────────────────────────────────────────────

# Build all packages
build: build-types build-sdk build-api build-dashboard

# Build Gleam API
build-api:
    cd apps/api && gleam build

# Build SvelteKit dashboard
build-dashboard:
    pnpm --filter dashboard build

# Build SDK package
build-sdk:
    pnpm --filter @beacon/sdk build

# Build shared types
build-types:
    pnpm --filter @beacon/types build

# ─────────────────────────────────────────────────────────────
# Test
# ─────────────────────────────────────────────────────────────

# Run all tests
test: test-api test-sdk test-dashboard

# Test Gleam API
test-api:
    cd apps/api && gleam test

# Test SDK
test-sdk:
    pnpm --filter @beacon/sdk test

# Test dashboard
test-dashboard:
    pnpm --filter dashboard test

# ─────────────────────────────────────────────────────────────
# Lint & Format
# ─────────────────────────────────────────────────────────────

# Lint and format all code
lint: lint-api lint-ts

# Format Gleam code
lint-api:
    cd apps/api && gleam format

# Lint TypeScript/Svelte
lint-ts:
    pnpm prettier --write .
    pnpm --filter dashboard lint

# ─────────────────────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────────────────────

# Start Postgres container
db-up:
    docker compose -f infra/docker-compose.yml up -d postgres

# Stop Postgres container
db-down:
    docker compose -f infra/docker-compose.yml down

# Run database migrations
db-migrate:
    dbmate -d infra/migrations up

# Rollback last migration
db-rollback:
    dbmate -d infra/migrations down

# Reset database (drop + migrate)
db-reset:
    dbmate -d infra/migrations drop
    dbmate -d infra/migrations up

# Open psql shell
db-shell:
    docker compose -f infra/docker-compose.yml exec postgres psql -U beacon -d beacon

# ─────────────────────────────────────────────────────────────
# Setup
# ─────────────────────────────────────────────────────────────

# Initial project setup
setup: _check-deps
    pnpm install
    cd apps/api && gleam deps download
    just db-up
    sleep 2
    just db-migrate
    @echo "✓ Setup complete. Run 'just dev' to start."

# Check required dependencies are installed
_check-deps:
    #!/usr/bin/env bash
    set -euo pipefail
    
    check() {
        if ! command -v "$1" &> /dev/null; then
            echo "✗ $1 not found. Install: $2"
            exit 1
        fi
        echo "✓ $1"
    }
    
    echo "Checking dependencies..."
    check pnpm "npm install -g pnpm"
    check gleam "https://gleam.run/getting-started/"
    check docker "https://docs.docker.com/get-docker/"
    check dbmate "brew install dbmate"

# ─────────────────────────────────────────────────────────────
# Release
# ─────────────────────────────────────────────────────────────

# Build production Docker image for API
docker-build-api:
    docker build -f infra/Dockerfile.api -t beacon-api:latest .

# Publish SDK to npm
publish-sdk version:
    cd packages/sdk && pnpm version {{version}}
    pnpm --filter @beacon/sdk publish --access public
