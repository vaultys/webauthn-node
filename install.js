const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

console.log("Falling back to manual build process...");

// Platform detection
const platform = os.platform();
const arch = os.arch();

console.log(`Building for ${platform}-${arch}`);

// Install libfido2 dependencies
console.log("Installing libfido2 dependencies...");

try {
  require("./scripts/install-libfido2");
} catch (error) {
  console.error("Failed to install libfido2:", error);
  process.exit(1);
}

// Make sure binding directory exists
const bindingDir = path.join(__dirname, "binding", `${platform}-${arch}`);
if (!fs.existsSync(bindingDir)) {
  fs.mkdirSync(bindingDir, { recursive: true });
}

// Build with node-gyp
console.log("Building native module...");
const buildResult = spawnSync("node-gyp", ["rebuild"], {
  stdio: "inherit",
  shell: true,
});

if (buildResult.status !== 0) {
  console.error("Failed to build native module");
  process.exit(1);
}

// Copy the built module to the right location
const buildDir = path.join(__dirname, "build", "Release");
const targetFile = path.join(bindingDir, "fido2.node");

try {
  const sourceFile = path.join(buildDir, "fido2.node");
  fs.copyFileSync(sourceFile, targetFile);
  console.log(`Successfully copied binary to ${targetFile}`);
} catch (error) {
  console.error("Failed to copy binary:", error);
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
