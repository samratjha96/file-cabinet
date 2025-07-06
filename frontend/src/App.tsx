import { useEffect, useState } from "react";
import { FileUpload } from "./components/FileUpload";
import { FileList } from "./components/FileList";
import { UploadProgress } from "./components/UploadProgress";
import { TestDownloader } from "./components/TestDownloader";
import { useUpload } from "./hooks/useUpload";
import { useFiles } from "./hooks/useFiles";
import { formatFileSize } from "./utils";
import "./App.css";

function App() {
  const [activeTab, setActiveTab] = useState<"upload" | "files" | "test">(
    "upload",
  );
  const [showTestTool, setShowTestTool] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const {
    uploadItems,
    isUploading,
    uploadStats,
    addFiles,
    startUploads,
    retryFailedUploads,
    clearCompletedUploads,
    clearAllUploads,
  } = useUpload();

  const { files, isLoading, loadFiles, downloadFile, downloadFilesAsZip } =
    useFiles();

  // Load files on component mount
  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // Handle window resize for responsive layout
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleFilesSelected = (selectedFiles: File[]) => {
    const newUploadItems = addFiles(selectedFiles);
    if (newUploadItems) {
      // Show confirmation for large uploads
      if (
        selectedFiles.length > 10 ||
        uploadStats.totalSize > 100 * 1024 * 1024
      ) {
        const totalSize = selectedFiles.reduce(
          (sum, file) => sum + file.size,
          0,
        );
        const message = `Ready to upload ${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} (${formatFileSize(totalSize)}). This might take a while.`;
        if (!window.confirm(message + "\n\nProceed with upload?")) {
          clearAllUploads();
          return;
        }
      }
      startUploads(newUploadItems);
      // Switch to files tab after upload starts on mobile
      if (isMobile) {
        setActiveTab("files");
      }
    }
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
        <div className="app-logo">
          <div className="app-logo-icon">📁</div>
          <div className="app-title">
            <h1>File Cabinet</h1>
            <p>Upload and manage your files securely</p>
          </div>
        </div>
        <div className="app-actions">
          <button
            className="refresh-files-btn"
            onClick={loadFiles}
            disabled={isLoading}
            title="Refresh files"
          >
            {isLoading ? "⏳" : "🔄"}
          </button>
          <button
            className="test-tool-btn"
            onClick={() => setShowTestTool(!showTestTool)}
            title="Toggle test tool"
          >
            🧪
          </button>
        </div>
      </header>

      <main className="app-main">
        {showTestTool && (
          <div className="test-tool-container">
            <TestDownloader />
          </div>
        )}
        {(!isMobile || activeTab === "upload") && (
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
                      <span className="upload-stats">
                        ({uploadStats.completed}/{uploadStats.total})
                      </span>
                    )}
                  </h3>
                  <div className="upload-actions">
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

                {isUploading && uploadStats.totalSize > 0 && (
                  <div className="overall-progress">
                    <div className="progress-info">
                      <span>Overall Progress</span>
                      <span>{getOverallProgress()}%</span>
                    </div>
                    <div className="upload-progress-bar">
                      <div
                        className="upload-progress-fill"
                        style={{ width: `${getOverallProgress()}%` }}
                      />
                    </div>
                  </div>
                )}

                <UploadProgress uploadItems={uploadItems} />
              </div>
            )}
          </div>
        )}

        {(!isMobile || activeTab === "files") && (
          <div className="files-section">
            <FileList
              files={files}
              onDownload={downloadFile}
              onBulkDownload={downloadFilesAsZip}
              onRefresh={loadFiles}
              isLoading={isLoading}
            />
          </div>
        )}
      </main>

      {isMobile && (
        <div className="mobile-action-bar">
          <button
            className={`mobile-action-button ${activeTab === "upload" ? "active" : ""}`}
            onClick={() => setActiveTab("upload")}
          >
            <span className="mobile-action-icon">📤</span>
            <span>Upload</span>
          </button>
          <button
            className={`mobile-action-button ${activeTab === "files" ? "active" : ""}`}
            onClick={() => setActiveTab("files")}
          >
            <span className="mobile-action-icon">📂</span>
            <span>Files {files.length > 0 && `(${files.length})`}</span>
          </button>
          {showTestTool && (
            <button
              className={`mobile-action-button ${activeTab === "test" ? "active" : ""}`}
              onClick={() => setActiveTab("test")}
            >
              <span className="mobile-action-icon">🧪</span>
              <span>Test</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
