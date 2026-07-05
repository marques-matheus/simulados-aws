import json
import boto3
from boto3.dynamodb.types import TypeDeserializer
from decimal import Decimal

# --- Utilitários ---

class DecimalEncoder(json.JSONEncoder):
    """Converte Decimal do DynamoDB para int ou float no JSON."""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super().default(obj)


_deserializer = TypeDeserializer()

def deserializar(item_dynamodb):
    """Converte item no formato DynamoDB wire ({S:..., N:..., L:...}) para dict Python."""
    return {k: _deserializer.deserialize(v) for k, v in item_dynamodb.items()}


def normalizar(resposta):
    """
    Converte a resposta do usuário (int, lista de int ou lista de str)
    para um set de int, permitindo comparação uniforme com o gabarito.

    Exemplos:
        normalizar(1)        → {1}
        normalizar([0, 2])   → {0, 2}
        normalizar(["1","3"])→ {1, 3}
    """
    if isinstance(resposta, list):
        return set(int(x) for x in resposta)
    return {int(resposta)}


def classificar_questao(idx, respostas_usuario, respostas_corretas_db):
    """
    Classifica uma questão como 'correta', 'errada' ou 'pulada'.

    Args:
        idx: índice da questão (int ou str) no mapa de respostas
        respostas_usuario: dict {str(idx) -> int ou lista de int}
        respostas_corretas_db: lista de strings do DynamoDB (ex: ["1"] ou ["0","2"])

    Returns:
        str: "correta", "errada" ou "pulada"
    """
    chave = str(idx)
    if chave not in respostas_usuario:
        return "pulada"

    gabarito = normalizar(respostas_corretas_db)
    resposta = normalizar(respostas_usuario[chave])

    return "correta" if resposta == gabarito else "errada"


def calcular_resultado(questoes_ids, respostas_usuario, itens_db):
    """
    Compara as respostas do usuário com o gabarito e monta o resultado completo.

    Args:
        questoes_ids: lista de SKs das questões na ordem exibida ao usuário
        respostas_usuario: dict {str(idx) -> int ou lista de int}
        itens_db: dict {SK -> item do DynamoDB}

    Returns:
        dict com score, total, corretas, erradas, puladas e detalhes
    """
    total = len(questoes_ids)
    if total == 0:
        return {
            "score": 0, "total": 0,
            "corretas": 0, "erradas": 0, "puladas": 0,
            "detalhes": []
        }

    corretas = 0
    erradas = 0
    puladas = 0
    detalhes = []

    for idx, sk in enumerate(questoes_ids):
        item = itens_db.get(sk)
        chave = str(idx)

        # Questão não encontrada no DynamoDB → trata como pulada
        if item is None:
            puladas += 1
            detalhes.append({
                "id": sk,
                "status": "pulada",
                "resposta_usuario": None,
                "resposta_correta": [],
                "explicacao": ""
            })
            continue

        respostas_corretas_db = item.get("respostas_corretas", [])
        status = classificar_questao(idx, respostas_usuario, respostas_corretas_db)

        if status == "correta":
            corretas += 1
        elif status == "errada":
            erradas += 1
        else:
            puladas += 1

        # Normaliza resposta_usuario para lista (ou null se pulada)
        if chave in respostas_usuario:
            resp_raw = respostas_usuario[chave]
            resp_normalizada = list(normalizar(resp_raw))
        else:
            resp_normalizada = None

        detalhes.append({
            "id": sk,
            "status": status,
            "resposta_usuario": resp_normalizada,
            "resposta_correta": [int(x) for x in respostas_corretas_db],
            "explicacao": item.get("explicacao", "")
        })

    score = round((corretas / total) * 100)

    return {
        "score": score,
        "total": total,
        "corretas": corretas,
        "erradas": erradas,
        "puladas": puladas,
        "detalhes": detalhes
    }


# --- Handler principal ---

# Conexão reaproveitada entre invocações (evita cold start extra)
dynamodb = boto3.client('dynamodb', region_name='us-east-1')

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
}

TABLE_NAME = 'Simulados_AWS'


def lambda_handler(event, context):
    try:
        # 1. Captura e valida o body
        try:
            body = json.loads(event.get('body') or '{}')
        except (json.JSONDecodeError, TypeError):
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'mensagem': 'Body inválido. Envie JSON válido.'})
            }

        prova = body.get('prova')
        questoes_ids = body.get('questoes_ids')
        respostas_usuario = body.get('respostas', {})

        if not prova:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'mensagem': "Campo 'prova' obrigatório."})
            }

        if not questoes_ids or not isinstance(questoes_ids, list) or len(questoes_ids) == 0:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'mensagem': "Campo 'questoes_ids' obrigatório e não pode ser vazio."})
            }

        # Garante que respostas_usuario usa chaves string
        respostas_usuario = {str(k): v for k, v in respostas_usuario.items()}

        print(f"Corrigindo prova '{prova}' com {len(questoes_ids)} questões.")

        # 2. Busca gabarito no DynamoDB via BatchGetItem
        pk_prefix = f"CERT#{prova}"
        keys = [
            {
                'PK': {'S': pk_prefix},
                'SK': {'S': sk}
            }
            for sk in questoes_ids
        ]

        # BatchGetItem aceita até 100 itens — simulados têm no máximo 65 questões
        response = dynamodb.batch_get_item(
            RequestItems={
                TABLE_NAME: {
                    'Keys': keys
                }
            }
        )

        # Trata UnprocessedKeys (throttle da AWS)
        unprocessed = response.get('UnprocessedKeys', {})
        if unprocessed:
            retry = dynamodb.batch_get_item(RequestItems=unprocessed)
            itens_raw = (
                response['Responses'].get(TABLE_NAME, []) +
                retry['Responses'].get(TABLE_NAME, [])
            )
        else:
            itens_raw = response['Responses'].get(TABLE_NAME, [])

        # 3. Deserializa os itens e indexa por SK
        itens_db = {
            item['SK']['S']: deserializar(item)
            for item in itens_raw
        }

        print(f"Itens encontrados no DynamoDB: {len(itens_db)}")

        # 4. Calcula resultado
        resultado = calcular_resultado(questoes_ids, respostas_usuario, itens_db)

        print(f"Score: {resultado['score']}% ({resultado['corretas']}/{resultado['total']})")

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps(resultado, cls=DecimalEncoder)
        }

    except Exception as erro:
        print(f"Erro crítico na Lambda CorrigirProva: {erro}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'mensagem': 'Erro interno no servidor ao corrigir a prova.'})
        }
