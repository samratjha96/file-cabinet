import { useState, useCallback } from "react";
import { apiService, type FileItem } from "../api";

export const useFiles = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiService.getFiles();
      setFiles(response.files);
    } catch (error) {
      console.error("Error loading files:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
        alert(
          "Unable to load files. Please check your internet connection and try again.",
        );
      } else {
        alert("Unable to load files. Please refresh the page and try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const downloadFile = useCallback(async (fileItem: FileItem) => {
    try {
      const downloadResponse = await apiService.getDownloadUrl(fileItem.key);
      await apiService.downloadFile(
        downloadResponse.downloadUrl,
        fileItem.name,
      );
    } catch (error) {
      console.error("Download error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Download failed";
      alert(`Unable to download file: ${errorMessage}`);
    }
  }, []);

  return {
    files,
    isLoading,
    loadFiles,
    downloadFile,
  };
};
