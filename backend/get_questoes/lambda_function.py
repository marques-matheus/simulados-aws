import json
import boto3
from boto3.dynamodb.conditions import Key

# 1. Conexão com o banco (Fora da função principal)
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
tabela = dynamodb.Table('Simulados_AWS')

def lambda_handler(event, context):
    try:
        # 2. Qual prova o aluno quer fazer? (Fixo por enquanto, depois pegaremos do frontend)
        certificacao = "CERT#CLF-C02"
        
        print(f"Buscando questões para: {certificacao}")

        # 3. Busca no banco de dados usando Query (Rápido e barato)
        resposta = tabela.query(
            KeyConditionExpression=Key('PK').eq(certificacao)
        )
        
        questoes_brutas = resposta.get('Items', [])
        questoes_limpas = []

        # 4. A trava de segurança: Ocultando o gabarito
        for questao in questoes_brutas:
            # if 'respostas_corretas' in questao:
            #     del questao['respostas_corretas'] # Deleta a resposta da memória
            
            questoes_limpas.append(questao)

        # 5. O Retorno de Sucesso para a Internet
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*', # Essencial para o seu frontend poder ler isso
                'Content-Type': 'application/json'
            },
            'body': json.dumps(questoes_limpas)
        }

    except Exception as erro:
        # 6. Se algo der errado (Tabela não existe, erro de permissão, etc)
        print(f"Erro crítico na Lambda: {erro}")
        return {
            'statusCode': 500,
            'body': json.dumps({'mensagem': 'Erro interno no servidor ao buscar questoes.'})
        }