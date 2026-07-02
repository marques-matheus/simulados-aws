output "lambda_invoke_arn" {
  value       = aws_lambda_function.get_questoes.invoke_arn
  description = "ARN de invocação da Lambda (usado pelo API Gateway)"
}

output "lambda_function_name" {
  value       = aws_lambda_function.get_questoes.function_name
}