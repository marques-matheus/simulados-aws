"""
Lambda GerenciarTurmas — roteador único para todas as operações de turma.

Rotas tratadas (via routeKey no event):
  POST /turmas              → criar_turma        (Mentor)
  GET  /turmas              → listar_turmas       (Mentor vê as suas; Aluno vê as dele)
  GET  /turmas/{turma_id}  → detalhar_turma      (Mentor dono ou Aluno membro)
  POST /turmas/entrar       → entrar_turma        (Aluno — envia codigo_convite)

Tabela Turmas — padrão de itens:
  Metadata da turma:   PK=TURMA#<id>   SK=META        → nome, mentor_id, mentor_email, codigo_convite, data_criacao
  Membro aluno:        PK=TURMA#<id>   SK=ALUNO#<sub> → email, data_entrada
  Índice mentor:       PK=MENTOR#<sub> SK=TURMA#<id>  → nome_turma (para listar turmas do mentor)
  Índice aluno:        PK=ALUNO#<sub>  SK=TURMA#<id>  → nome_turma (para listar turmas do aluno)
"""

import json
import uuid
import boto3
from boto3.dynamodb.types import TypeDeserializer
from datetime import datetime, timezone
from decimal import Decimal

# ---------------------------------------------------------------------------
# Utilitários
# ---------------------------------------------------------------------------

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super().default(obj)

_deserializer = TypeDeserializer()

def deser(item):
    return {k: _deserializer.deserialize(v) for k, v in item.items()}

dynamodb = boto3.client('dynamodb', region_name='us-east-1')

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
}

TABLE_NAME = 'Turmas'

MAX_TURMAS_POR_ALUNO = 2


def get_claims(event):
    return (event.get('requestContext', {})
                 .get('authorizer', {})
                 .get('jwt', {})
                 .get('claims', {}))

def get_groups(claims):
    groups = claims.get('cognito:groups', '')
    if isinstance(groups, str):
        groups = groups.strip('[]').replace('"', '').replace("'", "")
        groups = [g.strip() for g in groups.split(',') if g.strip()]
    return groups

def is_mentor(claims):
    return 'Mentores' in get_groups(claims)

def resp(status, body):
    return {
        'statusCode': status,
        'headers': CORS_HEADERS,
        'body': json.dumps(body, cls=DecimalEncoder)
    }


# ---------------------------------------------------------------------------
# Handlers por operação
# ---------------------------------------------------------------------------

def criar_turma(claims, body):
    """POST /turmas — apenas Mentor."""
    if not is_mentor(claims):
        return resp(403, {'mensagem': 'Apenas Mentores podem criar turmas.'})

    nome = (body.get('nome') or body.get('nome_turma') or '').strip()
    if not nome:
        return resp(400, {'mensagem': "Campo 'nome' ou 'nome_turma' obrigatório."})

    mentor_id    = claims.get('sub', '')
    mentor_email = claims.get('email', '')
    turma_id     = str(uuid.uuid4())
    codigo       = str(uuid.uuid4())[:8].upper()  # ex: "A3F2B1C9"
    data_criacao = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

    # Item de metadata da turma
    dynamodb.put_item(TableName=TABLE_NAME, Item={
        'PK':             {'S': f'TURMA#{turma_id}'},
        'SK':             {'S': 'META'},
        'nome':           {'S': nome},
        'mentor_id':      {'S': mentor_id},
        'mentor_email':   {'S': mentor_email},
        'codigo_convite': {'S': codigo},
        'data_criacao':   {'S': data_criacao},
    })

    # Índice reverso: mentor → turma
    dynamodb.put_item(TableName=TABLE_NAME, Item={
        'PK':         {'S': f'MENTOR#{mentor_id}'},
        'SK':         {'S': f'TURMA#{turma_id}'},
        'nome_turma': {'S': nome},
        'turma_id':   {'S': turma_id},
        'data_criacao': {'S': data_criacao},
    })

    return resp(201, {
        'turma_id':       turma_id,
        'nome':           nome,
        'codigo_convite': codigo,
        'data_criacao':   data_criacao,
    })


