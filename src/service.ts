import { db, normalize, nextId, persist } from "./data";
import { lista } from "./format";
import type { Appointment, Doctor, Exam, Patient } from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export class ServiceError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export function hospitalInfo() {
  return {
    ...db.hospital,
    specialties: db.specialties,
    doctors: db.doctors.length,
    patients: db.patients.length,
    admitted: db.patients.filter((p) => p.admission).length,
  };
}

function doctorName(doctorId: string): string {
  return db.doctors.find((d) => d.id === doctorId)?.name ?? doctorId;
}

function patientSummary(p: Patient) {
  return {
    id: p.id,
    name: p.name,
    birthDate: p.birthDate,
    bloodType: p.bloodType,
    admitted: p.admission !== null,
    room: p.admission?.room ?? null,
  };
}

export function listPatients(opts: { q?: string; admitted?: boolean } = {}) {
  let list = db.patients;
  if (opts.q) {
    const q = normalize(opts.q);
    list = list.filter((p) => normalize(p.name).includes(q) || p.id === opts.q);
  }
  if (opts.admitted !== undefined) {
    list = list.filter((p) => (p.admission !== null) === opts.admitted);
  }
  return list.map(patientSummary);
}

/** Aceita id (pat-001) ou parte do nome. */
export function findPatient(patient: string): Patient | undefined {
  const key = normalize(patient);
  return (
    db.patients.find((p) => normalize(p.id) === key) ??
    db.patients.find((p) => normalize(p.name) === key) ??
    db.patients.find((p) => normalize(p.name).includes(key))
  );
}

export function requirePatient(patient: string): Patient {
  const found = findPatient(patient);
  if (!found) {
    throw new ServiceError(
      `Não encontrei ninguém chamado "${patient}" nos registros do Hospital Central GTA7. Vale tentar pelo nome completo ou pelo número do prontuário.`,
      404
    );
  }
  return found;
}

/** Prontuario completo: historico, internacao, consultas e exames. */
export function patientRecord(patient: string) {
  const p = requirePatient(patient);
  return {
    id: p.id,
    name: p.name,
    birthDate: p.birthDate,
    bloodType: p.bloodType,
    allergies: p.allergies,
    chronicConditions: p.chronicConditions,
    admitted: p.admission !== null,
    admission: p.admission,
    medicalHistory: [...p.medicalHistory]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((h) => ({ ...h, doctor: doctorName(h.doctorId) })),
    appointments: db.appointments
      .filter((a) => a.patientId === p.id)
      .map((a) => ({ ...a, doctor: doctorName(a.doctorId) })),
    exams: db.exams.filter((e) => e.patientId === p.id),
  };
}

export function listDoctors(specialty?: string): Doctor[] {
  if (!specialty) return db.doctors;
  const s = normalize(specialty);
  return db.doctors.filter((d) => normalize(d.specialty).includes(s));
}

const URGENCY_ORDER = ["baixa", "media", "alta", "emergencia"];

/**
 * Compara os sintomas informados com o banco de doencas e devolve as
 * hipoteses ordenadas por numero de sintomas coincidentes e urgencia.
 */
export function checkSymptoms(symptoms: string[]) {
  const wanted = symptoms.map(normalize).filter(Boolean);
  if (wanted.length === 0) {
    throw new ServiceError("Me conte pelo menos um sintoma para eu poder ajudar.");
  }

  const matches = db.conditions
    .map((c) => {
      const matched = c.symptoms.filter((s) =>
        wanted.some((w) => normalize(s).includes(w) || w.includes(normalize(s)))
      );
      return {
        condition: c.name,
        specialty: c.specialty,
        urgency: c.urgency,
        guidance: c.guidance,
        matchedSymptoms: matched,
        score: Number((matched.length / c.symptoms.length).toFixed(2)),
      };
    })
    .filter((m) => m.matchedSymptoms.length > 0)
    .sort(
      (a, b) =>
        b.matchedSymptoms.length - a.matchedSymptoms.length ||
        URGENCY_ORDER.indexOf(b.urgency) - URGENCY_ORDER.indexOf(a.urgency)
    )
    .slice(0, 4);

  const top = matches[0];
  const emergency = matches.some((m) => m.urgency === "emergencia");

  return {
    symptoms: wanted,
    emergency,
    recommendedSpecialty: top ? top.specialty : "clinica_geral",
    nextStep: emergency
      ? `Vá ao pronto-socorro agora ou ligue para o ${db.hospital.emergency}.`
      : top
        ? `Vale marcar uma consulta no ${db.hospital.name}.`
        : `Marque uma consulta de clínica geral no ${db.hospital.name} para uma avaliação.`,
    possibleConditions: matches,
    disclaimer:
      "Isto é uma orientação inicial e não substitui uma consulta médica. Se piorar, procure atendimento.",
  };
}

