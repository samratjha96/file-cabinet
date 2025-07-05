# File Cabinet - Scalable File Uploader

A modern, scalable web application for uploading and managing large files using AWS S3. Built with React (TypeScript) frontend and Node.js/Express backend.

## Features

- 🚀 **Scalable Architecture**: Direct upload to AWS S3 using presigned URLs
- 📁 **Bulk Upload**: Upload hundreds or thousands of files at once
- 📊 **Real-time Progress**: Track upload progress with visual indicators
- 🎨 **Modern UI**: Clean, responsive design with drag-and-drop functionality
- 💾 **Large File Support**: Handles files up to 500MB (configurable)
- 🔄 **File Management**: List, view, and download uploaded files
- 🔒 **Secure**: Uses presigned URLs for secure file operations

## Architecture

```
Browser → Backend Server → AWS S3
   ↓         ↓               ↓
Upload UI → Presigned URLs → Direct Upload
```

Files are uploaded directly from the browser to S3, bypassing the backend server for maximum scalability.

## Prerequisites

- Node.js 18+ (Note: The project currently uses Node.js 18.20.2)
- AWS Account with S3 access
- AWS CLI configured or AWS credentials available

## Quick Start

### 🚀 One-Command Setup (Recommended)

For new developers, use the Makefile for instant setup:

```bash
git clone <repository-url>
cd file-cabinet

# Complete setup and start development
make setup
make dev
```

That's it! The application will be available at `http://localhost:5173`

### 📋 Manual Setup (Alternative)

If you prefer manual setup or don't have `make` available:

#### 1. Install Dependencies
```bash
# Install backend dependencies
cd backend && npm install

# Install frontend dependencies  
cd ../frontend && npm install
```

#### 2. AWS Setup
1. Create an S3 bucket in your AWS account
2. Configure AWS credentials using one of these methods:
   - AWS CLI: `aws configure`
   - Environment variables: `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
   - IAM roles (if running on EC2)
   - AWS config files

#### 3. Configuration
Copy and edit environment files:

```bash
# Backend configuration
cd backend
cp env.example .env
# Edit .env with your S3 bucket name

# Frontend configuration (optional)
cd ../frontend  
cp env.example .env
```

#### 4. Run the Application
```bash
# Start backend (in one terminal)
cd backend && npm run dev

# Start frontend (in another terminal)
cd frontend && npm run dev
```

## 🛠️ Development Commands

The Makefile provides many helpful commands:

```bash
make help          # Show all available commands
make setup         # Complete setup for new developers
make dev           # Start both servers
make build         # Build for production
make clean         # Clean node_modules and build files
make status        # Check server status
make restart       # Restart development servers
make aws-check     # Check AWS configuration
```

Run `make help` to see all available commands with descriptions.

> 📖 **For detailed development instructions, see [DEVELOPMENT.md](DEVELOPMENT.md)**

## Configuration Options

### Backend Configuration (`backend/src/config.ts`)

| Variable | Default | Description |
|----------|---------|-------------|
| `AWS_REGION` | `us-east-1` | AWS region for S3 bucket |
| `S3_BUCKET_NAME` | `file-cabinet-uploads` | S3 bucket name |
| `S3_KEY_PREFIX` | `uploads/` | Prefix for uploaded files |
| `PORT` | `3001` | Backend server port |
| `CORS_ORIGIN` | `http://localhost:5173` | Frontend URL for CORS |
| `MAX_FILE_SIZE` | `500` | Maximum file size in MB |
| `PRESIGNED_URL_EXPIRY` | `3600` | Presigned URL expiry in seconds |
| `ALLOWED_FILE_TYPES` | Images/Videos | Comma-separated MIME types |

### Frontend Configuration (`frontend/src/config.ts`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:3001` | Backend API URL |
| `VITE_MAX_FILE_SIZE` | `500` | Maximum file size in MB |
| `VITE_CHUNK_SIZE` | `5` | Chunk size for multipart uploads |
| `VITE_MAX_CONCURRENT_UPLOADS` | `5` | Max concurrent uploads |

## Usage

1. **Upload Files**: 
   - Drag and drop files onto the upload area
   - Or click to select files using the file browser
   - Support for multiple file selection

2. **Track Progress**: 
   - Real-time progress bars for each upload
   - Status indicators (pending, uploading, completed, error)
   - File size and upload speed information

3. **Manage Files**:
   - View list of uploaded files
   - Download files with one click
   - Refresh file list to see new uploads

## Supported File Types

- **Images**: JPEG, PNG, GIF, WebP
- **Videos**: MP4, QuickTime (MOV), WebM, AVI

## API Endpoints

### Backend API

- `GET /health` - Health check
- `POST /api/upload-url` - Generate presigned upload URL
- `GET /api/files` - List uploaded files
- `POST /api/download-url` - Generate presigned download URL

## Project Structure

```
file-cabinet/
├── backend/              # Node.js Express server
│   ├── src/
│   │   ├── config.ts    # Configuration settings
│   │   ├── s3Service.ts # AWS S3 integration
│   │   └── index.ts     # Main server file
│   ├── env.example      # Environment template
│   └── package.json
├── frontend/            # React TypeScript app
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── api.ts      # API service
│   │   ├── config.ts   # Frontend configuration
│   │   └── App.tsx     # Main app component
│   ├── env.example     # Environment template
│   └── package.json
├── Makefile            # Development automation
├── README.md           # This file
├── DEVELOPMENT.md      # Detailed development guide
└── PRD.md             # Product requirements
```

## Development

### Using the Makefile (Recommended)

```bash
make help     # Show all commands
make setup    # Complete setup for new developers
make dev      # Start both servers
make build    # Build for production
make clean    # Clean and reset
```

### Manual Development

```bash
# Backend
cd backend
npm run dev    # Start with hot reload
npm run build  # Build for production
npm start      # Start production server

# Frontend
cd frontend
npm run dev    # Start development server
npm run build  # Build for production
npm run preview # Preview production build
```

## Production Deployment

### Backend
1. Set environment variables in your production environment
2. Build the application: `npm run build`
3. Start the server: `npm start`

### Frontend
1. Set environment variables (prefix with `VITE_`)
2. Build the application: `npm run build`
3. Serve the `dist` folder using a web server

## Architecture Details

### Direct S3 Upload Flow

1. **Client** requests presigned upload URL from backend
2. **Backend** generates presigned URL using AWS SDK
3. **Client** uploads file directly to S3 using presigned URL
4. **S3** stores the file and returns success response
5. **Client** updates UI and refreshes file list

### Benefits

- **Scalability**: Backend doesn't handle file data
- **Performance**: Direct upload to S3 is faster
- **Cost**: Reduced bandwidth and server resources
- **Reliability**: AWS S3 handles large file uploads

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure `CORS_ORIGIN` matches your frontend URL
2. **AWS Permissions**: Verify S3 bucket permissions and AWS credentials
3. **File Size Limits**: Check both frontend and backend size limits
4. **Network Issues**: Large files may timeout on slow connections

### Debug Mode

Set `NODE_ENV=development` to see detailed error messages in the backend logs.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Security Notes

- Presigned URLs are temporary and expire after 1 hour by default
- Files are stored in a private S3 bucket
- No sensitive data is stored in the frontend
- AWS credentials are never exposed to the client

## Future Enhancements

- User authentication and file ownership
- File organization with folders
- Image/video thumbnails
- File sharing capabilities
- Multipart upload for very large files
- File deduplication
- Automated file cleanup 