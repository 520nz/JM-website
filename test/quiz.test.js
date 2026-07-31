// quiz.js 业务逻辑回归测试
//
// 覆盖 quiz.js 中影响数据完整性的核心逻辑：
//   - shuffle 随机打乱（不丢失/不重复）
//   - getCount 模式→题目数映射
//   - startRandomQuiz 初始化 state（isWrongBookQuiz、idx、correctCount）
//   - startWrongBookQuiz 优先取 due 错题、否则取全部
//   - startCatQuiz 按分类过滤 + 题目不足时全部纳入
//   - pickOption 副作用（db.addRecord/addWrong/reviewCorrect/reviewWrong、correctCount 累加、二次点击忽略）
//   - finishQuiz 统计（lastResult 正确率、用时、四种模式文案）
//   - tryResumeSession 恢复（空会话、已完成会话、题目被删、正常恢复）
const test = require('node:test');
const assert = require('node:assert');
const { freshApp, loadAdmin, loadQuiz } = require('./helpers');

// 最小 DOM mock：pickOption / renderQ / finishQuiz 都会通过 getElementById 访问元素
// 注意：必须先 ensureGlobalPolyfills()，否则 global.document 可能是 undefined
function withQuizDOM(fn) {
  const { ensureGlobalPolyfills } = require('./helpers/loadSource');
  ensureGlobalPolyfills();
  const elements = new Map();
  function getEl(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        value: '',
        innerHTML: '',
        textContent: '',
        style: {},
        classList: {
          _set: new Set(),
          add(c) { this._set.add(c); },
          remove(c) { this._set.delete(c); },
          contains(c) { return this._set.has(c); },
          toggle(c) { this._set.has(c) ? this._set.delete(c) : this._set.add(c); }
        },
        appendChild(c) { this.children = this.children || []; this.children.push(c); return c; },
        removeChild(c) { this.children = (this.children || []).filter(x => x !== c); },
        remove() {},
        setAttribute(k, v) { this[k] = v; },
        getAttribute(k) { return this[k] || null; },
        get firstChild() { return null; },
        get offsetHeight() { return 0; }
      });
    }
    return elements.get(id);
  }
  const origGet = global.document.getElementById;
  const origQS = global.document.querySelector;
  const origQSA = global.document.querySelectorAll;
  global.document.getElementById = getEl;
  global.document.querySelector = () => null;
  global.document.querySelectorAll = () => [];
  // 预热 quiz.js 会访问的容器
  ['quizArea', 'categoryList', 'view-practice', 'fb', 'fbTitle', 'fbDesc', 'nextBtn', 'timerVal'].forEach(getEl);
  // mock 视图切换 + toast，避免 quiz.js 调到未加载的 app.js 模块
  global.App = global.App || {};
  const origSwitch = global.App.switchView;
  const origShow = global.App.showAchievementToast;
  global.App.switchView = () => {};
  global.App.showAchievementToast = () => {};
  // navigator.vibrate 已存在为 undefined，加 mock
  const origVib = global.navigator.vibrate;
  global.navigator.vibrate = () => {};
  // 关键：fn 可能是 async，必须 await 完才能 finally 恢复
  let result;
  // 收集 setTimeout 句柄，在 teardown 中 unref 让它们不阻塞 Node 退出
  const pendingTimers = new Set();
  const origSetTimeout = global.setTimeout;
  global.setTimeout = function(fn, delay, ...args) {
    const t = origSetTimeout.call(global, fn, delay, ...args);
    if (t && typeof t.unref === 'function') t.unref();
    pendingTimers.add(t);
    return t;
  };
  try {
    result = fn();
  } catch (e) {
    if (global.App && global.App.state && global.App.state.timer) {
      clearInterval(global.App.state.timer);
      global.App.state.timer = null;
    }
    global.setTimeout = origSetTimeout;
    global.document.getElementById = origGet;
    global.document.querySelector = origQS;
    global.document.querySelectorAll = origQSA;
    if (origSwitch) global.App.switchView = origSwitch; else delete global.App.switchView;
    if (origShow) global.App.showAchievementToast = origShow; else delete global.App.showAchievementToast;
    global.navigator.vibrate = origVib;
    throw e;
  }
  // 如果 fn 返回 Promise，把 teardown 链在后面
  if (result && typeof result.then === 'function') {
    return result.finally(() => {
      if (global.App && global.App.state && global.App.state.timer) {
        clearInterval(global.App.state.timer);
        global.App.state.timer = null;
      }
      global.setTimeout = origSetTimeout;
      global.document.getElementById = origGet;
      global.document.querySelector = origQS;
      global.document.querySelectorAll = origQSA;
      if (origSwitch) global.App.switchView = origSwitch; else delete global.App.switchView;
      if (origShow) global.App.showAchievementToast = origShow; else delete global.App.showAchievementToast;
      global.navigator.vibrate = origVib;
    });
  } else {
    if (global.App && global.App.state && global.App.state.timer) {
      clearInterval(global.App.state.timer);
      global.App.state.timer = null;
    }
    global.setTimeout = origSetTimeout;
    global.document.getElementById = origGet;
    global.document.querySelector = origQS;
    global.document.querySelectorAll = origQSA;
    if (origSwitch) global.App.switchView = origSwitch; else delete global.App.switchView;
    if (origShow) global.App.showAchievementToast = origShow; else delete global.App.showAchievementToast;
    global.navigator.vibrate = origVib;
    return result;
  }
}

