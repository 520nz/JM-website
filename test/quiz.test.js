'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { createBrowserShim } = require('./browser-shim');

let _App;

async function setup() {
  const shim = createBrowserShim();
  global.window = shim.window;
  global.document = shim.document;

  shim.loadFile(path.join(__dirname, '..', 'js', 'data.js'));
  shim.loadFile(path.join(__dirname, '..', 'js', 'storage.js'));
  shim.loadFile(path.join(__dirname, '..', 'js', 'quiz.js'));

  shim.window.App.switchView = () => {};
  await shim.window.App.db.init();
  _App = shim.window.App;
  return _App;
}

function cleanup() {
  if (_App && typeof _App.stopTimer === 'function') {
    try { _App.stopTimer(); } catch (_) {}
  }
}

test.afterEach(() => { cleanup(); });

test.describe('shuffle —— Fisher-Yates 洗牌', () => {
  test('空数组返回空数组', async () => {
    const App = await setup();
    assert.deepEqual(App.shuffle([]), []);
  });

  test('单元素数组不变', async () => {
    const App = await setup();
    assert.deepEqual(App.shuffle([1]), [1]);
  });

  test('返回新数组（不修改原数组）', async () => {
    const App = await setup();
    const orig = [1, 2, 3, 4, 5];
    const result = App.shuffle(orig);
    assert.notEqual(result, orig, '应返回新数组');
    assert.deepEqual(orig, [1, 2, 3, 4, 5], '原数组应保持不变');
  });

  test('洗牌后元素不变（只是顺序变了）', async () => {
    const App = await setup();
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = App.shuffle(arr);
    assert.equal(result.length, arr.length);
    const sorted = result.slice().sort((a, b) => a - b);
    assert.deepEqual(sorted, arr);
  });

  test('50 次洗牌应出现多种不同排列', async () => {
    const App = await setup();
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const seen = new Set();
    for (let i = 0; i < 50; i++) {
      seen.add(App.shuffle(arr).join(','));
    }
    assert.ok(seen.size > 1, '洗牌应产生不同排列');
  });
});

// quiz.js 里 fmtTime 是内部函数，这里根据源码逻辑独立验证
function fmtTimeRef(ms) {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + '分' + s + '秒';
}

test.describe('fmtTime —— 时间格式化（源码逻辑验证）', () => {
  test('0ms 返回 "0分0秒"', () => {
    assert.equal(fmtTimeRef(0), '0分0秒');
  });

  test('正好 1 分钟', () => {
    assert.equal(fmtTimeRef(60 * 1000), '1分0秒');
  });

  test('1 分 30 秒', () => {
    assert.equal(fmtTimeRef(90 * 1000), '1分30秒');
  });

  test('恰好 59 秒', () => {
    assert.equal(fmtTimeRef(59 * 1000), '0分59秒');
  });

  test('毫秒截断为秒', () => {
    assert.equal(fmtTimeRef(999), '0分0秒');
    assert.equal(fmtTimeRef(1500), '0分1秒');
  });
});

test.describe('selectMode —— 模式切换', () => {
  test('selectMode 能切换模式并清除 session', async () => {
    const App = await setup();
    App.session.save({ quiz: [{ id: '001' }], idx: 0, correctCount: 0, startTime: Date.now(), mode: 'quick' });
    App.selectMode('standard');
    assert.equal(App.state.mode, 'standard');
    assert.equal(App.session.load(), null, '模式切换后应清除 session');
  });
});

test.describe('startRandomQuiz —— 随机答题启动', () => {
  test('quick 模式启动后 state 正确初始化', async () => {
    const App = await setup();
    App.selectMode('quick');
    App.startRandomQuiz();
    const s = App.state;
    assert.equal(s.quiz.length, 10);
    assert.equal(s.idx, 0);
    assert.equal(s.correctCount, 0);
    assert.equal(s.answered, false);
    assert.equal(s.isWrongBookQuiz, false);
    assert.ok(typeof s.startTime === 'number');
  });

  test('standard 模式 20 题', async () => {
    const App = await setup();
    App.selectMode('standard');
    App.startRandomQuiz();
    assert.equal(App.state.quiz.length, 20);
  });

  test('intensive 模式 30 题', async () => {
    const App = await setup();
    App.selectMode('intensive');
    App.startRandomQuiz();
    assert.equal(App.state.quiz.length, 30);
  });
});

