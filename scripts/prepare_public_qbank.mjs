import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const privateDataPath = path.join(root, "data", "private", "surgery-qbank.json");
const publicDataPath = path.join(root, "public", "qbank.json");

if (!fs.existsSync(privateDataPath)) {
  throw new Error(`Missing private qbank data: ${privateDataPath}`);
}

fs.copyFileSync(privateDataPath, publicDataPath);
console.log(`Prepared ${path.relative(root, publicDataPath)}`);
