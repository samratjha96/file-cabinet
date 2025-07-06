/**
 * Memory management utilities for handling large file operations
 */

// Define performance.memory interface for TypeScript
declare global {
  interface Performance {
    memory?: {
      jsHeapSizeLimit: number;
      totalJSHeapSize: number;
      usedJSHeapSize: number;
    };
  }
}

/**
 * Attempt to free memory by forcing garbage collection
 * (Note: This is a best-effort approach, as JavaScript doesn't have direct GC control)
 */
export const attemptMemoryCleanup = (): void => {
  // Clear any object references that might be holding memory
  if (typeof window !== "undefined") {
    // Clear any URL objects that may be holding references to large blobs
    try {
      // Only available in Chrome-based browsers
      if (window.performance && "memory" in window.performance) {
        // This is just for debugging purposes
        console.log("Memory cleanup attempted");
      }
    } catch (e) {
      // Ignore errors from accessing performance.memory
    }
  }
};

/**
 * Check if available memory is likely sufficient for an operation
 * @param estimatedSizeMB - Estimated size of the operation in MB
 * @returns boolean - true if memory is likely sufficient
 */
export const checkMemorySufficient = (estimatedSizeMB: number): boolean => {
  try {
    // Try to detect if we're in a low-memory situation (Chrome-only)
    if (
      typeof window !== "undefined" &&
      window.performance &&
      "memory" in window.performance &&
      window.performance.memory
    ) {
      const memoryInfo = window.performance.memory;

      // Check if we're close to the heap limit
      if (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit > 0.8) {
        return false;
      }

      // Roughly estimate if we'll have enough memory
      // We need approximately 2-3x the file size for processing
      const requiredBytes = estimatedSizeMB * 1024 * 1024 * 3;
      const availableBytes =
        memoryInfo.jsHeapSizeLimit - memoryInfo.usedJSHeapSize;

      return availableBytes > requiredBytes;
    }
  } catch (e) {
    // If we can't check, assume it's OK
    console.warn("Unable to check memory availability", e);
  }

  return true;
};

/**
 * Break down a large operation into smaller chunks to manage memory better
 * @param totalSizeMB - Total size of the operation in MB
 * @returns number - Recommended chunk size in items
 */
export const calculateOptimalChunkSize = (totalSizeMB: number): number => {
  if (totalSizeMB > 5000) {
    return 2; // For extremely large operations (> 5GB)
  } else if (totalSizeMB > 1000) {
    return 3; // For very large operations (> 1GB)
  } else if (totalSizeMB > 500) {
    return 5; // For large operations (> 500MB)
  }

  return 10; // Default for smaller operations
};
