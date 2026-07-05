# Implementation Plan: Passo 2 — Motor de Correção no Backend (POST /corrigir)

## Overview

Implementação incremental do motor de correção: primeiro a lógica pura Python (testável isoladamente), depois a integração com DynamoDB, depois a proteção do gabarito na GetQuestoes, e por fim a infraestrutura Terraform para expor o novo endpoint.

## Tasks

- [ ] 1. Criar a estrutura da Lambda CorrigirProva com lógica de correção pura
  - Criar o arquivo `backend/corrigir/lambda_function.py` com a classe `DecimalEncoder` (igual à da GetQuestoes)
  - Implementar a função `normalizar(resposta)` que converte int, lista de int ou lista de str para `set` de int
  - Implementar a função `classificar_questao(idx, respostas_usuario, respostas_corretas_db)` que retorna `"correta"`, `"errada"` ou `"pulada"`
  - Implementar a função `calcular_resultado(questoes_ids, respostas_usuario, itens_db)` que itera sobre as questões, classifica cada uma e monta o dict com `score`, `total`, `corretas`, `erradas`, `puladas` e `detalhes`
  - O `score` deve ser calculado como `round((corretas / total) * 100)` — tratar `total == 0` retornando `score = 0`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ]* 1.1 Escrever property test: contadores somam total
    - **Property 1: Consistência dos contadores**
    - Gerar com `hypothesis`: lista de SKs (strings não-vazias), mapa de respostas (índices int → int ou lista de int), dict de itens do DynamoDB (subconjunto das SKs)
    - Chamar `calcular_resultado` e verificar `corretas + erradas + puladas == total`
    - `@settings(max_examples=100)`
    - `# Feature: passo-2-motor-correcao, Property 1: corretas + erradas + puladas == total`
    - **Validates: Requirements 3.4, 3.5**

  - [ ]* 1.2 Escrever property test: score é derivado das corretas
    - **Property 2: Score é derivado das corretas**
    - Gerar com `hypothesis` resultados de `calcular_resultado` e verificar `score == round((corretas / total) * 100)`
    - `@settings(max_examples=100)`
    - `# Feature: passo-2-motor-correcao, Property 2: score == round((corretas / total) * 100)`
    - **Validates: Requirements 3.4**

  - [ ]* 1.3 Escrever property test: comprimento de detalhes igual ao total
    - **Property 3: Comprimento de detalhes igual ao total de questões**
    - Gerar listas de `questoes_ids` de tamanho N e verificar `len(detalhes) == N`
    - `@settings(max_examples=100)`
    - `# Feature: passo-2-motor-correcao, Property 3: len(detalhes) == len(questoes_ids)`
    - **Validates: Requirements 3.5, 3.6**

  - [ ]* 1.4 Escrever property test: classificação simétrica ao conjunto de respostas
    - **Property 4: Classificação correta é simétrica ao conjunto de respostas**
    - Gerar pares (resposta_usuario, respostas_corretas) com `hypothesis` e verificar: se `normalizar(resposta_usuario) == normalizar(respostas_corretas)` então status é `"correta"`, caso contrário é `"errada"`
    - Incluir casos com int simples, lista de int e lista de str para cobrir a normalização
    - `@settings(max_examples=100)`
    - `# Feature: passo-2-motor-correcao, Property 4: status == correta iff conjuntos iguais`
    - **Validates: Requirements 3.1, 3.2, 3.7**

  - [ ]* 1.5 Escrever property test: questão pulada implica resposta_usuario nula
    - **Property 6: Questão pulada implica resposta_usuario nula no detalhe**
    - Gerar `questoes_ids` e `respostas` onde pelo menos um índice está ausente; verificar que o detalhe correspondente tem `status == "pulada"` e `resposta_usuario == null`
    - `@settings(max_examples=100)`
    - `# Feature: passo-2-motor-correcao, Property 6: pulada => resposta_usuario is None`
    - **Validates: Requirements 3.3, 3.6**

- [ ] 2. Implementar o lambda_handler da CorrigirProva com integração DynamoDB
  - Implementar o `lambda_handler` em `backend/corrigir/lambda_function.py`
  - Capturar body com `json.loads(event.get('body') or '{}')`
  - Validar presença de `prova` e `questoes_ids` — retornar 400 se ausentes
  - Montar chaves para `BatchGetItem`: `{"Simulados_AWS": {"Keys": [{"PK": f"CERT#{prova}", "SK": sk} for sk in questoes_ids]}}`
  - Executar `dynamodb.batch_get_item()` e tratar `UnprocessedKeys` (re-tentativa se necessário)
  - Indexar itens retornados por SK: `{item['SK']: item for item in response['Responses']['Simulados_AWS']}`
  - Chamar `calcular_resultado` com os itens indexados
  - Retornar 200 com o resultado serializado via `DecimalEncoder` e headers CORS `Access-Control-Allow-Origin: *`
  - Envolver tudo em `try/except Exception` — em caso de erro logar e retornar 500 com mensagem e headers CORS
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4_

  - [ ]* 2.1 Escrever unit tests para o lambda_handler
    - Mockar `boto3` com `unittest.mock.patch`
    - Testar: body ausente → 400, campo `prova` ausente → 400, campo `questoes_ids` vazio → 400
    - Testar: SK não encontrado no DynamoDB (mock retorna lista vazia) → questão pulada no resultado
    - Testar: exceção no DynamoDB (mock lança `Exception`) → 500 com mensagem de erro
    - Testar: resposta normal com mock → 200 com estrutura correta no body
    - Verificar que todos os retornos incluem header `Access-Control-Allow-Origin: *`
    - _Requirements: 1.3, 2.3, 2.4_

