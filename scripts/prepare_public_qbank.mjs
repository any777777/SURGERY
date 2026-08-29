import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const privateDataPath = path.join(root, "data", "private", "surgery-qbank.json");
const publicDataPath = path.join(root, "public", "qbank.json");

if (fs.existsSync(privateDataPath)) {
  fs.copyFileSync(privateDataPath, publicDataPath);
  console.log(`Prepared ${path.relative(root, publicDataPath)}`);
} else {
  fs.rmSync(publicDataPath, { force: true });
  console.log("Private qbank data is not present; the app will use the bundled demo questions.");
}
