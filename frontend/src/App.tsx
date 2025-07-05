import { useState, useEffect } from "react";
import { FileUpload } from "./components/FileUpload";
import { FileList } from "./components/FileList";
import { UploadProgress } from "./components/UploadProgress";
import { apiService, type FileItem } from "./api";
import "./App.css";

export interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
}

function App() {
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [uploadStats, setUploadStats] = useState({
    total: 0,
    completed: 0,
    failed: 0,
    totalSize: 0,
    uploadedSize: 0,
  });

  // Load files on component mount
  useEffect(() => {
    loadFiles();
  }, []);

  // Update upload stats when upload items change
  useEffect(() => {
    const stats = uploadItems.reduce(
      (acc, item) => {
        acc.total += 1;
        acc.totalSize += item.file.size;
        if (item.status === "completed") {
          acc.completed += 1;
          acc.uploadedSize += item.file.size;
        } else if (item.status === "error") {
          acc.failed += 1;
        } else if (item.status === "uploading") {
          acc.uploadedSize += (item.file.size * item.progress) / 100;
        }
        return acc;
      },
      { total: 0, completed: 0, failed: 0, totalSize: 0, uploadedSize: 0 },
    );
    setUploadStats(stats);
  }, [uploadItems]);

  const loadFiles = async () => {
    setIsLoadingFiles(true);
    try {
      const response = await apiService.getFiles();
      setFiles(response.files);
    } catch (error) {
      console.error("Error loading files:", error);
      // Show user-friendly error message
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
      setIsLoadingFiles(false);
    }
  };

  const handleFilesSelected = (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return;

    // Show immediate feedback
    const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    const totalSizeFormatted = formatFileSize(totalSize);

    // Give haptic feedback on mobile
    if ("navigator" in window && "vibrate" in navigator) {
      (navigator as any).vibrate(50);
    }

    const baseTimestamp = Date.now();
    const newUploadItems: UploadItem[] = selectedFiles.map((file, index) => ({
      id: `${baseTimestamp}-${index}-${file.name}-${file.size}`,
      file,
      progress: 0,
      status: "pending",
    }));

    setUploadItems((prev) => [...prev, ...newUploadItems]);

    // Show confirmation for large uploads
    if (selectedFiles.length > 10 || totalSize > 100 * 1024 * 1024) {
      // 100MB
      const message = `Ready to upload ${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} (${totalSizeFormatted}). This might take a while.`;
      if (!window.confirm(message + "\n\nProceed with upload?")) {
        // Remove the items if user cancels
        setUploadItems((prev) =>
          prev.filter(
            (item) => !newUploadItems.find((newItem) => newItem.id === item.id),
          ),
        );
        return;
      }
    }

    startUploads(newUploadItems);
  };

  const startUploads = async (items: UploadItem[]) => {
    setIsUploading(true);

    // Limit concurrent uploads to prevent overwhelming the server
    const maxConcurrentUploads = 3;
    const uploadQueue = [...items];
    const activeUploads = new Set<string>();

    const processNextUpload = async (): Promise<void> => {
      if (uploadQueue.length === 0) return;

      const item = uploadQueue.shift()!;
      activeUploads.add(item.id);

      try {
        // Update status to uploading
        setUploadItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: "uploading" } : i,
          ),
        );

        // Upload file with smart upload (automatically chooses single or multipart)
        await apiService.smartUpload(item.file, (progress) => {
          setUploadItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, progress } : i)),
          );
        });

        // Mark as completed
        setUploadItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: "completed", progress: 100 } : i,
          ),
        );

        // Give success feedback on mobile
        if ("navigator" in window && "vibrate" in navigator) {
          (navigator as any).vibrate(100);
        }
      } catch (error) {
        console.error("Upload error:", error);

        // Extract more detailed error information
        let errorMessage = "Upload failed";
        if (error instanceof Error) {
          errorMessage = error.message;

          // If it's an axios error, try to get the backend error message
          if (
            "response" in error &&
            error.response &&
            typeof error.response === "object"
          ) {
            const response = error.response as any;
            if (response.data && response.data.error) {
              errorMessage = response.data.error;
            }
            console.error("Backend response:", response.data);
          }
        }

        // Make error messages more user-friendly
        if (
          errorMessage.includes("413") ||
          errorMessage.includes("too large")
        ) {
          errorMessage = "File is too large for upload";
        } else if (
          errorMessage.includes("network") ||
          errorMessage.includes("fetch")
        ) {
          errorMessage = "Network connection error";
        } else if (errorMessage.includes("timeout")) {
          errorMessage = "Upload timed out";
        }

        setUploadItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: "error",
                  error: errorMessage,
                }
              : i,
          ),
        );

        // Give error feedback on mobile
        if ("navigator" in window && "vibrate" in navigator) {
          (navigator as any).vibrate([100, 50, 100]);
        }
      } finally {
        activeUploads.delete(item.id);

        // Start next upload
        if (uploadQueue.length > 0) {
          processNextUpload();
        }
      }
    };

    // Start initial concurrent uploads
    const initialUploads = Math.min(maxConcurrentUploads, items.length);
    for (let i = 0; i < initialUploads; i++) {
      processNextUpload();
    }

    // Wait for all uploads to complete
    const checkComplete = () => {
      return new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (activeUploads.size === 0 && uploadQueue.length === 0) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });
    };

    await checkComplete();
    setIsUploading(false);

    // Show completion notification
    const completedCount = items.filter((item) => {
      const currentItem = uploadItems.find((ui) => ui.id === item.id);
      return currentItem?.status === "completed";
    }).length;

    if (completedCount > 0) {
      const message = `Upload complete! ${completedCount} file${completedCount === 1 ? "" : "s"} uploaded successfully.`;
      console.log(message);
    }

    // Refresh file list after uploads complete
    setTimeout(() => {
      loadFiles();
    }, 1000);
  };

  const clearCompletedUploads = () => {
    setUploadItems((prev) =>
      prev.filter((item) => item.status !== "completed"),
    );
  };

  const clearAllUploads = () => {
    if (isUploading) {
      if (
        !window.confirm(
          "Uploads are in progress. Are you sure you want to clear all?",
        )
      ) {
        return;
      }
    }
    setUploadItems([]);
  };

  const retryFailedUploads = () => {
    const failedItems = uploadItems.filter((item) => item.status === "error");
    if (failedItems.length === 0) return;

    // Reset failed items to pending
    setUploadItems((prev) =>
      prev.map((item) =>
        item.status === "error"
          ? { ...item, status: "pending", progress: 0, error: undefined }
          : item,
      ),
    );

    // Restart uploads for failed items
    startUploads(failedItems);
  };

  const handleDownload = async (fileItem: FileItem) => {
    try {
      // Show loading feedback
      if ("navigator" in window && "vibrate" in navigator) {
        (navigator as any).vibrate(50);
      }

      const downloadResponse = await apiService.getDownloadUrl(fileItem.key);
      await apiService.downloadFile(
        downloadResponse.downloadUrl,
        fileItem.name,
      );

      // Show success feedback
      if ("navigator" in window && "vibrate" in navigator) {
        (navigator as any).vibrate(100);
      }
    } catch (error) {
      console.error("Download error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Download failed";
      alert(`Unable to download file: ${errorMessage}`);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getOverallProgress = () => {
    if (uploadStats.totalSize === 0) return 0;
    return Math.round((uploadStats.uploadedSize / uploadStats.totalSize) * 100);
  };

  const hasFailedUploads = uploadItems.some((item) => item.status === "error");
  const hasCompletedUploads = uploadItems.some(
    (item) => item.status === "completed",
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1>📁 File Cabinet</h1>
        <p>Upload and manage your files securely</p>
      </header>

      <main className="app-main">
        <div className="upload-section">
          <FileUpload
            onFilesSelected={handleFilesSelected}
            isUploading={isUploading}
          />

          {uploadItems.length > 0 && (
            <div className="upload-progress-section">
              <div className="upload-progress-header">
                <h3>
                  Upload Progress
                  {uploadStats.total > 0 && (
                    <span
                      style={{
                        fontWeight: "normal",
                        color: "var(--text-secondary)",
                      }}
                    >
                      ({uploadStats.completed}/{uploadStats.total})
                    </span>
                  )}
                </h3>
                <div style={{ display: "flex", gap: "var(--spacing-sm)" }}>
                  {hasFailedUploads && (
                    <button
                      onClick={retryFailedUploads}
                      className="retry-btn"
                      disabled={isUploading}
                    >
                      🔄 Retry Failed
                    </button>
                  )}
                  {hasCompletedUploads && (
                    <button
                      onClick={clearCompletedUploads}
                      className="clear-completed-btn"
                    >
                      ✅ Clear Completed
                    </button>
                  )}
                  <button
                    onClick={clearAllUploads}
                    className="clear-all-btn"
                    disabled={isUploading}
                  >
                    🗑️ Clear All
                  </button>
                </div>
              </div>

              {/* Overall progress bar */}
              {isUploading && uploadStats.totalSize > 0 && (
                <div style={{ marginBottom: "var(--spacing-lg)" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "var(--spacing-sm)",
                      fontSize: "0.875rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <span>Overall Progress</span>
                    <span>{getOverallProgress()}%</span>
                  </div>
                  <div className="upload-progress-bar">
                    <div
                      className="upload-progress-fill"
                      style={{
                        width: `${getOverallProgress()}%`,
                        backgroundColor: "var(--primary-color)",
                      }}
                    />
                  </div>
                </div>
              )}

              <UploadProgress
                uploadItems={uploadItems}
                formatFileSize={formatFileSize}
              />
            </div>
          )}
        </div>

        <div className="files-section">
          <FileList
            files={files}
            onDownload={handleDownload}
            onRefresh={loadFiles}
            formatFileSize={formatFileSize}
            isLoading={isLoadingFiles}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
