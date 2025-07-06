import { type FC, useState, useEffect } from "react";
import { type UploadItem } from "../hooks/useUpload";
import { formatFileSize } from "../utils";

interface UploadProgressProps {
  uploadItems: UploadItem[];
}

export const UploadProgress: FC<UploadProgressProps> = ({ uploadItems }) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // Handle window resize for responsive layout
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleItemExpand = (itemId: string) => {
    if (expandedItem === itemId) {
      setExpandedItem(null);
    } else {
      setExpandedItem(itemId);
    }
  };

  const getStatusIcon = (status: UploadItem["status"]) => {
    switch (status) {
      case "pending":
        return "⏳";
      case "uploading":
        return "📤";
      case "completed":
        return "✅";
      case "error":
        return "❌";
      default:
        return "📁";
    }
  };

  return (
    <div className="upload-progress-container">
      {uploadItems.map((item: UploadItem) => {
        const isExpanded = expandedItem === item.id;
        const fileName = item.file.name;
        // Truncate filename for mobile display
        const displayName =
          isMobile && fileName.length > 20 && !isExpanded
            ? fileName.substring(0, 15) +
              "..." +
              fileName.substring(fileName.lastIndexOf("."))
            : fileName;

        return (
          <div
            key={item.id}
            className={`upload-item ${isExpanded ? "expanded" : ""}`}
            onClick={() => isMobile && toggleItemExpand(item.id)}
          >
            <div className="upload-item-header">
              <span className={`upload-status-icon ${item.status}`}>
                {getStatusIcon(item.status)}
              </span>
              <span className="upload-filename" title={fileName}>
                {displayName}
              </span>
              <span className="upload-filesize">
                {formatFileSize(item.file.size)}
              </span>
              {isMobile && (
                <button
                  className="upload-expand-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleItemExpand(item.id);
                  }}
                >
                  {isExpanded ? "▲" : "▼"}
                </button>
              )}
            </div>

            <div className="upload-item-details">
              <div className="upload-progress-bar">
                <div
                  className={`upload-progress-fill ${item.status}`}
                  style={{
                    width: `${item.progress}%`,
                  }}
                />
              </div>

              <div className="upload-status-details">
                <span className="upload-progress-text">
                  {item.status === "completed"
                    ? "Completed"
                    : item.status === "error"
                      ? "Failed"
                      : item.status === "uploading"
                        ? `Uploading: ${Math.round(item.progress)}%`
                        : "Waiting to upload..."}
                </span>

                {item.error && (
                  <span className="upload-error-message">{item.error}</span>
                )}
              </div>

              {isMobile && isExpanded && (
                <div className="upload-item-expanded-details">
                  <div className="upload-detail-row">
                    <span className="detail-label">File:</span>
                    <span className="detail-value">{fileName}</span>
                  </div>
                  <div className="upload-detail-row">
                    <span className="detail-label">Size:</span>
                    <span className="detail-value">
                      {formatFileSize(item.file.size)}
                    </span>
                  </div>
                  <div className="upload-detail-row">
                    <span className="detail-label">Type:</span>
                    <span className="detail-value">
                      {item.file.type || "Unknown"}
                    </span>
                  </div>
                  <div className="upload-detail-row">
                    <span className="detail-label">Status:</span>
                    <span className="detail-value">{item.status}</span>
                  </div>
                  {item.error && (
                    <div className="upload-detail-row error">
                      <span className="detail-label">Error:</span>
                      <span className="detail-value">{item.error}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
