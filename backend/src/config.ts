export const config = {
  // AWS S3 Configuration
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    bucketName: process.env.S3_BUCKET_NAME || 'file-cabinet-uploads',
    keyPrefix: process.env.S3_KEY_PREFIX || 'uploads/',
  },
  
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT || '3001'),
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },

  // File Upload Configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '500') * 1024 * 1024, // 500MB default
    presignedUrlExpiry: parseInt(process.env.PRESIGNED_URL_EXPIRY || '3600'), // 1 hour default
    allowedFileTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'video/webm',
      'video/avi',
    ],
  },
}; 