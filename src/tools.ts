import { checkSymptoms, patientRecord, scheduleAppointment } from "./service";
import { data, dataPorExtenso, especialidade, idade, lista, paragrafos, urgencia } from "./format";

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
  /** Texto que a pessoa le. O JSON vai separado, em structuredContent. */
  say: (result: any) => string;
}

const URGENCIA_TEXTO: Record<string, string> = {
  emergencia: "É uma emergência: procure atendimento agora.",
  alta: "Merece atendimento hoje, sem esperar.",
  media: "Vale marcar uma consulta nos próximos dias.",
  baixa: "Dá para cuidar em casa e observar.",
};

function dizProntuario(p: any): string {
  const anos = idade(p.birthDate);
  const abertura = `${p.name}${anos !== null ? `, ${anos} anos` : ""}, tipo sanguíneo ${p.bloodType}.`;

  // sem genero nos dados: frases neutras servem para qualquer paciente
  const internacao = p.admitted
    ? `Está no hospital agora, no quarto ${p.admission.room}, desde ${dataPorExtenso(
        p.admission.since
      )}. Motivo da internação: ${p.admission.reason.toLowerCase()}.`
    : "Sem internação no momento.";

  const alergias = p.allergies.length
    ? `Alergia a ${lista(p.allergies)}.`
    : "Nenhuma alergia registrada.";
  const cronicas = p.chronicConditions.length
    ? `Convive com ${lista(p.chronicConditions)}.`
    : "Nenhuma condição crônica registrada.";

  const historico = p.medicalHistory.length
    ? "No histórico médico:\n" +
      p.medicalHistory
        .map((h: any) => `• ${data(h.date)} — ${h.type} com ${h.doctor}: ${h.description}`)
        .join("\n")
    : "Ainda não há nada no histórico médico.";

  const consultas = p.appointments.length
    ? "Consultas marcadas:\n" +
      p.appointments
        .map(
          (a: any) =>
            `• ${data(a.date)} às ${a.time}, ${especialidade(a.specialty)}, com ${a.doctor}`
        )
        .join("\n")
    : "Não há consultas marcadas.";

  const exames = p.exams.length
    ? "Exames:\n" +
      p.exams
        .map(
          (e: any) =>
            `• ${data(e.date)} às ${e.time} — ${e.name} (${e.status})` +
            (e.result ? `. Resultado: ${e.result}` : "")
        )
        .join("\n")
    : "Não há exames registrados.";

  return paragrafos([
    abertura,
    internacao,
    `${alergias} ${cronicas}`,
    historico,
    consultas,
    exames,
  ]);
}

function dizTriagem(r: any): string {
  const sintomas = lista(r.symptoms);

  if (r.possibleConditions.length === 0) {
    return paragrafos([
      `Não encontrei nada no meu banco que combine com ${sintomas}.`,
      `O melhor caminho é marcar uma consulta de clínica geral para uma avaliação.`,
      r.disclaimer,
    ]);
  }

  const principal = r.possibleConditions[0];
  const abertura =
    `Pelo que você descreveu (${sintomas}), a hipótese mais provável é ${principal.condition.toLowerCase()}.`;

  // nextStep fica so no structuredContent: aqui ele repetiria a orientacao
  const conduta = `${URGENCIA_TEXTO[principal.urgency] ?? ""} ${principal.guidance}`.trim();

  const outras = r.possibleConditions.slice(1);
  const alternativas = outras.length
    ? "Outras possibilidades que os mesmos sintomas levantam:\n" +
      outras
        .map((c: any) => `• ${c.condition} — urgência ${urgencia(c.urgency)}. ${c.guidance}`)
        .join("\n")
    : null;

  const encaminhamento = `No Hospital Central GTA7, quem cuida disso é ${especialidade(
    r.recommendedSpecialty
  )}.`;

  return paragrafos([abertura, conduta, alternativas, encaminhamento, r.disclaimer]);
}

function dizAgendamento(a: any): string {
  return paragrafos([
    `Consulta marcada para ${a.patientName}.`,
    `${a.doctor} vai atender em ${especialidade(a.specialty)} no dia ${dataPorExtenso(
      a.date
    )}, às ${a.time}.`,
    `Se precisar remarcar ou cancelar, o número da consulta é ${a.id}.`,
  ]);
}

/** Tools MCP oferecidas ao Core Orchestrator da GTA7 Lab. */
export const tools: ToolDef[] = [
  {
    name: "get_patient_record",
    title: "Prontuário do paciente",
    description:
      "Retorna o prontuário de um paciente do Hospital Central GTA7: dados básicos, alergias, condições crônicas, histórico médico, consultas e exames, e se ele está internado (com quarto e motivo).",
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
    say: dizProntuario,
  },
  {
    name: "check_symptoms",
    title: "Triagem por sintomas",
    description:
      "Compara os sintomas informados com o banco de doenças do hospital e retorna hipóteses diagnósticas, nível de urgência, especialidade recomendada e orientações de saúde.",
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
    say: dizTriagem,
  },
  {
    name: "schedule_appointment",
    title: "Agendar consulta",
    description:
      "Agenda uma consulta para um paciente em uma especialidade, data e hora. Retorna a consulta criada com o médico atribuído.",
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
    say: dizAgendamento,
  },
];

/** Executa uma tool e devolve o resultado no formato de conteudo do MCP. */
export function callTool(name: string, args: Record<string, any>) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: "O Hospital Central GTA7 não sabe fazer isso. Ele consulta prontuários, faz triagem por sintomas e marca consultas.",
        },
      ],
    };
  }
  try {
    const result = tool.run(args ?? {});
    return {
      content: [{ type: "text", text: tool.say(result) }],
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
