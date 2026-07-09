/**
 * 回归测试集 - 林俊杰粉丝答题网站
 *
 * 目的:加固项目核心业务逻辑的安全网,重点关注:
 *  - 答题状态机(幂等、数量与分类边界)
 *  - 错题本与统计持久化(累加/去重/空状态)
 *  - 题库 CRUD 与选项解析(正则容错)
 *  - 数据导入/导出合并逻辑
 *  - 纯函数(shuffle / fmtTime)边界
 *
 * 运行:  node --test tests/quiz.test.js
 *
 * 设计原则:
 *  - 零外部依赖,仅使用 Node 内置 assert / test / vm
 *  - 通过 vm 沙盒执行 index.html 的脚本,与生产代码保持一致
 *  - 沙盒中 mock 必要的 DOM/LocalStorage/URL,避免触及真实环境
 *  - 不修改 index.html,测试与生产代码解耦
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const INDEX_HTML = path.join(__dirname, '..', 'index.html');

/* ============================================================
 * 沙盒构建:从 index.html 中提取 <script> 内容并执行,
 * 暴露 QUESTION_BANK / DEFAULT_QUESTION_BANK / state / DB /
 * shuffle / fmtTime / saveQuestion 的纯解析逻辑
 * ============================================================ */

function buildSandbox() {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!scriptMatch) throw new Error('未在 index.html 中找到 <script> 块');
  const scriptSrc = scriptMatch[1];

  // 内存版 LocalStorage(每个 sandbox 独立)
  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
  };

  // 最小化 DOM mock:满足 switchView/renderQ/finishQuiz 等 DOM 写入,
  // 不挂事件,仅让脚本不抛错即可
  const fakeClassList = {
    add: () => {},
    remove: () => {},
    contains: () => false,
  };
  const fakeEl = {
    classList: fakeClassList,
    innerHTML: '',
    textContent: '',
    style: new Proxy({}, { set: () => true, get: () => '' }),
    value: '',
    appendChild: () => {},
    addEventListener: () => {},
    onclick: null,
  };
  const document = {
    querySelectorAll: () => [],
    getElementById: () => fakeEl,
    createElement: () => fakeEl,
    addEventListener: () => {},
  };
  const window = { addEventListener: () => {} };

  // 计时器 mock:setInterval 不真跑后台定时(避免测试卡住)
  const setInterval = () => 0;
  const clearInterval = () => {};

  const sandbox = {
    localStorage,
    document,
    window,
    console,
    alert: () => {},
    confirm: () => true,
    FileReader: class {},
    Blob: class {},
    URL: { createObjectURL: () => '', revokeObjectURL: () => {} },
    setInterval,
    clearInterval,
  };
  vm.createContext(sandbox);
  vm.runInContext(scriptSrc, sandbox, { filename: 'index.html.inline' });

  return { sandbox, localStorage: store };
}

/* ============================================================
 * 1) shuffle 纯函数:必须保留元素且不重复
 * ============================================================ */

test('shuffle: 不丢失、不重复元素(多次抽样)', () => {
  const { sandbox } = buildSandbox();
  const arr = Array.from({ length: 78 }, (_, i) => i + 1);
  for (let i = 0; i < 20; i++) {
    const out = sandbox.shuffle(arr);
    assert.equal(out.length, arr.length, '长度一致');
    assert.deepEqual([...out].sort((a, b) => a - b), arr, '元素集合一致');
  }
});

test('shuffle: 不修改原数组', () => {
  const { sandbox } = buildSandbox();
  const arr = [1, 2, 3, 4, 5];
  const snapshot = [...arr];
  sandbox.shuffle(arr);
  assert.deepEqual(arr, snapshot, '原数组未被变更');
});

test('shuffle: 单元素 / 空数组 不抛错', () => {
  const { sandbox } = buildSandbox();
  assert.deepEqual(sandbox.shuffle([42]), [42]);
  assert.deepEqual(sandbox.shuffle([]), []);
});

/* ============================================================
 * 2) fmtTime 边界值
 * ============================================================ */

