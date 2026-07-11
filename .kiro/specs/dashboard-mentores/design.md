# Design Técnico — Dashboard de Mentores e Migração React

## Overview

Este documento cobre duas mudanças simultâneas e complementares na plataforma CloudCerto:

1. **Migração Frontend React** — reescrita do `index.html` + `app.js` + `style.css` (Vanilla JS) para uma SPA React 18 com Vite, mantendo deploy estático em S3/CloudFront sem alterações na infra existente.
2. **Dashboard de Mentores** — três novas Lambdas Python 3.12, uma nova tabela DynamoDB (`Historico_Simulados` com GSI), duas novas rotas no API Gateway e uma tela exclusiva para usuários do grupo Cognito `Mentores`.

A estratégia geral é de **adição sem ruptura**: o backend (API Gateway + Lambdas existentes) não muda de contrato, apenas recebe extensões. O Cognito e seus grupos (`Alunos`, `Mentores`) já existem. O Terraform expande os módulos existentes em vez de criar módulos novos paralelos.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (SPA React)                       │
│                                                                  │
│  AuthContext ──► ProtectedRoute ──► React Router (rotas)        │
│       │                                                          │
│  useApi (hook)  ──► fetch + Bearer token                        │
└──────────────────────────────┬──────────────────────────────────┘
                               │  HTTPS
                    ┌──────────▼──────────────┐
                    │  CloudFront + S3         │
                    │  (frontend/dist/ estático)│
                    └──────────────────────────┘

                               │  API calls
                    ┌──────────▼──────────────────────────────────┐
                    │         API Gateway HTTP API v2              │
                    │  JWT Authorizer (Cognito)                    │
                    │                                              │
                    │  GET /questoes               → GetQuestoes   │
                    │  POST /corrigir              → CorrigirProva │
                    │  GET /historico/{aluno_id}   → GetHistorico  │
                    │  GET /dashboard/turma/{id}   → GetDashboard  │
                    │  POST /turmas                → GerenciarTurmas│
                    │  GET  /turmas                → GerenciarTurmas│
                    │  GET  /turmas/{turma_id}     → GerenciarTurmas│
                    │  POST /turmas/entrar         → GerenciarTurmas│
                    └──────────────────────────────────────────────┘
                               │
                    ┌──────────▼──────────────────────────────────┐
                    │  DynamoDB                                    │
                    │                                              │
                    │  Simulados_AWS        (existente)            │
                    │  Historico_Simulados  (nova)                 │
                    │    PK:     USER#<sub>                        │
                    │    SK:     <data_iso>#<uuid4>                │
                    │    GSI1PK: TURMA#<turma_id>  (por turma)    │
                    │    GSI1SK: <aluno_id>#<data_iso>#<uuid4>    │
                    │  Turmas               (nova)                 │
                    │    PK=TURMA#<id>  SK=META       (metadata)  │
                    │    PK=TURMA#<id>  SK=ALUNO#<sub>(membro)    │
                    │    PK=MENTOR#<id> SK=TURMA#<id> (índice)    │
                    │    PK=ALUNO#<sub> SK=TURMA#<id> (índice)    │
                    │    GSI: codigo_convite                       │
                    └──────────────────────────────────────────────┘
