import { checkSymptoms, patientRecord, scheduleAppointment } from "./service";

export interface ToolDef {
  name: string;
  title: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties: false;
  };
  run: (args: Record<string, any>) => unknown;
}

/** Tools MCP oferecidas ao Core Orchestrator da GTA7 Lab. */
export const tools: ToolDef[] = [
  {
    name: "get_patient_record",
    title: "Prontuario do paciente",
    description:
      "Retorna o prontuario de um paciente do Hospital Central GTA7: dados basicos, alergias, condicoes cronicas, historico medico, consultas e exames, e se ele esta internado (com quarto e motivo).",
    inputSchema: {
      type: "object",
      properties: {
        patient: {
          type: "string",
          description: "Id do paciente (ex.: pat-001) ou parte do nome (ex.: Carlos)",
        },
      },
      required: ["patient"],
      additionalProperties: false,
    },
    run: (args) => patientRecord(String(args.patient ?? "")),
  },
  {
    name: "check_symptoms",
    title: "Triagem por sintomas",
    description:
      "Compara os sintomas informados com o banco de doencas do hospital e retorna hipoteses diagnosticas, nivel de urgencia, especialidade recomendada e orientacoes de saude.",
    inputSchema: {
      type: "object",
      properties: {
        symptoms: {
          type: "array",
          items: { type: "string" },
          description: 'Lista de sintomas, ex.: ["febre", "tosse"]',
        },
      },
      required: ["symptoms"],
      additionalProperties: false,
    },
    run: (args) => {
      const raw = args.symptoms;
      const list = Array.isArray(raw)
        ? raw.map(String)
        : String(raw ?? "")
            .split(",")
            .map((s) => s.trim());
      return checkSymptoms(list);
    },
  },
  {
    name: "schedule_appointment",
    title: "Agendar consulta",
    description:
      "Agenda uma consulta para um paciente em uma especialidade, data e hora. Retorna a consulta criada com o medico atribuido.",
    inputSchema: {
      type: "object",
      properties: {
        patient: { type: "string", description: "Id do paciente ou parte do nome" },
        specialty: {
          type: "string",
          description:
            "Especialidade: clinica_geral, cardiologia, ortopedia, pediatria, neurologia, dermatologia ou gastroenterologia",
        },
        date: { type: "string", description: "Data no formato AAAA-MM-DD" },
        time: { type: "string", description: "Hora no formato HH:MM" },
      },
      required: ["patient", "specialty", "date", "time"],
      additionalProperties: false,
    },
    run: (args) =>
      scheduleAppointment({
        patient: String(args.patient ?? ""),
        specialty: String(args.specialty ?? ""),
        date: String(args.date ?? ""),
        time: String(args.time ?? ""),
      }),
  },
];

/** Executa uma tool e devolve o resultado no formato de conteudo do MCP. */
export function callTool(name: string, args: Record<string, any>) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    return {
      isError: true,
      content: [{ type: "text", text: `Tool desconhecida: ${name}` }],
    };
  }
  try {
    const result = tool.run(args ?? {});
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result as Record<string, unknown>,
    };
  } catch (err) {
    return {
      isError: true,
      content: [{ type: "text", text: (err as Error).message }],
    };
  }
}

export const toolList = tools.map(({ name, title, description, inputSchema }) => ({
  name,
  title,
  description,
  inputSchema,
}));
