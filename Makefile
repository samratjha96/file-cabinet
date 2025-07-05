# File Cabinet - Development Makefile
# Run `make help` to see all available commands

.PHONY: help install dev build clean setup-env start-backend start-frontend

# Default target
.DEFAULT_GOAL := help

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)File Cabinet - Development Commands$(NC)"
	@echo ""
	@echo "$(YELLOW)Quick Start:$(NC)"
	@echo "  make setup    - Complete setup for new developers"
	@echo "  make dev      - Start development servers"
	@echo ""
	@echo "$(YELLOW)Available Commands:$(NC)"
	@awk 'BEGIN {FS = ":.*##"; printf ""} /^[a-zA-Z_-]+:.*?##/ { printf "  $(GREEN)%-12s$(NC) %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

install: ## Install all dependencies
	@echo "$(BLUE)Installing dependencies...$(NC)"
	@echo "$(YELLOW)Installing backend dependencies...$(NC)"
	@cd backend && npm install
	@echo "$(YELLOW)Installing frontend dependencies...$(NC)"
	@cd frontend && npm install
	@echo "$(GREEN)✓ All dependencies installed!$(NC)"

setup-env: ## Setup environment files from examples
	@echo "$(BLUE)Setting up environment files...$(NC)"
	@if [ ! -f backend/.env ]; then \
		cp backend/env.example backend/.env; \
		echo "$(YELLOW)Created backend/.env from example$(NC)"; \
		echo "$(RED)⚠️  Please update backend/.env with your AWS S3 bucket name!$(NC)"; \
	else \
		echo "$(YELLOW)backend/.env already exists$(NC)"; \
	fi
	@if [ ! -f frontend/.env ]; then \
		cp frontend/env.example frontend/.env; \
		echo "$(YELLOW)Created frontend/.env from example$(NC)"; \
	else \
		echo "$(YELLOW)frontend/.env already exists$(NC)"; \
	fi

setup: install setup-env ## Complete setup for new developers
	@echo ""
	@echo "$(GREEN)🎉 Setup complete!$(NC)"
	@echo ""
	@echo "$(YELLOW)Next steps:$(NC)"
	@echo "1. Create an S3 bucket in AWS"
	@echo "2. Configure AWS credentials (aws configure)"
	@echo "3. Update backend/.env with your S3 bucket name"
	@echo "4. Run 'make dev' to start development servers"
	@echo ""

dev: ## Start both backend and frontend in development mode
	@echo "$(BLUE)Starting development servers...$(NC)"
	@echo "$(YELLOW)Backend will run on: http://localhost:3001$(NC)"
	@echo "$(YELLOW)Frontend will run on: http://localhost:5173$(NC)"
	@echo ""
	@echo "$(GREEN)Press Ctrl+C to stop all servers$(NC)"
	@echo ""
	@trap 'kill 0' INT; \
	(cd backend && npm run dev) & \
	(cd frontend && npm run dev) & \
	wait

start-backend: ## Start only the backend server
	@echo "$(BLUE)Starting backend server...$(NC)"
	@cd backend && npm run dev

start-frontend: ## Start only the frontend server
	@echo "$(BLUE)Starting frontend server...$(NC)"
	@cd frontend && npm run dev

build: ## Build both applications for production
	@echo "$(BLUE)Building applications...$(NC)"
	@echo "$(YELLOW)Building backend...$(NC)"
	@cd backend && npm run build
	@echo "$(YELLOW)Building frontend...$(NC)"
	@cd frontend && npm run build
	@echo "$(GREEN)✓ Build complete!$(NC)"

test: ## Run tests (when implemented)
	@echo "$(YELLOW)Running tests...$(NC)"
	@cd backend && npm test || echo "No backend tests configured"
	@cd frontend && npm test || echo "No frontend tests configured"

clean: ## Clean node_modules and build artifacts
	@echo "$(BLUE)Cleaning project...$(NC)"
	@rm -rf backend/node_modules backend/dist
	@rm -rf frontend/node_modules frontend/dist
	@echo "$(GREEN)✓ Project cleaned!$(NC)"

install-backend: ## Install only backend dependencies
	@echo "$(BLUE)Installing backend dependencies...$(NC)"
	@cd backend && npm install

