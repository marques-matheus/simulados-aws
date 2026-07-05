# Requirements Document

## Introduction

O Passo 2 do projeto Simulados AWS move a lógica de correção de provas do frontend para o backend. Uma nova função Lambda (`CorrigirProva`) recebe as respostas do usuário via `POST /corrigir`, consulta o gabarito no DynamoDB e devolve o resultado detalhado. Ao mesmo tempo, a Lambda `GetQuestoes` existente é atualizada para remover o campo `respostas_corretas` do retorno, eliminando a possibilidade de trapaça pelo frontend. A infraestrutura Terraform é expandida para registrar e expor a nova Lambda no API Gateway com autenticação JWT via Cognito.

## Glossary

- **CorrigirProva**: Nova função AWS Lambda responsável por receber respostas do usuário, buscar o gabarito no DynamoDB e calcular o resultado da prova.
- **GetQuestoes**: Função AWS Lambda existente que retorna a lista de questões de uma certificação sem incluir o gabarito.
- **Lambda_Module**: Módulo Terraform em `infra/modules/lambda/` que gerencia as funções Lambda e suas permissões IAM.
- **API_Gateway_Module**: Módulo Terraform em `infra/modules/api_gateway/` que gerencia o HTTP API Gateway, integrações e rotas.
- **DynamoDB**: Serviço de banco de dados NoSQL AWS que armazena as questões e gabaritos na tabela `Simulados_AWS`.
- **JWT_Authorizer**: Componente do API Gateway que valida o token Cognito antes de permitir acesso às rotas protegidas.
- **DecimalEncoder**: Classe Python utilitária que converte tipos `Decimal` do DynamoDB para `int` ou `float` na serialização JSON.
- **Questao**: Item da tabela DynamoDB com campos `PK`, `SK`, `pergunta`, `opcoes`, `respostas_corretas`, `explicacao` e `temas`.
- **Resposta_Usuario**: Mapa enviado pelo frontend com índice da questão como chave e índice(s) da(s) opção(ões) escolhida(s) como valor (pode ser inteiro ou lista de inteiros).
- **Detalhe**: Objeto de resultado por questão contendo `id`, `status`, `resposta_usuario` e `resposta_correta` e `explicacao`.
- **Score**: Percentual de acerto calculado como `(corretas / total) * 100`, arredondado para inteiro.

## Requirements

### Requirement 1: Endpoint de Correção

**User Story:** Como usuário autenticado, quero enviar minhas respostas ao backend via POST /corrigir, para que a correção aconteça no servidor e eu receba o resultado sem ter acesso ao gabarito.

#### Acceptance Criteria

1. WHEN uma requisição `POST /corrigir` é recebida com body `{ "prova": "<codigo>", "questoes_ids": ["<SK1>", ...], "respostas": { "0": 1, "1": [0, 2] } }` e token JWT válido, THE CorrigirProva SHALL processar a requisição e retornar status HTTP 200.
2. WHEN o body da requisição é recebido, THE CorrigirProva SHALL capturá-lo via `json.loads(event.get('body') or '{}')`.
3. THE CorrigirProva SHALL retornar headers CORS `Access-Control-Allow-Origin: *` em todas as respostas.
4. WHEN a requisição não contém token JWT válido, THE JWT_Authorizer SHALL rejeitar a requisição com status HTTP 401 antes que ela chegue à CorrigirProva.
5. WHEN a requisição contém token JWT válido, THE JWT_Authorizer SHALL permitir o acesso à CorrigirProva.

### Requirement 2: Busca de Gabarito no DynamoDB

**User Story:** Como desenvolvedor, quero que a CorrigirProva busque o gabarito diretamente no DynamoDB usando os SKs das questões, para que a correção seja sempre baseada na fonte de verdade e não em dados enviados pelo cliente.

#### Acceptance Criteria

1. WHEN a CorrigirProva recebe a lista `questoes_ids`, THE CorrigirProva SHALL buscar todos os itens correspondentes no DynamoDB usando `BatchGetItem` com a chave `{ "PK": "CERT#<prova>", "SK": "<id>" }` para cada questão.
2. WHEN o DynamoDB retorna os itens, THE CorrigirProva SHALL extrair o campo `respostas_corretas` de cada item para uso na comparação.
3. IF um SK listado em `questoes_ids` não existir na tabela DynamoDB, THEN THE CorrigirProva SHALL tratar a questão como pulada no cálculo do resultado.
4. IF ocorrer um erro ao acessar o DynamoDB, THEN THE CorrigirProva SHALL retornar status HTTP 500 com body `{ "mensagem": "Erro interno no servidor ao corrigir a prova." }`.

### Requirement 3: Lógica de Correção e Cálculo do Resultado

**User Story:** Como usuário, quero receber um resultado detalhado da minha prova com score, contagem de acertos/erros e o status de cada questão, para que eu possa entender meu desempenho.

#### Acceptance Criteria

