output "table_name" {
  value       = aws_dynamodb_table.simulados.name
  description = "O nome da tabela do DynamoDB"
}

output "table_arn" {
  value       = aws_dynamodb_table.simulados.arn
  description = "O ARN da tabela, usado para dar permissões no IAM"
}

output "historico_table_arn" {
  value       = aws_dynamodb_table.historico_simulados.arn
  description = "ARN da tabela Historico_Simulados, usado para permissões IAM"
}

output "historico_table_name" {
  value       = aws_dynamodb_table.historico_simulados.name
  description = "Nome da tabela Historico_Simulados"
}

output "turmas_table_arn" {
  value       = aws_dynamodb_table.turmas.arn
  description = "ARN da tabela Turmas, usado para permissões IAM"
}

output "turmas_table_name" {
  value       = aws_dynamodb_table.turmas.name
  description = "Nome da tabela Turmas"
}
