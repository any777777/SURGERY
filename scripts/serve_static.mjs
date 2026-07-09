import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "out");
const port = Number(process.env.PORT ?? 3000);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
]);

function resolveFile(url) {
  const pathname = decodeURIComponent(new URL(url, `http://localhost:${port}`).pathname);
  const normalized = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const candidate = path.join(root, normalized);

  if (!candidate.startsWith(root)) {
    return null;
  }

  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }

  const indexFile = path.join(candidate, "index.html");
  if (fs.existsSync(indexFile) && fs.statSync(indexFile).isFile()) {
    return indexFile;
  }

  return path.join(root, "404.html");
}

const server = http.createServer((request, response) => {
  const file = resolveFile(request.url ?? "/");

  if (!file || !fs.existsSync(file)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const extension = path.extname(file);
  response.writeHead(file.endsWith("404.html") ? 404 : 200, {
    "Cache-Control": extension === ".html" ? "public, max-age=0, must-revalidate" : "public, max-age=31536000, immutable",
    "Content-Type": contentTypes.get(extension) ?? "application/octet-stream",
  });
  fs.createReadStream(file).pipe(response);
});

server.listen(port, () => {
  console.log(`Serving ${root} at http://localhost:${port}`);
});
