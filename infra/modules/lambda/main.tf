# --- Empacotamento das Lambdas ---

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.root}/../backend/get_questoes"
  output_path = "${path.root}/../backend/get_questoes.zip"
}

data "archive_file" "lambda_corrigir_zip" {
  type        = "zip"
  source_dir  = "${path.root}/../backend/corrigir"
  output_path = "${path.root}/../backend/corrigir.zip"
}

data "archive_file" "lambda_get_historico_zip" {
  type        = "zip"
  source_dir  = "${path.root}/../backend/get_historico_aluno"
  output_path = "${path.root}/../backend/get_historico_aluno.zip"
}

data "archive_file" "lambda_dashboard_turma_zip" {
  type        = "zip"
  source_dir  = "${path.root}/../backend/get_dashboard_turma"
  output_path = "${path.root}/../backend/get_dashboard_turma.zip"
}

data "archive_file" "lambda_gerenciar_turmas_zip" {
  type        = "zip"
  source_dir  = "${path.root}/../backend/gerenciar_turmas"
  output_path = "${path.root}/../backend/gerenciar_turmas.zip"
}

# --- IAM Role compartilhada por todas as Lambdas ---

resource "aws_iam_role" "lambda_exec_role" {
  name = "role_get_questoes"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

# Permissões na tabela Simulados_AWS
resource "aws_iam_role_policy" "dynamodb_read_policy" {
  name = "policy_leitura_simulados"
  role = aws_iam_role.lambda_exec_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["dynamodb:Query", "dynamodb:BatchGetItem"]
      Resource = var.dynamodb_table_arn
    }]
  })
}

# Permissões na tabela Historico_Simulados (inclui GSI)
resource "aws_iam_role_policy" "historico_policy" {
  name = "policy_historico_simulados"
  role = aws_iam_role.lambda_exec_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["dynamodb:PutItem", "dynamodb:Query", "dynamodb:GetItem"]
      Resource = [
        var.historico_table_arn,
        "${var.historico_table_arn}/index/*"
      ]
    }]
  })
}

# Permissões na tabela Turmas (inclui GSI de código de convite)
resource "aws_iam_role_policy" "turmas_policy" {
  name = "policy_turmas"
  role = aws_iam_role.lambda_exec_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem"
      ]
      Resource = [
        var.turmas_table_arn,
        "${var.turmas_table_arn}/index/*"
      ]
    }]
  })
}

# Logs no CloudWatch
resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# --- Funções Lambda ---

resource "aws_lambda_function" "get_questoes" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "GetQuestoes"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.12"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
}

resource "aws_lambda_function" "corrigir_prova" {
  filename         = data.archive_file.lambda_corrigir_zip.output_path
  function_name    = "CorrigirProva"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.12"
  source_code_hash = data.archive_file.lambda_corrigir_zip.output_base64sha256
}

resource "aws_lambda_function" "get_historico_aluno" {
  filename         = data.archive_file.lambda_get_historico_zip.output_path
  function_name    = "GetHistoricoAluno"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.12"
  source_code_hash = data.archive_file.lambda_get_historico_zip.output_base64sha256
}

resource "aws_lambda_function" "get_dashboard_turma" {
  filename         = data.archive_file.lambda_dashboard_turma_zip.output_path
  function_name    = "GetDashboardTurma"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.12"
  source_code_hash = data.archive_file.lambda_dashboard_turma_zip.output_base64sha256
}

# Lambda para CRUD de turmas (criar, listar, entrar via convite, remover aluno)
resource "aws_lambda_function" "gerenciar_turmas" {
  filename         = data.archive_file.lambda_gerenciar_turmas_zip.output_path
  function_name    = "GerenciarTurmas"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.12"
  source_code_hash = data.archive_file.lambda_gerenciar_turmas_zip.output_base64sha256
}
