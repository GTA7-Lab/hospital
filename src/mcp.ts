import { manifest } from "./manifest";
import { callTool, toolList } from "./tools";

export const PROTOCOL_VERSION = "2025-06-18";

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: any;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

/**
 * Nucleo JSON-RPC do servidor MCP, sem dependencias externas.
 * Devolve null para notificacoes (mensagens sem id), que nao tem resposta.
 */
export function handleRpc(msg: JsonRpcRequest): JsonRpcResponse | null {
  const id = msg.id ?? null;
  const isNotification = msg.id === undefined || msg.id === null;

  const ok = (result: unknown): JsonRpcResponse | null =>
    isNotification ? null : { jsonrpc: "2.0", id, result };
  const fail = (code: number, message: string): JsonRpcResponse | null =>
    isNotification ? null : { jsonrpc: "2.0", id, error: { code, message } };

  switch (msg.method) {
    case "initialize":
      return ok({
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: manifest.id, title: manifest.name, version: manifest.version },
        instructions: manifest.description,
      });

    case "notifications/initialized":
    case "notifications/cancelled":
      return null;

    case "ping":
      return ok({});

    case "tools/list":
      return ok({ tools: toolList });

    case "tools/call": {
      const name = msg.params?.name;
      if (typeof name !== "string") return fail(-32602, "params.name obrigatorio");
      return ok(callTool(name, msg.params?.arguments ?? {}));
    }

    default:
      return fail(-32601, `Metodo nao suportado: ${msg.method}`);
  }
}
