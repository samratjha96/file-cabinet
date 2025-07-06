import { useState, useCallback } from "react";
import { apiService, type FileItem } from "../api";
import JSZip from "jszip";

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

  const downloadFilesAsZip = useCallback(
    async (fileItems: FileItem[], zipName: string) => {
      try {
        const zip = new JSZip();
        const folder = zip.folder(zipName);

        if (!folder) {
          throw new Error("Failed to create ZIP folder");
        }

        // Download all files as blobs and add to ZIP
        const downloadPromises = fileItems.map(async (fileItem) => {
          try {
            const downloadResponse = await apiService.getDownloadUrl(
              fileItem.key,
            );
            const response = await fetch(downloadResponse.downloadUrl);

            if (!response.ok) {
              throw new Error(
                `Failed to download file: ${response.statusText}`,
              );
            }

            const blob = await response.blob();

            // Add file to the timestamped folder inside the ZIP
            folder.file(fileItem.name, blob);

            return { success: true, fileName: fileItem.name };
          } catch (error) {
            console.error(`Error downloading file ${fileItem.name}:`, error);
            return { success: false, fileName: fileItem.name, error };
          }
        });

        const results = await Promise.all(downloadPromises);

        // Check if any downloads failed
        const failedDownloads = results.filter((result) => !result.success);
        if (failedDownloads.length > 0) {
          const failedNames = failedDownloads
            .map((result) => result.fileName)
            .join(", ");
          console.warn(`Failed to download files: ${failedNames}`);

          // Still create ZIP with successful downloads if any succeeded
          const successfulDownloads = results.filter(
            (result) => result.success,
          );
          if (successfulDownloads.length === 0) {
            throw new Error("All file downloads failed");
          }

          // Notify user about partial success
          alert(
            `Warning: ${failedDownloads.length} file(s) failed to download: ${failedNames}\n\nDownloading ${successfulDownloads.length} successful files as ZIP.`,
          );
        }

        // Generate ZIP file
        const zipBlob = await zip.generateAsync({
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 6 }, // Good balance of compression vs speed
        });

        // Trigger download
        const url = window.URL.createObjectURL(zipBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${zipName}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Bulk download error:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Bulk download failed";
        alert(`Unable to create ZIP download: ${errorMessage}`);
        throw error;
      }
    },
    [],
  );

  return {
    files,
    isLoading,
    loadFiles,
    downloadFile,
    downloadFilesAsZip,
  };
};
