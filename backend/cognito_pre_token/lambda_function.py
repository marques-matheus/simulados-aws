"""
Lambda Cognito Pre Token Generation
Intercepta a geração do JWT para o usuário e faz override do claim `cognito:groups`
dependendo do Client ID (Frontend Aluno vs Frontend Mentor) que ele usou para logar.
"""

import boto3
import json

# Cache global para evitar chamadas à API em toda execução
mentor_client_id_cache = None
cognito_client = boto3.client('cognito-idp', region_name='us-east-1')

def lambda_handler(event, context):
    print(f"Evento Pre Token Generation recebido: {json.dumps(event)}")
    
    global mentor_client_id_cache
    user_pool_id = event['userPoolId']
    client_id = event['callerContext']['clientId']

    # Se o ID do client do Mentor ainda não estiver no cache, buscamos na API
    if not mentor_client_id_cache:
        try:
            print("Buscando lista de User Pool Clients do Cognito...")
            paginator = cognito_client.get_paginator('list_user_pool_clients')
            for page in paginator.paginate(UserPoolId=user_pool_id):
                for client in page['UserPoolClients']:
                    client_name = client.get('ClientName', '').lower()
                    if 'mentor' in client_name:
                        mentor_client_id_cache = client['ClientId']
                        print(f"Encontrado client do Mentor: {mentor_client_id_cache}")
                        break
                if mentor_client_id_cache:
                    break
        except Exception as e:
            print(f"Erro ao buscar User Pool Clients: {e}")
            # Em caso de erro, por padrão cai para Aluno

    # Define o grupo baseado no client ID
    grupo = 'Mentores' if client_id == mentor_client_id_cache else 'Alunos'

    print(f"Client ID usado na requisição: {client_id}")
    print(f"Grupo atribuído: {grupo}")

    # Override claims (V1 format)
    response = event['response']
    if 'claimsOverrideDetails' not in response or not response['claimsOverrideDetails']:
        response['claimsOverrideDetails'] = {}

    response['claimsOverrideDetails']['groupOverrideDetails'] = {
        'groupsToOverride': [grupo]
    }

    return event