- [ ] 3. Checkpoint — Validar lógica de correção
  - Garantir que todos os testes de `backend/corrigir/` passam com `pytest backend/corrigir/`
  - Verificar manualmente que `normalizar` trata corretamente int, `[0]`, `[0, 2]` e `["1", "3"]`
  - Perguntar ao usuário se há dúvidas antes de prosseguir para a modificação da GetQuestoes

- [ ] 4. Modificar a Lambda GetQuestoes para remover respostas_corretas
  - Editar `backend/get_questoes/lambda_function.py`
  - Após `questoes = resposta.get('Items', [])`, adicionar: `for questao in questoes: questao.pop('respostas_corretas', None)`
  - Manter todos os outros campos e o comportamento existente inalterado
  - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 4.1 Escrever property test: GetQuestoes nunca expõe respostas_corretas
    - **Property 5: GetQuestoes nunca expõe respostas_corretas**
    - Gerar com `hypothesis` listas de itens (dicts) com e sem o campo `respostas_corretas`
    - Chamar a função de remoção e verificar que nenhum item retornado contém o campo `respostas_corretas`
    - Verificar também que os campos `pergunta`, `opcoes`, `explicacao`, `temas`, `SK` são preservados
    - `@settings(max_examples=100)`
    - `# Feature: passo-2-motor-correcao, Property 5: respostas_corretas nunca no retorno`
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [ ] 5. Atualizar o módulo Terraform Lambda
  - Editar `infra/modules/lambda/main.tf`:
    - Adicionar `data "archive_file" "lambda_corrigir_zip"` apontando para `backend/corrigir/`
    - Adicionar `resource "aws_lambda_function" "corrigir_prova"` com `function_name = "CorrigirProva"`, `handler = "lambda_function.lambda_handler"`, `runtime = "python3.12"`, reutilizando `aws_iam_role.lambda_exec_role.arn`
    - Atualizar `resource "aws_iam_role_policy" "dynamodb_read_policy"` adicionando `"dynamodb:BatchGetItem"` à lista de actions (mantendo `"dynamodb:Query"`)
  - Editar `infra/modules/lambda/outputs.tf`:
    - Adicionar output `lambda_corrigir_invoke_arn = aws_lambda_function.corrigir_prova.invoke_arn`
    - Adicionar output `lambda_corrigir_function_name = aws_lambda_function.corrigir_prova.function_name`
  - `infra/modules/lambda/variables.tf` não precisa de mudanças
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 6. Atualizar o módulo Terraform API Gateway
  - Editar `infra/modules/api_gateway/variables.tf`:
    - Adicionar variável `lambda_corrigir_invoke_arn` (type = string, description = "ARN de invocação da Lambda CorrigirProva")
    - Adicionar variável `lambda_corrigir_function_name` (type = string, description = "Nome da função Lambda CorrigirProva")
  - Editar `infra/modules/api_gateway/main.tf`:
    - Adicionar `resource "aws_apigatewayv2_integration" "lambda_corrigir_integration"` com `integration_uri = var.lambda_corrigir_invoke_arn` e `integration_method = "POST"`
    - Adicionar `resource "aws_apigatewayv2_route" "post_corrigir_route"` com `route_key = "POST /corrigir"`, `authorization_type = "JWT"`, `authorizer_id = aws_apigatewayv2_authorizer.cognito_jwt.id`
    - Adicionar `resource "aws_lambda_permission" "api_gw_corrigir"` para invocar a CorrigirProva com `statement_id = "AllowExecutionFromAPIGatewayCorrigir"`
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 7. Atualizar o Root Module (infra/main.tf)
  - Editar `infra/main.tf` para passar os novos outputs do módulo lambda para o módulo api_gateway:
    - Adicionar `lambda_corrigir_invoke_arn = module.lambda_get_questoes.lambda_corrigir_invoke_arn`
    - Adicionar `lambda_corrigir_function_name = module.lambda_get_questoes.lambda_corrigir_function_name`
  - Opcionalmente adicionar output `url_da_api_corrigir = "${module.api_gateway.api_url}/corrigir"` para exibir a URL no terminal após apply
  - _Requirements: 6.5_

- [ ] 8. Checkpoint final — Garantir que tudo passa
  - Executar `pytest` em todos os testes de backend
  - Executar `terraform validate` e `terraform plan` em `infra/` para confirmar que não há erros de sintaxe ou configuração
  - Perguntar ao usuário se há dúvidas antes de considerar o Passo 2 concluído

## Notes

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- O módulo `lambda` no `main.tf` continua se chamando `lambda_get_questoes` — não renomear para evitar destroy/recreate de recursos existentes
- O `BatchGetItem` tem limite de 100 itens por chamada; como simulados têm no máximo ~65 questões por certificação, uma única chamada é suficiente
- A IAM Role é compartilhada entre GetQuestoes e CorrigirProva — adicionar `BatchGetItem` à policy existente afeta ambas (aceitável pelo princípio de menor privilégio do contexto)
- Para testes com `hypothesis`, instalar: `pip install pytest hypothesis`
- A `CorrigirProva` não precisa de `dynamodb:Query` — apenas `BatchGetItem` — mas como a policy é compartilhada, ambas as permissões coexistem

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2"] },
    { "wave": 3, "tasks": ["3"] },
    { "wave": 4, "tasks": ["4"] },
    { "wave": 5, "tasks": ["5", "6"] },
    { "wave": 6, "tasks": ["7"] },
    { "wave": 7, "tasks": ["8"] }
  ]
}
```
