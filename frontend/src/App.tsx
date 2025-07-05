import { useState, useEffect } from "react";
import { FileUpload } from "./components/FileUpload";
import { FileList } from "./components/FileList";
import { UploadProgress } from "./components/UploadProgress";
import { apiService, type FileItem } from "./api";
import "./App.css";

export interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
}

function App() {
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Load files on component mount
  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      const response = await apiService.getFiles();
      setFiles(response.files);
    } catch (error) {
      console.error("Error loading files:", error);
    }
  };

  const handleFilesSelected = (selectedFiles: File[]) => {
    const baseTimestamp = Date.now();
    const newUploadItems: UploadItem[] = selectedFiles.map((file, index) => ({
      id: `${baseTimestamp}-${index}-${file.name}-${file.size}`,
      file,
      progress: 0,
      status: "pending",
    }));

    setUploadItems((prev) => [...prev, ...newUploadItems]);
    startUploads(newUploadItems);
  };

  const startUploads = async (items: UploadItem[]) => {
    setIsUploading(true);

    const uploadPromises = items.map(async (item) => {
      try {
        // Update status to uploading
        setUploadItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: "uploading" } : i,
          ),
        );

        // Upload file with smart upload (automatically chooses single or multipart)
        await apiService.smartUpload(
          item.file,
          (progress) => {
            setUploadItems((prev) =>
              prev.map((i) => (i.id === item.id ? { ...i, progress } : i)),
            );
          },
        );

        // Mark as completed
        setUploadItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: "completed", progress: 100 } : i,
          ),
        );
      } catch (error) {
        console.error("Upload error:", error);
        
        // Extract more detailed error information
        let errorMessage = "Upload failed";
        if (error instanceof Error) {
          errorMessage = error.message;
          
          // If it's an axios error, try to get the backend error message
          if ('response' in error && error.response && typeof error.response === 'object') {
            const response = error.response as any;
            if (response.data && response.data.error) {
              errorMessage = `Backend error: ${response.data.error}`;
            }
            console.error("Backend response:", response.data);
          }
        }
        
        setUploadItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: "error",
                  error: errorMessage,
                }
              : i,
          ),
        );
      }
    });

    await Promise.all(uploadPromises);
    setIsUploading(false);

    // Refresh file list after uploads complete
    setTimeout(() => {
      loadFiles();
    }, 1000);
  };

  const clearCompletedUploads = () => {
    setUploadItems((prev) =>
      prev.filter((item) => item.status !== "completed"),
    );
  };

  const handleDownload = async (fileItem: FileItem) => {
    try {
      const downloadResponse = await apiService.getDownloadUrl(fileItem.key);
      await apiService.downloadFile(
        downloadResponse.downloadUrl,
        fileItem.name,
      );
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>📁 File Cabinet</h1>
        <p>Upload and manage your files securely</p>
      </header>

      <main className="app-main">
        <div className="upload-section">
          <FileUpload
            onFilesSelected={handleFilesSelected}
            isUploading={isUploading}
          />

          {uploadItems.length > 0 && (
            <div className="upload-progress-section">
              <div className="upload-progress-header">
                <h3>Upload Progress</h3>
                {uploadItems.some((item) => item.status === "completed") && (
                  <button
                    onClick={clearCompletedUploads}
                    className="clear-completed-btn"
                  >
                    Clear Completed
                  </button>
                )}
              </div>
              <UploadProgress
                uploadItems={uploadItems}
                formatFileSize={formatFileSize}
              />
            </div>
          )}
        </div>

        <div className="files-section">
          <FileList
            files={files}
            onDownload={handleDownload}
            onRefresh={loadFiles}
            formatFileSize={formatFileSize}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
