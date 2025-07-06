import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "./config";
import logger from "./logger";

class S3Service {
  private s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client({
      region: config.aws.region,
      // AWS credentials will be loaded from default credential providers
      // (environment variables, AWS config files, IAM roles, etc.)
    });
  }

  /**
   * Generate a presigned URL for uploading a file to S3
   */
  async generateUploadUrl(fileName: string, fileType: string): Promise<string> {
    const key = `${config.aws.keyPrefix}${Date.now()}-${fileName}`;

    logger.debug(`Generating upload URL for file`, {
      fileName,
      fileType,
      key,
    });

    const command = new PutObjectCommand({
      Bucket: config.aws.bucketName,
      Key: key,
      ContentType: fileType,
    });

    const signedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: config.upload.presignedUrlExpiry,
    });

    logger.s3("GenerateUploadUrl", config.aws.bucketName, key, {
      expiresIn: config.upload.presignedUrlExpiry,
    });

    return signedUrl;
  }

  /**
   * Generate a presigned URL for downloading a file from S3
   */
  async generateDownloadUrl(key: string): Promise<string> {
    logger.debug(`Generating download URL for file`, {
      key,
      fileName: this.getFileNameFromKey(key),
    });

    const command = new GetObjectCommand({
      Bucket: config.aws.bucketName,
      Key: key,
    });

    const signedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: config.upload.presignedUrlExpiry,
    });

    logger.s3("GenerateDownloadUrl", config.aws.bucketName, key, {
      expiresIn: config.upload.presignedUrlExpiry,
    });

    return signedUrl;
  }

  /**
   * List all files in the S3 bucket
   */
  async listFiles(): Promise<
    Array<{
      key: string;
      lastModified: Date | undefined;
      size: number | undefined;
    }>
  > {
    logger.debug(`Listing files from S3`, {
      bucket: config.aws.bucketName,
      prefix: config.aws.keyPrefix,
    });

    const command = new ListObjectsV2Command({
      Bucket: config.aws.bucketName,
      Prefix: config.aws.keyPrefix,
    });

    const response = await this.s3Client.send(command);
    const fileCount = response.Contents?.length || 0;

    logger.s3("ListFiles", config.aws.bucketName, undefined, {
      prefix: config.aws.keyPrefix,
      fileCount,
      totalSizeMB:
        (response.Contents?.reduce((sum, item) => sum + (item.Size || 0), 0) ||
          0) /
        (1024 * 1024),
    });

    return (
      response.Contents?.map((item) => ({
        key: item.Key || "",
        lastModified: item.LastModified,
        size: item.Size,
      })) || []
    );
  }

  /**
   * Initiate a multipart upload
   */
  async initiateMultipartUpload(
    fileName: string,
    fileType: string,
  ): Promise<{
    uploadId: string;
    key: string;
  }> {
    const key = `${config.aws.keyPrefix}${Date.now()}-${fileName}`;

    logger.debug(`Initiating multipart upload for file`, {
      fileName,
      fileType,
      key,
    });

    const command = new CreateMultipartUploadCommand({
      Bucket: config.aws.bucketName,
      Key: key,
      ContentType: fileType,
    });

    const response = await this.s3Client.send(command);

    if (!response.UploadId) {
      logger.error("Failed to initiate multipart upload", { fileName, key });
      throw new Error("Failed to initiate multipart upload");
    }

    logger.s3("InitiateMultipartUpload", config.aws.bucketName, key, {
      uploadId: response.UploadId,
      contentType: fileType,
    });

    return {
      uploadId: response.UploadId,
      key: key,
    };
  }

  /**
   * Generate presigned URL for uploading a part
   */
  async generatePartUploadUrl(
    key: string,
    uploadId: string,
    partNumber: number,
  ): Promise<string> {
    const command = new UploadPartCommand({
      Bucket: config.aws.bucketName,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    const signedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: config.upload.presignedUrlExpiry,
    });

    return signedUrl;
  }

  /**
   * Complete a multipart upload
   */
  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ ETag: string; PartNumber: number }>,
  ): Promise<string> {
    const command = new CompleteMultipartUploadCommand({
      Bucket: config.aws.bucketName,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts,
      },
    });

    const response = await this.s3Client.send(command);

    if (!response.Location) {
      throw new Error("Failed to complete multipart upload");
    }

    return response.Location;
  }

  /**
   * Abort a multipart upload
   */
  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    const command = new AbortMultipartUploadCommand({
      Bucket: config.aws.bucketName,
      Key: key,
      UploadId: uploadId,
    });

    await this.s3Client.send(command);
  }

  /**
   * Calculate optimal chunk size based on file size
   */
  calculateChunkSize(fileSize: number): number {
    const MB = 1024 * 1024;

    if (fileSize < 100 * MB) {
      return 5 * MB; // 5MB for smaller files
    } else if (fileSize < 1000 * MB) {
      return 10 * MB; // 10MB for medium files
    } else {
      return 25 * MB; // 25MB for large files
    }
  }

  /**
   * Get the file name from the S3 key
   */
  getFileNameFromKey(key: string): string {
    const parts = key.split("/");
    const fileName = parts[parts.length - 1];
    // Remove the timestamp prefix added during upload
    return fileName.replace(/^\d+-/, "");
  }
}

export const s3Service = new S3Service();