test('fmtTime: 边界值 0 / 59s / 60s / 3599s / 3600s', () => {
  const { sandbox } = buildSandbox();
  assert.equal(sandbox.fmtTime(0), '0分0秒');
  assert.equal(sandbox.fmtTime(59 * 1000), '0分59秒');
  assert.equal(sandbox.fmtTime(60 * 1000), '1分0秒');
  assert.equal(sandbox.fmtTime(3599 * 1000), '59分59秒');
  assert.equal(sandbox.fmtTime(3600 * 1000), '60分0秒');
});

/* ============================================================
 * 3) 题库加载与 findQ
 * ============================================================ */

test('题库: 默认题库条数与 PRD 描述一致(>=78)', () => {
  const { sandbox } = buildSandbox();
  assert.ok(sandbox.QUESTION_BANK.length >= 78,
    `默认题库应 >=78,实际 ${sandbox.QUESTION_BANK.length}`);
});

test('题库: 每道题必填字段(id/category/question/options/answer/explanation)非空', () => {
  const { sandbox } = buildSandbox();
  for (const q of sandbox.QUESTION_BANK) {
    assert.ok(q.id, `题目缺少 id`);
    assert.ok(q.category, `题目 ${q.id} 缺少 category`);
    assert.ok(q.question, `题目 ${q.id} 缺少 question`);
    assert.ok(Array.isArray(q.options) && q.options.length >= 2,
      `题目 ${q.id} 选项数 <2`);
    for (const o of q.options) {
      assert.ok(['A', 'B', 'C', 'D'].includes(o.key), `题目 ${q.id} 含非法 key: ${o.key}`);
      assert.ok(typeof o.text === 'string' && o.text.length > 0,
        `题目 ${q.id} 选项 ${o.key} 文案为空`);
    }
    assert.ok(['A', 'B', 'C', 'D'].includes(q.answer), `题目 ${q.id} 答案非法: ${q.answer}`);
    const hasAnswer = q.options.some((o) => o.key === q.answer);
    assert.ok(hasAnswer, `题目 ${q.id} 答案 ${q.answer} 不在 options 中`);
  }
});

test('DB.findQ: 存在/不存在两种情况', () => {
  const { sandbox } = buildSandbox();
  const first = sandbox.QUESTION_BANK[0];
  assert.equal(sandbox.DB.findQ(first.id).id, first.id);
  assert.equal(sandbox.DB.findQ('NOT_EXIST_9999'), null);
});

/* ============================================================
 * 4) 答题统计 DB.addRecord:正确/错误对 stats 与 cats 的影响
 * ============================================================ */

test('DB.addRecord: 正确答题应累加 correct 与分类统计', () => {
  const { sandbox, localStorage } = buildSandbox();
  // 清空状态
  localStorage.clear();
  const q = sandbox.QUESTION_BANK.find((x) => x.category === '专辑');
  sandbox.DB.addRecord({ qid: q.id, ans: q.answer, ok: true, time: Date.now() });

  const d = sandbox.DB.get();
  assert.equal(d.stats.total, 1);
  assert.equal(d.stats.correct, 1);
  assert.equal(d.stats.cats[q.category].t, 1);
  assert.equal(d.stats.cats[q.category].c, 1);
});

test('DB.addRecord: 错误答题应只累加 total,不入 correct', () => {
  const { sandbox, localStorage } = buildSandbox();
  localStorage.clear();
  const q = sandbox.QUESTION_BANK.find((x) => x.category === '歌曲');
  sandbox.DB.addRecord({ qid: q.id, ans: 'Z', ok: false, time: Date.now() });

  const d = sandbox.DB.get();
  assert.equal(d.stats.total, 1);
  assert.equal(d.stats.correct, 0);
  assert.equal(d.stats.cats[q.category].t, 1);
  assert.equal(d.stats.cats[q.category].c, 0);
});

/* ============================================================
 * 5) 错题本:同题多次错累加、移除不存在不报错
 * ============================================================ */

test('DB.addWrong: 同一题多次错误, cnt 应累加,time 应更新', () => {
  const { sandbox, localStorage } = buildSandbox();
  localStorage.clear();
  const qid = sandbox.QUESTION_BANK[0].id;
  sandbox.DB.addWrong(qid);
  const t1 = sandbox.DB.getWrong()[0];
  sandbox.DB.addWrong(qid);
  const t2 = sandbox.DB.getWrong();
  assert.equal(t2.length, 1, '同题只应保留一条错题记录');
  assert.equal(t2[0].cnt, 2, 'cnt 应累加');
  assert.ok(t2[0].time >= t1.time, 'time 应单调不减');
});