def listar_turmas(claims):
    """GET /turmas — Mentor lista as suas; Aluno lista as dele."""
    sub = claims.get('sub', '')

    if is_mentor(claims):
        pk = f'MENTOR#{sub}'
    else:
        pk = f'ALUNO#{sub}'

    resp_db = dynamodb.query(
        TableName=TABLE_NAME,
        KeyConditionExpression='PK = :pk',
        ExpressionAttributeValues={':pk': {'S': pk}},
    )

    turmas = [deser(i) for i in resp_db.get('Items', [])]
    return resp(200, turmas)


def detalhar_turma(claims, turma_id):
    """GET /turmas/{turma_id} — Mentor dono ou Aluno membro."""
    sub = claims.get('sub', '')

    # Busca metadata
    meta_resp = dynamodb.get_item(
        TableName=TABLE_NAME,
        Key={'PK': {'S': f'TURMA#{turma_id}'}, 'SK': {'S': 'META'}}
    )
    meta = deser(meta_resp['Item']) if 'Item' in meta_resp else None
    if not meta:
        return resp(404, {'mensagem': 'Turma não encontrada.'})

    # Verifica acesso: mentor dono ou aluno membro
    if is_mentor(claims):
        if meta.get('mentor_id') != sub:
            return resp(403, {'mensagem': 'Acesso negado.'})
    else:
        membro_resp = dynamodb.get_item(
            TableName=TABLE_NAME,
            Key={'PK': {'S': f'TURMA#{turma_id}'}, 'SK': {'S': f'ALUNO#{sub}'}}
        )
        if 'Item' not in membro_resp:
            return resp(403, {'mensagem': 'Acesso negado.'})

    # Lista alunos da turma
    alunos_resp = dynamodb.query(
        TableName=TABLE_NAME,
        KeyConditionExpression='PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues={
            ':pk':     {'S': f'TURMA#{turma_id}'},
            ':prefix': {'S': 'ALUNO#'},
        },
    )
    alunos = [deser(i) for i in alunos_resp.get('Items', [])]

    return resp(200, {**meta, 'alunos': alunos})


def entrar_turma(claims, body):
    """POST /turmas/entrar — Aluno entra em turma via código de convite."""
    if is_mentor(claims):
        return resp(403, {'mensagem': 'Mentores não podem entrar em turmas como alunos.'})

    codigo = (body.get('codigo_convite') or '').strip().upper()
    if not codigo:
        return resp(400, {'mensagem': "Campo 'codigo_convite' obrigatório."})

    sub   = claims.get('sub', '')
    email = claims.get('email', '')

    # Busca turma pelo código via GSI
    gsi_resp = dynamodb.query(
        TableName=TABLE_NAME,
        IndexName='GSI-codigo-convite',
        KeyConditionExpression='codigo_convite = :codigo',
        ExpressionAttributeValues={':codigo': {'S': codigo}},
    )
    items = gsi_resp.get('Items', [])
    if not items:
        return resp(404, {'mensagem': 'Código de convite inválido ou expirado.'})

    turma_meta = deser(items[0])
    turma_id   = turma_meta['PK'].replace('TURMA#', '')
    nome_turma = turma_meta.get('nome', '')

    # Verifica se o aluno já está nesta turma
    ja_membro = dynamodb.get_item(
        TableName=TABLE_NAME,
        Key={'PK': {'S': f'TURMA#{turma_id}'}, 'SK': {'S': f'ALUNO#{sub}'}}
    )
    if 'Item' in ja_membro:
        return resp(409, {'mensagem': 'Você já é membro desta turma.'})

    # Verifica limite de 2 turmas por aluno
    turmas_aluno = dynamodb.query(
        TableName=TABLE_NAME,
        KeyConditionExpression='PK = :pk',
        ExpressionAttributeValues={':pk': {'S': f'ALUNO#{sub}'}},
        Select='COUNT',
    )
    if turmas_aluno.get('Count', 0) >= MAX_TURMAS_POR_ALUNO:
        return resp(409, {
            'mensagem': f'Limite de {MAX_TURMAS_POR_ALUNO} turmas por aluno atingido.'
        })

    data_entrada = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

    # Adiciona aluno na turma
    dynamodb.put_item(TableName=TABLE_NAME, Item={
        'PK':          {'S': f'TURMA#{turma_id}'},
        'SK':          {'S': f'ALUNO#{sub}'},
        'aluno_id':    {'S': sub},
        'email':       {'S': email},
        'data_entrada':{'S': data_entrada},
    })

    # Índice reverso: aluno → turma
    dynamodb.put_item(TableName=TABLE_NAME, Item={
        'PK':         {'S': f'ALUNO#{sub}'},
        'SK':         {'S': f'TURMA#{turma_id}'},
        'turma_id':   {'S': turma_id},
        'nome_turma': {'S': nome_turma},
        'data_entrada':{'S': data_entrada},
    })

    return resp(200, {
        'mensagem':   f'Você entrou na turma "{nome_turma}" com sucesso.',
        'turma_id':   turma_id,
        'nome_turma': nome_turma,
    })


