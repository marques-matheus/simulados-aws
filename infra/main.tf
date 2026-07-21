module "cognito_simulados" {
  source = "./modules/cognito"

  user_pool_name = "simulados-aws-mentoria"
  domain_prefix  = "auth-simulados-xyz987"

  callback_urls = [
    "http://localhost:5173/",
    "https://d1nv8jnyifu0hy.cloudfront.net/"
  ]

  pre_token_lambda_arn = module.lambda_get_questoes.lambda_cognito_pre_token_arn
}

module "dynamodb_simulados" {
  source     = "./modules/dynamodb"
  table_name = "Simulados_AWS"
}

module "lambda_get_questoes" {
  source              = "./modules/lambda"
  dynamodb_table_arn  = module.dynamodb_simulados.table_arn
  historico_table_arn = module.dynamodb_simulados.historico_table_arn
  turmas_table_arn    = module.dynamodb_simulados.turmas_table_arn
}

module "api_gateway" {
  source               = "./modules/api_gateway"
  lambda_invoke_arn    = module.lambda_get_questoes.lambda_invoke_arn
  lambda_function_name = module.lambda_get_questoes.lambda_function_name

  cognito_user_pool_id = module.cognito_simulados.user_pool_id
  cognito_client_id    = module.cognito_simulados.client_id

  lambda_corrigir_invoke_arn    = module.lambda_get_questoes.lambda_corrigir_invoke_arn
  lambda_corrigir_function_name = module.lambda_get_questoes.lambda_corrigir_function_name

  lambda_get_historico_invoke_arn    = module.lambda_get_questoes.lambda_get_historico_invoke_arn
  lambda_get_historico_function_name = module.lambda_get_questoes.lambda_get_historico_function_name

  lambda_get_dashboard_turma_invoke_arn    = module.lambda_get_questoes.lambda_get_dashboard_turma_invoke_arn
  lambda_get_dashboard_turma_function_name = module.lambda_get_questoes.lambda_get_dashboard_turma_function_name

  lambda_gerenciar_turmas_invoke_arn    = module.lambda_get_questoes.lambda_gerenciar_turmas_invoke_arn
  lambda_gerenciar_turmas_function_name = module.lambda_get_questoes.lambda_gerenciar_turmas_function_name
}

# Outputs
output "url_da_api"          { value = "${module.api_gateway.api_url}/questoes" }
output "url_da_api_corrigir" { value = "${module.api_gateway.api_url}/corrigir" }
output "url_da_api_historico"{ value = "${module.api_gateway.api_url}/historico/{aluno_id}" }
output "url_da_api_dashboard"{ value = "${module.api_gateway.api_url}/dashboard/turma" }
output "url_da_api_turmas"   { value = "${module.api_gateway.api_url}/turmas" }
output "client_id_mentor"    { value = module.cognito_simulados.client_id_mentor }
