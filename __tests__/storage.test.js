describe('Storage Module', () => {
  beforeEach(() => {
    global.window = {};
    global.document = {
      createElement: (tag) => ({
        textContent: '',
        innerHTML: ''
      })
    };
    global.sessionStorage = {
      _data: {},
      setItem: function(key, value) { this._data[key] = value; },
      getItem: function(key) { return this._data[key] || null; },
      removeItem: function(key) { delete this._data[key]; }
    };
    global.indexedDB = {
      open: jest.fn(() => ({
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
        addEventListener: jest.fn(),
        dispatchEvent: jest.fn()
      }))
    };
    global.Promise = Promise;
    global.App = {};
    jest.resetModules();
  });

  test('esc should escape HTML special characters', () => {
    require('../js/storage');
    expect(App.esc('Hello & World')).toBe('Hello &amp; World');
    expect(App.esc('<div>test</div>')).toBe('&lt;div&gt;test&lt;/div&gt;');
    expect(App.esc('<script>alert("XSS")</script>')).toContain('&lt;script&gt;');
    expect(App.esc('<script>alert("XSS")</script>')).toContain('&lt;/script&gt;');
    expect(App.esc(null)).toBe('');
    expect(App.esc(undefined)).toBe('');
    expect(App.esc(123)).toBe('123');
  });

  test('findQ should find question by id', () => {
    require('../js/data');
    require('../js/storage');
    const q = App.db.findQ('001');
    expect(q).not.toBeNull();
    expect(q.id).toBe('001');
    expect(q.question).toContain('乐行者');
  });

  test('findQ should return null for non-existent id', () => {
    require('../js/data');
    require('../js/storage');
    expect(App.db.findQ('nonexistent')).toBeNull();
  });

  test('addWrong should add new wrong question', () => {
    require('../js/data');
    require('../js/storage');
    App.db.init = jest.fn().mockResolvedValue();
    App.db.get().wrong = [];
    
    App.db.addWrong('001');
    const wrongList = App.db.getWrong();
    
    expect(wrongList.length).toBe(1);
    expect(wrongList[0].qid).toBe('001');
    expect(wrongList[0].cnt).toBe(1);
    expect(wrongList[0].level).toBe(0);
    expect(wrongList[0].nextReview).toBeDefined();
  });

  test('addWrong should increment count and reset level for existing question', () => {
    require('../js/data');
    require('../js/storage');
    App.db.init = jest.fn().mockResolvedValue();
    const now = Date.now();
    App.db.get().wrong = [{
      qid: '001',
      cnt: 3,
      level: 2,
      time: now - 1000,
      lastReview: now - 500,
      nextReview: now + 10000
    }];
    
    App.db.addWrong('001');
    const wrongList = App.db.getWrong();
    
    expect(wrongList.length).toBe(1);
    expect(wrongList[0].cnt).toBe(4);
    expect(wrongList[0].level).toBe(0);
    expect(wrongList[0].nextReview).toBeDefined();
  });

  test('reviewCorrect should increment level', () => {
    require('../js/data');
    require('../js/storage');
    App.db.init = jest.fn().mockResolvedValue();
    const now = Date.now();
    App.db.get().wrong = [{
      qid: '001',
      cnt: 2,
      level: 1,
      time: now - 1000,
      lastReview: 0,
      nextReview: now
    }];
    
    const result = App.db.reviewCorrect('001');
    
    expect(result.mastered).toBe(false);
    expect(result.level).toBe(2);
    expect(result.qid).toBe('001');
    const wrongList = App.db.getWrong();
    expect(wrongList[0].level).toBe(2);
    expect(wrongList[0].nextReview).toBeGreaterThan(now);
  });

  test('reviewCorrect should mark as mastered when level reaches 5', () => {
    require('../js/data');
    require('../js/storage');
    App.db.init = jest.fn().mockResolvedValue();
    App.db.get().wrong = [{
      qid: '001',
      cnt: 4,
      level: 4,
      time: Date.now() - 1000,
      lastReview: 0,
      nextReview: Date.now()
    }];
    
    const result = App.db.reviewCorrect('001');
    
    expect(result.mastered).toBe(true);
    expect(result.qid).toBe('001');
    const wrongList = App.db.getWrong();
    expect(wrongList.length).toBe(0);
  });

  test('reviewWrong should reset level to 0', () => {
    require('../js/data');
    require('../js/storage');
    App.db.init = jest.fn().mockResolvedValue();
    const now = Date.now();
    App.db.get().wrong = [{
      qid: '001',
      cnt: 2,
      level: 3,
      time: now - 1000,
      lastReview: 0,
      nextReview: now + 86400000
    }];
    
    App.db.reviewWrong('001');
    const wrongList = App.db.getWrong();
    
    expect(wrongList.length).toBe(1);
    expect(wrongList[0].level).toBe(0);
    expect(wrongList[0].cnt).toBe(3);
    expect(wrongList[0].nextReview).toBeDefined();
  });

  test('reviewWrong should add new question if not in wrong list', () => {
    require('../js/data');
    require('../js/storage');
    App.db.init = jest.fn().mockResolvedValue();
    App.db.get().wrong = [];
    
    App.db.reviewWrong('001');
    const wrongList = App.db.getWrong();
    
    expect(wrongList.length).toBe(1);
    expect(wrongList[0].qid).toBe('001');
    expect(wrongList[0].level).toBe(0);
  });

  test('removeWrong should remove question from wrong list', () => {
    require('../js/data');
    require('../js/storage');
    App.db.init = jest.fn().mockResolvedValue();
    App.db.get().wrong = [
      { qid: '001', cnt: 1, level: 0 },
      { qid: '002', cnt: 2, level: 1 }
    ];
    
    App.db.removeWrong('001');
    const wrongList = App.db.getWrong();
    
    expect(wrongList.length).toBe(1);
    expect(wrongList[0].qid).toBe('002');
  });

  test('getDueWrong should return due questions', () => {
    require('../js/data');
    require('../js/storage');
    App.db.init = jest.fn().mockResolvedValue();
    const now = Date.now();
    App.db.get().wrong = [
      { qid: '001', cnt: 1, level: 0, nextReview: now - 1000 },
      { qid: '002', cnt: 2, level: 1, nextReview: now + 10000 },
      { qid: '003', cnt: 3, level: 2, nextReview: null }
    ];
    
    const due = App.db.getDueWrong();
    
    expect(due.length).toBe(2);
    expect(due[0].qid).toBe('001');
    expect(due[1].qid).toBe('003');
  });

  test('getStreak should calculate consecutive days', () => {
    require('../js/data');
    require('../js/storage');
    App.db.init = jest.fn().mockResolvedValue();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 86400000);
    const twoDaysAgo = new Date(today.getTime() - 2 * 86400000);
    const threeDaysAgo = new Date(today.getTime() - 3 * 86400000);
    
    App.db.get().history = [
      { time: threeDaysAgo.getTime() },
      { time: twoDaysAgo.getTime() },
      { time: yesterday.getTime() }
    ];
    
    const streak = App.db.getStreak();
    
    expect(streak).toBe(3);
  });

  test('getStreak should return 0 if no history', () => {
    require('../js/data');
    require('../js/storage');
    App.db.init = jest.fn().mockResolvedValue();
    App.db.get().history = [];
    
    const streak = App.db.getStreak();
    
    expect(streak).toBe(0);
  });

  test('checkAchievements should unlock first_answer', () => {
    require('../js/data');
    require('../js/storage');
    App.db.init = jest.fn().mockResolvedValue();
    App.db.get().stats = { total: 1, correct: 1, cats: {} };
    App.db.get().achievements = [];
    App.db.get().wrong = [];
    App.db.get().history = [];
    
    const unlocks = App.db.checkAchievements();
    
    const firstAnswer = unlocks.find(u => u.id === 'first_answer');
    expect(firstAnswer).toBeDefined();
  });

  test('checkAchievements should unlock perfect_10 with perfect quiz', () => {
    require('../js/data');
    require('../js/storage');
    App.db.init = jest.fn().mockResolvedValue();
    App.db.get().stats = { total: 10, correct: 10, cats: {} };
    App.db.get().achievements = [];
    App.db.get().wrong = [];
    App.db.get().history = [];
    
    const unlocks = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 10 });
    
    const perfect10 = unlocks.find(u => u.id === 'perfect_10');
    expect(perfect10).toBeDefined();
  });

  test('checkAchievements should not unlock already unlocked achievements', () => {
    require('../js/data');
    require('../js/storage');
    App.db.init = jest.fn().mockResolvedValue();
    App.db.get().stats = { total: 100, correct: 90, cats: {} };
    App.db.get().achievements = ['first_answer', 'total_100', 'perfect_10', 'daily_50', 'streak_3', 'streak_7', 'acc_90', 'wrong_clear', 'all_cats'];
    App.db.get().wrong = [];
    App.db.get().history = [];
    
    const unlocks = App.db.checkAchievements();
    
    expect(unlocks.length).toBe(0);
  });

  test('sessionLoad should return null when no session', () => {
    require('../js/storage');
    
    global.sessionStorage._data = {};
    const result = App.session.load();
    
    expect(result).toBeNull();
  });

  test('sessionSave should store session data', () => {
    require('../js/storage');
    
    const state = {
      quiz: [{ id: '001' }, { id: '002' }],
      idx: 1,
      correctCount: 1,
      startTime: Date.now(),
      mode: 'quick'
    };
    
    App.session.save(state);
    const saved = App.session.load();
    
    expect(saved.quizIds).toEqual(['001', '002']);
    expect(saved.idx).toBe(1);
    expect(saved.correctCount).toBe(1);
    expect(saved.mode).toBe('quick');
  });

  test('sessionClear should remove session data', () => {
    require('../js/storage');
    
    App.session.save({ quiz: [{ id: '001' }], idx: 0, correctCount: 0, startTime: Date.now(), mode: 'quick' });
    App.session.clear();
    const result = App.session.load();
    
    expect(result).toBeNull();
  });

  test('getDailyGoal should return default 20', () => {
    require('../js/data');
    require('../js/storage');
    App.db.init = jest.fn().mockResolvedValue();
    App.db.get().dailyGoal = undefined;
    
    const goal = App.db.getDailyGoal();
    
    expect(goal).toBe(20);
  });

  test('setDailyGoal should clamp between 5 and 100', () => {
    require('../js/data');
    require('../js/storage');
    App.db.init = jest.fn().mockResolvedValue();
    App.db.get().dailyGoal = 20;
    
    App.db.setDailyGoal(3);
    expect(App.db.get().dailyGoal).toBe(5);
    
    App.db.setDailyGoal(150);
    expect(App.db.get().dailyGoal).toBe(100);
    
    App.db.setDailyGoal(50);
    expect(App.db.get().dailyGoal).toBe(50);
  });
});