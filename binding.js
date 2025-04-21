const path = require("path");
const os = require("os");

// Map node.js platform names to expected directory names
const platformMap = {
  darwin: "darwin",
  linux: "linux",
  win32: "win32",
};

// Get the correct platform name
const platform = platformMap[os.platform()] || os.platform();
const arch = process.arch;

// Load the module
const binary = path.join(__dirname, "binding", `${platform}-${arch}`, "fido2.node");
module.exports = require(binary);
