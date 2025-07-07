import { useState, useCallback, useEffect, useRef } from "react";
import { apiService } from "../api";
import { generateId, isValidFile } from "../utils";

// Constants for upload configuration
const UPLOAD_CONFIG = {
  MULTIPART_THRESHOLD: 5 * 1024 * 1024, // 5MB
} as const;

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
  const activeUploadsRef = useRef<Set<string>>(new Set());

  // Warn user when leaving during active uploads
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUploading && activeUploadsRef.current.size > 0) {
        const message =
          "Warning: You have uploads in progress. Leaving this page will interrupt these uploads.";
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isUploading]);

  // Update upload item state
  const updateUploadItem = useCallback(
    (id: string, updates: Partial<UploadItem>) => {
      setUploadItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
      );
    },
    [],
  );

  // Add files to upload queue
  const addFiles = useCallback((files: File[]) => {
    const validFiles = files.filter((file) => isValidFile(file));
    if (validFiles.length === 0) return;

    const newUploadItems: UploadItem[] = validFiles.map((file) => ({
      id: generateId(),
      file,
      progress: 0,
      status: "pending",
      uploadMethod:
        file.size > UPLOAD_CONFIG.MULTIPART_THRESHOLD ? "multipart" : "single",
    }));

    setUploadItems((prev) => [...prev, ...newUploadItems]);
    return newUploadItems;
  }, []);

  // Upload a single file
  const uploadFile = useCallback(
    async (item: UploadItem) => {
      const { id, file, uploadMethod } = item;

      try {
        activeUploadsRef.current.add(id);
        updateUploadItem(id, { status: "uploading", progress: 0 });

        if (uploadMethod === "multipart") {
          await apiService.uploadFileMultipart(file, (progress) => {
            updateUploadItem(id, { progress });
          });
        } else {
          const uploadResponse = await apiService.getUploadUrl(
            file.name,
            file.type || "application/octet-stream",
          );

          await apiService.uploadFile(
            uploadResponse.uploadUrl,
            file,
            (progress) => {
              updateUploadItem(id, { progress });
            },
          );
        }

        updateUploadItem(id, { status: "completed", progress: 100 });
      } catch (error) {
        console.error(`Upload error for ${file.name}:`, error);
        const errorMessage =
          error instanceof Error ? error.message : "Upload failed";
        updateUploadItem(id, { status: "error", error: errorMessage });
      } finally {
        activeUploadsRef.current.delete(id);
      }
    },
    [updateUploadItem],
  );

  // Start uploads for multiple items
  const startUploads = useCallback(
    async (items: UploadItem[]) => {
      if (items.length === 0) return;

      setIsUploading(true);

      try {
        const uploadPromises = items.map(uploadFile);
        await Promise.allSettled(uploadPromises);
      } finally {
        // Only stop uploading when no active uploads remain
        if (activeUploadsRef.current.size === 0) {
          setIsUploading(false);
        }
      }
    },
    [uploadFile],
  );

  // Retry failed uploads
  const retryFailedUploads = useCallback(() => {
    const failedItems = uploadItems.filter((item) => item.status === "error");
    if (failedItems.length > 0) {
      startUploads(failedItems);
    }
  }, [uploadItems, startUploads]);

  // Clear completed uploads
  const clearCompletedUploads = useCallback(() => {
    setUploadItems((prev) =>
      prev.filter((item) => item.status !== "completed"),
    );
  }, []);

  // Clear all uploads
  const clearAllUploads = useCallback(() => {
    setUploadItems([]);
    activeUploadsRef.current.clear();
  }, []);

  // Calculate upload statistics
  const uploadStats = {
    total: uploadItems.length,
    completed: uploadItems.filter((item) => item.status === "completed").length,
    failed: uploadItems.filter((item) => item.status === "error").length,
    uploading: uploadItems.filter((item) => item.status === "uploading").length,
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
