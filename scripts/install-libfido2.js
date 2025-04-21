const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const platform = os.platform();

console.log(`Installing libfido2 on ${platform}...`);

try {
  if (platform === "linux") {
    // Run Linux install script
    const scriptPath = path.join(__dirname, "install-linux.sh");
    fs.chmodSync(scriptPath, "755");
    const result = spawnSync(scriptPath, [], { stdio: "inherit", shell: true });
    if (result.status !== 0) {
      throw new Error(`Linux installation script failed with code ${result.status}`);
    }
  } else if (platform === "darwin") {
    // Run macOS install script
    const scriptPath = path.join(__dirname, "install-macos.sh");
    fs.chmodSync(scriptPath, "755");
    const result = spawnSync(scriptPath, [], { stdio: "inherit", shell: true });
    if (result.status !== 0) {
      throw new Error(`macOS installation script failed with code ${result.status}`);
    }
  } else if (platform === "win32") {
    // Run Windows install script
    const scriptPath = path.join(__dirname, "install-windows.ps1");
    const result = spawnSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", scriptPath], { stdio: "inherit" });
    if (result.status !== 0) {
      throw new Error(`Windows installation script failed with code ${result.status}`);
    }
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  console.log("libfido2 installed successfully");
} catch (error) {
  console.error("Failed to install libfido2:", error);
  throw error;
}
