import { useState, useRef, type FC, useEffect } from "react";
import { config } from "../config";
import { isValidFile } from "../utils";

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  isUploading: boolean;
}

export const FileUpload: FC<FileUploadProps> = ({
  onFilesSelected,
  isUploading,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [showSelectionDialog, setShowSelectionDialog] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Handle window resize for responsive layout
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => prev + 1);
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => prev - 1);
    if (dragCounter <= 1) {
      setIsDragOver(false);
    }
  };

  const processEntry = async (entry: any): Promise<File[]> => {
    const files: File[] = [];

    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => {
        entry.file(resolve, reject);
      });
      files.push(file);
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const entries = await new Promise<any[]>((resolve, reject) => {
        reader.readEntries(resolve, reject);
      });

      for (const childEntry of entries) {
        const childFiles = await processEntry(childEntry);
        files.push(...childFiles);
      }
    }

    return files;
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDragCounter(0);

    const items = Array.from(e.dataTransfer.items);
    const files: File[] = [];

    // Handle folder drops
    if (items.length > 0 && "webkitGetAsEntry" in items[0]) {
      const entries = items
        .map((item) => (item as any).webkitGetAsEntry())
        .filter((entry) => entry);

      for (const entry of entries) {
        if (entry) {
          const entryFiles = await processEntry(entry);
          files.push(...entryFiles);
        }
      }
    } else {
      // Fallback to regular file handling
      files.push(...Array.from(e.dataTransfer.files));
    }

    handleFiles(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);

    // Clear input value to allow selecting the same files again
    if (e.target) {
      e.target.value = "";
    }
  };

  const handleFiles = (files: File[]) => {
    if (files.length === 0) return;

    // Use the enhanced utility function with max size and verbose logging
    const validFiles = files.filter((file) =>
      isValidFile(file, config.upload.maxFileSize, true),
    );

    if (validFiles.length > 0) {
      // Close the selection dialog since files are being uploaded
      setShowSelectionDialog(false);

      onFilesSelected(validFiles);

      // Show info about filtered files
      const filteredCount = files.length - validFiles.length;
      if (filteredCount > 0) {
        const message = `${validFiles.length} file${validFiles.length === 1 ? "" : "s"} selected. ${filteredCount} file${filteredCount === 1 ? "" : "s"} skipped (empty, system, or oversized files).`;
        console.log(message);

        // Show toast notification for mobile users
        if ("navigator" in window && "vibrate" in navigator) {
          (navigator as any).vibrate(100);
        }
      }
    } else if (files.length > 0) {
      // Show user-friendly error message
      const maxSizeGB = (
        config.upload.maxFileSize /
        (1024 * 1024 * 1024)
      ).toFixed(1);
      const errorMessage = `Unable to upload files. Common issues:\n\n• Files are too large (max ${maxSizeGB}GB each)\n• Files are empty or corrupted\n• System files (like .DS_Store)\n\nPlease try with different files.`;

      if (window.confirm(errorMessage + "\n\nWould you like to try again?")) {
        // Let user try again
        setTimeout(() => {
          setShowSelectionDialog(true);
        }, 100);
      }
    }
  };

  const handleClick = () => {
    if (isUploading) return;
    setShowSelectionDialog(true);
  };

  const handleSelectFiles = () => {
    setShowSelectionDialog(false);
    fileInputRef.current?.click();
  };

  const handleSelectFolders = () => {
    setShowSelectionDialog(false);
    folderInputRef.current?.click();
  };

  const handleCloseDialog = () => {
    setShowSelectionDialog(false);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const maxSizeFormatted = formatFileSize(config.upload.maxFileSize);

  return (
    <div className="file-upload-container">
      <div
        className={`file-upload-area ${isDragOver ? "drag-over" : ""} ${isUploading ? "uploading" : ""}`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInput}
          style={{ display: "none" }}
          accept="*/*"
        />

        <input
          ref={folderInputRef}
          type="file"
          {...({ webkitdirectory: "" } as any)}
          multiple
          onChange={handleFileInput}
          style={{ display: "none" }}
        />

        <div className="file-upload-content">
          <div className="file-upload-icon">{isUploading ? "⏳" : "📤"}</div>

          <h3>
            {isUploading
              ? "Uploading your files..."
              : isDragOver
                ? "Drop files here!"
                : isMobile
                  ? "Tap to upload files"
                  : "Select files or folders to upload"}
          </h3>

          {!isUploading && (
            <>
              {!isMobile && (
                <p>
                  <strong>Drag & drop</strong> files or folders, or{" "}
                  <strong>tap here</strong> to choose files
                </p>
              )}
              <p>
                <span className="upload-feature-icon">📁</span>
                <strong>All file types</strong> supported
              </p>
              <p>
                <span className="upload-feature-icon">📏</span>
                Max size: <strong>{maxSizeFormatted}</strong>
              </p>
              {!isMobile && (
                <p>
                  <span className="upload-feature-icon">🗂️</span>
                  <strong>Folder upload</strong> supported
                </p>
              )}
            </>
          )}

          {isUploading && (
            <p>Please wait while your files are being uploaded...</p>
          )}
        </div>
      </div>

      {/* Selection Dialog */}
      {showSelectionDialog && (
        <div className="selection-dialog-overlay" onClick={handleCloseDialog}>
          <div
            className="selection-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h4>Upload Files</h4>
            <div className="selection-options">
              <button className="selection-option" onClick={handleSelectFiles}>
                <span className="selection-icon">📄</span>
                <div>
                  <h5>Select Files</h5>
                  <p>Choose one or multiple files</p>
                </div>
              </button>

              <button
                className="selection-option"
                onClick={handleSelectFolders}
              >
                <span className="selection-icon">📁</span>
                <div>
                  <h5>Select Folder</h5>
                  <p>Upload an entire folder with all its contents</p>
                </div>
              </button>
            </div>
            <button className="selection-close" onClick={handleCloseDialog}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
