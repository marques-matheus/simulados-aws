output "lambda_invoke_arn" {
  value       = aws_lambda_function.get_questoes.invoke_arn
  description = "ARN de invocação da Lambda GetQuestoes (usado pelo API Gateway)"
}

output "lambda_function_name" {
  value       = aws_lambda_function.get_questoes.function_name
}

output "lambda_corrigir_invoke_arn" {
  value       = aws_lambda_function.corrigir_prova.invoke_arn
  description = "ARN de invocação da Lambda CorrigirProva (usado pelo API Gateway)"
}

output "lambda_corrigir_function_name" {
  value       = aws_lambda_function.corrigir_prova.function_name
}