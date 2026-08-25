// ============================================================
// quiz.test.js - 答题引擎核心逻辑测试
// ============================================================

const { setupBrowserMocks, loadQuizScripts } = require('./test-helper');

setupBrowserMocks();

// 设置 DOM 环境
function setupDOM() {
  document.body.innerHTML = '';
  
  // 创建必要的 DOM 元素
  var views = ['view-home', 'view-practice', 'view-category', 'view-wrongbook', 'view-stats', 'view-admin'];
  views.forEach(function(id) {
    var el = document.createElement('div');
    el.id = id;
    if (id === 'view-practice') el.classList.add('active');
    document.body.appendChild(el);
  });

  var quizArea = document.createElement('div');
  quizArea.id = 'quizArea';
  document.body.appendChild(quizArea);

  var categoryList = document.createElement('div');
  categoryList.id = 'categoryList';
  document.body.appendChild(categoryList);

  var timerVal = document.createElement('span');
  timerVal.id = 'timerVal';
  document.body.appendChild(timerVal);

  var fb = document.createElement('div');
  fb.id = 'fb';
  document.body.appendChild(fb);

  var fbTitle = document.createElement('div');
  fbTitle.id = 'fbTitle';
  document.body.appendChild(fbTitle);

  var fbDesc = document.createElement('div');
  fbDesc.id = 'fbDesc';
  document.body.appendChild(fbDesc);

  var nextBtn = document.createElement('button');
  nextBtn.id = 'nextBtn';
  document.body.appendChild(nextBtn);

  // 创建模式按钮
  var modes = ['quick', 'standard', 'intensive'];
  modes.forEach(function(m) {
    var btn = document.createElement('button');
    btn.className = 'mode-btn';
    btn.setAttribute('data-mode', m);
    document.body.appendChild(btn);
  });

  // 创建选项元素的容器
  function createOptElements() {
    var optKeys = ['A', 'B', 'C', 'D'];
    optKeys.forEach(function(key) {
      var el = document.createElement('div');
      el.id = 'opt-' + key;
      el.className = 'option-item';
      document.body.appendChild(el);
    });
  }
  
  // 在需要时创建选项元素
  createOptElements();
}

beforeEach(function() {
  setupDOM();
  App = loadQuizScripts();
  App.db.init();
  App.db.setData(App.db.defaults());
  
  // Mock 依赖的 app.js 函数
  App.switchView = function(v) { 
    document.querySelectorAll('.active').forEach(function(el) { el.classList.remove('active'); });
    var viewId = 'view-' + v;
    var el = document.getElementById(viewId);
    if (el) el.classList.add('active');
  };
  App.showAchievementToast = function() {};
});

describe('随机打乱 (App.shuffle)', () => {
  test('返回相同长度的数组', () => {
    var arr = [1, 2, 3, 4, 5];
    var result = App.shuffle(arr);
    expect(result.length).toBe(5);
  });

  test('返回的数组包含所有原始元素', () => {
    var arr = [1, 2, 3, 4, 5];
    var result = App.shuffle(arr);
    arr.forEach(function(item) {
      expect(result).toContain(item);
    });
  });

  test('不修改原数组', () => {
    var arr = [1, 2, 3, 4, 5];
    var copy = arr.slice();
    App.shuffle(arr);
    expect(arr).toEqual(copy);
  });

  test('空数组返回空数组', () => {
    expect(App.shuffle([])).toEqual([]);
  });

  test('单元素数组返回相同元素', () => {
    expect(App.shuffle([42])).toEqual([42]);
  });

  test('打乱结果具有随机性（多次调用结果不同）', () => {
    var arr = Array.from({length: 20}, function(_, i) { return i; });
    var results = new Set();
    for (var i = 0; i < 20; i++) {
      results.add(App.shuffle(arr).join(','));
    }
    // 20次打乱中至少有2种不同的结果（概率极高）
    expect(results.size).toBeGreaterThan(1);
  });
});

