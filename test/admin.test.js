// 题库管理 + 数据导入导出 回归测试
//
// 覆盖 admin.js 中：
//   - 选项解析正则（. / 、 / ． 三种分隔符）
//   - importData JSON 解析、题库合并、错题本合并、stats 重算
//   - 缺字段补全（间隔重复字段）
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { freshApp, loadAdmin, QUESTION_BANK } = require('./helpers');

// 模拟全局 DOM：给 admin.js 访问的 getElementById/setAttribute 提供桩
function withDOM(fn) {
  const elements = new Map();
  const orig = {
    getElementById: global.document.getElementById,
    querySelector: global.document.querySelector,
    querySelectorAll: global.document.querySelectorAll
  };
  global.document.getElementById = (id) => {
    if (!elements.has(id)) {
      elements.set(id, {
        id, value: '', innerHTML: '', textContent: '',
        style: {}, classList: { add(){}, remove(){}, contains(){return false;} },
        setAttribute(k,v){this[k]=v;}, getAttribute(k){return this[k];}
      });
    }
    return elements.get(id);
  };
  global.document.querySelector = () => null;
  global.document.querySelectorAll = () => [];
  try { return fn(elements); } finally {
    global.document.getElementById = orig.getElementById;
    global.document.querySelector = orig.querySelector;
    global.document.querySelectorAll = orig.querySelectorAll;
  }
}
// 直接调用 saveQuestion 的内部逻辑，绕过 DOM 表单
// 注意：不重置 global.alert，让外层测试设置的 alert 回调生效；
// 也不消费返回值，由外层通过 alertMsg 闭包变量观察行为。
function invokeSaveQuestion(elements, App, fields) {
  // 先通过 getElementById 让 withDOM 的 mock 把元素加入 elements Map
  ['editId', 'editCategory', 'editQuestion', 'editOptions', 'editAnswer', 'editExplanation']
    .forEach(id => { global.document.getElementById(id); });
  // 然后设置 value
  ['editId', 'editCategory', 'editQuestion', 'editOptions', 'editAnswer', 'editExplanation']
    .forEach(id => { elements.get(id).value = fields[id] || ''; });
  App.saveQuestion();
}
test('选项解析：A. xxx（半角点）', async () => {
  await freshApp();
  const App = loadAdmin();
  withDOM((elements) => {
    invokeSaveQuestion(elements, App, {
      editId: '',
      editCategory: '专辑',
      editQuestion: '测试题',
      editOptions: 'A. 选项一\nB. 选项二\nC. 选项三',
      editAnswer: 'A',
      editExplanation: '解析'
    });
  });
  // 应追加到 QUESTION_BANK
  const last = App.QUESTION_BANK[App.QUESTION_BANK.length - 1];
  assert.strictEqual(last.question, '测试题');
  assert.deepStrictEqual(last.options.map(o => o.key), ['A', 'B', 'C']);
  assert.strictEqual(last.options[0].text, '选项一');
  assert.strictEqual(last.options[2].text, '选项三');
  assert.strictEqual(last.answer, 'A');
});
test('选项解析：A、xxx（全角顿号）', async () => {
  await freshApp();
  const App = loadAdmin();
  withDOM((elements) => {
    invokeSaveQuestion(elements, App, {
      editCategory: '专辑',
      editQuestion: 'Q',
      editOptions: 'A、第一\nB、第二',
      editAnswer: 'A',
      editExplanation: ''
    });
  });
  const last = App.QUESTION_BANK[App.QUESTION_BANK.length - 1];
  assert.deepStrictEqual(last.options.map(o => ({ k: o.key, t: o.text })), [
    { k: 'A', t: '第一' },
    { k: 'B', t: '第二' }
  ]);
});

test('选项解析：A．xxx（全角点）', async () => {
  await freshApp();
  const App = loadAdmin();
  withDOM((elements) => {
    invokeSaveQuestion(elements, App, {
      editCategory: '专辑',
      editQuestion: 'Q',
      editOptions: 'A．选项甲\nB．选项乙',
      editAnswer: 'A',
      editExplanation: ''
    });
  });
  const last = App.QUESTION_BANK[App.QUESTION_BANK.length - 1];
  assert.deepStrictEqual(last.options.map(o => o.text), ['选项甲', '选项乙']);
});

test('选项解析：少于 2 个有效选项时拒绝保存', async () => {
  await freshApp();
  const App = loadAdmin();
  const before = App.QUESTION_BANK.length;
  let alertMsg;
  withDOM((elements) => {
    global.alert = (m) => { alertMsg = m; };
    invokeSaveQuestion(elements, App, {
      editCategory: '专辑',
      editQuestion: 'Q',
      editOptions: 'A. 唯一选项',
      editAnswer: 'A',
      editExplanation: ''
    });
  });
  assert.ok(alertMsg && /至少/.test(alertMsg), '应弹出"至少两个选项"提示');
  assert.strictEqual(App.QUESTION_BANK.length, before, '未保存');
});

