export const config = {
  // API Configuration
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL || "http://localhost:3001",
  },

  // File Upload Configuration
  upload: {
    maxFileSize:
      parseInt(import.meta.env.VITE_MAX_FILE_SIZE || "5000") * 1024 * 1024, // 5GB default
    supportedFileTypes: ["*"], // Allow all file types
  },
};