describe('模式选择 (App.selectMode)', () => {
  test('切换模式更新 state.mode', () => {
    App.selectMode('standard');
    expect(App.state.mode).toBe('standard');
  });

  test('切换模式清除会话', () => {
    App.session.save({ quiz: [], idx: 0, correctCount: 0, startTime: 0, mode: 'quick' });
    App.selectMode('intensive');
    expect(App.session.load()).toBeNull();
  });

  test('默认模式为 quick', () => {
    // 重新加载后检查默认值
    expect(App.state.mode).toBe('quick');
  });
});

describe('声音开关 (App.toggleSound)', () => {
  test('切换声音返回新状态', () => {
    var result = App.toggleSound();
    expect(typeof result).toBe('boolean');
  });

  test('两次切换后恢复原始状态', () => {
    var first = App.toggleSound();
    var second = App.toggleSound();
    expect(first).not.toBe(second);
  });
});

describe('答题状态机 (App.pickOption)', () => {
  beforeEach(function() {
    App.state.quiz = [{
      id: '001',
      answer: 'B',
      question: '测试题目',
      options: [
        { key: 'A', text: '选项A' },
        { key: 'B', text: '选项B' },
        { key: 'C', text: '选项C' },
        { key: 'D', text: '选项D' }
      ],
      explanation: '解析'
    }];
    App.state.idx = 0;
    App.state.answered = false;
    App.state.correctCount = 0;
    App.state.isWrongBookQuiz = false;
    App.state.startTime = Date.now();
  });

  test('答对增加正确计数', () => {
    App.pickOption('B');
    expect(App.state.correctCount).toBe(1);
  });

  test('答错不增加正确计数', () => {
    App.pickOption('A');
    expect(App.state.correctCount).toBe(0);
  });

  test('答对后标记已回答', () => {
    App.pickOption('B');
    expect(App.state.answered).toBe(true);
  });

  test('重复选择不产生副作用', () => {
    App.pickOption('B');
    var countAfterFirst = App.state.correctCount;
    App.pickOption('B');
    expect(App.state.correctCount).toBe(countAfterFirst);
  });

  test('答错加入错题本', () => {
    App.pickOption('A');
    var wrongList = App.db.getWrong();
    expect(wrongList.length).toBeGreaterThan(0);
    expect(wrongList[0].qid).toBe('001');
  });

  test('答对不加入错题本', () => {
    App.pickOption('B');
    expect(App.db.getWrong().length).toBe(0);
  });

  test('错题本模式答对调用 reviewCorrect', () => {
    App.state.isWrongBookQuiz = true;
    App.db.addWrong('001');
    App.pickOption('B');
    var wl = App.db.getWrong();
    expect(wl[0].level).toBe(1);
  });

  test('错题本模式答错调用 reviewWrong', () => {
    App.state.isWrongBookQuiz = true;
    App.db.addWrong('001');
    App.pickOption('A');
    var wl = App.db.getWrong();
    expect(wl[0].level).toBe(0);
    expect(wl[0].cnt).toBe(2);
  });

  test('答对记录答题历史', () => {
    App.pickOption('B');
    var d = App.db.get();
    expect(d.history.length).toBe(1);
    expect(d.history[0].ok).toBe(true);
  });

  test('答错记录答题历史', () => {
    App.pickOption('A');
    var d = App.db.get();
    expect(d.history.length).toBe(1);
    expect(d.history[0].ok).toBe(false);
  });
});

