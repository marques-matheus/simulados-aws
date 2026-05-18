(function(){
  // State
  let config = { cert: null, qty: 30 };
  let examQuestions = [];
  let answers = {};
  let currentIdx = 0;
  let timerInterval = null;
  let elapsedSeconds = 0;

  // Cert metadata
  const CERT_META = {
    'CLF-C02': { name: 'Cloud Practitioner', color: '#ff9900' },
    'SAA-C03': { name: 'Solutions Architect Associate', color: '#06b6d4' },
    'DVA-C02': { name: 'Developer Associate', color: '#6366f1' },
    'SOA-C02': { name: 'CloudOps Engineer', color: '#f59e0b' },
    'SCS-C02': { name: 'Security Specialty', color: '#22c55e' },
    'SAP-C02': { name: 'Solutions Architect Professional', color: '#a855f7' }
  };

  // Anti-repeat: keep history of last N exams in localStorage (per cert)
  const COOLDOWN_EXAMS = 5;

  function getHistoryKey(cert) { return 'exam_history_' + cert; }

  function getExamHistory(cert) {
    try {
      const raw = localStorage.getItem(getHistoryKey(cert));
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function saveExamToHistory(cert, questionIds) {
    const history = getExamHistory(cert);
    history.push(questionIds);
    while (history.length > COOLDOWN_EXAMS) history.shift();
    localStorage.setItem(getHistoryKey(cert), JSON.stringify(history));
  }

  function getRecentlyUsedIds(cert) {
    const history = getExamHistory(cert);
    const ids = new Set();
    history.forEach(examIds => examIds.forEach(id => ids.add(id)));
    return ids;
  }

  // DOM refs
  const screens = {
    home: document.getElementById('home-screen'),
    exam: document.getElementById('exam-screen'),
    result: document.getElementById('result-screen'),
    review: document.getElementById('review-screen')
  };

  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
    window.scrollTo(0, 0);
  }

  // Init: show question counts on cert cards
  function initCertCounts() {
    Object.keys(QUESTIONS).forEach(cert => {
      const el = document.getElementById('count-' + cert);
      const count = QUESTIONS[cert] ? QUESTIONS[cert].length : 0;
      if (el) {
        el.textContent = count > 0 ? count + ' questões' : 'Em breve';
        el.classList.toggle('empty', count === 0);
      }
      // Disable cards with no questions
      const card = document.querySelector(`.cert-card[data-cert="${cert}"]`);
      if (card && count === 0) {
        card.classList.add('disabled');
      }
    });
  }
  initCertCounts();

  // Cert selection
  document.querySelectorAll('.cert-card').forEach(card => {
    card.addEventListener('click', () => {
      const cert = card.dataset.cert;
      const pool = QUESTIONS[cert] || [];
      if (pool.length === 0) return;

      config.cert = cert;

      // Highlight selected
      document.querySelectorAll('.cert-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      // Show config
      const configEl = document.getElementById('exam-config');
      configEl.style.display = 'block';
      document.getElementById('config-title').textContent = CERT_META[cert].name;

      // Show stats
      const recentIds = getRecentlyUsedIds(cert);
      const freshCount = pool.filter(q => !recentIds.has(q.id)).length;
      const statsEl = document.getElementById('config-stats');
      statsEl.innerHTML = `<p>${pool.length} questões disponíveis · ${freshCount} novas para você</p>`;

      // Scroll to config
      configEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  // Change cert button
  document.getElementById('btn-change-cert').addEventListener('click', () => {
    config.cert = null;
    document.querySelectorAll('.cert-card').forEach(c => c.classList.remove('active'));
    document.getElementById('exam-config').style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Qty buttons
  document.querySelectorAll('#qty-group .btn-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#qty-group .btn-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      config.qty = parseInt(btn.dataset.value);
    });
  });

  // Shuffle utility
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Start exam
  document.getElementById('btn-start').addEventListener('click', startExam);

  function startExam() {
    if (!config.cert) {
      alert('Selecione uma certificação primeiro.');
      return;
    }
    const pool = [...(QUESTIONS[config.cert] || [])];
    const needed = Math.min(config.qty, pool.length);
    if (needed === 0) {
      alert('Nenhuma questão disponível para esta certificação.');
      return;
    }

    // Anti-repeat: prioritize fresh questions
    const recentIds = getRecentlyUsedIds(config.cert);
    const fresh = shuffle(pool.filter(q => !recentIds.has(q.id)));
    const used = shuffle(pool.filter(q => recentIds.has(q.id)));

    examQuestions = fresh.slice(0, needed);
    if (examQuestions.length < needed) {
      examQuestions = examQuestions.concat(used.slice(0, needed - examQuestions.length));
    }
    shuffle(examQuestions);

    saveExamToHistory(config.cert, examQuestions.map(q => q.id));

    // Update header
    document.getElementById('exam-cert-label').textContent = config.cert;
    document.getElementById('q-cert').textContent = CERT_META[config.cert].name;

    answers = {};
    currentIdx = 0;
    elapsedSeconds = 0;
    startTimer();
    buildDots();
    renderQuestion();
    showScreen('exam');
  }

  // Timer
  function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      elapsedSeconds++;
      document.getElementById('exam-timer').textContent = '⏱ ' + formatTime(elapsedSeconds);
    }, 1000);
  }
  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  }

  // Dots
  function buildDots() {
    const container = document.getElementById('question-dots');
    container.innerHTML = '';
    examQuestions.forEach((_, i) => {
      const dot = document.createElement('div');
      dot.className = 'dot' + (i === 0 ? ' current' : '');
      dot.addEventListener('click', () => { currentIdx = i; renderQuestion(); });
      container.appendChild(dot);
    });
  }
  function updateDots() {
    const dots = document.querySelectorAll('#question-dots .dot');
    dots.forEach((d, i) => {
      d.className = 'dot';
      if (i === currentIdx) d.classList.add('current');
      if (answers[i] !== undefined && !(Array.isArray(answers[i]) && answers[i].length === 0)) d.classList.add('answered');
    });
  }

  // Format text helper
  function formatText(text) {
    if (!text) return '';
    // Escape HTML
    let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Highlight AWS resources like AWS::ApiGateway::RestApi
    html = html.replace(/\b(AWS::[A-Za-z0-9]+::[A-Za-z0-9]+)\b/g, '<code class="aws-resource">$1</code>');
    
    // Highlight IAM actions (e.g., s3:PutObject)
    html = html.replace(/\b([a-z0-9A-Z]+:[a-zA-Z0-9*]+)\b/g, match => {
      if (match.startsWith('http') || match.startsWith('urn')) return match;
      return `<code class="aws-action">${match}</code>`;
    });

    // Convert newlines to breaks
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  // Render question
  function renderQuestion() {
    const q = examQuestions[currentIdx];
    document.getElementById('q-cert').textContent = config.cert + ' — ' + CERT_META[config.cert].name;
    document.getElementById('q-text').innerHTML = formatText(q.question);

    const optContainer = document.getElementById('q-options');
    optContainer.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const isMulti = Array.isArray(q.correct);
    const multiCount = isMulti ? q.correct.length : 0;

    // Show hint for multi-answer questions
    if (isMulti && multiCount > 1) {
      const hint = document.createElement('p');
      hint.className = 'multi-hint';
      hint.textContent = `Selecione ${multiCount} respostas`;
      optContainer.appendChild(hint);
    }

    q.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      let isSelected = false;
      if (isMulti) {
        const userArr = answers[currentIdx] || [];
        isSelected = userArr.includes(i);
      } else {
        isSelected = answers[currentIdx] === i;
      }
      btn.className = 'option-btn' + (isSelected ? ' selected' : '');
      btn.innerHTML = `<span class="option-letter">${letters[i]}</span><span class="option-text">${formatText(opt)}</span>`;
      btn.addEventListener('click', () => {
        if (isMulti) {
          let arr = answers[currentIdx] ? [...answers[currentIdx]] : [];
          if (arr.includes(i)) {
            arr = arr.filter(x => x !== i);
          } else {
            arr.push(i);
          }
          answers[currentIdx] = arr;
        } else {
          answers[currentIdx] = i;
        }
        renderQuestion();
      });
      optContainer.appendChild(btn);
    });

    // Progress
    document.getElementById('exam-progress').textContent = `${currentIdx + 1} / ${examQuestions.length}`;
    document.getElementById('progress-bar').style.width = ((currentIdx + 1) / examQuestions.length * 100) + '%';

    // Nav buttons
    document.getElementById('btn-prev').disabled = currentIdx === 0;
    const nextBtn = document.getElementById('btn-next');
    nextBtn.textContent = currentIdx === examQuestions.length - 1 ? 'Finalizar ✓' : 'Próxima →';

    updateDots();
  }

  // Navigation
  document.getElementById('btn-prev').addEventListener('click', () => {
    if (currentIdx > 0) { currentIdx--; renderQuestion(); }
  });
  document.getElementById('btn-next').addEventListener('click', () => {
    if (currentIdx < examQuestions.length - 1) {
      currentIdx++;
      renderQuestion();
    } else {
      finishExam();
    }
  });
  document.getElementById('btn-finish-early').addEventListener('click', () => {
    const unanswered = examQuestions.length - Object.keys(answers).filter(k => {
      const a = answers[k];
      return a !== undefined && !(Array.isArray(a) && a.length === 0);
    }).length;
    if (unanswered > 0) {
      if (!confirm(`Você tem ${unanswered} questão(ões) sem resposta. Deseja finalizar mesmo assim?`)) return;
    }
    finishExam();
  });

  // Cancel exam
  document.getElementById('btn-cancel-exam').addEventListener('click', () => {
    if (confirm('Tem certeza que deseja cancelar este simulado e voltar ao início? Seu progresso será perdido.')) {
      clearInterval(timerInterval);
      showScreen('home');
    }
  });

  // Answer checking helpers
  function isAnswerCorrect(q, userAns) {
    if (userAns === undefined) return false;
    if (Array.isArray(q.correct)) {
      if (!Array.isArray(userAns)) return false;
      if (userAns.length !== q.correct.length) return false;
      const sorted1 = [...userAns].sort();
      const sorted2 = [...q.correct].sort();
      return sorted1.every((v, i) => v === sorted2[i]);
    }
    return userAns === q.correct;
  }

  function isAnswerEmpty(userAns) {
    if (userAns === undefined) return true;
    if (Array.isArray(userAns) && userAns.length === 0) return true;
    return false;
  }

  // Finish
  function finishExam() {
    clearInterval(timerInterval);
    let correct = 0, wrong = 0, skipped = 0;
    examQuestions.forEach((q, i) => {
      if (isAnswerEmpty(answers[i])) { skipped++; }
      else if (isAnswerCorrect(q, answers[i])) { correct++; }
      else { wrong++; }
    });
    const pct = Math.round((correct / examQuestions.length) * 100);

    // Result screen
    const icon = document.getElementById('result-icon');
    const title = document.getElementById('result-title');
    const sub = document.getElementById('result-subtitle');
    const passingScore = 70;
    if (pct >= passingScore) {
      icon.textContent = '🏆';
      title.textContent = 'Aprovado!';
      sub.textContent = `Parabéns! Você atingiu ${pct}% no ${config.cert} (mínimo ${passingScore}%).`;
    } else {
      icon.textContent = '📚';
      title.textContent = 'Continue Estudando';
      sub.textContent = `Você atingiu ${pct}% no ${config.cert}. É necessário ${passingScore}% para aprovação.`;
    }

    document.getElementById('score-value').textContent = pct + '%';
    // Animate circle
    const fg = document.getElementById('score-fg');
    const circumference = 2 * Math.PI * 90;
    fg.style.strokeDasharray = circumference;
    fg.style.strokeDashoffset = circumference;
    let svg = fg.closest('svg');
    // Remove old gradient
    const oldDefs = svg.querySelector('defs');
    if (oldDefs) oldDefs.remove();
    const defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
    const grad = document.createElementNS('http://www.w3.org/2000/svg','linearGradient');
    grad.id = 'scoreGrad';
    const s1 = document.createElementNS('http://www.w3.org/2000/svg','stop');
    s1.setAttribute('offset','0%'); s1.setAttribute('stop-color', CERT_META[config.cert].color);
    const s2 = document.createElementNS('http://www.w3.org/2000/svg','stop');
    s2.setAttribute('offset','100%'); s2.setAttribute('stop-color', pct >= passingScore ? '#22c55e' : '#ef4444');
    grad.appendChild(s1); grad.appendChild(s2);
    defs.appendChild(grad); svg.prepend(defs);
    requestAnimationFrame(() => {
      fg.style.strokeDashoffset = circumference - (circumference * pct / 100);
    });

    document.getElementById('stat-correct').textContent = correct;
    document.getElementById('stat-wrong').textContent = wrong;
    document.getElementById('stat-skip').textContent = skipped;
    document.getElementById('stat-time').textContent = formatTime(elapsedSeconds);

    showScreen('result');
  }

  // Review
  document.getElementById('btn-review').addEventListener('click', () => {
    renderReview('all');
    showScreen('review');
  });
  document.getElementById('btn-new-exam').addEventListener('click', () => showScreen('home'));
  document.getElementById('btn-home-from-review').addEventListener('click', () => showScreen('home'));
  document.getElementById('btn-back-result').addEventListener('click', () => showScreen('result'));

  document.querySelectorAll('.btn-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderReview(btn.dataset.filter);
    });
  });

  function renderReview(filter) {
    const list = document.getElementById('review-list');
    list.innerHTML = '';
    const letters = ['A','B','C','D','E','F'];
    examQuestions.forEach((q, i) => {
      const userAns = answers[i];
      const correct = isAnswerCorrect(q, userAns);
      const skipped = isAnswerEmpty(userAns);
      if (filter === 'correct' && !correct) return;
      if (filter === 'wrong' && (correct || skipped)) return;
      if (filter === 'skipped' && !skipped) return;

      const cls = skipped ? 'ri-skipped' : correct ? 'ri-correct' : 'ri-wrong';
      const status = skipped ? '⬜ Pulada' : correct ? '✅ Correta' : '❌ Errada';
      const isMulti = Array.isArray(q.correct);
      const correctSet = isMulti ? q.correct : [q.correct];
      const userSet = isMulti ? (Array.isArray(userAns) ? userAns : []) : (userAns !== undefined ? [userAns] : []);

      let optsHtml = '';
      q.options.forEach((opt, oi) => {
        let optCls = '';
        if (correctSet.includes(oi)) optCls = 'is-correct';
        else if (userSet.includes(oi) && !correct) optCls = 'is-wrong';
        optsHtml += `<div class="ri-opt ${optCls}"><strong>${letters[oi]}.</strong> ${formatText(opt)}</div>`;
      });

      const item = document.createElement('div');
      item.className = `review-item ${cls}`;
      item.innerHTML = `
        <div class="ri-header">
          <span class="ri-num">Questão ${i+1}</span>
          <span style="font-size:.8rem">${status}</span>
        </div>
        <p class="ri-question">${formatText(q.question)}</p>
        <div class="ri-options">${optsHtml}</div>
        <div class="ri-explanation"><strong>Explicação:</strong><br><br>${formatText(q.explanation)}</div>
      `;
      list.appendChild(item);
    });
  }

  // Export Features
  const modal = document.getElementById('export-modal');
  document.getElementById('btn-export-errors').addEventListener('click', () => {
    modal.style.display = 'flex';
  });
  document.getElementById('btn-close-export').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  function getErrors() {
    return examQuestions.filter((q, i) => !isAnswerCorrect(q, answers[i]));
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), content], { type: mimeType }); // BOM for UTF-8
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    modal.style.display = 'none';
  }

  document.getElementById('btn-export-prompt').addEventListener('click', () => {
    const errors = getErrors();
    if (errors.length === 0) return alert('Nenhum erro para exportar! 🎉');

    let promptText = `Atue como um Arquiteto de Soluções AWS Sênior e tutor. Acabei de fazer um simulado da certificação ${config.cert} e errei as seguintes questões. Com base nesses erros, por favor:\n\n`;
    promptText += `1. Identifique quais são as minhas maiores lacunas de conhecimento.\n`;
    promptText += `2. Crie um plano de estudos prático de 5 dias focado exclusivamente nesses pontos fracos.\n`;
    promptText += `3. Me forneça links diretos para a documentação oficial da AWS ou whitepapers sobre esses serviços.\n\n`;
    promptText += `--- QUESTÕES QUE ERREI ---\n\n`;

    errors.forEach((q, idx) => {
      promptText += `[Questão ${idx + 1}]\n${q.question}\n\n`;
      q.options.forEach((o, i) => {
        promptText += `${['A','B','C','D','E','F'][i]}. ${o}\n`;
      });
      const correctAns = Array.isArray(q.correct) ? q.correct.map(i => ['A','B','C','D','E','F'][i]).join(', ') : ['A','B','C','D','E','F'][q.correct];
      promptText += `\nResposta Correta: ${correctAns}\n\n`;
      promptText += `Explicação: ${q.explanation}\n`;
      promptText += `---------------------------\n\n`;
    });

    navigator.clipboard.writeText(promptText).then(() => {
      alert('✅ Super Prompt copiado para a área de transferência!\n\nAgora basta colar (Ctrl+V) no ChatGPT, Gemini ou Claude para gerar seu plano de estudos.');
      modal.style.display = 'none';
    }).catch(err => {
      alert('Erro ao copiar para a área de transferência. ' + err);
    });
  });

  document.getElementById('btn-export-csv').addEventListener('click', () => {
    const errors = getErrors();
    if (errors.length === 0) return alert('Nenhum erro para exportar! 🎉');

    const escapeCSV = (str) => `"${String(str || '').replace(/"/g, '""')}"`;
    let csv = 'Pergunta,Opções,Resposta Correta,Explicação\n';

    errors.forEach((q) => {
      const opts = q.options.map((o, i) => `${['A','B','C','D','E','F'][i]}. ${o}`).join('\n');
      const correctAns = Array.isArray(q.correct) ? q.correct.map(i => ['A','B','C','D','E','F'][i]).join(', ') : ['A','B','C','D','E','F'][q.correct];
      csv += `${escapeCSV(q.question)},${escapeCSV(opts)},${escapeCSV(correctAns)},${escapeCSV(q.explanation)}\n`;
    });

    downloadFile(csv, `Erros_${config.cert}.csv`, 'text/csv;charset=utf-8');
  });

  document.getElementById('btn-export-anki').addEventListener('click', () => {
    const errors = getErrors();
    if (errors.length === 0) return alert('Nenhum erro para exportar! 🎉');

    // For Anki, TSV: Front \t Back \n
    // HTML is supported, but actual \n breaks rows, so replace \n with <br>
    let tsv = '';
    errors.forEach((q) => {
      let front = q.question.replace(/\n/g, '<br>') + '<br><br>';
      front += q.options.map((o, i) => `<b>${['A','B','C','D','E','F'][i]}.</b> ${o}`).join('<br>').replace(/\n/g, '<br>');

      const correctAns = Array.isArray(q.correct) ? q.correct.map(i => ['A','B','C','D','E','F'][i]).join(', ') : ['A','B','C','D','E','F'][q.correct];
      let back = `<b>Resposta Correta: ${correctAns}</b><br><br>`;
      back += q.explanation.replace(/\n/g, '<br>');

      tsv += `${front}\t${back}\n`;
    });

    downloadFile(tsv, `Flashcards_Erros_${config.cert}.txt`, 'text/plain;charset=utf-8');
  });

  // Keyboard navigation
  document.addEventListener('keydown', e => {
    if (!screens.exam.classList.contains('active')) return;
    if (e.key === 'ArrowRight' || e.key === 'Enter') document.getElementById('btn-next').click();
    if (e.key === 'ArrowLeft') document.getElementById('btn-prev').click();
    if (e.key >= '1' && e.key <= '6') {
      const idx = parseInt(e.key) - 1;
      if (idx < examQuestions[currentIdx].options.length) {
        const q = examQuestions[currentIdx];
        const isMulti = Array.isArray(q.correct);
        if (isMulti) {
          let arr = answers[currentIdx] ? [...answers[currentIdx]] : [];
          if (arr.includes(idx)) arr = arr.filter(x => x !== idx);
          else arr.push(idx);
          answers[currentIdx] = arr;
        } else {
          answers[currentIdx] = idx;
        }
        renderQuestion();
      }
    }
  });
})();
