import boto3
import json
import uuid

# Conecta ao DynamoDB usando as credenciais que já estão configuradas no seu terminal
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
tabela = dynamodb.Table('Simulados_AWS')

def carregar_dados(caminho_arquivo):
    with open(caminho_arquivo, 'r', encoding='utf-8') as arquivo:
        return json.load(arquivo)

def migrar_para_dynamodb(certificacao, questoes):
    # O DynamoDB permite gravar de 25 em 25 itens por vez (Batch Write)
    with tabela.batch_writer() as batch:
        for index, questao in enumerate(questoes):
            # Gera um ID único se a questão não tiver
            questao_id = questao.get('id', str(uuid.uuid4()))
            
            # Monta o item no padrão Single Table Design
            item = {
                'PK': f"CERT#{certificacao}",
                'SK': f"Q#{questao_id}",
                'pergunta': questao.get('pergunta', ''),
                'opcoes': questao.get('opcoes', []),
                'respostas_corretas': questao.get('respostas_corretas', []),
                'explicacao': questao.get('explicacao', ''),
                'temas': questao.get('temas', [])
            }
            
            # Envia para a fila do Batch Write
            batch.put_item(Item=item)
            print(f"Preparando questão {index + 1} de {len(questoes)}...")

    print(f"\nMigração concluída! Todas as questões de {certificacao} foram inseridas no DynamoDB.")

if __name__ == '__main__':
    # Altere o caminho se o seu arquivo JSON estiver em outra pasta
    caminho_do_json = '.\data\CLF-C02.json' 
    nome_da_certificacao = 'CLF-C02'
    
    try:
        dados_questoes = carregar_dados(caminho_do_json)
        print(f"Encontradas {len(dados_questoes)} questões no arquivo.")
        migrar_para_dynamodb(nome_da_certificacao, dados_questoes)
    except FileNotFoundError:
        print(f"Erro: O arquivo {caminho_do_json} não foi encontrado.")
    except Exception as e:
        print(f"Ocorreu um erro durante a migração: {e}")