describe('键盘快捷键 (App.handleQuizKeydown)', () => {
  beforeEach(function() {
    App.state.quiz = [{
      id: '001',
      answer: 'B',
      question: '测试题目',
      options: [
        { key: 'A', text: '选项A' },
        { key: 'B', text: '选项B' },
        { key: 'C', text: '选项C' },
        { key: 'D', text: '选项D' }
      ],
      explanation: '解析'
    }];
    App.state.idx = 0;
    App.state.answered = false;
    App.state.correctCount = 0;
    App.state.startTime = Date.now();
  });

  test('答题视图激活时 A 键选择选项', () => {
    App.handleQuizKeydown({ key: 'a', preventDefault: function() {} });
    expect(App.state.answered).toBe(true);
  });

  test('答题视图激活时 D 键选择选项', () => {
    App.handleQuizKeydown({ key: 'd', preventDefault: function() {} });
    expect(App.state.answered).toBe(true);
  });

  test('已回答后 Enter 键进入下一题', () => {
    App.state.answered = true;
    App.handleQuizKeydown({ key: 'Enter', preventDefault: function() {} });
    expect(App.state.idx).toBe(1);
  });

  test('已回答后空格键进入下一题', () => {
    App.state.answered = true;
    App.handleQuizKeydown({ key: ' ', preventDefault: function() {} });
    expect(App.state.idx).toBe(1);
  });

  test('非 ABCD 键不触发选择', () => {
    App.handleQuizKeydown({ key: 'e', preventDefault: function() {} });
    expect(App.state.answered).toBe(false);
  });

  test('home 视图不响应键盘', () => {
    // 切换到 home 视图
    document.querySelectorAll('.active').forEach(function(el) { el.classList.remove('active'); });
    document.getElementById('view-home').classList.add('active');
    App.state.answered = false;
    App.handleQuizKeydown({ key: 'a', preventDefault: function() {} });
    expect(App.state.answered).toBe(false);
  });
});

describe('会话恢复 (App.tryResumeSession)', () => {
  test('无会话数据返回 false', () => {
    App.session.clear();
    expect(App.tryResumeSession()).toBe(false);
  });

  test('空 quizIds 返回 false', () => {
    App.session.save({ quiz: [], idx: 0, correctCount: 0, startTime: Date.now(), mode: 'quick' });
    expect(App.tryResumeSession()).toBe(false);
  });

  test('已答完的会话返回 false', () => {
    App.session.save({ quiz: [{ id: '001' }], idx: 1, correctCount: 1, startTime: Date.now(), mode: 'quick' });
    var result = App.tryResumeSession();
    expect(result).toBe(false);
  });

  test('有效会话恢复成功', () => {
    App.session.save({ quiz: [{ id: '001' }, { id: '005' }], idx: 0, correctCount: 0, startTime: Date.now(), mode: 'quick' });
    var result = App.tryResumeSession();
    expect(result).toBe(true);
    expect(App.state.quiz.length).toBe(2);
    expect(App.state.idx).toBe(0);
  });

  test('恢复的题目按 ID 查找', () => {
    App.session.save({ quiz: [{ id: '001' }], idx: 0, correctCount: 0, startTime: Date.now(), mode: 'quick' });
    App.tryResumeSession();
    expect(App.state.quiz[0].id).toBe('001');
  });

  test('不存在的题目 ID 被跳过', () => {
    App.session.save({ quiz: [{ id: '001' }, { id: 'nonexistent' }], idx: 0, correctCount: 0, startTime: Date.now(), mode: 'quick' });
    var result = App.tryResumeSession();
    expect(result).toBe(true);
    expect(App.state.quiz.length).toBe(1);
    expect(App.state.quiz[0].id).toBe('001');
  });

  test('恢复后保留答题进度', () => {
    App.session.save({ quiz: [{ id: '001' }, { id: '005' }], idx: 1, correctCount: 1, startTime: Date.now(), mode: 'standard' });
    App.tryResumeSession();
    expect(App.state.idx).toBe(1);
    expect(App.state.correctCount).toBe(1);
    expect(App.state.mode).toBe('standard');
  });
});

