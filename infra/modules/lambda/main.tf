# 1. Zipa a pasta com o script da GetQuestoes automaticamente
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.root}/../backend/get_questoes"
  output_path = "${path.root}/../backend/get_questoes.zip"
}

# 2. Zipa a pasta da nova Lambda CorrigirProva
data "archive_file" "lambda_corrigir_zip" {
  type        = "zip"
  source_dir  = "${path.root}/../backend/corrigir"
  output_path = "${path.root}/../backend/corrigir.zip"
}

# 3. Cria a "Identidade" (Role) compartilhada pelas duas Lambdas
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

# 4. Permissões no DynamoDB — Query (GetQuestoes) + BatchGetItem (CorrigirProva)
resource "aws_iam_role_policy" "dynamodb_read_policy" {
  name = "policy_leitura_simulados"
  role = aws_iam_role.lambda_exec_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Query",       # usado pela GetQuestoes
          "dynamodb:BatchGetItem" # usado pela CorrigirProva
        ]
        Resource = var.dynamodb_table_arn
      }
    ]
  })
}

# 5. Permissão básica para gerar logs no CloudWatch (ambas as Lambdas usam a mesma role)
resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# 6. Lambda GetQuestoes — retorna questões sem o gabarito
resource "aws_lambda_function" "get_questoes" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "GetQuestoes"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.12"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
}

# 7. Lambda CorrigirProva — recebe respostas, busca gabarito, devolve resultado
resource "aws_lambda_function" "corrigir_prova" {
  filename         = data.archive_file.lambda_corrigir_zip.output_path
  function_name    = "CorrigirProva"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.12"
  source_code_hash = data.archive_file.lambda_corrigir_zip.output_base64sha256
}