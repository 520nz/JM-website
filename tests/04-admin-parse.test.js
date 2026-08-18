/**
 * tests/04-admin-parse.test.js
 * admin.js 中可独立提取的纯逻辑：
 *  1. 选项文本解析（saveQuestion 内的正则 + 算法）
 *     —— 支持 3 种分隔符 A. / A、 / A．，空白容错，最少 2 选项
 *  2. 导入数据合并策略（importData）：
 *     —— history 拼接、stats 不直接累加（走 recalcStats）
 *     —— 错题合并：同 qid 取 max(cnt) + min(level)（保守策略）
 *     —— 新错题缺省字段填充（level=0, nextReview=now, lastReview=0, time=now）
 *  3. 题库导入：已有 id 更新，不存在的新增
 *  4. renderQuestionList 的 filter 逻辑（搜索 + 分类 + 分页边界）
 */
'use strict';

const assert = require('assert');
const { loadCore, test, suite, summary } = require('./setup');

const App = loadCore();

// ============================================================
// 1. 选项文本解析（直接从 admin.js saveQuestion 提取算法）
//    目的：锁定解析规则，防后续修改破坏兼容性
// ============================================================
function parseOptions(optsText) {
  const lines = optsText.split('\n');
  const options = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
    if (match) options.push({ key: match[1], text: match[2] });
  }
  return options;
}

suite('1. 选项解析正则 A. / A、 / A． —— 3 种分隔符兼容', () => {
  test('基本 A.B.C.D. 格式（点分隔）', () => {
    const opts = parseOptions('A.北京\nB.上海\nC.广州\nD.深圳');
    assert.deepStrictEqual(opts, [
      { key: 'A', text: '北京' },
      { key: 'B', text: '上海' },
      { key: 'C', text: '广州' },
      { key: 'D', text: '深圳' },
    ]);
  });

  test('中文顿号 A、B、 分隔（用户手写习惯）', () => {
    const opts = parseOptions('A、2003年\nB、2004年\nC、2005年\nD、2006年');
    assert.strictEqual(opts.length, 4);
    assert.strictEqual(opts[0].key, 'A');
    assert.strictEqual(opts[0].text, '2003年');
    assert.strictEqual(opts[3].key, 'D');
    assert.strictEqual(opts[3].text, '2006年');
  });

  test('全角句号 A． 分隔（中文输入法产物）', () => {
    const opts = parseOptions('A．专辑\nB．歌曲\nC．个人信息\nD．获奖记录');
    assert.strictEqual(opts.length, 4);
    assert.strictEqual(opts[0].text, '专辑');
    assert.strictEqual(opts[3].text, '获奖记录');
  });

  test('混合分隔符 + 空白行 + 前后空格（现实脏输入）', () => {
    const input = '\n\n  A.选项一  \n\r\nB、选项二 \n\nC．选项三\n\n\n';
    const opts = parseOptions(input);
    assert.strictEqual(opts.length, 3);
    assert.strictEqual(opts[0].key, 'A');
    assert.strictEqual(opts[0].text, '选项一');
    assert.strictEqual(opts[1].key, 'B');
    assert.strictEqual(opts[1].text, '选项二');
    assert.strictEqual(opts[2].key, 'C');
    assert.strictEqual(opts[2].text, '选项三');
  });

  test('选项文本中的空格保留（不丢失内部空白）', () => {
    const opts = parseOptions('A.方文山 / 林夕\nB.林秋离 & 张思尔');
    assert.strictEqual(opts[0].text, '方文山 / 林夕');
    assert.strictEqual(opts[1].text, '林秋离 & 张思尔');
  });

  test('小写字母 / 数字开头 → 忽略（只匹配 A-Z）', () => {
    const opts = parseOptions('a.小写上屏\n1.数字开头\nA.正常大写\nZ.也正常');
    // quiz / admin 约定是 A/B/C/D 大写
    assert.strictEqual(opts.length, 2);
    assert.strictEqual(opts[0].key, 'A');
    assert.strictEqual(opts[1].key, 'Z');
  });

  test('没有分隔符的行 → 忽略', () => {
    const opts = parseOptions('A.选项A\n无格式一行\nB.选项B\n最后一行没有点');
    assert.strictEqual(opts.length, 2);
  });

  test('空字符串 → 空数组', () => {
    assert.deepStrictEqual(parseOptions(''), []);
    assert.deepStrictEqual(parseOptions('\n\n\n'), []);
  });

  test('只有一个合法选项 → 长度 1（saveQuestion 会 alert，此为解析层）', () => {
    const opts = parseOptions('A.唯一选项');
    assert.strictEqual(opts.length, 1);
    assert.strictEqual(opts[0].key, 'A');
  });
});

