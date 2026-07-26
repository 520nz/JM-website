describe('Quiz Module', () => {
  beforeEach(() => {
    global.window = {};
    global.document = {
      createElement: (tag) => ({
        textContent: '',
        innerHTML: '',
        classList: { add: jest.fn(), remove: jest.fn(), toggle: jest.fn(), contains: jest.fn() },
        style: {}
      }),
      querySelectorAll: jest.fn(() => []),
      querySelector: jest.fn(() => null),
      getElementById: jest.fn(() => null),
      addEventListener: jest.fn(),
      body: { appendChild: jest.fn(), removeChild: jest.fn() }
    };
    global.navigator = {
      clipboard: { writeText: jest.fn().mockResolvedValue() },
      vibrate: jest.fn()
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
    jest.useFakeTimers();
  });

  test('shuffle should return array of same length', () => {
    require('../js/storage');
    require('../js/quiz');
    const arr = [1, 2, 3, 4, 5];
    const shuffled = App.shuffle(arr);
    
    expect(shuffled.length).toBe(5);
    expect(shuffled).toContain(1);
    expect(shuffled).toContain(2);
    expect(shuffled).toContain(3);
    expect(shuffled).toContain(4);
    expect(shuffled).toContain(5);
  });

  test('shuffle should not modify original array', () => {
    require('../js/storage');
    require('../js/quiz');
    const arr = [1, 2, 3];
    const original = [...arr];
    
    App.shuffle(arr);
    
    expect(arr).toEqual(original);
  });

  test('selectMode should update state', () => {
    require('../js/storage');
    require('../js/quiz');
    
    App.selectMode('standard');
    expect(App.state.mode).toBe('standard');
    
    App.selectMode('intensive');
    expect(App.state.mode).toBe('intensive');
  });

  test('toggleSound should toggle sound enabled', () => {
    require('../js/storage');
    require('../js/quiz');
    
    const initial = App.toggleSound();
    expect(initial).toBe(false);
    
    const second = App.toggleSound();
    expect(second).toBe(true);
  });

  test('startTimer should start timer', () => {
    require('../js/storage');
    require('../js/quiz');
    
    App.startTimer();
    expect(App.state.startTime).toBeDefined();
    expect(App.state.timer).not.toBeNull();
    
    App.stopTimer();
    expect(App.state.timer).toBeNull();
  });

  test('stopTimer should clear timer', () => {
    require('../js/storage');
    require('../js/quiz');
    
    App.startTimer();
    expect(App.state.timer).not.toBeNull();
    
    App.stopTimer();
    expect(App.state.timer).toBeNull();
  });

  test('tryResumeSession should return false when no session', () => {
    require('../js/storage');
    require('../js/data');
    require('../js/quiz');
    
    const result = App.tryResumeSession();
    
    expect(result).toBe(false);
  });

  test('tryResumeSession should return false when session completed', () => {
    require('../js/storage');
    require('../js/data');
    require('../js/quiz');
    
    global.sessionStorage._data = {
      jj_quiz_session: JSON.stringify({
        quizIds: ['001', '002'],
        idx: 2,
        correctCount: 1,
        startTime: Date.now(),
        mode: 'quick'
      })
    };
    
    const result = App.tryResumeSession();
    
    expect(result).toBe(false);
  });

  test('discardSession should clear state and session', () => {
    require('../js/storage');
    require('../js/quiz');
    
    App.switchView = jest.fn();
    
    App.state.quiz = [{ id: '001' }];
    App.state.idx = 1;
    
    App.discardSession();
    
    expect(App.state.quiz.length).toBe(0);
    expect(App.state.idx).toBe(0);
    expect(App.switchView).toHaveBeenCalledWith('home');
  });
});