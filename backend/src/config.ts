export const config = {
  // AWS S3 Configuration
  aws: {
    region: process.env.AWS_REGION || "us-east-1",
    bucketName: process.env.S3_BUCKET_NAME || "file-cabinet-uploads",
    keyPrefix: process.env.S3_KEY_PREFIX || "uploads/",
  },

  // Server Configuration
  server: {
    port: parseInt(process.env.BACKEND_PORT || "3001"),
    corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
    // Support multiple origins for production
    corsOrigins: process.env.CORS_ORIGINS?.split(",") || [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://file-cabinet.techbrohomelab.xyz",
    ],
  },

  // File Upload Configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "50000") * 1024 * 1024, // 50GB default
    presignedUrlExpiry: parseInt(process.env.PRESIGNED_URL_EXPIRY || "14400"), // 4 hours default
  },
};
