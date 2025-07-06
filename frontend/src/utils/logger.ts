/**
 * Enhanced logging utility for diagnosing issues
 */

// Log levels as simple constants instead of enum
export const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
} as const;

// Map log level values to strings
const LogLevelStrings = {
  [LogLevel.ERROR]: "ERROR",
  [LogLevel.WARN]: "WARN",
  [LogLevel.INFO]: "INFO",
  [LogLevel.DEBUG]: "DEBUG",
};

// Type for log level values
export type LogLevelType = (typeof LogLevel)[keyof typeof LogLevel];

// Default log level
let currentLogLevel: LogLevelType = LogLevel.INFO;

// Optional transport function for sending logs to backend
type TransportFunction = (
  level: LogLevelType,
  message: string,
  details?: any,
) => void;
let logTransport: TransportFunction | null = null;

// Storage for logs
const logHistory: Array<{
  timestamp: string;
  level: string;
  message: string;
  details?: any;
}> = [];
const MAX_LOG_HISTORY = 100;

// Determine if we're in production mode
const isProduction = import.meta.env.MODE === "production";

/**
 * Set the current log level
 */
export const setLogLevel = (level: LogLevelType): void => {
  currentLogLevel = level;
};

/**
 * Set a transport function to send logs to another destination (like a backend server)
 */
export const setTransport = (transport: TransportFunction): void => {
  logTransport = transport;
};

/**
 * Log a message with the specified level
 */
const log = (level: LogLevelType, message: string, details?: any): void => {
  // Skip if log level is too high
  if (level > currentLogLevel) return;

  const timestamp = new Date().toISOString();
  const levelStr = LogLevelStrings[level];

  // Save to log history
  if (logHistory.length >= MAX_LOG_HISTORY) {
    logHistory.shift(); // Remove oldest log
  }
  logHistory.push({ timestamp, level: levelStr, message, details });

  // Format details for console
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";

  // Output to console depending on level
  switch (level) {
    case LogLevel.ERROR:
      console.error(`[${timestamp}] [ERROR] ${message}${detailsStr}`);
      break;
    case LogLevel.WARN:
      console.warn(`[${timestamp}] [WARN] ${message}${detailsStr}`);
      break;
    case LogLevel.INFO:
      console.info(`[${timestamp}] [INFO] ${message}${detailsStr}`);
      break;
    case LogLevel.DEBUG:
      if (!isProduction) {
        console.debug(`[${timestamp}] [DEBUG] ${message}${detailsStr}`);
      }
      break;
  }

  // If we have a transport function, call it
  if (logTransport) {
    try {
      logTransport(level, message, details);
    } catch (e) {
      // Don't let transport errors affect application
      console.error("Logger transport error:", e);
    }
  }
};

/**
 * Log an error message
 */
export const logError = (message: string, details?: any): void => {
  log(LogLevel.ERROR, message, details);
};

/**
 * Log a warning message
 */
export const logWarning = (message: string, details?: any): void => {
  log(LogLevel.WARN, message, details);
};

/**
 * Log an info message
 */
export const logInfo = (message: string, details?: any): void => {
  log(LogLevel.INFO, message, details);
};

/**
 * Log a debug message (only in development)
 */
export const logDebug = (message: string, details?: any): void => {
  log(LogLevel.DEBUG, message, details);
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
  setLevel: setLogLevel,
  setTransport: setTransport,
};

export default logger;
