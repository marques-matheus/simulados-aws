# User Pool
resource "aws_cognito_user_pool" "pool" {
  name = var.user_pool_name

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  lambda_config {
    pre_token_generation = var.pre_token_lambda_arn
  }
}

# App Client (Frontend)
resource "aws_cognito_user_pool_client" "client" {
  name         = "${var.user_pool_name}-frontend"
  user_pool_id = aws_cognito_user_pool.pool.id

  generate_secret = false 

  supported_identity_providers         = ["COGNITO"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["implicit", "code"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  
  callback_urls = var.callback_urls
  logout_urls   = var.callback_urls
}

# App Client (Mentor)
resource "aws_cognito_user_pool_client" "client_mentor" {
  name         = "${var.user_pool_name}-mentor"
  user_pool_id = aws_cognito_user_pool.pool.id

  generate_secret = false 

  supported_identity_providers         = ["COGNITO"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["implicit", "code"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  
  callback_urls = var.callback_urls
  logout_urls   = var.callback_urls
}

# Domínio da Hosted UI
resource "aws_cognito_user_pool_domain" "domain" {
  domain       = var.domain_prefix
  user_pool_id = aws_cognito_user_pool.pool.id
}

# Grupo para os Instrutores/Mentores
resource "aws_cognito_user_group" "mentores" {
  name         = "Mentores"
  user_pool_id = aws_cognito_user_pool.pool.id
  description  = "Acesso total ao dashboard e métricas de desempenho"
}

# Grupo para quem faz a prova
resource "aws_cognito_user_group" "alunos" {
  name         = "Alunos"
  user_pool_id = aws_cognito_user_pool.pool.id
  description  = "Acesso aos simulados e acompanhamento próprio"
}