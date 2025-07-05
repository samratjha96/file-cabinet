# File Cabinet

A modern React/Vite file upload application with S3 storage.

## Quick Start

### Development
```bash
make dev
```
This will install dependencies and start both backend (port 3001) and frontend (port 5173) servers.

### Production (Docker)
```bash
# Copy and update environment file
cp docker-compose.env.example .env
# Edit .env with your AWS credentials

# Start production containers
make prod
```
Application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## Requirements

- Node.js 20+
- Docker (for production)
- AWS S3 bucket and credentials

## Environment Setup

Update `.env` file with your AWS credentials:
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=your-bucket-name
```

## Commands

- `make dev` - Development mode
- `make prod` - Production Docker deployment
- `make clean` - Clean build artifacts
- `make help` - Show all commands

## Tech Stack

- **Frontend**: React 19, Vite 7, TypeScript
- **Backend**: Node.js, Express, AWS SDK
- **Storage**: AWS S3
- **Deployment**: Docker, Nginx 