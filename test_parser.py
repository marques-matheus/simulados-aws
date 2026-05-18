import re, json

def clean_questions(fname):
    with open(fname, 'r', encoding='utf-8') as f:
        text = f.read()
        
    correct_markers = ['Sua resposta está correta', 'Sua seleção está correta', 'Resposta correta', 'Seleção correta', 'Correto']
    wrong_markers = ['Sua resposta está incorreta', 'Sua seleção está incorreta', 'Incorreto', 'Ignorado']
    all_markers = correct_markers + wrong_markers
    
    raw_blocks = re.split(r'(?=^Pergunta \d+)', text, flags=re.MULTILINE)
    
    results = []
    
    for raw_block in raw_blocks:
        if not raw_block.strip().startswith('Pergunta'): continue
        
        lines = raw_block.split('\n')
        explicacao_idx = None
        for i, line in enumerate(lines):
            if line.strip() == 'Explicação geral':
                explicacao_idx = i
                break
                
        if explicacao_idx is None: continue
        
        pergunta_header = lines[0].strip()
        content_lines = lines[1:explicacao_idx]
        
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
        
        # Check if options start with A., B.
        option_blocks = []
        for b in non_marker_blocks:
            if re.match(r'^[A-H][\.\)] ', b):
                option_blocks.append(b)
                
        if option_blocks:
            options = option_blocks
        else:
            qtext = ' '.join(non_marker_blocks)
            if re.search(r'(escolha tr|choose three)', qtext, re.IGNORECASE): num = 6
            elif re.search(r'(escolha du|choose two)', qtext, re.IGNORECASE): num = 5
            else: num = 4
            options = non_marker_blocks[-num:] if len(non_marker_blocks) >= num else non_marker_blocks
            
        question = [b for b in non_marker_blocks if b not in options]
        
        corrects = []
        for i, b in enumerate(blocks):
            if b in options:
                # search backwards for marker
                for j in range(i-1, -1, -1):
                    if blocks[j] in all_markers:
                        if blocks[j] in correct_markers:
                            corrects.append(b)
                        break
                    elif blocks[j] not in all_markers and blocks[j] != b:
                        # hit another non-marker block (e.g. another option or question)
                        break
                        
        results.append({
            'header': pergunta_header,
            'question': question,
            'options': options,
            'corrects': corrects
        })
        
    return results

res = clean_questions('SAA-C03.txt')
for r in res[:3]:
    print(r['header'])
    print("Q:", r['question'])
    print("O:", r['options'])
    print("C:", r['corrects'])
    print('-'*20)
