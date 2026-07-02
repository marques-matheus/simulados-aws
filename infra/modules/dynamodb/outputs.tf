output "table_name" {
  value       = aws_dynamodb_table.simulados.name
  description = "O nome da tabela do DynamoDB"
}

output "table_arn" {
  value       = aws_dynamodb_table.simulados.arn
  description = "O ARN da tabela, usado para dar permissões no IAM"
}