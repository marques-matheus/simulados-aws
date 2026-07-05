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

# 6. Dá permissão explícita para o API Gateway invocar a Lambda
resource "aws_lambda_permission" "api_gw_lambda" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}