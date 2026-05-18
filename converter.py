import re
import json
import os

CERTS = [
    'CLF-C02',
    'DVA-C02',
    'SAA-C03',
    'SCS-C02',
    'SOA-C02',
    'SAP-C02',
]

def parse_questions(filepath):
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
            if re.search(r'(escolha tr|choose three)', qtext, re.IGNORECASE):
                num = 6
            elif re.search(r'(escolha du|choose two)', qtext, re.IGNORECASE):
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
            questions.append({
                "id": sequential_id,
                "pergunta": question_text,
                "opcoes": options,
                "respostas_corretas": respostas_corretas,
                "explicacao": explicacao
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
        questions = parse_questions(filepath)
        count = len(questions)
        total += count

        if count > 0:
            print(f'  {cert}: {count} questões')
            # Save separate JSON file for this cert
            with open(f'data/{cert}.json', 'w', encoding='utf-8') as f:
                json.dump(questions, f, ensure_ascii=False, separators=(',', ':'))

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
        print(f' (Total de problemas: {len(issues)})')
    else:
        print('[OK] Nenhum problema detectado.')
