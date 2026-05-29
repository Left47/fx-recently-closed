// Files excluded from the packaged extension. These are repo/listing assets
// (store images, docs, config) that aren't needed at runtime.
module.exports = {
  ignoreFiles: [
    "store",
    "README.md",
    "web-ext-config.cjs",
  ],
};