test('选项解析：空题目/空选项拒绝保存', async () => {
  await freshApp();
  const App = loadAdmin();
  let alertMsg;
  withDOM((elements) => {
    global.alert = (m) => { alertMsg = m; };
    invokeSaveQuestion(elements, App, {
      editCategory: '专辑',
      editQuestion: '',
      editOptions: 'A. x\nB. y',
      editAnswer: 'A',
      editExplanation: ''
    });
  });
  assert.ok(alertMsg && /题目/.test(alertMsg), '应提示填写题目');
});

test('编辑现有题目：覆盖而非新增', async () => {
  await freshApp();
  const App = loadAdmin();
  const before = App.QUESTION_BANK.length;
  const target = App.QUESTION_BANK[0];
  withDOM((elements) => {
    invokeSaveQuestion(elements, App, {
      editId: target.id,
      editCategory: target.category,
      editQuestion: '修改后',
      editOptions: 'A. 新A\nB. 新B',
      editAnswer: 'B',
      editExplanation: '新解析'
    });
  });
  assert.strictEqual(App.QUESTION_BANK.length, before, '编辑不增加条目');
  const updated = App.QUESTION_BANK.find(q => q.id === target.id);
  assert.strictEqual(updated.question, '修改后');
  assert.strictEqual(updated.answer, 'B');
  assert.strictEqual(updated.options[1].text, '新B');
});

test('importData：解析失败时弹错不修改数据', async () => {
  await freshApp();
  const App = loadAdmin();
  let alertMsg;
  withDOM(() => {
    global.alert = (m) => { alertMsg = m; };
    // 触发 onload
    const ev = { target: { files: [{ _text: 'not-json' }], value: 'old' } };
    App.importData(ev);
  });
  // FileReader.onload 是异步
  await new Promise(r => setTimeout(r, 50));
  assert.ok(alertMsg && /格式不正确/.test(alertMsg), '应弹"格式不正确"');
});

test('importData：缺少 questionBank/userData 视为无效', async () => {
  await freshApp();
  const App = loadAdmin();
  let alertMsg;
  withDOM(() => {
    global.alert = (m) => { alertMsg = m; };
    const ev = { target: { files: [{ _text: '{"foo": 1}' }], value: '' } };
    App.importData(ev);
  });
  await new Promise(r => setTimeout(r, 50));
  assert.ok(alertMsg && /未找到有效数据/.test(alertMsg), '应弹"未找到有效数据"');
});

test('importData：合并题库（按 id 去重更新/新增）', async () => {
  await freshApp();
  const App = loadAdmin();
  const before = App.QUESTION_BANK.length;
  const existingId = App.QUESTION_BANK[0].id;
  const importData = {
    questionBank: [
      { id: existingId, category: '专辑', question: '已存在被更新', options: [{key:'A',text:'a'},{key:'B',text:'b'}], answer: 'A', explanation: 'updated' },
      { id: 'new-imported-001', category: '歌曲', question: '新导入', options: [{key:'A',text:'a'},{key:'B',text:'b'}], answer: 'B', explanation: '' }
    ],
    userData: { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } }
  };
  let alertMsg;
  withDOM(() => {
    global.alert = (m) => { alertMsg = m; };
    const ev = { target: { files: [{ _text: JSON.stringify(importData) }], value: '' } };
    App.importData(ev);
  });
  await new Promise(r => setTimeout(r, 50));
  assert.strictEqual(App.QUESTION_BANK.length, before + 1, '新增 1 道题');
  const updated = App.QUESTION_BANK.find(q => q.id === existingId);
  assert.strictEqual(updated.question, '已存在被更新');
  const added = App.QUESTION_BANK.find(q => q.id === 'new-imported-001');
  assert.ok(added, '应包含新导入题');
  assert.ok(alertMsg && /新增\s*1/.test(alertMsg), '应报告新增 1 道');
});

