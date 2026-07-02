# 1. Cria o API Gateway do tipo HTTP API
resource "aws_apigatewayv2_api" "http_api" {
  name          = "api-simulados-aws"
  protocol_type = "HTTP"

  # Configuração de CORS para permitir que o seu frontend (CloudFront) consulte a API
  cors_configuration {
    allow_origins = ["*"] # Depois podemos restringir para a URL exata do seu CloudFront
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

# 3. Conecta o API Gateway à sua função Lambda (Integração)
resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id           = aws_apigatewayv2_api.http_api.id
  integration_type = "AWS_PROXY"

  integration_uri    = var.lambda_invoke_arn
  integration_method = "POST" # A AWS exige que a invocação interna do Lambda seja POST
}

# 4. Define a rota pública que o frontend vai chamar: GET /questoes
resource "aws_apigatewayv2_route" "get_questoes_route" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /questoes"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

# 5. O PULO DO GATO: Dá permissão explícita para o API Gateway invocar a Lambda
resource "aws_lambda_permission" "api_gw_lambda" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}