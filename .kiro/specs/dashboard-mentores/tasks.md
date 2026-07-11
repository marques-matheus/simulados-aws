# Implementation Plan: Dashboard de Mentores e Migração React

## Overview

Implementação em 4 fases sequenciais: (1) infra Terraform, (2) backend Python, (3) migração React, (4) Dashboard do Mentor no frontend. Cada fase é testável independentemente antes de avançar.

## Tasks

- [x] 1. Provisionar infraestrutura Terraform — tabelas DynamoDB, Lambdas e rotas
  - [x] `Historico_Simulados` com GSI `GSI1-turma-index` (GSI1PK = `TURMA#<id>`)
  - [x] `Turmas` com GSI `GSI-codigo-convite`
  - [x] Outputs de ARNs das 3 tabelas no módulo dynamodb
  - [x] Variáveis `historico_table_arn` e `turmas_table_arn` no módulo lambda
  - [x] Policies IAM para Historico e Turmas
  - [x] Lambdas: GetHistoricoAluno, GetDashboardTurma, GerenciarTurmas
  - [x] Rotas: GET /historico/{aluno_id}, GET /dashboard/turma/{turma_id}, POST/GET /turmas, POST /turmas/entrar, GET /turmas/{turma_id}
  - [x] main.tf atualizado com todos os novos outputs e variáveis
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [ ] 2. Extender Lambda CorrigirProva — persistência de histórico
  - Adicionar função `calcular_dominios(questoes_ids, itens_db, detalhes)` em `backend/corrigir/lambda_function.py`
  - Adicionar função `salvar_historico(claims, prova, resultado, dominios, tempo_segundos)` com `try/except` tolerante a falhas
  - Extrair `claims` de `event['requestContext']['authorizer']['jwt']['claims']` no `lambda_handler`
  - Extrair `tempo_segundos` do body (pode ser `None`)
  - Chamar `salvar_historico()` após `calcular_resultado()`, antes de retornar a resposta
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 3. Criar Lambda GetHistoricoAluno
  - Criar `backend/get_historico_aluno/lambda_function.py` com `lambda_handler`
  - Implementar `verificar_acesso(claims, aluno_id_path)` — verifica sub vs path ou grupo Mentores
  - Implementar Query na tabela `Historico_Simulados` por `PK = USER#<aluno_id>`, `ScanIndexForward=False`, `Limit=100`
  - Implementar filtro por certificação via query parameter `certificacao`
  - Retornar 403 se acesso negado, 200 com lista (pode ser vazia) se autorizado
  - Incluir headers CORS em todas as respostas
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 4. Criar Lambda GetDashboardTurma
  - Criar `backend/get_dashboard_turma/lambda_function.py` com `lambda_handler`
  - Verificar grupo `Mentores` nos claims — retornar 403 se não autorizado
  - Implementar Query no GSI `GSI1-turma-index` com `GSI1PK = TURMA`
  - Implementar `calcular_tendencia(scores_por_data)` — função pura
  - Implementar `calcular_dominios_fracos(registros, top_n=5)` — função pura
  - Agregar registros por aluno, calcular `score_medio`, `ultimo_score` por certificação, `tendencia`, `total_simulados`
  - Montar e retornar estrutura `{ alunos, ranking, dominios_fracos }`
  - Retornar estrutura vazia quando não há registros
  - Incluir headers CORS em todas as respostas
  - _Requirements: 4.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ] 5. Criar projeto React com Vite
  - Executar `npm create vite@latest frontend -- --template react-ts` na raiz do repositório
  - Instalar dependências: `react-router-dom`, `react-chartjs-2`, `chart.js`
  - Configurar `vite.config.ts` com `base: '/'` e `build.outDir: 'dist'`
  - Criar `.env.development` com `VITE_API_URL=http://localhost:3000` e `.env.production` vazio (URL injetada no CI)
  - Copiar `style.css` atual para `frontend/src/style.css` e importar em `frontend/src/main.tsx`
  - Copiar ícones e fontes referenciados no CSS atual
  - _Requirements: 10.1, 10.6, 10.7_

- [ ] 6. Implementar AuthContext, JWT utils e ProtectedRoute
  - Criar `frontend/src/utils/jwt.ts` com `decodeJwt(token)`, `getGroups(claims)`, `getPapel(claims)`
  - Criar `frontend/src/context/AuthContext.tsx` com `AuthState`, `authReducer`, `AuthProvider`, `useAuth`
  - O `Provider` lê `sessionStorage.getItem('aws_mentoria_token')` na montagem e inicializa o estado
  - `login(token)` grava em `sessionStorage` e despacha `LOGIN`; `logout()` remove de `sessionStorage` e despacha `LOGOUT`
  - Criar `frontend/src/components/ProtectedRoute.tsx` — redireciona para Cognito se sem token, para `/` se papel errado
  - Criar `frontend/src/utils/certMeta.ts` com `CERT_META` migrado do `app.js`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.4, 2.5, 10.3, 10.4_

- [ ] 7. Implementar hook useApi, tipos TypeScript e utilitários
  - Criar `frontend/src/types/index.ts` com interfaces: `Questao`, `Resultado`, `DetalheQuestao`, `RegistroHistorico`, `AlunoResumido`, `DashboardTurma`
  - Criar `frontend/src/hooks/useApi.ts` com `apiFetch<T>(path, options)` — injeta `Authorization: Bearer` automaticamente
  - Criar `frontend/src/hooks/useTimer.ts` com lógica de cronômetro (migrada do `app.js`)
  - Criar `frontend/src/utils/formatText.ts` com `formatText()` migrado do `app.js`
  - Criar `frontend/src/utils/antiRepeat.ts` com lógica anti-repeat de questões (localStorage) migrada do `app.js`
  - _Requirements: 10.9_

