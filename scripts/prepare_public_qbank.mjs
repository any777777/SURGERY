import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const privateDataPath = path.join(root, "data", "private", "surgery-qbank.json");
const publicDataPath = path.join(root, "public", "qbank.json");
const publicAssetDirectory = path.join(root, "public", "study-assets", "private");
const remoteDataUrl = process.env.QBANK_SOURCE_URL;

function clearGeneratedAssets() {
  for (const entry of fs.readdirSync(publicAssetDirectory, { withFileTypes: true })) {
    if (entry.name !== ".gitkeep") {
      fs.rmSync(path.join(publicAssetDirectory, entry.name), { force: true, recursive: true });
    }
  }
}

async function fetchRequired(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to download ${url}: ${response.status} ${response.statusText}`);
  }
  return response;
}

function figurePaths(qbank) {
  if (!Array.isArray(qbank.chapters) || !Array.isArray(qbank.figures)) {
    throw new Error("Remote qbank data is missing chapters or figures.");
  }
  return [...new Set(qbank.figures.map((figure) => figure.path).filter(Boolean))];
}

async function downloadFigure(sourceUrl, figurePath) {
  if (!/^\/study-assets\/private\/[a-zA-Z0-9._-]+$/.test(figurePath)) {
    throw new Error(`Unsupported figure path: ${figurePath}`);
  }
  const response = await fetchRequired(new URL(figurePath, sourceUrl));
  const destination = path.join(publicAssetDirectory, path.basename(figurePath));
  fs.writeFileSync(destination, Buffer.from(await response.arrayBuffer()));
}

async function prepareRemoteQbank(sourceUrl) {
  const response = await fetchRequired(sourceUrl);
  const qbank = await response.json();
  const remoteFigurePaths = figurePaths(qbank);

  clearGeneratedAssets();
  await Promise.all(remoteFigurePaths.map((figurePath) => downloadFigure(sourceUrl, figurePath)));
  fs.writeFileSync(publicDataPath, `${JSON.stringify(qbank)}\n`);
  console.log(`Prepared remote qbank with ${remoteFigurePaths.length} figures.`);
}

if (fs.existsSync(privateDataPath)) {
  fs.copyFileSync(privateDataPath, publicDataPath);
  console.log(`Prepared ${path.relative(root, publicDataPath)}`);
} else if (remoteDataUrl) {
  await prepareRemoteQbank(remoteDataUrl);
} else {
  fs.rmSync(publicDataPath, { force: true });
  clearGeneratedAssets();
  console.log("Private qbank data is not present; the app will use the bundled demo questions.");
}
