/**
 * Test file generator script
 * 
 * This script creates test files of various sizes that you can use
 * to test the multipart upload functionality through the UI.
 * 
 * Usage:
 * node scripts/generate-test-files.js [output-directory]
 * 
 * If no output directory is specified, files will be created in ./test-files/
 */

const fs = require('fs');
const path = require('path');

// Get output directory from command line or use default
const outputDir = process.argv[2] || path.join(__dirname, '..', 'test-files');

// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`Created directory: ${outputDir}`);
}

// File sizes to generate (in MB)
const fileSizesInMB = [
  1,    // Small file (direct upload)
  6,    // Just above multipart threshold
  20,   // Medium file
  100,  // Large file
];

/**
 * Create a test file of specified size
 * 
 * @param {string} filePath - Path where the file will be saved
 * @param {number} sizeInBytes - Size of the file in bytes
 * @param {string} pattern - Optional pattern to fill the file with
 */
function createTestFile(filePath, sizeInBytes, pattern = 'random') {
  console.log(`Creating test file: ${path.basename(filePath)} (${sizeInBytes / (1024 * 1024)}MB)...`);
  
  // Create a buffer with the specified pattern
  const chunkSize = 1024 * 1024; // 1MB chunks for memory efficiency
  const fd = fs.openSync(filePath, 'w');
  
  let bytesWritten = 0;
  while (bytesWritten < sizeInBytes) {
    const currentChunkSize = Math.min(chunkSize, sizeInBytes - bytesWritten);
    const buffer = Buffer.alloc(currentChunkSize);
    
    // Fill with the specified pattern
    switch (pattern) {
      case 'random':
        // Fill with random data
        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = Math.floor(Math.random() * 256);
        }
        break;
      case 'zeros':
        // Buffer is already filled with zeros
        break;
      case 'pattern':
        // Fill with a repeating pattern (0 to 255)
        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = i % 256;
        }
        break;
      default:
        // Fill with random data as default
        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = Math.floor(Math.random() * 256);
        }
    }
    
    fs.writeSync(fd, buffer);
    bytesWritten += buffer.length;
    
    // Show progress for larger files
    if (sizeInBytes > 50 * 1024 * 1024 && bytesWritten % (10 * 1024 * 1024) === 0) {
      console.log(`  Progress: ${Math.round((bytesWritten / sizeInBytes) * 100)}%`);
    }
  }
  
  fs.closeSync(fd);
  console.log(`✅ Created: ${filePath} (${(sizeInBytes / (1024 * 1024)).toFixed(1)}MB)`);
}

// Create test files of different sizes
console.log(`Generating test files in: ${outputDir}\n`);

// Create different types of test files
fileSizesInMB.forEach(size => {
  const fileName = `test-file-${size}MB.bin`;
  const filePath = path.join(outputDir, fileName);
  createTestFile(filePath, size * 1024 * 1024, 'random');
});

// Create a realistic test JPEG image file (with proper header but random data)
function createFakeJpegFile(filePath, sizeInMB) {
  console.log(`Creating fake JPEG image: ${path.basename(filePath)} (${sizeInMB}MB)...`);
  
  const fd = fs.openSync(filePath, 'w');
  
  // Write a basic JPEG header (SOI marker followed by fake APP0 segment)
  const jpegHeader = Buffer.from([
    0xFF, 0xD8,             // SOI marker
    0xFF, 0xE0,             // APP0 marker
    0x00, 0x10,             // Length of segment (16 bytes)
    0x4A, 0x46, 0x49, 0x46, 0x00, // "JFIF\0"
    0x01, 0x01,             // version 1.1
    0x00,                   // density units (0 = no units)
    0x00, 0x01,             // X density (1)
    0x00, 0x01,             // Y density (1)
    0x00, 0x00              // Thumbnail (no thumbnail)
  ]);
  
  fs.writeSync(fd, jpegHeader);
  
  // Fill the rest with random data to reach desired size
  const remainingBytes = (sizeInMB * 1024 * 1024) - jpegHeader.length;
  const chunkSize = 1024 * 1024; // 1MB chunks
  
  let bytesWritten = 0;
  while (bytesWritten < remainingBytes) {
    const currentChunkSize = Math.min(chunkSize, remainingBytes - bytesWritten);
    const buffer = Buffer.alloc(currentChunkSize);
    
    // Fill with random data
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
    
    fs.writeSync(fd, buffer);
    bytesWritten += buffer.length;
  }
  
  // Write JPEG trailer (EOI marker)
  const jpegTrailer = Buffer.from([0xFF, 0xD9]);
  fs.writeSync(fd, jpegTrailer);
  
  fs.closeSync(fd);
  console.log(`✅ Created fake JPEG: ${filePath} (${sizeInMB}MB)`);
}

// Create a fake PDF file (with proper header but random data)
function createFakePdfFile(filePath, sizeInMB) {
  console.log(`Creating fake PDF document: ${path.basename(filePath)} (${sizeInMB}MB)...`);
  
  const fd = fs.openSync(filePath, 'w');
  
  // Write a basic PDF header and objects
  const pdfHeader = Buffer.from(
    '%PDF-1.7\n' +
    '1 0 obj\n' +
    '<< /Type /Catalog /Pages 2 0 R >>\n' +
    'endobj\n' +
    '2 0 obj\n' +
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n' +
    'endobj\n' +
    '3 0 obj\n' +
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\n' +
    'endobj\n' +
    '4 0 obj\n' +
    '<< /Length 10000 >>\n' +
    'stream\n'
  );
  
  fs.writeSync(fd, pdfHeader);
  
  // Fill the content stream with random data
  const remainingBytes = (sizeInMB * 1024 * 1024) - pdfHeader.length - 100; // Reserve 100 bytes for trailer
  const chunkSize = 1024 * 1024; // 1MB chunks
  
  let bytesWritten = 0;
  while (bytesWritten < remainingBytes) {
    const currentChunkSize = Math.min(chunkSize, remainingBytes - bytesWritten);
    const buffer = Buffer.alloc(currentChunkSize);
    
    // Fill with printable ASCII characters for PDF content
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = 32 + (Math.floor(Math.random() * 94)); // ASCII 32-126 (printable)
    }
    
    fs.writeSync(fd, buffer);
    bytesWritten += buffer.length;
  }
  
  // Write PDF trailer
  const pdfTrailer = Buffer.from(
    '\nendstream\n' +
    'endobj\n' +
    'xref\n' +
    '0 5\n' +
    '0000000000 65535 f \n' +
    '0000000010 00000 n \n' +
    '0000000056 00000 n \n' +
    '0000000111 00000 n \n' +
    '0000000192 00000 n \n' +
    'trailer << /Size 5 /Root 1 0 R >>\n' +
    'startxref\n' +
    '10000000\n' +
    '%%EOF'
  );
  
  fs.writeSync(fd, pdfTrailer);
  fs.closeSync(fd);
  console.log(`✅ Created fake PDF: ${filePath} (${sizeInMB}MB)`);
}

// Create realistic test files
createFakeJpegFile(path.join(outputDir, `test-photo-10MB.jpg`), 10);
createFakePdfFile(path.join(outputDir, `test-document-15MB.pdf`), 15);
createFakeJpegFile(path.join(outputDir, `test-photo-50MB.jpg`), 50);

console.log("\nAll test files have been generated successfully!");
console.log(`Files are located in: ${outputDir}`);
console.log("\nNow you can use these files to test the multipart upload through the UI.");
console.log("Files larger than 5MB will trigger the multipart upload functionality.");