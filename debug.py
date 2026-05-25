import re

def debug_question():
    filepath = r'c:\Users\Win\Documents\simulados\DVA-C02.txt'
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()

    correct_markers = ['Sua resposta está correta', 'Sua seleção está correta', 'Resposta correta', 'Seleção correta', 'Correto']
    wrong_markers = ['Sua resposta está incorreta', 'Sua seleção está incorreta', 'Incorreto', 'Ignorado']
    all_markers = correct_markers + wrong_markers

    raw_blocks = re.split(r'(?=^Pergunta \d+)', text, flags=re.MULTILINE)
    
    for raw_block in raw_blocks:
        if 'Pergunta 36' in raw_block:
            print("FOUND Question 36")
            lines = raw_block.split('\n')
            explicacao_idx = None
            for i, line in enumerate(lines):
                if line.strip() == 'Explicação geral':
                    explicacao_idx = i
                    break

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
                num = min(num, len(non_marker_blocks) - 1)
                if num < 1: num = len(non_marker_blocks)
                options = non_marker_blocks[-num:]

            question_text = '\n\n'.join([b for b in non_marker_blocks if b not in options])
            
            respostas_corretas = []
            for i, b in enumerate(blocks):
                if b in options:
                    for j in range(i-1, -1, -1):
                        if blocks[j] in all_markers:
                            if blocks[j] in correct_markers:
                                respostas_corretas.append(b)
                            break
                        elif blocks[j] not in all_markers and blocks[j] != b:
                            break
            
            print("OPTIONS:", options)
            print("CORRECT:", respostas_corretas)
            print("QTEXT:", question_text)

if __name__ == '__main__':
    debug_question()
