# Roadmap do Projeto: Plataforma Serverless de Simulados AWS

**Objetivo:** Migrar a plataforma estática atual para uma arquitetura 100% Serverless na AWS, habilitando controle de acesso (Alunos/Mentores) e telemetria de desempenho, mantendo o custo operacional no Free Tier.

**Metodologia de Infraestrutura:** Toda a fundação cloud será provisionada via Terraform (IaC).

---

## 🟢 Fase 1: Fundação & Identidade (Concluído)

O alicerce de infraestrutura e segurança da aplicação.

- [x] **Setup do Repositório:** Estruturação das pastas (`/frontend` e `/infra`) e do `ROADMAP.md`.
- [x] **Infra como Código:** Configuração do backend remoto do Terraform (S3 + DynamoDB State Lock).
- [x] **Hospedagem Estática:** Bucket S3 provisionado e distribuído via CloudFront (com OAC).
- [x] **Autenticação (AWS Cognito):** Criação do User Pool, App Client e Hosted UI.
- [x] **RBAC (Controle de Acesso):** Criação dos grupos `Mentores` e `Alunos` no Cognito.
- [x] **Proteção do Frontend:** Script no `app.js` interceptando o JWT e forçando o login para acessar os simulados.

---

## 🟡 Fase 2: Camada de Dados (Em Andamento)

Migração das questões estáticas para o banco de dados NoSQL.

- [x] **IaC do Banco:** Executar o `terraform apply` do módulo do DynamoDB (`Simulados_AWS` com `PAY_PER_REQUEST`).
- [x] **Estruturação dos Dados:** Revisar o arquivo JSON de origem para garantir que os atributos (ID, pergunta, opções, temas) estão limpos.
- [x] **Script de Carga (Python/Boto3):** Escrever e executar o script local para ler o JSON e injetar as questões na tabela via `BatchWriteItem`.
- [x] **Validação de Dados:** Confirmar via console se a Partition Key (`CERT#...`) e a Sort Key (`Q#...`) foram gravadas corretamente.

---

## ⚪ Fase 3: Computação & APIs (Próximo Passo)

O motor de regras de negócio e validação.

- [ ] **IaC da API:** Criar o módulo Terraform para o Amazon API Gateway (REST ou HTTP API).
- [ ] **Segurança da API:** Configurar o Cognito Authorizer no API Gateway para bloquear requisições sem token válido.
- [ ] **Desenvolvimento Lambda 1 (`GetQuestoes`):** Função (Node.js/Python) que busca as perguntas no DynamoDB e devolve para o front (removendo o campo de resposta correta do payload).
- [ ] **Desenvolvimento Lambda 2 (`SubmitSimulado`):** Função que recebe as respostas do aluno, calcula a nota cruzando com o gabarito no banco e salva o progresso na tabela.
- [ ] **IaC das Funções Lambda:** Empacotar e provisionar as funções via Terraform, aplicando permissões de Least Privilege no IAM.

---

## ⚪ Fase 4: Refatoração do Frontend & Multi-Perfil

Adequação da interface para consumir a nova API e gerenciar as permissões.

- [ ] **Limpeza de Arquivos:** Deletar os `.json` e `.txt` locais de dentro do projeto (já que estarão no DynamoDB).
- [ ] **Decodificação do JWT:** Alterar o `app.js` para ler a claim `cognito:groups` do token e identificar o perfil (Aluno vs. Mentor).
- [ ] **Integração com API (Alunos):** Substituir as chamadas de arquivo local por `fetch()` nas rotas do API Gateway.
- [ ] **Painel do Mentor:** Criar a tela de Dashboard restrita, que consumirá uma rota específica da API para listar a evolução e os pontos de falha da turma.

---

## ⚪ Fase 5: Operações e Sustentação (CloudOps)

Preparando o ambiente para nível de produção (Managed Services).

- [ ] **CI/CD Seguro:** Validar a esteira do GitHub Actions utilizando OIDC (OpenID Connect) para aplicar as mudanças do Terraform sem chaves fixas.
- [ ] **Separação de Ambientes (Opcional):** Implementar Workspaces no Terraform para separar o ambiente de `dev` e `prod`.
- [ ] **Monitoramento (CloudWatch):** Criar alarmes para erros 500 no Lambda ou requisições excessivas no API Gateway.
