resource "aws_dynamodb_table" "simulados" {
  name         = var.table_name
  billing_mode = "PAY_PER_REQUEST"

  hash_key  = "PK"
  range_key = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  tags = {
    Environment = "Mentoria"
    Project     = "SimuladosAWS"
  }
}

# Tabela de histórico de simulados
# Padrões de acesso:
#   Histórico pessoal do aluno:  PK = USER#<sub>, SK = <data>#<uuid>
#   Histórico de uma turma:      GSI1PK = TURMA#<turma_id>
#
# Quando aluno tem N turmas (até 2), grava N itens com mesmo PK/SK base
# mas GSI1PKs diferentes. Aluno sem turma não preenche GSI1PK.
resource "aws_dynamodb_table" "historico_simulados" {
  name         = "Historico_Simulados"
  billing_mode = "PAY_PER_REQUEST"

  hash_key  = "PK"
  range_key = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  # GSI por turma: query GSI1PK = "TURMA#<id>" retorna todos os simulados da turma
  global_secondary_index {
    name            = "GSI1-turma-index"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
  }

  tags = {
    Environment = "Mentoria"
    Project     = "SimuladosAWS"
  }
}

# Tabela de turmas
# Padrões de acesso (single-table design):
#   Listar turmas de um mentor:  PK = MENTOR#<sub>,  SK begins_with TURMA#
#   Metadata de uma turma:       PK = TURMA#<id>,    SK = META
#   Listar alunos de uma turma:  PK = TURMA#<id>,    SK begins_with ALUNO#
#   Turmas de um aluno:          PK = ALUNO#<sub>,   SK begins_with TURMA#
#   Buscar turma por convite:    GSI codigo_convite
resource "aws_dynamodb_table" "turmas" {
  name         = "Turmas"
  billing_mode = "PAY_PER_REQUEST"

  hash_key  = "PK"
  range_key = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  # GSI para buscar turma por código de convite (entrada via link de convite)
  attribute {
    name = "codigo_convite"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI-codigo-convite"
    hash_key        = "codigo_convite"
    projection_type = "ALL"
  }

  tags = {
    Environment = "Mentoria"
    Project     = "SimuladosAWS"
  }
}
