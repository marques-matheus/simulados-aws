import json

themes = {
    'Computação': ['ec2', 'lambda', 'elastic beanstalk', 'batch', 'ecs', 'eks', 'fargate', 'computação'],
    'Armazenamento': ['s3', 'ebs', 'efs', 'storage gateway', 'glacier', 'armazenamento'],
    'Banco de Dados': ['rds', 'dynamodb', 'aurora', 'redshift', 'neptune', 'documentdb', 'banco de dados'],
    'Redes e Entrega de Conteúdo': ['vpc', 'route 53', 'cloudfront', 'api gateway', 'direct connect', 'transit gateway', 'rede'],
    'Segurança e Identidade': ['iam', 'cognito', 'kms', 'secrets manager', 'shield', 'waf', 'guardduty', 'macie', 'inspector', 'segurança'],
    'Gerenciamento e Governança': ['cloudwatch', 'cloudtrail', 'config', 'organizations', 'trusted advisor', 'systems manager', 'cloudformation'],
}

def analyze_tags():
    with open(r'c:\Users\Win\Documents\simulados\data\CLF-C02.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    tagged = 0
    for q in data:
        text = (q['pergunta'] + ' ' + q.get('explicacao', '')).lower()
        q_tags = []
        for theme, keywords in themes.items():
            if any(kw in text for kw in keywords):
                q_tags.append(theme)
        if q_tags:
            tagged += 1
            
    print(f"Tagged {tagged} out of {len(data)} questions")

if __name__ == '__main__':
    analyze_tags()
