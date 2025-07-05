import axios from 'axios';
import { config } from './config';

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

export const apiService = {
  // Get presigned URL for file upload
  async getUploadUrl(fileName: string, fileType: string): Promise<UploadResponse> {
    const response = await api.post('/api/upload-url', { fileName, fileType });
    return response.data;
  },

  // Upload file directly to S3 using presigned URL
  async uploadFile(uploadUrl: string, file: File, onProgress?: (progress: number) => void): Promise<void> {
    await axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type,
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
    const response = await api.get('/api/files');
    return response.data;
  },

  // Get presigned URL for file download
  async getDownloadUrl(key: string): Promise<DownloadResponse> {
    const response = await api.post('/api/download-url', { key });
    return response.data;
  },

  // Download file using presigned URL
  async downloadFile(downloadUrl: string, fileName: string): Promise<void> {
    const response = await axios.get(downloadUrl, {
      responseType: 'blob',
    });
    
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
}; 