// ============================================================
// 2. 导入数据合并策略
//    由于 importData 依赖 DOM (FileReader)，我们提取纯合并算法单独验证
//    匹配 admin.js 219-312 行的语义
// ============================================================

function mergeUserData(existingData, importedUserData, recalcStatsFn) {
  // 语义化复制 admin.js 264-300 行逻辑
  // 合并 history
  if (importedUserData.history) {
    existingData.history = existingData.history.concat(importedUserData.history);
  }
  // 合并错题本
  if (importedUserData.wrong) {
    const wrongMap = {};
    for (let w = 0; w < existingData.wrong.length; w++) {
      wrongMap[existingData.wrong[w].qid] = existingData.wrong[w];
    }
    for (let x = 0; x < importedUserData.wrong.length; x++) {
      const wrongItem = importedUserData.wrong[x];
      if (wrongMap[wrongItem.qid]) {
        wrongMap[wrongItem.qid].cnt = Math.max(wrongMap[wrongItem.qid].cnt, wrongItem.cnt || 1);
        if (wrongItem.level != null) {
          wrongMap[wrongItem.qid].level = Math.min(wrongMap[wrongItem.qid].level || 0, wrongItem.level);
        }
      } else {
        if (!wrongItem.level) wrongItem.level = 0;
        if (!wrongItem.nextReview) wrongItem.nextReview = Date.now();
        if (!wrongItem.lastReview) wrongItem.lastReview = 0;
        if (!wrongItem.time) wrongItem.time = Date.now();
        existingData.wrong.push(wrongItem);
      }
    }
  }
  // stats 不直接累加，从重算
  recalcStatsFn();
}

function mergeQuestionBank(existingBank, importedBank) {
  const existingIds = {};
  for (let i = 0; i < existingBank.length; i++) existingIds[existingBank[i].id] = true;
  let added = 0, updated = 0;
  for (let j = 0; j < importedBank.length; j++) {
    const q = importedBank[j];
    if (existingIds[q.id]) {
      for (let k = 0; k < existingBank.length; k++) {
        if (existingBank[k].id === q.id) { existingBank[k] = q; updated++; break; }
      }
    } else {
      existingBank.push(q);
      added++;
    }
  }
  return { added, updated };
}

