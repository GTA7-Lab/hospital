import * as readline from "node:readline";
import { handleRpc, type JsonRpcRequest } from "./mcp";

/**
 * Transporte stdio do servidor MCP: uma mensagem JSON por linha.
 * Uso: node dist/src/mcp-stdio.js
 */
const rl = readline.createInterface({ input: process.stdin });

rl.on("line", (line) => {
  const text = line.trim();
  if (!text) return;

  let msg: JsonRpcRequest;
  try {
    msg = JSON.parse(text);
  } catch {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "JSON invalido" },
      }) + "\n"
    );
    return;
  }

  const response = handleRpc(msg);
  if (response) process.stdout.write(JSON.stringify(response) + "\n");
});

rl.on("close", () => process.exit(0));
