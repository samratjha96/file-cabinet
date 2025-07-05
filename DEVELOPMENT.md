# Development Guide

This guide explains how to set up and develop the File Cabinet application using the provided Makefile.

## New Developer Setup

### Prerequisites
- Node.js 18+ installed
- `make` command available (comes with most Unix systems)
- AWS CLI configured (for S3 access)

### One-Command Setup

```bash
# Clone the repository
git clone <repository-url>
cd file-cabinet

# Complete setup (installs dependencies and creates .env files)
make setup

# Start development servers
make dev
```

The `make setup` command will:
1. Install all backend dependencies
2. Install all frontend dependencies  
3. Create `.env` files from examples
4. Show you the next steps

The `make dev` command will:
1. Start the backend server on http://localhost:3001
2. Start the frontend server on http://localhost:5173
3. Show logs from both servers
4. Stop both servers when you press Ctrl+C

## Development Workflow

### Daily Development

```bash
# Start both servers
make dev

# Or start them individually
make start-backend    # Backend only
make start-frontend   # Frontend only
```

### Useful Commands

```bash
# Show all available commands
make help

# Check if everything is configured correctly
make check-env

# Check if servers are running
make status

# Restart both servers
make restart

# Build for production
make build

# Clean everything and start fresh
make clean
```

### Environment Configuration

After running `make setup`, you need to:

1. **Create an S3 bucket** in your AWS account
2. **Configure AWS credentials**: Run `aws configure` or set environment variables
3. **Update backend/.env**: Change `S3_BUCKET_NAME` to your actual bucket name
4. **Verify AWS setup**: Run `make aws-check`

### Environment Files

The setup creates two environment files:

#### `backend/.env`
```bash
# AWS Configuration
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name-here  # ← Change this!
S3_KEY_PREFIX=uploads/

# Server Configuration
PORT=3001
CORS_ORIGIN=http://localhost:5173

# File Upload Configuration
MAX_FILE_SIZE=500
PRESIGNED_URL_EXPIRY=3600
```

#### `frontend/.env`
```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3001

# File Upload Configuration
VITE_MAX_FILE_SIZE=500
VITE_CHUNK_SIZE=5
VITE_MAX_CONCURRENT_UPLOADS=5
```

## Common Development Tasks

### Adding New Features

1. **Start development servers**: `make dev`
2. **Make your changes** in the code
3. **Test locally** - both servers auto-reload on changes
4. **Build to check for errors**: `make build`

### Debugging

```bash
# Check server status
make status

# Check environment configuration
make check-env

# Check AWS configuration
make aws-check

# View server logs (if logging is implemented)
make logs
```

### Before Committing

```bash
# Build to check for errors
make build

# Run tests (when implemented)
make test

# Format code (if configured)
make format

# Run linting (if configured)
make lint
```

## Troubleshooting

### Common Issues

1. **Servers won't start**
   - Check if ports 3001 and 5173 are available
   - Run `make status` to see what's running
   - Run `make clean` and `make install` to reset

2. **AWS errors**
   - Run `make aws-check` to verify credentials
   - Ensure your S3 bucket name in `backend/.env` is correct
   - Verify bucket permissions

3. **Frontend can't connect to backend**
   - Check if backend is running: `make status`
   - Verify CORS settings in `backend/.env`
   - Check network/firewall settings

### Clean Slate

If you run into issues, you can start fresh:

```bash
# Clean everything
make clean

# Reinstall dependencies
make install

# Recreate environment files
rm backend/.env frontend/.env
make setup-env

# Start development
make dev
```

## Production Deployment

### Build for Production

```bash
# Build both applications
make build

# Start production servers
make start-prod
```

### Production Environment

Set these environment variables in your production environment:

**Backend:**
- `AWS_REGION`
- `S3_BUCKET_NAME`
- `S3_KEY_PREFIX`
- `PORT`
- `CORS_ORIGIN`

**Frontend:**
- `VITE_API_BASE_URL`

## Advanced Usage

### Individual Components

```bash
# Backend only
make install-backend
make start-backend

# Frontend only  
make install-frontend
make start-frontend
```

### Production Testing

```bash
# Build and test production locally
make build
make start-prod
```

### Docker (Future)

```bash
# Build Docker images
make docker-build

# Run with Docker Compose
make docker-dev
```

## Tips for New Developers

1. **Always run `make help`** first to see available commands
2. **Use `make check-env`** to verify your setup
3. **Use `make status`** to check if servers are running
4. **The Makefile handles most common tasks** - don't manually run npm commands
5. **Keep your `.env` files secure** - they contain sensitive configuration

## Getting Help

If you're stuck:

1. Run `make help` to see all commands
2. Run `make check-env` to verify configuration
3. Check the main [README.md](README.md) for detailed documentation
4. Review the [PRD.md](PRD.md) for project requirements

---

**Happy coding! 🚀** 