function validateDateTime(date: string, time: string) {
  if (!DATE_RE.test(date)) {
    throw new ServiceError("Não entendi a data. Ela precisa vir como ano-mês-dia, por exemplo 2026-11-03.");
  }
  if (!TIME_RE.test(time)) {
    throw new ServiceError("Não entendi o horário. Ele precisa vir como hora:minuto, por exemplo 14:30.");
  }
}

export function scheduleAppointment(input: {
  patient: string;
  specialty: string;
  date: string;
  time: string;
}): Appointment & { patientName: string; doctor: string } {
  const p = requirePatient(input.patient);
  validateDateTime(input.date, input.time);

  const doctor = listDoctors(input.specialty)[0];
  if (!doctor) {
    throw new ServiceError(
      `O Hospital Central GTA7 não atende "${input.specialty}". As especialidades disponíveis são ${db.specialties
        .map((s) => s.replace(/_/g, " "))
        .join(", ")}.`
    );
  }

  const clash = db.appointments.find(
    (a) => a.doctorId === doctor.id && a.date === input.date && a.time === input.time
  );
  if (clash) {
    throw new ServiceError(
      `${doctor.name} já tem uma consulta marcada nesse dia e horário. Escolha outro horário.`,
      409
    );
  }

  const appointment: Appointment = {
    id: nextId("apt", db.appointments),
    patientId: p.id,
    doctorId: doctor.id,
    specialty: doctor.specialty,
    date: input.date,
    time: input.time,
    status: "agendada",
  };
  db.appointments.push(appointment);
  persist();
  return { ...appointment, patientName: p.name, doctor: doctor.name };
}

export function scheduleExam(input: {
  patient: string;
  exam: string;
  date: string;
  time: string;
}): Exam & { patientName: string } {
  const p = requirePatient(input.patient);
  validateDateTime(input.date, input.time);
  if (!input.exam?.trim()) throw new ServiceError("Me diga qual exame você quer marcar.");

  const exam: Exam = {
    id: nextId("exm", db.exams),
    patientId: p.id,
    name: input.exam.trim(),
    date: input.date,
    time: input.time,
    status: "agendado",
    result: null,
  };
  db.exams.push(exam);
  persist();
  return { ...exam, patientName: p.name };
}

export function listAppointments(patient?: string) {
  const id = patient ? requirePatient(patient).id : undefined;
  return db.appointments
    .filter((a) => !id || a.patientId === id)
    .map((a) => ({
      ...a,
      doctor: doctorName(a.doctorId),
      patientName: db.patients.find((p) => p.id === a.patientId)?.name ?? a.patientId,
    }));
}

/** Acrescenta um registro ao historico medico do paciente. */
export function addHistoryEntry(input: {
  patient: string;
  type: string;
  description: string;
  date?: string;
  doctorId?: string;
}) {
  const p = requirePatient(input.patient);
  const types = ["consulta", "exame", "procedimento", "tratamento"];
  if (!types.includes(input.type)) {
    throw new ServiceError(`O registro precisa ser uma ${lista(types)}.`);
  }
  if (!input.description?.trim()) throw new ServiceError("Me diga o que aconteceu no atendimento.");
  const date = input.date ?? new Date().toISOString().slice(0, 10);
  if (!DATE_RE.test(date)) {
    throw new ServiceError("Não entendi a data. Ela precisa vir como ano-mês-dia, por exemplo 2026-11-03.");
  }

  const entry = {
    date,
    type: input.type as "consulta" | "exame" | "procedimento" | "tratamento",
    description: input.description.trim(),
    doctorId: input.doctorId ?? "doc-002",
  };
  p.medicalHistory.push(entry);
  persist();
  return { patientId: p.id, patientName: p.name, entry };
}
