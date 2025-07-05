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

export interface FilesResponse {
  files: FileItem[];
}

export interface DownloadResponse {
  downloadUrl: string;
  fileName: string;
}

export interface MultipartInitResponse {
  uploadId: string;
  key: string;
  fileName: string;
  fileType: string;
}

export interface PartUploadResponse {
  partUploadUrl: string;
  partNumber: number;
}

export interface MultipartCompleteResponse {
  success: boolean;
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
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = (progressEvent.loaded / progressEvent.total) * 100;
          onProgress(progress);
        }
      },
    });
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

  // Initialize multipart upload
  async initMultipartUpload(fileName: string, fileType: string): Promise<MultipartInitResponse> {
    const response = await api.post("/api/multipart-upload/init", { fileName, fileType });
    return response.data;
  },

  // Get presigned URL for part upload
  async getPartUploadUrl(key: string, uploadId: string, partNumber: number): Promise<PartUploadResponse> {
    const response = await api.post("/api/multipart-upload/part-url", { key, uploadId, partNumber });
    return response.data;
  },

  // Upload file part
  async uploadPart(
    partUploadUrl: string,
    fileChunk: Blob,
    onProgress?: (progress: number) => void,
  ): Promise<string> {
    const response = await axios.put(partUploadUrl, fileChunk, {
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = (progressEvent.loaded / progressEvent.total) * 100;
          onProgress(progress);
        }
      },
    });
    
    return response.headers.etag || response.headers.ETag || "";
  },

  // Complete multipart upload
  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ PartNumber: number; ETag: string }>,
  ): Promise<MultipartCompleteResponse> {
    const response = await api.post("/api/multipart-upload/complete", { key, uploadId, parts });
    return response.data;
  },

  // Abort multipart upload
  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await api.post("/api/multipart-upload/abort", { key, uploadId });
  },

  // Smart upload - automatically choose between single and multipart based on file size
  async smartUpload(
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<void> {
    // Validate file properties
    if (!file.name || file.name.trim() === '') {
      throw new Error('File name is required');
    }
    
    if (file.size === 0) {
      throw new Error('Cannot upload empty files');
    }
    
    // Ensure file type is set (use generic type if not available)
    const fileType = file.type || 'application/octet-stream';
    
    const { chunkSize, maxFileSize } = config.upload;
    
    // Use multipart upload for files larger than chunk size
    if (file.size > chunkSize) {
      await this.uploadFileMultipart(file, onProgress);
    } else {
      // Use single upload for smaller files
      const uploadResponse = await this.getUploadUrl(file.name, fileType);
      await this.uploadFile(uploadResponse.uploadUrl, file, onProgress);
    }
  },

  // Upload file using multipart upload
  async uploadFileMultipart(
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<void> {
    // Validate file properties
    if (!file.name || file.name.trim() === '') {
      throw new Error('File name is required');
    }
    
    if (file.size === 0) {
      throw new Error('Cannot upload empty files');
    }
    
    // Ensure file type is set (use generic type if not available)
    const fileType = file.type || 'application/octet-stream';
    
    const { chunkSize } = config.upload;
    const totalChunks = Math.ceil(file.size / chunkSize);
    
    // Initialize multipart upload
    const initResponse = await this.initMultipartUpload(file.name, fileType);
    const { uploadId, key } = initResponse;
    
    try {
      const parts: Array<{ PartNumber: number; ETag: string }> = [];
      let totalUploaded = 0;
      
      // Upload parts
      for (let i = 0; i < totalChunks; i++) {
        const partNumber = i + 1;
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        
        // Get presigned URL for this part
        const partResponse = await this.getPartUploadUrl(key, uploadId, partNumber);
        
        // Upload the part
        const etag = await this.uploadPart(partResponse.partUploadUrl, chunk, (partProgress) => {
          const chunkUploaded = (partProgress / 100) * chunk.size;
          const currentTotal = totalUploaded + chunkUploaded;
          const overallProgress = (currentTotal / file.size) * 100;
          
          if (onProgress) {
            onProgress(overallProgress);
          }
        });
        
        parts.push({ PartNumber: partNumber, ETag: etag });
        totalUploaded += chunk.size;
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
};
