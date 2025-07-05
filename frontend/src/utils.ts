/**
 * Format file size in bytes to human readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

/**
 * Generate a unique timestamp-based ID
 */
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Check if a file is valid for upload
 */
export const isValidFile = (file: File): boolean => {
  // Check if file has a valid name
  if (!file.name || file.name.trim() === "") {
    return false;
  }

  // Skip system files and hidden files
  if (
    file.name.startsWith(".DS_Store") ||
    file.name.startsWith("Thumbs.db") ||
    file.name.startsWith(".")
  ) {
    return false;
  }

  // Check if file has valid size (skip empty files)
  if (file.size === 0) {
    return false;
  }

  return true;
};
