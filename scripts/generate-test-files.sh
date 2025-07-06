#!/bin/bash

# Script to generate test files for UI testing

# Ensure we're in the project root directory
cd "$(dirname "$0")/.."

# Set default output directory
OUTPUT_DIR="./test-files"

# Check if an output directory was provided
if [ "$1" != "" ]; then
  OUTPUT_DIR="$1"
fi

# Create the output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

echo "Generating test files..."
node scripts/generate-test-files.js "$OUTPUT_DIR"

echo ""
echo "To test in the UI:"
echo "1. Start the development servers: make dev"
echo "2. Go to http://localhost:5173 in your browser"
echo "3. Drag and drop the generated test files to test upload functionality"
echo ""
echo "Files in '$OUTPUT_DIR' directory:"
ls -lh "$OUTPUT_DIR"