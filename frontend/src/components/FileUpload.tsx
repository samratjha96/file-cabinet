import { useState, useRef, type FC } from 'react';
import { config } from '../config';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  isUploading: boolean;
}

export const FileUpload: FC<FileUploadProps> = ({ onFilesSelected, isUploading }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
  };

  const handleFiles = (files: File[]) => {
    // Filter files by type and size
    const validFiles = files.filter(file => {
      const isValidType = config.upload.supportedFileTypes.includes(file.type);
      const isValidSize = file.size <= config.upload.maxFileSize;
      
      if (!isValidType) {
        console.warn(`File ${file.name} has unsupported type: ${file.type}`);
      }
      if (!isValidSize) {
        console.warn(`File ${file.name} is too large: ${file.size} bytes`);
      }
      
      return isValidType && isValidSize;
    });

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="file-upload-container">
      <div
        className={`file-upload-area ${isDragOver ? 'drag-over' : ''} ${isUploading ? 'uploading' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={config.upload.supportedFileTypes.join(',')}
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />
        
        <div className="file-upload-content">
          <div className="file-upload-icon">📁</div>
          <h3>Drop files here or click to select</h3>
          <p>
            Supports: Images (JPEG, PNG, GIF, WebP) and Videos (MP4, MOV, WebM, AVI)
          </p>
          <p>
            Max file size: {Math.round(config.upload.maxFileSize / (1024 * 1024))}MB
          </p>
        </div>
      </div>
    </div>
  );
}; 