const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

// Platform detection
const platform = os.platform();

console.log(`Detected platform: ${platform}`);

// Install libfido2 dependencies
console.log("Installing libfido2 dependencies...");

try {
  require("./scripts/install-libfido2");
} catch (error) {
  console.error("Failed to install libfido2:", error);
  process.exit(1);
}

// Build the native module directly with node-gyp as fallback
console.log("Building native module with node-gyp...");

const result = spawnSync("node-gyp", ["rebuild"], {
  stdio: "inherit",
  shell: true,
});

if (result.status !== 0) {
  console.error("Failed to build native module");
  process.exit(1);
}

// Build TypeScript code
console.log("Building TypeScript code...");
const tscResult = spawnSync("npx", ["tsc"], {
  stdio: "inherit",
  shell: true,
});

if (tscResult.status !== 0) {
  console.error("Failed to build TypeScript code");
  process.exit(1);
}

console.log("Installation completed successfully");
