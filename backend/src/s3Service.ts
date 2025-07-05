import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "./config";

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

    const command = new PutObjectCommand({
      Bucket: config.aws.bucketName,
      Key: key,
      ContentType: fileType,
    });

    const signedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: config.upload.presignedUrlExpiry,
    });

    return signedUrl;
  }

  /**
   * Generate a presigned URL for downloading a file from S3
   */
  async generateDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: config.aws.bucketName,
      Key: key,
    });

    const signedUrl = await getSignedUrl(this.s3Client, command, {
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
    const command = new ListObjectsV2Command({
      Bucket: config.aws.bucketName,
      Prefix: config.aws.keyPrefix,
    });

    const response = await this.s3Client.send(command);

    return (
      response.Contents?.map((item) => ({
        key: item.Key || "",
        lastModified: item.LastModified,
        size: item.Size,
      })) || []
    );
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
