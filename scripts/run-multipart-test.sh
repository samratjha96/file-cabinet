#!/bin/bash

# This script runs the multipart upload test

# Ensure we're in the project root directory
cd "$(dirname "$0")/.."

# Check if node modules are installed
if [ ! -d "backend/node_modules" ]; then
  echo "Installing backend dependencies..."
  (cd backend && npm install)
fi

# Check if node-fetch is installed
if ! npm list node-fetch --prefix backend | grep -q node-fetch; then
  echo "Installing node-fetch for test script..."
  (cd backend && npm install node-fetch@2)  # Use v2 for CommonJS compatibility
fi

echo "Running multipart upload test..."
node scripts/test-multipart-upload.js

# Clean up test file
echo "Cleaning up test file..."
rm -f scripts/test-multipart-file.bin

echo "Test complete!"