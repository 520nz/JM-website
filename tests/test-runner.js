/**
 * 林俊杰粉丝答题网站核心逻辑测试
 */

const { test, assertEqual, assertTrue, assertFalse, resetStorage, MockLocalStorage } = require('./test-framework');

// 从 index.html 提取的核心逻辑（需要适配 Node.js 环境）

// ===== 测试数据 =====
const SAMPLE_QUESTION = {
  id: "test001",
  category: "专辑",
  question: "测试题目",
  options: [
    { key: "A", text: "选项A" },
    { key: "B", text: "选项B" },
    { key: "C", text: "选项C" },
    { key: "D", text: "选项D" }
  ],
  answer: "B",
  explanation: "这是测试解析"
};

const SAMPLE_QUESTION_BANK = [
  SAMPLE_QUESTION,
  {
    id: "test002",
    category: "歌曲",
    question: "第二个测试题目",
    options: [
      { key: "A", text: "选项A" },
      { key: "B", text: "选项B" }
    ],
    answer: "A",
    explanation: "解析2"
  }
];

// ===== DB 模块模拟 =====
const DB_KEY = 'jj_quiz_v2';

function DB_defaults() {
  return { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } };
}

function DB_get() {
  const d = localStorage.getItem(DB_KEY);
  return d ? JSON.parse(d) : DB_defaults();
}

function DB_save(d) {
  localStorage.setItem(DB_KEY, JSON.stringify(d));
}

function DB_addRecord(rec, questionBank) {
  const d = DB_get();
  d.history.push(rec);
  d.stats.total++;
  if (rec.ok) d.stats.correct++;
  
  // 查找题目分类
  const q = DB_findQ(rec.qid, questionBank);
  if (q) {
    if (!d.stats.cats[q.category]) d.stats.cats[q.category] = { t: 0, c: 0 };
    d.stats.cats[q.category].t++;
    if (rec.ok) d.stats.cats[q.category].c++;
  }
  DB_save(d);
}

function DB_addWrong(qid) {
  const d = DB_get();
  let f = null;
  for (let i = 0; i < d.wrong.length; i++) {
    if (d.wrong[i].qid === qid) {
      f = d.wrong[i];
      break;
    }
  }
  if (f) {
    f.cnt++;
    f.time = Date.now();
  } else {
    d.wrong.push({ qid: qid, cnt: 1, time: Date.now() });
  }
  DB_save(d);
}

function DB_removeWrong(qid) {
  const d = DB_get();
  d.wrong = d.wrong.filter(function(w) { return w.qid !== qid; });
  DB_save(d);
}

function DB_findQ(qid, questionBank) {
  for (let i = 0; i < questionBank.length; i++) {
    if (questionBank[i].id === qid) return questionBank[i];
  }
  return null;
}

// ===== 选项解析逻辑 =====
function parseOptions(optsText) {
  const lines = optsText.split('\n');
  const options = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const match = line.match(/^([A-D])[.、．]\s*(.+)$/);
    if (match) {
      options.push({ key: match[1], text: match[2] });
    }
  }
  return options;
}

// ===== 数据导入逻辑 =====
function validateImportData(data) {
  if (!data.questionBank && !data.userData) {
    return { valid: false, error: '文件中未找到有效数据（questionBank 或 userData）' };
  }
  return { valid: true };
}

function mergeWrongData(existingWrong, newWrong) {
  const wrongMap = {};
  for (let w = 0; w < existingWrong.length; w++) {
    wrongMap[existingWrong[w].qid] = existingWrong[w];
  }
  for (let x = 0; x < newWrong.length; x++) {
    const wrongItem = newWrong[x];
    if (wrongMap[wrongItem.qid]) {
      wrongMap[wrongItem.qid].cnt += wrongItem.cnt;
    } else {
      existingWrong.push(wrongItem);
    }
  }
  return existingWrong;
}

// ===== 重置确认逻辑 =====
function checkResetInput(input) {
  return input === '恢复默认';
}

// ===== shuffle 函数 =====
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

// ===== 测试用例 =====

console.log('\n========== DB 模块测试 ==========\n');

test('DB_get - 空存储返回默认值', () => {
  resetStorage();
  const data = DB_get();
  assertEqual(data, DB_defaults(), '空存储应返回默认数据结构');
});

test('DB_save 和 DB_get - 正确保存和读取', () => {
  resetStorage();
  const testData = { history: [{ test: true }], wrong: [], stats: { total: 1, correct: 0, cats: {} } };
  DB_save(testData);
  const retrieved = DB_get();
  assertEqual(retrieved, testData, '保存后读取应一致');
});

