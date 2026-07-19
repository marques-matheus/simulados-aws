import json
import uuid
import boto3
from boto3.dynamodb.types import TypeDeserializer
from datetime import datetime, timezone
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
    Converte a resposta do usuário (int ou lista de int)
    para um set de int para comparação.
    """
    if isinstance(resposta, list):
        return set(int(x) for x in resposta)
    return {int(resposta)}


def gabarito_para_indices(respostas_corretas_db, opcoes):
    """
    Converte respostas_corretas do DynamoDB (lista de textos)
    para um set de índices inteiros.
    """
    indices = set()
    for texto_correto in respostas_corretas_db:
        try:
            idx = opcoes.index(texto_correto)
            indices.add(idx)
        except ValueError:
            import re as _re
            texto_limpo = str(texto_correto).strip()
            for i, opcao in enumerate(opcoes):
                opcao_limpa = str(opcao).strip()
                opcao_sem_prefixo = _re.sub(r'^[A-H][\.\)]\s*', '', opcao_limpa)
                if opcao_limpa == texto_limpo or opcao_sem_prefixo == texto_limpo:
                    indices.add(i)
                    break
    return indices


def classificar_questao(idx, respostas_usuario, respostas_corretas_db, opcoes):
    chave = str(idx)
    if chave not in respostas_usuario:
        return "pulada"
    gabarito = gabarito_para_indices(respostas_corretas_db, opcoes)
    resposta = normalizar(respostas_usuario[chave])
    return "correta" if resposta == gabarito else "errada"


def calcular_resultado(questoes_ids, respostas_usuario, itens_db):
    total = len(questoes_ids)
    if total == 0:
        return {"score": 0, "total": 0, "corretas": 0, "erradas": 0, "puladas": 0, "detalhes": []}

    corretas = erradas = puladas = 0
    detalhes = []

    for idx, sk in enumerate(questoes_ids):
        item  = itens_db.get(sk)
        chave = str(idx)

        if item is None:
            puladas += 1
            detalhes.append({"id": sk, "status": "pulada",
                              "resposta_usuario": None, "resposta_correta": [], "explicacao": ""})
            continue

        opcoes                = item.get("opcoes", [])
        respostas_corretas_db = item.get("respostas_corretas", [])
        status = classificar_questao(idx, respostas_usuario, respostas_corretas_db, opcoes)

        if status == "correta":   corretas += 1
        elif status == "errada":  erradas  += 1
        else:                     puladas  += 1

        resp_normalizada = (sorted(list(normalizar(respostas_usuario[chave])))
                            if chave in respostas_usuario else None)
        gabarito_indices = sorted(list(gabarito_para_indices(respostas_corretas_db, opcoes)))

        detalhes.append({
            "id":               sk,
            "status":           status,
            "resposta_usuario": resp_normalizada,
            "resposta_correta": gabarito_indices,
            "explicacao":       item.get("explicacao", "")
        })

    return {
        "score":    round((corretas / total) * 100),
        "total":    total,
        "corretas": corretas,
        "erradas":  erradas,
        "puladas":  puladas,
        "detalhes": detalhes
    }


def calcular_dominios(questoes_ids, itens_db, detalhes):
    """
    Calcula o percentual de acerto por domínio (campo 'temas' de cada questão).

    Returns: dict[str, float] — ex: {"Armazenamento": 85.0, "Segurança": 60.0}
    """
    acertos = {}  # tema -> [total, corretas]

    # Indexa detalhes por SK para acesso O(1)
    detalhes_por_sk = {d['id']: d for d in detalhes}

    for sk in questoes_ids:
        item    = itens_db.get(sk)
        detalhe = detalhes_por_sk.get(sk)
        if item is None or detalhe is None:
            continue
        for tema in item.get('temas', []):
            if tema not in acertos:
                acertos[tema] = [0, 0]
            acertos[tema][0] += 1
            if detalhe['status'] == 'correta':
                acertos[tema][1] += 1

    return {
        tema: round((vals[1] / vals[0]) * 100, 1)
        for tema, vals in acertos.items()
        if vals[0] > 0
    }


def buscar_turmas_do_aluno(aluno_id):
    """
    Consulta a tabela Turmas e retorna lista de turma_ids do aluno.
    Tolerante a falhas — retorna [] em caso de erro.
    """
    try:
        resp = dynamodb.query(
            TableName='Turmas',
            KeyConditionExpression='PK = :pk',
            ExpressionAttributeValues={':pk': {'S': f'ALUNO#{aluno_id}'}},
        )
        turma_ids = []
        for item in resp.get('Items', []):
            sk = item.get('SK', {}).get('S', '')
            if sk.startswith('TURMA#'):
                turma_ids.append(sk.replace('TURMA#', ''))
        return turma_ids
    except Exception as e:
        print(f"Aviso: falha ao buscar turmas do aluno {aluno_id}: {e}")
        return []


def salvar_historico(claims, prova, resultado, dominios, tempo_segundos):
    """
    Persiste o resultado do simulado na tabela Historico_Simulados.

    Se o aluno pertence a N turmas (até 2), grava N itens com GSI1PKs distintos.
    Se o aluno não tem turma, grava apenas o item principal (sem GSI1PK).
    Tolerante a falhas — exceções são logadas mas não propagadas.
    """
    try:
        aluno_id = claims.get('sub', '')
        email    = claims.get('email', '')
        data_iso = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        uid      = str(uuid.uuid4())

        # Campos comuns a todos os itens
        item_base = {
            'PK':           {'S': f'USER#{aluno_id}'},
            'SK':           {'S': f'{data_iso}#{uid}'},
            'aluno_id':     {'S': aluno_id},
            'email':        {'S': email},
            'certificacao': {'S': prova},
            'score':        {'N': str(resultado['score'])},
            'corretas':     {'N': str(resultado['corretas'])},
            'erradas':      {'N': str(resultado['erradas'])},
            'puladas':      {'N': str(resultado['puladas'])},
            'total':        {'N': str(resultado['total'])},
            'data_iso':     {'S': data_iso},
            'dominios':     {'M': {k: {'N': str(v)} for k, v in dominios.items()}},
        }

        if tempo_segundos is not None:
            item_base['tempo_segundos'] = {'N': str(int(tempo_segundos))}
        else:
            item_base['tempo_segundos'] = {'NULL': True}

        turma_ids = buscar_turmas_do_aluno(aluno_id)

        if turma_ids:
            # Grava um item por turma, com GSI1PK = TURMA#<id>
            # O PK/SK é único por simulado, então não há duplicidade na visão do aluno
            for turma_id in turma_ids:
                item = {
                    **item_base,
                    'turma_id': {'S': turma_id},
                    'GSI1PK':   {'S': f'TURMA#{turma_id}'},
                    'GSI1SK':   {'S': f'{aluno_id}#{data_iso}#{uid}'},
                }
                dynamodb.put_item(TableName='Historico_Simulados', Item=item)
                print(f"Histórico salvo: aluno={aluno_id} turma={turma_id} cert={prova} score={resultado['score']}")
        else:
            # Aluno sem turma: grava só o item base (sem GSI, não aparece em dashboards)
            dynamodb.put_item(TableName='Historico_Simulados', Item=item_base)
            print(f"Histórico salvo (sem turma): aluno={aluno_id} cert={prova} score={resultado['score']}")

    except Exception as erro:
        # Falha de persistência não interrompe o retorno do resultado ao aluno
        print(f"AVISO: falha ao salvar histórico para aluno={claims.get('sub')}: {erro}")


# --- Conexões reaproveitadas entre invocações ---

dynamodb = boto3.client('dynamodb', region_name='us-east-1')

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
}

SIMULADOS_TABLE = 'Simulados_AWS'


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

        prova             = body.get('prova')
        questoes_ids      = body.get('questoes_ids')
        respostas_usuario = body.get('respostas', {})
        tempo_segundos    = body.get('tempo_segundos')  # pode ser None

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

        # Extrai claims do JWT (injetados pelo API Gateway HTTP API v2)
        claims = (event.get('requestContext', {})
                       .get('authorizer', {})
                       .get('jwt', {})
                       .get('claims', {}))

        # Garante chaves string no mapa de respostas
        respostas_usuario = {str(k): v for k, v in respostas_usuario.items()}

        print(f"Corrigindo prova '{prova}' com {len(questoes_ids)} questões. aluno={claims.get('sub','?')}")

        # 2. Busca gabarito no DynamoDB via BatchGetItem
        keys = [{'PK': {'S': f'CERT#{prova}'}, 'SK': {'S': sk}} for sk in questoes_ids]

        response = dynamodb.batch_get_item(
            RequestItems={SIMULADOS_TABLE: {'Keys': keys}}
        )

        # Trata UnprocessedKeys (throttle da AWS)
        unprocessed = response.get('UnprocessedKeys', {})
        if unprocessed:
            retry    = dynamodb.batch_get_item(RequestItems=unprocessed)
            itens_raw = (response['Responses'].get(SIMULADOS_TABLE, []) +
                         retry['Responses'].get(SIMULADOS_TABLE, []))
        else:
            itens_raw = response['Responses'].get(SIMULADOS_TABLE, [])

        # 3. Deserializa e indexa por SK
        itens_db = {item['SK']['S']: deserializar(item) for item in itens_raw}
        print(f"Itens encontrados: {len(itens_db)}")

        # 4. Calcula resultado
        resultado = calcular_resultado(questoes_ids, respostas_usuario, itens_db)
        print(f"Score: {resultado['score']}% ({resultado['corretas']}/{resultado['total']})")

        # 5. Calcula desempenho por domínio
        dominios = calcular_dominios(questoes_ids, itens_db, resultado['detalhes'])

        # 6. Persiste histórico (tolerante a falhas — não bloqueia o retorno)
        salvar_historico(claims, prova, resultado, dominios, tempo_segundos)

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
