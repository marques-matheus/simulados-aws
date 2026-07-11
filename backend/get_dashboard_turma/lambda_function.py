"""
Lambda GetDashboardTurma

Rotas tratadas:
  GET /dashboard/turma/{turma_id}  — dados agregados de uma turma específica

O mentor só pode ver turmas que ele criou.
GSI1PK = "TURMA#<turma_id>" na tabela Historico_Simulados.
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
    if len(scores) < 2:
        return 'estavel'
    return 'melhorando' if scores[-1] > scores[-2] else ('piorando' if scores[-1] < scores[-2] else 'estavel')


def calcular_dominios_fracos(registros: list, top_n: int = 5) -> list:
    soma, count = {}, {}
    for reg in registros:
        for dom, pct in reg.get('dominios', {}).items():
            soma[dom]  = soma.get(dom, 0) + float(pct)
            count[dom] = count.get(dom, 0) + 1
    medias = {d: round(soma[d] / count[d], 1) for d in soma}
    return [{'dominio': d, 'media_acerto': m}
            for d, m in sorted(medias.items(), key=lambda x: x[1])[:top_n]]


def lambda_handler(event, context):
    try:
        claims   = get_claims(event)
        sub      = claims.get('sub', '')
        turma_id = (event.get('pathParameters') or {}).get('turma_id', '')

        if not is_mentor(claims):
            return resp(403, {'mensagem': 'Acesso restrito a Mentores.'})

        if not turma_id:
            return resp(400, {'mensagem': "Parâmetro 'turma_id' obrigatório."})

        # Verifica que o mentor é dono desta turma
        meta = dynamodb.get_item(
            TableName=TURMAS_TABLE,
            Key={'PK': {'S': f'TURMA#{turma_id}'}, 'SK': {'S': 'META'}}
        )
        if 'Item' not in meta:
            return resp(404, {'mensagem': 'Turma não encontrada.'})

        turma_meta = deser(meta['Item'])
        if turma_meta.get('mentor_id') != sub:
            return resp(403, {'mensagem': 'Acesso negado. Esta turma pertence a outro mentor.'})

        # Busca histórico da turma via GSI: GSI1PK = TURMA#<turma_id>
        todos = []
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

        print(f"Turma {turma_id}: {len(todos)} registros encontrados.")

        if not todos:
            return resp(200, {
                'turma_id':        turma_id,
                'nome_turma':      turma_meta.get('nome', ''),
                'alunos':          [],
                'ranking':         [],
                'dominios_fracos': [],
            })

        # Agrupa por aluno
        por_aluno = {}
        for reg in todos:
            aid = reg.get('aluno_id', '')
            if not aid:
                continue
            if aid not in por_aluno:
                por_aluno[aid] = {'aluno_id': aid, 'email': reg.get('email', aid), 'registros': []}
            por_aluno[aid]['registros'].append(reg)

        alunos, ranking = [], []
        for aid, dados in por_aluno.items():
            regs = sorted(dados['registros'], key=lambda r: r.get('data_iso', ''))
            scores_global = [r.get('score', 0) for r in regs]
            score_medio   = round(sum(scores_global) / len(scores_global), 1) if scores_global else 0

            por_cert = {}
            for reg in regs:
                cert = reg.get('certificacao', '')
                por_cert.setdefault(cert, []).append(reg)

            certs = []
            for cert, regs_cert in por_cert.items():
                regs_ord = sorted(regs_cert, key=lambda r: r.get('data_iso', ''))
                sc = [r.get('score', 0) for r in regs_ord]
                certs.append({
                    'cert':            cert,
                    'ultimo_score':    sc[-1] if sc else 0,
                    'tendencia':       calcular_tendencia(sc),
                    'total_simulados': len(regs_cert),
                })

            alunos.append({'aluno_id': aid, 'email': dados['email'],
                           'score_medio': score_medio, 'certificacoes': certs})
            ranking.append({'aluno_id': aid, 'email': dados['email'], 'score_medio': score_medio})

        ranking.sort(key=lambda x: x['score_medio'], reverse=True)

        return resp(200, {
            'turma_id':        turma_id,
            'nome_turma':      turma_meta.get('nome', ''),
            'alunos':          alunos,
            'ranking':         ranking,
            'dominios_fracos': calcular_dominios_fracos(todos),
        })

    except Exception as erro:
        print(f"Erro crítico na Lambda GetDashboardTurma: {erro}")
        return resp(500, {'mensagem': 'Erro interno no servidor.'})
