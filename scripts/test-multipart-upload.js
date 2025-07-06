/**
 * Manual test script for verifying multipart upload functionality
 * 
 * Usage:
 * 1. Start the backend server: cd backend && npm run dev
 * 2. In a new terminal, run: node scripts/test-multipart-upload.js
 * 
 * This script creates a test file of a specified size and sends it
 * through the optimized multipart upload process, logging each step
 * along the way to verify the batch URL requests are working correctly.
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');  // Node.js environment needs node-fetch

// Configuration
const API_URL = 'http://localhost:3001'; // Adjust if your server is on a different port
const TEST_FILE_SIZE = 20 * 1024 * 1024; // 20MB file (to ensure multipart upload is triggered)
const TEST_FILE_PATH = path.join(__dirname, 'test-multipart-file.bin');

// Create a test file of specified size
function createTestFile(filePath, sizeInBytes) {
  console.log(`Creating test file (${sizeInBytes / (1024 * 1024)}MB)...`);
  
  // Create a buffer with random data
  const chunkSize = 1024 * 1024; // 1MB chunks for memory efficiency
  const fd = fs.openSync(filePath, 'w');
  
  let bytesWritten = 0;
  while (bytesWritten < sizeInBytes) {
    const buffer = Buffer.alloc(Math.min(chunkSize, sizeInBytes - bytesWritten));
    // Fill with random data
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
    fs.writeSync(fd, buffer);
    bytesWritten += buffer.length;
  }
  
  fs.closeSync(fd);
  console.log(`Test file created at: ${filePath}`);
}

/**
 * Helper function to handle HTTP errors
 */
async function handleResponse(response) {
  if (!response.ok) {
    let errorMessage;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || `HTTP error ${response.status}`;
    } catch {
      errorMessage = `HTTP error ${response.status}`;
    }
    throw new Error(errorMessage);
  }
  
  return response.json();
}

// Initiate multipart upload
async function initiateMultipartUpload(fileName, fileType, fileSize) {
  console.log(`Initiating multipart upload for ${fileName} (${fileSize} bytes)...`);
  
  try {
    const response = await fetch(`${API_URL}/api/initiate-multipart-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName,
        fileType,
        fileSize
      })
    });
    
    const data = await handleResponse(response);
    console.log('Multipart upload initiated:', data);
    return data;
  } catch (error) {
    console.error('Failed to initiate multipart upload:', error.message);
    throw error;
  }
}

// Get batch presigned URLs for parts
async function getPartUploadUrlsBatch(key, uploadId, partNumbers) {
  console.log(`Requesting batch presigned URLs for ${partNumbers.length} parts...`);
  
  try {
    const response = await fetch(`${API_URL}/api/upload-part-urls-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key,
        uploadId,
        partNumbers
      })
    });
    
    const data = await handleResponse(response);
    console.log(`Received ${data.partUrls.length} presigned URLs`);
    return data.partUrls;
  } catch (error) {
    console.error('Failed to get batch presigned URLs:', error.message);
    throw error;
  }
}

// Upload a part
async function uploadPart(uploadUrl, chunk) {
  try {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream'
      },
      body: chunk
    });
    
    if (!response.ok) {
      throw new Error(`Failed to upload part: HTTP ${response.status}`);
    }
    
    // Get the ETag header
    const etag = response.headers.get('etag') || response.headers.get('ETag');
    return etag;
  } catch (error) {
    console.error('Failed to upload part:', error.message);
    throw error;
  }
}

// Complete multipart upload
async function completeMultipartUpload(key, uploadId, parts) {
  console.log(`Completing multipart upload for ${key}...`);
  
  try {
    const response = await fetch(`${API_URL}/api/complete-multipart-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key,
        uploadId,
        parts
      })
    });
    
    const data = await handleResponse(response);
    console.log('Multipart upload completed:', data);
    return data;
  } catch (error) {
    console.error('Failed to complete multipart upload:', error.message);
    throw error;
  }
}

// Main execution
async function runMultipartUploadTest() {
  try {
    // Create test file if it doesn't exist
    if (!fs.existsSync(TEST_FILE_PATH)) {
      createTestFile(TEST_FILE_PATH, TEST_FILE_SIZE);
    }
    
    const fileStats = fs.statSync(TEST_FILE_PATH);
    const fileName = path.basename(TEST_FILE_PATH);
    const fileSize = fileStats.size;
    console.log(`Using test file: ${fileName} (${fileSize / (1024 * 1024)}MB)`);
    
    // Initiate multipart upload
    const { uploadId, key, chunkSize, totalParts } = await initiateMultipartUpload(
      fileName,
      'application/octet-stream',
      fileSize
    );
    
    console.log(`Upload initiated with ${totalParts} parts, chunk size: ${chunkSize / (1024 * 1024)}MB`);
    
    // Prepare parts for upload
    const parts = [];
    let batchSize = 3; // Default batch size
    
    // Calculate optimal batch size based on file size
    if (fileSize > 500 * 1024 * 1024) { // > 500MB
      batchSize = 5;
    } else if (fileSize < 50 * 1024 * 1024) { // < 50MB
      batchSize = 2;
    }
    
    console.log(`Using batch size: ${batchSize} for part uploads`);
    
    // Read and prepare file chunks
    const fileBuffer = fs.readFileSync(TEST_FILE_PATH);
    const chunks = [];
    
    for (let i = 0; i < totalParts; i++) {
      const partNumber = i + 1;
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, fileSize);
      const chunk = fileBuffer.slice(start, end);
      chunks.push({ partNumber, chunk });
    }
    
    // Process chunks in batches
    for (let i = 0; i < chunks.length; i += batchSize) {
      const currentBatch = chunks.slice(i, i + batchSize);
      console.log(`\nProcessing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(chunks.length / batchSize)}`);
      
      // Get presigned URLs for all parts in this batch in a single request
      const partNumbers = currentBatch.map(c => c.partNumber);
      console.log(`Requesting URLs for parts: ${partNumbers.join(', ')}`);
      const urlResponses = await getPartUploadUrlsBatch(key, uploadId, partNumbers);
      
      // Create a map of partNumber to uploadUrl
      const urlMap = new Map();
      urlResponses.forEach(resp => {
        urlMap.set(resp.partNumber, resp.uploadUrl);
      });
      
      // Upload all parts in this batch concurrently
      console.log(`Uploading ${currentBatch.length} parts in parallel...`);
      const uploadPromises = currentBatch.map(async ({ partNumber, chunk }) => {
        const uploadUrl = urlMap.get(partNumber);
        if (!uploadUrl) {
          throw new Error(`No upload URL for part ${partNumber}`);
        }
        
        console.log(`Starting upload of part ${partNumber}...`);
        const etag = await uploadPart(uploadUrl, chunk);
        console.log(`Part ${partNumber} uploaded, ETag: ${etag}`);
        
        return {
          ETag: etag,
          PartNumber: partNumber
        };
      });
      
      // Wait for all parts in this batch to complete
      const batchResults = await Promise.all(uploadPromises);
      parts.push(...batchResults);
      
      console.log(`Batch ${Math.floor(i / batchSize) + 1} completed. ${parts.length}/${totalParts} parts uploaded.`);
    }
    
    // Complete multipart upload
    const result = await completeMultipartUpload(key, uploadId, parts);
    
    console.log('\nMultipart upload test completed successfully!');
    console.log(`File uploaded to: ${result.location}`);
    console.log(`Key: ${result.key}`);
    
  } catch (error) {
    console.error('\nTest failed:', error);
  }
}

// Run the test
runMultipartUploadTest();