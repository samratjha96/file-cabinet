import { useState, useEffect, type FC } from "react";
import { type FileItem } from "../api";
import { formatFileSize } from "../utils";

interface FileListProps {
  files: FileItem[];
  onDownload: (file: FileItem) => void;
  onBulkDownload: (files: FileItem[], zipName: string) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export const FileList: FC<FileListProps> = ({
  files,
  onDownload,
  onBulkDownload,
  isLoading = false,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isCreatingZip, setIsCreatingZip] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  // Clear selection when files change
  useEffect(() => {
    setSelectedFiles(new Set());
  }, [files]);

  // Handle window resize for responsive layout
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleFileSelection = (fileKey: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }

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

  const toggleSelectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map((file) => file.key)));
    }
  };

  const toggleFileExpand = (fileKey: string) => {
    if (expandedFile === fileKey) {
      setExpandedFile(null);
    } else {
      setExpandedFile(fileKey);
    }
  };

  const isAllSelected = selectedFiles.size === files.length && files.length > 0;
  const handleDownload = async (event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }

    const selectedFileItems = files.filter((file) =>
      selectedFiles.has(file.key),
    );

    if (selectedFileItems.length === 0) return;

    if (selectedFileItems.length === 1) {
      // Single file download - use existing functionality
      onDownload(selectedFileItems[0]);
    } else {
      // Bulk download - create ZIP
      setIsCreatingZip(true);

      try {
        // Create timestamp for folder name
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19); // YYYY-MM-DDTHH-MM-SS format

        const zipName = `file-cabinet-download-${timestamp}`;

        // Use the parent's bulk download handler
        await onBulkDownload(selectedFileItems, zipName);

        // Clear selection after successful download
        setSelectedFiles(new Set());
      } catch (error) {
        console.error("Error creating ZIP:", error);
        // Could show user notification here
      } finally {
        setIsCreatingZip(false);
      }
    }
  };

  const handleSingleDownload = (file: FileItem, event: React.MouseEvent) => {
    event.stopPropagation();
    onDownload(file);
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split(".").pop()?.toLowerCase();

    // Images
    if (
      [
        "jpg",
        "jpeg",
        "png",
        "gif",
        "webp",
        "svg",
        "bmp",
        "tiff",
        "ico",
      ].includes(extension || "")
    ) {
      return "🖼️";
    }

    // Videos
    if (
      ["mp4", "mov", "webm", "avi", "mkv", "flv", "wmv", "m4v", "3gp"].includes(
        extension || "",
      )
    ) {
      return "🎬";
    }

    // Audio
    if (
      ["mp3", "wav", "flac", "aac", "ogg", "wma", "m4a"].includes(
        extension || "",
      )
    ) {
      return "🎵";
    }

    // Documents
    if (["pdf", "doc", "docx", "txt", "rtf", "odt"].includes(extension || "")) {
      return "📄";
    }

    // Presentations
    if (["ppt", "pptx", "odp"].includes(extension || "")) {
      return "📊";
    }

    // Spreadsheets
    if (["xls", "xlsx", "csv", "ods"].includes(extension || "")) {
      return "📈";
    }

    // Archives
    if (
      ["zip", "rar", "7z", "tar", "gz", "bz2", "xz"].includes(extension || "")
    ) {
      return "📦";
    }

    // Code files
    if (
      [
        "js",
        "ts",
        "jsx",
        "tsx",
        "html",
        "css",
        "scss",
        "py",
        "java",
        "cpp",
        "c",
        "cs",
        "php",
        "rb",
        "go",
        "rs",
        "swift",
      ].includes(extension || "")
    ) {
      return "💻";
    }

    // Executables
    if (
      ["exe", "msi", "deb", "rpm", "dmg", "pkg", "app"].includes(
        extension || "",
      )
    ) {
      return "⚙️";
    }

    return "📄";
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  return (
    <div className="file-list-container">
      <div className="file-list-header">
        <h3>
          📂 Your Files {files.length > 0 && `(${files.length})`}
          {isLoading && <span className="loading-indicator">Loading...</span>}
        </h3>
      </div>

      {files.length === 0 && !isLoading ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <p>No files uploaded yet</p>
          <p className="empty-state-subtitle">
            Upload some files to see them here
          </p>
        </div>
      ) : isLoading ? (
        <div className="loading-state">
          <div className="loading-icon">⏳</div>
          <p>Loading your files...</p>
        </div>
      ) : (
        <>
          <div className="file-list-toolbar">
            <div className="file-count">
              {files.length} {files.length === 1 ? "file" : "files"}
              {selectedFiles.size > 0 && (
                <span className="selected-count">
                  {" "}
                  • {selectedFiles.size} selected
                </span>
              )}
            </div>

            <div className="toolbar-actions">
              {selectedFiles.size > 0 && (
                <button
                  onClick={handleDownload}
                  className="download-selected-btn"
                  disabled={isCreatingZip}
                  title={
                    selectedFiles.size === 1
                      ? "Download file"
                      : "Download selected files as ZIP"
                  }
                >
                  {isCreatingZip ? "⏳" : "⬇️"}
                  {isCreatingZip
                    ? "Creating ZIP..."
                    : selectedFiles.size === 1
                      ? "Download"
                      : `Download ${selectedFiles.size} files`}
                </button>
              )}

              <button
                onClick={toggleSelectAll}
                className="select-all-btn"
                title={isAllSelected ? "Deselect all" : "Select all"}
              >
                {isAllSelected ? "☑️ Deselect All" : "✓ Select All"}
              </button>
            </div>
          </div>

          <div className="file-list">
            {files.map((file) => {
              const isSelected = selectedFiles.has(file.key);
              const isExpanded = expandedFile === file.key;

              return (
                <div
                  key={file.key}
                  className={`file-item ${isSelected ? "selected" : ""} ${isExpanded ? "expanded" : ""}`}
                  onClick={() =>
                    isMobile
                      ? toggleFileExpand(file.key)
                      : toggleFileSelection(file.key)
                  }
                >
                  <div className="file-item-main">
                    <div
                      className="checkbox-container"
                      onClick={(e) => toggleFileSelection(file.key, e)}
                    >
                      <input type="checkbox" checked={isSelected} readOnly />
                    </div>
                    <div className="file-icon">{getFileIcon(file.name)}</div>
                    <div className="file-info">
                      <div className="file-name">{file.name}</div>
                      <div className="file-details">
                        <span>{formatFileSize(file.size)}</span>
                        <span>{formatDate(new Date(file.lastModified))}</span>
                      </div>
                    </div>
                    <div className="file-actions">
                      <button
                        className="file-action-btn"
                        onClick={(e) => handleSingleDownload(file, e)}
                        title="Download file"
                      >
                        ⬇️
                      </button>
                      {isMobile && (
                        <button
                          className="file-action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFileExpand(file.key);
                          }}
                          title={isExpanded ? "Collapse" : "Expand"}
                        >
                          {isExpanded ? "▲" : "▼"}
                        </button>
                      )}
                    </div>
                  </div>

                  {isMobile && isExpanded && (
                    <div className="file-item-details">
                      <div className="file-detail-row">
                        <span className="detail-label">Size:</span>
                        <span className="detail-value">
                          {formatFileSize(file.size)}
                        </span>
                      </div>
                      <div className="file-detail-row">
                        <span className="detail-label">Uploaded:</span>
                        <span className="detail-value">
                          {formatDate(new Date(file.lastModified))}
                        </span>
                      </div>
                      <div className="file-detail-row">
                        <span className="detail-label">Type:</span>
                        <span className="detail-value">
                          {file.name.split(".").pop()?.toUpperCase() ||
                            "Unknown"}
                        </span>
                      </div>
                      <div className="file-detail-actions">
                        <button
                          className="file-detail-btn"
                          onClick={(e) => handleSingleDownload(file, e)}
                        >
                          ⬇️ Download
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