test('DB_addRecord - 正确添加答题记录', () => {
  resetStorage();
  const rec = { qid: 'test001', ans: 'B', ok: true, time: Date.now() };
  DB_addRecord(rec, SAMPLE_QUESTION_BANK);
  const data = DB_get();
  
  assertEqual(data.history.length, 1, '历史记录应增加1条');
  assertEqual(data.stats.total, 1, '总答题数应为1');
  assertEqual(data.stats.correct, 1, '正确数应为1');
  assertEqual(data.stats.cats['专辑'], { t: 1, c: 1 }, '专辑分类统计应正确');
});

test('DB_addRecord - 错误答案统计正确', () => {
  resetStorage();
  const rec = { qid: 'test001', ans: 'A', ok: false, time: Date.now() };
  DB_addRecord(rec, SAMPLE_QUESTION_BANK);
  const data = DB_get();
  
  assertEqual(data.stats.total, 1, '总答题数应为1');
  assertEqual(data.stats.correct, 0, '正确数应为0');
  assertEqual(data.stats.cats['专辑'].c, 0, '专辑分类正确数应为0');
});

test('DB_addWrong - 添加新错题', () => {
  resetStorage();
  DB_addWrong('test001');
  const data = DB_get();
  
  assertEqual(data.wrong.length, 1, '错题本应有1条');
  assertEqual(data.wrong[0].qid, 'test001', '错题ID应正确');
  assertEqual(data.wrong[0].cnt, 1, '错误次数应为1');
});

test('DB_addWrong - 重复错题增加计数', () => {
  resetStorage();
  DB_addWrong('test001');
  DB_addWrong('test001');
  const data = DB_get();
  
  assertEqual(data.wrong.length, 1, '错题本应仍为1条');
  assertEqual(data.wrong[0].cnt, 2, '错误次数应为2');
});

test('DB_removeWrong - 移除错题', () => {
  resetStorage();
  DB_addWrong('test001');
  DB_addWrong('test002');
  DB_removeWrong('test001');
  const data = DB_get();
  
  assertEqual(data.wrong.length, 1, '错题本应剩1条');
  assertEqual(data.wrong[0].qid, 'test002', '剩余错题ID应为test002');
});

test('DB_findQ - 找到题目', () => {
  const q = DB_findQ('test001', SAMPLE_QUESTION_BANK);
  assertEqual(q, SAMPLE_QUESTION, '应找到正确题目');
});

test('DB_findQ - 未找到题目返回null', () => {
  const q = DB_findQ('nonexistent', SAMPLE_QUESTION_BANK);
  assertEqual(q, null, '未找到应返回null');
});

console.log('\n========== 选项解析测试 ==========\n');

test('parseOptions - 标准格式解析', () => {
  const opts = parseOptions('A.选项A\nB.选项B\nC.选项C\nD.选项D');
  assertEqual(opts.length, 4, '应解析出4个选项');
  assertEqual(opts[0], { key: 'A', text: '选项A' }, '第一个选项应正确');
  assertEqual(opts[3], { key: 'D', text: '选项D' }, '最后一个选项应正确');
});

test('parseOptions - 中文句号格式不支持（原始代码限制）', () => {
  // 原始正则 /^([A-D])[.、．]\s*(.+)$/ 不支持中文句号
  const opts = parseOptions('A。选项A\nB。选项B');
  assertEqual(opts.length, 0, '中文句号格式不被原始代码支持');
});

test('parseOptions - 全角点号格式', () => {
  const opts = parseOptions('A．选项A\nB．选项B');
  assertEqual(opts.length, 2, '应解析出2个选项');
});

test('parseOptions - 带空格格式', () => {
  const opts = parseOptions('A. 选项A\nB.  选项B');
  assertEqual(opts.length, 2, '应解析出2个选项');
  assertEqual(opts[0].text, '选项A', '应去除前导空格');
});

test('parseOptions - 空行跳过', () => {
  const opts = parseOptions('A.选项A\n\nB.选项B\n   \nC.选项C');
  assertEqual(opts.length, 3, '应跳过空行');
});

test('parseOptions - 无效格式跳过', () => {
  const opts = parseOptions('A.选项A\n无效行\nB.选项B');
  assertEqual(opts.length, 2, '应跳过无效行');
});

test('parseOptions - 空输入返回空数组', () => {
  const opts = parseOptions('');
  assertEqual(opts.length, 0, '空输入应返回空数组');
});

console.log('\n========== 数据导入验证测试 ==========\n');

test('validateImportData - 有效数据', () => {
  const result = validateImportData({ questionBank: [], userData: {} });
  assertTrue(result.valid, '包含questionBank和userData应有效');
});

test('validateImportData - 仅questionBank有效', () => {
  const result = validateImportData({ questionBank: [] });
  assertTrue(result.valid, '仅questionBank应有效');
});

test('validateImportData - 仅userData有效', () => {
  const result = validateImportData({ userData: {} });
  assertTrue(result.valid, '仅userData应有效');
});

