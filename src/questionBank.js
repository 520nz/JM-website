// 题库管理模块
function createQuestionBank(localStorage, defaultQuestions) {
  let questionBank = [...defaultQuestions];
  
  const QuestionBank = {
    get() {
      return questionBank;
    },
    
    add(question) {
      questionBank.push(question);
      QuestionBank.save();
    },
    
    update(id, updatedQuestion) {
      for (let i = 0; i < questionBank.length; i++) {
        if (questionBank[i].id === id) {
          questionBank[i] = { ...questionBank[i], ...updatedQuestion };
          break;
        }
      }
      QuestionBank.save();
    },
    
    delete(id) {
      questionBank = questionBank.filter(q => q.id !== id);
      QuestionBank.save();
    },
    
    find(id) {
      return questionBank.find(q => q.id === id);
    },
    
    filterByCategory(category) {
      return questionBank.filter(q => q.category === category);
    },
    
    getCategories() {
      const cats = {};
      for (let i = 0; i < questionBank.length; i++) {
        const c = questionBank[i].category;
        cats[c] = (cats[c] || 0) + 1;
      }
      return cats;
    },
    
    save() {
      localStorage.setItem('jj_question_bank', JSON.stringify(questionBank));
    },
    
    load() {
      const saved = localStorage.getItem('jj_question_bank');
      if (saved) {
        try {
          questionBank = JSON.parse(saved);
        } catch (e) {}
      }
    },
    
    resetToDefault() {
      questionBank = [...defaultQuestions];
      localStorage.removeItem('jj_question_bank');
    }
  };
  
  return QuestionBank;
}

module.exports = { createQuestionBank };