function loadAll() {
  // 必须先 storage，再 admin（虽然 admin 不依赖 storage，但 quiz 需要 db）
  loadAdmin();
  return loadQuiz();
}

// === shuffle 纯函数 ===

test('shuffle：长度不变，元素集合不变', () => {
  return withQuizDOM(async () => {
    await freshApp();
    const App = loadAll();
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const out = App.shuffle(arr);
    assert.strictEqual(out.length, arr.length);
    assert.deepStrictEqual(out.slice().sort((a, b) => a - b), arr);
    // 原数组不应被修改
    assert.deepStrictEqual(arr, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

test('shuffle：空数组返回空数组', () => {
  return withQuizDOM(async () => {
    await freshApp();
    const App = loadAll();
    assert.deepStrictEqual(App.shuffle([]), []);
  });
});

test('shuffle：单元素返回单元素', () => {
  return withQuizDOM(async () => {
    await freshApp();
    const App = loadAll();
    assert.deepStrictEqual(App.shuffle([42]), [42]);
  });
});

// === startRandomQuiz / startCatQuiz / startWrongBookQuiz 初始化 state ===

test('startRandomQuiz：state.quiz 不超过题库容量，idx=0，isWrongBookQuiz=false', () => {
  return withQuizDOM(async () => {
    await freshApp();
    const App = loadAll();
    App.startRandomQuiz();
    // fixtures 注入 4 道题：quick 模式请求 10 题，但题库容量=4
    assert.strictEqual(App.state.quiz.length, 4, '题库容量=4 时 quiz 取全部 4 道');
    assert.strictEqual(App.state.idx, 0);
    assert.strictEqual(App.state.correctCount, 0);
    assert.strictEqual(App.state.isWrongBookQuiz, false);
    assert.strictEqual(App.state.mode, 'quick');
  });
});

test('selectMode：改变 state.mode，不影响其他状态', () => {
  return withQuizDOM(async () => {
    await freshApp();
    const App = loadAll();
    assert.strictEqual(App.state.mode, 'quick');
    App.selectMode('standard');
    assert.strictEqual(App.state.mode, 'standard');
    App.selectMode('intensive');
    assert.strictEqual(App.state.mode, 'intensive');
    // startRandomQuiz 调用的题数 = min(getCount, 题库容量)
    App.startRandomQuiz();
    assert.ok(App.state.quiz.length <= 4, 'intensive 30 题受题库容量 4 限制');
    assert.strictEqual(App.state.quiz.length, 4, '题库 4 道全取');
  });
});

test('startCatQuiz：按分类过滤；不足时全部纳入', () => {
  return withQuizDOM(async () => {
    await freshApp();
    const App = loadAll();
    // fixtures 注入 4 题：q1=专辑、q2=歌曲、q3=个人信息、q4=获奖记录
    App.selectMode('intensive'); // 30 题 > 1
    App.startCatQuiz('专辑');
    assert.strictEqual(App.state.quiz.length, 1);
    assert.strictEqual(App.state.quiz[0].category, '专辑');
    assert.strictEqual(App.state.isWrongBookQuiz, false);
  });
});

test('startWrongBookQuiz：错题本为空时不启动（state.quiz 保持上次的随机题）', () => {
  return withQuizDOM(async () => {
    await freshApp();
    const App = loadAll();
    const before = App.state.quiz; // 默认 []
    App.startWrongBookQuiz();
    // 错题本为空 → quiz 不变
    assert.strictEqual(App.state.quiz, before, '空错题本不应启动新题组');
  });
});

test('startWrongBookQuiz：存在 due 错题时优先取 due', () => {
  return withQuizDOM(async () => {
    await freshApp();
    const App = loadAll();
    // 加 2 道错题：q1 立即到期、q2 设置未来到期
    App.db.addWrong('q1');
    App.db.addWrong('q2');
    const all = App.db.getWrong();
    const q2 = all.find(w => w.qid === 'q2');
    q2.nextReview = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 天后
    App.startWrongBookQuiz();
    // 只有 q1 是 due
    assert.strictEqual(App.state.quiz.length, 1);
    assert.strictEqual(App.state.quiz[0].id, 'q1');
    assert.strictEqual(App.state.isWrongBookQuiz, true);
  });
});

test('startWrongBookQuiz：无 due 但有非空错题本时回退到全部', () => {
  return withQuizDOM(async () => {
    await freshApp();
    const App = loadAll();
    App.db.addWrong('q1');
    App.db.addWrong('q2');
    // 把所有 nextReview 设为未来
    App.db.getWrong().forEach(w => { w.nextReview = Date.now() + 999999; });
    App.startWrongBookQuiz();
    assert.strictEqual(App.state.quiz.length, 2, '应回退到全部错题');
  });
});

// === pickOption 副作用 ===

test('pickOption：答对 → addRecord(ok=true)、correctCount++、不加入错题本', () => {
  return withQuizDOM(async () => {
    await freshApp();
    const App = loadAll();
    App.startRandomQuiz();
    const q = App.state.quiz[0];
    App.pickOption(q.answer);
    const d = App.db.get();
    assert.strictEqual(d.history.length, 1);
    assert.strictEqual(d.history[0].ok, true);
    assert.strictEqual(d.history[0].qid, q.id);
    assert.strictEqual(App.state.correctCount, 1);
    assert.strictEqual(d.wrong.length, 0, '答对不加入错题本');
    assert.strictEqual(d.stats.total, 1);
    assert.strictEqual(d.stats.correct, 1);
  });
});

test('pickOption：答错 → addRecord(ok=false)、加入错题本', () => {
  return withQuizDOM(async () => {
    await freshApp();
    const App = loadAll();
    App.startRandomQuiz();
    const q = App.state.quiz[0];
    const wrongKey = q.options.find(o => o.key !== q.answer).key;
    App.pickOption(wrongKey);
    const d = App.db.get();
    assert.strictEqual(d.history[0].ok, false);
    assert.strictEqual(App.state.correctCount, 0);
    assert.strictEqual(d.wrong.length, 1);
    assert.strictEqual(d.wrong[0].qid, q.id);
    assert.strictEqual(d.wrong[0].cnt, 1);
    assert.strictEqual(d.wrong[0].level, 0);
  });
});

test('pickOption：重复点击同一题不重复计分（state.answered 守门）', () => {
  return withQuizDOM(async () => {
    await freshApp();
    const App = loadAll();
    App.startRandomQuiz();
    const q = App.state.quiz[0];
    App.pickOption(q.answer);
    assert.strictEqual(App.state.correctCount, 1);
    App.pickOption(q.answer);
    App.pickOption(q.answer);
    assert.strictEqual(App.state.correctCount, 1, 'answered 守门，重复调用应被忽略');
    const d = App.db.get();
    assert.strictEqual(d.history.length, 1, '只记录一次');
  });
});

test('pickOption：错题本复习模式下答对触发 reviewCorrect（升级 level）', () => {
  return withQuizDOM(async () => {
    await freshApp();
    const App = loadAll();
    App.db.addWrong('q1');
    App.startWrongBookQuiz();
    assert.strictEqual(App.state.isWrongBookQuiz, true);
    const q = App.state.quiz[0];
    App.pickOption(q.answer);
    const w = App.db.getWrong().find(x => x.qid === 'q1');
    assert.ok(w, 'q1 应仍在错题本中（level<5）');
    assert.strictEqual(w.level, 1, '答对一次 level 从 0 升到 1');
    // 答对时不应触发 addWrong
    const d = App.db.get();
    assert.strictEqual(d.wrong.length, 1);
  });
});

test('pickOption：错题本复习模式下答错触发 reviewWrong（重置 level=0, cnt++）', () => {
  return withQuizDOM(async () => {
    await freshApp();
    const App = loadAll();
    App.db.addWrong('q1');
    // 升级到 level 2
    App.db.reviewCorrect('q1');
    App.db.reviewCorrect('q1');
    let w = App.db.getWrong()[0];
    assert.strictEqual(w.level, 2);
    App.startWrongBookQuiz();
    const q = App.state.quiz[0];
    const wrongKey = q.options.find(o => o.key !== q.answer).key;
    App.pickOption(wrongKey);
    w = App.db.getWrong()[0];
    assert.strictEqual(w.level, 0, '答错重置 level=0');
    assert.strictEqual(w.cnt, 2, 'cnt 累加 1→2');
  });
});

// === finishQuiz 统计 ===

test('finishQuiz：完成全部题后写入 lastResult（正确率、用时、模式文案）', () => {
  return withQuizDOM(async () => {
    await freshApp();
    const App = loadAll();
    App.selectMode('quick');
    App.startRandomQuiz();
    // 答对所有题（fixtures 注入 4 道题）
    while (App.state.idx < App.state.quiz.length) {
      App.pickOption(App.state.quiz[App.state.idx].answer);
      App.nextQ();
    }
    assert.ok(App.state.lastResult, 'finishQuiz 已触发');
    assert.strictEqual(App.state.lastResult.total, 4);
    assert.strictEqual(App.state.lastResult.correct, 4);
    assert.strictEqual(App.state.lastResult.wrong, 0);
    assert.strictEqual(App.state.lastResult.pct, 100);
    assert.strictEqual(App.state.lastResult.mode, '快速', 'quick 模式 → 快速');
  });
});

test('finishQuiz：错题本复习模式的 mode 文案', () => {
  return withQuizDOM(async () => {
    await freshApp();
    const App = loadAll();
    App.db.addWrong('q1');
    App.startWrongBookQuiz();
    while (App.state.idx < App.state.quiz.length) {
      App.pickOption(App.state.quiz[App.state.idx].answer);
      App.nextQ();
    }
    assert.strictEqual(App.state.lastResult.mode, '错题复习');
  });
});

// === tryResumeSession 中断恢复 ===

test('tryResumeSession：sessionStorage 为空时返回 false', () => {
  return withQuizDOM(async () => {
    await freshApp();
    const App = loadAll();
    assert.strictEqual(App.tryResumeSession(), false);
  });
});

test('tryResumeSession：保存的 idx >= quiz.length 视为已完成，不恢复', () => {
  return withQuizDOM(async () => {
    await freshApp();
    const App = loadAll();
    App.session.save({
      quiz: App.QUESTION_BANK.slice(0, 2),
      idx: 2, // 已答完
      correctCount: 2,
      startTime: Date.now(),
      mode: 'quick',
      isWrongBookQuiz: false
    });
    assert.strictEqual(App.tryResumeSession(), false);
    assert.strictEqual(App.db.get().stats.total, 0, '不恢复时不触发答题统计');
  });
});

test('tryResumeSession：保存的 quizIds 中有题目已被删，跳过缺失的', () => {
  return withQuizDOM(async () => {
    await freshApp();
    const App = loadAll();
    App.session.save({
      quiz: [{ id: 'q1' }, { id: 'ghost-id' }, { id: 'q2' }],
      idx: 1,
      correctCount: 1,
      startTime: Date.now(),
      mode: 'quick',
      isWrongBookQuiz: false
    });
    assert.strictEqual(App.tryResumeSession(), true);
    assert.strictEqual(App.state.quiz.length, 2, '跳过 ghost-id');
    assert.strictEqual(App.state.quiz[0].id, 'q1');
    assert.strictEqual(App.state.quiz[1].id, 'q2');
    assert.strictEqual(App.state.idx, 1, 'idx 保留');
  });
});

test('tryResumeSession：所有 quizIds 都找不到时返回 false', () => {
  return withQuizDOM(async () => {
    await freshApp();
    const App = loadAll();
    App.session.save({
      quiz: [{ id: 'ghost-1' }, { id: 'ghost-2' }],
      idx: 0,
      correctCount: 0,
      startTime: Date.now(),
      mode: 'quick',
      isWrongBookQuiz: false
    });
    assert.strictEqual(App.tryResumeSession(), false);
  });
});

test('tryResumeSession：正常恢复后 state 与保存值一致', () => {
  return withQuizDOM(async () => {
    await freshApp();
    const App = loadAll();
    const before = Date.now();
    App.session.save({
      quiz: [{ id: 'q1' }, { id: 'q2' }],
      idx: 1,
      correctCount: 1,
      startTime: before - 5000, // 5 秒前开始
      mode: 'standard',
      isWrongBookQuiz: false
    });
    assert.strictEqual(App.tryResumeSession(), true);
    assert.strictEqual(App.state.idx, 1);
    assert.strictEqual(App.state.correctCount, 1);
    assert.strictEqual(App.state.mode, 'standard');
    // 计时起点被回拨：现在 startTime + 5s 应近似 Date.now()
    const drift = Math.abs((Date.now() - App.state.startTime) - 5000);
    assert.ok(drift < 200, `应保留 5s 计时，drift=${drift}ms`);
  });
});

// === quitQuiz ===

test('quitQuiz：清空 sessionStorage，state 保留', () => {
  return withQuizDOM(async () => {
    await freshApp();
    const App = loadAll();
    App.startRandomQuiz();
    App.session.save(App.state);
    assert.ok(App.session.load(), 'precondition: session 已存');
    App.quitQuiz();
    assert.strictEqual(App.session.load(), null, 'sessionStorage 应被清空');
  });
});