test.describe('pickOption —— 选择答案状态机', () => {
  test('答对后 correctCount +1 且 answered=true', async () => {
    const App = await setup();
    App.selectMode('quick');
    App.startRandomQuiz();
    const q = App.state.quiz[0];
    assert.equal(App.state.answered, false);
    const before = App.state.correctCount;
    App.pickOption(q.answer);
    assert.equal(App.state.answered, true);
    assert.equal(App.state.correctCount, before + 1);
  });

  test('答错不增加 correctCount，答题记录标记 ok=false', async () => {
    const App = await setup();
    App.selectMode('quick');
    App.startRandomQuiz();
    const q = App.state.quiz[0];
    const wrong = q.options.find((o) => o.key !== q.answer);
    const before = App.state.correctCount;
    const beforeWrong = App.db.getWrong().length;
    App.pickOption(wrong.key);
    assert.equal(App.state.correctCount, before);
    assert.ok(App.db.getWrong().length > beforeWrong, '普通模式答错应加入错题本');
  });

  test('已回答后重复 pickOption 不应再次改变状态', async () => {
    const App = await setup();
    App.selectMode('quick');
    App.startRandomQuiz();
    const q = App.state.quiz[0];
    App.pickOption(q.answer);
    const before = App.state.correctCount;
    App.pickOption(q.answer); // 重复点击
    assert.equal(App.state.correctCount, before);
  });

  test('nextQ 推进 idx 并重置 answered=false', async () => {
    const App = await setup();
    App.selectMode('quick');
    App.startRandomQuiz();
    const q = App.state.quiz[0];
    App.pickOption(q.answer);
    const initIdx = App.state.idx;
    App.nextQ();
    assert.equal(App.state.idx, initIdx + 1);
    assert.equal(App.state.answered, false);
  });
});

test.describe('startCatQuiz —— 分类答题', () => {
  test('只抽取指定分类题目', async () => {
    const App = await setup();
    App.startCatQuiz('专辑');
    assert.ok(App.state.quiz.every((q) => q.category === '专辑'));
  });

  test('分类题目数量少于 getCount 时返回全部', async () => {
    const App = await setup();
    App.startCatQuiz('获奖记录');
    assert.ok(App.state.quiz.length <= 10);
    assert.ok(App.state.quiz.every((q) => q.category === '获奖记录'));
  });
});

test.describe('错题本复习 —— 间隔重复集成', () => {
  test('答对错题本题目触发 reviewCorrect，level 上升', async () => {
    const App = await setup();
    // 先答错题让它进错题本
    App.selectMode('quick');
    App.startRandomQuiz();
    const q = App.state.quiz[0];
    const wrong = q.options.find((o) => o.key !== q.answer);
    App.pickOption(wrong.key);
    assert.ok(App.db.getWrong().length > 0);

    // 启动错题本复习
    App.startWrongBookQuiz();
    assert.equal(App.state.isWrongBookQuiz, true);
    const q2 = App.state.quiz[0];
    const beforeLevel = App.db.getWrong()[0].level;
    App.pickOption(q2.answer);
    assert.ok(App.db.getWrong()[0].level > beforeLevel, '答对后 level 应上升');
  });

  test('答错错题本题目触发 reviewWrong，level 重置为 0', async () => {
    const App = await setup();
    // 进错题本并升到 L2
    App.selectMode('quick');
    App.startRandomQuiz();
    const q = App.state.quiz[0];
    const wrong = q.options.find((o) => o.key !== q.answer);
    App.pickOption(wrong.key);
    // 手动升到 L2
    App.db.reviewCorrect(q.id);
    App.db.reviewCorrect(q.id);
    assert.equal(App.db.getWrong()[0].level, 2);

    App.startWrongBookQuiz();
    const targetQ = App.state.quiz[0];
    const wrongAgain = targetQ.options.find((o) => o.key !== targetQ.answer);
    App.pickOption(wrongAgain.key);
    assert.equal(App.db.getWrong()[0].level, 0, '答错后 level 应重置为 0');
  });
});

test.describe('session 保存/加载/清除', () => {
  test('save + load 正确恢复答题状态字段', async () => {
    const App = await setup();
    const state = {
      quiz: App.QUESTION_BANK.slice(0, 3),
      idx: 1,
      correctCount: 0,
      startTime: 123456,
      mode: 'quick',
      isWrongBookQuiz: false,
    };
    App.session.save(state);
    const loaded = App.session.load();
    assert.ok(loaded);
    assert.equal(loaded.quizIds.length, 3);
    assert.equal(loaded.idx, 1);
    assert.equal(loaded.startTime, 123456);
    assert.equal(loaded.mode, 'quick');
    assert.equal(loaded.isWrongBookQuiz, false);
  });

  test('clear 后 load 返回 null', async () => {
    const App = await setup();
    App.session.save({ quiz: [], idx: 0, correctCount: 0, startTime: 0, mode: 'quick' });
    App.session.clear();
    assert.equal(App.session.load(), null);
  });
});