test('importData：错题本合并——Math.max(cnt)、Math.min(level)、缺字段补全', async () => {
  await freshApp();
  const App = loadAdmin();
  // 本地已有错题：q1 cnt=2 level=3
  App.db.addWrong('q1');
  App.db.reviewCorrect('q1'); // level 1
  App.db.reviewCorrect('q1'); // level 2
  App.db.reviewCorrect('q1'); // level 3
  let local = App.db.getWrong().find(w => w.qid === 'q1');
  assert.strictEqual(local.cnt, 1, 'sanity: local cnt=1');
  assert.strictEqual(local.level, 3);

  // 导入的错题：q1 cnt=5 level=2（更低），q2 无 level/nextReview
  const importData = {
    questionBank: [],
    userData: {
      history: [],
      wrong: [
        { qid: 'q1', cnt: 5, level: 2 },
        { qid: 'q2' }  // 缺字段
      ],
      stats: { total: 10, correct: 9, cats: {} }
    }
  };
  withDOM(() => {
    global.alert = () => {};
    const ev = { target: { files: [{ _text: JSON.stringify(importData) }], value: '' } };
    App.importData(ev);
  });
  await new Promise(r => setTimeout(r, 50));
  const all = App.db.getWrong();
  const q1 = all.find(w => w.qid === 'q1');
  const q2 = all.find(w => w.qid === 'q2');
  assert.ok(q1, 'q1 应仍在');
  assert.strictEqual(q1.cnt, 5, '取 max(local 1, import 5) = 5');
  assert.strictEqual(q1.level, 2, '取 min(local 3, import 2) = 2（更保守）');
  assert.ok(q2, 'q2 应被添加');
  assert.strictEqual(q2.level, 0, '缺 level 补 0');
  assert.ok(q2.nextReview, '缺 nextReview 补当前时间');
  assert.ok(q2.time, '缺 time 字段补全');
});

test('importData：错题 history 直接拼接然后 recalcStats（不累加 stats）', async () => {
  await freshApp();
  const App = loadAdmin();
  // 本地 0 题
  const importData = {
    questionBank: [],
    userData: {
      history: [
        { qid: 'q1', ok: true, time: Date.now() },
        { qid: 'q1', ok: false, time: Date.now() },
        { qid: 'q1', ok: true, time: Date.now() }
      ],
      wrong: [],
      stats: { total: 999, correct: 999, cats: {} }  // 故意错误
    }
  };
  withDOM(() => {
    global.alert = () => {};
    const ev = { target: { files: [{ _text: JSON.stringify(importData) }], value: '' } };
    App.importData(ev);
  });
  await new Promise(r => setTimeout(r, 50));
  const d = App.db.get();
  assert.strictEqual(d.stats.total, 3, '应从 history 重算，不是 999 或 999+3');
  assert.strictEqual(d.stats.correct, 2);
  assert.strictEqual(d.history.length, 3);
});

test('importData：导出的 JSON 再次导入可往返（round-trip）', async () => {
  await freshApp();
  const App = loadAdmin();
  // 添加一些状态
  App.db.addRecord({ qid: 'q1', ok: true, time: Date.now() });
  App.db.addWrong('q1');
  // 模拟 exportData 内部 JSON 序列化
  const exported = JSON.stringify({
    questionBank: App.QUESTION_BANK,
    userData: App.db.get(),
    exportTime: new Date().toISOString()
  });
  // 模拟"另一台设备"：import 前清空本地内存缓存，
  // 避免 importData 合并 history 时把本地与快照叠加
  App.db.setData(App.db.defaults());
  withDOM(() => {
    global.alert = () => {};
    const ev = { target: { files: [{ _text: exported }], value: '' } };
    App.importData(ev);
  });
  await new Promise(r => setTimeout(r, 50));
  // 往返后数据应一致
  const d = App.db.get();
  assert.strictEqual(d.stats.total, 1);
  assert.strictEqual(d.stats.correct, 1);
  assert.strictEqual(d.wrong.length, 1);
  assert.strictEqual(d.wrong[0].qid, 'q1');
});

test('deleteQuestion：按 id 删除并 persist', async () => {
  await freshApp();
  const App = loadAdmin();
  const before = App.QUESTION_BANK.length;
  const targetId = App.QUESTION_BANK[0].id;
  withDOM(() => {
    global.confirm = () => true;
    App.deleteQuestion(targetId);
  });
  assert.strictEqual(App.QUESTION_BANK.length, before - 1);
  assert.ok(!App.QUESTION_BANK.find(q => q.id === targetId));
});

test('deleteQuestion：用户取消则不删', async () => {
  await freshApp();
  const App = loadAdmin();
  const before = App.QUESTION_BANK.length;
  const targetId = App.QUESTION_BANK[0].id;
  withDOM(() => {
    global.confirm = () => false;
    App.deleteQuestion(targetId);
  });
  assert.strictEqual(App.QUESTION_BANK.length, before);
});

test('resetQuestionBank：恢复为默认题库', async () => {
  await freshApp();
  const App = loadAdmin();
  // 删除一道
  withDOM(() => {
    global.confirm = () => true;
    App.deleteQuestion(App.QUESTION_BANK[0].id);
  });
  const afterDelete = App.QUESTION_BANK.length;
  // 关闭重置确认弹窗
  withDOM(() => {
    App.closeResetModal();
    App.resetQuestionBank();
  });
  assert.ok(App.QUESTION_BANK.length >= afterDelete, 'reset 后题库应恢复到原大小或更大');
  // DEFAULT_QUESTION_BANK 来自 data.js
  assert.ok(App.QUESTION_BANK.length === 4 || App.QUESTION_BANK.length > afterDelete, '恢复后题目数正确');
});
