import re
import json
import os

CERT_DOMAINS = {
    'CLF-C02': {
        'Domínio 1: Conceitos de Nuvem': ['modelo de responsabilidade compartilhada', 'benefício', 'nuvem', 'economia de escala', 'global', 'vantagem', 'cloud', 'well-architected', 'despesa', 'agilidade', 'elasticidade', 'escalabilidade'],
        'Domínio 2: Segurança e Conformidade': ['iam', 'segurança', 'security', 'shield', 'waf', 'kms', 'cognito', 'secrets manager', 'guardduty', 'inspector', 'macie', 'criptografia', 'encryption', 'compliance', 'conformidade', 'firewall', 'antivírus', 'vulnerabilidade'],
        'Domínio 3: Tecnologia e Serviços': ['ec2', 's3', 'rds', 'dynamodb', 'lambda', 'vpc', 'route 53', 'cloudfront', 'elastic beanstalk', 'batch', 'ecs', 'eks', 'fargate', 'glacier', 'efs', 'aurora', 'redshift', 'neptune', 'api gateway', 'sqs', 'sns', 'step functions', 'sagemaker', 'serviço', 'instância', 'banco de dados', 'armazenamento'],
        'Domínio 4: Faturamento, Preços e Suporte': ['support', 'suporte', 'custo', 'cost', 'faturamento', 'billing', 'budget', 'pricing', 'preço', 'tco', 'calculator', 'calculadora', 'organizações', 'organizations', 'marketplace', 'plano', 'fatura']
    },
    'SAA-C03': {
        'Domínio 1: Design de Arquiteturas Seguras': ['iam', 'segurança', 'security', 'criptografia', 'encryption', 'kms', 'shield', 'waf', 'guardduty', 'macie', 'cognito', 'secrets manager', 'acesso', 'access', 'policy', 'política', 'firewall', 'vpn', 'ad', 'active directory'],
        'Domínio 2: Design de Arquiteturas Resilientes': ['alta disponibilidade', 'high availability', 'tolerância a falhas', 'fault tolerance', 'multi-az', 'auto scaling', 'load balancer', 'alb', 'nlb', 'route 53', 'backup', 'disaster recovery', 'recuperação', 's3', 'rds', 'aurora', 'efs', 'resiliência', 'snapshot', 'replica'],
        'Domínio 3: Design de Arquiteturas de Alto Desempenho': ['desempenho', 'performance', 'latência', 'latency', 'cache', 'cloudfront', 'elasticache', 'dynamodb', 'redshift', 'ebs', 'iops', 'transit gateway', 'direct connect', 'hpc', 'efs', 'lustre', 'fsx'],
        'Domínio 4: Design de Arquiteturas Econômicas': ['custo', 'cost', 'economia', 's3 glacier', 'spot', 'instância spot', 'saving', 'budget', 'lifecycle', 'ciclo de vida', 'auto scaling', 'serverless', 'lambda', 'otimização de custos']
    },
    'DVA-C02': {
        'Domínio 1: Desenvolvimento com Serviços AWS': ['desenvolvimento', 'develop', 'sdk', 'api', 'lambda', 'dynamodb', 'api gateway', 'sqs', 'sns', 'cognito', 's3', 'codebuild', 'codecommit', 'codedeploy', 'codepipeline', 'x-ray', 'appsync'],
        'Domínio 2: Segurança': ['iam', 'kms', 'secrets manager', 'cognito', 'segurança', 'security', 'criptografia', 'encryption', 'sts', 'auth', 'autorização', 'autenticação', 'policy', 'política'],
        'Domínio 3: Implantação e Entrega': ['implantação', 'deploy', 'codedeploy', 'codepipeline', 'elastic beanstalk', 'cloudformation', 'sam', 'serverless application model', 'cdk', 'container', 'ecs', 'docker', 'cicd'],
        'Domínio 4: Solução de Problemas e Otimização': ['x-ray', 'cloudwatch', 'log', 'troubleshoot', 'solução de problemas', 'debug', 'erro', 'métrica', 'metric', 'profile', 'otimização', 'performance', 'limite', 'throttle', 'retry']
    },
    'SOA-C02': {
        'Domínio 1: Monitoramento, Registro e Remediação': ['cloudwatch', 'cloudtrail', 'log', 'monitor', 'remediação', 'alarme', 'alarm', 'métrica', 'metric', 'eventbridge', 'sns', 'systems manager', 'config'],
        'Domínio 2: Confiabilidade e Continuidade dos Negócios': ['backup', 'restore', 'recuperação', 'disaster recovery', 'dr', 'multi-az', 'auto scaling', 'load balancer', 'route 53', 'aurora replica', 'snapshot', 'efs', 's3 cross-region'],
        'Domínio 3: Provisionamento e Automação': ['cloudformation', 'systems manager', 'opsworks', 'beanstalk', 'automação', 'provision', 'patching', 'ami', 'mfa', 'service catalog'],
        'Domínio 4: Segurança e Conformidade': ['iam', 'kms', 'secrets manager', 'config', 'organizations', 'scp', 'waf', 'shield', 'inspector', 'guardduty', 'conformidade', 'compliance', 'security'],
        'Domínio 5: Redes e Entrega de Conteúdo': ['vpc', 'subnet', 'route table', 'tabela de rotas', 'igw', 'nat gateway', 'security group', 'nacl', 'vpn', 'direct connect', 'transit gateway', 'cloudfront', 'route 53'],
        'Domínio 6: Gerenciamento de Custos e Otimização': ['custo', 'cost', 'budget', 'orçamento', 'trusted advisor', 'cost explorer', 'instância spot', 'saving plan', 'billing', 'reserva', 'reserved instance']
    },
    'SCS-C02': {
        'Domínio 1: Resposta a Incidentes': ['incidente', 'incident', 'guardduty', 'detective', 'eventbridge', 'lambda', 'remediação', 'comprometido', 'anomalia', 'analisar', 'segurança', 'securityhub'],
        'Domínio 2: Registro e Monitoramento': ['cloudtrail', 'cloudwatch', 'vpc flow logs', 'log', 'monitor', 'config', 'guardduty', 'athena', 'auditoria', 's3 access logs'],
        'Domínio 3: Infraestrutura de Segurança': ['vpc', 'security group', 'nacl', 'waf', 'shield', 'firewall manager', 'route 53 resolver', 'endpoint', 'privatelink', 'bastion', 'vpn', 'direct connect'],
        'Domínio 4: Gestão de Identidade e Acesso': ['iam', 'sso', 'directory service', 'ad', 'sts', 'assume role', 'scp', 'organizations', 'policy', 'política', 'saml', 'federation', 'cognito'],
        'Domínio 5: Proteção de Dados': ['kms', 'criptografia', 'encryption', 'secrets manager', 'macie', 'ssl', 'tls', 'certificate manager', 'acm', 's3 bucket policy', 'ssekms', 'sses3', 'chaves'],
        'Domínio 6: Governança de Segurança': ['trusted advisor', 'conformidade', 'compliance', 'artifact', 'audit', 'governança', 'config rules', 'security hub', 'políticas da organização']
    },
    'SAP-C02': {
        'Domínio 1: Design para Complexidade Organizacional': ['organizations', 'scp', 'faturamento consolidado', 'multi-account', 'control tower', 'ram', 'resource access manager', 'sso', 'iam identity center', 'active directory', 'diretório', 'cross-account'],
        'Domínio 2: Design para Novos Requisitos': ['solução de design', 'requisitos', 'serverless', 'lambda', 'fargate', 'arquitetura', 'integração', 'sqs', 'sns', 'step functions', 'eventbridge', 'kinesis', 'dynamodb', 'aurora global'],
        'Domínio 3: Planejamento de Migração e Modernização': ['migração', 'migration', 'dms', 'sms', 'application migration', 'datasync', 'snowball', 'evaluator', 'discovery', 'modernização', 'refactoring', 'rehost', 'replatform'],
        'Domínio 4: Design para Resiliência e Controle Contínuo': ['disaster recovery', 'recuperação de desastres', 'rto', 'rpo', 'multi-region', 'aurora global', 'route 53 routing', 'health check', 'auto scaling', 'systems manager', 'config', 'security hub', 'cloudtrail']
    }
}

