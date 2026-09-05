import type { Req, Res } from "../src/http";
import { handleMcpHttp } from "../src/mcp-http";

export default function handler(req: Req, res: Res) {
  return handleMcpHttp(req, res);
}
