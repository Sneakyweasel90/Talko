const { copyFileSync, existsSync, mkdirSync } = require("fs");
const { resolve } = require("path");

const root = resolve(__dirname, "..");
const pkgDir = resolve(root, "node_modules/@sapphi-red/web-noise-suppressor");
const publicDir = resolve(root, "public");

if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true });

const filesToCopy = [
  ["dist/rnnoise/workletProcessor.js", "workletProcessor.js"],
  ["dist/rnnoise.wasm", "rnnoise.wasm"],
  ["dist/rnnoise_simd.wasm", "rnnoise_simd.wasm"],
];

for (const [src, dest] of filesToCopy) {
  const srcPath = resolve(pkgDir, src);
  if (existsSync(srcPath)) {
    copyFileSync(srcPath, resolve(publicDir, dest));
    console.log("Copied " + src + " -> public/" + dest);
  } else {
    console.warn("Not found: " + srcPath);
  }
}