CERTS = [
    'CLF-C02',
    'DVA-C02',
    'SAA-C03',
    'SCS-C02',
    'SOA-C02',
    'SAP-C02',
]

def parse_questions(filepath, cert):
    if not os.path.exists(filepath):
        return []

    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()

    correct_markers = ['Sua resposta está correta', 'Sua seleção está correta', 'Resposta correta', 'Seleção correta', 'Correto']
    wrong_markers = ['Sua resposta está incorreta', 'Sua seleção está incorreta', 'Incorreto', 'Ignorado']
    all_markers = correct_markers + wrong_markers

    raw_blocks = re.split(r'(?=^Pergunta \d+)', text, flags=re.MULTILINE)
    questions = []
    sequential_id = 0

    for raw_block in raw_blocks:
        if not raw_block.strip().startswith('Pergunta'):
            continue

        lines = raw_block.split('\n')
        explicacao_idx = None
        for i, line in enumerate(lines):
            if line.strip() == 'Explicação geral':
                explicacao_idx = i
                break

        if explicacao_idx is None:
            continue

        pergunta_header = lines[0].strip()
        content_lines = lines[1:explicacao_idx]

        # Group lines into blocks (paragraphs)
        blocks = []
        current_block = []
        for line in content_lines:
            stripped = line.strip()
            if not stripped:
                if current_block:
                    blocks.append(' '.join(current_block))
                    current_block = []
            elif stripped in all_markers:
                if current_block:
                    blocks.append(' '.join(current_block))
                    current_block = []
                blocks.append(stripped)
            else:
                current_block.append(stripped)
        if current_block:
            blocks.append(' '.join(current_block))

        non_marker_blocks = [b for b in blocks if b not in all_markers]

        # Identify options
        option_blocks = []
        for b in non_marker_blocks:
            if re.match(r'^[A-H][\.\)]\s', b):
                option_blocks.append(b)

        if option_blocks:
            options = option_blocks
        else:
            qtext = ' '.join(non_marker_blocks)
            if re.search(r'(escolha tr[êe]s|selecione tr[êe]s|choose three)', qtext, re.IGNORECASE):
                num = 6
            elif re.search(r'(escolha d[ou]as|escolha dois|selecione d[ou]as|selecione dois|choose two)', qtext, re.IGNORECASE):
                num = 5
            else:
                num = 4
            
            # ensure we leave at least one block for the question
            num = min(num, len(non_marker_blocks) - 1)
            if num < 1: num = len(non_marker_blocks)
            
            options = non_marker_blocks[-num:]

        question_text = '\n\n'.join([b for b in non_marker_blocks if b not in options])

        # Find correct answers
        respostas_corretas = []
        for i, b in enumerate(blocks):
            if b in options:
                # search backwards for marker
                for j in range(i-1, -1, -1):
                    if blocks[j] in all_markers:
                        if blocks[j] in correct_markers:
                            respostas_corretas.append(b)
                        break
                    elif blocks[j] not in all_markers and blocks[j] != b:
                        break

        # Extract explanation
        expl_lines = lines[explicacao_idx + 1:]
        expl_blocks = []
        curr_expl = []
        started = False
        for line in expl_lines:
            stripped = line.strip()
            if stripped == 'Recursos':
                break
            if not started:
                if stripped in ('Explicação:', 'Explicação', ''):
                    continue
                started = True
            if started:
                if not stripped:
                    if curr_expl:
                        expl_blocks.append(' '.join(curr_expl))
                        curr_expl = []
                else:
                    curr_expl.append(stripped)
        if curr_expl:
            expl_blocks.append(' '.join(curr_expl))

        explicacao = '\n\n'.join(expl_blocks)

        if question_text and options:
            sequential_id += 1
            # Extract Themes
            q_text_full = (question_text + ' ' + explicacao).lower()
            question_themes = []
            domains = CERT_DOMAINS.get(cert, {})
            for domain_name, keywords in domains.items():
                if any(kw in q_text_full for kw in keywords):
                    question_themes.append(domain_name)
            
            # Fallback se nenhum domínio oficial bater com as palavras-chave
            if not question_themes and domains:
                question_themes.append(list(domains.keys())[0])

            questions.append({
                "id": sequential_id,
                "pergunta": question_text,
                "opcoes": options,
                "respostas_corretas": respostas_corretas,
                "explicacao": explicacao,
                "temas": question_themes
            })

    return questions

