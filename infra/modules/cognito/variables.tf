variable "user_pool_name" {
  type        = string
  default     = "aws-mentorship-students"
  description = "nome do pool de usuarios"
}

variable "domain_prefix" {
  type        = string
  description = "Prefixo unico para URL de login hospedada pela AWS"
}

variable "callback_urls" {
  type        = list(string)
  description = "URLs autorizadas para redirecionamento"
}

variable "pre_token_lambda_arn" {
  type        = string
  description = "ARN da Lambda de Pre Token Generation"
}