def atualizar_perfil(claims, body):
    """POST /perfil — atualiza o nome do usuário e replica nas turmas onde é aluno."""
    nome = (body.get('nome') or '').strip()
    if not nome:
        return resp(400, {'mensagem': "Campo 'nome' obrigatório."})
        
    sub = claims.get('sub', '')
    
    # 1. Salva o perfil do usuário na tabela (para consultas futuras se necessário)
    dynamodb.put_item(TableName=TABLE_NAME, Item={
        'PK': {'S': f'USER#{sub}'},
        'SK': {'S': 'PERFIL'},
        'nome': {'S': nome},
    })
    
    # 2. Busca todas as turmas que este usuário é aluno
    resp_db = dynamodb.query(
        TableName=TABLE_NAME,
        KeyConditionExpression='PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues={
            ':pk': {'S': f'ALUNO#{sub}'},
            ':prefix': {'S': 'TURMA#'}
        }
    )
    
    # 3. Para cada turma que ele está, atualiza o item de membro com o nome
    for item in resp_db.get('Items', []):
        d = deser(item)
        turma_id = d.get('turma_id') or d.get('SK', '').replace('TURMA#', '')
        if turma_id:
            try:
                dynamodb.update_item(
                    TableName=TABLE_NAME,
                    Key={'PK': {'S': f'TURMA#{turma_id}'}, 'SK': {'S': f'ALUNO#{sub}'}},
                    UpdateExpression='SET nome = :n',
                    ExpressionAttributeValues={':n': {'S': nome}}
                )
            except Exception as e:
                print(f"Erro ao atualizar nome na turma {turma_id}: {e}")
            
    return resp(200, {'mensagem': 'Perfil atualizado com sucesso.', 'nome': nome})



# ---------------------------------------------------------------------------
# Handler principal — roteador
# ---------------------------------------------------------------------------

def lambda_handler(event, context):
    try:
        print(f"EVENT RECEIVED: {json.dumps(event)}")
        claims    = get_claims(event)
        route_key = event.get('routeKey', '')

        try:
            body = json.loads(event.get('body') or '{}')
        except (json.JSONDecodeError, TypeError):
            body = {}

        path_params = event.get('pathParameters') or {}

        if route_key == 'POST /turmas':
            return criar_turma(claims, body)

        elif route_key == 'GET /turmas':
            return listar_turmas(claims)

        elif route_key == 'GET /turmas/{turma_id}':
            return detalhar_turma(claims, path_params.get('turma_id', ''))

        elif route_key == 'POST /turmas/entrar':
            return entrar_turma(claims, body)

        elif route_key == 'POST /perfil':
            return atualizar_perfil(claims, body)

        else:
            return resp(404, {'mensagem': f'Rota não encontrada: {route_key}'})

    except Exception as erro:
        print(f"Erro crítico na Lambda GerenciarTurmas: {erro}")
        return resp(500, {'mensagem': 'Erro interno no servidor.'})
