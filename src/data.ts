import * as fs from "node:fs";
import * as path from "node:path";
import seed from "../data/hospital.json";
import type { HospitalData } from "./types";

/**
 * Os dados sao carregados de data/hospital.json e vivem em memoria.
 * Alteracoes (agendamentos, novos registros) valem enquanto o processo estiver
 * de pe - na Vercel o sistema de arquivos e somente leitura.
 * Localmente, HOSPITAL_PERSIST=1 grava as alteracoes de volta no JSON.
 */
export const db: HospitalData = JSON.parse(JSON.stringify(seed)) as HospitalData;

const dataFile = path.resolve(process.cwd(), "data/hospital.json");

export function persist(): void {
  if (process.env.HOSPITAL_PERSIST !== "1") return;
  try {
    if (!fs.existsSync(dataFile)) return;
    fs.writeFileSync(dataFile, JSON.stringify(db, null, 2) + "\n", "utf8");
  } catch {
    /* somente leitura - mantem apenas em memoria */
  }
}

/** minusculas e sem acentos, para busca tolerante */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function nextId(prefix: string, existing: { id: string }[]): string {
  let n = existing.length + 1;
  const taken = new Set(existing.map((e) => e.id));
  while (taken.has(`${prefix}-${String(n).padStart(3, "0")}`)) n++;
  return `${prefix}-${String(n).padStart(3, "0")}`;
}
