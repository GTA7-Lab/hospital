import { handleRpc } from "../src/mcp";
import { checkSymptoms, listPatients, patientRecord, scheduleAppointment } from "../src/service";

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

console.log("agendamento");
const apt = scheduleAppointment({
  patient: "Beatriz",
  specialty: "cardiologia",
  date: "2026-10-01",
  time: "08:00",
});
check("consulta criada", apt.status === "agendada" && apt.doctor === "Dra. Helena Marques");
check("aparece no prontuario", patientRecord("pat-002").appointments.some((a) => a.id === apt.id));
try {
  scheduleAppointment({ patient: "Beatriz", specialty: "cardiologia", date: "2026-10-01", time: "08:00" });
  check("conflito de horario rejeitado", false);
} catch (e) {
  check("conflito de horario rejeitado", (e as Error).message.includes("já tem uma consulta"));
}
try {
  scheduleAppointment({ patient: "Beatriz", specialty: "cardiologia", date: "01/10/2026", time: "08:00" });
  check("data invalida rejeitada", false);
} catch (e) {
  check("data invalida rejeitada", (e as Error).message.includes("Não entendi a data"));
}

console.log("mcp");
const init: any = handleRpc({ jsonrpc: "2.0", id: 1, method: "initialize" });
check("initialize responde protocolVersion", init.result.protocolVersion === "2025-06-18");
check("notificacao nao gera resposta", handleRpc({ jsonrpc: "2.0", method: "notifications/initialized" }) === null);
const list: any = handleRpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
check("3 tools expostas", list.result.tools.length === 3, list.result.tools);
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

const erroTexto: string = err.result.content[0].text;
check("erro e amigavel", erroTexto.startsWith("Não encontrei ninguém"));
check("erro nao tem termo tecnico", !/404|null|undefined|error/i.test(erroTexto));

console.log(failures === 0 ? "\nTodos os testes passaram." : `\n${failures} teste(s) falharam.`);
process.exit(failures === 0 ? 0 : 1);
