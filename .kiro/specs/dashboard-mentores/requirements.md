# Requirements Document

## Introduction

O **Dashboard de Mentores e Professores** é uma feature da plataforma CloudCerto que adiciona quatro capacidades fundamentais:

1. **Migração do frontend para React (Vite + React)** — o frontend atual em Vanilla JS é reescrito como SPA React, mantendo deploy via S3/CloudFront e sem alterar o backend ou a infra AWS.
2. **Diferenciação de papel no frontend** — após o login, o frontend lê o grupo do usuário a partir do JWT do Cognito e exibe interfaces distintas para Alunos e Mentores.
3. **Persistência de histórico na AWS** — resultados de simulados passam a ser salvos no DynamoDB em vez de somente no localStorage do browser, tornando o histórico durável, rastreável e acessível pelo backend.
4. **Dashboard do Mentor** — tela exclusiva para usuários do grupo `Mentores` com visão agregada da turma (ranking, domínios fracos, tendências) e visão individual por aluno (histórico completo, evolução de score, desempenho por domínio).

O backend e a infra AWS permanecem inalterados em sua estrutura: API Gateway HTTP API v2 + Lambda Python 3.12 + DynamoDB (PAY_PER_REQUEST), Terraform para infra e Cognito para autenticação.

---

## Glossary

- **Sistema**: a plataforma CloudCerto como um todo (frontend + backend + infra).
- **Frontend**: aplicação SPA React (Vite + React 18) servida via S3/CloudFront.
- **Vite**: ferramenta de build que gera os artefatos estáticos do frontend React para deploy no S3.
- **React_Router**: biblioteca de roteamento client-side (`react-router-dom`) que gerencia navegação entre páginas sem recarregar a página.
- **AuthContext**: React Context que armazena o estado de autenticação (token, papel, sub) e disponibiliza para toda a árvore de componentes.
- **ProtectedRoute**: componente React que verifica o papel do usuário e redireciona para login ou home se o acesso não for permitido.
- **API_Gateway**: o AWS API Gateway HTTP API v2 que roteia requisições para as Lambdas.
- **JWT_Decoder**: módulo JavaScript no frontend responsável por decodificar o token JWT armazenado em `sessionStorage` e extrair claims como `cognito:groups` e `sub`.
- **Role_Guard**: lógica no frontend que lê o papel do usuário e determina qual interface exibir.
- **Aluno**: usuário autenticado pertencente ao grupo Cognito `Alunos`.
- **Mentor**: usuário autenticado pertencente ao grupo Cognito `Mentores`.
- **Token_JWT**: token de identidade emitido pelo Cognito Hosted UI (Implicit Flow), armazenado em `sessionStorage` com a chave `aws_mentoria_token`.
- **Lambda_SalvarHistorico**: função AWS Lambda Python 3.12 responsável por persistir o resultado de um simulado na tabela `Historico_Simulados` no DynamoDB.
- **Lambda_CorrigirProva**: função AWS Lambda Python 3.12 existente (`POST /corrigir`) que calcula o resultado de um simulado e que será estendida para também acionar a persistência.
- **Lambda_GetHistoricoAluno**: função AWS Lambda Python 3.12 responsável por retornar o histórico de simulados de um único Aluno (acessível pelo próprio Aluno e por Mentores).
- **Lambda_GetDashboardTurma**: função AWS Lambda Python 3.12 responsável por retornar os dados agregados da turma para o Dashboard do Mentor.
- **Tabela_Historico**: tabela DynamoDB `Historico_Simulados` onde cada item representa um resultado de simulado de um Aluno.
- **Registro_Historico**: item na `Tabela_Historico` contendo: `aluno_id` (sub do Cognito), `certificacao`, `score`, `corretas`, `erradas`, `puladas`, `total`, `tempo_segundos`, `data_iso`, `dominios` (map de domínio → percentual de acerto).
- **Dashboard_Turma**: tela no frontend, acessível somente por Mentores, que exibe visão agregada da turma.
- **Dashboard_Aluno**: tela no frontend, acessível somente por Mentores, que exibe o histórico detalhado de um Aluno específico.
- **Dominio**: área temática de uma certificação AWS (ex: "Armazenamento", "Segurança"). Mapeado pelo campo `temas` nas questões do DynamoDB.
- **Tendencia**: classificação calculada pelo backend comparando os últimos dois scores do Aluno para uma certificação: `melhorando` (score mais recente > anterior), `piorando` (score mais recente < anterior) ou `estavel` (scores iguais ou apenas um simulado realizado).
- **Score**: percentual de acertos de um simulado, inteiro de 0 a 100.
- **Ranking**: lista de Alunos ordenada por score médio decrescente, calculada pelo backend.

