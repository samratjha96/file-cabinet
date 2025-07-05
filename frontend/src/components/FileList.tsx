import { type FC } from "react";
import { type FileItem } from "../api";

interface FileListProps {
  files: FileItem[];
  onDownload: (file: FileItem) => void;
  onRefresh: () => void;
  formatFileSize: (bytes: number) => string;
}

export const FileList: FC<FileListProps> = ({
  files,
  onDownload,
  onRefresh,
  formatFileSize,
}) => {
  const getFileIcon = (fileName: string) => {
    const extension = fileName.split(".").pop()?.toLowerCase();

    switch (extension) {
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
      case "webp":
        return "🖼️";
      case "mp4":
      case "mov":
      case "webm":
      case "avi":
        return "🎬";
      default:
        return "📄";
    }
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
        <h3>📂 Uploaded Files ({files.length})</h3>
        <button
          onClick={onRefresh}
          className="refresh-btn"
          title="Refresh file list"
        >
          🔄
        </button>
      </div>

      {files.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <p>No files uploaded yet</p>
          <p className="empty-state-subtitle">
            Upload some files to see them here
          </p>
        </div>
      ) : (
        <div className="file-list">
          {files.map((file) => (
            <div key={file.key} className="file-item">
              <div className="file-item-content">
                <div className="file-icon">{getFileIcon(file.name)}</div>

                <div className="file-info">
                  <div className="file-name">{file.name}</div>
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
                    title="Download file"
                  >
                    ⬇️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
