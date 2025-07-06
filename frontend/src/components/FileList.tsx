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
  onRefresh,
  isLoading = false,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isCreatingZip, setIsCreatingZip] = useState(false);

  // Clear selection when files change
  useEffect(() => {
    setSelectedFiles(new Set());
  }, [files]);

  const toggleFileSelection = (fileKey: string) => {
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

  const isAllSelected = selectedFiles.size === files.length && files.length > 0;
  const isIndeterminate =
    selectedFiles.size > 0 && selectedFiles.size < files.length;

  const handleDownload = async () => {
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
                onClick={onRefresh}
                className="refresh-btn"
                title="Refresh file list"
                disabled={isLoading}
              >
                {isLoading ? "⏳" : "🔄"}
              </button>
            </div>
          </div>

          <div className="file-list-selection-header">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={isAllSelected}
                ref={(input) => {
                  if (input) input.indeterminate = isIndeterminate;
                }}
                onChange={toggleSelectAll}
                disabled={isLoading}
              />
              <span className="checkmark"></span>
              <span className="select-all-text">
                {isAllSelected ? "Deselect all" : "Select all"}
              </span>
            </label>
          </div>

          <div className="file-list">
            {files.map((file) => (
              <div
                key={file.key}
                className={`file-item ${selectedFiles.has(file.key) ? "selected" : ""}`}
              >
                <div className="file-item-content">
                  <label className="checkbox-container">
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(file.key)}
                      onChange={() => toggleFileSelection(file.key)}
                      disabled={isLoading}
                    />
                    <span className="checkmark"></span>
                  </label>

                  <div className="file-icon">{getFileIcon(file.name)}</div>

                  <div className="file-info">
                    <div className="file-name" title={file.name}>
                      {file.name}
                    </div>
                    <div className="file-details">
                      <span className="file-size">
                        {formatFileSize(file.size || 0)}
                      </span>
                      <span className="file-date">
                        {file.lastModified
                          ? formatDate(file.lastModified)
                          : "Unknown"}
                      </span>
                    </div>
                  </div>

                  <div className="file-actions">
                    <button
                      onClick={() => onDownload(file)}
                      className="download-btn"
                      title={`Download ${file.name}`}
                    >
                      ⬇️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
