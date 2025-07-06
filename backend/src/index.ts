import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { config } from "./config";
import { s3Service } from "./s3Service";

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

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  }),
);
app.use(express.json());

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
    console.log("API: GET /api/files - Fetching files from S3");
    try {
      const files = await s3Service.listFiles();
      console.log(`API: Found ${files.length} files in S3`);

      const formattedFiles = files.map((file) => ({
        key: file.key,
        name: s3Service.getFileNameFromKey(file.key),
        lastModified: file.lastModified,
        size: file.size,
      }));

      console.log(`API: Returning ${formattedFiles.length} formatted files`);
      res.json({ files: formattedFiles });
    } catch (error) {
      console.error("API: Error fetching files from S3:", error);
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

// Error handling middleware
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled error:", error);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
app.listen(config.server.port, "0.0.0.0", () => {
  console.log(`Server running on port ${config.server.port}`);
  console.log(`Server bound to: 0.0.0.0:${config.server.port}`);
  console.log(`CORS origin: ${config.server.corsOrigin}`);
  console.log(`S3 bucket: ${config.aws.bucketName}`);
  console.log(`S3 region: ${config.aws.region}`);
});