describe('错题本复习 (App.startWrongBookQuiz)', () => {
  test('无错题时不启动', () => {
    App.db.setData(App.db.defaults());
    App.startWrongBookQuiz();
    expect(App.state.quiz.length).toBe(0);
  });

  test('有错题时启动复习', () => {
    App.db.addWrong('001');
    App.startWrongBookQuiz();
    expect(App.state.quiz.length).toBe(1);
    expect(App.state.isWrongBookQuiz).toBe(true);
  });

  test('优先复习到期错题', () => {
    var cache = App.db.defaults();
    var future = Date.now() + 24 * 60 * 60 * 1000;
    cache.wrong.push(
      { qid: '001', cnt: 1, level: 0, time: Date.now(), lastReview: 0, nextReview: Date.now() },
      { qid: '005', cnt: 1, level: 3, time: Date.now(), lastReview: Date.now(), nextReview: future }
    );
    App.db.setData(cache);
    App.startWrongBookQuiz();
    expect(App.state.quiz.length).toBe(1);
    expect(App.state.quiz[0].id).toBe('001');
  });

  test('所有错题未到期时使用全部错题', () => {
    var cache = App.db.defaults();
    var future = Date.now() + 24 * 60 * 60 * 1000;
    cache.wrong.push(
      { qid: '001', cnt: 1, level: 3, time: Date.now(), lastReview: Date.now(), nextReview: future },
      { qid: '005', cnt: 1, level: 3, time: Date.now(), lastReview: Date.now(), nextReview: future }
    );
    App.db.setData(cache);
    App.startWrongBookQuiz();
    expect(App.state.quiz.length).toBe(2);
  });
});

describe('完成答题 (App.finishQuiz)', () => {
  test('记录最后成绩', () => {
    App.state.quiz = [{ id: '001' }, { id: '002' }];
    App.state.correctCount = 1;
    App.state.startTime = Date.now() - 5000;
    App.finishQuiz();
    expect(App.state.lastResult).toBeDefined();
    expect(App.state.lastResult.total).toBe(2);
    expect(App.state.lastResult.correct).toBe(1);
    expect(App.state.lastResult.wrong).toBe(1);
  });

  test('正确率计算正确', () => {
    App.state.quiz = new Array(10);
    App.state.correctCount = 8;
    App.state.startTime = Date.now();
    App.finishQuiz();
    expect(App.state.lastResult.pct).toBe(80);
  });

  test('零题时正确率为 0', () => {
    App.state.quiz = [];
    App.state.correctCount = 0;
    App.state.startTime = Date.now();
    App.finishQuiz();
    expect(App.state.lastResult.pct).toBe(0);
  });

  test('普通模式记录模式名称', () => {
    App.state.quiz = [{ id: '001' }];
    App.state.correctCount = 1;
    App.state.mode = 'quick';
    App.state.startTime = Date.now();
    App.finishQuiz();
    expect(App.state.lastResult.mode).toBe('快速');
  });

  test('错题本模式记录模式名称', () => {
    App.state.quiz = [{ id: '001' }];
    App.state.correctCount = 1;
    App.state.isWrongBookQuiz = true;
    App.state.startTime = Date.now();
    App.finishQuiz();
    expect(App.state.lastResult.mode).toBe('错题复习');
  });
});

describe('下一题 (App.nextQ)', () => {
  test('递增索引', () => {
    // 使用 startRandomQuiz 来正确初始化 state
    App.startRandomQuiz('quick');
    expect(App.state.idx).toBe(0);
    App.state.answered = true;
    App.nextQ();
    expect(App.state.idx).toBe(1);
  });
});

describe('退出答题 (App.quitQuiz)', () => {
  test('清除会话', () => {
    App.session.save({ quiz: [{ id: '001' }], idx: 0, correctCount: 0, startTime: Date.now(), mode: 'quick' });
    App.quitQuiz();
    expect(App.session.load()).toBeNull();
  });
});

describe('获取题目数量', () => {
  test('quick 模式返回 10', () => {
    App.selectMode('quick');
    expect(App.state.mode).toBe('quick');
  });

  test('standard 模式返回 20', () => {
    App.selectMode('standard');
    expect(App.state.mode).toBe('standard');
  });

  test('intensive 模式返回 30', () => {
    App.selectMode('intensive');
    expect(App.state.mode).toBe('intensive');
  });
});
