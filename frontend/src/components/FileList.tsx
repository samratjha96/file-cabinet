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

    // Images
    if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "tiff", "ico"].includes(extension || "")) {
      return "🖼️";
    }
    
    // Videos
    if (["mp4", "mov", "webm", "avi", "mkv", "flv", "wmv", "m4v", "3gp"].includes(extension || "")) {
      return "🎬";
    }
    
    // Audio
    if (["mp3", "wav", "flac", "aac", "ogg", "wma", "m4a"].includes(extension || "")) {
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
    if (["zip", "rar", "7z", "tar", "gz", "bz2", "xz"].includes(extension || "")) {
      return "📦";
    }
    
    // Code files
    if (["js", "ts", "jsx", "tsx", "html", "css", "scss", "py", "java", "cpp", "c", "cs", "php", "rb", "go", "rs", "swift"].includes(extension || "")) {
      return "💻";
    }
    
    // Executables
    if (["exe", "msi", "deb", "rpm", "dmg", "pkg", "app"].includes(extension || "")) {
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
