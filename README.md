# Hospital Central GTA7

Entidade **hospital** da cidade [GTA7 Lab](https://github.com/GTA7-Lab/gta7-lab). É o serviço de saúde da
cidade: guarda o prontuário dos moradores, faz triagem a partir de sintomas, mostra quem
está internado e agenda consultas e exames.

Sem banco de dados e **sem nenhuma dependência de runtime** — os dados vêm de
`data/hospital.json` e o servidor MCP é JSON-RPC escrito à mão. TypeScript e
`@types/node` são as únicas dependências, e são de desenvolvimento.

## Dados

Um único JSON, carregado em memória na subida do processo:

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

`type` do histórico é `consulta`, `exame`, `procedimento` ou `tratamento`.
`urgency` é `baixa`, `media`, `alta` ou `emergencia`.

`admission` é o campo que responde "essa pessoa está internada?" — `null` quando não
está, e o quarto, a data de entrada e o motivo quando está.

`conditions` é o banco de sintomas e doenças: é contra ele que a triagem compara o que a
pessoa relata. São 8 quadros mapeados, de gripe a infarto.

Escritas (agendamentos, novos registros) valem enquanto o processo estiver de pé — na
Vercel o sistema de arquivos é somente leitura. Localmente, `HOSPITAL_PERSIST=1` grava as
alterações de volta no JSON.

## MCP tools

Transporte **http** em `POST /api/mcp` (JSON-RPC 2.0), e também **stdio** para rodar
local. As duas expõem exatamente as mesmas tools.

| tool | parâmetros | devolve |
|---|---|---|
| `get_patient_record` | `patient` — id (`pat-001`) ou parte do nome | prontuário completo, com `admitted`, quarto, histórico, consultas e exames |
| `check_symptoms` | `symptoms` — lista de sintomas | hipóteses ordenadas, `emergency`, urgência, especialidade recomendada e orientação |
| `register_patient` | `name`, `birth_date`, `magic_word` (+ `blood_type`, `allergies`, `chronic_conditions`) | o prontuário aberto, com o número novo |
| `schedule_appointment` | `patient`, `specialty`, `date` (AAAA-MM-DD), `time` (HH:MM), `magic_word` | a consulta criada, com o médico atribuído |
| `reschedule_appointment` | `appointment` (número da consulta ou nome do paciente), `date`, `time`, `magic_word` | a consulta remarcada, dizendo de quando era |

## A palavra mágica

As três tools que **escrevem** — cadastrar, agendar e remarcar — só funcionam com o
parâmetro `magic_word`. As de leitura seguem abertas, para o Core poder consultar e fazer
triagem sem segredo nenhum. A trava fica na camada de serviço, então vale igual para o
MCP e para a API HTTP: `POST /api/appointments` sem a palavra é recusado do mesmo jeito.

A palavra é aceita sem diferenciar maiúsculas, acentos ou espaços em volta. Quem chama
sem ela recebe um pedido em português, não um `401`.

Isto é um portão de demonstração, **não autenticação**: a palavra viaja no próprio pedido
e o valor padrão está num repositório público. `HOSPITAL_MAGIC_WORD` troca o valor sem
mexer no código.

A busca por paciente é tolerante: aceita id ou nome parcial, sem acento e sem
diferenciar maiúsculas. `check_symptoms` faz o mesmo com os sintomas, então "dor de
cabeça" e "dor de cabeca" caem no mesmo lugar.

**As respostas são escritas para uma pessoa ler.** Cada tool devolve duas coisas: o texto
em `content[].text`, em português corrido, sem JSON, sem chave técnica e sem código
interno; e os dados crus em `structuredContent`, para quem for processar. Os erros seguem
a mesma regra — "Não encontrei ninguém chamado X nos registros", não `404 not found`.
Como os dados não guardam gênero, o texto usa frases neutras ("Sem internação no
momento") em vez de arriscar "internado" ou "internada".

```bash
curl -X POST https://gta7-hospital-e-vision-09ff.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"check_symptoms",
                 "arguments":{"symptoms":["dor no peito","suor frio"]}}}'
```

```json
{
  "emergency": true,
  "recommendedSpecialty": "cardiologia",
  "nextStep": "Procurar o pronto-socorro agora ou ligar 192.",
  "possibleConditions": [
    { "condition": "Infarto agudo do miocardio", "urgency": "emergencia", "score": 0.4 }
  ]
}
```

A triagem é informativa e diz isso na própria resposta, no campo `disclaimer`: ela
orienta e encaminha, não substitui avaliação médica.

## HTTP

| rota | o que faz |
|---|---|
| `GET /api/manifest` | manifesto da entidade para o Core |
| `GET /api/hospital` | dados do hospital, especialidades e contadores |
| `GET /api/patients?q=&admitted=` | lista pacientes, filtrando por nome e internação |
| `GET /api/patients?patient=pat-001` | prontuário completo |
| `POST /api/patients` | cadastra paciente — `name`, `birth_date`, `magic_word` |
| `GET /api/doctors?specialty=` | médicos por especialidade |
| `GET /api/symptoms?symptoms=febre,tosse` | triagem |
| `GET/POST/PATCH /api/appointments` | consultas — POST marca, PATCH remarca (`appointment`, `date`, `time`) |
| `GET/POST /api/exams` | exames — POST com `patient`, `exam`, `date`, `time` |
| `POST /api/history` | novo registro no histórico — `patient`, `type`, `description` |

Todo POST e PATCH da tabela pede `magic_word` junto.
| `POST /api/mcp` | endpoint MCP |

A interface em `public/index.html` usa essas rotas: busca de pacientes com o status de
internação, prontuário ao clicar, triagem e agendamento.

## Rodando

```bash
npm install
npm test      # compila e roda os testes de fumaça
npm run dev   # http://localhost:3000
npm run mcp   # servidor MCP stdio
```

`npm test` cobre carga do JSON, filtro de internados, busca sem acento, ordenação do
histórico, detecção de emergência, conflito de horário, data inválida e o ciclo MCP
(`initialize`, `tools/list`, `tools/call`, notificação sem resposta).

Para conectar no Claude Code:

```bash
claude mcp add --transport http hospital https://gta7-hospital-e-vision-09ff.vercel.app/api/mcp   # remoto
claude mcp add hospital -- node dist/src/mcp-stdio.js               # local, após npm run compile
```

## Estrutura

```
data/hospital.json   os dados da entidade
src/service.ts       busca, prontuário, triagem, agendamento
src/tools.ts         definição das MCP tools
src/mcp.ts           núcleo JSON-RPC do MCP
src/routes.ts        handlers HTTP, compartilhados pela Vercel e pelo servidor local
src/http.ts          adaptador (req, res) -> handler
src/server.ts        servidor local, sem dependências
src/mcp-stdio.ts     transporte MCP stdio
api/*.ts             uma função Vercel por rota, embrulhando src/routes.ts
public/index.html    interface
test/smoke.ts        testes de fumaça
```

Os dois transportes MCP e as duas formas de servir HTTP usam o mesmo código: `src/mcp.ts`
para o protocolo e `src/routes.ts` para as rotas. Não há uma segunda implementação para
manter em sincronia.

## Deploy

No ar em **https://gta7-hospital-e-vision-09ff.vercel.app** — a interface na raiz, a API
em `/api/*` e o MCP em `/api/mcp` (com atalho em `/mcp`).

Projeto próprio na Vercel, com este repositório na raiz — não há Root Directory a
configurar. Também não há etapa de build: `public/` é servido como estático e cada
arquivo de `api/` vira uma função.

## Registro no Core

```json
{
  "id": "hospital",
  "name": "Hospital Central GTA7",
  "transport": "http",
  "endpoint": "https://gta7-hospital-e-vision-09ff.vercel.app/api/mcp",
  "tags": ["health"],
  "tools": [
    { "name": "check_symptoms", "kind": "search", "argsMap": { "query": "symptoms" } },
    { "name": "get_patient_record", "kind": "detail", "argsMap": {} }
  ]
}
```

A tag `health` é nova, então as palavras-chave dela (sintoma, dor, febre, médico,
consulta, exame, hospital, internado) precisam entrar em `core/src/lexicon.ts` para o
Core acionar a entidade sozinho. Esses dois arquivos vivem no repositório do monorepo,
[GTA7-Lab/gta7-lab](https://github.com/GTA7-Lab/gta7-lab).
