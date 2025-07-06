import { fetchClient, uploadWithProgress } from "./utils/fetchClient";

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
    return fetchClient<UploadResponse>("/api/upload-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fileName, fileType }),
    });
  },

  // Upload file directly to S3 using presigned URL
  async uploadFile(
    uploadUrl: string,
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<void> {
    const response = await uploadWithProgress(
      uploadUrl,
      file,
      file.type,
      (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = (progressEvent.loaded / progressEvent.total) * 100;
          onProgress(progress);
        }
      },
    );

    if (!response.ok) {
      throw new Error(`Upload failed with status ${response.status}`);
    }
  },

  // Initiate multipart upload
  async initiateMultipartUpload(
    fileName: string,
    fileType: string,
    fileSize: number,
  ): Promise<MultipartUploadInitResponse> {
    return fetchClient<MultipartUploadInitResponse>(
      "/api/initiate-multipart-upload",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName,
          fileType,
          fileSize,
        }),
      },
    );
  },

  // Get presigned URL for uploading a part
  async getPartUploadUrl(
    key: string,
    uploadId: string,
    partNumber: number,
  ): Promise<PartUploadResponse> {
    return fetchClient<PartUploadResponse>("/api/upload-part-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key,
        uploadId,
        partNumber,
      }),
    });
  },

  // Get presigned URLs for multiple parts in a batch
  async getPartUploadUrlsBatch(
    key: string,
    uploadId: string,
    partNumbers: number[],
  ): Promise<Array<{ partNumber: number; uploadUrl: string }>> {
    const response = await fetchClient<{
      partUrls: Array<{ partNumber: number; uploadUrl: string }>;
    }>("/api/upload-part-urls-batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key,
        uploadId,
        partNumbers,
      }),
    });
    return response.partUrls;
  },

  // Upload a part to S3
  async uploadPart(
    uploadUrl: string,
    chunk: Blob,
    onProgress?: (progress: number) => void,
  ): Promise<string> {
    const response = await uploadWithProgress(
      uploadUrl,
      chunk,
      "application/octet-stream",
      (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = (progressEvent.loaded / progressEvent.total) * 100;
          onProgress(progress);
        }
      },
    );

    if (!response.ok) {
      throw new Error(`Part upload failed with status ${response.status}`);
    }

    // Return the ETag from the response headers
    const etag =
      response.headers.get("etag") || response.headers.get("ETag") || "";
    return etag;
  },

  // Complete multipart upload
  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: MultipartUploadPart[],
  ): Promise<MultipartUploadCompleteResponse> {
    return fetchClient<MultipartUploadCompleteResponse>(
      "/api/complete-multipart-upload",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key,
          uploadId,
          parts,
        }),
      },
    );
  },

  // Abort multipart upload
  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await fetchClient("/api/abort-multipart-upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key,
        uploadId,
      }),
    });
  },

  // Upload file using multipart upload with optimizations
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
      // Upload parts in parallel batches with optimizations
      const parts: MultipartUploadPart[] = [];
      const uploadedBytes = new Map<number, number>(); // Track uploaded bytes per part

      // Calculate optimal batch size based on file size
      // For larger files use larger batches, smaller files use smaller batches
      let batchSize = 3; // Default
      if (fileSize > 1024 * 1024 * 500) {
        // > 500MB
        batchSize = 5; // More parallelism for large files
      } else if (fileSize < 1024 * 1024 * 50) {
        // < 50MB
        batchSize = 2; // Less parallelism for small files
      }

      // Limit batch size based on navigator.hardwareConcurrency if available
      if (typeof navigator !== "undefined" && navigator.hardwareConcurrency) {
        // Use at most hardwareConcurrency-1 to avoid saturating the CPU
        batchSize = Math.min(batchSize, navigator.hardwareConcurrency - 1);
      }
      batchSize = Math.max(1, batchSize); // Ensure minimum of 1

      // Prepare all chunks
      const chunks: { partNumber: number; chunk: Blob }[] = [];
      for (let i = 0; i < totalParts; i++) {
        const partNumber = i + 1;
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, fileSize);
        const chunk = file.slice(start, end);
        chunks.push({ partNumber, chunk });
      }

      // Process chunks in batches
      for (let i = 0; i < chunks.length; i += batchSize) {
        const currentBatch = chunks.slice(i, i + batchSize);

        // Get presigned URLs for all parts in this batch in a single request
        const partNumbers = currentBatch.map((c) => c.partNumber);
        const urlResponses = await this.getPartUploadUrlsBatch(
          key,
          uploadId,
          partNumbers,
        );

        // Create a map of partNumber to uploadUrl for easy access
        const urlMap = new Map<number, string>();
        urlResponses.forEach((resp) => {
          urlMap.set(resp.partNumber, resp.uploadUrl);
        });

        // Upload all parts in this batch concurrently
        const uploadPromises = currentBatch.map(
          async ({ partNumber, chunk }) => {
            const uploadUrl = urlMap.get(partNumber);
            if (!uploadUrl) {
              throw new Error(`No upload URL for part ${partNumber}`);
            }

            // Upload this part with individual progress tracking
            const etag = await this.uploadPart(
              uploadUrl,
              chunk,
              (partProgress) => {
                // Store current uploaded bytes for this part
                const partSize = chunk.size;
                const bytesUploaded = Math.floor(
                  (partProgress / 100) * partSize,
                );
                uploadedBytes.set(partNumber, bytesUploaded);

                // Calculate overall progress based on all parts
                if (onProgress) {
                  const totalUploaded = Array.from(
                    uploadedBytes.values(),
                  ).reduce((sum, bytes) => sum + bytes, 0);
                  const overallProgress = Math.min(
                    (totalUploaded / fileSize) * 100,
                    99.9,
                  ); // Cap at 99.9% until completion
                  onProgress(overallProgress);
                }
              },
            );

            return {
              ETag: etag,
              PartNumber: partNumber,
            };
          },
        );

        // Wait for all parts in this batch to complete
        const batchResults = await Promise.all(uploadPromises);
        parts.push(...batchResults);

        // Report progress including this completed batch
        if (onProgress) {
          const completedBytes = parts.length * chunkSize;
          const progress = Math.min((completedBytes / fileSize) * 100, 99.9);
          onProgress(progress);
        }
      }

      // Complete multipart upload
      await this.completeMultipartUpload(key, uploadId, parts);

      if (onProgress) {
        onProgress(100); // Ensure we hit 100% when done
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
    return fetchClient<FilesResponse>("/api/files");
  },

  // Get presigned URL for file download
  async getDownloadUrl(key: string): Promise<DownloadResponse> {
    return fetchClient<DownloadResponse>("/api/download-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ key }),
    });
  },

  // Download file using presigned URL
  async downloadFile(downloadUrl: string, fileName: string): Promise<void> {
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}`);
    }

    const blob = await response.blob();
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
