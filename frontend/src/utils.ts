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
 * @param file File to validate
 * @param maxSize Maximum file size in bytes (optional)
 * @param verbose Whether to log validation failures (optional)
 * @returns boolean indicating if the file is valid
 */
export const isValidFile = (
  file: File,
  maxSize?: number,
  verbose: boolean = false,
): boolean => {
  // Check if file has a valid name
  if (!file.name || file.name.trim() === "") {
    if (verbose) console.warn(`Skipping file with empty name`);
    return false;
  }

  // Skip system files and hidden files
  if (
    file.name.startsWith(".DS_Store") ||
    file.name.startsWith("Thumbs.db") ||
    file.name.startsWith(".")
  ) {
    if (verbose) console.warn(`Skipping system/hidden file: ${file.name}`);
    return false;
  }

  // Check if file has valid size (skip empty files)
  if (file.size === 0) {
    if (verbose) console.warn(`Skipping empty file: ${file.name}`);
    return false;
  }

  // Check file size limit if provided
  if (maxSize !== undefined && file.size > maxSize) {
    if (verbose)
      console.warn(
        `File ${file.name} is too large: ${file.size} bytes (max: ${maxSize} bytes)`,
      );
    return false;
  }

  return true;
};
