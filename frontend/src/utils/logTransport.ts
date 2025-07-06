/**
 * Transport utility to send frontend logs to backend for aggregation
 */
import { LogLevel, logger } from "./logger";
import type { LogLevelType } from "./logger";
import { apiService } from "../api";

// Only send logs at or above this level to the server
const SERVER_LOG_LEVEL = LogLevel.ERROR;

// Maximum number of logs to keep in the buffer before sending
const MAX_BUFFER_SIZE = 10;

// Buffer of logs to send to the server
let logBuffer: Array<{
  timestamp: string;
  level: number;
  message: string;
  details?: any;
}> = [];

// Whether there's a send in progress
let isSendingLogs = false;

/**
 * Transport function that captures logs and potentially sends them to backend
 */
export const transportLog = (
  level: LogLevelType,
  message: string,
  details?: any,
): void => {
  // Only transport logs at or above the server log level
  if (level > SERVER_LOG_LEVEL) return;

  const timestamp = new Date().toISOString();

  // Add to buffer
  logBuffer.push({
    timestamp,
    level,
    message,
    details,
  });

  // If we've reached the buffer size or this is an error, send logs immediately
  if (logBuffer.length >= MAX_BUFFER_SIZE || level === LogLevel.ERROR) {
    sendLogsToServer();
  }
};

/**
 * Sends collected logs to the server
 */
const sendLogsToServer = async (): Promise<void> => {
  // Don't send if already in progress or buffer is empty
  if (isSendingLogs || logBuffer.length === 0) return;

  try {
    isSendingLogs = true;

    // Clone the buffer and clear it
    const logsToSend = [...logBuffer];
    logBuffer = [];

    // Send logs to server using an endpoint we'll create later
    try {
      await apiService.sendLogs(logsToSend);
    } catch (error) {
      // In case of error, restore logs to buffer (but avoid infinite loops)
      if (
        logsToSend.every(
          (log) => log.message !== "Failed to send logs to server",
        )
      ) {
        logBuffer = [...logsToSend.slice(-5), ...logBuffer]; // Keep only most recent 5 to avoid buffer getting too large
        logger.warn("Failed to send logs to server", { error });
      }
    }
  } finally {
    isSendingLogs = false;
  }
};

/**
 * Flush logs on page unload
 */
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (logBuffer.length > 0) {
      // Use synchronous approach since we're unloading
      try {
        const logsToSend = [...logBuffer];

        // Use sendBeacon if available for more reliable delivery during page unload
        if (navigator.sendBeacon) {
          const endpoint = `${apiService.getBaseUrl()}/api/client-logs`;
          navigator.sendBeacon(endpoint, JSON.stringify({ logs: logsToSend }));
        }
      } catch (e) {
        // Can't do much during unload
      }
    }
  });
}

/**
 * Initialize log transport system
 */
export const initLogTransport = (): void => {
  // Send accumulated logs periodically (every 30 seconds)
  if (typeof window !== "undefined") {
    setInterval(() => {
      if (logBuffer.length > 0) {
        sendLogsToServer();
      }
    }, 30000);
  }
};
