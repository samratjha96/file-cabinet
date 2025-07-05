# File Cabinet - Simplified Makefile
# Run `make help` to see all available commands

.PHONY: help dev prod clean

# Default target
.DEFAULT_GOAL := help

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)File Cabinet - Simple Commands$(NC)"
	@echo ""
	@echo "$(YELLOW)Main Commands:$(NC)"
	@echo "  $(GREEN)make dev$(NC)      - Development mode (install deps + start servers)"
	@echo "  $(GREEN)make prod$(NC)     - Production mode (Docker Compose)"
	@echo "  $(GREEN)make clean$(NC)    - Clean node_modules and build artifacts"
	@echo ""
	@echo "$(YELLOW)Development:$(NC)"
	@echo "  Backend:  http://localhost:3001"
	@echo "  Frontend: http://localhost:5173"
	@echo ""
	@echo "$(YELLOW)Production:$(NC)"
	@echo "  Backend:  http://localhost:3001"
	@echo "  Frontend: http://localhost:3000"

dev: ## Development mode - install dependencies and start servers
	@echo "$(BLUE)Starting development mode...$(NC)"
	@echo "$(YELLOW)Installing backend dependencies...$(NC)"
	@cd backend && npm install
	@echo "$(YELLOW)Installing frontend dependencies...$(NC)"
	@cd frontend && npm install
	@echo "$(YELLOW)Setting up environment files...$(NC)"
	@if [ ! -f backend/.env ]; then \
		cp backend/env.example backend/.env; \
		echo "$(YELLOW)Created backend/.env from example$(NC)"; \
		echo "$(RED)⚠️  Please update backend/.env with your AWS S3 bucket name!$(NC)"; \
	fi
	@if [ ! -f frontend/.env ]; then \
		cp frontend/env.example frontend/.env; \
		echo "$(YELLOW)Created frontend/.env from example$(NC)"; \
	fi
	@echo ""
	@echo "$(GREEN)Starting development servers...$(NC)"
	@echo "$(YELLOW)Backend: http://localhost:3001$(NC)"
	@echo "$(YELLOW)Frontend: http://localhost:5173$(NC)"
	@echo ""
	@echo "$(GREEN)Press Ctrl+C to stop all servers$(NC)"
	@echo ""
	@trap 'kill 0' INT; \
	(cd backend && npm run dev) & \
	(cd frontend && npm run dev) & \
	wait

prod: ## Production mode - Docker Compose up and build
	@echo "$(BLUE)Starting production mode...$(NC)"
	@if [ ! -f .env ]; then \
		cp docker-compose.env.example .env; \
		echo "$(YELLOW)Created .env from example. Please update it before deploying.$(NC)"; \
		exit 1; \
	fi
	@echo "$(YELLOW)Validating environment...$(NC)"
	@if grep -q "your-bucket-name" .env; then \
		echo "$(RED)✗ Please update S3_BUCKET_NAME in .env file$(NC)"; \
		exit 1; \
	fi
	@echo "$(YELLOW)Building and starting production containers...$(NC)"
	@docker-compose up --build -d
	@echo "$(GREEN)✓ Production deployment complete!$(NC)"
	@echo ""
	@echo "$(YELLOW)Application URLs:$(NC)"
	@echo "  Frontend: http://localhost:3000"
	@echo "  Backend API: http://localhost:3001"
	@echo ""
	@echo "$(YELLOW)Useful commands:$(NC)"
	@echo "  docker-compose logs -f     - View logs"
	@echo "  docker-compose stop        - Stop containers"
	@echo "  docker-compose down        - Stop and remove containers"
	@echo ""
	@echo "$(YELLOW)AWS credentials are discovered automatically from:$(NC)"
	@echo "  - Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)"
	@echo "  - AWS credentials file (~/.aws/credentials)"
	@echo "  - IAM roles (if running on AWS infrastructure)"

clean: ## Clean node_modules and build artifacts
	@echo "$(BLUE)Cleaning project...$(NC)"
	@rm -rf backend/node_modules backend/dist
	@rm -rf frontend/node_modules frontend/dist
	@echo "$(GREEN)✓ Project cleaned!$(NC)" 
