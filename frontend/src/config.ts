export const config = {
  // API Configuration
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",
  },

  // File Upload Configuration
  upload: {
    maxFileSize:
      parseInt(import.meta.env.VITE_MAX_FILE_SIZE || "5000") * 1024 * 1024, // 5GB default (increased from 500MB)
    chunkSize: parseInt(import.meta.env.VITE_CHUNK_SIZE || "10") * 1024 * 1024, // 10MB default for multipart (increased for large files)
    maxConcurrentUploads: parseInt(
      import.meta.env.VITE_MAX_CONCURRENT_UPLOADS || "3",
    ), // Reduced concurrent uploads for large files
    supportedFileTypes: ["*"], // Allow all file types
  },
};