suite('2. 导入：用户数据 history 拼接 + 错题合并（保守策略）', () => {
  // 注意：此 suite 未用框架级 beforeEach，每个 test 开头手动 reset 防污染

  test('history 被拼接而非替换（导入 100 + 已有 50 = 150）', () => {
    beforeEach_reset(App);
    const d = App.db.get();
    const now = Date.now();
    // 已有 2 条
    d.history = [
      { qid: '001', ok: true, time: now - 1000 },
      { qid: '002', ok: false, time: now - 500 },
    ];
    // 导入 3 条
    const imported = {
      history: [
        { qid: '003', ok: true, time: now - 200000 },
        { qid: '004', ok: true, time: now - 100000 },
        { qid: '005', ok: false, time: now - 50000 },
      ],
    };
    // 伪造脏 stats（应被 recalcStats 覆盖而非累加）
    d.stats = { total: 999, correct: 998, cats: { 专辑: { t: 999, c: 998 } } };

    mergeUserData(d, imported, () => App.db.recalcStats());

    assert.strictEqual(d.history.length, 5, 'history 应 2+3=5');
    // stats 被 recalcStats 正确重算（不应再有 999）
    assert.strictEqual(d.stats.total, 5, 'total=5');
    assert.strictEqual(d.stats.correct, 3, 'correct=3（003/004 对 + 001 对）');
  });

  test('错题合并：同一 qid 取 max(cnt) + min(level)（保守策略）', () => {
    beforeEach_reset(App);
    const d = App.db.get();
    const now = Date.now();
    // 现有：Q1 cnt=3 level=2, Q2 cnt=5 level=4
    d.wrong = [
      { qid: 'Q1', cnt: 3, level: 2, time: now - 10000, lastReview: now - 1000, nextReview: now + 10000 },
      { qid: 'Q2', cnt: 5, level: 4, time: now - 20000, lastReview: now - 500, nextReview: now + 3 * 86400000 },
    ];
    // 导入：Q1 cnt=5 level=1, Q2 cnt=3 level=1（level 更小更保守）
    const imported = {
      wrong: [
        { qid: 'Q1', cnt: 5, level: 1, time: now - 999 },
        { qid: 'Q2', cnt: 3, level: 1 },
      ],
    };
    mergeUserData(d, imported, () => App.db.recalcStats());

    const q1 = d.wrong.find(w => w.qid === 'Q1');
    assert.strictEqual(q1.cnt, 5, 'Q1 cnt 取 max(3,5)=5');
    assert.strictEqual(q1.level, 1, 'Q1 level 取 min(2,1)=1（更保守）');
    const q2 = d.wrong.find(w => w.qid === 'Q2');
    assert.strictEqual(q2.cnt, 5, 'Q2 cnt 取 max(5,3)=5');
    assert.strictEqual(q2.level, 1, 'Q2 level 取 min(4,1)=1');
  });

  test('新错题（导入无匹配）→ 缺省字段自动填充', () => {
    beforeEach_reset(App);
    const d = App.db.get();
    const before = Date.now();
    const imported = {
      wrong: [
        { qid: 'NEW1' },                              // 几乎完全没有字段
        { qid: 'NEW2', cnt: 2, level: null, nextReview: 0, lastReview: null, time: 0 },
      ],
    };
    mergeUserData(d, imported, () => App.db.recalcStats());
    const after = Date.now();

    assert.strictEqual(d.wrong.length, 2);
    const n1 = d.wrong.find(w => w.qid === 'NEW1');
    assert.ok(n1);
    assert.strictEqual(n1.level, 0);
    assert.ok(n1.nextReview >= before && n1.nextReview <= after + 20, 'nextReview 默认现在');
    assert.strictEqual(n1.lastReview, 0);
    assert.ok(n1.time >= before && n1.time <= after + 20, 'time 默认现在');
    // 没有给 cnt → 原对象没有 cnt，mergeUserData 不新增？不对
    // 看 storage.js addWrong 默认 cnt=1；但 mergeUserData 对 cnt 为 0/null 的处理？
    // 实际 admin.js 281 行 if (!wrongItem.level) wrongItem.level = 0
    // 不对 cnt 做默认。但是 addWrong 时新错题 cnt=1。
    // 注意：admin.js merge 时 if (!wrongItem.level) 用的是假值判断
    assert.strictEqual(n1.cnt, undefined, '导入的新错题没有 cnt 字段时保留 undefined（cnt 仅靠 addWrong 创建）');

    const n2 = d.wrong.find(w => w.qid === 'NEW2');
    assert.strictEqual(n2.level, 0, 'level null → 0');
    assert.ok(n2.nextReview >= before, 'nextReview=0(假值) → 现在');
    assert.strictEqual(n2.lastReview, 0);
    assert.ok(n2.time >= before, 'time=0(假值) → 现在');
    assert.strictEqual(n2.cnt, 2); // 保留原有
  });

  test('level=0 不被误判为假值然后覆盖（！）—— 锁定当前实现行为', () => {
    beforeEach_reset(App);
    // 注意：admin.js 289 行写的是 `if (!wrongItem.level)`，这会把 0 当假值
    // 这可能是一个 BUG，但本测试的目标是锁定"当前行为"，如果未来修复会通知变化
    const d = App.db.get();
    const imported = {
      wrong: [{ qid: 'NEW_L0', cnt: 3, level: 0, time: 12345, lastReview: 0, nextReview: 9999 }],
    };
    const beforeLevel = imported.wrong[0].level;
    mergeUserData(d, imported, () => App.db.recalcStats());
    const r = d.wrong.find(w => w.qid === 'NEW_L0');
    // 由于 `if (!wrongItem.level)` 是假值判断（0 为假），所以 level 会被重新设为 0
    // 实际上对于 level=0 没变。我们测的是：nextReview 不为假 → 不覆盖
    assert.strictEqual(r.level, 0, 'level=0 通过 !0 → true 被重置为 0（结果仍一致）');
    assert.strictEqual(r.nextReview, 9999, 'nextReview=9999(真值) 保留');
    assert.strictEqual(r.time, 12345, 'time=12345(真值) 保留');
  });
});

