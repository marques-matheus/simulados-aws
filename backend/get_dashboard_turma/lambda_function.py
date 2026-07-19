"""
Lambda GetDashboardTurma

Rota: GET /dashboard/turma/{turma_id}

Acesso restrito a Mentores donos da turma.

Retorna:
  - turma_id, nome_turma
  - alunos: todos os membros da turma (com histórico ou não)
  - ranking: alunos com pelo menos 1 simulado, ordenados por score_medio desc
  - dominios_fracos: top 5 domínios com menor média da turma
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

def deser(item):
    return {k: _deserializer.deserialize(v) for k, v in item.items()}

dynamodb     = boto3.client('dynamodb', region_name='us-east-1')
CORS_HEADERS = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}
HIST_TABLE   = 'Historico_Simulados'
HIST_INDEX   = 'GSI1-turma-index'
TURMAS_TABLE = 'Turmas'


def get_claims(event):
    return (event.get('requestContext', {})
                 .get('authorizer', {})
                 .get('jwt', {})
                 .get('claims', {}))


def get_groups(claims):
    g = claims.get('cognito:groups', '')
    if isinstance(g, str):
        g = [x.strip() for x in g.split(',') if x.strip()]
    return g


def is_mentor(claims):
    return 'Mentores' in get_groups(claims)


def resp(status, body):
    return {'statusCode': status, 'headers': CORS_HEADERS,
            'body': json.dumps(body, cls=DecimalEncoder)}


def calcular_tendencia(scores: list) -> str:
    """scores: lista do mais antigo para o mais recente."""
    if len(scores) < 2:
        return 'estavel'
    if scores[-1] > scores[-2]:
        return 'melhorando'
    if scores[-1] < scores[-2]:
        return 'piorando'
    return 'estavel'


def calcular_dominios_fracos(registros: list, top_n: int = 5) -> list:
    """Agrega o campo 'dominios' de todos os registros e retorna os top_n mais fracos."""
    soma, count = {}, {}
    for reg in registros:
        for dom, pct in reg.get('dominios', {}).items():
            # pct pode ser Decimal ou float — converte sempre para float
            soma[dom]  = soma.get(dom, 0.0) + float(pct)
            count[dom] = count.get(dom, 0)  + 1

    if not soma:
        return []

    medias = {d: round(soma[d] / count[d], 1) for d in soma}
    return [
        {'dominio': d, 'media_acerto': m}
        for d, m in sorted(medias.items(), key=lambda x: x[1])[:top_n]
    ]


def buscar_membros_turma(turma_id: str) -> dict:
    """
    Retorna dict {aluno_id -> email} com todos os membros da turma,
    consultando PK=TURMA#<id>, SK begins_with ALUNO#.
    """
    membros = {}
    try:
        resp_db = dynamodb.query(
            TableName=TURMAS_TABLE,
            KeyConditionExpression='PK = :pk AND begins_with(SK, :prefix)',
            ExpressionAttributeValues={
                ':pk':     {'S': f'TURMA#{turma_id}'},
                ':prefix': {'S': 'ALUNO#'},
            },
        )
        for item in resp_db.get('Items', []):
            d = deser(item)
            aluno_id = d.get('aluno_id', '')
            if aluno_id:
                membros[aluno_id] = d.get('email', aluno_id)
    except Exception as e:
        print(f"Aviso: falha ao buscar membros da turma {turma_id}: {e}")
    return membros


def buscar_historico_turma(turma_id: str) -> list:
    """Query no GSI: GSI1PK = TURMA#<id>. Retorna todos os registros históricos da turma."""
    todos    = []
    last_key = None
    while True:
        kwargs = {
            'TableName':                 HIST_TABLE,
            'IndexName':                 HIST_INDEX,
            'KeyConditionExpression':    'GSI1PK = :pk',
            'ExpressionAttributeValues': {':pk': {'S': f'TURMA#{turma_id}'}},
            'ScanIndexForward':          False,
        }
        if last_key:
            kwargs['ExclusiveStartKey'] = last_key
        r = dynamodb.query(**kwargs)
        todos.extend([deser(i) for i in r.get('Items', [])])
        last_key = r.get('LastEvaluatedKey')
        if not last_key:
            break
    return todos


