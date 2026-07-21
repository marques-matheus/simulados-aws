"""
Lambda GetHistoricoAluno

Rota: GET /historico/{aluno_id}?certificacao=<opcional>

Controle de acesso:
  - Próprio aluno (sub == aluno_id): acesso total
  - Mentor: acesso se o aluno pertence a pelo menos uma turma do mentor
  - Outro aluno: 403

Deduplicação:
  Como a CorrigirProva grava um item por turma (mesmo PK/SK), o DynamoDB
  garante unicidade por PK+SK — não há duplicatas na tabela.
"""

import json
import boto3
from boto3.dynamodb.types import TypeDeserializer
from decimal import Decimal

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super().default(obj)

_deserializer = TypeDeserializer()

def deserializar(item):
    return {k: _deserializer.deserialize(v) for k, v in item.items()}

dynamodb = boto3.client('dynamodb', region_name='us-east-1')

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
}

HIST_TABLE   = 'Historico_Simulados'
TURMAS_TABLE = 'Turmas'
MAX_REGISTROS = 100


def get_claims(event):
    return (event.get('requestContext', {})
                 .get('authorizer', {})
                 .get('jwt', {})
                 .get('claims', {}))


def get_groups(claims):
    g = claims.get('cognito:groups', '')
    if isinstance(g, str):
        g = g.strip('[]').replace('"', '').replace("'", "")
        g = [x.strip() for x in g.split(',') if x.strip()]
    return g


def is_mentor(claims):
    return 'Mentores' in get_groups(claims)


def mentor_tem_acesso_ao_aluno(mentor_sub, aluno_id):
    """
    Retorna True se o aluno pertence a pelo menos uma turma do mentor.
    Busca as turmas do mentor e verifica se o aluno está em alguma delas.
    """
    try:
        # Lista turmas do mentor
        resp_mentor = dynamodb.query(
            TableName=TURMAS_TABLE,
            KeyConditionExpression='PK = :pk',
            ExpressionAttributeValues={':pk': {'S': f'MENTOR#{mentor_sub}'}},
        )
        turma_ids = [
            deserializar(i).get('turma_id', '')
            for i in resp_mentor.get('Items', [])
        ]

        if not turma_ids:
            return False

        # Verifica se o aluno é membro de alguma dessas turmas
        for turma_id in turma_ids:
            membro = dynamodb.get_item(
                TableName=TURMAS_TABLE,
                Key={
                    'PK': {'S': f'TURMA#{turma_id}'},
                    'SK': {'S': f'ALUNO#{aluno_id}'},
                }
            )
            if 'Item' in membro:
                return True

        return False

    except Exception as e:
        print(f"Aviso: falha ao verificar acesso do mentor {mentor_sub} ao aluno {aluno_id}: {e}")
        return False


def verificar_acesso(claims, aluno_id):
    """
    Retorna True se o acesso é permitido:
      - sub == aluno_id (próprio aluno), OU
      - é Mentor E o aluno pertence a uma das suas turmas
    """
    sub = claims.get('sub', '')

    if sub == aluno_id:
        return True

    if is_mentor(claims):
        return mentor_tem_acesso_ao_aluno(sub, aluno_id)

    return False


def buscar_historico(aluno_id, cert_filtro):
    """
    Query na tabela Historico_Simulados por PK = USER#<aluno_id>.
    Retorna até MAX_REGISTROS itens, ordenados do mais recente para o mais antigo.
    Aplica filtro por certificação se fornecido.
    """
    kwargs = {
        'TableName':                 HIST_TABLE,
        'KeyConditionExpression':    'PK = :pk',
        'ExpressionAttributeValues': {':pk': {'S': f'USER#{aluno_id}'}},
        'ScanIndexForward':          False,
    }

    if cert_filtro:
        kwargs['FilterExpression']                    = 'certificacao = :cert'
        kwargs['ExpressionAttributeValues'][':cert']  = {'S': cert_filtro}

    registros = []
    last_key  = None

    # Paginação interna: continua até ter MAX_REGISTROS ou esgotar a tabela
    while len(registros) < MAX_REGISTROS:
        if last_key:
            kwargs['ExclusiveStartKey'] = last_key
        elif 'ExclusiveStartKey' in kwargs:
            del kwargs['ExclusiveStartKey']

        # Limite por página: pede o quanto falta (DynamoDB aplica antes do filter)
        kwargs['Limit'] = MAX_REGISTROS - len(registros) + 50  # margem para o filter

        resp      = dynamodb.query(**kwargs)
        items     = [deserializar(i) for i in resp.get('Items', [])]
        registros.extend(items)
        last_key  = resp.get('LastEvaluatedKey')

        if not last_key:
            break

    return registros[:MAX_REGISTROS]


def lambda_handler(event, context):
    try:
        claims   = get_claims(event)
        aluno_id = (event.get('pathParameters') or {}).get('aluno_id', '')

        if not aluno_id:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'mensagem': "Parâmetro 'aluno_id' obrigatório."})
            }

        if not verificar_acesso(claims, aluno_id):
            return {
                'statusCode': 403,
                'headers': CORS_HEADERS,
                'body': json.dumps({'mensagem': 'Acesso negado.'})
            }

        query_params = event.get('queryStringParameters') or {}
        cert_filtro  = query_params.get('certificacao')

        print(f"Buscando histórico: aluno={aluno_id} cert={cert_filtro} caller={claims.get('sub','?')}")

        registros = buscar_historico(aluno_id, cert_filtro)

        # Formata para o contrato do frontend
        resultado = [
            {
                'id':             r.get('SK', ''),
                'certificacao':   r.get('certificacao', ''),
                'score':          r.get('score', 0),
                'corretas':       r.get('corretas', 0),
                'erradas':        r.get('erradas', 0),
                'puladas':        r.get('puladas', 0),
                'total':          r.get('total', 0),
                'tempo_segundos': r.get('tempo_segundos'),
                'data_iso':       r.get('data_iso', ''),
                'dominios':       r.get('dominios', {}),
            }
            for r in registros
        ]

        print(f"Retornando {len(resultado)} registros para aluno={aluno_id}")

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps(resultado, cls=DecimalEncoder)
        }

    except Exception as erro:
        print(f"Erro crítico na Lambda GetHistoricoAluno: {erro}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'mensagem': 'Erro interno no servidor.'})
        }
