import { useState, useCallback } from "react";
import { apiService } from "../api";
import { generateId, isValidFile } from "../utils";

export interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
  uploadMethod?: "single" | "multipart";
}

export const useUpload = () => {
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Threshold for using multipart upload (5MB)
  const MULTIPART_THRESHOLD = 5 * 1024 * 1024;

  const addFiles = useCallback((files: File[]) => {
    const validFiles = files.filter(isValidFile);

    if (validFiles.length === 0) return;

    const newUploadItems: UploadItem[] = validFiles.map((file) => ({
      id: generateId(),
      file,
      progress: 0,
      status: "pending",
      uploadMethod: file.size > MULTIPART_THRESHOLD ? "multipart" : "single",
    }));

    setUploadItems((prev) => [...prev, ...newUploadItems]);
    return newUploadItems;
  }, []);

  const uploadSingleFile = useCallback(async (item: UploadItem) => {
    try {
      const uploadResponse = await apiService.getUploadUrl(
        item.file.name,
        item.file.type || "application/octet-stream",
      );

      await apiService.uploadFile(
        uploadResponse.uploadUrl,
        item.file,
        (progress) => {
          setUploadItems((prev) =>
            prev.map((prevItem) =>
              prevItem.id === item.id ? { ...prevItem, progress } : prevItem,
            ),
          );
        },
      );

      // Mark as completed
      setUploadItems((prev) =>
        prev.map((prevItem) =>
          prevItem.id === item.id
            ? { ...prevItem, status: "completed", progress: 100 }
            : prevItem,
        ),
      );
    } catch (error) {
      console.error(`Single file upload error for ${item.file.name}:`, error);
      setUploadItems((prev) =>
        prev.map((prevItem) =>
          prevItem.id === item.id
            ? {
                ...prevItem,
                status: "error",
                error: error instanceof Error ? error.message : "Upload failed",
              }
            : prevItem,
        ),
      );
    }
  }, []);

  const uploadMultipartFile = useCallback(async (item: UploadItem) => {
    try {
      await apiService.uploadFileMultipart(item.file, (progress) => {
        setUploadItems((prev) =>
          prev.map((prevItem) =>
            prevItem.id === item.id ? { ...prevItem, progress } : prevItem,
          ),
        );
      });

      // Mark as completed
      setUploadItems((prev) =>
        prev.map((prevItem) =>
          prevItem.id === item.id
            ? { ...prevItem, status: "completed", progress: 100 }
            : prevItem,
        ),
      );
    } catch (error) {
      console.error(`Multipart upload error for ${item.file.name}:`, error);
      setUploadItems((prev) =>
        prev.map((prevItem) =>
          prevItem.id === item.id
            ? {
                ...prevItem,
                status: "error",
                error: error instanceof Error ? error.message : "Upload failed",
              }
            : prevItem,
        ),
      );
    }
  }, []);

  const startUploads = useCallback(
    async (items: UploadItem[]) => {
      setIsUploading(true);

      // Update all items to uploading status
      setUploadItems((prev) =>
        prev.map((item) =>
          items.find((newItem) => newItem.id === item.id)
            ? { ...item, status: "uploading" as const }
            : item,
        ),
      );

      // Upload files concurrently with method selection
      const uploadPromises = items.map(async (item) => {
        if (item.uploadMethod === "multipart") {
          return uploadMultipartFile(item);
        } else {
          return uploadSingleFile(item);
        }
      });

      await Promise.allSettled(uploadPromises);
      setIsUploading(false);
    },
    [uploadSingleFile, uploadMultipartFile],
  );

  const retryFailedUploads = useCallback(() => {
    const failedItems = uploadItems.filter((item) => item.status === "error");
    if (failedItems.length > 0) {
      startUploads(failedItems);
    }
  }, [uploadItems, startUploads]);

  const clearCompletedUploads = useCallback(() => {
    setUploadItems((prev) =>
      prev.filter((item) => item.status !== "completed"),
    );
  }, []);

  const clearAllUploads = useCallback(() => {
    setUploadItems([]);
  }, []);

  // Calculate upload stats
  const uploadStats = {
    total: uploadItems.length,
    completed: uploadItems.filter((item) => item.status === "completed").length,
    failed: uploadItems.filter((item) => item.status === "error").length,
    multipart: uploadItems.filter((item) => item.uploadMethod === "multipart")
      .length,
    single: uploadItems.filter((item) => item.uploadMethod === "single").length,
    totalSize: uploadItems.reduce((sum, item) => sum + item.file.size, 0),
    uploadedSize: uploadItems.reduce((sum, item) => {
      if (item.status === "completed") return sum + item.file.size;
      if (item.status === "uploading")
        return sum + (item.file.size * item.progress) / 100;
      return sum;
    }, 0),
  };

  return {
    uploadItems,
    isUploading,
    uploadStats,
    addFiles,
    startUploads,
    retryFailedUploads,
    clearCompletedUploads,
    clearAllUploads,
  };
};
