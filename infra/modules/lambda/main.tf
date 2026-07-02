# 1. Zipa a pasta com o seu script Python automaticamente
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.root}/../backend/get_questoes"
  output_path = "${path.root}/../backend/get_questoes.zip"
}

# 2. Cria a "Identidade" (Role) da Lambda na AWS
resource "aws_iam_role" "lambda_exec_role" {
  name = "role_get_questoes"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

# 3. Permissão de leitura no DynamoDB (Least Privilege)
resource "aws_iam_role_policy" "dynamodb_read_policy" {
  name = "policy_leitura_simulados"
  role = aws_iam_role.lambda_exec_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:Query"]
        Resource = var.dynamodb_table_arn # Usa o ARN que o módulo do banco exportou
      }
    ]
  })
}

# 4. Permissão básica para gerar logs no CloudWatch
resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# 5. A Função Lambda de fato
resource "aws_lambda_function" "get_questoes" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "GetQuestoes"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.12"
  
  # Garante que a AWS só atualize a Lambda se o código mudar
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256 
}