# Simulados AWS — Contexto do Projeto

## O que é esse projeto

Plataforma web de simulados para certificações AWS (CLF-C02, DVA-C02, SAA-C03, SOA-C02, SCS-C02, SAP-C02). O usuário faz login via Cognito, escolhe uma certificação, configura o simulado e responde questões de múltipla escolha. Tudo hospedado na AWS, free tier.

## Stack Completo

| Camada | Tecnologia |
|---|---|
| Frontend | HTML + CSS + Vanilla JS (sem framework) |
| Hospedagem | S3 (estático) + CloudFront CDN |
| Autenticação | AWS Cognito (Hosted UI, Implicit Flow) |
| API | API Gateway HTTP API (v2) |
| Backend | AWS Lambda (Python 3.12) |
| Banco de dados | DynamoDB (PAY_PER_REQUEST, free tier) |
| Infra como código | Terraform (módulos em `infra/modules/`) |
| CI/CD | GitHub Actions (2 workflows separados) |
| Região | us-east-1 |

## URLs e IDs de Produção

- **CloudFront:** `https://d1nv8jnyifu0hy.cloudfront.net/`
- **API Gateway:** `https://j982dfso4f.execute-api.us-east-1.amazonaws.com`
- **Cognito Domain:** `https://auth-simulados-xyz987.auth.us-east-1.amazoncognito.com`
- **Cognito Client ID:** `50daima65crf7jcnj3cpji2cl`
- **Redirect URIs autorizados:** `http://localhost:5500/` (dev) e `https://d1nv8jnyifu0hy.cloudfront.net/` (prod)

## Estrutura do DynamoDB

**Tabela:** `Simulados_AWS`  
**Chaves:**
- `PK` (String) = `CERT#<codigo>` — ex: `CERT#SAA-C03`
- `SK` (String) = ID único da questão

**Campos de uma questão:**
```json
{
  "PK": "CERT#SAA-C03",
  "SK": "SAA-C03#001",
  "pergunta": "Texto da questão...",
  "opcoes": ["A", "B", "C", "D"],
  "respostas_corretas": ["B"],
  "explicacao": "Explicação detalhada...",
  "temas": ["Armazenamento", "S3"]
}
```

> ⚠️ O campo `respostas_corretas` existe no DynamoDB mas **não deve ser enviado ao frontend** (proteção contra trapaça). A correção deve acontecer no backend via rota POST.

## Estrutura de Arquivos

```
simulados-aws/
├── index.html              # SPA completo (telas: home, exam, result, review, progress)
├── app.js                  # Toda a lógica do frontend (vanilla JS, IIFE)
├── style.css               # CSS da aplicação
├── backend/
│   └── get_questoes/
│       └── lambda_function.py   # Lambda GET /questoes (Python 3.12)
├── infra/
│   ├── main.tf             # Root module — instancia todos os módulos
│   ├── provider.tf         # AWS provider + backend S3 para state
│   ├── modules/
│   │   ├── cognito/        # User Pool, App Client, Hosted UI Domain, Grupos
│   │   ├── dynamodb/       # Tabela Simulados_AWS
│   │   ├── lambda/         # IAM Role + Lambda GetQuestoes
│   │   └── api_gateway/    # HTTP API, Stage, Integração, Rotas, CORS
└── .github/workflows/
    ├── workflow.yml        # Deploy frontend → S3 + invalidação CloudFront
    └── deploy-infra.yml    # Terraform plan (PR) + apply (merge main)
```

## CI/CD — Dois Workflows

**`workflow.yml`** — Frontend  
- Trigger: push em `main`, ignorando `infra/**`, `*.txt`, `*.py`, `*.md`  
- Faz `aws s3 sync` e invalida o cache do CloudFront  

**`deploy-infra.yml`** — Infraestrutura  
- Trigger: push em `main` com mudanças em `infra/**`  
- Em PR: roda `terraform plan` e comenta o resultado no PR  
- Em merge: roda `terraform apply -auto-approve`  

