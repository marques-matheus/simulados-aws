output "lambda_invoke_arn" {
  value       = aws_lambda_function.get_questoes.invoke_arn
  description = "ARN de invocação da Lambda GetQuestoes"
}

output "lambda_function_name" {
  value = aws_lambda_function.get_questoes.function_name
}

output "lambda_corrigir_invoke_arn" {
  value       = aws_lambda_function.corrigir_prova.invoke_arn
  description = "ARN de invocação da Lambda CorrigirProva"
}

output "lambda_corrigir_function_name" {
  value = aws_lambda_function.corrigir_prova.function_name
}

output "lambda_get_historico_invoke_arn" {
  value       = aws_lambda_function.get_historico_aluno.invoke_arn
  description = "ARN de invocação da Lambda GetHistoricoAluno"
}

output "lambda_get_historico_function_name" {
  value = aws_lambda_function.get_historico_aluno.function_name
}

output "lambda_get_dashboard_turma_invoke_arn" {
  value       = aws_lambda_function.get_dashboard_turma.invoke_arn
  description = "ARN de invocação da Lambda GetDashboardTurma"
}

output "lambda_get_dashboard_turma_function_name" {
  value = aws_lambda_function.get_dashboard_turma.function_name
}

output "lambda_gerenciar_turmas_invoke_arn" {
  value       = aws_lambda_function.gerenciar_turmas.invoke_arn
  description = "ARN de invocação da Lambda GerenciarTurmas"
}

output "lambda_gerenciar_turmas_function_name" {
  value = aws_lambda_function.gerenciar_turmas.function_name
}

output "lambda_cognito_pre_token_arn" {
  value       = aws_lambda_function.cognito_pre_token.arn
  description = "ARN da Lambda de Pre Token Generation"
}
