/**
 * Texto que o usuario final le nas respostas das MCP tools.
 *
 * As tools devolvem duas coisas: `structuredContent`, com os dados crus para
 * quem for processar, e `content[].text`, que e o que aparece para uma pessoa.
 * Este arquivo cuida do segundo: nada de JSON, chave tecnica ou codigo interno
 * no meio da frase.
 */

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** 2026-09-01 -> 01/09/2026 */
export function data(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
}

/** 2026-09-01 -> 1 de setembro de 2026 */
export function dataPorExtenso(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  const nome = MESES[Number(mes) - 1];
  if (!nome || !dia || !ano) return iso;
  return `${Number(dia)} de ${nome} de ${ano}`;
}

export function idade(nascimento: string, hoje = new Date()): number | null {
  const [a, m, d] = nascimento.split("-").map(Number);
  if (!a || !m || !d) return null;
  let anos = hoje.getFullYear() - a;
  const fezAniversario =
    hoje.getMonth() + 1 > m || (hoje.getMonth() + 1 === m && hoje.getDate() >= d);
  if (!fezAniversario) anos--;
  return anos;
}

/** Os slugs sao identificadores da API; aqui viram nome legivel. */
const ESPECIALIDADES: Record<string, string> = {
  clinica_geral: "clínica geral",
  gastroenterologia: "gastroenterologia",
};

export function especialidade(slug: string): string {
  return ESPECIALIDADES[slug] ?? slug.replace(/_/g, " ");
}

const URGENCIAS: Record<string, string> = {
  baixa: "baixa",
  media: "média",
  alta: "alta",
  emergencia: "emergência",
};

export function urgencia(slug: string): string {
  return URGENCIAS[slug] ?? slug;
}

/** ["a", "b", "c"] -> "a, b e c" */
export function lista(itens: string[]): string {
  if (itens.length === 0) return "";
  if (itens.length === 1) return itens[0];
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

export function paragrafos(partes: (string | null | undefined)[]): string {
  return partes.filter(Boolean).join("\n\n");
}