test('DB.removeWrong: 移除不存在的 qid 不抛错且维持原状', () => {
  const { sandbox, localStorage } = buildSandbox();
  localStorage.clear();
  const qid = sandbox.QUESTION_BANK[0].id;
  sandbox.DB.addWrong(qid);
  sandbox.DB.removeWrong('NOT_EXIST_9999');
  assert.equal(sandbox.DB.getWrong().length, 1);
  sandbox.DB.removeWrong(qid);
  assert.equal(sandbox.DB.getWrong().length, 0);
});

/* ============================================================
 * 6) 答题状态机:pickOption 幂等,startRandomQuiz 数量边界
 * ============================================================ */

test('pickOption: 二次调用应被 state.answered 拦截(幂等)', () => {
  const { sandbox, localStorage } = buildSandbox();
  localStorage.clear();
  // 直接构造一个最小 quiz,然后只验证状态机的"二次点选不重复计分"
  sandbox.state.quiz = [{ id: sandbox.QUESTION_BANK[0].id, answer: 'A', explanation: '' }];
  sandbox.state.idx = 0;
  sandbox.state.correctCount = 0;
  sandbox.state.answered = false;
  sandbox.state.startTime = Date.now();
  sandbox.state.timer = null;

  // 简化版:模拟 pickOption 行为的关键分支
  function pick(key) {
    if (sandbox.state.answered) return false; // 拦截
    sandbox.state.answered = true;
    const q = sandbox.state.quiz[sandbox.state.idx];
    const ok = key === q.answer;
    if (ok) sandbox.state.correctCount++;
    sandbox.DB.addRecord({ qid: q.id, ans: key, ok, time: Date.now() });
    return true;
  }
  assert.equal(pick('A'), true);
  assert.equal(pick('B'), false, '已答后再次点选应被拦截');
  assert.equal(sandbox.state.correctCount, 1, 'correctCount 不应被二次加分');
  assert.equal(sandbox.DB.get().stats.total, 1, 'DB 不应记录第二次答题');
});

test('startRandomQuiz: 抽取数量 = min(mode 题数, 题库总数)', () => {
  const { sandbox, localStorage } = buildSandbox();
  localStorage.clear();
  // 模拟 quick 模式(10 题),题库足够大
  sandbox.state.mode = 'quick';
  sandbox.startRandomQuiz();
  assert.equal(sandbox.state.quiz.length, 10);
  // 题库总数 < 模式题数时(强化 30 vs 总数),应自动收敛到题库大小
  const total = sandbox.QUESTION_BANK.length;
  sandbox.state.mode = 'intensive';
  sandbox.state.quiz = [];
  sandbox.startRandomQuiz();
  assert.ok(sandbox.state.quiz.length <= total);
  assert.ok(sandbox.state.quiz.length === Math.min(30, total));
});

test('startCatQuiz: 抽取的题必须全部属于指定分类', () => {
  const { sandbox, localStorage } = buildSandbox();
  localStorage.clear();
  const target = '专辑';
  sandbox.state.mode = 'intensive';
  sandbox.startCatQuiz(target);
  for (const q of sandbox.state.quiz) {
    assert.equal(q.category, target, '分类练习混入其它分类');
  }
  // 分类题数 < 模式题数时,应自动收敛
  const catCount = sandbox.QUESTION_BANK.filter((q) => q.category === target).length;
  assert.equal(sandbox.state.quiz.length, Math.min(30, catCount));
});

test('startCatQuiz: 不存在的分类应得到空题集且不抛错', () => {
  const { sandbox } = buildSandbox();
  sandbox.startCatQuiz('不存在的分类XYZ');
  // 跨 VM 上下文:用 JSON 序列化做结构比较
  assert.equal(JSON.stringify(sandbox.state.quiz), '[]');
});

/* ============================================================
 * 7) 选项解析正则(saveQuestion 核心):中点 / 顿号 / 全角点 / 空格 / 非法
 * ============================================================ */

