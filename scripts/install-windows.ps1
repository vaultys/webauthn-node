# Windows installation script for libfido2
Write-Host "Installing libfido2 on Windows..."

# Check if Chocolatey is installed
$chocoInstalled = $false
try {
    $chocoVersion = choco -v
    $chocoInstalled = $true
    Write-Host "Chocolatey is already installed: $chocoVersion"
} catch {
    Write-Host "Chocolatey is not installed."
}

# Install Chocolatey if not installed
if (-not $chocoInstalled) {
    Write-Host "Installing Chocolatey..."
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))

    # Reload PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# Install libfido2 using Chocolatey
Write-Host "Installing libfido2 using Chocolatey..."
choco install -y libfido2

# Set environment variables for the build
$libfido2Path = "C:\Program Files\libfido2"
if (Test-Path $libfido2Path) {
    Write-Host "Setting environment variables for libfido2..."
    [Environment]::SetEnvironmentVariable("LIBFIDO2_PATH", $libfido2Path, "User")
    $env:LIBFIDO2_PATH = $libfido2Path

    # Also update PATH for this session
    $env:Path += ";$libfido2Path\bin"
} else {
    Write-Host "libfido2 installation path not found at $libfido2Path"
    Write-Host "You may need to set LIBFIDO2_PATH environment variable manually."
}

Write-Host "libfido2 installation completed on Windows"
