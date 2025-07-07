/**
 * Simple logging utility for diagnosing ZIP creation issues
 */

// Determine if we're in production mode
const isProduction = import.meta.env.MODE === "production";

// Storage for logs
const logHistory: Array<{
  timestamp: string;
  level: string;
  message: string;
  details?: any;
}> = [];
const MAX_LOG_HISTORY = 100;

/**
 * Log an error message
 */
export const logError = (message: string, details?: any): void => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [ERROR] ${message}`, details || "");

  // Save to log history
  if (logHistory.length >= MAX_LOG_HISTORY) {
    logHistory.shift(); // Remove oldest log
  }
  logHistory.push({ timestamp, level: "ERROR", message, details });
};

/**
 * Log a warning message
 */
export const logWarning = (message: string, details?: any): void => {
  const timestamp = new Date().toISOString();
  console.warn(`[${timestamp}] [WARN] ${message}`, details || "");

  // Save to log history
  if (logHistory.length >= MAX_LOG_HISTORY) {
    logHistory.shift();
  }
  logHistory.push({ timestamp, level: "WARN", message, details });
};

/**
 * Log an info message
 */
export const logInfo = (message: string, details?: any): void => {
  const timestamp = new Date().toISOString();
  console.info(`[${timestamp}] [INFO] ${message}`, details || "");

  // Save to log history
  if (logHistory.length >= MAX_LOG_HISTORY) {
    logHistory.shift();
  }
  logHistory.push({ timestamp, level: "INFO", message, details });
};

/**
 * Log a debug message (only in development)
 */
export const logDebug = (message: string, details?: any): void => {
  if (isProduction) return;

  const timestamp = new Date().toISOString();
  console.debug(`[${timestamp}] [DEBUG] ${message}`, details || "");

  // Save to log history
  if (logHistory.length >= MAX_LOG_HISTORY) {
    logHistory.shift();
  }
  logHistory.push({ timestamp, level: "DEBUG", message, details });
};

/**
 * Get the current log history
 */
export const getLogHistory = (): Array<{
  timestamp: string;
  level: string;
  message: string;
  details?: any;
}> => {
  return [...logHistory];
};

/**
 * Export logs as JSON string for diagnosis
 */
export const exportLogs = (): string => {
  return JSON.stringify(logHistory, null, 2);
};

/**
 * Clear the log history
 */
export const clearLogs = (): void => {
  logHistory.length = 0;
};

/**
 * Log details about a specific download operation
 */
export const logDownloadAttempt = (
  key: string,
  fileSize: number,
  success: boolean,
  error?: any,
): void => {
  const details: Record<string, any> = {
    key,
    fileSize: `${(fileSize / (1024 * 1024)).toFixed(2)}MB`,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    success,
  };

  if (error) {
    if (error instanceof Error) {
      details.error = {
        message: error.message,
        name: error.name,
        stack: error.stack,
      };
    } else {
      details.error = error;
    }
  }

  if (success) {
    logInfo(`Download completed for ${key}`, details);
  } else {
    logError(`Download failed for ${key}`, details);
  }
};

/**
 * Log memory usage information
 */
export const logMemoryUsage = (): void => {
  try {
    if (performance && "memory" in performance && performance.memory) {
      const memoryInfo = performance.memory;
      logInfo("Memory usage", {
        usedJSHeapSizeMB: (memoryInfo.usedJSHeapSize / (1024 * 1024)).toFixed(
          2,
        ),
        totalJSHeapSizeMB: (memoryInfo.totalJSHeapSize / (1024 * 1024)).toFixed(
          2,
        ),
        jsHeapSizeLimitMB: (memoryInfo.jsHeapSizeLimit / (1024 * 1024)).toFixed(
          2,
        ),
        percentUsed:
          (
            (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) *
            100
          ).toFixed(2) + "%",
      });
    } else {
      logInfo("Memory information not available in this browser");
    }
  } catch (e) {
    logWarning("Failed to log memory usage", e);
  }
};

// Create a simple logger object for export
export const logger = {
  error: logError,
  warn: logWarning,
  info: logInfo,
  debug: logDebug,
  getHistory: getLogHistory,
  export: exportLogs,
  clear: clearLogs,
  logDownload: logDownloadAttempt,
  logMemory: logMemoryUsage,
};

export default logger;
