output "api_url" {
  value       = aws_apigatewayv2_api.http_api.api_endpoint
  description = "URL pública do API Gateway"
}