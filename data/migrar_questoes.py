import json
import boto3

# 1. Conexão com o banco
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
tabela = dynamodb.Table('Simulados_AWS')

# 2. A lista de provas baseada na sua imagem
arquivos_json = [
    "DVA-C02.json",
    "SAA-C03.json",
    "SAP-C02.json",
    "SCS-C02.json",
    "SOA-C02.json"
]

for arquivo in arquivos_json:
    # Remove o ".json" para criar a chave de partição (Ex: "CERT#SAA-C03")
    nome_certificacao = arquivo.replace('.json', '')
    pk_cert = f"CERT#{nome_certificacao}"
    
    print(f"\nIniciando migração de: {nome_certificacao}...")
    
    try:
        # Abre cada arquivo do diretório atual
        with open(arquivo, 'r', encoding='utf-8') as f:
            dados = json.load(f)
            
            # Garante que vai ler a lista de questões corretamente
            questoes = dados if isinstance(dados, list) else dados.get('questoes', [])
            
            contador = 0
            for i, questao in enumerate(questoes):
                item = questao
                item['PK'] = pk_cert
                item['SK'] = f"Q#{str(i+1).zfill(3)}"
                
                # Grava no DynamoDB
                tabela.put_item(Item=item)
                contador += 1
                
        print(f"Sucesso! {contador} questões de {nome_certificacao} inseridas na AWS.")
        
    except Exception as erro:
        print(f"Falha ao processar {arquivo}. Motivo: {erro}")

print("\n--- Migração em lote finalizada! ---")