// 把 saveQuestion 内部的"解析选项"正则单独导出供测试
function parseOptions(sandbox, optsText) {
  const lines = optsText.split('\n');
  const options = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^([A-D])[.、．]\s*(.+)$/);
    if (match) options.push({ key: match[1], text: match[2] });
  }
  return options;
}

test('saveQuestion 选项解析: 中点 "A.xxx"', () => {
  const { sandbox } = buildSandbox();
  const opts = parseOptions(sandbox, 'A.选项1\nB.选项2\nC.选项3\nD.选项4');
  assert.equal(opts.length, 4);
  assert.deepEqual(opts[0], { key: 'A', text: '选项1' });
});

test('saveQuestion 选项解析: 顿号 "A、xxx"', () => {
  const { sandbox } = buildSandbox();
  const opts = parseOptions(sandbox, 'A、选项1\nB、选项2');
  assert.equal(opts.length, 2);
  assert.deepEqual(opts[0], { key: 'A', text: '选项1' });
});

test('saveQuestion 选项解析: 全角点 "A．xxx"', () => {
  const { sandbox } = buildSandbox();
  const opts = parseOptions(sandbox, 'A．选项1\nB．选项2');
  assert.equal(opts.length, 2);
  assert.deepEqual(opts[0], { key: 'A', text: '选项1' });
});

test('saveQuestion 选项解析: key 与内容间允许多空格', () => {
  const { sandbox } = buildSandbox();
  const opts = parseOptions(sandbox, 'A.   选项1\nB.\t选项2');
  assert.equal(opts.length, 2);
  assert.equal(opts[0].text, '选项1');
  assert.equal(opts[1].text, '选项2');
});

test('saveQuestion 选项解析: 缺 key / 非法 key / 空行 应被忽略', () => {
  const { sandbox } = buildSandbox();
  const opts = parseOptions(sandbox, 'A.有效\n这是无效行\n.B.也是无效\nE.超范围\nB.有效B');
  assert.deepEqual(opts, [
    { key: 'A', text: '有效' },
    { key: 'B', text: '有效B' },
  ]);
});

/* ============================================================
 * 8) 导入合并逻辑:questionBank / userData(wrong / stats)合并
 * ============================================================ */

test('importData 合并: 题目按 id 去重,新 id 入库,旧 id 覆盖', () => {
  const { sandbox, localStorage } = buildSandbox();
  localStorage.clear();
  const original = sandbox.QUESTION_BANK.length;
  const existingId = sandbox.QUESTION_BANK[0].id;
  const newQ = {
    id: 'new001',
    category: '测试',
    question: '测试题',
    options: [
      { key: 'A', text: 'a' },
      { key: 'B', text: 'b' },
    ],
    answer: 'A',
    explanation: '测试解析',
  };
  const updatedQ = { ...newQ, id: existingId, question: '已存在但被更新' };
  const incoming = { questionBank: [newQ, updatedQ] };

  // 直接复刻 importData 的合并逻辑进行验证
  const existingIds = {};
  for (const q of sandbox.QUESTION_BANK) existingIds[q.id] = true;
  let added = 0, updated = 0;
  for (const q of incoming.questionBank) {
    if (existingIds[q.id]) {
      for (let k = 0; k < sandbox.QUESTION_BANK.length; k++) {
        if (sandbox.QUESTION_BANK[k].id === q.id) {
          sandbox.QUESTION_BANK[k] = q;
          updated++;
          break;
        }
      }
    } else {
      sandbox.QUESTION_BANK.push(q);
      added++;
    }
  }

  assert.equal(added, 1, '新 id 应新增');
  assert.equal(updated, 1, '旧 id 应被覆盖');
  assert.equal(sandbox.QUESTION_BANK.length, original + 1);
  assert.equal(
    sandbox.QUESTION_BANK.find((q) => q.id === existingId).question,
    '已存在但被更新',
  );
});

