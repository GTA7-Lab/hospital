import { readBody, type Req, type Res } from "./http";
import { handleRpc, type JsonRpcRequest, type JsonRpcResponse } from "./mcp";
import { manifest } from "./manifest";

/**
 * Transporte streamable HTTP do MCP.
 *
 * O servidor e stateless (nao emite Mcp-Session-Id e nao guarda sessao), mas
 * atende as duas formas de resposta que a spec preve:
 *
 * - POST devolve `application/json` por padrao e `text/event-stream` quando o
 *   cliente aceita SSE - alguns clientes so aceitam a segunda;
 * - GET abre um stream SSE. Como esta entidade nunca envia mensagem por conta
 *   propria, o stream so mantem keepalive e fecha sozinho; o cliente reconecta.
 */

/** Vercel corta funcao longa: fecha antes disso e deixa o cliente reconectar. */
const STREAM_MS = 25_000;
const KEEPALIVE_MS = 5_000;

function setCors(res: Res): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID, Authorization"
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, MCP-Protocol-Version");
}

function acceptsSse(req: Req): boolean {
  return String(req.headers.accept ?? "").includes("text/event-stream");
}

function openSse(res: Res): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // impede buffering de proxy, que engoliria o stream
  });
}

function sendSse(res: Res, message: JsonRpcResponse): void {
  res.write(`event: message\ndata: ${JSON.stringify(message)}\n\n`);
}

function sendJson(res: Res, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

/** GET: stream aberto, sem mensagens, ate o cliente sair ou o tempo acabar. */
function streamEvents(req: Req, res: Res): void {
  openSse(res);
  res.write(": conectado ao Hospital Central GTA7\n\n");

  const keepalive = setInterval(() => res.write(": keepalive\n\n"), KEEPALIVE_MS);
  const close = setTimeout(() => {
    clearInterval(keepalive);
    res.end();
  }, STREAM_MS);

  req.on("close", () => {
    clearInterval(keepalive);
    clearTimeout(close);
  });
}

export async function handleMcpHttp(req: Req, res: Res): Promise<void> {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === "DELETE") {
    // fim de sessao: nao ha estado para descartar
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === "GET") {
    if (!acceptsSse(req)) {
      sendJson(res, 405, {
        error: "Endpoint MCP: envie JSON-RPC 2.0 via POST, ou abra um stream com Accept: text/event-stream",
        tools: manifest.tools,
      });
      return;
    }
    streamEvents(req, res);
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Use GET, POST, DELETE ou OPTIONS" });
    return;
  }

  let body: any;
  try {
    body = await readBody(req);
  } catch {
    body = undefined;
  }

  const messages: JsonRpcRequest[] = Array.isArray(body) ? body : [body];
  if (!body || messages.some((m) => m?.jsonrpc !== "2.0")) {
    sendJson(res, 400, {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "Requisicao JSON-RPC invalida" },
    });
    return;
  }

  const responses = messages
    .map(handleRpc)
    .filter((r): r is JsonRpcResponse => r !== null);

  // so notificacoes: nada a responder
  if (responses.length === 0) {
    res.statusCode = 202;
    res.end();
    return;
  }

  if (acceptsSse(req)) {
    openSse(res);
    for (const message of responses) sendSse(res, message);
    res.end();
    return;
  }

  sendJson(res, 200, Array.isArray(body) ? responses : responses[0]);
}
