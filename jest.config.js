module.exports = {
  testEnvironment: "node",
  testMatch: ["**/*.test.js", "**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  verbose: true,
  testTimeout: 60000,
};