def lambda_handler(event, context):
    try:
        claims   = get_claims(event)
        sub      = claims.get('sub', '')
        turma_id = (event.get('pathParameters') or {}).get('turma_id', '')

        # 1. Controle de acesso
        if not is_mentor(claims):
            return resp(403, {'mensagem': 'Acesso restrito a Mentores.'})

        if not turma_id:
            return resp(400, {'mensagem': "Parâmetro 'turma_id' obrigatório."})

        # 2. Verifica que o mentor é dono desta turma
        meta_resp = dynamodb.get_item(
            TableName=TURMAS_TABLE,
            Key={'PK': {'S': f'TURMA#{turma_id}'}, 'SK': {'S': 'META'}}
        )
        if 'Item' not in meta_resp:
            return resp(404, {'mensagem': 'Turma não encontrada.'})

        turma_meta = deser(meta_resp['Item'])
        if turma_meta.get('mentor_id') != sub:
            return resp(403, {'mensagem': 'Acesso negado. Esta turma pertence a outro mentor.'})

        nome_turma = turma_meta.get('nome', '')
        print(f"Dashboard da turma '{nome_turma}' ({turma_id}) solicitado por mentor={sub}")

        # 3. Busca membros da turma e histórico em paralelo (sequencial aqui, boto3 síncrono)
        membros  = buscar_membros_turma(turma_id)    # {aluno_id -> email}
        registros = buscar_historico_turma(turma_id)  # lista de dicts

        print(f"Turma {turma_id}: {len(membros)} membros, {len(registros)} registros históricos.")

        # 4. Agrupa registros por aluno
        hist_por_aluno = {}
        for reg in registros:
            aid = reg.get('aluno_id', '')
            if not aid:
                continue
            hist_por_aluno.setdefault(aid, []).append(reg)

        # 5. Monta resumo por aluno — inclui todos os membros, mesmo sem histórico
        alunos  = []
        ranking = []

        # Garante que membros sem histórico também aparecem
        todos_aluno_ids = set(membros.keys()) | set(hist_por_aluno.keys())

        for aid in todos_aluno_ids:
            email = membros.get(aid, hist_por_aluno.get(aid, [{}])[0].get('email', aid) if hist_por_aluno.get(aid) else aid)
            regs  = sorted(hist_por_aluno.get(aid, []), key=lambda r: r.get('data_iso', ''))

            scores_global = [r.get('score', 0) for r in regs]
            score_medio   = round(sum(scores_global) / len(scores_global), 1) if scores_global else 0

            # Agrupa por certificação
            por_cert = {}
            for reg in regs:
                cert = reg.get('certificacao', '')
                por_cert.setdefault(cert, []).append(reg)

            certs = []
            for cert, regs_cert in por_cert.items():
                regs_ord   = sorted(regs_cert, key=lambda r: r.get('data_iso', ''))
                sc         = [r.get('score', 0) for r in regs_ord]
                certs.append({
                    'cert':            cert,
                    'ultimo_score':    sc[-1] if sc else 0,
                    'tendencia':       calcular_tendencia(sc),
                    'total_simulados': len(regs_cert),
                })

            alunos.append({
                'aluno_id':        aid,
                'email':           email,
                'score_medio':     score_medio,
                'total_simulados': len(regs),
                'certificacoes':   certs,
            })

            # Ranking: só inclui alunos com pelo menos 1 simulado
            if regs:
                ranking.append({
                    'aluno_id':    aid,
                    'email':       email,
                    'score_medio': score_medio,
                })

        # Ordena ranking por score_medio decrescente
        ranking.sort(key=lambda x: x['score_medio'], reverse=True)

        # Ordena lista de alunos por email para exibição consistente
        alunos.sort(key=lambda x: x['email'].lower())

        return resp(200, {
            'turma_id':        turma_id,
            'nome_turma':      nome_turma,
            'total_membros':   len(membros),
            'alunos':          alunos,
            'ranking':         ranking,
            'dominios_fracos': calcular_dominios_fracos(registros),
        })

    except Exception as erro:
        print(f"Erro crítico na Lambda GetDashboardTurma: {erro}")
        return resp(500, {'mensagem': 'Erro interno no servidor.'})
