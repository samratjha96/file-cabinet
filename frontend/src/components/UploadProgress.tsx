import { type FC } from "react";
import { type UploadItem } from "../hooks/useUpload";
import { formatFileSize } from "../utils";

interface UploadProgressProps {
  uploadItems: UploadItem[];
}

export const UploadProgress: FC<UploadProgressProps> = ({ uploadItems }) => {
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
      {uploadItems.map((item: UploadItem) => (
        <div key={item.id} className="upload-item">
          <div className="upload-item-header">
            <span className={`upload-status-icon ${item.status}`}>
              {getStatusIcon(item.status)}
            </span>
            <span className="upload-filename">{item.file.name}</span>
            <span className="upload-filesize">
              {formatFileSize(item.file.size)}
            </span>
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
          </div>
        </div>
      ))}
    </div>
  );
};