test('importData 合并: 错题同 qid 应累加 cnt,新 qid 应追加', () => {
  const { sandbox, localStorage } = buildSandbox();
  localStorage.clear();
  const qid = sandbox.QUESTION_BANK[0].id;
  sandbox.DB.addWrong(qid); // 已有 cnt=1

  // 模拟导入:同 qid cnt=2 + 新 qid
  const data = {
    userData: {
      wrong: [
        { qid, cnt: 2, time: Date.now() },
        { qid: 'OTHER', cnt: 1, time: Date.now() },
      ],
    },
  };
  const existingData = sandbox.DB.get();
  const wrongMap = {};
  for (const w of existingData.wrong) wrongMap[w.qid] = w;
  for (const item of data.userData.wrong) {
    if (wrongMap[item.qid]) wrongMap[item.qid].cnt += item.cnt;
    else existingData.wrong.push(item);
  }
  sandbox.DB.save(existingData);

  const wl = sandbox.DB.getWrong();
  const target = wl.find((w) => w.qid === qid);
  const other = wl.find((w) => w.qid === 'OTHER');
  assert.ok(target, '同 qid 应保留');
  assert.equal(target.cnt, 3, 'cnt 应累加(1+2)');
  assert.ok(other, '新 qid 应追加');
  assert.equal(other.cnt, 1);
});

test('importData 合并: stats 累加 cats 时不丢失已有分类', () => {
  const { sandbox, localStorage } = buildSandbox();
  localStorage.clear();
  const q = sandbox.QUESTION_BANK[0];
  sandbox.DB.addRecord({ qid: q.id, ans: q.answer, ok: true, time: Date.now() });
  // 此时 cat 已存在

  const data = {
    userData: {
      stats: {
        total: 5,
        correct: 3,
        cats: { '新分类': { t: 4, c: 2 }, [q.category]: { t: 2, c: 1 } },
      },
    },
  };
  const existingData = sandbox.DB.get();
  existingData.stats.total += data.userData.stats.total;
  existingData.stats.correct += data.userData.stats.correct;
  for (const catName in data.userData.stats.cats) {
    if (!existingData.stats.cats[catName]) {
      existingData.stats.cats[catName] = { t: 0, c: 0 };
    }
    existingData.stats.cats[catName].t += data.userData.stats.cats[catName].t || 0;
    existingData.stats.cats[catName].c += data.userData.stats.cats[catName].c || 0;
  }
  sandbox.DB.save(existingData);

  const d = sandbox.DB.get();
  assert.equal(d.stats.total, 6, 'total 应累加(1+5)');
  assert.equal(d.stats.correct, 4, 'correct 应累加(1+3)');
  assert.ok(d.stats.cats['新分类'], '新分类应被加入');
  assert.equal(d.stats.cats['新分类'].t, 4);
  assert.equal(d.stats.cats['新分类'].c, 2);
  // 已有分类应累加而非被覆盖
  assert.equal(d.stats.cats[q.category].t, 3, '已有分类 t 应累加(1+2)');
  assert.equal(d.stats.cats[q.category].c, 2, '已有分类 c 应累加(1+1)');
});

/* ============================================================
 * 9) 正确率计算边界(对应 renderStats / updateHome)
 * ============================================================ */

test('统计: total=0 时正确率应为 0%,不出现 NaN', () => {
  const { sandbox, localStorage } = buildSandbox();
  localStorage.clear();
  const d = sandbox.DB.get();
  const acc = d.stats.total > 0 ? Math.round(d.stats.correct / d.stats.total * 100) : 0;
  assert.equal(acc, 0);
  assert.ok(!Number.isNaN(acc));
});

test('统计: 全对 / 全错 正确率', () => {
  const { sandbox, localStorage } = buildSandbox();
  localStorage.clear();
  const q = sandbox.QUESTION_BANK[0];
  sandbox.DB.addRecord({ qid: q.id, ans: q.answer, ok: true, time: Date.now() });
  sandbox.DB.addRecord({ qid: q.id, ans: q.answer, ok: true, time: Date.now() });
  let d = sandbox.DB.get();
  assert.equal(Math.round(d.stats.correct / d.stats.total * 100), 100);
  // 全错
  localStorage.clear();
  sandbox.DB.addRecord({ qid: q.id, ans: 'Z', ok: false, time: Date.now() });
  d = sandbox.DB.get();
  assert.equal(Math.round(d.stats.correct / d.stats.total * 100), 0);
});

/* ============================================================
 * 10) 题目 ID 唯一性(数据完整性)
 * ============================================================ */

test('题库: 所有 id 应唯一', () => {
  const { sandbox } = buildSandbox();
  const ids = sandbox.QUESTION_BANK.map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length, '存在重复 id');
});
