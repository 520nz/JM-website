const { JSDOM } = require('jsdom');
require('fake-indexeddb/auto');

describe('storage.js', () => {
  let App;

  beforeEach(() => {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    global.document = dom.window.document;
    global.window = dom.window;
    global.Date = dom.window.Date;

    global.sessionStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn()
    };

    App = {};
    window.App = App;
    jest.resetModules();
  });

  describe('XSS escaping', () => {
    it('should escape HTML special characters', () => {
      require('./storage');
      const result = App.esc('<script>alert("xss")</script>');
      expect(result).toContain('&lt;script&gt;');
      expect(result).toContain('&lt;/script&gt;');
    });

    it('should escape ampersand', () => {
      require('./storage');
      expect(App.esc('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('should handle null and undefined', () => {
      require('./storage');
      expect(App.esc(null)).toBe('');
      expect(App.esc(undefined)).toBe('');
    });

    it('should handle numbers', () => {
      require('./storage');
      expect(App.esc(42)).toBe('42');
    });

    it('should handle plain text', () => {
      require('./storage');
      expect(App.esc('Hello World')).toBe('Hello World');
    });
  });

  describe('App.db module', () => {
    beforeEach(async () => {
      require('./data');
      require('./storage');
      await App.db.init();
      var _cache = App.db.get();
      _cache.history = [];
      _cache.wrong = [];
      _cache.stats = { total: 0, correct: 0, cats: {} };
    });

    describe('defaults', () => {
      it('should return default data structure', () => {
        const defaults = App.db.defaults();
        expect(defaults).toEqual({
          history: [],
          wrong: [],
          stats: { total: 0, correct: 0, cats: {} }
        });
      });
    });

    describe('get', () => {
      it('should return cached data', () => {
        const data = App.db.get();
        expect(data).toHaveProperty('history');
        expect(data).toHaveProperty('wrong');
        expect(data).toHaveProperty('stats');
      });

      it('should create defaults if cache is empty', () => {
        expect(App.db.get()).toEqual(App.db.defaults());
      });
    });

    describe('findQ', () => {
      it('should find question by id', () => {
        const q = App.db.findQ('001');
        expect(q).not.toBeNull();
        expect(q.id).toBe('001');
        expect(q.question).toContain('乐行者');
      });

      it('should return null for non-existent id', () => {
        expect(App.db.findQ('nonexistent')).toBeNull();
      });
    });

    describe('addRecord', () => {
      it('should add record to history', () => {
        App.db.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
        const data = App.db.get();
        expect(data.history.length).toBe(1);
        expect(data.stats.total).toBe(1);
        expect(data.stats.correct).toBe(1);
      });

      it('should increment wrong count when answer is incorrect', () => {
        App.db.addRecord({ qid: '001', ans: 'B', ok: false, time: Date.now() });
        const data = App.db.get();
        expect(data.stats.total).toBe(1);
        expect(data.stats.correct).toBe(0);
      });

      it('should update category stats', () => {
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
        const data = App.db.get();
        expect(data.stats.cats['专辑']).toEqual({ t: 1, c: 1 });
      });
    });

    describe('addWrong', () => {
      it('should add new wrong question', () => {
        App.db.addWrong('001');
        const wrong = App.db.getWrong();
        expect(wrong.length).toBe(1);
        expect(wrong[0].qid).toBe('001');
        expect(wrong[0].cnt).toBe(1);
        expect(wrong[0].level).toBe(0);
      });

      it('should increment count for existing wrong question', () => {
        App.db.addWrong('001');
        App.db.addWrong('001');
        const wrong = App.db.getWrong();
        expect(wrong.length).toBe(1);
        expect(wrong[0].cnt).toBe(2);
      });

      it('should reset level when wrong again', () => {
        App.db.addWrong('001');
        App.db.addWrong('001');
        const wrong = App.db.getWrong();
        expect(wrong[0].level).toBe(0);
      });
    });

    describe('reviewCorrect', () => {
      it('should increase level when correct', () => {
        App.db.addWrong('001');
        App.db.reviewCorrect('001');
        const wrong = App.db.getWrong();
        expect(wrong[0].level).toBe(1);
      });

      it('should remove from wrong book when level reaches 5', () => {
        App.db.addWrong('001');
        App.db.reviewCorrect('001');
        App.db.reviewCorrect('001');
        App.db.reviewCorrect('001');
        App.db.reviewCorrect('001');
        App.db.reviewCorrect('001');
        const wrong = App.db.getWrong();
        expect(wrong.length).toBe(0);
      });

      it('should set nextReview based on level', () => {
        App.db.addWrong('001');
        const now = Date.now();
        App.db.reviewCorrect('001');
        const wrong = App.db.getWrong();
        expect(wrong[0].nextReview).toBeGreaterThan(now);
      });
    });

    describe('reviewWrong', () => {
      it('should reset level when wrong', () => {
        App.db.addWrong('001');
        App.db.reviewCorrect('001');
        App.db.reviewWrong('001');
        const wrong = App.db.getWrong();
        expect(wrong[0].level).toBe(0);
      });

      it('should increment count when wrong', () => {
        App.db.addWrong('001');
        App.db.reviewWrong('001');
        const wrong = App.db.getWrong();
        expect(wrong[0].cnt).toBe(2);
      });

      it('should add to wrong book if not present', () => {
        App.db.reviewWrong('001');
        const wrong = App.db.getWrong();
        expect(wrong.length).toBe(1);
        expect(wrong[0].qid).toBe('001');
      });
    });

    describe('removeWrong', () => {
      it('should remove wrong question', () => {
        App.db.addWrong('001');
        App.db.addWrong('002');
        App.db.removeWrong('001');
        const wrong = App.db.getWrong();
        expect(wrong.length).toBe(1);
        expect(wrong[0].qid).toBe('002');
      });

      it('should do nothing for non-existent qid', () => {
        App.db.addWrong('001');
        App.db.removeWrong('nonexistent');
        const wrong = App.db.getWrong();
        expect(wrong.length).toBe(1);
      });
    });

    describe('getDueWrong', () => {
      it('should return due questions', () => {
        App.db.addWrong('001');
        const due = App.db.getDueWrong();
        expect(due.length).toBe(1);
      });

      it('should not return questions not yet due', () => {
        App.db.addWrong('001');
        App.db.reviewCorrect('001');
        const due = App.db.getDueWrong();
        expect(due.length).toBe(0);
      });
    });

    describe('recalcStats', () => {
      it('should recalculate stats from history', () => {
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
        App.db.addRecord({ qid: '002', ans: 'A', ok: false, time: Date.now() });
        const data = App.db.get();
        expect(data.stats.total).toBe(2);
        expect(data.stats.correct).toBe(1);

        data.stats.total = 999;
        data.stats.correct = 999;
        App.db.recalcStats();

        const recalcData = App.db.get();
        expect(recalcData.stats.total).toBe(2);
        expect(recalcData.stats.correct).toBe(1);
      });
    });
  });

  describe('App.session module', () => {
    beforeEach(() => {
      require('./storage');
    });

    it('should save session', () => {
      const state = {
        quiz: [{ id: '001' }, { id: '002' }],
        idx: 1,
        correctCount: 1,
        startTime: Date.now(),
        mode: 'quick'
      };
      App.session.save(state);
      expect(sessionStorage.setItem).toHaveBeenCalled();
    });

    it('should load session', () => {
      const savedData = JSON.stringify({
        quizIds: ['001', '002'],
        idx: 1,
        correctCount: 1,
        startTime: Date.now(),
        mode: 'quick'
      });
      sessionStorage.getItem.mockReturnValue(savedData);
      const session = App.session.load();
      expect(session).not.toBeNull();
      expect(session.quizIds).toEqual(['001', '002']);
    });

    it('should return null for invalid JSON', () => {
      sessionStorage.getItem.mockReturnValue('invalid json');
      const session = App.session.load();
      expect(session).toBeNull();
    });

    it('should return null for missing session', () => {
      sessionStorage.getItem.mockReturnValue(null);
      const session = App.session.load();
      expect(session).toBeNull();
    });

    it('should clear session', () => {
      App.session.clear();
      expect(sessionStorage.removeItem).toHaveBeenCalled();
    });
  });
});
