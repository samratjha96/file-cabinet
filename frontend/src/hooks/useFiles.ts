import { useState, useCallback } from "react";
import { apiService, type FileItem } from "../api";
import { config } from "../config";
import { attemptMemoryCleanup } from "../utils/memoryManagement";
import logger from "../utils/logger";
import * as zipjs from "@zip.js/zip.js";
// Keep JSZip for backward compatibility during transition
import JSZip from "jszip";

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

  /**
   * Legacy download method using JSZip - kept for backward compatibility
   */
  const downloadFilesAsZipWithJSZip = useCallback(
    async (fileItems: FileItem[], zipName: string) => {
      // Helper function to clean up memory
      const cleanupMemory = async () => {
        attemptMemoryCleanup();
        return new Promise<void>((resolve) => setTimeout(resolve, 50));
      };

      // Log start of download operation
      const totalSizeMB = calculateTotalSize(fileItems);
      logger.info(
        `Starting ZIP download with JSZip for ${fileItems.length} files`,
        {
          totalFiles: fileItems.length,
          totalSizeMB: totalSizeMB.toFixed(2),
          zipName,
        },
      );

      // Log memory usage at the start
      logger.logMemory();

      try {
        const zip = new JSZip();
        const folder = zip.folder(zipName);

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

  /**
   * Modern implementation using zip.js with web workers and streaming for large files
   */
  const downloadFilesAsZipWithStreaming = useCallback(
    async (fileItems: FileItem[], zipName: string) => {
      // Configure zip.js
      zipjs.configure({
        useWebWorkers: true,
        maxWorkers: navigator.hardwareConcurrency
          ? Math.max(2, navigator.hardwareConcurrency - 1)
          : 4,
        workerScripts: {
          deflate: ["/z-worker.js"],
        },
      });

      // Log start of download operation
      const totalSizeMB = calculateTotalSize(fileItems);
      logger.info(
        `Starting streaming ZIP download for ${fileItems.length} files`,
        {
          totalFiles: fileItems.length,
          totalSizeMB: totalSizeMB.toFixed(2),
          zipName,
          usingZipJs: true,
        },
      );

      // Log memory usage at the start
      logger.logMemory();

      try {
        // Determine optimal batch size
        const batchSize = calculateOptimalBatchSize(
          totalSizeMB,
          fileItems.length,
        );
        logger.info(
          `Using batch size: ${batchSize} for processing ${fileItems.length} files`,
        );

        // Create batches for processing
        const batches = splitIntoChunks(fileItems, batchSize);

        // Create a BlobWriter to hold the zip data
        const zipWriter = new zipjs.ZipWriter(
          new zipjs.BlobWriter("application/zip"),
        );

        let successCount = 0;
        let failedDownloads: { fileName: string; error?: unknown }[] = [];

        // Process each batch
        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          logger.info(
            `Processing batch ${i + 1}/${batches.length} (${batch.length} files)`,
          );

          // Process files in this batch
          const batchPromises = batch.map(async (fileItem) => {
            try {
              logger.debug(
                `Starting download for ${fileItem.name} (${formatSizeForLog(fileItem.size)})`,
              );

              // Get download URL from backend
              const downloadResponse = await apiService.getDownloadUrl(
                fileItem.key,
              );

              if (fileItem.size > STREAMING_THRESHOLD) {
                // For large files, use streaming approach
                logger.debug(`Using streaming approach for ${fileItem.name}`);

                const response = await fetch(downloadResponse.downloadUrl);
                if (!response.ok) {
                  throw new Error(
                    `Failed to download file: ${response.status} ${response.statusText}`,
                  );
                }

                // For large files, create a readable stream from the response
                if (response.body) {
                  // Create a reader for the response stream
                  const reader = new zipjs.HttpReader(
                    downloadResponse.downloadUrl,
                  );

                  // Use maximal compression level based on file size
                  const compressionLevel = getCompressionLevel(fileItem.size);

                  // Add the file to the zip with the stream reader
                  await zipWriter.add(fileItem.name, reader, {
                    level: compressionLevel,
                    onprogress: (index, max) => {
                      if (index % (max / 10) < 1) {
                        // Log progress every ~10%
                        const percent = Math.round((index / max) * 100);
                        logger.debug(
                          `Processing ${fileItem.name}: ${percent}% complete`,
                        );
                      }
                      return Promise.resolve();
                    },
                  });

                  successCount++;
                  logger.info(`Successfully added ${fileItem.name} to ZIP`);
                  return { success: true, fileName: fileItem.name };
                } else {
                  throw new Error("Response doesn't have a body stream");
                }
              } else {
                // For smaller files, use the simpler approach
                const response = await fetch(downloadResponse.downloadUrl);
                if (!response.ok) {
                  throw new Error(
                    `Failed to download file: ${response.status} ${response.statusText}`,
                  );
                }

                // Use blob for smaller files
                const blob = await response.blob();

                // Determine compression level
                const compressionLevel = getCompressionLevel(blob.size);

                // Add file to zip
                await zipWriter.add(fileItem.name, new zipjs.BlobReader(blob), {
                  level: compressionLevel,
                });

                successCount++;
                logger.info(`Successfully added ${fileItem.name} to ZIP`);
                return { success: true, fileName: fileItem.name };
              }
            } catch (error) {
              logger.error(`Error downloading ${fileItem.name}`, error);
              failedDownloads.push({ fileName: fileItem.name, error });
              return { success: false, fileName: fileItem.name, error };
            }
          });

          // Wait for all files in this batch to be processed
          await Promise.all(batchPromises);

          // Log memory usage after each batch
          logger.logMemory();

          // Give GC a chance to clean up memory between batches
          attemptMemoryCleanup();
          await new Promise((r) => setTimeout(r, 100));
        }

        // Handle any failed downloads
        if (failedDownloads.length > 0) {
          const failedNames = failedDownloads
            .map((item) => item.fileName)
            .join(", ");
          logger.warn(
            `Failed to download ${failedDownloads.length} files: ${failedNames}`,
          );

          if (successCount === 0) {
            throw new Error("All file downloads failed");
          }

          // Notify user about partial success
          alert(`Warning: ${failedDownloads.length} file(s) failed to download: ${failedNames}
                \nDownloading ${successCount} successful files as ZIP.`);
        }

        // Close the zip writer to finalize the zip
        logger.info("Finalizing ZIP file...");
        const zipBlob = await zipWriter.close();
        logger.info(`ZIP created: ${formatSizeForLog(zipBlob.size)}`);

        // Trigger the download
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${zipName}.zip`;
        document.body.appendChild(link);
        logger.info("Download triggered");
        link.click();
        document.body.removeChild(link);

        // Clean up the URL object
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 1000);
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

  /**
   * Calculate optimal batch size based on total size and file count
   */
  const calculateOptimalBatchSize = (
    totalSizeMB: number,
    fileCount: number,
  ): number => {
    // Batch size based on total size
    let batchSize: number;

    if (totalSizeMB > 5000) {
      // > 5GB
      batchSize = 1; // Process one file at a time for extremely large data
    } else if (totalSizeMB > 2000) {
      // > 2GB
      batchSize = 2;
    } else if (totalSizeMB > 1000) {
      // > 1GB
      batchSize = 3;
    } else if (totalSizeMB > 500) {
      // > 500MB
      batchSize = 4;
    } else {
      batchSize = 5;
    }

    // Adjust batch size based on file count
    if (fileCount > 100) {
      batchSize = Math.min(batchSize, 3);
    }

    // Don't make batch size larger than file count
    return Math.min(batchSize, fileCount);
  };

  /**
   * Get appropriate compression level based on file size
   */
  const getCompressionLevel = (fileSize: number): number => {
    const sizeMB = fileSize / (1024 * 1024);

    if (sizeMB > 1000) {
      // > 1GB
      return 0; // No compression for very large files
    } else if (sizeMB > 500) {
      // > 500MB
      return 1; // Minimal compression for large files
    } else if (sizeMB > 100) {
      // > 100MB
      return 3; // Low compression for medium-large files
    } else {
      return 5; // Default compression for smaller files
    }
  };

  /**
   * Format size for logging in a human-readable format
   */
  const formatSizeForLog = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + " " + sizes[i];
  };

  /**
   * Main download function that uses the best method based on file sizes
   */
  const downloadFilesAsZip = useCallback(
    async (fileItems: FileItem[], zipName: string) => {
      const totalSizeMB = calculateTotalSize(fileItems);

      // For very large files (>1GB) or many files, use streaming zip.js
      if (
        totalSizeMB > 1000 ||
        fileItems.length > 50 ||
        fileItems.some((f) => f.size > 1024 * 1024 * 1024)
      ) {
        return downloadFilesAsZipWithStreaming(fileItems, zipName);
      } else {
        // For smaller files, use the original JSZip implementation
        return downloadFilesAsZipWithJSZip(fileItems, zipName);
      }
    },
    [downloadFilesAsZipWithJSZip, downloadFilesAsZipWithStreaming],
  );

  return {
    files,
    isLoading,
    loadFiles,
    downloadFile,
    downloadFilesAsZip,
  };
};
