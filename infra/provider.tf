terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "mentorias-aws-tf-state-0626" # O nome do bucket que você criou
    key            = "simulados/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-state-lock"       # O nome da tabela do Dynamo
    encrypt        = true
  }
}

provider "aws" {
  region = "us-east-1"
}