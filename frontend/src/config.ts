export const config = {
  // API Configuration
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL || "",
  },

  // File Upload Configuration
  upload: {
    maxFileSize:
      parseInt(import.meta.env.VITE_MAX_FILE_SIZE || "50000") * 1024 * 1024, // 50GB default
    supportedFileTypes: ["*"], // Allow all file types
  },

  // Download Configuration
  download: {
    chunkSize: 25 * 1024 * 1024, // 25MB chunks for streaming large files
    streamingThreshold: 100 * 1024 * 1024, // Use streaming for files > 100MB
    largeZipThreshold: 1000 * 1024 * 1024, // 1GB threshold for large ZIP handling
  },

  // Concurrent operations
  maxConcurrentUploads: parseInt(
    import.meta.env.VITE_MAX_CONCURRENT_UPLOADS || "5",
  ),
  maxConcurrentDownloads: 5,
};