---

## Requirements

### Requisito 1: Decodificação de papel do usuário no frontend

**User Story:** Como usuário autenticado, eu quero que a plataforma reconheça automaticamente se sou Aluno ou Mentor ao fazer login, para que eu seja direcionado à interface correta sem precisar escolher manualmente.

#### Critérios de Aceitação

1. WHEN o Token_JWT é armazenado em `sessionStorage` após o login via Cognito Hosted UI, THE JWT_Decoder SHALL extrair o claim `cognito:groups` do payload do token sem realizar chamadas adicionais à API.
2. WHEN o claim `cognito:groups` contém o valor `"Mentores"`, THE Role_Guard SHALL classificar o usuário como Mentor.
3. WHEN o claim `cognito:groups` contém o valor `"Alunos"` ou não contém o grupo `"Mentores"`, THE Role_Guard SHALL classificar o usuário como Aluno.
4. IF o Token_JWT estiver ausente ou inválido (não decodificável como Base64 JSON), THEN THE Role_Guard SHALL redirecionar o usuário para a tela de login do Cognito Hosted UI.
5. THE JWT_Decoder SHALL operar exclusivamente via decodificação Base64 do payload do JWT, sem validar a assinatura no frontend.

---

### Requisito 2: Diferenciação de interface por papel

**User Story:** Como usuário autenticado, eu quero ver apenas as funcionalidades pertinentes ao meu papel, para que a interface não seja poluída com opções que não me pertencem.

#### Critérios de Aceitação

1. WHEN o Role_Guard classifica o usuário como Aluno, THE Frontend SHALL exibir exclusivamente as telas `home`, `exam`, `result`, `review` e `progress` (interface atual).
2. WHEN o Role_Guard classifica o usuário como Mentor, THE Frontend SHALL exibir a tela `dashboard` em substituição à tela `home` como tela inicial após o login.
3. WHERE o acesso ao Dashboard estiver habilitado para Mentores, THE Frontend SHALL disponibilizar navegação para as telas `dashboard` (turma) e `dashboard-aluno` (individual).
4. WHILE o usuário estiver classificado como Aluno, THE Frontend SHALL ocultar qualquer elemento de navegação que aponte para as telas `dashboard` ou `dashboard-aluno`.
5. IF o usuário classificado como Aluno tentar acessar diretamente a URL ou o estado de navegação do Dashboard, THEN THE Role_Guard SHALL redirecionar o usuário para a tela `home`.

---

### Requisito 3: Persistência automática do histórico de simulados no DynamoDB

**User Story:** Como Aluno, eu quero que meus resultados de simulados sejam salvos automaticamente na nuvem ao finalizar cada prova, para que meu histórico não se perca ao trocar de dispositivo ou limpar o navegador.

#### Critérios de Aceitação

1. WHEN o `POST /corrigir` retorna um resultado com `statusCode 200`, THE Lambda_SalvarHistorico SHALL persistir um Registro_Historico na Tabela_Historico contendo: `aluno_id` (sub do Cognito extraído do JWT), `certificacao`, `score`, `corretas`, `erradas`, `puladas`, `total`, `tempo_segundos`, `data_iso` e `dominios`.
2. THE Tabela_Historico SHALL usar `PK = "USER#<aluno_id>"` e `SK = "<data_iso>#<uuid4>"` como chaves primárias para suportar consultas por aluno ordenadas por data.
3. WHEN a persistência do Registro_Historico falhar por erro no DynamoDB, THE Lambda_CorrigirProva SHALL retornar o resultado da correção normalmente ao frontend com `statusCode 200`, registrando o erro de persistência nos logs do CloudWatch sem interromper o fluxo do Aluno.
4. THE Lambda_SalvarHistorico SHALL calcular o campo `dominios` agrupando as questões do simulado por `temas` e computando o percentual de acerto por tema, com precisão de 1 casa decimal.
5. WHEN o campo `tempo_segundos` não for enviado pelo frontend no body do `POST /corrigir`, THE Lambda_SalvarHistorico SHALL persistir o Registro_Historico com `tempo_segundos = null`.
6. THE Lambda_SalvarHistorico SHALL ser invocada de forma síncrona pela Lambda_CorrigirProva antes de retornar a resposta ao frontend, garantindo que o Registro_Historico esteja no DynamoDB antes de o Aluno visualizar o resultado.

