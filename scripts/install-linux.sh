#!/bin/bash
set -e

# Detect Linux distribution
if [ -f /etc/os-release ]; then
    . /etc/os-release
    DISTRO=$ID
else
    echo "Cannot detect Linux distribution"
    exit 1
fi

echo "Detected Linux distribution: $DISTRO"

# Install libfido2 based on the distribution
if [ "$DISTRO" = "ubuntu" ] || [ "$DISTRO" = "debian" ]; then
    echo "Installing libfido2 on Ubuntu/Debian..."
    sudo apt-get update
    sudo apt-get install -y libfido2-dev
elif [ "$DISTRO" = "fedora" ]; then
    echo "Installing libfido2 on Fedora..."
    sudo dnf install -y libfido2-devel
elif [ "$DISTRO" = "centos" ] || [ "$DISTRO" = "rhel" ]; then
    echo "Installing libfido2 on CentOS/RHEL..."
    sudo yum install -y epel-release
    sudo yum install -y libfido2-devel
elif [ "$DISTRO" = "arch" ] || [ "$DISTRO" = "manjaro" ]; then
    echo "Installing libfido2 on Arch/Manjaro..."
    sudo pacman -Sy --noconfirm libfido2
else
    echo "Unsupported Linux distribution: $DISTRO"
    echo "Please install libfido2 development packages manually"
    exit 1
fi

echo "libfido2 installation completed on Linux"
