# Hospital Central GTA7

Entidade `hospital` da cidade digital **GTA7 Lab**.

## Objetivo

Prontuarios e historico medico, triagem por sintomas, agendamento de consultas e
exames, e status de internacao dos pacientes da cidade.

## Estrutura do JSON (`data/hospital.json`)

```
hospital      { id, name, address, phone, emergency, openHours }
specialties   string[]
doctors       [{ id, name, specialty, crm, days[] }]
patients      [{ id, name, birthDate, bloodType, allergies[], chronicConditions[],
                 admission: null | { room, since, reason },
                 medicalHistory: [{ date, type, description, doctorId }] }]
appointments  [{ id, patientId, doctorId, specialty, date, time, status }]
exams         [{ id, patientId, name, date, time, status, result }]
conditions    [{ id, name, symptoms[], specialty, urgency, guidance }]
```

`type` do historico: consulta | exame | procedimento | tratamento.
`urgency`: baixa | media | alta | emergencia.

## MCP tools

| tool | parametros | retorno |
| --- | --- | --- |
| `get_patient_record` | `patient` (id ou nome) | prontuario completo + `admitted` + quarto |
| `check_symptoms` | `symptoms` (string[]) | hipoteses, urgencia, especialidade, orientacoes |
| `schedule_appointment` | `patient`, `specialty`, `date` (AAAA-MM-DD), `time` (HH:MM) | consulta criada com medico |

Transportes: HTTP (`/api/mcp`, JSON-RPC 2.0 via POST) e stdio (`npm run mcp`).

## Arquivos principais

```
manifest.json        manifesto no padrao das entidades da GTA7 Lab
data/hospital.json   dados da entidade
src/data.ts          carga em memoria, normalizacao, ids
src/service.ts       regras: busca, prontuario, triagem, agendamento
src/tools.ts         definicao das MCP tools
src/mcp.ts           nucleo JSON-RPC do MCP
src/routes.ts        handlers das rotas HTTP (usados pela Vercel e pelo servidor local)
src/http.ts          adaptador (req,res) -> handler
src/server.ts        servidor local sem dependencias
src/mcp-stdio.ts     transporte MCP stdio
src/manifest.ts      manifesto para o Core Orchestrator
api/*.ts             uma funcao Vercel por rota (wrappers de src/routes.ts)
public/index.html    interface (pacientes, triagem, agendamento)
test/smoke.ts        testes de fumaca
```

## Decisoes

- **Zero dependencias de runtime.** MCP JSON-RPC escrito a mao (~60 linhas) em vez de
  SDK; TypeScript e @types/node sao devDependencies.
- **CommonJS** (`tsc` -> `dist/`), para evitar atrito de ESM entre Node, tsc e a Vercel.
- **Dados em memoria.** O JSON e importado (empacotado pelo esbuild da Vercel), nao lido
  do disco. Escritas valem enquanto o processo vive; `HOSPITAL_PERSIST=1` grava no JSON
  local. Sem banco de dados nesta versao.
- **`src/routes.ts` como fonte unica**: as funcoes em `api/` e o servidor local usam os
  mesmos handlers.
- Busca de paciente aceita id ou nome parcial, sem acento e sem caixa.
- **Resposta das tools e texto para pessoa, nao JSON.** `content[].text` sai de
  `src/tools.ts` (funcoes `diz*`) com ajuda de `src/format.ts` (datas, idade, listas,
  rotulos). O JSON cru vai em `structuredContent`. As mensagens de erro de
  `src/service.ts` tambem sao escritas para o usuario final, porque chegam nele.
  Os dados em `data/hospital.json` sao acentuados por isso: aparecem citados no texto.
  Frases neutras de genero, ja que o JSON nao guarda genero do paciente.

## Status

Primeira versao completa e validada localmente: 21/21 testes passando, servidor local,
endpoint MCP HTTP e transporte stdio testados de ponta a ponta.

A entidade vive em repositorio proprio, `GTA7-Lab/hospital` (publico), com o projeto na
raiz. Antes ficava em `entities/hospital/` no monorepo `GTA7-Lab/gta7-lab`; o branch
`entidade/hospital` de la foi apagado.

Deploy na Vercel **no ar e testado em producao**:
https://gta7-hospital-e-vision-09ff.vercel.app

Projeto `gta7-hospital` no escopo `e-vision-09ff`, criado por upload direto de arquivos.
Validado em producao: UI, `/api/patients`, `tools/list`, `get_patient_record`,
`schedule_appointment`, o caminho de erro (`isError`) e o rewrite `/mcp`.

O primeiro deploy falhou porque foi subido antes da correcao do TS2322 em `src/http.ts`.

Pendencias:

- **Ligar o projeto Vercel ao repo** `GTA7-Lab/hospital` para deploy automatico a cada
  commit (sem root directory: o projeto esta na raiz). Hoje o deploy e por upload manual.
  Precisa ser feito no painel: `create_git_project` nao reconecta projeto existente.
- **Registro no Core** em `core/data/entities.json`, com a tag `health` acrescentada a
  `core/src/lexicon.ts`. O snippet pronto, com a URL real, esta no README da entidade.
- O token do conector Vercel nao tem escopo de leitura/gestao no time `e-vision-09ff`
  (`403 - must re-authenticate to this scope`), entao logs de build e configuracoes do
  projeto so pelo painel.

## Comandos

```
npm install
npm test        # compila e roda os testes
npm run dev     # http://localhost:3000
npm run mcp     # servidor MCP stdio
```

## Proxima tarefa

Push para o GitHub, desligar a protecao da Vercel, ligar o repo ao projeto e registrar
o endpoint MCP no Core Orchestrator.
