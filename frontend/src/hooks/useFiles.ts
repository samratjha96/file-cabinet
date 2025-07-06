import { useState, useCallback } from "react";
import { apiService, type FileItem } from "../api";
import JSZip from "jszip";
import { config } from "../config";
import { attemptMemoryCleanup } from "../utils/memoryManagement";
import logger from "../utils/logger";

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

  // Calculate the total size of files in MB
  const calculateTotalSize = (files: FileItem[]): number => {
    return files.reduce((sum, file) => sum + file.size, 0) / (1024 * 1024);
  };

  // Get thresholds from config
  const LARGE_FILE_THRESHOLD = config.download?.largeZipThreshold
    ? config.download.largeZipThreshold / (1024 * 1024)
    : 1000; // 1GB default

  const STREAMING_THRESHOLD =
    config.download?.streamingThreshold || 100 * 1024 * 1024; // 100MB default

  // Use lower threshold for very large ZIPs to save memory
  const HUGE_ZIP_THRESHOLD = 2000; // 2GB

  // Maximum number of concurrent downloads
  const MAX_CONCURRENT_DOWNLOADS = config.maxConcurrentDownloads || 5;

  // Split array into chunks for batch processing
  const splitIntoChunks = <T>(array: T[], chunkSize: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  };

  const downloadFilesAsZip = useCallback(
    async (fileItems: FileItem[], zipName: string) => {
      // Helper function to clean up memory
      const cleanupMemory = async () => {
        // Try to free memory
        attemptMemoryCleanup();

        // Add a small delay to give GC a chance to run
        return new Promise<void>((resolve) => setTimeout(resolve, 50));
      };

      // Log start of download operation
      const totalSizeMB = calculateTotalSize(fileItems);
      logger.info(`Starting ZIP download for ${fileItems.length} files`, {
        totalFiles: fileItems.length,
        totalSizeMB: totalSizeMB.toFixed(2),
        zipName,
      });

      // Log memory usage at the start
      logger.logMemory();

      try {
        const zip = new JSZip();
        const folder = zip.folder(zipName);
        const totalSizeMB = calculateTotalSize(fileItems);

        if (!folder) {
          throw new Error("Failed to create ZIP folder");
        }

        // For very large files, we'll use a streaming approach with chunked processing
        const isLargeDownload =
          totalSizeMB > LARGE_FILE_THRESHOLD || fileItems.length > 20;

        let successCount = 0;
        let failedDownloads: { fileName: string; error?: unknown }[] = [];

        // For large downloads, process in batches to avoid memory issues
        if (isLargeDownload) {
          const batches = splitIntoChunks(fileItems, MAX_CONCURRENT_DOWNLOADS);

          for (const batch of batches) {
            const batchPromises = batch.map(async (fileItem) => {
              try {
                const downloadResponse = await apiService.getDownloadUrl(
                  fileItem.key,
                );
                const response = await fetch(downloadResponse.downloadUrl);

                if (!response.ok) {
                  throw new Error(
                    `Failed to download file: ${response.statusText}`,
                  );
                }

                // For large files, we use streaming instead of loading the entire blob at once
                if (fileItem.size > STREAMING_THRESHOLD) {
                  // > 100MB
                  // Use the streaming ReadableStream API for large files
                  const reader = response.body?.getReader();
                  if (!reader)
                    throw new Error("Browser doesn't support ReadableStream");

                  // Create an array to hold the chunks
                  const chunks: Uint8Array[] = [];
                  let totalSize = 0;

                  // Process the stream
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    if (value) {
                      chunks.push(value);
                      totalSize += value.length;
                    }
                  }

                  // Combine the chunks into a single Uint8Array
                  const allChunks = new Uint8Array(totalSize);
                  let position = 0;
                  for (const chunk of chunks) {
                    allChunks.set(chunk, position);
                    position += chunk.length;
                  }

                  // Add file to zip
                  folder.file(fileItem.name, allChunks);
                } else {
                  // For smaller files, use the simpler blob approach
                  const blob = await response.blob();
                  folder.file(fileItem.name, blob);
                }

                successCount++;
                return { success: true, fileName: fileItem.name };
              } catch (error) {
                console.error(
                  `Error downloading file ${fileItem.name}:`,
                  error,
                );
                failedDownloads.push({ fileName: fileItem.name, error });
                return { success: false, fileName: fileItem.name, error };
              }
            });

            await Promise.all(batchPromises);
          }
        } else {
          // For smaller downloads, process all files at once
          const downloadPromises = fileItems.map(async (fileItem) => {
            try {
              const downloadResponse = await apiService.getDownloadUrl(
                fileItem.key,
              );
              const response = await fetch(downloadResponse.downloadUrl);

              if (!response.ok) {
                throw new Error(
                  `Failed to download file: ${response.statusText}`,
                );
              }

              const blob = await response.blob();
              folder.file(fileItem.name, blob);
              successCount++;

              return { success: true, fileName: fileItem.name };
            } catch (error) {
              console.error(`Error downloading file ${fileItem.name}:`, error);
              failedDownloads.push({ fileName: fileItem.name, error });
              return { success: false, fileName: fileItem.name, error };
            }
          });

          await Promise.all(downloadPromises);
        }

        // Check if any downloads failed
        if (failedDownloads.length > 0) {
          const failedNames = failedDownloads
            .map((item) => item.fileName)
            .join(", ");
          console.warn(`Failed to download files: ${failedNames}`);

          if (successCount === 0) {
            throw new Error("All file downloads failed");
          }

          // Notify user about partial success
          alert(
            `Warning: ${failedDownloads.length} file(s) failed to download: ${failedNames}\n\nDownloading ${successCount} successful files as ZIP.`,
          );
        }

        // Use optimal compression settings based on file size
        const compressionLevel = totalSizeMB > 500 ? 1 : 6; // Use lower compression for very large ZIPs

        // For very large total sizes, use a streaming approach to generate the ZIP
        if (totalSizeMB > HUGE_ZIP_THRESHOLD) {
          // > 2GB
          // Create a StreamSaver-like approach by generating the zip in chunks
          const zipStream = zip.generateInternalStream({
            type: "uint8array",
            compression: "DEFLATE",
            compressionOptions: { level: compressionLevel },
            streamFiles: true,
          });

          const chunks: Uint8Array[] = [];
          zipStream.on("data", (data: Uint8Array) => {
            chunks.push(data);
          });

          await new Promise<void>((resolve, reject) => {
            zipStream.on("error", reject);
            zipStream.on("end", () => resolve());
          });

          // Try to clean up before creating the final blob
          await cleanupMemory();

          // Combine all chunks and create a blob
          const blob = new Blob(chunks, { type: "application/zip" });

          // Trigger download
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${zipName}.zip`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        } else {
          // For smaller ZIPs, use the standard approach
          const zipBlob = await zip.generateAsync({
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: { level: compressionLevel },
          });

          // Trigger download
          const url = window.URL.createObjectURL(zipBlob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${zipName}.zip`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        }
      } catch (error) {
        console.error("Bulk download error:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Bulk download failed";
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