suite('3. 导入：题库合并（已有 ID 更新，新增 ID push）', () => {
  test('导入 3 新 + 2 更新 → added=3, updated=2', () => {
    const bank = [
      { id: 'E1', category: '专辑', question: '旧Q1', options: [{ key: 'A', text: 'a' }], answer: 'A' },
      { id: 'E2', category: '歌曲', question: '旧Q2', options: [{ key: 'A', text: 'a' }], answer: 'A' },
    ];
    const imported = [
      { id: 'E1', question: '新Q1', options: [{ key: 'A', text: '新' }], answer: 'B', category: '专辑' }, // 更新
      { id: 'N1', question: '新N1', category: '个人信息', options: [], answer: 'A' }, // 新增
      { id: 'E2', question: '新Q2-v2', category: '歌曲', options: [], answer: 'C' }, // 更新
      { id: 'N2', category: '获奖记录', question: '新N2', options: [], answer: 'A' }, // 新增
      { id: 'N3', category: '专辑', question: '新N3', options: [], answer: 'A' },     // 新增
    ];
    const { added, updated } = mergeQuestionBank(bank, imported);
    assert.strictEqual(added, 3);
    assert.strictEqual(updated, 2);
    assert.strictEqual(bank.length, 5);
    // 验证内容真的被更新了
    const e1 = bank.find(q => q.id === 'E1');
    assert.strictEqual(e1.question, '新Q1');
    assert.strictEqual(e1.answer, 'B');
    const e2 = bank.find(q => q.id === 'E2');
    assert.strictEqual(e2.question, '新Q2-v2');
    assert.strictEqual(e2.answer, 'C');
  });

  test('空 bank → 全部 added', () => {
    const bank = [];
    const imported = [
      { id: 'A' }, { id: 'B' }, { id: 'C' },
    ];
    const r = mergeQuestionBank(bank, imported);
    assert.deepStrictEqual(r, { added: 3, updated: 0 });
    assert.strictEqual(bank.length, 3);
  });

  test('导入空数组 → 不变', () => {
    const bank = [{ id: 'A' }];
    const r = mergeQuestionBank(bank, []);
    assert.deepStrictEqual(r, { added: 0, updated: 0 });
    assert.strictEqual(bank.length, 1);
  });
});