**GitHub Secrets necessários:** `AWS_ROLE_ARN`, `S3_BUCKET_NAME`, `CLOUDFRONT_ID`

**Terraform State:** bucket S3 `mentorias-aws-tf-state-0626`, lock via DynamoDB `terraform-state-lock`

## Padrões de Código

**Frontend (app.js):**
- Tudo dentro de uma IIFE `(function(){ ... })()`
- Estado global: `config`, `QUESTIONS`, `examQuestions`, `answers`, `flagged`
- Navegação entre telas via `showScreen(name)` — telas: `home`, `exam`, `result`, `review`, `progress`
- Token Cognito armazenado em `sessionStorage` com chave `aws_mentoria_token`
- Chamadas à API sempre incluem o header `Authorization: Bearer <token>`
- Função `formatText(text)` para sanitizar e formatar HTML das questões

**Lambda (Python):**
- Sempre retornar headers CORS: `Access-Control-Allow-Origin: *`
- Usar `DecimalEncoder` para serializar campos Decimal do DynamoDB
- Capturar parâmetros via `event.get('queryStringParameters') or {}`
- Para POST: capturar body via `json.loads(event.get('body') or '{}')`

**Terraform:**
- Usar módulos em `infra/modules/` — nunca criar recursos diretamente no `main.tf`
- Sempre exportar ARNs e nomes via `outputs.tf` de cada módulo
- Variáveis definidas em `variables.tf` do módulo, não hardcoded

## Backlog — Próximos 3 Passos

### ✅ Passo 1 — Cognito Authorizer no API Gateway ✅ IMPLEMENTADO
**Objetivo:** Proteger todas as rotas da API exigindo token JWT válido do Cognito.  
**Arquivos a modificar:**
- `infra/modules/api_gateway/main.tf` — adicionar `aws_apigatewayv2_authorizer` (JWT) e vincular às rotas
- `infra/modules/api_gateway/variables.tf` — adicionar `cognito_user_pool_id` e `cognito_client_id`
- `infra/main.tf` — passar os outputs do módulo Cognito para o módulo API Gateway
- `app.js` — incluir `Authorization: Bearer ${token}` no `fetch` da função de carregamento de questões

### ⏳ Passo 2 — Lambda de Correção (POST /corrigir)
**Objetivo:** Mover a lógica de correção para o backend. Frontend envia respostas, backend devolve resultado.  
**Arquivos a criar/modificar:**
- `backend/corrigir/lambda_function.py` — nova Lambda: recebe `{prova, respostas: {idx: opcao}}`, busca gabarito no DynamoDB, retorna `{score, corretas, erradas, detalhes[]}`
- `backend/get_questoes/lambda_function.py` — remover `respostas_corretas` do retorno
- `infra/modules/lambda/main.tf` — adicionar segundo `aws_lambda_function` para `CorrigirProva`
- `infra/modules/lambda/variables.tf` e `outputs.tf` — exportar ARN da nova Lambda
- `infra/modules/api_gateway/main.tf` — adicionar integração e rota `POST /corrigir`

### ⏳ Passo 3 — Tela de Resultado no Frontend
**Objetivo:** `finishExam()` chama `POST /corrigir`, recebe o resultado do servidor e exibe na tela.  
**Arquivos a modificar:**
- `app.js` — `finishExam()` faz POST com as respostas do usuário; renderiza resultado com dados do backend (score, questões erradas, explicações)

## Certificações Disponíveis

| Código | Nome | Nível |
|---|---|---|
| CLF-C02 | Cloud Practitioner | Foundational |
| SAA-C03 | Solutions Architect Associate | Associate |
| DVA-C02 | Developer Associate | Associate |
| SOA-C02 | CloudOps Engineer | Associate |
| SCS-C02 | Security Specialty | Specialty |
| SAP-C02 | Solutions Architect Professional | Professional |
