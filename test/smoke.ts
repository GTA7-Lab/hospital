import { handleRpc } from "../src/mcp";
import { toolList } from "../src/tools";
import {
  addHistoryEntry,
  checkSymptoms,
  listAppointments,
  listPatients,
  patientRecord,
  registerPatient,
  rescheduleAppointment,
  scheduleAppointment,
  scheduleExam,
} from "../src/service";

let failures = 0;

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}`, detail ?? "");
  }
}

console.log("dados");
check("6 pacientes carregados do JSON", listPatients().length === 6);
check("2 pacientes internados", listPatients({ admitted: true }).length === 2);
check("busca por nome parcial", listPatients({ q: "beatriz" })[0]?.name === "Beatriz Lima");

console.log("prontuario");
const carlos = patientRecord("pat-001");
check("Carlos esta internado", carlos.admitted === true);
check("quarto informado", carlos.admission?.room === "302-B");
check("historico ordenado do mais recente", carlos.medicalHistory[0].date === "2026-09-01");
check("nome do medico resolvido", carlos.medicalHistory[0].doctor === "Dra. Helena Marques");
check("busca por nome parcial", patientRecord("beatriz").id === "pat-002");

console.log("triagem");
const infarto = checkSymptoms(["dor no peito", "suor frio"]);
check("detecta emergencia", infarto.emergency === true);
check("recomenda cardiologia", infarto.recommendedSpecialty === "cardiologia");
const gripe = checkSymptoms(["febre", "tosse", "coriza"]);
check("acentuacao tolerada", checkSymptoms(["dor de cabeça"]).possibleConditions.length > 0);
check("gripe como hipotese principal", gripe.possibleConditions[0].condition === "Gripe");

console.log("palavra magica");
try {
  scheduleAppointment({ patient: "Beatriz", specialty: "cardiologia", date: "2026-10-01", time: "08:00" });
  check("sem palavra nao agenda", false);
} catch (e) {
  check("sem palavra nao agenda", (e as Error).message.includes("palavra mágica"));
}
try {
  scheduleAppointment({
    patient: "Beatriz",
    specialty: "cardiologia",
    date: "2026-10-01",
    time: "08:00",
    magicWord: "abracadabra",
  });
  check("palavra errada nao agenda", false);
} catch (e) {
  check("palavra errada nao agenda", (e as Error).message.includes("palavra mágica"));
}
check("nada foi gravado sem a palavra", listAppointments("Beatriz").length === 1);
try {
  scheduleExam({ patient: "Beatriz", exam: "Raio-X", date: "2026-10-02", time: "08:00" });
  check("exame tambem exige a palavra", false);
} catch (e) {
  check("exame tambem exige a palavra", (e as Error).message.includes("palavra mágica"));
}
try {
  addHistoryEntry({ patient: "Beatriz", type: "consulta", description: "teste" });
  check("historico tambem exige a palavra", false);
} catch (e) {
  check("historico tambem exige a palavra", (e as Error).message.includes("palavra mágica"));
}
check("leitura segue aberta", patientRecord("Beatriz").name === "Beatriz Lima");
check("triagem segue aberta", checkSymptoms(["febre"]).possibleConditions.length > 0);

console.log("agendamento");
const apt = scheduleAppointment({
  patient: "Beatriz",
  specialty: "cardiologia",
  date: "2026-10-01",
  time: "08:00",
  magicWord: "HEART ",
});
check("palavra aceita sem caixa e espaco", apt.id.startsWith("apt-"));
check("consulta criada", apt.status === "agendada" && apt.doctor === "Dra. Helena Marques");
check("aparece no prontuario", patientRecord("pat-002").appointments.some((a) => a.id === apt.id));
try {
  scheduleAppointment({
    patient: "Beatriz",
    specialty: "cardiologia",
    date: "2026-10-01",
    time: "08:00",
    magicWord: "heart",
  });
  check("conflito de horario rejeitado", false);
} catch (e) {
  check("conflito de horario rejeitado", (e as Error).message.includes("já tem uma consulta"));
}
try {
  scheduleAppointment({
    patient: "Beatriz",
    specialty: "cardiologia",
    date: "01/10/2026",
    time: "08:00",
    magicWord: "heart",
  });
  check("data invalida rejeitada", false);
} catch (e) {
  check("data invalida rejeitada", (e as Error).message.includes("Não entendi a data"));
}

console.log("paciente novo");
try {
  registerPatient({ name: "Tereza Nunes", birthDate: "1999-02-11" });
  check("cadastro exige a palavra", false);
} catch (e) {
  check("cadastro exige a palavra", (e as Error).message.includes("palavra mágica"));
}
const novo = registerPatient({
  name: "Tereza Nunes",
  birthDate: "1999-02-11",
  bloodType: "O+",
  allergies: ["látex"],
  magicWord: "heart",
});
check("paciente novo ganhou prontuario", novo.id === "pat-007");
check("entra na lista", listPatients({ q: "tereza" }).length === 1);
check("comeca sem internacao e sem historico", novo.admission === null && novo.medicalHistory.length === 0);
try {
  registerPatient({ name: "tereza nunes", birthDate: "1999-02-11", magicWord: "heart" });
  check("nao duplica paciente", false);
} catch (e) {
  check("nao duplica paciente", (e as Error).message.includes("já tem prontuário"));
}
try {
  registerPatient({ name: "Alguem", birthDate: "2099-01-01", magicWord: "heart" });
  check("recusa nascimento no futuro", false);
} catch (e) {
  check("recusa nascimento no futuro", (e as Error).message.includes("futuro"));
}
const consultaNova = scheduleAppointment({
  patient: "Tereza",
  specialty: "clinica_geral",
  date: "2026-12-10",
  time: "11:00",
  magicWord: "heart",
});
check("da para agendar para o paciente novo", consultaNova.patientName === "Tereza Nunes");

console.log("remarcacao");
try {
  rescheduleAppointment({ appointment: consultaNova.id, date: "2026-12-11", time: "15:00" });
  check("remarcacao exige a palavra", false);
} catch (e) {
  check("remarcacao exige a palavra", (e as Error).message.includes("palavra mágica"));
}
const remarcada = rescheduleAppointment({
  appointment: consultaNova.id,
  date: "2026-12-11",
  time: "15:00",
  magicWord: "heart",
});
check("guarda de onde veio", remarcada.previousDate === "2026-12-10" && remarcada.previousTime === "11:00");
check("mantem o mesmo numero", remarcada.id === consultaNova.id);
check("mantem o mesmo medico", remarcada.doctor === consultaNova.doctor);
check("nao cria consulta nova", listAppointments("Tereza").length === 1);
const porNome = rescheduleAppointment({
  appointment: "Tereza",
  date: "2026-12-12",
  time: "16:00",
  magicWord: "heart",
});
check("aceita o nome quando so ha uma consulta", porNome.date === "2026-12-12");
try {
  rescheduleAppointment({ appointment: "Beatriz", date: "2026-12-20", time: "10:00", magicWord: "heart" });
  check("pede o numero quando ha varias", false);
} catch (e) {
  check("pede o numero quando ha varias", (e as Error).message.includes("mais de uma consulta"));
}

console.log("mcp");
const init: any = handleRpc({ jsonrpc: "2.0", id: 1, method: "initialize" });
check("initialize responde protocolVersion", init.result.protocolVersion === "2025-06-18");
check("notificacao nao gera resposta", handleRpc({ jsonrpc: "2.0", method: "notifications/initialized" }) === null);
const list: any = handleRpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
check("5 tools expostas", list.result.tools.length === 5, list.result.tools);
const call: any = handleRpc({
  jsonrpc: "2.0",
  id: 3,
  method: "tools/call",
  params: { name: "get_patient_record", arguments: { patient: "Joaquim" } },
});
check("tools/call devolve conteudo estruturado", call.result.structuredContent.admitted === true);
const err: any = handleRpc({
  jsonrpc: "2.0",
  id: 4,
  method: "tools/call",
  params: { name: "get_patient_record", arguments: { patient: "ninguem" } },
});
check("paciente inexistente vira isError", err.result.isError === true);

console.log("texto para o usuario");
const texto: string = call.result.content[0].text;
check("nao vaza JSON no texto", !texto.includes("{") && !texto.includes('"'));
check("nao vaza chave tecnica", !/patientId|doctorId|bloodType|admission/.test(texto));
check("diz a internacao sem marcar genero", texto.includes("no quarto 108-A"));
check("nao arrisca genero do paciente", !/internad[oa]\b/.test(texto));
check("data por extenso", texto.includes("28 de agosto de 2026"));
check("cita o medico pelo nome", texto.includes("Dra. Rita Nakamura"));

const triagem: any = handleRpc({
  jsonrpc: "2.0",
  id: 5,
  method: "tools/call",
  params: { name: "check_symptoms", arguments: { symptoms: ["dor no peito", "suor frio"] } },
});
const textoTriagem: string = triagem.result.content[0].text;
check("abre falando do sintoma", textoTriagem.startsWith("Pelo que você descreveu"));
check("avisa da emergencia", textoTriagem.includes("emergência"));
check("manda ligar 192", textoTriagem.includes("192"));
check("nao mostra score", !textoTriagem.includes("score") && !textoTriagem.includes("0."));

const semPalavra: any = handleRpc({
  jsonrpc: "2.0",
  id: 6,
  method: "tools/call",
  params: {
    name: "schedule_appointment",
    arguments: { patient: "Marina", specialty: "pediatria", date: "2026-12-01", time: "09:00" },
  },
});
check("MCP bloqueia escrita sem a palavra", semPalavra.result.isError === true);
check(
  "MCP explica que falta a palavra",
  semPalavra.result.content[0].text.includes("palavra mágica")
);
check("nada foi gravado pelo MCP", listAppointments("Marina").length === 1);

const comPalavra: any = handleRpc({
  jsonrpc: "2.0",
  id: 7,
  method: "tools/call",
  params: {
    name: "schedule_appointment",
    arguments: {
      patient: "Marina",
      specialty: "pediatria",
      date: "2026-12-01",
      time: "09:00",
      magic_word: "heart",
    },
  },
});
check("MCP agenda com a palavra", comPalavra.result.isError === undefined);
check("resposta do agendamento e amigavel", comPalavra.result.content[0].text.startsWith("Consulta marcada"));
check(
  "palavra magica esta no schema da tool",
  toolList.find((t) => t.name === "schedule_appointment")?.inputSchema.required.includes("magic_word") === true
);
check(
  "tools de leitura nao pedem a palavra",
  ["get_patient_record", "check_symptoms"].every(
    (n) => !JSON.stringify(toolList.find((t) => t.name === n)?.inputSchema).includes("magic_word")
  )
);

const erroTexto: string = err.result.content[0].text;
check("erro e amigavel", erroTexto.startsWith("Não encontrei ninguém"));
check("erro nao tem termo tecnico", !/404|null|undefined|error/i.test(erroTexto));

console.log(failures === 0 ? "\nTodos os testes passaram." : `\n${failures} teste(s) falharam.`);
process.exit(failures === 0 ? 0 : 1);