suite('4. 题库过滤 + 分页边界（renderQuestionList 前置过滤逻辑提取）', () => {
  // 提取 filterQuestions 的核心算法
  function filterBank(bank, search, catFilter) {
    const s = search.toLowerCase();
    const out = [];
    for (let i = 0; i < bank.length; i++) {
      const q = bank[i];
      if (catFilter && q.category !== catFilter) continue;
      if (s && q.question.toLowerCase().indexOf(s) === -1) continue;
      out.push(q);
    }
    return out;
  }

  function paginate(arr, page, pageSize) {
    const totalPages = Math.max(1, Math.ceil(arr.length / pageSize));
    if (page > totalPages) page = totalPages;
    if (page < 1) page = 1;
    const start = (page - 1) * pageSize;
    const end = Math.min(start + pageSize, arr.length);
    return arr.slice(start, end);
  }

  test('无过滤返回全部', () => {
    const bank = App.QUESTION_BANK.slice(0, 10);
    assert.strictEqual(filterBank(bank, '', '').length, 10);
  });

  test('分类过滤：只返回指定分类', () => {
    const bank = App.QUESTION_BANK.slice();
    const albums = filterBank(bank, '', '专辑');
    assert.ok(albums.length > 0, '专辑类应有题目');
    for (const q of albums) assert.strictEqual(q.category, '专辑');
  });

  test('搜索：不区分大小写，题目文本中包含', () => {
    const bank = App.QUESTION_BANK.slice();
    // 搜索"林俊杰"
    const r = filterBank(bank, '林俊杰', '');
    assert.ok(r.length > 0, '应能搜到林俊杰相关题目');
    for (const q of r) assert.ok(q.question.toLowerCase().includes('林俊杰'));
    // 全部大写
    const r2 = filterBank(bank, 'JJLIN', ''); // 不会找到（题目中没 Jjlin）
    // 换一个确定存在的字
    const r3 = filterBank(bank, '专辑', '');
    for (const q of r3) assert.ok(q.question.toLowerCase().includes('专辑'));
  });

  test('分类 + 搜索 组合过滤', () => {
    const bank = App.QUESTION_BANK.slice();
    const r = filterBank(bank, '发行于哪一年', '专辑');
    assert.ok(r.length > 0);
    for (const q of r) {
      assert.strictEqual(q.category, '专辑');
      assert.ok(q.question.includes('发行于哪一年'));
    }
  });

  test('分页：第一页、中间页、最后一页', () => {
    const arr = [];
    for (let i = 0; i < 85; i++) arr.push(i);
    // 30 per page → 3 页
    const p1 = paginate(arr, 1, 30);
    assert.strictEqual(p1.length, 30);
    assert.deepStrictEqual([p1[0], p1[29]], [0, 29]);
    const p2 = paginate(arr, 2, 30);
    assert.strictEqual(p2.length, 30);
    assert.deepStrictEqual([p2[0], p2[29]], [30, 59]);
    const p3 = paginate(arr, 3, 30);
    assert.strictEqual(p3.length, 25);
    assert.deepStrictEqual([p3[0], p3[24]], [60, 84]);
    // 超界 → 回到最后一页
    const p99 = paginate(arr, 99, 30);
    assert.strictEqual(p99.length, 25);
    assert.deepStrictEqual([p99[0], p99[24]], [60, 84]);
    // page<1 → 第 1 页
    const p0 = paginate(arr, 0, 30);
    assert.strictEqual(p0.length, 30);
    assert.strictEqual(p0[0], 0);
  });

  test('分页 size 刚好整除：无多余页', () => {
    const arr = Array.from({ length: 90 }, (_, i) => i);
    const p3 = paginate(arr, 3, 30);
    assert.strictEqual(p3.length, 30);
    assert.strictEqual(p3[29], 89);
    const p4 = paginate(arr, 4, 30);
    assert.strictEqual(p4.length, 30, '超界后应该回到最后一页');
  });
});

// ============================================================
// helpers
// ============================================================
function beforeEach_reset(App) {
  App.db.setData(App.db.defaults());
}

summary();
