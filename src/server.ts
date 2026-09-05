import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { serve } from "./http";
import { routes } from "./routes";

/**
 * Servidor local (sem dependencias) que reproduz o comportamento da Vercel:
 * arquivos de public/ mais as rotas de /api.
 */
const PORT = Number(process.env.PORT ?? 3000);
const PUBLIC_DIR = path.resolve(process.cwd(), "public");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;

  const route = routes[pathname] ?? (pathname === "/mcp" ? routes["/api/mcp"] : undefined);
  if (route) {
    void serve(req, res, route);
    return;
  }

  const file = path.join(PUBLIC_DIR, pathname === "/" ? "index.html" : pathname);
  if (file.startsWith(PUBLIC_DIR) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.setHeader("Content-Type", MIME[path.extname(file)] ?? "application/octet-stream");
    res.end(fs.readFileSync(file));
    return;
  }

  res.statusCode = 404;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: "Nao encontrado", routes: Object.keys(routes) }));
});

server.listen(PORT, () => {
  console.log(`Hospital Central GTA7 em http://localhost:${PORT}`);
  console.log(`MCP (HTTP) em http://localhost:${PORT}/api/mcp`);
});
