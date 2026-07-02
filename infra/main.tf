module "cognito_simulados" {
  source = "./modules/cognito"

  user_pool_name = "simulados-aws-mentoria"
  
  # Atenção: Esse prefixo precisa ser globalmente único na AWS.
  # Invente um nome que ninguém tenha usado.
  domain_prefix  = "auth-simulados-xyz987" 

  # Aqui entra a URL do seu CloudFront (ou localhost se for testar rodando o index.html direto na máquina)
  callback_urls  = [
    # "http://localhost:5500/", # URL do seu Live Server local
    "https://d1nv8jnyifu0hy.cloudfront.net/" # URL de produção
  ]
}
module "dynamodb_simulados" {
  source     = "./modules/dynamodb"
  table_name = "Simulados_AWS"
}
# Imprime a URL mágica de login no terminal quando o apply terminar
output "url_de_login" {
  value = module.cognito_simulados.login_url
}