- [ ] 8. Implementar App.tsx, NavBar e roteamento
  - Criar `frontend/src/App.tsx` com `<Routes>` definindo todas as rotas: `/`, `/exam`, `/result`, `/review`, `/progress`, `/dashboard`, `/dashboard/:alunoId`
  - Rotas `/dashboard` e `/dashboard/:alunoId` envolvidas em `<ProtectedRoute requiredPapel="Mentor">`
  - Criar `frontend/src/main.tsx` com `ReactDOM.createRoot`, `<AuthProvider>`, `<BrowserRouter>`
  - Criar `frontend/src/components/NavBar.tsx` — exibe logo, botão login/logout, oculta links de dashboard para Alunos
  - Criar `frontend/src/components/LoadingSpinner.tsx`
  - Captura do token Cognito no `App.tsx` via `useEffect` + `window.location.hash` → chama `login(token)` e limpa o hash
  - _Requirements: 1.4, 2.1, 2.2, 2.3, 2.4, 10.2_

- [ ] 9. Migrar páginas do Aluno (Home, Exam, Result, Review, Progress)
  - Criar `frontend/src/pages/HomePage.tsx` — lista de certificações, config do simulado, loading overlay
  - Criar `frontend/src/pages/ExamPage.tsx` — renderização de questões, navegação, timer, modo treino
  - `ExamPage` envia `tempo_segundos` no body do `POST /corrigir` e navega para `/result` via `location.state`
  - Criar `frontend/src/pages/ResultPage.tsx` — lê `location.state`, exibe score, stats, análise de domínios
  - Criar `frontend/src/pages/ReviewPage.tsx` — lista de questões com gabarito, filtros
  - Criar `frontend/src/pages/ProgressPage.tsx` — histórico por certificação com gráficos Chart.js
  - Preservar: anti-repeat, modo treino, exportação (CSV, Anki, Prompt IA), navegação por teclado
  - _Requirements: 2.1, 10.9_

- [ ] 10. Implementar Dashboard do Mentor — Visão Turma
  - Criar `frontend/src/components/charts/WeakDomainsChart.tsx` — gráfico de barras horizontais dos 5 domínios mais fracos
  - Criar `frontend/src/components/CertBadge.tsx` — badge colorido de certificação
  - Criar `frontend/src/pages/DashboardTurmaPage.tsx`
  - Ao montar: `apiFetch<DashboardTurma>('/dashboard/turma')` com loading state
  - Renderizar tabela de alunos com colunas: email, certificações, último score, tendência (ícone), total de simulados
  - Renderizar ranking (top 3 destacados visualmente)
  - Renderizar `WeakDomainsChart` com os 5 domínios mais fracos
  - Ao clicar em aluno: `navigate('/dashboard/' + aluno_id)` com `state: { email }`
  - Exibir mensagem `"Nenhum simulado registrado ainda."` quando lista vazia
  - _Requirements: 2.2, 2.3, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ] 11. Implementar Dashboard do Mentor — Visão Individual do Aluno
  - Criar `frontend/src/components/charts/ScoreLineChart.tsx` — gráfico de linha de evolução temporal
  - Criar `frontend/src/components/charts/DomainBarChart.tsx` — gráfico de barras de desempenho por domínio
  - Criar `frontend/src/pages/DashboardAlunoPage.tsx`
  - Ao montar: `apiFetch<RegistroHistorico[]>('/historico/' + alunoId)` com loading state
  - Renderizar `ScoreLineChart` por certificação
  - Renderizar seletor de certificação + `DomainBarChart` para últimos 5 simulados da cert selecionada
  - Renderizar lista de certificações praticadas com último score e data
  - Botão "Voltar à Turma" → `navigate('/dashboard')` sem refetch
  - Exibir `"Este aluno ainda não realizou nenhum simulado."` quando lista vazia
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [ ] 12. Atualizar CI/CD e remover arquivos Vanilla JS da raiz
  - Atualizar `.github/workflows/workflow.yml`: adicionar `Setup Node.js`, `npm ci` e `npm run build` em `frontend/`
  - Injetar `VITE_API_URL` como variável de ambiente do build no workflow
  - Mudar `aws s3 sync` para `frontend/dist/` com estratégia de cache diferenciada (`index.html` sem cache, assets com hash imutáveis)
  - Atualizar `paths-ignore` para incluir `frontend/` quando necessário
  - Remover (ou mover para `legacy/`) `index.html`, `app.js`, `style.css` da raiz após validação do build React
  - _Requirements: 10.7, 10.8_

## Notes

- A ordem das tasks é deliberada: infra primeiro garante que as rotas existam antes de testar o backend
- A Lambda `SalvarHistorico` é implementada como função interna da `CorrigirProva`, não como Lambda separada — simplifica a infra e evita latência de invocação assíncrona
- O módulo `lambda` no `main.tf` continua chamado `lambda_get_questoes` — não renomear para evitar destroy/recreate
- `frontend/` e a raiz coexistem durante a transição — o CI deploy pode ser comutado via `paths-ignore`
- Para testar localmente o React antes do deploy: `npm run dev` em `frontend/` + proxy para a API real

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2", "3", "4"] },
    { "wave": 3, "tasks": ["5"] },
    { "wave": 4, "tasks": ["6", "7"] },
    { "wave": 5, "tasks": ["8"] },
    { "wave": 6, "tasks": ["9"] },
    { "wave": 7, "tasks": ["10", "11"] },
    { "wave": 8, "tasks": ["12"] }
  ]
}
```
