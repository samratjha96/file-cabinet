import { type FC } from "react";
import { type UploadItem } from "../App";

interface UploadProgressProps {
  uploadItems: UploadItem[];
  formatFileSize: (bytes: number) => string;
}

export const UploadProgress: FC<UploadProgressProps> = ({
  uploadItems,
  formatFileSize,
}) => {
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

  const getStatusColor = (status: UploadItem["status"]) => {
    switch (status) {
      case "pending":
        return "#ffa500";
      case "uploading":
        return "#2196f3";
      case "completed":
        return "#4caf50";
      case "error":
        return "#f44336";
      default:
        return "#9e9e9e";
    }
  };

  return (
    <div className="upload-progress-container">
      {uploadItems.map((item) => (
        <div key={item.id} className="upload-item">
          <div className="upload-item-header">
            <span className="upload-status-icon">
              {getStatusIcon(item.status)}
            </span>
            <span className="upload-filename">{item.file.name}</span>
            <span className="upload-filesize">
              {formatFileSize(item.file.size)}
            </span>
          </div>

          <div className="upload-progress-bar">
            <div
              className="upload-progress-fill"
              style={{
                width: `${item.progress}%`,
                backgroundColor: getStatusColor(item.status),
              }}
            />
          </div>

          <div className="upload-item-details">
            <span className="upload-progress-text">
              {item.status === "completed"
                ? "Completed"
                : item.status === "error"
                  ? "Failed"
                  : item.status === "uploading"
                    ? `${Math.round(item.progress)}%`
                    : "Pending"}
            </span>

            {item.error && (
              <span className="upload-error-message">{item.error}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
