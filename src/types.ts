export interface Hospital {
  id: string;
  name: string;
  address: string;
  phone: string;
  emergency: string;
  openHours: string;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  crm: string;
  days: string[];
}

export interface Admission {
  room: string;
  since: string;
  reason: string;
}

export interface HistoryEntry {
  date: string;
  type: "consulta" | "exame" | "procedimento" | "tratamento";
  description: string;
  doctorId: string;
}

export interface Patient {
  id: string;
  name: string;
  birthDate: string;
  bloodType: string;
  allergies: string[];
  chronicConditions: string[];
  admission: Admission | null;
  medicalHistory: HistoryEntry[];
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  specialty: string;
  date: string;
  time: string;
  status: string;
}

export interface Exam {
  id: string;
  patientId: string;
  name: string;
  date: string;
  time: string;
  status: string;
  result: string | null;
}

export interface Condition {
  id: string;
  name: string;
  symptoms: string[];
  specialty: string;
  urgency: "baixa" | "media" | "alta" | "emergencia";
  guidance: string;
}

export interface HospitalData {
  hospital: Hospital;
  specialties: string[];
  doctors: Doctor[];
  patients: Patient[];
  appointments: Appointment[];
  exams: Exam[];
  conditions: Condition[];
}
