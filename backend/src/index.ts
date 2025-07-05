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

    // Check if file type is allowed
    if (!config.upload.allowedFileTypes.includes(fileType)) {
      return res.status(400).json({ error: "File type not allowed" });
    }

    const uploadUrl = await s3Service.generateUploadUrl(fileName, fileType);

    res.json({
      uploadUrl,
      fileName,
      fileType,
    });
  }),
);

// List all uploaded files
app.get(
  "/api/files",
  asyncHandler(async (req: Request, res: Response) => {
    const files = await s3Service.listFiles();

    const formattedFiles = files.map((file) => ({
      key: file.key,
      name: s3Service.getFileNameFromKey(file.key),
      lastModified: file.lastModified,
      size: file.size,
    }));

    res.json({ files: formattedFiles });
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
app.listen(config.server.port, () => {
  console.log(`Server running on port ${config.server.port}`);
  console.log(`CORS origin: ${config.server.corsOrigin}`);
  console.log(`S3 bucket: ${config.aws.bucketName}`);
  console.log(`S3 region: ${config.aws.region}`);
});
