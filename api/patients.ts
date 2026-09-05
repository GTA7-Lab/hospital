import { serve, type Req, type Res } from "../src/http";
import { patientsRoute } from "../src/routes";

export default function handler(req: Req, res: Res) {
  return serve(req, res, patientsRoute);
}
