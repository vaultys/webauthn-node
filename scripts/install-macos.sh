#!/bin/bash
set -e

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo "Homebrew is required but not installed."
    echo "Please install Homebrew first: https://brew.sh/"
    exit 1
fi

echo "Installing libfido2 on macOS..."

# Install libfido2 using Homebrew
brew install libfido2

echo "libfido2 installation completed on macOS"
