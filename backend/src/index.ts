import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { config } from "./config";
import { s3Service } from "./s3Service";
import logger from "./logger";
import { requestLogger, errorLogger } from "./middlewares/loggingMiddleware";

const app = express();

// Async handler wrapper
const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>,
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Check if the origin is in the allowed list
      if (
        config.server.corsOrigins.includes(origin) ||
        origin === config.server.corsOrigin
      ) {
        return callback(null, true);
      }

      // For development, allow localhost with any port
      if (
        process.env.NODE_ENV !== "production" &&
        origin.includes("localhost")
      ) {
        return callback(null, true);
      }

      logger.warn(`CORS blocked request from origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  }),
);
app.use(express.json());

// Apply logging middleware
app.use(requestLogger);

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Generate presigned URL for file upload
app.post(
  "/api/upload-url",
  asyncHandler(async (req: Request, res: Response) => {
    const { fileName, fileType } = req.body;

    if (!fileName || !fileType) {
      return res
        .status(400)
        .json({ error: "fileName and fileType are required" });
    }

    const uploadUrl = await s3Service.generateUploadUrl(fileName, fileType);
    res.json({ uploadUrl, fileName, fileType });
  }),
);

// Initiate multipart upload
app.post(
  "/api/initiate-multipart-upload",
  asyncHandler(async (req: Request, res: Response) => {
    const { fileName, fileType, fileSize } = req.body;

    if (!fileName || !fileType || !fileSize) {
      return res
        .status(400)
        .json({ error: "fileName, fileType, and fileSize are required" });
    }

    const { uploadId, key } = await s3Service.initiateMultipartUpload(
      fileName,
      fileType,
    );

    const chunkSize = s3Service.calculateChunkSize(fileSize);
    const totalParts = Math.ceil(fileSize / chunkSize);

    res.json({
      uploadId,
      key,
      chunkSize,
      totalParts,
      fileName,
      fileType,
    });
  }),
);

// Generate presigned URL for uploading a part
app.post(
  "/api/upload-part-url",
  asyncHandler(async (req: Request, res: Response) => {
    const { key, uploadId, partNumber } = req.body;

    if (!key || !uploadId || !partNumber) {
      return res
        .status(400)
        .json({ error: "key, uploadId, and partNumber are required" });
    }

    const uploadUrl = await s3Service.generatePartUploadUrl(
      key,
      uploadId,
      partNumber,
    );

    res.json({ uploadUrl, partNumber });
  }),
);

// Generate presigned URLs for multiple parts in a single request
app.post(
  "/api/upload-part-urls-batch",
  asyncHandler(async (req: Request, res: Response) => {
    const { key, uploadId, partNumbers } = req.body;

    if (!key || !uploadId || !partNumbers || !Array.isArray(partNumbers)) {
      return res
        .status(400)
        .json({ error: "key, uploadId, and partNumbers array are required" });
    }

    if (partNumbers.length > 100) {
      return res
        .status(400)
        .json({ error: "Maximum of 100 part numbers allowed per batch" });
    }

    // Generate URLs for all parts in parallel
    const partUrlPromises = partNumbers.map(async (partNumber) => {
      const uploadUrl = await s3Service.generatePartUploadUrl(
        key,
        uploadId,
        partNumber,
      );
      return { partNumber, uploadUrl };
    });

    const partUrls = await Promise.all(partUrlPromises);
    res.json({ partUrls });
  }),
);

// Complete multipart upload
app.post(
  "/api/complete-multipart-upload",
  asyncHandler(async (req: Request, res: Response) => {
    const { key, uploadId, parts } = req.body;

    if (!key || !uploadId || !parts || !Array.isArray(parts)) {
      return res
        .status(400)
        .json({ error: "key, uploadId, and parts array are required" });
    }

    // Validate parts array
    for (const part of parts) {
      if (!part.ETag || !part.PartNumber) {
        return res
          .status(400)
          .json({ error: "Each part must have ETag and PartNumber" });
      }
    }

    const location = await s3Service.completeMultipartUpload(
      key,
      uploadId,
      parts,
    );

    res.json({
      success: true,
      location,
      key,
      fileName: s3Service.getFileNameFromKey(key),
    });
  }),
);

// Abort multipart upload
app.post(
  "/api/abort-multipart-upload",
  asyncHandler(async (req: Request, res: Response) => {
    const { key, uploadId } = req.body;

    if (!key || !uploadId) {
      return res.status(400).json({ error: "key and uploadId are required" });
    }

    await s3Service.abortMultipartUpload(key, uploadId);

    res.json({ success: true, message: "Multipart upload aborted" });
  }),
);

// List all uploaded files
app.get(
  "/api/files",
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const files = await s3Service.listFiles();

      const formattedFiles = files.map((file) => ({
        key: file.key,
        name: s3Service.getFileNameFromKey(file.key),
        lastModified: file.lastModified,
        size: file.size,
      }));

      logger.info(`Listing files complete`, {
        fileCount: formattedFiles.length,
        totalSizeMB: formattedFiles
          .reduce((sum, file) => sum + (file.size || 0) / (1024 * 1024), 0)
          .toFixed(2),
      });
      res.json({ files: formattedFiles });
    } catch (error) {
      logger.error("Error fetching files from S3", error);
      throw error;
    }
  }),
);

// Generate presigned URL for file download
app.post(
  "/api/download-url",
  asyncHandler(async (req: Request, res: Response) => {
    const { key } = req.body;

    if (!key) {
      return res.status(400).json({ error: "key is required" });
    }

    const downloadUrl = await s3Service.generateDownloadUrl(key);

    res.json({
      downloadUrl,
      fileName: s3Service.getFileNameFromKey(key),
    });
  }),
);

// Receive client-side logs
app.post(
  "/api/client-logs",
  asyncHandler(async (req: Request, res: Response) => {
    const { logs } = req.body;

    if (!logs || !Array.isArray(logs)) {
      return res.status(400).json({ error: "logs array is required" });
    }

    // Log each client log with appropriate level
    logs.forEach((clientLog) => {
      const { level, message, details, timestamp } = clientLog;

      // Map client log level to server log level
      switch (level) {
        case 0: // ERROR
          logger.error(`Client: ${message}`, {
            clientTimestamp: timestamp,
            ...details,
          });
          break;
        case 1: // WARN
          logger.warn(`Client: ${message}`, {
            clientTimestamp: timestamp,
            ...details,
          });
          break;
        case 2: // INFO
          logger.info(`Client: ${message}`, {
            clientTimestamp: timestamp,
            ...details,
          });
          break;
        case 3: // DEBUG
          logger.debug(`Client: ${message}`, {
            clientTimestamp: timestamp,
            ...details,
          });
          break;
        default:
          logger.info(`Client: ${message}`, {
            clientTimestamp: timestamp,
            level,
            ...details,
          });
      }
    });

    res.json({ success: true, count: logs.length });
  }),
);

// Error handling middleware
app.use(errorLogger);
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({ error: "Internal server error" });
});

// Start server
app.listen(config.server.port, "0.0.0.0", () => {
  logger.info(`Server started successfully`, {
    port: config.server.port,
    environment: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "1.0.0",
  });

  logger.info(`Server configuration`, {
    cors: {
      origin: config.server.corsOrigin,
      allowedOrigins: config.server.corsOrigins,
    },
    s3: {
      bucket: config.aws.bucketName,
      region: config.aws.region,
      keyPrefix: config.aws.keyPrefix,
    },
    upload: {
      maxFileSize: `${config.upload.maxFileSize / (1024 * 1024)}MB`,
      presignedUrlExpiry: `${config.upload.presignedUrlExpiry}s`,
    },
  });
});
