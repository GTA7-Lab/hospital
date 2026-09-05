import type { Handler } from "./http";
import { manifest } from "./manifest";
import { handleRpc, type JsonRpcRequest } from "./mcp";
import { db } from "./data";
import {
  addHistoryEntry,
  checkSymptoms,
  hospitalInfo,
  listAppointments,
  listDoctors,
  listPatients,
  patientRecord,
  requirePatient,
  scheduleAppointment,
  scheduleExam,
} from "./service";

const ok = (body: unknown) => ({ status: 200, body });
const created = (body: unknown) => ({ status: 201, body });
const bad = (message: string) => ({ status: 405, body: { error: message } });

export const manifestRoute: Handler = () => ok(manifest);

export const hospitalRoute: Handler = () => ok(hospitalInfo());

export const patientsRoute: Handler = ({ query }) => {
  const patient = query.get("patient") ?? query.get("id");
  if (patient) return ok(patientRecord(patient));
  const admitted = query.get("admitted");
  return ok({
    patients: listPatients({
      q: query.get("q") ?? undefined,
      admitted: admitted === null || admitted === "" ? undefined : admitted === "true",
    }),
  });
};

export const doctorsRoute: Handler = ({ query }) =>
  ok({ doctors: listDoctors(query.get("specialty") ?? undefined) });

export const symptomsRoute: Handler = ({ method, query, body }) => {
  const raw =
    method === "POST" ? body?.symptoms : (query.get("symptoms") ?? "").split(",");
  const list = Array.isArray(raw) ? raw.map(String) : String(raw ?? "").split(",");
  return ok(checkSymptoms(list.map((s) => s.trim()).filter(Boolean)));
};

export const appointmentsRoute: Handler = ({ method, query, body }) => {
  if (method === "POST") {
    return created(
      scheduleAppointment({
        patient: body?.patient,
        specialty: body?.specialty,
        date: body?.date,
        time: body?.time,
      })
    );
  }
  if (method !== "GET") return bad("Use GET ou POST");
  return ok({ appointments: listAppointments(query.get("patient") ?? undefined) });
};

export const examsRoute: Handler = ({ method, query, body }) => {
  if (method === "POST") {
    return created(
      scheduleExam({
        patient: body?.patient,
        exam: body?.exam,
        date: body?.date,
        time: body?.time,
      })
    );
  }
  if (method !== "GET") return bad("Use GET ou POST");
  const patient = query.get("patient");
  const list = patient
    ? db.exams.filter((e) => e.patientId === requirePatient(patient).id)
    : db.exams;
  return ok({ exams: list });
};

export const historyRoute: Handler = ({ method, body }) => {
  if (method !== "POST") return bad("Use POST");
  return created(
    addHistoryEntry({
      patient: body?.patient,
      type: body?.type,
      description: body?.description,
      date: body?.date,
      doctorId: body?.doctorId,
    })
  );
};

/** Endpoint MCP (JSON-RPC sobre HTTP). */
export const mcpRoute: Handler = ({ method, body }) => {
  if (method !== "POST") {
    return {
      status: 405,
      body: { error: "Endpoint MCP: envie JSON-RPC 2.0 via POST", tools: manifest.tools },
    };
  }
  const messages: JsonRpcRequest[] = Array.isArray(body) ? body : [body];
  if (!body || messages.some((m) => m?.jsonrpc !== "2.0")) {
    return { status: 400, body: { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Requisicao JSON-RPC invalida" } } };
  }
  const responses = messages.map(handleRpc).filter((r) => r !== null);
  if (responses.length === 0) return { status: 202, body: null };
  return ok(Array.isArray(body) ? responses : responses[0]);
};

/** Tabela usada pelo servidor local (na Vercel cada arquivo em /api e uma funcao). */
export const routes: Record<string, Handler> = {
  "/api/manifest": manifestRoute,
  "/api/hospital": hospitalRoute,
  "/api/patients": patientsRoute,
  "/api/doctors": doctorsRoute,
  "/api/symptoms": symptomsRoute,
  "/api/appointments": appointmentsRoute,
  "/api/exams": examsRoute,
  "/api/history": historyRoute,
  "/api/mcp": mcpRoute,
};
