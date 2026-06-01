// 答题引擎模块
const { shuffle } = require('./utils');

function createQuizEngine(questionBank, db) {
  const QuizEngine = {
    state: {
      quiz: [],
      idx: 0,
      answered: false,
      mode: 'quick',
      correctCount: 0,
      startTime: 0
    },
    
    modeCounts: {
      quick: 10,
      standard: 20,
      intensive: 30
    },
    
    selectMode(mode) {
      QuizEngine.state.mode = mode;
    },
    
    getCount() {
      return QuizEngine.modeCounts[QuizEngine.state.mode] || 10;
    },
    
    startRandomQuiz() {
      const count = QuizEngine.getCount();
      QuizEngine.state.quiz = shuffle(questionBank.get()).slice(0, count);
      QuizEngine.state.idx = 0;
      QuizEngine.state.correctCount = 0;
      QuizEngine.state.startTime = Date.now();
      QuizEngine.state.answered = false;
      return QuizEngine.state;
    },
    
    startCategoryQuiz(category) {
      const count = QuizEngine.getCount();
      const filtered = questionBank.filterByCategory(category);
      QuizEngine.state.quiz = shuffle(filtered).slice(0, count);
      QuizEngine.state.idx = 0;
      QuizEngine.state.correctCount = 0;
      QuizEngine.state.startTime = Date.now();
      QuizEngine.state.answered = false;
      return QuizEngine.state;
    },
    
    startWrongBookQuiz() {
      const wrongList = db.getWrong();
      const questions = [];
      for (let i = 0; i < wrongList.length; i++) {
        const q = db.findQ(wrongList[i].qid);
        if (q) questions.push(q);
      }
      if (questions.length === 0) return null;
      
      QuizEngine.state.quiz = shuffle(questions);
      QuizEngine.state.idx = 0;
      QuizEngine.state.correctCount = 0;
      QuizEngine.state.startTime = Date.now();
      QuizEngine.state.answered = false;
      return QuizEngine.state;
    },
    
    getCurrentQuestion() {
      if (QuizEngine.state.idx >= QuizEngine.state.quiz.length) {
        return null;
      }
      return QuizEngine.state.quiz[QuizEngine.state.idx];
    },
    
    pickOption(key) {
      if (QuizEngine.state.answered) return null;
      
      QuizEngine.state.answered = true;
      const q = QuizEngine.getCurrentQuestion();
      const ok = (key === q.answer);
      
      if (ok) QuizEngine.state.correctCount++;
      
      db.addRecord({
        qid: q.id,
        ans: key,
        ok: ok,
        time: Date.now()
      });
      
      if (!ok) db.addWrong(q.id);
      
      return {
        ok,
        correctAnswer: q.answer,
        explanation: q.explanation
      };
    },
    
    nextQuestion() {
      QuizEngine.state.idx++;
      QuizEngine.state.answered = false;
      if (QuizEngine.state.idx >= QuizEngine.state.quiz.length) {
        return QuizEngine.finishQuiz();
      }
      return QuizEngine.getCurrentQuestion();
    },
    
    finishQuiz() {
      const total = QuizEngine.state.quiz.length;
      const correct = QuizEngine.state.correctCount;
      const wrong = total - correct;
      const pct = total > 0 ? Math.round(correct / total * 100) : 0;
      const elapsed = Date.now() - QuizEngine.state.startTime;
      
      return {
        total,
        correct,
        wrong,
        pct,
        elapsed
      };
    },
    
    getProgress() {
      const total = QuizEngine.state.quiz.length;
      const current = QuizEngine.state.idx + 1;
      const pct = Math.round(QuizEngine.state.idx / total * 100);
      return { current, total, pct };
    },
    
    isFinished() {
      return QuizEngine.state.idx >= QuizEngine.state.quiz.length;
    }
  };
  
  return QuizEngine;
}

module.exports = { createQuizEngine };
