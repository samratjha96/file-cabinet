export const config = {
  // API Configuration
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
  },

  // File Upload Configuration
  upload: {
    maxFileSize: parseInt(import.meta.env.VITE_MAX_FILE_SIZE || '500') * 1024 * 1024, // 500MB default
    chunkSize: parseInt(import.meta.env.VITE_CHUNK_SIZE || '5') * 1024 * 1024, // 5MB default for multipart
    maxConcurrentUploads: parseInt(import.meta.env.VITE_MAX_CONCURRENT_UPLOADS || '5'),
    supportedFileTypes: [
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