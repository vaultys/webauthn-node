const { spawn, spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

// Platform detection
const platform = os.platform();
const arch = os.arch();

console.log(`Detected platform: ${platform}-${arch}`);

// Install libfido2 dependencies
console.log("Installing libfido2 dependencies...");

try {
  require("./scripts/install-libfido2");
} catch (error) {
  console.error("Failed to install libfido2:", error);
  process.exit(1);
}

// Build the native module
console.log("Building native module...");

let buildCmd, buildArgs;
if (platform === "win32") {
  buildCmd = "npx";
  buildArgs = ["node-gyp", "rebuild"];
} else {
  buildCmd = "node-gyp";
  buildArgs = ["rebuild"];
}

const buildProc = spawnSync(buildCmd, buildArgs, {
  stdio: "inherit",
  shell: platform === "win32",
});

if (buildProc.status !== 0) {
  console.error("Failed to build native module");
  process.exit(1);
}

// Build TypeScript code
console.log("Building TypeScript code...");
const tscProc = spawnSync("npx", ["tsc"], {
  stdio: "inherit",
  shell: platform === "win32",
});

if (tscProc.status !== 0) {
  console.error("Failed to build TypeScript code");
  process.exit(1);
}

console.log("Installation completed successfully");