---

### Requisito 4: Controle de acesso nas rotas de histórico e dashboard

**User Story:** Como administrador da plataforma, eu quero que as rotas de acesso ao histórico e ao dashboard sejam protegidas por papel no backend, para que Alunos não possam visualizar dados de outros Alunos e somente Mentores possam acessar dados agregados da turma.

#### Critérios de Aceitação

1. WHEN uma requisição `GET /historico/{aluno_id}` chega ao API_Gateway, THE API_Gateway SHALL validar o Token_JWT via JWT Authorizer do Cognito antes de encaminhar à Lambda_GetHistoricoAluno.
2. WHEN o Token_JWT é válido e o `sub` do token é igual ao `{aluno_id}` do path, THE Lambda_GetHistoricoAluno SHALL retornar o histórico completo do Aluno com `statusCode 200`.
3. WHEN o Token_JWT é válido e o claim `cognito:groups` do token contém `"Mentores"`, THE Lambda_GetHistoricoAluno SHALL retornar o histórico completo do Aluno solicitado com `statusCode 200`, independentemente do `{aluno_id}` do path.
4. WHEN o Token_JWT é válido, o `sub` do token é diferente do `{aluno_id}` do path, e o claim `cognito:groups` não contém `"Mentores"`, THEN THE Lambda_GetHistoricoAluno SHALL retornar `statusCode 403` com mensagem `"Acesso negado."`.
5. WHEN uma requisição `GET /dashboard/turma` chega ao API_Gateway com Token_JWT válido cujo `cognito:groups` não contém `"Mentores"`, THEN THE Lambda_GetDashboardTurma SHALL retornar `statusCode 403` com mensagem `"Acesso restrito a Mentores."`.
6. IF o Token_JWT estiver ausente ou inválido em qualquer rota protegida, THEN THE API_Gateway SHALL retornar `statusCode 401` antes de encaminhar a requisição às Lambdas.

---

### Requisito 5: API de histórico individual do Aluno

**User Story:** Como Aluno, eu quero acessar meu histórico completo de simulados via API, para que o frontend possa exibir minha evolução de performance ao longo do tempo.

#### Critérios de Aceitação

1. WHEN o `GET /historico/{aluno_id}` é chamado com Token_JWT válido e acesso autorizado, THE Lambda_GetHistoricoAluno SHALL retornar uma lista de Registros_Historico ordenada por `data_iso` decrescente (mais recente primeiro).
2. THE Lambda_GetHistoricoAluno SHALL retornar no máximo 100 registros por chamada. WHEN o Aluno possuir mais de 100 registros, THE Lambda_GetHistoricoAluno SHALL retornar os 100 mais recentes.
3. WHEN o `GET /historico/{aluno_id}` inclui o query parameter `certificacao=<codigo>`, THE Lambda_GetHistoricoAluno SHALL filtrar e retornar apenas os Registros_Historico da certificação especificada.
4. IF o `{aluno_id}` não possuir nenhum Registro_Historico na Tabela_Historico, THEN THE Lambda_GetHistoricoAluno SHALL retornar `statusCode 200` com uma lista vazia `[]`.
5. THE Lambda_GetHistoricoAluno SHALL retornar cada Registro_Historico com os campos: `id` (SK), `certificacao`, `score`, `corretas`, `erradas`, `puladas`, `total`, `tempo_segundos`, `data_iso` e `dominios`.

---

### Requisito 6: API de dados agregados da turma para o Dashboard do Mentor

**User Story:** Como Mentor, eu quero acessar dados agregados de toda a turma via API, para que o Dashboard exiba rankings, tendências e pontos de atenção sem que eu precise analisar aluno por aluno manualmente.

#### Critérios de Aceitação

