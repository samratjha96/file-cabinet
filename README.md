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

### AWS Credentials
Set up AWS credentials using any of these methods:

**Option 1: Environment Variables**
```bash
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_SESSION_TOKEN=your-session-token  # if using temporary credentials
```

**Option 2: AWS CLI**
```bash
aws configure
```

**Option 3: AWS Credentials File**
Create `~/.aws/credentials`:
```ini
[default]
aws_access_key_id = your-access-key
aws_secret_access_key = your-secret-key
```

### Configuration
Update `.env` file with your S3 bucket:
```env
AWS_REGION=us-east-1
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

## Architecture

This is a simple, clean file upload application with the following key features:

### Frontend Architecture
- **Custom Hooks**: Upload logic (`useUpload`) and file management (`useFiles`) extracted into reusable hooks
- **Component-Based**: Small, focused components for specific functionality
- **Shared Utils**: Common functions like `formatFileSize` and file validation utilities
- **Simple Upload**: Direct file upload to S3 using presigned URLs (no complex multipart handling)

### Backend Architecture
- **Minimal API**: Only 3 endpoints - upload URL generation, file listing, and download URL generation
- **Presigned URLs**: Secure file upload/download without exposing AWS credentials
- **Clean Configuration**: Simplified config with only essential settings

### Key Design Principles
- **Keep It Simple**: Removed complex multipart upload logic in favor of simple, reliable uploads
- **Separation of Concerns**: UI logic separated from business logic via custom hooks
- **Minimal Dependencies**: Only essential packages, no over-engineering
- **Clean Code**: Components under 200 lines, hooks focused on single responsibilities 