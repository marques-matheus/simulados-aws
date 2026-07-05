module "cognito_simulados" {
  source = "./modules/cognito"

  user_pool_name = "simulados-aws-mentoria"
  
  # Atenção: Esse prefixo precisa ser globalmente único na AWS.
  # Invente um nome que ninguém tenha usado.
  domain_prefix  = "auth-simulados-xyz987" 

  # Aqui entra a URL do seu CloudFront (ou localhost se for testar rodando o index.html direto na máquina)
  callback_urls  = [
    "http://localhost:5500/", # URL do seu Live Server local
    "https://d1nv8jnyifu0hy.cloudfront.net/" # URL de produção
  ]
}
module "dynamodb_simulados" {
  source     = "./modules/dynamodb"
  table_name = "Simulados_AWS"
}
module "lambda_get_questoes" {
  source             = "./modules/lambda"
  dynamodb_table_arn = module.dynamodb_simulados.table_arn
}


module "api_gateway" {
  source               = "./modules/api_gateway"
  lambda_invoke_arn    = module.lambda_get_questoes.lambda_invoke_arn
  lambda_function_name = module.lambda_get_questoes.lambda_function_name

  # Passa os outputs do Cognito para criar o JWT Authorizer
  cognito_user_pool_id = module.cognito_simulados.user_pool_id
  cognito_client_id    = module.cognito_simulados.client_id

  # Nova Lambda de correção
  lambda_corrigir_invoke_arn    = module.lambda_get_questoes.lambda_corrigir_invoke_arn
  lambda_corrigir_function_name = module.lambda_get_questoes.lambda_corrigir_function_name
}

# Mostra as URLs finais no terminal quando o apply acabar
output "url_da_api" {
  value = "${module.api_gateway.api_url}/questoes"
}

output "url_da_api_corrigir" {
  value = "${module.api_gateway.api_url}/corrigir"
}