1. WHEN o `GET /dashboard/turma` é chamado com Token_JWT válido de um Mentor, THE Lambda_GetDashboardTurma SHALL retornar a lista de todos os Alunos que possuem pelo menos 1 Registro_Historico na Tabela_Historico.
2. THE Lambda_GetDashboardTurma SHALL calcular, por Aluno e por certificação: o último score (`ultimo_score`), a Tendência (`tendencia`) e o número total de simulados realizados (`total_simulados`).
3. THE Lambda_GetDashboardTurma SHALL retornar o Ranking global de Alunos ordenado por score médio decrescente, calculado sobre todos os Registros_Historico de cada Aluno independente da certificação.
4. THE Lambda_GetDashboardTurma SHALL calcular os domínios mais fracos da turma como a média do percentual de acerto por Domínio, agregando todos os Registros_Historico de todos os Alunos, e retornar os 5 domínios com menor média.
5. WHEN a Tabela_Historico não possuir nenhum Registro_Historico, THE Lambda_GetDashboardTurma SHALL retornar `statusCode 200` com `{ "alunos": [], "ranking": [], "dominios_fracos": [] }`.
6. THE Lambda_GetDashboardTurma SHALL utilizar um Global Secondary Index (GSI) na Tabela_Historico com `PK = "TURMA"` e `SK = "<aluno_id>#<data_iso>#<uuid4>"` para recuperar registros de todos os alunos sem realizar Scan completo na tabela, respeitando o free tier do DynamoDB.

---

### Requisito 7: Dashboard do Mentor — Visão Turma no frontend

**User Story:** Como Mentor, eu quero ver em uma única tela uma visão consolidada da turma, para que eu identifique rapidamente quais alunos precisam de atenção e quais domínios estão com menor desempenho.

#### Critérios de Aceitação

1. WHEN a tela `dashboard` é carregada por um Mentor, THE Frontend SHALL chamar `GET /dashboard/turma` com o Token_JWT do Mentor e renderizar os dados retornados.
2. THE Frontend SHALL exibir uma tabela com as colunas: nome/email do Aluno, certificações praticadas, último score por certificação, Tendência (ícone visual: seta para cima, seta para baixo ou traço horizontal) e total de simulados realizados.
3. THE Frontend SHALL exibir o Ranking de Alunos por score médio em ordem decrescente, identificando visualmente as três primeiras posições.
4. THE Frontend SHALL exibir um gráfico de barras horizontais (Chart.js) com os 5 Domínios mais fracos da turma e o respectivo percentual médio de acerto.
5. IF a chamada `GET /dashboard/turma` retornar erro ou lista vazia de Alunos, THEN THE Frontend SHALL exibir a mensagem `"Nenhum simulado registrado ainda."` no lugar das tabelas.
6. WHILE os dados do Dashboard estão sendo carregados via fetch, THE Frontend SHALL exibir um indicador de carregamento visível na tela `dashboard`.

---

### Requisito 8: Dashboard do Mentor — Visão Individual do Aluno no frontend

**User Story:** Como Mentor, eu quero clicar em um Aluno na visão turma e ver o histórico completo dele, para que eu possa acompanhar a evolução individual e identificar padrões de dificuldade específicos.

#### Critérios de Aceitação

1. WHEN o Mentor clica no nome de um Aluno na tela `dashboard`, THE Frontend SHALL navegar para a tela `dashboard-aluno` e chamar `GET /historico/{aluno_id}` com o Token_JWT do Mentor.
2. THE Frontend SHALL exibir um gráfico de linha (Chart.js) com a evolução de Score ao longo do tempo para cada certificação praticada pelo Aluno, com o eixo X representando a `data_iso` e o eixo Y o Score de 0 a 100.
3. THE Frontend SHALL exibir um gráfico de barras verticais (Chart.js) com o desempenho por Domínio para a certificação selecionada, calculado como a média de acerto nos últimos 5 simulados daquela certificação.
4. THE Frontend SHALL exibir a lista de certificações que o Aluno já praticou, com o último score e a data do último simulado para cada uma.
5. THE Frontend SHALL exibir um botão "Voltar à Turma" que retorna à tela `dashboard` sem recarregar os dados da turma.
6. IF a chamada `GET /historico/{aluno_id}` retornar lista vazia, THEN THE Frontend SHALL exibir a mensagem `"Este aluno ainda não realizou nenhum simulado."`.
7. WHILE os dados do histórico individual estão sendo carregados, THE Frontend SHALL exibir um indicador de carregamento visível na tela `dashboard-aluno`.

