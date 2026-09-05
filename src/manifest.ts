import { db } from "./data";

/** Manifesto consumido pelo Core Orchestrator da GTA7 Lab. */
export const manifest = {
  id: "hospital",
  name: "Hospital Central GTA7",
  description:
    "Hospital da cidade GTA7 Lab: prontuários e histórico médico, triagem por sintomas com nível de urgência, agendamento de consultas e exames e status de internação dos pacientes.",
  version: "1.0.0",
  features: [
    "Consultar prontuário e histórico médico de um paciente",
    "Verificar se um paciente está internado e em qual quarto",
    "Triagem por sintomas com hipóteses, urgência e orientações",
    "Cadastrar novos pacientes",
    "Agendar consultas por especialidade",
    "Remarcar consultas",
    "Agendar exames",
    "Listar médicos por especialidade",
  ],
  tools: [
    "get_patient_record",
    "check_symptoms",
    "schedule_appointment",
    "register_patient",
    "reschedule_appointment",
  ],
  /** As escritas pedem a palavra magica; as leituras sao abertas. */
  writesRequireMagicWord: true,
  mcp: { transport: "http", endpoint: "/api/mcp" },
  endpoints: {
    manifest: "/api/manifest",
    patients: "/api/patients?q=&admitted=",
    doctors: "/api/doctors?specialty=",
    symptoms: "/api/symptoms?symptoms=febre,tosse",
    appointments: "/api/appointments?patient=",
    exams: "/api/exams",
    mcp: "/api/mcp",
  },
  contact: { phone: db.hospital.phone, emergency: db.hospital.emergency },
};
