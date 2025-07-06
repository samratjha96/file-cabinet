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

    // Setup progress tracking
    if (onProgress) {
      xhr.upload.addEventListener("progress", (event) => {
        onProgress({
          loaded: event.loaded,
          total: event.total,
        });
      });
    }

    // Setup completion and error handlers
    xhr.addEventListener("load", () => {
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
        reject(new Error(`HTTP error ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

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

    xhr.send(data);
  });
}