install-frontend: ## Install only frontend dependencies
	@echo "$(BLUE)Installing frontend dependencies...$(NC)"
	@cd frontend && npm install

check-env: ## Check if environment is properly configured
	@echo "$(BLUE)Checking environment configuration...$(NC)"
	@echo "$(YELLOW)Backend environment:$(NC)"
	@if [ -f backend/.env ]; then \
		echo "  ✓ backend/.env exists"; \
	else \
		echo "  ✗ backend/.env missing"; \
	fi
	@echo "$(YELLOW)Frontend environment:$(NC)"
	@if [ -f frontend/.env ]; then \
		echo "  ✓ frontend/.env exists"; \
	else \
		echo "  ✗ frontend/.env missing"; \
	fi
	@echo "$(YELLOW)Node.js version:$(NC)"
	@node --version
	@echo "$(YELLOW)npm version:$(NC)"
	@npm --version

logs: ## Show development server logs (run in another terminal)
	@echo "$(BLUE)Showing server logs...$(NC)"
	@echo "$(YELLOW)Backend logs:$(NC)"
	@tail -f backend/logs/*.log 2>/dev/null || echo "No backend logs found"
	@echo "$(YELLOW)Frontend logs:$(NC)"
	@tail -f frontend/logs/*.log 2>/dev/null || echo "No frontend logs found"

restart: ## Restart development servers
	@echo "$(BLUE)Restarting development servers...$(NC)"
	@pkill -f "npm run dev" || true
	@sleep 2
	@make dev

status: ## Show status of development servers
	@echo "$(BLUE)Development server status:$(NC)"
	@echo "$(YELLOW)Backend (port 3001):$(NC)"
	@curl -s http://localhost:3001/health > /dev/null && echo "  ✓ Backend running" || echo "  ✗ Backend not running"
	@echo "$(YELLOW)Frontend (port 5173):$(NC)"
	@curl -s http://localhost:5173 > /dev/null && echo "  ✓ Frontend running" || echo "  ✗ Frontend not running"

# Production commands
start-prod: build ## Start production servers
	@echo "$(BLUE)Starting production servers...$(NC)"
	@trap 'kill 0' INT; \
	(cd backend && npm start) & \
	(cd frontend && npx serve -s dist -p 5173) & \
	wait

# Docker commands (if needed in future)
docker-build: ## Build Docker images
	@echo "$(BLUE)Building Docker images...$(NC)"
	@docker build -t file-cabinet-backend ./backend
	@docker build -t file-cabinet-frontend ./frontend

docker-dev: ## Run with Docker Compose
	@echo "$(BLUE)Starting with Docker Compose...$(NC)"
	@docker-compose up --build

# Database/AWS commands
aws-check: ## Check AWS configuration
	@echo "$(BLUE)Checking AWS configuration...$(NC)"
	@aws sts get-caller-identity 2>/dev/null && echo "$(GREEN)✓ AWS credentials configured$(NC)" || echo "$(RED)✗ AWS credentials not configured$(NC)"
	@echo "$(YELLOW)Run 'aws configure' to set up AWS credentials$(NC)"

# Development utilities
format: ## Format code (if prettier/eslint configured)
	@echo "$(BLUE)Formatting code...$(NC)"
	@cd backend && npm run format 2>/dev/null || echo "No backend formatter configured"
	@cd frontend && npm run format 2>/dev/null || echo "No frontend formatter configured"

lint: ## Run linting
	@echo "$(BLUE)Running linters...$(NC)"
	@cd backend && npm run lint 2>/dev/null || echo "No backend linter configured"
	@cd frontend && npm run lint 2>/dev/null || echo "No frontend linter configured"

# Quick development cycle
quick-start: ## Quick start for returning developers
	@echo "$(BLUE)Quick start for returning developers...$(NC)"
	@make check-env
	@make status
	@if curl -s http://localhost:3001/health > /dev/null && curl -s http://localhost:5173 > /dev/null; then \
		echo "$(GREEN)✓ Servers already running!$(NC)"; \
	else \
		echo "$(YELLOW)Starting servers...$(NC)"; \
		make dev; \
	fi 
