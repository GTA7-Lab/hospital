import { serve, type Req, type Res } from "../src/http";
import { manifestRoute } from "../src/routes";

export default function handler(req: Req, res: Res) {
  return serve(req, res, manifestRoute);
}
