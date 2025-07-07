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

// Base URL for API calls
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

// Constants for file size thresholds
const FILE_SIZE_THRESHOLDS = {
  RESUME_THRESHOLD: 1024 * 1024 * 1024, // 1GB
  SAVE_STATE_THRESHOLD: 100 * 1024 * 1024, // 100MB
  LARGE_FILE_THRESHOLD: 5 * 1024 * 1024 * 1024, // 5GB
  MEMORY_CLEANUP_INTERVAL: 5, // Every 5 batches
} as const;

// API Service with helper methods for file operations
export const apiService = {
  // Get the base URL for API requests
  getBaseUrl(): string {
    return API_BASE_URL;
  },

  // Generate a storage key for upload state
  generateUploadStateKey(fileName: string, fileSize: number): string {
    return `upload_state_${fileName}_${fileSize}_${Date.now()}`;
  },

  // Save upload state for resumable uploads
  saveUploadState(
    key: string,
    uploadId: string,
    fileName: string,
    fileSize: number,
    chunkSize: number,
    completedParts: MultipartUploadPart[],
    resumeKey: string,
  ): void {
    try {
      const state = {
        key,
        uploadId,
        fileName,
        fileSize,
        chunkSize,
        completedParts,
        timestamp: Date.now(),
      };
      localStorage.setItem(resumeKey, JSON.stringify(state));
    } catch (error) {
      console.warn("Failed to save upload state:", error);
    }
  },

  // Load upload state for resumable uploads
  loadUploadState(resumeKey: string): {
    key: string;
    uploadId: string;
    fileName: string;
    fileSize: number;
    chunkSize: number;
    completedParts: MultipartUploadPart[];
    timestamp: number;
  } | null {
    try {
      const state = localStorage.getItem(resumeKey);
      if (state) {
        return JSON.parse(state);
      }
    } catch (error) {
      console.warn("Failed to load upload state:", error);
    }
    return null;
  },

  // Clear upload state after completion
  clearUploadState(resumeKey: string): void {
    try {
      localStorage.removeItem(resumeKey);
    } catch (error) {
      console.warn("Failed to clear upload state:", error);
    }
  },

  // Check if any part needs to be retried due to expiration
  isPartExpired(timestamp: number): boolean {
    // Be conservative to ensure we don't attempt to use expired URLs
    // Backend sets 4 hour expiry, but we'll refresh after 3.5 hours
    const expiryThresholdMs = 3.5 * 60 * 60 * 1000; // 3.5 hours in milliseconds
    return Date.now() - timestamp > expiryThresholdMs;
  },

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

  // Upload a part to S3 with retry mechanism
  async uploadPart(
    uploadUrl: string,
    chunk: Blob,
    onProgress?: (progress: number) => void,
  ): Promise<string> {
    // Maximum number of retries
    const MAX_RETRIES = 3;
    let retries = 0;
    let lastError;

    while (retries < MAX_RETRIES) {
      try {
        const response = await uploadWithProgress(
          uploadUrl,
          chunk,
          "application/octet-stream",
          (progressEvent) => {
            if (onProgress && progressEvent.total) {
              const progress =
                (progressEvent.loaded / progressEvent.total) * 100;
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

        if (!etag) {
          throw new Error("No ETag received from S3, upload may be incomplete");
        }

        return etag;
      } catch (error: any) {
        lastError = error;
        retries++;
        console.warn(
          `Upload attempt ${retries} failed: ${error.message}. ${retries < MAX_RETRIES ? "Retrying..." : ""}`,
        );

        if (retries < MAX_RETRIES) {
          // Exponential backoff: wait longer between each retry
          const delay = Math.pow(2, retries) * 1000 + Math.random() * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    throw lastError || new Error("Part upload failed after multiple attempts");
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

  // Calculate optimal batch size based on file size and hardware
  calculateBatchSize(fileSize: number): number {
    // Simple algorithm: base batch size on file size ranges
    const sizeInGB = fileSize / (1024 * 1024 * 1024);
    let batchSize: number;

    if (sizeInGB > 10) batchSize = 10;
    else if (sizeInGB > 5) batchSize = 8;
    else if (sizeInGB > 1) batchSize = 6;
    else if (sizeInGB > 0.5) batchSize = 5;
    else if (sizeInGB < 0.05) batchSize = 2;
    else batchSize = 3;

    // Limit based on hardware concurrency
    if (typeof navigator !== "undefined" && navigator.hardwareConcurrency) {
      batchSize = Math.min(batchSize, navigator.hardwareConcurrency - 1);
    }

    return Math.max(1, batchSize);
  },

  // Consolidated progress tracking
  updateProgress(
    uploadedBytes: Map<number, number>,
    fileSize: number,
    onProgress?: (progress: number) => void,
    maxProgress = 99.9,
  ): void {
    if (!onProgress) return;

    const totalUploaded = Array.from(uploadedBytes.values()).reduce(
      (sum, bytes) => sum + bytes,
      0,
    );
    const progress = Math.min((totalUploaded / fileSize) * 100, maxProgress);
    onProgress(progress);
  },

  // Upload file using multipart upload with optimizations and resumable functionality
  async uploadFileMultipart(
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<void> {
    const fileName = file.name;
    const fileType = file.type || "application/octet-stream";
    const fileSize = file.size;

    // Generate a key for storing upload state
    const resumeKey = this.generateUploadStateKey(fileName, fileSize);

    // Check if we have a saved state for this upload
    let uploadId: string;
    let key: string;
    let chunkSize: number;
    let totalParts: number;
    let completedParts: MultipartUploadPart[] = [];
    let resuming = false;

    // For files larger than 1GB, attempt to resume upload if possible
    const savedState =
      fileSize > FILE_SIZE_THRESHOLDS.RESUME_THRESHOLD
        ? this.loadUploadState(resumeKey)
        : null;

    if (
      savedState &&
      !this.isPartExpired(savedState.timestamp) &&
      savedState.fileSize === fileSize
    ) {
      // We can resume this upload
      resuming = true;
      uploadId = savedState.uploadId;
      key = savedState.key;
      chunkSize = savedState.chunkSize;
      totalParts = Math.ceil(fileSize / chunkSize);
      completedParts = savedState.completedParts;

      console.log(
        `Resuming upload of ${fileName} with ${completedParts.length}/${totalParts} parts completed`,
      );

      // Notify of resumption
      if (onProgress) {
        const resumedProgress = (completedParts.length / totalParts) * 100;
        onProgress(Math.min(resumedProgress, 99));
      }
    } else {
      // Start a new upload
      const initResponse = await this.initiateMultipartUpload(
        fileName,
        fileType,
        fileSize,
      );

      uploadId = initResponse.uploadId;
      key = initResponse.key;
      chunkSize = initResponse.chunkSize;
      totalParts = initResponse.totalParts;
    }

    try {
      // Upload parts in parallel batches with optimizations
      const parts: MultipartUploadPart[] = resuming ? [...completedParts] : [];
      const uploadedBytes = new Map<number, number>(); // Track uploaded bytes per part

      // Initialize progress tracking for completed parts
      if (resuming) {
        completedParts.forEach((part) => {
          uploadedBytes.set(part.PartNumber, chunkSize);
        });
        this.updateProgress(uploadedBytes, fileSize, onProgress);
      }

      // Calculate optimal batch size
      const batchSize = this.calculateBatchSize(fileSize);

      // Determine if we should use on-demand chunk creation for memory efficiency
      const isLargeFile = fileSize > FILE_SIZE_THRESHOLDS.LARGE_FILE_THRESHOLD;
      const completedPartNumbers = new Set(
        completedParts.map((p) => p.PartNumber),
      );

      // Function to create a chunk on demand
      const createChunk = (
        index: number,
      ): { partNumber: number; chunk: Blob } => {
        const partNumber = index + 1;
        const start = index * chunkSize;
        const end = Math.min(start + chunkSize, fileSize);
        const chunk = file.slice(start, end);
        return { partNumber, chunk };
      };

      // Prepare chunks for smaller files, use on-demand for large files
      const chunks: { partNumber: number; chunk: Blob }[] = [];
      if (!isLargeFile) {
        for (let i = 0; i < totalParts; i++) {
          const partNumber = i + 1;
          if (resuming && completedPartNumbers.has(partNumber)) {
            continue;
          }
          chunks.push(createChunk(i));
        }
      } else {
        console.log(
          `File ${fileName} is large (${(fileSize / (1024 * 1024 * 1024)).toFixed(2)}GB). Using on-demand chunk creation.`,
        );
      }

      // Import memory management utilities
      const { attemptMemoryCleanup } = await import("./utils/memoryManagement");

      // Process batch function
      const processBatch = async (partNumbers: number[]) => {
        // Create chunks for this batch
        const currentBatch = isLargeFile
          ? partNumbers.map((partNumber) => createChunk(partNumber - 1))
          : chunks.filter((chunk) => partNumbers.includes(chunk.partNumber));

        // Get presigned URLs for all parts in this batch
        const urlResponses = await this.getPartUploadUrlsBatch(
          key,
          uploadId,
          partNumbers,
        );

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

            const etag = await this.uploadPart(
              uploadUrl,
              chunk,
              (partProgress) => {
                const bytesUploaded = Math.floor(
                  (partProgress / 100) * chunk.size,
                );
                uploadedBytes.set(partNumber, bytesUploaded);
                this.updateProgress(uploadedBytes, fileSize, onProgress);
              },
            );

            return { ETag: etag, PartNumber: partNumber };
          },
        );

        const batchResults = await Promise.all(uploadPromises);
        parts.push(...batchResults);

        // Save upload state periodically for large files
        if (fileSize > FILE_SIZE_THRESHOLDS.SAVE_STATE_THRESHOLD) {
          this.saveUploadState(
            key,
            uploadId,
            fileName,
            fileSize,
            chunkSize,
            parts,
            resumeKey,
          );
        }

        // Memory cleanup for large files
        if (isLargeFile) {
          currentBatch.forEach((item) => {
            item.chunk = null as any;
          });
          await attemptMemoryCleanup();
        }
      };

      // Process all parts in batches
      const partNumbersToUpload = [];
      for (let i = 0; i < totalParts; i++) {
        const partNumber = i + 1;
        if (!resuming || !completedPartNumbers.has(partNumber)) {
          partNumbersToUpload.push(partNumber);
        }
      }

      // Process batches
      for (let i = 0; i < partNumbersToUpload.length; i += batchSize) {
        const batchPartNumbers = partNumbersToUpload.slice(i, i + batchSize);

        // Periodic memory cleanup for large files
        if (
          isLargeFile &&
          i > 0 &&
          i % (batchSize * FILE_SIZE_THRESHOLDS.MEMORY_CLEANUP_INTERVAL) === 0
        ) {
          console.log(
            `Memory cleanup at batch ${Math.floor(i / batchSize) + 1}`,
          );
          await attemptMemoryCleanup();
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        await processBatch(batchPartNumbers);
      }

      // Complete multipart upload
      const completeResponse = await this.completeMultipartUpload(
        key,
        uploadId,
        parts,
      );

      // Verify upload success
      if (!completeResponse?.key) {
        throw new Error(
          "Upload completion failed: Invalid response from server",
        );
      }

      // Validation warnings
      if (parts.length !== totalParts && !resuming) {
        console.warn(
          `Upload part count mismatch: ${parts.length} parts uploaded but expected ${totalParts} parts`,
        );
      }

      const missingETags = parts.filter(
        (part) => !part.ETag || part.ETag === "",
      );
      if (missingETags.length > 0) {
        console.warn(
          `${missingETags.length} parts have missing ETags. Upload may be incomplete.`,
        );
      }

      // Final progress update
      if (onProgress) {
        onProgress(100);
      }

      console.log(
        `Upload of ${fileName} (${(fileSize / (1024 * 1024)).toFixed(2)}MB) completed successfully`,
      );

      // Clear upload state when successfully completed
      this.clearUploadState(resumeKey);
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
