# 1. Cria o API Gateway do tipo HTTP API
resource "aws_apigatewayv2_api" "http_api" {
  name          = "api-simulados-aws"
  protocol_type = "HTTP"

  # CORS: permite o frontend (CloudFront + localhost) chamar a API com o header Authorization
  cors_configuration {
    allow_origins = [
      "https://d1nv8jnyifu0hy.cloudfront.net",
      "http://localhost:5500"
    ]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["content-type", "authorization"]
  }
}

# 2. Cria o estágio padrão (Stage) onde a API fica pública imediatamente
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = "$default"
  auto_deploy = true
}

# 3. JWT Authorizer — valida o token do Cognito em cada requisição
resource "aws_apigatewayv2_authorizer" "cognito_jwt" {
  api_id           = aws_apigatewayv2_api.http_api.id
  authorizer_type  = "JWT"
  name             = "cognito-jwt-authorizer"
  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    # Onde o API Gateway vai buscar as chaves públicas para validar a assinatura do token
    issuer   = "https://cognito-idp.us-east-1.amazonaws.com/${var.cognito_user_pool_id}"
    # Quem é o dono válido do token (o App Client do Cognito)
    audience = [var.cognito_client_id]
  }
}

# 4. Conecta o API Gateway à sua função Lambda (Integração)
resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id           = aws_apigatewayv2_api.http_api.id
  integration_type = "AWS_PROXY"

  integration_uri    = var.lambda_invoke_arn
  integration_method = "POST" # A AWS exige que a invocação interna do Lambda seja POST
}

# 5. Define a rota protegida: GET /questoes exige token JWT válido
resource "aws_apigatewayv2_route" "get_questoes_route" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /questoes"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"

  # Vincula o authorizer — sem token válido, retorna 401 antes de chegar na Lambda
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

# 6. Dá permissão explícita para o API Gateway invocar a Lambda GetQuestoes
resource "aws_lambda_permission" "api_gw_lambda" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

# 7. Integração com a Lambda CorrigirProva
resource "aws_apigatewayv2_integration" "lambda_corrigir_integration" {
  api_id           = aws_apigatewayv2_api.http_api.id
  integration_type = "AWS_PROXY"

  integration_uri    = var.lambda_corrigir_invoke_arn
  integration_method = "POST"
}

# 8. Rota protegida: POST /corrigir exige token JWT válido
resource "aws_apigatewayv2_route" "post_corrigir_route" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "POST /corrigir"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_corrigir_integration.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

# 9. Permissão para o API Gateway invocar a Lambda CorrigirProva
resource "aws_lambda_permission" "api_gw_corrigir" {
  statement_id  = "AllowExecutionFromAPIGatewayCorrigir"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_corrigir_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

# 10. Integração com a Lambda GetHistoricoAluno
resource "aws_apigatewayv2_integration" "lambda_get_historico" {
  api_id             = aws_apigatewayv2_api.http_api.id
  integration_type   = "AWS_PROXY"
  integration_uri    = var.lambda_get_historico_invoke_arn
  integration_method = "POST"
}

# 11. Rota protegida: GET /historico/{aluno_id} exige token JWT válido
resource "aws_apigatewayv2_route" "get_historico_route" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "GET /historico/{aluno_id}"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_get_historico.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

# 12. Permissão para o API Gateway invocar a Lambda GetHistoricoAluno
resource "aws_lambda_permission" "api_gw_get_historico" {
  statement_id  = "AllowExecutionFromAPIGatewayGetHistorico"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_get_historico_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

# 13. Integração com a Lambda GetDashboardTurma
resource "aws_apigatewayv2_integration" "lambda_dashboard_turma" {
  api_id             = aws_apigatewayv2_api.http_api.id
  integration_type   = "AWS_PROXY"
  integration_uri    = var.lambda_get_dashboard_turma_invoke_arn
  integration_method = "POST"
}

# 14. Rota protegida: GET /dashboard/turma exige token JWT válido
resource "aws_apigatewayv2_route" "get_dashboard_turma_route" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "GET /dashboard/turma"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_dashboard_turma.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

# 15. Permissão para o API Gateway invocar a Lambda GetDashboardTurma
resource "aws_lambda_permission" "api_gw_dashboard_turma" {
  statement_id  = "AllowExecutionFromAPIGatewayDashboardTurma"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_get_dashboard_turma_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

# 16. Integração com a Lambda GerenciarTurmas
resource "aws_apigatewayv2_integration" "lambda_gerenciar_turmas" {
  api_id             = aws_apigatewayv2_api.http_api.id
  integration_type   = "AWS_PROXY"
  integration_uri    = var.lambda_gerenciar_turmas_invoke_arn
  integration_method = "POST"
}

# 17. POST /turmas — mentor cria uma nova turma
resource "aws_apigatewayv2_route" "post_turmas_route" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "POST /turmas"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_gerenciar_turmas.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

# 18. GET /turmas — mentor lista suas turmas; aluno lista as turmas em que está
resource "aws_apigatewayv2_route" "get_turmas_route" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "GET /turmas"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_gerenciar_turmas.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

# 19. POST /turmas/entrar — aluno entra em uma turma via código de convite
resource "aws_apigatewayv2_route" "post_turmas_entrar_route" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "POST /turmas/entrar"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_gerenciar_turmas.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

# 20. GET /turmas/{turma_id} — detalhes de uma turma e lista de alunos
resource "aws_apigatewayv2_route" "get_turma_route" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "GET /turmas/{turma_id}"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_gerenciar_turmas.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

# 21. GET /dashboard/turma/{turma_id} — dashboard de uma turma específica
resource "aws_apigatewayv2_route" "get_dashboard_turma_id_route" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "GET /dashboard/turma/{turma_id}"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_dashboard_turma.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

# 22. Permissão para o API Gateway invocar a Lambda GerenciarTurmas
resource "aws_lambda_permission" "api_gw_gerenciar_turmas" {
  statement_id  = "AllowExecutionFromAPIGatewayGerenciarTurmas"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_gerenciar_turmas_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

# --- Rotas de Turmas (GerenciarTurmas) ---

resource "aws_apigatewayv2_integration" "lambda_gerenciar_turmas" {
  api_id             = aws_apigatewayv2_api.http_api.id
  integration_type   = "AWS_PROXY"
  integration_uri    = var.lambda_gerenciar_turmas_invoke_arn
  integration_method = "POST"
}

# POST /turmas — mentor cria uma nova turma
resource "aws_apigatewayv2_route" "post_turmas_route" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "POST /turmas"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_gerenciar_turmas.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

# GET /turmas — mentor lista suas próprias turmas
resource "aws_apigatewayv2_route" "get_turmas_route" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "GET /turmas"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_gerenciar_turmas.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

# GET /turmas/{turma_id} — detalhe de uma turma (alunos membros)
resource "aws_apigatewayv2_route" "get_turma_detalhe_route" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "GET /turmas/{turma_id}"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_gerenciar_turmas.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

# POST /turmas/entrar — aluno entra na turma via código de convite
resource "aws_apigatewayv2_route" "post_turmas_entrar_route" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "POST /turmas/entrar"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_gerenciar_turmas.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

# DELETE /turmas/{turma_id}/membros/{aluno_id} — mentor remove aluno da turma
resource "aws_apigatewayv2_route" "delete_membro_route" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "DELETE /turmas/{turma_id}/membros/{aluno_id}"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_gerenciar_turmas.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

resource "aws_lambda_permission" "api_gw_gerenciar_turmas" {
  statement_id  = "AllowExecutionFromAPIGatewayGerenciarTurmas"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_gerenciar_turmas_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}