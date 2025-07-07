import { useState, useCallback, useEffect, useRef } from "react";
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

  // Keep active uploads in a ref to access from event listeners
  const activeUploadsRef = useRef<{ [id: string]: boolean }>({});

  // Set up beforeunload handler to warn when leaving during active uploads
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasActiveUploads = Object.keys(activeUploadsRef.current).length > 0;

      if (isUploading && hasActiveUploads) {
        // Show browser alert about unsaved changes
        const message =
          "Warning: You have uploads in progress. Leaving this page will interrupt these uploads. Are you sure you want to leave?";
        e.returnValue = message; // Standard for most browsers
        return message; // For some older browsers
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isUploading]);

  // Threshold for using multipart upload (5MB)
  const MULTIPART_THRESHOLD = 5 * 1024 * 1024;

  const addFiles = useCallback((files: File[]) => {
    const validFiles = files.filter((file) => isValidFile(file));

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

      // Track active uploads in ref for beforeunload handler
      const newActiveUploads = { ...activeUploadsRef.current };
      items.forEach((item) => {
        newActiveUploads[item.id] = true;
      });
      activeUploadsRef.current = newActiveUploads;

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

      const results = await Promise.allSettled(uploadPromises);

      // Remove completed uploads from activeUploads
      const updatedActiveUploads = { ...activeUploadsRef.current };
      items.forEach((item) => {
        delete updatedActiveUploads[item.id];
      });
      activeUploadsRef.current = updatedActiveUploads;

      const hasActive = Object.keys(updatedActiveUploads).length > 0;
      if (!hasActive) {
        setIsUploading(false);
      }

      // Check for failures and report errors
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        console.error(`${failures.length} uploads failed:`, failures);
      }
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
