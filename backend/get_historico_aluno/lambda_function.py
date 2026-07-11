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

TABLE_NAME = 'Historico_Simulados'


def verificar_acesso(claims, aluno_id_path):
    """Retorna True se o sub do token == aluno_id_path OU se o usuário é Mentor."""
    sub    = claims.get('sub', '')
    groups = claims.get('cognito:groups', '')
    if isinstance(groups, str):
        groups = [g.strip() for g in groups.split(',') if g.strip()]
    return sub == aluno_id_path or 'Mentores' in groups


def lambda_handler(event, context):
    try:
        claims = (event.get('requestContext', {})
                       .get('authorizer', {})
                       .get('jwt', {})
                       .get('claims', {}))

        aluno_id = event.get('pathParameters', {}).get('aluno_id', '')
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

        print(f"Buscando histórico para aluno_id={aluno_id} cert={cert_filtro}")

        # Query por PK = USER#<aluno_id>, ordenado por SK decrescente (mais recente primeiro)
        kwargs = {
            'TableName': TABLE_NAME,
            'KeyConditionExpression': 'PK = :pk',
            'ExpressionAttributeValues': {':pk': {'S': f'USER#{aluno_id}'}},
            'ScanIndexForward': False,
        }

        # Filtro por certificação via FilterExpression
        if cert_filtro:
            kwargs['FilterExpression']               = 'certificacao = :cert'
            kwargs['ExpressionAttributeValues'][':cert'] = {'S': cert_filtro}

        # Paginação interna para garantir até 100 registros filtrados
        registros = []
        last_key  = None

        while len(registros) < 100:
            if last_key:
                kwargs['ExclusiveStartKey'] = last_key
            elif 'ExclusiveStartKey' in kwargs:
                del kwargs['ExclusiveStartKey']

            kwargs['Limit'] = 100  # por página (DynamoDB aplica antes do filter)

            resp     = dynamodb.query(**kwargs)
            items    = [deserializar(i) for i in resp.get('Items', [])]
            registros.extend(items)
            last_key = resp.get('LastEvaluatedKey')

            if not last_key:
                break

        registros = registros[:100]

        # Serializa cada registro no formato esperado pelo frontend
        resultado = [
            {
                'id':              r.get('SK', ''),
                'certificacao':    r.get('certificacao', ''),
                'score':           r.get('score', 0),
                'corretas':        r.get('corretas', 0),
                'erradas':         r.get('erradas', 0),
                'puladas':         r.get('puladas', 0),
                'total':           r.get('total', 0),
                'tempo_segundos':  r.get('tempo_segundos'),
                'data_iso':        r.get('data_iso', ''),
                'dominios':        r.get('dominios', {}),
            }
            for r in registros
        ]

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
