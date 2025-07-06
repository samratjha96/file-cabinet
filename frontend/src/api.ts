import axios from "axios";
import { config } from "./config";

const api = axios.create({
  baseURL: config.api.baseUrl,
  timeout: 30000,
});

export interface FileItem {
  key: string;
  name: string;
  lastModified: Date;
  size: number;
}

export interface UploadResponse {
  uploadUrl: string;
  fileName: string;
  fileType: string;
}

export interface MultipartUploadInitResponse {
  uploadId: string;
  key: string;
  chunkSize: number;
  totalParts: number;
  fileName: string;
  fileType: string;
}

export interface PartUploadResponse {
  uploadUrl: string;
  partNumber: number;
}

export interface MultipartUploadPart {
  ETag: string;
  PartNumber: number;
}

export interface MultipartUploadCompleteResponse {
  success: boolean;
  location: string;
  key: string;
  fileName: string;
}

export interface FilesResponse {
  files: FileItem[];
}

export interface DownloadResponse {
  downloadUrl: string;
  fileName: string;
}

export const apiService = {
  // Get presigned URL for file upload
  async getUploadUrl(
    fileName: string,
    fileType: string,
  ): Promise<UploadResponse> {
    const response = await api.post("/api/upload-url", { fileName, fileType });
    return response.data;
  },

  // Upload file directly to S3 using presigned URL
  async uploadFile(
    uploadUrl: string,
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<void> {
    await axios.put(uploadUrl, file, {
      headers: {
        "Content-Type": file.type,
      },
      onUploadProgress: (progressEvent: any) => {
        if (onProgress && progressEvent.total) {
          const progress = (progressEvent.loaded / progressEvent.total) * 100;
          onProgress(progress);
        }
      },
    });
  },

  // Initiate multipart upload
  async initiateMultipartUpload(
    fileName: string,
    fileType: string,
    fileSize: number,
  ): Promise<MultipartUploadInitResponse> {
    const response = await api.post("/api/initiate-multipart-upload", {
      fileName,
      fileType,
      fileSize,
    });
    return response.data;
  },

  // Get presigned URL for uploading a part
  async getPartUploadUrl(
    key: string,
    uploadId: string,
    partNumber: number,
  ): Promise<PartUploadResponse> {
    const response = await api.post("/api/upload-part-url", {
      key,
      uploadId,
      partNumber,
    });
    return response.data;
  },

  // Upload a part to S3
  async uploadPart(
    uploadUrl: string,
    chunk: Blob,
    onProgress?: (progress: number) => void,
  ): Promise<string> {
    const response = await axios.put(uploadUrl, chunk, {
      headers: {
        "Content-Type": "application/octet-stream",
      },
      onUploadProgress: (progressEvent: any) => {
        if (onProgress && progressEvent.total) {
          const progress = (progressEvent.loaded / progressEvent.total) * 100;
          onProgress(progress);
        }
      },
    });

    // Return the ETag from the response headers
    return response.headers.etag || response.headers.ETag || "";
  },

  // Complete multipart upload
  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: MultipartUploadPart[],
  ): Promise<MultipartUploadCompleteResponse> {
    const response = await api.post("/api/complete-multipart-upload", {
      key,
      uploadId,
      parts,
    });
    return response.data;
  },

  // Abort multipart upload
  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await api.post("/api/abort-multipart-upload", { key, uploadId });
  },

  // Upload file using multipart upload
  async uploadFileMultipart(
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<void> {
    const fileName = file.name;
    const fileType = file.type || "application/octet-stream";
    const fileSize = file.size;

    // Initiate multipart upload
    const initResponse = await this.initiateMultipartUpload(
      fileName,
      fileType,
      fileSize,
    );

    const { uploadId, key, chunkSize, totalParts } = initResponse;

    try {
      // Upload parts in parallel batches
      const parts: MultipartUploadPart[] = [];
      const batchSize = 3; // Upload 3 parts concurrently

      for (let i = 0; i < totalParts; i += batchSize) {
        const batch = [];

        for (let j = i; j < Math.min(i + batchSize, totalParts); j++) {
          const partNumber = j + 1;
          const start = j * chunkSize;
          const end = Math.min(start + chunkSize, fileSize);
          const chunk = file.slice(start, end);

          batch.push(
            this.uploadSinglePart(
              key,
              uploadId,
              partNumber,
              chunk,
              (partProgress) => {
                // Calculate overall progress
                const completedParts = parts.length;
                const currentBatchProgress = partProgress / batchSize;
                const overallProgress =
                  ((completedParts + currentBatchProgress) / totalParts) * 100;

                if (onProgress) {
                  onProgress(Math.min(overallProgress, 100));
                }
              },
            ),
          );
        }

        // Wait for current batch to complete
        const batchResults = await Promise.all(batch);
        parts.push(...batchResults);
      }

      // Complete multipart upload
      await this.completeMultipartUpload(key, uploadId, parts);

      if (onProgress) {
        onProgress(100);
      }
    } catch (error) {
      // Abort multipart upload on error
      try {
        await this.abortMultipartUpload(key, uploadId);
      } catch (abortError) {
        console.error("Failed to abort multipart upload:", abortError);
      }
      throw error;
    }
  },

  // Helper method to upload a single part
  async uploadSinglePart(
    key: string,
    uploadId: string,
    partNumber: number,
    chunk: Blob,
    onProgress?: (progress: number) => void,
  ): Promise<MultipartUploadPart> {
    const partUrlResponse = await this.getPartUploadUrl(
      key,
      uploadId,
      partNumber,
    );
    const etag = await this.uploadPart(
      partUrlResponse.uploadUrl,
      chunk,
      onProgress,
    );

    return {
      ETag: etag,
      PartNumber: partNumber,
    };
  },

  // Get list of uploaded files
  async getFiles(): Promise<FilesResponse> {
    const response = await api.get("/api/files");
    return response.data;
  },

  // Get presigned URL for file download
  async getDownloadUrl(key: string): Promise<DownloadResponse> {
    const response = await api.post("/api/download-url", { key });
    return response.data;
  },

  // Download file using presigned URL
  async downloadFile(downloadUrl: string, fileName: string): Promise<void> {
    const response = await axios.get(downloadUrl, {
      responseType: "blob",
    });

    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};
