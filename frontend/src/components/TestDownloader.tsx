import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { apiService, type FileItem } from "../api";
import JSZip from "jszip";
import logger from "../utils/logger";
import { attemptMemoryCleanup } from "../utils/memoryManagement";

/**
 * TestDownloader component for downloading specific files by filename
 *
 * This is a diagnostic tool that allows downloading individual files or
 * sets of files to test performance and identify issues.
 */
export const TestDownloader = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isZipping, setIsZipping] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [logEntries, setLogEntries] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>("");

  // Load files on component mount
  useEffect(() => {
    loadFiles();
  }, []);

  // Capture logs
  useEffect(() => {
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    const originalConsoleInfo = console.info;

    console.log = (...args) => {
      setLogEntries((prev) => [...prev, `LOG: ${args.join(" ")}`]);
      originalConsoleLog(...args);
    };

    console.error = (...args) => {
      setLogEntries((prev) => [...prev, `ERROR: ${args.join(" ")}`]);
      originalConsoleError(...args);
    };

    console.warn = (...args) => {
      setLogEntries((prev) => [...prev, `WARN: ${args.join(" ")}`]);
      originalConsoleWarn(...args);
    };

    console.info = (...args) => {
      setLogEntries((prev) => [...prev, `INFO: ${args.join(" ")}`]);
      originalConsoleInfo(...args);
    };

    return () => {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
      console.info = originalConsoleInfo;
    };
  }, []);

  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const response = await apiService.getFiles();
      setFiles(response.files);
    } catch (error) {
      console.error("Error loading files:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFile = (fileKey: string) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fileKey)) {
        newSet.delete(fileKey);
      } else {
        newSet.add(fileKey);
      }
      return newSet;
    });
  };

  const filteredFiles =
    searchQuery.trim() === ""
      ? files
      : files.filter((file) =>
          file.name.toLowerCase().includes(searchQuery.toLowerCase()),
        );

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    // Already filtered based on searchQuery state
  };

  const handleDownloadSingle = async (file: FileItem) => {
    setStatusMessage(`Downloading ${file.name}...`);
    try {
      logger.info(`Starting download of single file: ${file.name}`, {
        size: file.size,
        key: file.key,
      });

      const downloadResponse = await apiService.getDownloadUrl(file.key);
      await apiService.downloadFile(downloadResponse.downloadUrl, file.name);

      logger.info(`Successfully downloaded ${file.name}`);
      setStatusMessage(`Successfully downloaded ${file.name}`);
    } catch (error) {
      logger.error(`Failed to download ${file.name}`, error);
      setStatusMessage(
        `Failed to download ${file.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const handleDownloadSelected = async () => {
    if (selectedFiles.size === 0) {
      setStatusMessage("No files selected");
      return;
    }

    setIsZipping(true);
    setStatusMessage(`Preparing to download ${selectedFiles.size} files...`);

    try {
      // Get selected file objects
      const selectedFileObjects = files.filter((file) =>
        selectedFiles.has(file.key),
      );

      // Calculate total size
      const totalSize = selectedFileObjects.reduce(
        (sum, file) => sum + file.size,
        0,
      );
      const totalSizeMB = totalSize / (1024 * 1024);

      logger.info(`Starting download of ${selectedFiles.size} files`, {
        totalFiles: selectedFiles.size,
        totalSizeMB: totalSizeMB.toFixed(2),
      });

      // Log memory at start
      logger.logMemory();

      // Create timestamp for folder name
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      const zipName = `test-download-${timestamp}`;

      // Create ZIP
      const zip = new JSZip();
      const folder = zip.folder(zipName);

      if (!folder) {
        throw new Error("Failed to create ZIP folder");
      }

      // Process files in batches
      const MAX_CONCURRENT = 3;
      let successCount = 0;
      let failedFiles: string[] = [];

      // Helper function for memory cleanup
      const cleanupMemory = async () => {
        attemptMemoryCleanup();
        return new Promise<void>((resolve) => setTimeout(resolve, 100));
      };

      // Split files into batches
      const batches: FileItem[][] = [];
      for (let i = 0; i < selectedFileObjects.length; i += MAX_CONCURRENT) {
        batches.push(selectedFileObjects.slice(i, i + MAX_CONCURRENT));
      }

      // Process each batch
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        setStatusMessage(`Downloading batch ${i + 1} of ${batches.length}...`);

        const batchPromises = batch.map(async (file) => {
          try {
            logger.debug(
              `Starting download for ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)}MB)`,
            );

            // Get presigned URL
            const downloadResponse = await apiService.getDownloadUrl(file.key);
            const response = await fetch(downloadResponse.downloadUrl);

            if (!response.ok) {
              throw new Error(
                `Failed to download file: ${response.statusText}`,
              );
            }

            // For large files, use streaming
            if (file.size > 100 * 1024 * 1024) {
              // 100MB
              logger.debug(`Using streaming for large file: ${file.name}`);

              const reader = response.body?.getReader();
              if (!reader)
                throw new Error("Browser doesn't support ReadableStream");

              const chunks: Uint8Array[] = [];
              let totalSize = 0;
              let progressSize = 0;

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                if (value) {
                  chunks.push(value);
                  totalSize += value.length;
                  progressSize += value.length;

                  if (progressSize > 20 * 1024 * 1024) {
                    // Log every 20MB
                    logger.debug(
                      `Downloaded ${(totalSize / (1024 * 1024)).toFixed(2)}MB of ${file.name}`,
                    );
                    progressSize = 0;
                  }
                }
              }

              const allChunks = new Uint8Array(totalSize);
              let position = 0;
              for (const chunk of chunks) {
                allChunks.set(chunk, position);
                position += chunk.length;
              }

              logger.debug(
                `Successfully downloaded ${file.name} (${(totalSize / (1024 * 1024)).toFixed(2)}MB)`,
              );
              folder.file(file.name, allChunks);
            } else {
              // For smaller files, use blob
              const blob = await response.blob();
              folder.file(file.name, blob);
            }

            successCount++;
            return { success: true, fileName: file.name };
          } catch (error) {
            logger.error(`Error downloading ${file.name}`, error);
            failedFiles.push(file.name);
            return { success: false, fileName: file.name, error };
          }
        });

        await Promise.all(batchPromises);
        await cleanupMemory();
        logger.logMemory();
      }

      // Update status with success/failure info
      if (failedFiles.length > 0) {
        setStatusMessage(
          `Failed to download ${failedFiles.length} files. Creating ZIP with ${successCount} successful files.`,
        );
      } else {
        setStatusMessage(
          `Successfully downloaded all ${successCount} files. Creating ZIP...`,
        );
      }

      // Determine compression level based on size
      let compressionLevel = 6; // Default
      if (totalSizeMB > 2000) {
        compressionLevel = 0; // No compression for huge files
        logger.info(`Using no compression for ${totalSizeMB.toFixed(2)}MB ZIP`);
      } else if (totalSizeMB > 500) {
        compressionLevel = 1; // Light compression for large files
        logger.info(
          `Using light compression for ${totalSizeMB.toFixed(2)}MB ZIP`,
        );
      }

      // Generate ZIP file
      setStatusMessage("Generating ZIP file...");
      logger.logMemory();

      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: compressionLevel },
      });

      // Trigger download
      logger.info(
        `ZIP created: ${(zipBlob.size / (1024 * 1024)).toFixed(2)}MB`,
      );
      setStatusMessage(
        `ZIP created: ${(zipBlob.size / (1024 * 1024)).toFixed(2)}MB. Starting download...`,
      );

      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${zipName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setStatusMessage(
        `Download complete. ${successCount} files downloaded, ${failedFiles.length} files failed.`,
      );
      logger.info("Download triggered");
    } catch (error) {
      logger.error("Error during ZIP operation", error);
      setStatusMessage(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsZipping(false);
    }
  };

  const clearLogs = () => {
    setLogEntries([]);
  };

  const downloadLogs = () => {
    const logs = JSON.stringify(logger.export(), null, 2);
    const blob = new Blob([logs], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `file-cabinet-logs-${new Date().toISOString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="test-downloader">
      <h2>Test File Downloader</h2>
      <p className="warning">
        This is a diagnostic tool for testing file downloads
      </p>

      <div className="search-section">
        <form onSubmit={handleSearch}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files by name..."
          />
          <button type="submit">Search</button>
          <button type="button" onClick={loadFiles} disabled={isLoading}>
            {isLoading ? "Loading..." : "Refresh Files"}
          </button>
        </form>
      </div>

      <div className="selected-actions">
        <button
          onClick={handleDownloadSelected}
          disabled={isZipping || selectedFiles.size === 0}
        >
          {isZipping
            ? "Creating ZIP..."
            : `Download Selected (${selectedFiles.size})`}
        </button>

        <button onClick={() => setSelectedFiles(new Set())}>
          Clear Selection
        </button>
      </div>

      {statusMessage && <div className="status-message">{statusMessage}</div>}

      <div className="file-list-container">
        <h3>Available Files ({filteredFiles.length})</h3>
        {filteredFiles.length === 0 ? (
          <p>No files found</p>
        ) : (
          <table className="file-table">
            <thead>
              <tr>
                <th style={{ width: "30px" }}></th>
                <th>File Name</th>
                <th>Size</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map((file) => (
                <tr
                  key={file.key}
                  className={selectedFiles.has(file.key) ? "selected" : ""}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(file.key)}
                      onChange={() => toggleFile(file.key)}
                    />
                  </td>
                  <td>{file.name}</td>
                  <td>{formatFileSize(file.size)}</td>
                  <td>
                    <button onClick={() => handleDownloadSingle(file)}>
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="logs-section">
        <div className="logs-header">
          <h3>Logs</h3>
          <div>
            <button onClick={clearLogs}>Clear Logs</button>
            <button onClick={downloadLogs}>Download Logs</button>
          </div>
        </div>
        <div className="log-container">
          {logEntries.length === 0 ? (
            <p>No logs yet</p>
          ) : (
            <pre>{logEntries.join("\n")}</pre>
          )}
        </div>
      </div>

      <style>{`
        .test-downloader {
          padding: 20px;
          max-width: 1000px;
          margin: 0 auto;
        }

        .warning {
          color: #ff6600;
          font-weight: bold;
          margin-bottom: 20px;
        }

        .search-section {
          margin-bottom: 20px;
        }

        .search-section form {
          display: flex;
          gap: 10px;
        }

        .search-section input {
          flex: 1;
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
        }

        .selected-actions {
          margin-bottom: 20px;
          display: flex;
          gap: 10px;
        }

        .status-message {
          padding: 10px;
          margin-bottom: 20px;
          background: #f8f8f8;
          border-left: 4px solid #4caf50;
        }

        .file-list-container {
          margin-bottom: 30px;
        }

        .file-table {
          width: 100%;
          border-collapse: collapse;
        }

        .file-table th,
        .file-table td {
          padding: 10px;
          border-bottom: 1px solid #eee;
          text-align: left;
        }

        .file-table tr.selected {
          background-color: #f0f7ff;
        }

        .logs-section {
          background: #f5f5f5;
          border-radius: 4px;
          padding: 10px;
        }

        .logs-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .logs-header div {
          display: flex;
          gap: 10px;
        }

        .log-container {
          background: #222;
          color: #eee;
          padding: 10px;
          border-radius: 4px;
          max-height: 300px;
          overflow-y: auto;
          font-family: monospace;
          font-size: 12px;
        }

        button {
          background: #0066cc;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 4px;
          cursor: pointer;
        }

        button:disabled {
          background: #cccccc;
          cursor: not-allowed;
        }

        button:hover:not(:disabled) {
          background: #0055aa;
        }
      `}</style>
    </div>
  );
};

// Format file size for display
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default TestDownloader;
