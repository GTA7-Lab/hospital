import type { IncomingMessage, ServerResponse } from "node:http";

/** Request da Vercel ou do servidor local: os dois estendem IncomingMessage. */
export type Req = IncomingMessage & { body?: any };
export type Res = ServerResponse;

export interface Result {
  status: number;
  body: unknown;
}

export type Handler = (ctx: {
  method: string;
  query: URLSearchParams;
  body: any;
}) => Result | Promise<Result>;

function readBody(req: Req): Promise<any> {
  if (req.body !== undefined) return Promise.resolve(req.body); // ja parseado pela Vercel
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(raw);
      }
    });
  });
}

/** Adapta um Handler puro para o par (req, res) do Node/Vercel. */
export async function serve(req: Req, res: Res, handler: Handler): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  let result: Result;
  try {
    const query = new URL(req.url ?? "/", "http://localhost").searchParams;
    const body = req.method === "GET" ? undefined : await readBody(req);
    result = await handler({ method: req.method ?? "GET", query, body });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    result = { status, body: { error: (err as Error).message } };
  }

  if (result.body === null) {
    res.statusCode = result.status;
    res.end();
    return;
  }
  res.statusCode = result.status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(result.body));
}