test('validateImportData - 无效数据', () => {
  const result = validateImportData({ other: 'data' });
  assertFalse(result.valid, '无有效字段应无效');
  assertTrue(result.error.includes('未找到有效数据'), '应返回正确错误信息');
});

test('validateImportData - 空对象无效', () => {
  const result = validateImportData({});
  assertFalse(result.valid, '空对象应无效');
});

console.log('\n========== 错题合并逻辑测试 ==========\n');

test('mergeWrongData - 合合新错题', () => {
  const existing = [{ qid: 'q1', cnt: 2, time: 100 }];
  const newWrong = [{ qid: 'q2', cnt: 1, time: 200 }];
  const result = mergeWrongData(existing, newWrong);
  
  assertEqual(result.length, 2, '合并后应有2条');
  assertEqual(result[1].qid, 'q2', '新错题应添加');
});

test('mergeWrongData - 相同错题计数累加', () => {
  const existing = [{ qid: 'q1', cnt: 2, time: 100 }];
  const newWrong = [{ qid: 'q1', cnt: 3, time: 200 }];
  const result = mergeWrongData(existing, newWrong);
  
  assertEqual(result.length, 1, '合并后应仍为1条');
  assertEqual(result[0].cnt, 5, '计数应累加为5');
});

test('mergeWrongData - 空数组合并', () => {
  const existing = [];
  const newWrong = [{ qid: 'q1', cnt: 1, time: 100 }];
  const result = mergeWrongData(existing, newWrong);
  
  assertEqual(result.length, 1, '空数组合并新数据应有1条');
});

console.log('\n========== 重置确认逻辑测试 ==========\n');

test('checkResetInput - 正确输入返回true', () => {
  assertTrue(checkResetInput('恢复默认'), '正确输入应返回true');
});

test('checkResetInput - 错误输入返回false', () => {
  assertFalse(checkResetInput('恢复'), '部分输入应返回false');
  assertFalse(checkResetInput('恢复默认题库'), '多余文字应返回false');
  assertFalse(checkResetInput(''), '空输入应返回false');
  assertFalse(checkResetInput('恢复默认 '), '带空格应返回false');
});

console.log('\n========== Shuffle 函数测试 ==========\n');

test('shuffle - 返回数组长度一致', () => {
  const arr = [1, 2, 3, 4, 5];
  const shuffled = shuffle(arr);
  assertEqual(shuffled.length, arr.length, '长度应一致');
});

test('shuffle - 不修改原数组', () => {
  const arr = [1, 2, 3];
  const original = arr.slice();
  shuffle(arr);
  assertEqual(arr, original, '原数组不应被修改');
});

test('shuffle - 包含所有元素', () => {
  const arr = [1, 2, 3, 4, 5];
  const shuffled = shuffle(arr);
  const sortedShuffled = shuffled.slice().sort();
  const sortedOriginal = arr.slice().sort();
  assertEqual(sortedShuffled, sortedOriginal, '应包含所有原元素');
});

test('shuffle - 空数组处理', () => {
  const shuffled = shuffle([]);
  assertEqual(shuffled.length, 0, '空数组应返回空数组');
});

test('shuffle - 单元素数组', () => {
  const shuffled = shuffle([1]);
  assertEqual(shuffled, [1], '单元素数组应返回相同数组');
});

console.log('\n========== 边界条件测试 ==========\n');

test('DB_addRecord - 题目不存在时分类统计不受影响', () => {
  resetStorage();
  const rec = { qid: 'nonexistent', ans: 'A', ok: true, time: Date.now() };
  DB_addRecord(rec, SAMPLE_QUESTION_BANK);
  const data = DB_get();
  
  assertEqual(data.stats.total, 1, '总答题数仍应增加');
  assertEqual(Object.keys(data.stats.cats).length, 0, '分类统计不应增加');
});

test('parseOptions - 仅一个选项', () => {
  const opts = parseOptions('A.只有一个');
  assertEqual(opts.length, 1, '应解析出1个选项');
});

test('parseOptions - 超过D的选项被忽略', () => {
  const opts = parseOptions('A.选项A\nB.选项B\nE.选项E');
  assertEqual(opts.length, 2, 'E选项应被忽略');
});

console.log('\n========== 测试结果汇总 ==========\n');

const { passedCount, failedCount, testResults } = require('./test-framework').getResults();

console.log(`总计: ${passedCount + failedCount} 个测试`);
console.log(`通过: ${passedCount} 个`);
console.log(`失败: ${failedCount} 个`);

if (failedCount > 0) {
  console.log('\n失败的测试:');
  testResults.filter(r => !r.passed).forEach(r => {
    console.log(`  - ${r.name}: ${r.error}`);
  });
  process.exit(1);
} else {
  console.log('\n✓ 所有测试通过！');
  process.exit(0);
}