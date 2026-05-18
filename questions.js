// Banco de questões carregado do questoes_data.js
// QUESTOES_DATA é um objeto: { "CLF-C02": [...], "DVA-C02": [...], ... }
// Este script converte para o formato esperado pelo app.js

const QUESTIONS = {};

(function loadQuestions() {
  Object.keys(QUESTOES_DATA).forEach(cert => {
    QUESTIONS[cert] = [];

    QUESTOES_DATA[cert].forEach((q) => {
      const correctIndices = q.respostas_corretas
        .map(r => q.opcoes.indexOf(r))
        .filter(i => i !== -1);

      QUESTIONS[cert].push({
        id: q.id,
        cert: cert,
        question: q.pergunta,
        options: q.opcoes,
        correct: correctIndices.length === 1 ? correctIndices[0] : correctIndices,
        explanation: q.explicacao
      });
    });
  });
})();