---

### Requisito 10: Migração do frontend para React (Vite + React)

**User Story:** Como desenvolvedor da plataforma, eu quero migrar o frontend de Vanilla JS para React com Vite, para que o código seja componentizado, mais fácil de manter e pronto para crescer com as novas features.

#### Critérios de Aceitação

1. THE Sistema SHALL criar um projeto React 18 com Vite na pasta `frontend/` na raiz do repositório, substituindo os arquivos `index.html`, `app.js` e `style.css` na raiz.
2. THE Frontend SHALL usar `react-router-dom` para navegação client-side, com rotas declarativas para cada tela: `/` (Home), `/exam` (Simulado), `/result` (Resultado), `/review` (Revisão), `/progress` (Evolução), `/dashboard` (Mentor - Turma), `/dashboard/:alunoId` (Mentor - Aluno).
3. THE Frontend SHALL implementar um `AuthContext` (React Context + useReducer) que armazena `{ token, sub, papel, email }` e expõe `login(token)` e `logout()`.
4. THE Frontend SHALL implementar um componente `ProtectedRoute` que, para rotas de Mentor, redireciona Alunos para `/` e usuários não autenticados para o Cognito Hosted UI.
5. THE Frontend SHALL usar `Recharts` ou `Chart.js` (via `react-chartjs-2`) para todos os gráficos, mantendo a mesma identidade visual atual (cores por certificação, gradientes).
6. THE Frontend SHALL manter o `style.css` atual como base de estilos globais, podendo ser importado como CSS Module ou global no Vite, sem reescrever os estilos do zero.
7. WHEN o build React é gerado via `npm run build`, THE Vite SHALL produzir os artefatos estáticos na pasta `frontend/dist/` prontos para upload ao S3.
8. THE workflow `workflow.yml` do GitHub Actions SHALL ser atualizado para executar `npm run build` na pasta `frontend/` e fazer sync da pasta `frontend/dist/` para o S3, substituindo o sync direto dos arquivos da raiz.
9. THE Frontend SHALL preservar toda a lógica de negócio existente: anti-repeat de questões, modo treino, exportação de erros (CSV, Anki, Prompt IA), histórico de performance e navegação por teclado.

**User Story:** Como engenheiro da plataforma, eu quero que toda a infraestrutura necessária para o Dashboard de Mentores seja provisionada via Terraform usando os módulos existentes, para que o ambiente seja reproduzível e mantenha o free tier da AWS.

#### Critérios de Aceitação

1. THE Sistema SHALL provisionar a Tabela_Historico (`Historico_Simulados`) no DynamoDB com `billing_mode = "PAY_PER_REQUEST"`, chave primária `PK (String)` e chave de ordenação `SK (String)`.
2. THE Sistema SHALL provisionar um GSI na Tabela_Historico com `hash_key = "GSI1PK"` (String) e `range_key = "GSI1SK"` (String), com `projection_type = "ALL"`, para permitir consultas por turma sem Scan.
3. THE Sistema SHALL provisionar as Lambdas `SalvarHistorico`, `GetHistoricoAluno` e `GetDashboardTurma` usando o módulo `infra/modules/lambda` existente, com runtime `python3.12`.
4. THE Sistema SHALL provisionar as rotas `GET /historico/{aluno_id}` e `GET /dashboard/turma` no API_Gateway usando o módulo `infra/modules/api_gateway` existente, com `authorization_type = "JWT"` vinculado ao Cognito Authorizer já configurado.
5. THE Sistema SHALL conceder à IAM Role das novas Lambdas permissões `dynamodb:PutItem`, `dynamodb:Query` e `dynamodb:GetItem` restritas ao ARN da Tabela_Historico e do seu GSI.
6. WHERE o CORS já estiver configurado no API_Gateway, THE Sistema SHALL adicionar os novos paths (`/historico/{aluno_id}` e `/dashboard/turma`) à configuração de CORS existente sem duplicar recursos Terraform.