if __name__ == '__main__':
    total = 0
    issues = []

    # Create data directory if not exists
    if not os.path.exists('data'):
        os.makedirs('data')

    for cert in CERTS:
        filepath = f'{cert}.txt'
        questions = parse_questions(filepath, cert)
        count = len(questions)
        total += count

        if count > 0:
            print(f'  {cert}: {count} questões')
            # Save separate JSON file for this cert
            with open(f'data/{cert}.json', 'w', encoding='utf-8') as f:
                json.dump(questions, f, ensure_ascii=False, separators=(',', ':'))

            # Save separate JS file for file:// compatibility
            with open(f'data/{cert}.js', 'w', encoding='utf-8') as f:
                f.write(f"window.LOADED_QUESTIONS = window.LOADED_QUESTIONS || {{}};\nwindow.LOADED_QUESTIONS['{cert}'] = ")
                json.dump(questions, f, ensure_ascii=False, separators=(',', ':'))
                f.write(";\n")

            # Validação
            for q in questions:
                if len(q['opcoes']) > 6:
                    issues.append(f"  [{cert}] Q{q['id']}: muitos opções ({len(q['opcoes'])}) - provável erro de parsing")
                if len(q['respostas_corretas']) == 0:
                    issues.append(f"  [{cert}] Q{q['id']}: nenhuma resposta correta encontrada")
        else:
            print(f'  {cert}: (vazio)')

    print(f'\nTotal: {total} questões convertidas')
    print(f'Arquivos gerados na pasta data/')

    if issues:
        print(f'\n[!] {len(issues)} possivel(is) problema(s) encontrado(s):')
        for issue in issues:
            print(issue)
        print(f' (Total de problemas: {len(issues)})')
    else:
        print('[OK] Nenhum problema detectado.')