```

### Fluxo de Autenticação (Cognito Implicit Flow → React)

```
1. Usuário não autenticado acessa /
2. ProtectedRoute detecta token ausente → redirect para Cognito Hosted UI
3. Cognito redireciona de volta para /?id_token=<JWT>#...
4. App.tsx monta → useEffect lê window.location.hash
5. Extrai id_token → chama login(token) no AuthContext
6. AuthContext: decodeJwt(token) → extrai sub, email, cognito:groups
7. Deriva papel: "Mentores" in groups → papel="Mentor", senão "Aluno"
8. history.replaceState limpa o hash da URL
9. React Router decide rota inicial: Mentor → /dashboard, Aluno → /
```

---

## Components and Interfaces

### Estrutura de Pastas — `frontend/src/`

```
frontend/
├── index.html              # Ponto de entrada do Vite (single root div)
├── vite.config.ts          # base: '/', build.outDir: 'dist'
├── package.json
└── src/
    ├── main.tsx            # ReactDOM.createRoot + BrowserRouter
    ├── App.tsx             # Definição de rotas (Routes/Route)
    ├── style.css           # CSS global atual (importado em main.tsx)
    │
    ├── context/
    │   └── AuthContext.tsx # Context + useReducer + Provider
    │
    ├── hooks/
    │   ├── useApi.ts       # fetch wrapper com Bearer token
    │   └── useTimer.ts     # lógica de cronômetro do simulado
    │
    ├── components/
    │   ├── ProtectedRoute.tsx      # Guarda de rota por papel
    │   ├── NavBar.tsx              # Cabeçalho + botão login/logout
    │   ├── LoadingSpinner.tsx      # Indicador de carregamento
    │   ├── CertBadge.tsx           # Badge colorido de certificação
    │   └── charts/
    │       ├── ScoreLineChart.tsx  # Evolução temporal (react-chartjs-2)
    │       ├── DomainBarChart.tsx  # Desempenho por domínio
    │       └── WeakDomainsChart.tsx# Top 5 domínios fracos da turma
    │
    ├── pages/
    │   ├── HomePage.tsx            # Rota /
    │   ├── ExamPage.tsx            # Rota /exam
    │   ├── ResultPage.tsx          # Rota /result
    │   ├── ReviewPage.tsx          # Rota /review
    │   ├── ProgressPage.tsx        # Rota /progress
    │   ├── DashboardTurmaPage.tsx  # Rota /dashboard (Mentor)
    │   └── DashboardAlunoPage.tsx  # Rota /dashboard/:alunoId (Mentor)
    │
    ├── utils/
    │   ├── jwt.ts          # decodeJwt, getGroups, getPapel
    │   ├── certMeta.ts     # CERT_META (cores, nomes) migrado do app.js
    │   ├── formatText.ts   # formatText() migrado do app.js
    │   └── antiRepeat.ts   # lógica anti-repeat de questões (localStorage)
    │
    └── types/
        └── index.ts        # Interfaces TypeScript: Questao, Resultado,
                            # RegistroHistorico, DashboardTurma, etc.
```

### Hierarquia de Componentes

```
App.tsx
└── AuthProvider (AuthContext)
    └── BrowserRouter
        └── NavBar (usa useAuth)
        └── Routes
            ├── / → HomePage (acesso livre autenticado)
            ├── /exam → ExamPage
            ├── /result → ResultPage
            ├── /review → ReviewPage
            ├── /progress → ProgressPage
            ├── /dashboard → ProtectedRoute(papel=Mentor) → DashboardTurmaPage
            │                   └── WeakDomainsChart
            │                   └── tabela de alunos com CertBadge
            └── /dashboard/:alunoId → ProtectedRoute(papel=Mentor)
                                        → DashboardAlunoPage
                                            └── ScoreLineChart
                                            └── DomainBarChart
```

### `AuthContext` — Interface

```typescript
// src/context/AuthContext.tsx

interface AuthState {
  token: string | null;
  sub: string | null;
  papel: 'Aluno' | 'Mentor' | null;
  email: string | null;
}

type AuthAction =
  | { type: 'LOGIN'; payload: { token: string } }
  | { type: 'LOGOUT' };

interface AuthContextValue extends AuthState {
  login: (token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

// Reducer — extração de claims acontece aqui
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN': {
      const claims = decodeJwt(action.payload.token);
      const groups: string[] = claims['cognito:groups'] ?? [];
      return {
        token: action.payload.token,
        sub: claims.sub,
        email: claims.email,
        papel: groups.includes('Mentores') ? 'Mentor' : 'Aluno',
      };
    }
    case 'LOGOUT':
      sessionStorage.removeItem('aws_mentoria_token');
      return { token: null, sub: null, papel: null, email: null };
  }
}
```

O `Provider` inicializa o estado lendo `sessionStorage.getItem('aws_mentoria_token')` na montagem. O `login(token)` grava o token em `sessionStorage` antes de despachar `LOGIN`.

### `ProtectedRoute` — Lógica de Guarda

```typescript
// src/components/ProtectedRoute.tsx
interface ProtectedRouteProps {
  requiredPapel: 'Mentor' | 'Aluno';
  children: ReactNode;
}

