import json
import boto3
from boto3.dynamodb.conditions import Key
from decimal import Decimal

class DecimalEncoder(json.JSONEncoder):
    """Converte Decimal do DynamoDB para int ou float no JSON."""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super().default(obj)

# Conexão reaproveitada (Cold Start)
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
tabela = dynamodb.Table('Simulados_AWS')

def lambda_handler(event, context):
    try:
        # 1. O PULO DO GATO: Captura o parâmetro da URL (ex: ?prova=SAA-C03)
        query_params = event.get('queryStringParameters') or {}
        
        # Se o frontend não mandar qual é a prova, ele assume CLF-C02 como segurança (fallback)
        prova_solicitada = query_params.get('prova', 'CLF-C02') 
        
        certificacao = f"CERT#{prova_solicitada}"
        print(f"Buscando questões para: {certificacao}")

        # 2. Busca no banco de dados usando Query
        resposta = tabela.query(
            KeyConditionExpression=Key('PK').eq(certificacao)
        )
        
        # 3. Retorna a lista completa (mantendo o gabarito liberado conforme decidimos)
        questoes = resposta.get('Items', [])
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps(questoes, cls=DecimalEncoder)
        }

    except Exception as erro:
        print(f"Erro crítico na Lambda: {erro}")
        return {
            'statusCode': 500,
            'body': json.dumps({'mensagem': 'Erro interno no servidor ao buscar questoes.'})
        }