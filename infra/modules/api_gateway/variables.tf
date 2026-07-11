variable "lambda_invoke_arn" {
  type        = string
  description = "ARN de invocação da Lambda GetQuestoes"
}

variable "lambda_function_name" {
  type        = string
  description = "Nome da função Lambda GetQuestoes"
}

variable "cognito_user_pool_id" {
  type        = string
  description = "ID do User Pool do Cognito para o JWT Authorizer"
}

variable "cognito_client_id" {
  type        = string
  description = "Client ID do App Client do Cognito"
}

variable "lambda_corrigir_invoke_arn" {
  type        = string
  description = "ARN de invocação da Lambda CorrigirProva"
}

variable "lambda_corrigir_function_name" {
  type        = string
  description = "Nome da função Lambda CorrigirProva"
}

variable "lambda_get_historico_invoke_arn" {
  type        = string
  description = "ARN de invocação da Lambda GetHistoricoAluno"
}

variable "lambda_get_historico_function_name" {
  type        = string
  description = "Nome da função Lambda GetHistoricoAluno"
}

variable "lambda_get_dashboard_turma_invoke_arn" {
  type        = string
  description = "ARN de invocação da Lambda GetDashboardTurma"
}

variable "lambda_get_dashboard_turma_function_name" {
  type        = string
  description = "Nome da função Lambda GetDashboardTurma"
}

variable "lambda_gerenciar_turmas_invoke_arn" {
  type        = string
  description = "ARN de invocação da Lambda GerenciarTurmas"
}

variable "lambda_gerenciar_turmas_function_name" {
  type        = string
  description = "Nome da função Lambda GerenciarTurmas"
}
