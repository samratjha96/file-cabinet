/**
 * Enhanced logging utility for backend services
 */

// Log levels
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

// Default log level - configurable via environment variable
let currentLogLevel: LogLevelType =
  process.env.LOG_LEVEL === "debug"
    ? LogLevel.DEBUG
    : process.env.NODE_ENV === "production"
      ? LogLevel.INFO
      : LogLevel.DEBUG;

/**
 * Set the current log level
 */
export const setLogLevel = (level: LogLevelType): void => {
  currentLogLevel = level;
};

/**
 * Log a message with the specified level
 */
const log = (level: LogLevelType, message: string, details?: any): void => {
  // Skip if log level is too high
  if (level > currentLogLevel) return;

  const timestamp = new Date().toISOString();
  const levelStr = LogLevelStrings[level];

  // Format details for console
  const detailsStr = details
    ? ` - ${JSON.stringify(details, null, process.env.NODE_ENV === "production" ? 0 : 2)}`
    : "";

  // Construct log message with standardized format
  const logMessage = `[${timestamp}] [${levelStr}] ${message}${detailsStr}`;

  // Output to console depending on level
  switch (level) {
    case LogLevel.ERROR:
      console.error(logMessage);
      break;
    case LogLevel.WARN:
      console.warn(logMessage);
      break;
    case LogLevel.INFO:
      console.info(logMessage);
      break;
    case LogLevel.DEBUG:
      console.debug(logMessage);
      break;
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
 * Log a debug message
 */
export const logDebug = (message: string, details?: any): void => {
  log(LogLevel.DEBUG, message, details);
};

/**
 * Log API request details
 */
export const logApiRequest = (
  method: string,
  path: string,
  params?: any,
  body?: any,
): void => {
  const details: Record<string, any> = { method, path };

  if (params && Object.keys(params).length > 0) {
    details.params = params;
  }

  if (body && Object.keys(body).length > 0) {
    // Avoid logging sensitive info in request bodies
    if (body.password) body.password = "**REDACTED**";
    details.body = body;
  }

  logInfo(`API Request: ${method} ${path}`, details);
};

/**
 * Log API response details
 */
export const logApiResponse = (
  method: string,
  path: string,
  statusCode: number,
  responseTime: number,
  responseSize?: number,
): void => {
  logInfo(`API Response: ${method} ${path}`, {
    statusCode,
    responseTimeMs: responseTime,
    responseSize: responseSize
      ? `${Math.round(responseSize / 1024)}KB`
      : undefined,
  });
};

/**
 * Log S3 operations
 */
export const logS3Operation = (
  operation: string,
  bucket: string,
  key?: string,
  details?: any,
): void => {
  logDebug(`S3 ${operation}`, {
    bucket,
    key,
    ...details,
  });
};

// Create a simple logger object for export
export const logger = {
  error: logError,
  warn: logWarning,
  info: logInfo,
  debug: logDebug,
  api: {
    request: logApiRequest,
    response: logApiResponse,
  },
  s3: logS3Operation,
  setLevel: setLogLevel,
};

export default logger;
