import { config } from "../config";

// Default request timeout in milliseconds
const DEFAULT_TIMEOUT = 30000;

/**
 * Error class for fetch timeouts
 */
class TimeoutError extends Error {
  constructor(message = "Request timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Apply timeout to a fetch request
 * @param promise - The fetch promise
 * @param timeout - Timeout duration in milliseconds
 */
const withTimeout = <T>(promise: Promise<T>, timeout: number): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError());
    }, timeout);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((reason) => {
        clearTimeout(timer);
        reject(reason);
      });
  });
};

/**
 * Custom fetch client with base URL, timeout, and error handling
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @param timeout - Optional timeout override
 */
export async function fetchClient<T = any>(
  url: string,
  options: RequestInit = {},
  timeout: number = DEFAULT_TIMEOUT,
): Promise<T> {
  // Determine if the URL is absolute or relative
  const isAbsoluteUrl = /^https?:\/\//.test(url);
  const fullUrl = isAbsoluteUrl ? url : `${config.api.baseUrl}${url}`;

  try {
    // Apply timeout to the fetch call
    const response = await withTimeout(
      fetch(fullUrl, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      }),
      timeout,
    );

    // Handle HTTP errors
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage: string;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage =
          errorJson.error ||
          errorJson.message ||
          `HTTP error ${response.status}`;
      } catch {
        errorMessage = errorText || `HTTP error ${response.status}`;
      }
      throw new Error(errorMessage);
    }

    // Handle empty responses
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return (await response.json()) as T;
    } else {
      return (await response.text()) as unknown as T;
    }
  } catch (error) {
    if (error instanceof TimeoutError) {
      throw new Error(`Request to ${fullUrl} timed out after ${timeout}ms`);
    }
    throw error;
  }
}

/**
 * Upload progress event type
 */
export interface ProgressEvent {
  loaded: number;
  total?: number;
}

/**
 * Upload a file or blob with progress tracking
 */
export async function uploadWithProgress(
  url: string,
  data: Blob | File,
  contentType?: string,
  onProgress?: (progress: ProgressEvent) => void,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    // Use XMLHttpRequest for upload progress tracking
    const xhr = new XMLHttpRequest();

    // Set dynamic timeout based on file size - longer for larger files
    // Base timeout of 30 seconds + 1 second per MB with a maximum of 4 hours
    const fileSizeMB = data.size / (1024 * 1024);
    const dynamicTimeoutMs = Math.min(
      DEFAULT_TIMEOUT + fileSizeMB * 1000, // 1 second per MB
      4 * 60 * 60 * 1000, // max 4 hours
    );
    xhr.timeout = dynamicTimeoutMs;

    // Track last progress event time to detect stalled uploads
    let lastProgressTime = Date.now();
    let uploadStarted = false;
    let uploadedBytes = 0;
    const stallCheckInterval = 30000; // 30 seconds

    // Stall detection - check every 30 seconds for progress
    const stallDetectionInterval = setInterval(() => {
      if (!uploadStarted) return; // Don't check before upload starts

      // If no progress for 2 minutes, consider the upload stalled
      const stallThreshold = 2 * 60 * 1000; // 2 minutes
      if (Date.now() - lastProgressTime > stallThreshold) {
        clearInterval(stallDetectionInterval);
        xhr.abort();
        reject(
          new Error(
            `Upload stalled - no progress detected for 2 minutes (${uploadedBytes} bytes uploaded)`,
          ),
        );
      }
    }, stallCheckInterval);

    // Also monitor connection state
    const connectionChecker = setInterval(() => {
      if (!navigator.onLine && uploadStarted) {
        clearInterval(connectionChecker);
        clearInterval(stallDetectionInterval);
        xhr.abort();
        reject(new Error("Internet connection lost during upload"));
      }
    }, 5000); // Check every 5 seconds

    // Setup progress tracking
    if (onProgress) {
      xhr.upload.addEventListener("progress", (event) => {
        // Mark upload as started once we get the first progress event
        if (!uploadStarted) uploadStarted = true;

        // Update tracking variables for stall detection
        lastProgressTime = Date.now();
        uploadedBytes = event.loaded;

        onProgress({
          loaded: event.loaded,
          total: event.total,
        });
      });
    }

    // Setup completion and error handlers
    xhr.addEventListener("load", () => {
      clearInterval(stallDetectionInterval);
      clearInterval(connectionChecker);

      if (xhr.status >= 200 && xhr.status < 300) {
        // Create a Response object to match fetch API
        const responseHeaders = new Headers();
        const rawHeaders = xhr.getAllResponseHeaders().split("\r\n");

        rawHeaders.forEach((line) => {
          const parts = line.split(": ");
          if (parts[0]) {
            responseHeaders.append(parts[0], parts[1]);
          }
        });

        const response = new Response(xhr.response, {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: responseHeaders,
        });

        resolve(response);
      } else {
        reject(new Error(`HTTP error ${xhr.status}: ${xhr.statusText}`));
      }
    });

    xhr.addEventListener("error", () => {
      clearInterval(stallDetectionInterval);
      clearInterval(connectionChecker);
      reject(new Error("Network error during upload"));
    });

    xhr.addEventListener("timeout", () => {
      clearInterval(stallDetectionInterval);
      clearInterval(connectionChecker);
      reject(new Error(`Upload timed out after ${xhr.timeout / 1000}s`));
    });

    xhr.addEventListener("abort", () => {
      clearInterval(stallDetectionInterval);
      clearInterval(connectionChecker);
      reject(new Error("Upload was aborted"));
    });

    // Check connection before starting upload
    if (!navigator.onLine) {
      clearInterval(stallDetectionInterval);
      clearInterval(connectionChecker);
      reject(new Error("No internet connection detected"));
      return;
    }

    // Send the request
    xhr.open("PUT", url, true);

    if (contentType) {
      xhr.setRequestHeader("Content-Type", contentType);
    } else if (data instanceof File) {
      xhr.setRequestHeader(
        "Content-Type",
        data.type || "application/octet-stream",
      );
    }

    try {
      xhr.send(data);
      uploadStarted = true; // Mark upload as started
    } catch (error) {
      clearInterval(stallDetectionInterval);
      clearInterval(connectionChecker);
      reject(error);
    }
  });
}
