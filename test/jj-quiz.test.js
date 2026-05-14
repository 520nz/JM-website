const assert = require('assert');

describe('JJ Quiz Application', function() {
  describe('DB Module', function() {
    const DB = {
      KEY: 'jj_quiz_v2',
      get: function() {
        var d = localStorage.getItem(DB.KEY);
        return d ? JSON.parse(d) : DB.defaults();
      },
      defaults: function() {
        return { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } };
      },
      save: function(d) {
        localStorage.setItem(DB.KEY, JSON.stringify(d));
      },
      addRecord: function(rec) {
        var d = DB.get();
        d.history.push(rec);
        d.stats.total++;
        if (rec.ok) d.stats.correct++;
        DB.save(d);
      },
      addWrong: function(qid) {
        var d = DB.get();
        var f = null;
        for (var i = 0; i < d.wrong.length; i++) {
          if (d.wrong[i].qid === qid) {
            f = d.wrong[i];
            break;
          }
        }
        if (f) {
          f.cnt++;
          f.time = Date.now();
        } else {
          d.wrong.push({ qid: qid, cnt: 1, time: Date.now() });
        }
        DB.save(d);
      },
      removeWrong: function(qid) {
        var d = DB.get();
        d.wrong = d.wrong.filter(function(w) {
          return w.qid !== qid;
        });
        DB.save(d);
      },
      getWrong: function() {
        return DB.get().wrong;
      }
    };

    beforeEach(function() {
      localStorage.clear();
    });

    it('should return default data when localStorage is empty', function() {
      const result = DB.get();
      assert.deepStrictEqual(result, { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } });
    });

    it('should save and retrieve data correctly', function() {
      const testData = { history: [], wrong: [], stats: { total: 5, correct: 3, cats: { '专辑': { t: 2, c: 1 } } } };
      DB.save(testData);
      const result = DB.get();
      assert.deepStrictEqual(result, testData);
    });

    it('should add record correctly', function() {
      DB.addRecord({ qid: '001', ok: true });
      const data = DB.get();
      assert.strictEqual(data.stats.total, 1);
      assert.strictEqual(data.stats.correct, 1);
      assert.strictEqual(data.history.length, 1);
    });

    it('should add wrong question record', function() {
      DB.addWrong('001');
      const data = DB.get();
      assert.strictEqual(data.wrong.length, 1);
      assert.strictEqual(data.wrong[0].qid, '001');
      assert.strictEqual(data.wrong[0].cnt, 1);
    });

    it('should increment count when adding same wrong question again', function() {
      DB.addWrong('001');
      DB.addWrong('001');
      const data = DB.get();
      assert.strictEqual(data.wrong.length, 1);
      assert.strictEqual(data.wrong[0].cnt, 2);
    });

    it('should remove wrong question', function() {
      DB.addWrong('001');
      DB.addWrong('002');
      DB.removeWrong('001');
      const data = DB.get();
      assert.strictEqual(data.wrong.length, 1);
      assert.strictEqual(data.wrong[0].qid, '002');
    });

    it('should get wrong questions list', function() {
      DB.addWrong('001');
      const wrong = DB.getWrong();
      assert.strictEqual(wrong.length, 1);
      assert.strictEqual(wrong[0].qid, '001');
    });
  });

  describe('Question Bank Validation', function() {
    const QUESTION_BANK = [
      { id: '001', category: '专辑', question: 'Test question', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }, { key: 'C', text: 'C' }, { key: 'D', text: 'D' }], answer: 'A', explanation: 'Test' }
    ];

    it('should validate question structure', function() {
      QUESTION_BANK.forEach(q => {
        assert.ok(q.id, 'Question must have id');
        assert.ok(q.category, 'Question must have category');
        assert.ok(q.question, 'Question must have question text');
        assert.ok(q.options && q.options.length === 4, 'Question must have exactly 4 options');
        assert.ok(['A', 'B', 'C', 'D'].includes(q.answer), 'Answer must be A, B, C, or D');
        q.options.forEach(opt => {
          assert.ok(opt.key, 'Option must have key');
          assert.ok(opt.text, 'Option must have text');
        });
      });
    });

    it('should find question by id', function() {
      const findQ = function(qid) {
        for (var i = 0; i < QUESTION_BANK.length; i++) {
          if (QUESTION_BANK[i].id === qid) return QUESTION_BANK[i];
        }
        return null;
      };
      const result = findQ('001');
      assert.ok(result);
      assert.strictEqual(result.id, '001');
    });

    it('should return null for non-existent question id', function() {
      const findQ = function(qid) {
        for (var i = 0; i < QUESTION_BANK.length; i++) {
          if (QUESTION_BANK[i].id === qid) return QUESTION_BANK[i];
        }
        return null;
      };
      const result = findQ('999');
      assert.strictEqual(result, null);
    });
  });

  describe('Quiz Logic', function() {
    it('should calculate accuracy correctly', function() {
      const calculateAccuracy = (correct, total) => {
        if (total === 0) return 0;
        return Math.round((correct / total) * 100);
      };
      
      assert.strictEqual(calculateAccuracy(3, 5), 60);
      assert.strictEqual(calculateAccuracy(0, 0), 0);
      assert.strictEqual(calculateAccuracy(0, 5), 0);
      assert.strictEqual(calculateAccuracy(5, 5), 100);
    });

    it('should shuffle array correctly', function() {
      const shuffle = function(arr) {
        var result = arr.slice();
        for (var i = result.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var temp = result[i];
          result[i] = result[j];
          result[j] = temp;
        }
        return result;
      };
      
      const arr = [1, 2, 3, 4, 5];
      const shuffled = shuffle(arr);
      assert.strictEqual(shuffled.length, 5);
      assert.deepStrictEqual(shuffled.sort(), arr.sort());
    });

    it('should generate unique quiz sets', function() {
      const getRandomQuestions = function(bank, count) {
        const shuffled = bank.slice().sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
      };
      
      const bank = Array.from({ length: 20 }, (_, i) => ({ id: String(i).padStart(3, '0') }));
      const quiz = getRandomQuestions(bank, 10);
      assert.strictEqual(quiz.length, 10);
      
      const ids = quiz.map(q => q.id);
      const uniqueIds = [...new Set(ids)];
      assert.strictEqual(uniqueIds.length, 10);
    });
  });

  describe('Data Import/Export', function() {
    it('should validate import data structure', function() {
      const validateImportData = function(data) {
        if (!data || !data.questionBank) return false;
        if (!Array.isArray(data.questionBank)) return false;
        
        for (const q of data.questionBank) {
          if (!q.id || !q.category || !q.question || !q.options || !q.answer) {
            return false;
          }
          if (q.options.length !== 4) return false;
          if (!['A', 'B', 'C', 'D'].includes(q.answer)) return false;
        }
        return true;
      };

      const validData = {
        questionBank: [{
          id: 'test001',
          category: '歌曲',
          question: 'Test',
          options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }, { key: 'C', text: 'C' }, { key: 'D', text: 'D' }],
          answer: 'A',
          explanation: 'Test'
        }],
        userData: { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } }
      };

      const invalidData = { questionBank: [{ id: 'test' }] };

      assert.strictEqual(validateImportData(validData), true);
      assert.strictEqual(validateImportData(invalidData), false);
      assert.strictEqual(validateImportData(null), false);
    });

    it('should format export data correctly', function() {
      const formatExportData = function(questionBank, userData) {
        return {
          questionBank: questionBank,
          userData: userData,
          exportTime: new Date().toISOString()
        };
      };

      const bank = [{ id: '001', category: '专辑', question: 'Q', options: [], answer: 'A', explanation: 'E' }];
      const userData = { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } };
      
      const result = formatExportData(bank, userData);
      
      assert.ok(result.exportTime);
      assert.deepStrictEqual(result.questionBank, bank);
      assert.deepStrictEqual(result.userData, userData);
      assert.ok(new Date(result.exportTime) instanceof Date);
    });
  });
});