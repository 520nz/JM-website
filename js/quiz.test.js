const { JSDOM } = require('jsdom');
require('fake-indexeddb/auto');

describe('quiz.js', () => {
  let App;

  beforeEach(() => {
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="quizArea"></div><div id="view-practice" class="view"></div></body></html>');
    global.document = dom.window.document;
    global.window = dom.window;
    global.Date = dom.window.Date;
    global.setInterval = jest.fn();
    global.clearInterval = jest.fn();

    global.sessionStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn()
    };

    App = {};
    window.App = App;
    jest.resetModules();
  });

  beforeEach(async () => {
    require('./data');
    require('./storage');
    await App.db.init();
    var _cache = App.db.get();
    _cache.history = [];
    _cache.wrong = [];
    _cache.stats = { total: 0, correct: 0, cats: {} };
    require('./quiz');
    App.switchView = jest.fn();
  });

  describe('shuffle', () => {
    it('should return array with same elements', () => {
      const arr = [1, 2, 3, 4, 5];
      const shuffled = App.shuffle(arr);
      expect(shuffled.length).toBe(arr.length);
      expect(shuffled.sort()).toEqual(arr.sort());
    });

    it('should not mutate original array', () => {
      const arr = [1, 2, 3];
      const original = [...arr];
      App.shuffle(arr);
      expect(arr).toEqual(original);
    });

    it('should handle empty array', () => {
      expect(App.shuffle([])).toEqual([]);
    });

    it('should handle single element', () => {
      expect(App.shuffle([42])).toEqual([42]);
    });
  });

  describe('getCount', () => {
    it('should return correct count for quick mode', () => {
      App.selectMode('quick');
      expect(App.state.mode).toBe('quick');
    });

    it('should return correct count for standard mode', () => {
      App.selectMode('standard');
      expect(App.state.mode).toBe('standard');
    });

    it('should return correct count for intensive mode', () => {
      App.selectMode('intensive');
      expect(App.state.mode).toBe('intensive');
    });
  });

  describe('selectMode', () => {
    it('should update state mode', () => {
      App.selectMode('standard');
      expect(App.state.mode).toBe('standard');
    });

    it('should clear session on mode change', () => {
      App.selectMode('standard');
      expect(sessionStorage.removeItem).toHaveBeenCalled();
    });
  });

  describe('startRandomQuiz', () => {
    it('should populate quiz array', () => {
      App.startRandomQuiz();
      expect(App.state.quiz.length).toBeGreaterThan(0);
    });

    it('should set isWrongBookQuiz to false', () => {
      App.startRandomQuiz();
      expect(App.state.isWrongBookQuiz).toBe(false);
    });

    it('should initialize idx to 0', () => {
      App.startRandomQuiz();
      expect(App.state.idx).toBe(0);
    });

    it('should clear session', () => {
      App.startRandomQuiz();
      expect(sessionStorage.removeItem).toHaveBeenCalled();
    });
  });

  describe('startCatQuiz', () => {
    it('should filter questions by category', () => {
      App.startCatQuiz('专辑');
      expect(App.state.quiz.length).toBeGreaterThan(0);
      App.state.quiz.forEach(q => {
        expect(q.category).toBe('专辑');
      });
    });

    it('should handle insufficient questions in category', () => {
      App.startCatQuiz('专辑');
      expect(App.state.quiz.length).toBeGreaterThan(0);
    });

    it('should set isWrongBookQuiz to false', () => {
      App.startCatQuiz('专辑');
      expect(App.state.isWrongBookQuiz).toBe(false);
    });
  });

  describe('startWrongBookQuiz', () => {
    it('should start quiz from wrong book', () => {
      App.db.addWrong('001');
      App.startWrongBookQuiz();
      expect(App.state.quiz.length).toBeGreaterThan(0);
    });

    it('should set isWrongBookQuiz to true', () => {
      App.db.addWrong('001');
      App.startWrongBookQuiz();
      expect(App.state.isWrongBookQuiz).toBe(true);
    });

    it('should do nothing when no wrong questions', () => {
      App.state.quiz = [];
      App.startWrongBookQuiz();
      expect(App.state.quiz.length).toBe(0);
    });
  });

  describe('tryResumeSession', () => {
    it('should return false when no saved session', () => {
      sessionStorage.getItem.mockReturnValue(null);
      expect(App.tryResumeSession()).toBe(false);
    });

    it('should return false when quiz is empty', () => {
      sessionStorage.getItem.mockReturnValue(JSON.stringify({
        quizIds: [],
        idx: 0,
        correctCount: 0,
        startTime: Date.now(),
        mode: 'quick'
      }));
      expect(App.tryResumeSession()).toBe(false);
    });

    it('should return false when all questions completed', () => {
      sessionStorage.getItem.mockReturnValue(JSON.stringify({
        quizIds: ['001'],
        idx: 1,
        correctCount: 0,
        startTime: Date.now(),
        mode: 'quick'
      }));
      expect(App.tryResumeSession()).toBe(false);
    });

    it('should restore session successfully', () => {
      const startTime = Date.now() - 10000;
      sessionStorage.getItem.mockReturnValue(JSON.stringify({
        quizIds: ['001'],
        idx: 0,
        correctCount: 0,
        startTime: startTime,
        mode: 'quick'
      }));
      expect(App.tryResumeSession()).toBe(true);
      expect(App.state.quiz.length).toBe(1);
      expect(App.state.quiz[0].id).toBe('001');
      expect(App.state.idx).toBe(0);
    });
  });

  describe('resumeSession', () => {
    it('should clear session and go to home when resume fails', () => {
      sessionStorage.getItem.mockReturnValue(null);
      App.resumeSession();
      expect(sessionStorage.removeItem).toHaveBeenCalled();
    });
  });

  describe('discardSession', () => {
    it('should clear session and reset state', () => {
      App.state.quiz = [{ id: '001' }];
      App.state.idx = 1;
      App.discardSession();
      expect(sessionStorage.removeItem).toHaveBeenCalled();
      expect(App.state.quiz).toEqual([]);
      expect(App.state.idx).toBe(0);
    });
  });

  describe('quitQuiz', () => {
    it('should stop timer and clear session', () => {
      App.state.timer = 'mock-timer';
      App.quitQuiz();
      expect(clearInterval).toHaveBeenCalledWith('mock-timer');
      expect(sessionStorage.removeItem).toHaveBeenCalled();
    });
  });

  describe('finishQuiz', () => {
    it('should stop timer and clear session', () => {
      App.state.timer = 'mock-timer';
      App.state.quiz = [{ id: '001' }];
      App.state.idx = 1;
      App.finishQuiz();
      expect(clearInterval).toHaveBeenCalledWith('mock-timer');
      expect(sessionStorage.removeItem).toHaveBeenCalled();
    });
  });

  describe('nextQ', () => {
    it('should increment idx', () => {
      App.state.idx = 0;
      App.nextQ();
      expect(App.state.idx).toBe(1);
    });
  });

  describe('startTimer', () => {
    it('should set startTime', () => {
      App.startTimer();
      expect(App.state.startTime).toBeDefined();
      expect(App.state.startTime).toBeLessThanOrEqual(Date.now());
    });

    it('should create interval', () => {
      App.startTimer();
      expect(setInterval).toHaveBeenCalled();
    });
  });

  describe('stopTimer', () => {
    it('should clear interval', () => {
      App.state.timer = 'mock-timer';
      App.stopTimer();
      expect(clearInterval).toHaveBeenCalledWith('mock-timer');
    });

    it('should set timer to null', () => {
      App.state.timer = 'mock-timer';
      App.stopTimer();
      expect(App.state.timer).toBeNull();
    });
  });
});