function ProtectedRoute({ requiredPapel, children }: ProtectedRouteProps) {
  const { token, papel } = useAuth();

  // Sem token: redireciona para o Cognito Hosted UI
  if (!token) {
    window.location.href = COGNITO_LOGIN_URL;
    return null;
  }

  // Token presente mas papel errado: volta para home
  if (papel !== requiredPapel) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
```

Apenas rotas `/dashboard` e `/dashboard/:alunoId` usam `ProtectedRoute` com `requiredPapel="Mentor"`. As demais rotas só exigem autenticação (token presente), verificada no `NavBar` e na lógica de carregamento de cada página.

### `useApi` — Hook de Fetch

```typescript
// src/hooks/useApi.ts
const API_BASE = import.meta.env.VITE_API_URL; // definido em .env e .env.production

function useApi() {
  const { token } = useAuth();

  async function apiFetch<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!res.ok) {
      throw new Error(`API error ${res.status}: ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }

  return { apiFetch };
}
```

`VITE_API_URL` em `.env.development` aponta para `http://localhost:3000` (proxy local) e em `.env.production` para `https://j982dfso4f.execute-api.us-east-1.amazonaws.com`.

### Fluxo de Dados do Simulado (ExamPage → ResultPage)

```
1. ExamPage monta → useEffect → apiFetch<Questao[]>('/questoes?prova=SAA-C03')
2. Estado local: examQuestions[], answers{}, flagged Set, timer (useTimer)
3. Usuário responde → answers[idx] = opcao_selecionada
4. Ao finalizar → apiFetch<Resultado>('/corrigir', {
     method: 'POST',
     body: JSON.stringify({
       prova: config.cert,
       questoes_ids: examQuestions.map(q => q.SK),
       respostas: answers,
       tempo_segundos: elapsedSeconds   // novo campo para persistência
     })
   })
5. Navigate('/result', { state: { resultado, examQuestions, answers } })
6. ResultPage lê location.state (não faz novo fetch)
```

O estado do simulado é passado via `location.state` do React Router entre `ExamPage → ResultPage → ReviewPage`, sem Redux nem Context de exam — mantém o modelo do `app.js` atual.

---

## Data Models

### TypeScript — Tipos Principais

```typescript
// src/types/index.ts

interface Questao {
  PK: string;
  SK: string;
  pergunta: string;
  opcoes: string[];
  num_respostas_corretas: number;
  temas: string[];
  explicacao?: string; // só presente no resultado
}

interface DetalheQuestao {
  id: string;
  status: 'correta' | 'errada' | 'pulada';
  resposta_usuario: number[] | null;
  resposta_correta: number[];
  explicacao: string;
}

interface Resultado {
  score: number;
  total: number;
  corretas: number;
  erradas: number;
  puladas: number;
  detalhes: DetalheQuestao[];
}

interface RegistroHistorico {
  id: string;           // SK do DynamoDB
  certificacao: string;
  score: number;
  corretas: number;
  erradas: number;
  puladas: number;
  total: number;
  tempo_segundos: number | null;
  data_iso: string;     // ISO 8601, ex: "2025-01-15T14:30:00Z"
  dominios: Record<string, number>; // { "Armazenamento": 75.0, ... }
}

interface AlunoResumido {
  aluno_id: string;
  email: string;
  score_medio: number;
  certificacoes: {
    cert: string;
    ultimo_score: number;
    tendencia: 'melhorando' | 'piorando' | 'estavel';
    total_simulados: number;
  }[];
}

interface DashboardTurma {
  alunos: AlunoResumido[];
  ranking: { aluno_id: string; email: string; score_medio: number }[];
  dominios_fracos: { dominio: string; media_acerto: number }[];
}
```

### DynamoDB — Tabela `Historico_Simulados`

**Schema de chaves — modelo multi-turma:**

| Atributo | Tipo | Uso |
|---|---|---|
| `PK` | String | `USER#<sub>` — histórico pessoal do aluno |
| `SK` | String | `<data_iso>#<uuid4>` — ordena cronologicamente |
| `GSI1PK` | String | `TURMA#<turma_id>` — por turma específica (ausente se aluno não tem turma) |
| `GSI1SK` | String | `<aluno_id>#<data_iso>#<uuid4>` |

**Aluno sem turma:** grava apenas PK/SK. Não aparece em nenhum dashboard.

**Aluno com 2 turmas:** grava 2 itens com o mesmo PK/SK base mas GSI1PKs diferentes (`TURMA#<id1>` e `TURMA#<id2>`). A visão pessoal do aluno (`GET /historico`) deduplica por SK.

**Item completo:**

```json
{
  "PK":           "USER#a1b2c3d4",
  "SK":           "2025-01-15T14:30:00Z#550e8400",
  "GSI1PK":       "TURMA#f47ac10b-58cc",
  "GSI1SK":       "a1b2c3d4#2025-01-15T14:30:00Z#550e8400",
  "aluno_id":     "a1b2c3d4",
  "email":        "aluno@exemplo.com",
  "turma_id":     "f47ac10b-58cc",
  "certificacao": "SAA-C03",
  "score":        78,
  "corretas":     39,
  "erradas":      8,
  "puladas":      3,
  "total":        50,
  "tempo_segundos": 2340,
  "data_iso":     "2025-01-15T14:30:00Z",
  "dominios": {
    "Armazenamento": 85.0,
    "Segurança": 75.0
  }
}
```

### DynamoDB — Tabela `Turmas`

Single-table design — 4 tipos de item na mesma tabela:

| PK | SK | Dados | Uso |
|---|---|---|---|
| `TURMA#<id>` | `META` | nome, mentor_id, mentor_email, codigo_convite, data_criacao | Metadata da turma |
| `TURMA#<id>` | `ALUNO#<sub>` | email, data_entrada | Aluno membro |
| `MENTOR#<sub>` | `TURMA#<id>` | nome_turma, turma_id | Listar turmas do mentor |
| `ALUNO#<sub>` | `TURMA#<id>` | nome_turma, turma_id | Listar turmas do aluno |

**GSI `codigo_convite`:** permite buscar a turma pelo código de 8 chars gerado no momento da criação.

**Padrões de acesso:**

| Operação | Query |
|---|---|
| Listar turmas do mentor | `PK = MENTOR#<sub>` |
| Listar turmas do aluno | `PK = ALUNO#<sub>` |
| Listar alunos de uma turma | `PK = TURMA#<id>`, SK `begins_with ALUNO#` |
| Entrar via código | GSI `codigo_convite = <codigo>` |
| Verificar membro | `GetItem PK=TURMA#<id>, SK=ALUNO#<sub>` |

---

## Backend — Novas Lambdas

### Lambda `SalvarHistorico`

**Localização:** `backend/salvar_historico/lambda_function.py`
**Trigger:** Chamada síncrona direta da `CorrigirProva` (SDK boto3 `invoke` mode `RequestResponse`), **não** via API Gateway.

**Responsabilidades:**
1. Recebe o resultado da correção + claims do JWT + `tempo_segundos` + itens do DynamoDB já carregados
2. Calcula o mapa `dominios` (percentual de acerto por tema)
3. Grava o item na tabela `Historico_Simulados`

**Integração com `CorrigirProva`:**

A `CorrigirProva` já busca os itens do DynamoDB para corrigir. Em vez de uma segunda Lambda separada, a persistência é implementada como uma **função interna** chamada `salvar_historico()` dentro da `CorrigirProva`, encapsulada em try/except para garantir tolerância a falhas (Requisito 3.3).

```python
# backend/corrigir/lambda_function.py — extensão

def calcular_dominios(questoes_ids, itens_db, detalhes):
    """
    Dado o mapa de detalhes (status por questão) e os itens do DynamoDB
    (que contêm o campo 'temas'), calcula o percentual de acerto por domínio.

    Returns: dict[str, float] — ex: {"Armazenamento": 75.0, "Rede": 60.0}
    """
    acertos_por_tema = {}  # tema -> [total, corretas]

    for idx, sk in enumerate(questoes_ids):
        item = itens_db.get(sk)
        if item is None:
            continue
        temas = item.get('temas', [])
        detalhe = next((d for d in detalhes if d['id'] == sk), None)
        if detalhe is None:
            continue
        for tema in temas:
            if tema not in acertos_por_tema:
                acertos_por_tema[tema] = [0, 0]  # [total, corretas]
            acertos_por_tema[tema][0] += 1
            if detalhe['status'] == 'correta':
                acertos_por_tema[tema][1] += 1

    return {
        tema: round((vals[1] / vals[0]) * 100, 1)
        for tema, vals in acertos_por_tema.items()
        if vals[0] > 0
    }


def salvar_historico(claims, prova, resultado, dominios, tempo_segundos):
    """
    Persiste o registro na tabela Historico_Simulados.
    Tolerante a falhas — exceções são logadas mas não propagadas.
    """
    import uuid
    from datetime import datetime, timezone

    aluno_id = claims.get('sub', '')
    email    = claims.get('email', '')
    data_iso = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    uid      = str(uuid.uuid4())

    item = {
        'PK':              {'S': f'USER#{aluno_id}'},
        'SK':              {'S': f'{data_iso}#{uid}'},
        'GSI1PK':          {'S': 'TURMA'},
        'GSI1SK':          {'S': f'{aluno_id}#{data_iso}#{uid}'},
        'aluno_id':        {'S': aluno_id},
        'email':           {'S': email},
        'certificacao':    {'S': prova},
        'score':           {'N': str(resultado['score'])},
        'corretas':        {'N': str(resultado['corretas'])},
        'erradas':         {'N': str(resultado['erradas'])},
        'puladas':         {'N': str(resultado['puladas'])},
        'total':           {'N': str(resultado['total'])},
        'data_iso':        {'S': data_iso},
        'dominios':        {'M': {k: {'N': str(v)} for k, v in dominios.items()}},
    }
    if tempo_segundos is not None:
        item['tempo_segundos'] = {'N': str(tempo_segundos)}
    else:
        item['tempo_segundos'] = {'NULL': True}

    dynamodb.put_item(TableName='Historico_Simulados', Item=item)
    print(f"Histórico salvo: {aluno_id} cert={prova} score={resultado['score']}")
```

**Extração de claims do JWT na Lambda:**

O API Gateway HTTP API v2 injeta o JWT decodificado em `event['requestContext']['authorizer']['jwt']['claims']`. A `CorrigirProva` já recebe este campo e o passa para `salvar_historico`.

```python
# No lambda_handler de CorrigirProva:
claims = (event.get('requestContext', {})
               .get('authorizer', {})
               .get('jwt', {})
               .get('claims', {}))
tempo_segundos = body.get('tempo_segundos')  # pode ser None
```

---

### Lambda `GetHistoricoAluno`

**Localização:** `backend/get_historico_aluno/lambda_function.py`
**Rota:** `GET /historico/{aluno_id}`

**Controle de acesso (executado dentro da Lambda, após o JWT Authorizer do API Gateway):**

```python
def verificar_acesso(claims, aluno_id_path):
    """
    Retorna True se o acesso é permitido:
    - sub do token == aluno_id_path (próprio aluno), OU
    - "Mentores" está em cognito:groups
    """
    sub    = claims.get('sub', '')
    groups = claims.get('cognito:groups', '')
    # API Gateway serializa listas como string separada por vírgula
    if isinstance(groups, str):
        groups = [g.strip() for g in groups.split(',') if g.strip()]
    return sub == aluno_id_path or 'Mentores' in groups
```

**Query DynamoDB:**

```python
# Query tabela principal por PK = USER#<aluno_id>
# ScanIndexForward=False para order decrescente (mais recente primeiro)
# Limit=100
response = dynamodb.query(
    TableName='Historico_Simulados',
    KeyConditionExpression='PK = :pk',
    ExpressionAttributeValues={':pk': {'S': f'USER#{aluno_id}'}},
    ScanIndexForward=False,
    Limit=100,
    **(  # filtro de certificação, se fornecido
        {'FilterExpression': 'certificacao = :cert',
         'ExpressionAttributeValues': {':pk': ..., ':cert': {'S': cert_filtro}}}
        if cert_filtro else {}
    )
)
```

> **Nota sobre filtro + Limit:** O DynamoDB aplica `Limit` antes do `FilterExpression`. Para garantir exatamente 100 registros filtrados com alunos ativos, a implementação usa paginação interna com `LastEvaluatedKey` até acumular 100 itens filtrados ou esgotar a tabela.

---

### Lambda `GetDashboardTurma`

**Localização:** `backend/get_dashboard_turma/lambda_function.py`
**Rota:** `GET /dashboard/turma`

**Controle de acesso:**

```python
groups = claims.get('cognito:groups', '')
if isinstance(groups, str):
    groups = [g.strip() for g in groups.split(',') if g.strip()]
if 'Mentores' not in groups:
    return {'statusCode': 403, 'body': json.dumps({'mensagem': 'Acesso restrito a Mentores.'})}
```

**Query via GSI:**

```python
response = dynamodb.query(
    TableName='Historico_Simulados',
    IndexName='GSI1-turma-index',
    KeyConditionExpression='GSI1PK = :turma',
    ExpressionAttributeValues={':turma': {'S': 'TURMA'}},
    ScanIndexForward=False
)
```

**Agregação (funções puras — testáveis independentemente):**

```python
def calcular_tendencia(scores_ordenados_por_data: list[int]) -> str:
    """
    scores_ordenados_por_data: lista de scores do MAIS ANTIGO para o MAIS RECENTE.
    Retorna 'melhorando', 'piorando' ou 'estavel'.
    """
    if len(scores_ordenados_por_data) < 2:
        return 'estavel'
    penultimo, ultimo = scores_ordenados_por_data[-2], scores_ordenados_por_data[-1]
    if ultimo > penultimo:
        return 'melhorando'
    if ultimo < penultimo:
        return 'piorando'
    return 'estavel'


def calcular_dominios_fracos(registros: list[dict], top_n: int = 5) -> list[dict]:
    """
    Agrega o campo 'dominios' de todos os registros,
    calcula a média por domínio e retorna os top_n com menor média.
    """
    soma_por_dominio = {}
    count_por_dominio = {}
    for reg in registros:
        for dominio, pct in reg.get('dominios', {}).items():
            soma_por_dominio[dominio] = soma_por_dominio.get(dominio, 0) + pct
            count_por_dominio[dominio] = count_por_dominio.get(dominio, 0) + 1

    medias = {
        d: round(soma_por_dominio[d] / count_por_dominio[d], 1)
        for d in soma_por_dominio
    }
    sorted_dominios = sorted(medias.items(), key=lambda x: x[1])
    return [{'dominio': d, 'media_acerto': m} for d, m in sorted_dominios[:top_n]]
```

---

## Terraform

### Estratégia: Extensão dos Módulos Existentes

Os módulos existentes são **estendidos** adicionando variáveis e recursos. Nenhum módulo novo é criado, mantendo a convenção do projeto.

### `infra/modules/dynamodb/` — Extensão

O módulo `dynamodb` ganha suporte a uma segunda tabela via adição de recursos no mesmo `main.tf`:

```hcl
# infra/modules/dynamodb/main.tf — ADIÇÃO ao arquivo existente

resource "aws_dynamodb_table" "historico_simulados" {
  name         = "Historico_Simulados"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI1-turma-index"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
  }

  tags = {
    Environment = "Mentoria"
    Project     = "SimuladosAWS"
  }
}
```

**`infra/modules/dynamodb/outputs.tf` — adição:**

```hcl
output "historico_table_arn" {
  value       = aws_dynamodb_table.historico_simulados.arn
  description = "ARN da tabela Historico_Simulados"
}

output "historico_table_name" {
  value       = aws_dynamodb_table.historico_simulados.name
}
```

### `infra/modules/lambda/` — Extensão

**`infra/modules/lambda/variables.tf` — adição:**

```hcl
variable "historico_table_arn" {
  type        = string
  description = "ARN da tabela Historico_Simulados para permissões IAM"
}
```

**`infra/modules/lambda/main.tf` — adições:**

```hcl
# Política expandida: adiciona PutItem e Query na tabela Historico
resource "aws_iam_role_policy" "historico_policy" {
  name = "policy_historico_simulados"
  role = aws_iam_role.lambda_exec_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:PutItem", "dynamodb:Query", "dynamodb:GetItem"]
        Resource = [
          var.historico_table_arn,
          "${var.historico_table_arn}/index/*"  # inclui o GSI
        ]
      }
    ]
  })
}

# Zips das novas Lambdas
data "archive_file" "lambda_get_historico_zip" {
  type        = "zip"
  source_dir  = "${path.root}/../backend/get_historico_aluno"
  output_path = "${path.root}/../backend/get_historico_aluno.zip"
}

data "archive_file" "lambda_dashboard_turma_zip" {
  type        = "zip"
  source_dir  = "${path.root}/../backend/get_dashboard_turma"
  output_path = "${path.root}/../backend/get_dashboard_turma.zip"
}

resource "aws_lambda_function" "get_historico_aluno" {
  filename         = data.archive_file.lambda_get_historico_zip.output_path
  function_name    = "GetHistoricoAluno"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.12"
  source_code_hash = data.archive_file.lambda_get_historico_zip.output_base64sha256
}

resource "aws_lambda_function" "get_dashboard_turma" {
  filename         = data.archive_file.lambda_dashboard_turma_zip.output_path
  function_name    = "GetDashboardTurma"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.12"
  source_code_hash = data.archive_file.lambda_dashboard_turma_zip.output_base64sha256
}
```

**`infra/modules/lambda/outputs.tf` — adição:**

```hcl
output "lambda_get_historico_invoke_arn" {
  value = aws_lambda_function.get_historico_aluno.invoke_arn
}

output "lambda_get_historico_function_name" {
  value = aws_lambda_function.get_historico_aluno.function_name
}

output "lambda_get_dashboard_turma_invoke_arn" {
  value = aws_lambda_function.get_dashboard_turma.invoke_arn
}

output "lambda_get_dashboard_turma_function_name" {
  value = aws_lambda_function.get_dashboard_turma.function_name
}
```

### `infra/modules/api_gateway/` — Extensão

**`infra/modules/api_gateway/variables.tf` — adições:**

```hcl
variable "lambda_get_historico_invoke_arn"      { type = string }
variable "lambda_get_historico_function_name"   { type = string }
variable "lambda_get_dashboard_turma_invoke_arn"     { type = string }
variable "lambda_get_dashboard_turma_function_name"  { type = string }
```

**`infra/modules/api_gateway/main.tf` — adições (novas integrações e rotas):**

```hcl
# Integração GetHistoricoAluno
resource "aws_apigatewayv2_integration" "lambda_get_historico" {
  api_id             = aws_apigatewayv2_api.http_api.id
  integration_type   = "AWS_PROXY"
  integration_uri    = var.lambda_get_historico_invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "get_historico_route" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "GET /historico/{aluno_id}"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_get_historico.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

resource "aws_lambda_permission" "api_gw_get_historico" {
  statement_id  = "AllowExecutionFromAPIGatewayGetHistorico"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_get_historico_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

# Integração GetDashboardTurma
resource "aws_apigatewayv2_integration" "lambda_dashboard_turma" {
  api_id             = aws_apigatewayv2_api.http_api.id
  integration_type   = "AWS_PROXY"
  integration_uri    = var.lambda_get_dashboard_turma_invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "get_dashboard_turma_route" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "GET /dashboard/turma"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_dashboard_turma.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

resource "aws_lambda_permission" "api_gw_dashboard_turma" {
  statement_id  = "AllowExecutionFromAPIGatewayDashboardTurma"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_get_dashboard_turma_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}
```

> O CORS já configurado no `aws_apigatewayv2_api.http_api` com `allow_methods = ["GET", "POST", "OPTIONS"]` cobre os novos paths automaticamente — o CORS do HTTP API v2 é por API, não por rota.

### `infra/main.tf` — Extensão

```hcl
module "dynamodb_historico" {
  source = "./modules/dynamodb"
  # O módulo dinâmico agora cria as duas tabelas internamente;
  # o ARN da tabela historico é exportado via outputs.
}

module "lambda_get_questoes" {
  source              = "./modules/lambda"
  dynamodb_table_arn  = module.dynamodb_simulados.table_arn
  historico_table_arn = module.dynamodb_simulados.historico_table_arn
}

module "api_gateway" {
  source = "./modules/api_gateway"
  # ...inputs existentes...
  lambda_get_historico_invoke_arn          = module.lambda_get_questoes.lambda_get_historico_invoke_arn
  lambda_get_historico_function_name       = module.lambda_get_questoes.lambda_get_historico_function_name
  lambda_get_dashboard_turma_invoke_arn    = module.lambda_get_questoes.lambda_get_dashboard_turma_invoke_arn
  lambda_get_dashboard_turma_function_name = module.lambda_get_questoes.lambda_get_dashboard_turma_function_name
}
```

---

## CI/CD — Atualização do `workflow.yml`

A mudança principal é adicionar um passo de build React antes do sync para o S3, e mudar o diretório de sync de `.` para `frontend/dist/`.

```yaml
# .github/workflows/workflow.yml — versão atualizada

name: Deploy Frontend to S3 and CloudFront
on:
  push:
    branches: [main]
    paths-ignore:
      - 'infra/**'
      - '*.txt'
      - '*.py'
      - '*.md'
  pull_request:
    branches: [main]
    paths-ignore:
      - 'infra/**'

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: frontend

      - name: Build React app
        run: npm run build
        working-directory: frontend
        env:
          VITE_API_URL: https://j982dfso4f.execute-api.us-east-1.amazonaws.com

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: us-east-1

      - name: Deploy to S3
        run: |
          aws s3 sync frontend/dist/ s3://${{ secrets.S3_BUCKET_NAME }} \
            --delete \
            --cache-control "max-age=31536000,immutable" \
            --exclude "index.html"
          # index.html não deve ter cache longo (referencia hashes de assets)
          aws s3 cp frontend/dist/index.html s3://${{ secrets.S3_BUCKET_NAME }}/index.html \
            --cache-control "no-cache,no-store,must-revalidate"

      - name: Invalidate CloudFront Cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_ID }} \
            --paths "/*"
```

**Mudanças em relação ao workflow atual:**
- Adicionado passo `Setup Node.js` e `npm ci` + `npm run build` em `frontend/`
- `VITE_API_URL` injetado como variável de ambiente do build (não vai para o repositório)
- `aws s3 sync` aponta para `frontend/dist/` em vez da raiz
- Estratégia de cache diferenciada: assets com hash imutáveis (`max-age=31536000`), `index.html` sem cache
- `paths-ignore` mantido: mudanças em `infra/**` não disparam este workflow

**Trigger para o `deploy-infra.yml`:** O `paths` já é `infra/**`, não muda.

---

## Correctness Properties

### Property 1: Consistência do Registro_Historico
Para qualquer simulado finalizado com sucesso (POST /corrigir retorna 200), o item gravado na `Historico_Simulados` deve satisfazer: `corretas + erradas + puladas == total` e `score == round((corretas / total) * 100)`.

**Validates: Requirements 3.1, 3.4**

### Property 2: Isolamento de acesso entre Alunos
Para qualquer requisição `GET /historico/{aluno_id}` onde o `sub` do token é diferente de `aluno_id` e `cognito:groups` não contém `"Mentores"`, o retorno deve ser sempre 403 — independentemente do conteúdo do path.

**Validates: Requirements 4.4**

### Property 3: Dominios_fracos são subconjunto dos dominios registrados
Os 5 domínios retornados por `GET /dashboard/turma` devem existir como chaves no campo `dominios` de pelo menos um Registro_Historico na tabela.

**Validates: Requirements 6.4**

### Property 4: Ranking ordenado
Para qualquer conjunto de Alunos com histórico, a lista `ranking` retornada pelo dashboard deve estar estritamente ordenada por `score_medio` decrescente.

**Validates: Requirements 6.3**

---

## Error Handling

| Situação | Comportamento | Status HTTP |
|---|---|---|
| Token JWT ausente ou inválido | API Gateway rejeita (JWT Authorizer) | 401 |
| Aluno tenta acessar histórico de outro aluno | Lambda retorna erro | 403 |
| Aluno tenta acessar `/dashboard/turma` | Lambda retorna erro | 403 |
| Falha ao salvar histórico no DynamoDB | `CorrigirProva` loga e retorna resultado normalmente | 200 (degraded) |
| `GET /historico/{aluno_id}` sem registros | Retorna lista vazia | 200 |
| `GET /dashboard/turma` sem alunos | Retorna estrutura vazia | 200 |
| Build React falha no CI | Workflow falha, S3 não é atualizado | — |
| Cognito Hosted UI inacessível | Frontend exibe mensagem de erro na tela de login | — |

---

## Testing Strategy

### Backend (Python — pytest)
- `CorrigirProva`: testes existentes + novo teste para `calcular_dominios()` e `salvar_historico()` (mock DynamoDB com `unittest.mock`)
- `GetHistoricoAluno`: testes unitários com mock DynamoDB — cenários de autorização (próprio aluno, mentor, outro aluno)
- `GetDashboardTurma`: testes de `calcular_tendencia()` e `calcular_dominios_fracos()` como funções puras

### Frontend (React — Vitest + Testing Library)
- `AuthContext`: testa `login()`, `logout()`, derivação de `papel` a partir de `cognito:groups`
- `ProtectedRoute`: testa redirecionamento para Cognito (sem token), para `/` (papel errado)
- `useApi`: testa inclusão do header `Authorization: Bearer` em todas as chamadas
- `DashboardTurmaPage`: testa renderização da tabela, gráfico e mensagem de vazio

### Integração
- Verificação manual pós-deploy: login como Aluno → acessa `/`, não consegue acessar `/dashboard`; login como Mentor → cai em `/dashboard`, vê dados da turma
