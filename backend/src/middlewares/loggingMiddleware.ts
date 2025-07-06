import { Request, Response, NextFunction } from "express";
import logger from "../logger";

/**
 * Middleware to log incoming requests and outgoing responses
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Create a unique ID for the request
  const requestId =
    Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  req.headers["x-request-id"] = requestId;

  // Log the request
  logger.api.request(
    req.method,
    req.path,
    req.query,
    req.method !== "GET" ? req.body : undefined,
  );

  // Store start time to calculate response time
  const startTime = Date.now();

  // Track response size
  let responseSize = 0;
  const originalWrite = res.write;
  const originalEnd = res.end;

  res.write = function (chunk: any): boolean {
    if (chunk) {
      responseSize += chunk.length;
    }
    return originalWrite.apply(res, arguments as any);
  };

  res.end = function (chunk: any): Response {
    if (chunk) {
      responseSize +=
        chunk instanceof Buffer ? chunk.length : String(chunk).length;
    }
    return originalEnd.apply(res, arguments as any);
  };

  // Log response when finished
  res.on("finish", () => {
    const responseTime = Date.now() - startTime;

    logger.api.response(
      req.method,
      req.path,
      res.statusCode,
      responseTime,
      responseSize,
    );

    // Log slow requests
    if (responseTime > 1000) {
      // Over 1 second
      logger.warn("Slow request detected", {
        method: req.method,
        path: req.path,
        responseTimeMs: responseTime,
        requestId,
      });
    }
  });

  next();
};

/**
 * Error logging middleware
 */
export const errorLogger = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  logger.error(`Unhandled error in ${req.method} ${req.path}`, {
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name,
    },
    requestId: req.headers["x-request-id"],
  });

  next(err);
};
