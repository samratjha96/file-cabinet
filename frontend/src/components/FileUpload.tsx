import { useState, useRef, type FC } from "react";
import { config } from "../config";

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  isUploading: boolean;
}

export const FileUpload: FC<FileUploadProps> = ({
  onFilesSelected,
  isUploading,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadMode, setUploadMode] = useState<"files" | "folder">("files");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
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
    setIsDragOver(false);

    const items = Array.from(e.dataTransfer.items);
    const files: File[] = [];

    // Handle folder drops
    if (items.length > 0 && 'webkitGetAsEntry' in items[0]) {
      const entries = items.map(item => (item as any).webkitGetAsEntry()).filter(entry => entry);
      
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
  };

  const handleFiles = (files: File[]) => {
    // Filter files by size, name, and other validity checks
    const validFiles = files.filter((file) => {
      // Check if file has a valid name
      if (!file.name || file.name.trim() === '') {
        console.warn(`Skipping file with empty name`);
        return false;
      }
      
      // Skip system files and hidden files that might cause issues
      if (file.name.startsWith('.DS_Store') || file.name.startsWith('Thumbs.db')) {
        console.warn(`Skipping system file: ${file.name}`);
        return false;
      }
      
      // Check if file has valid size (skip empty files)
      if (file.size === 0) {
        console.warn(`Skipping empty file: ${file.name}`);
        return false;
      }
      
      // Check file size limit
      const isValidSize = file.size <= config.upload.maxFileSize;
      if (!isValidSize) {
        console.warn(`File ${file.name} is too large: ${file.size} bytes (max: ${config.upload.maxFileSize} bytes)`);
        return false;
      }

      return true;
    });

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
      
      // Show info about filtered files
      const filteredCount = files.length - validFiles.length;
      if (filteredCount > 0) {
        console.log(`Filtered out ${filteredCount} invalid files (empty files, system files, or oversized files)`);
      }
    } else if (files.length > 0) {
      // Show warning if all files were filtered out
      alert(`All selected files were invalid. Common issues: empty files, system files, or files larger than ${(config.upload.maxFileSize / (1024 * 1024 * 1024)).toFixed(1)}GB.`);
    }
  };

  const handleClick = () => {
    if (uploadMode === "folder") {
      folderInputRef.current?.click();
    } else {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="file-upload-container">
      <div
        className={`file-upload-area ${isDragOver ? "drag-over" : ""} ${isUploading ? "uploading" : ""}`}
        onDragOver={handleDragOver}
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
          <div className="file-upload-mode-toggle">
            <button
              type="button"
              className={`mode-btn ${uploadMode === "files" ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setUploadMode("files");
              }}
            >
              📄 Files
            </button>
            <button
              type="button"
              className={`mode-btn ${uploadMode === "folder" ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setUploadMode("folder");
              }}
            >
              📁 Folder
            </button>
          </div>
          
          <div className="file-upload-icon">
            {uploadMode === "folder" ? "📁" : "📄"}
          </div>
          <h3>
            Drop {uploadMode === "folder" ? "folders" : "files"} here or click to select
          </h3>
          <p>
            Supports: <strong>All file types</strong> including images, videos, documents, archives, and more
          </p>
          <p>
            Max file size: <strong>{(config.upload.maxFileSize / (1024 * 1024 * 1024)).toFixed(1)}GB</strong>
          </p>
          <p>
            {uploadMode === "folder" ? "Upload entire folders with all their contents" : "Upload multiple files in bulk"}
          </p>
        </div>
      </div>
    </div>
  );
};
