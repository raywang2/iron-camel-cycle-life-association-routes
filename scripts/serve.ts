import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const ROOT = process.cwd();
const PORT = Number(process.env.PORT || 8080);

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gpx": "application/gpx+xml; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function resolveRequestPath(requestUrl: string | undefined): string | null {
  const parsedUrl = new URL(requestUrl || "/", `http://localhost:${PORT}`);
  const requestedPath = parsedUrl.pathname === "/" ? "/index.html" : parsedUrl.pathname;
  const decodedPath = decodeURIComponent(requestedPath);
  const filePath = path.normalize(path.join(ROOT, decodedPath));

  if (!filePath.startsWith(ROOT)) {
    return null;
  }

  return filePath;
}

const server = http.createServer(async (request, response) => {
  const filePath = resolveRequestPath(request.url);

  if (!filePath) {
    response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  try {
    const body = await fs.readFile(filePath);
    const extension = path.extname(filePath);
    response.writeHead(200, {
      "content-type": contentTypes[extension] || "application/octet-stream",
    });
    response.end(body);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    response.writeHead(code === "ENOENT" ? 404 : 500, {
      "content-type": "text/plain; charset=utf-8",
    });
    response.end(code === "ENOENT" ? "Not found" : "Server error");
  }
});

server.listen(PORT, "localhost", () => {
  console.log(`http://localhost:${PORT}`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use.`);
  } else if (error.code === "EPERM") {
    console.error(`Cannot bind localhost:${PORT}; this environment may block local servers.`);
  } else {
    console.error(error);
  }
  process.exit(1);
});
