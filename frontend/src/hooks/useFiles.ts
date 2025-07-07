import { useState, useCallback } from "react";
import { apiService, type FileItem } from "../api";
import { config } from "../config";
import { attemptMemoryCleanup } from "../utils/memoryManagement";
import logger from "../utils/logger";
import * as zipjs from "@zip.js/zip.js";

// Constants for download thresholds
const DOWNLOAD_THRESHOLDS = {
  LARGE_ZIP_MB: config.download?.largeZipThreshold
    ? config.download.largeZipThreshold / (1024 * 1024)
    : 1000, // 1GB
  STREAMING_BYTES: config.download?.streamingThreshold || 100 * 1024 * 1024, // 100MB
  MAX_CONCURRENT: config.maxConcurrentDownloads || 5,
} as const;

export const useFiles = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiService.getFiles();
      setFiles(response.files);
    } catch (error) {
      console.error("Error loading files:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
        alert(
          "Unable to load files. Please check your internet connection and try again.",
        );
      } else {
        alert("Unable to load files. Please refresh the page and try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const downloadFile = useCallback(async (fileItem: FileItem) => {
    try {
      const downloadResponse = await apiService.getDownloadUrl(fileItem.key);
      await apiService.downloadFile(
        downloadResponse.downloadUrl,
        fileItem.name,
      );
    } catch (error) {
      console.error("Download error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Download failed";
      alert(`Unable to download file: ${errorMessage}`);
    }
  }, []);

  // Calculate total size in MB
  const calculateTotalSize = (files: FileItem[]): number => {
    return files.reduce((sum, file) => sum + file.size, 0) / (1024 * 1024);
  };

  // Format size for display
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + " " + sizes[i];
  };

  // Calculate optimal batch size
  const calculateBatchSize = (
    totalSizeMB: number,
    fileCount: number,
  ): number => {
    if (totalSizeMB > 5000) return 1; // > 5GB: one at a time
    if (totalSizeMB > 2000) return 2; // > 2GB
    if (totalSizeMB > 1000) return 3; // > 1GB
    if (fileCount > 100) return 3; // Many files
    return DOWNLOAD_THRESHOLDS.MAX_CONCURRENT; // Default
  };

  // Get compression level based on file size
  const getCompressionLevel = (fileSize: number): number => {
    const sizeMB = fileSize / (1024 * 1024);
    if (sizeMB > 1000) return 0; // No compression for very large files
    if (sizeMB > 500) return 1; // Minimal compression
    if (sizeMB > 100) return 3; // Low compression
    return 5; // Default compression
  };

  // Split array into chunks
  const splitIntoChunks = <T>(array: T[], chunkSize: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  };

  // Download and process a single file
  const downloadAndProcessFile = async (
    fileItem: FileItem,
    zipWriter: zipjs.ZipWriter<Blob>,
  ): Promise<{ success: boolean; fileName: string; error?: unknown }> => {
    try {
      const downloadResponse = await apiService.getDownloadUrl(fileItem.key);
      const response = await fetch(downloadResponse.downloadUrl);

      if (!response.ok) {
        throw new Error(
          `Failed to download file: ${response.status} ${response.statusText}`,
        );
      }

      // Use streaming for large files, blob for smaller ones
      if (fileItem.size > DOWNLOAD_THRESHOLDS.STREAMING_BYTES) {
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Browser doesn't support ReadableStream");

        const chunks: Uint8Array[] = [];
        let totalBytes = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (value) {
            chunks.push(value);
            totalBytes += value.length;
          }
        }

        const allBytes = new Uint8Array(totalBytes);
        let offset = 0;
        for (const chunk of chunks) {
          allBytes.set(chunk, offset);
          offset += chunk.length;
        }

        await zipWriter.add(
          fileItem.name,
          new zipjs.Uint8ArrayReader(allBytes),
          { level: getCompressionLevel(fileItem.size) },
        );
      } else {
        const blob = await response.blob();
        await zipWriter.add(fileItem.name, new zipjs.BlobReader(blob), {
          level: getCompressionLevel(blob.size),
        });
      }

      return { success: true, fileName: fileItem.name };
    } catch (error) {
      console.error(`Error downloading ${fileItem.name}:`, error);
      return { success: false, fileName: fileItem.name, error };
    }
  };

  const downloadFilesAsZip = useCallback(
    async (fileItems: FileItem[], zipName: string) => {
      const totalSizeMB = calculateTotalSize(fileItems);

      logger.info(
        `Starting ZIP download: ${fileItems.length} files (${formatSize(totalSizeMB * 1024 * 1024)})`,
      );

      // Configure zip.js with web workers
      zipjs.configure({
        useWebWorkers: true,
        maxWorkers: navigator.hardwareConcurrency
          ? Math.max(2, navigator.hardwareConcurrency - 1)
          : 4,
      });

      try {
        const batchSize = calculateBatchSize(totalSizeMB, fileItems.length);
        const batches = splitIntoChunks(fileItems, batchSize);

        const zipWriter = new zipjs.ZipWriter(
          new zipjs.BlobWriter("application/zip"),
        );

        let successCount = 0;
        let failedDownloads: { fileName: string; error?: unknown }[] = [];

        // Process batches sequentially to manage memory
        for (const batch of batches) {
          const batchPromises = batch.map((fileItem) =>
            downloadAndProcessFile(fileItem, zipWriter),
          );

          const results = await Promise.all(batchPromises);

          results.forEach((result) => {
            if (result.success) {
              successCount++;
            } else {
              failedDownloads.push({
                fileName: result.fileName,
                error: result.error,
              });
            }
          });

          // Memory cleanup between batches for large downloads
          if (totalSizeMB > DOWNLOAD_THRESHOLDS.LARGE_ZIP_MB) {
            await attemptMemoryCleanup();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }

        // Handle failed downloads
        if (failedDownloads.length > 0) {
          const failedNames = failedDownloads
            .map((item) => item.fileName)
            .join(", ");

          if (successCount === 0) {
            throw new Error("All file downloads failed");
          }

          alert(
            `Warning: ${failedDownloads.length} file(s) failed to download: ${failedNames}\n\nDownloading ${successCount} successful files as ZIP.`,
          );
        }

        // Finalize and download the ZIP
        const zipBlob = await zipWriter.close();
        logger.info(`ZIP created: ${formatSize(zipBlob.size)}`);

        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${zipName}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) {
        logger.error("Error creating ZIP file", error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to create ZIP";
        alert(`Unable to create ZIP download: ${errorMessage}`);
        throw error;
      }
    },
    [],
  );

  return {
    files,
    isLoading,
    loadFiles,
    downloadFile,
    downloadFilesAsZip,
  };
};