1. WHEN a CorrigirProva compara a `resposta_usuario` de uma questão com o campo `respostas_corretas` do DynamoDB, THE CorrigirProva SHALL classificar a questão como `"correta"` se o conjunto de respostas enviadas for igual ao conjunto de respostas corretas.
2. WHEN a `resposta_usuario` de uma questão não corresponde ao `respostas_corretas`, THE CorrigirProva SHALL classificar a questão como `"errada"`.
3. WHEN o índice de uma questão não estiver presente no mapa `respostas`, THE CorrigirProva SHALL classificar a questão como `"pulada"`.
4. THE CorrigirProva SHALL calcular o `score` como `round((corretas / total) * 100)` onde `total` é o número de questões em `questoes_ids`.
5. THE CorrigirProva SHALL retornar um objeto JSON com os campos `score` (inteiro), `total` (inteiro), `corretas` (inteiro), `erradas` (inteiro), `puladas` (inteiro) e `detalhes` (lista de objetos Detalhe).
6. THE CorrigirProva SHALL incluir em cada Detalhe os campos `id` (SK da questão), `status` (`"correta"`, `"errada"` ou `"pulada"`), `resposta_usuario` (valor enviado ou `null` se pulada), `resposta_correta` (lista de índices corretos) e `explicacao` (string do DynamoDB).
7. WHEN a `resposta_usuario` é um inteiro simples, THE CorrigirProva SHALL convertê-la para lista de um elemento antes da comparação com `respostas_corretas`.
8. THE CorrigirProva SHALL usar `DecimalEncoder` para serializar campos Decimal provenientes do DynamoDB no corpo da resposta.

### Requirement 4: Proteção do Gabarito na GetQuestoes

**User Story:** Como proprietário da plataforma, quero que a rota GET /questoes não retorne o campo respostas_corretas, para que o usuário não possa ver o gabarito antes de corrigir a prova.

#### Acceptance Criteria

1. WHEN a GetQuestoes retorna a lista de questões, THE GetQuestoes SHALL remover o campo `respostas_corretas` de cada item antes de serializar a resposta.
2. THE GetQuestoes SHALL manter todos os outros campos do item (`pergunta`, `opcoes`, `explicacao`, `temas`, `SK`, `PK`) no retorno.
3. WHEN um item não contiver o campo `respostas_corretas`, THE GetQuestoes SHALL retornar o item normalmente sem lançar erro.

### Requirement 5: Infraestrutura Terraform — Lambda Module

**User Story:** Como engenheiro de infraestrutura, quero que o módulo Lambda gerencie as duas funções (GetQuestoes e CorrigirProva) com as permissões corretas, para que ambas possam ser provisionadas pelo mesmo módulo Terraform.

#### Acceptance Criteria

1. THE Lambda_Module SHALL definir um segundo `aws_lambda_function` com `function_name = "CorrigirProva"`, `handler = "lambda_function.lambda_handler"` e `runtime = "python3.12"`.
2. THE Lambda_Module SHALL empacotar o diretório `backend/corrigir/` em um arquivo zip para a CorrigirProva usando `archive_file`.
3. THE Lambda_Module SHALL reutilizar a IAM Role `aws_iam_role.lambda_exec_role` já existente para a CorrigirProva.
4. THE Lambda_Module SHALL adicionar a ação `dynamodb:BatchGetItem` à policy `dynamodb_read_policy` existente, mantendo `dynamodb:Query`.
5. THE Lambda_Module SHALL exportar `lambda_corrigir_invoke_arn` e `lambda_corrigir_function_name` no arquivo `outputs.tf`.

### Requirement 6: Infraestrutura Terraform — API Gateway Module

**User Story:** Como engenheiro de infraestrutura, quero que o módulo API Gateway exponha a rota POST /corrigir integrada à Lambda CorrigirProva com autenticação JWT, para que o endpoint fique disponível e protegido na AWS.

#### Acceptance Criteria

1. THE API_Gateway_Module SHALL aceitar as variáveis `lambda_corrigir_invoke_arn` e `lambda_corrigir_function_name` declaradas em `variables.tf`.
2. THE API_Gateway_Module SHALL criar um `aws_apigatewayv2_integration` para a CorrigirProva com `integration_type = "AWS_PROXY"` e `integration_method = "POST"`.
3. THE API_Gateway_Module SHALL criar uma rota `aws_apigatewayv2_route` com `route_key = "POST /corrigir"`, vinculada ao authorizer JWT existente com `authorization_type = "JWT"`.
4. THE API_Gateway_Module SHALL criar um `aws_lambda_permission` concedendo ao API Gateway permissão para invocar a CorrigirProva.
5. WHEN o módulo `api_gateway` é instanciado no `infra/main.tf`, THE Root_Module SHALL passar `lambda_corrigir_invoke_arn` e `lambda_corrigir_function_name` usando os outputs do módulo `lambda_get_questoes`.
