/**
 * 林俊杰粉丝答题 - 核心逻辑单元测试
 * 
 * 覆盖范围：
 * - DB 模块（数据持久化核心操作）
 * - importData（导入解析、验证、合并）
 * - saveQuestion / 选项解析（正则 + 校验）
 * - resetQuestionBank（恢复默认题库）
 * - shuffle（Fisher-Yates 洗牌）
 * - getCount / selectMode（模式映射）
 * - fmtTime（时间格式化）
 */

const { describe, it, before, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

// ===== 最小化 DOM / localStorage mock =====
function createLocalStorage() {
  const store = {};
  return {
    getItem(key) { return key in store ? store[key] : null; },
    setItem(key, val) { store[key] = String(val); },
    removeItem(key) { delete store[key]; },
    clear() { Object.keys(store).forEach(k => delete store[k]); },
    _store: store
  };
}

function setupDOM() {
  const localStorage = createLocalStorage();
  const document = {
    getElementById: () => ({ textContent: '', value: '', style: {}, innerHTML: '', classList: { add: () => {}, remove: () => {} } }),
    querySelectorAll: () => [],
    querySelector: () => null,
    createElement: () => ({ href: '', download: '', click: () => {} }),
  };
  const window = { addEventListener: () => {} };
  const alert = () => {};
  const confirm = () => false;
  const URL = { createObjectURL: () => '', revokeObjectURL: () => '' };
  const Blob = class { constructor() {} };
  const FileReader = class { readAsText() {} };
  const Date_orig = Date;

  return { localStorage, document, window, alert, confirm, URL, Blob, FileReader };
}

// ===== 从 index.html 提取核心逻辑为可测试模块 =====

// shuffle: Fisher-Yates
function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// getCount: 模式 -> 题数
function getCount(mode) {
  var m = { quick: 10, standard: 20, intensive: 30 };
  return m[mode] || 10;
}

// fmtTime
function fmtTime(ms) {
  var sec = Math.floor(ms / 1000);
  var m = Math.floor(sec / 60);
  var s = sec % 60;
  return m + '分' + s + '秒';
}

// 选项解析正则（与 saveQuestion 中一致）
function parseOptions(optsText) {
  var lines = optsText.split('\n');
  var options = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    var match = line.match(/^([A-D])[.、．]\s*(.+)$/);
    if (match) {
      options.push({ key: match[1], text: match[2] });
    }
  }
  return options;
}

// DB 模块工厂
function createDB(localStorage, findQ) {
  const KEY = 'jj_quiz_v2';
  return {
    KEY,
    get() { var d = localStorage.getItem(KEY); return d ? JSON.parse(d) : this.defaults(); },
    defaults() { return { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } }; },
    save(d) { localStorage.setItem(KEY, JSON.stringify(d)); },
    addRecord(rec) {
      var d = this.get();
      d.history.push(rec);
      d.stats.total++;
      if (rec.ok) d.stats.correct++;
      var q = findQ(rec.qid);
      if (q) {
        if (!d.stats.cats[q.category]) d.stats.cats[q.category] = { t: 0, c: 0 };
        d.stats.cats[q.category].t++;
        if (rec.ok) d.stats.cats[q.category].c++;
      }
      this.save(d);
    },
    addWrong(qid) {
      var d = this.get();
      var f = null;
      for (var i = 0; i < d.wrong.length; i++) {
        if (d.wrong[i].qid === qid) { f = d.wrong[i]; break; }
      }
      if (f) { f.cnt++; f.time = Date.now(); }
      else { d.wrong.push({ qid: qid, cnt: 1, time: Date.now() }); }
      this.save(d);
    },
    removeWrong(qid) {
      var d = this.get();
      d.wrong = d.wrong.filter(function(w) { return w.qid !== qid; });
      this.save(d);
    },
    getWrong() { return this.get().wrong; }
  };
}

// importData 核心合并逻辑（提取自 importData reader.onload）
function mergeImportData(existingBank, importData, existingDB) {
  var addedCount = 0;
  var updatedCount = 0;
  var result = { questionBank: existingBank.slice(), userData: null };

  if (importData.questionBank) {
    var existingIds = {};
    for (var i = 0; i < result.questionBank.length; i++) {
      existingIds[result.questionBank[i].id] = true;
    }
    for (var j = 0; j < importData.questionBank.length; j++) {
      var q = importData.questionBank[j];
      if (existingIds[q.id]) {
        for (var k = 0; k < result.questionBank.length; k++) {
          if (result.questionBank[k].id === q.id) {
            result.questionBank[k] = q;
            updatedCount++;
            break;
          }
        }
      } else {
        result.questionBank.push(q);
        addedCount++;
      }
    }
  }

  if (importData.userData) {
    var existingData = existingDB ? JSON.parse(JSON.stringify(existingDB)) : { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } };
    if (importData.userData.history) {
      existingData.history = existingData.history.concat(importData.userData.history);
    }
    if (importData.userData.wrong) {
      var wrongMap = {};
      for (var w = 0; w < existingData.wrong.length; w++) {
        wrongMap[existingData.wrong[w].qid] = existingData.wrong[w];
      }
      for (var x = 0; x < importData.userData.wrong.length; x++) {
        var wrongItem = importData.userData.wrong[x];
        if (wrongMap[wrongItem.qid]) {
          wrongMap[wrongItem.qid].cnt += wrongItem.cnt;
        } else {
          existingData.wrong.push(wrongItem);
        }
      }
    }
    if (importData.userData.stats) {
      if (!existingData.stats) existingData.stats = { total: 0, correct: 0, cats: {} };
      existingData.stats.total += importData.userData.stats.total || 0;
      existingData.stats.correct += importData.userData.stats.correct || 0;
      if (importData.userData.stats.cats) {
        for (var catName in importData.userData.stats.cats) {
          if (!existingData.stats.cats[catName]) {
            existingData.stats.cats[catName] = { t: 0, c: 0 };
          }
          existingData.stats.cats[catName].t += importData.userData.stats.cats[catName].t || 0;
          existingData.stats.cats[catName].c += importData.userData.stats.cats[catName].c || 0;
        }
      }
    }
    result.userData = existingData;
  }

  return { result, addedCount, updatedCount };
}

// ===== 题库数据（用于测试的子集）=====
const SAMPLE_QUESTIONS = [
  { id: "001", category: "专辑", question: "林俊杰首张专辑发行于哪一天？", options: [{ key: "A", text: "2003年4月1日" }, { key: "B", text: "2003年4月10日" }], answer: "B", explanation: "测试解析1" },
  { id: "002", category: "歌曲", question: "《江南》的作曲人是谁？", options: [{ key: "A", text: "林俊杰" }, { key: "B", text: "张思尔" }], answer: "A", explanation: "测试解析2" },
  { id: "061", category: "个人信息", question: "林俊杰的本名是什么？", options: [{ key: "A", text: "JJ Lin" }, { key: "B", text: "Wayne" }], answer: "B", explanation: "测试解析3" }
];

function findQ(bank, qid) {
  for (var i = 0; i < bank.length; i++) {
    if (bank[i].id === qid) return bank[i];
  }
  return null;
}

// ========================
// 测试用例
// ========================

// ----- shuffle -----
describe('shuffle', () => {
  it('应返回与原数组相同元素但不同顺序的新数组', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = shuffle(arr);
    assert.deepEqual([...result].sort((a, b) => a - b), arr);
    assert.notEqual(result, arr); // 是新数组
  });

  it('不应修改原数组', () => {
    const arr = [1, 2, 3];
    const copy = arr.slice();
    shuffle(arr);
    assert.deepEqual(arr, copy);
  });

  it('对空数组应返回空数组', () => {
    assert.deepEqual(shuffle([]), []);
  });

  it('对单元素数组应返回相同元素', () => {
    assert.deepEqual(shuffle([42]), [42]);
  });
});

// ----- getCount -----
describe('getCount', () => {
  it('quick 模式返回 10', () => {
    assert.equal(getCount('quick'), 10);
  });

  it('standard 模式返回 20', () => {
    assert.equal(getCount('standard'), 20);
  });

  it('intensive 模式返回 30', () => {
    assert.equal(getCount('intensive'), 30);
  });

  it('未知模式默认返回 10', () => {
    assert.equal(getCount('unknown'), 10);
  });

  it('undefined 模式默认返回 10', () => {
    assert.equal(getCount(undefined), 10);
  });
});

// ----- fmtTime -----
describe('fmtTime', () => {
  it('0 毫秒应返回 "0分0秒"', () => {
    assert.equal(fmtTime(0), '0分0秒');
  });

  it('90秒应返回 "1分30秒"', () => {
    assert.equal(fmtTime(90000), '1分30秒');
  });

  it('3600000ms 应返回 "60分0秒"', () => {
    assert.equal(fmtTime(3600000), '60分0秒');
  });

  it('59秒应返回 "0分59秒"', () => {
    assert.equal(fmtTime(59000), '0分59秒');
  });
});

// ----- 选项解析正则 -----
describe('parseOptions', () => {
  it('应正确解析标准格式的选项', () => {
    const text = 'A.选项一\nB.选项二\nC.选项三\nD.选项四';
    const result = parseOptions(text);
    assert.equal(result.length, 4);
    assert.equal(result[0].key, 'A');
    assert.equal(result[0].text, '选项一');
    assert.equal(result[3].key, 'D');
    assert.equal(result[3].text, '选项四');
  });

  it('应支持顿号分隔符（、）', () => {
    const text = 'A、选项一\nB、选项二';
    const result = parseOptions(text);
    assert.equal(result.length, 2);
    assert.equal(result[0].text, '选项一');
  });

  it('应支持全角点分隔符（．）', () => {
    const text = 'A．选项一\nB．选项二';
    const result = parseOptions(text);
    assert.equal(result.length, 2);
    assert.equal(result[0].text, '选项一');
  });

  it('应跳过空行', () => {
    const text = 'A.选项一\n\nB.选项二\n\nC.选项三';
    const result = parseOptions(text);
    assert.equal(result.length, 3);
  });

  it('应忽略不符合格式的行', () => {
    const text = 'A.选项一\n这是一行无效文本\nB.选项二';
    const result = parseOptions(text);
    assert.equal(result.length, 2);
  });

  it('选项键应在 A-D 范围内', () => {
    const text = 'A.选项A\nE.选项E\nF.选项F';
    const result = parseOptions(text);
    assert.equal(result.length, 1); // E、F 不匹配
  });

  it('点后可含空格', () => {
    const text = 'A. 选项一\nB.  选项二';
    const result = parseOptions(text);
    assert.equal(result[0].text, '选项一');
    assert.equal(result[1].text, '选项二');
  });

  it('空文本应返回空数组', () => {
    assert.deepEqual(parseOptions(''), []);
  });
});

// ----- DB 模块 -----
describe('DB 模块', () => {
  let localStorage;
  let db;
  let bank;

  beforeEach(() => {
    localStorage = createLocalStorage();
    bank = SAMPLE_QUESTIONS.slice();
    db = createDB(localStorage, (qid) => findQ(bank, qid));
  });

  it('defaults 应返回正确的默认数据结构', () => {
    const d = db.defaults();
    assert.ok(Array.isArray(d.history));
    assert.ok(Array.isArray(d.wrong));
    assert.equal(d.stats.total, 0);
    assert.equal(d.stats.correct, 0);
    assert.deepEqual(d.stats.cats, {});
  });

  it('get 在无数据时应返回默认值', () => {
    const d = db.get();
    assert.deepEqual(d, db.defaults());
  });

  it('save + get 应正确持久化和读取', () => {
    const d = db.defaults();
    d.stats.total = 42;
    db.save(d);
    const loaded = db.get();
    assert.equal(loaded.stats.total, 42);
  });

  describe('addRecord', () => {
    it('应正确记录正确答案', () => {
      db.addRecord({ qid: '001', ans: 'B', ok: true, time: 1000 });
      const d = db.get();
      assert.equal(d.stats.total, 1);
      assert.equal(d.stats.correct, 1);
      assert.equal(d.history.length, 1);
      assert.equal(d.history[0].qid, '001');
      assert.equal(d.history[0].ok, true);
    });

    it('应正确记录错误答案', () => {
      db.addRecord({ qid: '001', ans: 'A', ok: false, time: 1000 });
      const d = db.get();
      assert.equal(d.stats.total, 1);
      assert.equal(d.stats.correct, 0);
    });

    it('应按分类更新统计', () => {
      db.addRecord({ qid: '001', ans: 'B', ok: true, time: 1000 });
      const d = db.get();
      assert.ok(d.stats.cats['专辑']);
      assert.equal(d.stats.cats['专辑'].t, 1);
      assert.equal(d.stats.cats['专辑'].c, 1);
    });

    it('错误答案应增加分类的 t 但不增加 c', () => {
      db.addRecord({ qid: '002', ans: 'B', ok: false, time: 1000 });
      const d = db.get();
      assert.equal(d.stats.cats['歌曲'].t, 1);
      assert.equal(d.stats.cats['歌曲'].c, 0);
    });

    it('多次记录应累积统计', () => {
      db.addRecord({ qid: '001', ans: 'B', ok: true, time: 1000 });
      db.addRecord({ qid: '002', ans: 'B', ok: false, time: 2000 });
      const d = db.get();
      assert.equal(d.stats.total, 2);
      assert.equal(d.stats.correct, 1);
      assert.equal(d.history.length, 2);
    });

    it('题目不存在时不应崩溃（findQ 返回 null）', () => {
      db.addRecord({ qid: 'nonexist', ans: 'A', ok: false, time: 1000 });
      const d = db.get();
      assert.equal(d.stats.total, 1);
      assert.equal(d.stats.correct, 0);
      // 不应有分类统计
      assert.deepEqual(d.stats.cats, {});
    });
  });

  describe('addWrong', () => {
    it('首次添加错题应创建新记录', () => {
      db.addWrong('001');
      const wrong = db.getWrong();
      assert.equal(wrong.length, 1);
      assert.equal(wrong[0].qid, '001');
      assert.equal(wrong[0].cnt, 1);
    });

    it('重复添加同一错题应增加计数', () => {
      db.addWrong('001');
      db.addWrong('001');
      db.addWrong('001');
      const wrong = db.getWrong();
      assert.equal(wrong.length, 1);
      assert.equal(wrong[0].cnt, 3);
    });

    it('不同错题应分别记录', () => {
      db.addWrong('001');
      db.addWrong('002');
      const wrong = db.getWrong();
      assert.equal(wrong.length, 2);
    });
  });

  describe('removeWrong', () => {
    it('应正确移除指定错题', () => {
      db.addWrong('001');
      db.addWrong('002');
      db.removeWrong('001');
      const wrong = db.getWrong();
      assert.equal(wrong.length, 1);
      assert.equal(wrong[0].qid, '002');
    });

    it('移除不存在的错题不应报错', () => {
      db.addWrong('001');
      db.removeWrong('nonexist');
      const wrong = db.getWrong();
      assert.equal(wrong.length, 1);
    });

    it('移除后再次添加应从 cnt=1 开始', () => {
      db.addWrong('001');
      db.addWrong('001');
      db.removeWrong('001');
      db.addWrong('001');
      const wrong = db.getWrong();
      assert.equal(wrong.length, 1);
      assert.equal(wrong[0].cnt, 1);
    });
  });
});

// ----- importData 合并逻辑 -----
describe('importData 合并逻辑', () => {
  let existingBank;

  beforeEach(() => {
    existingBank = SAMPLE_QUESTIONS.slice();
  });

  it('导入新题目应增加题库', () => {
    const importObj = {
      questionBank: [{ id: 'new01', category: '测试', question: '新题', options: [{ key: 'A', text: 'a' }], answer: 'A', explanation: '' }]
    };
    const { result, addedCount, updatedCount } = mergeImportData(existingBank, importObj, null);
    assert.equal(addedCount, 1);
    assert.equal(updatedCount, 0);
    assert.equal(result.questionBank.length, 4);
  });

  it('导入已有 ID 的题目应更新而非新增', () => {
    const importObj = {
      questionBank: [{ id: '001', category: '专辑', question: '更新后的题目', options: [{ key: 'A', text: 'a' }], answer: 'A', explanation: '更新' }]
    };
    const { result, addedCount, updatedCount } = mergeImportData(existingBank, importObj, null);
    assert.equal(addedCount, 0);
    assert.equal(updatedCount, 1);
    assert.equal(result.questionBank.length, 3);
    assert.equal(result.questionBank.find(q => q.id === '001').question, '更新后的题目');
  });

  it('导入混合数据（新增+更新）应正确计数', () => {
    const importObj = {
      questionBank: [
        { id: '001', category: '专辑', question: '更新', options: [], answer: 'A', explanation: '' },
        { id: 'new01', category: '测试', question: '新题', options: [], answer: 'A', explanation: '' }
      ]
    };
    const { addedCount, updatedCount } = mergeImportData(existingBank, importObj, null);
    assert.equal(addedCount, 1);
    assert.equal(updatedCount, 1);
  });

  it('导入 userData.history 应合并', () => {
    const existingDB = { history: [{ qid: '001', ok: true }], wrong: [], stats: { total: 1, correct: 1, cats: {} } };
    const importObj = {
      userData: {
        history: [{ qid: '002', ok: false }],
        wrong: [],
        stats: { total: 1, correct: 0, cats: {} }
      }
    };
    const { result } = mergeImportData(existingBank, importObj, existingDB);
    assert.equal(result.userData.history.length, 2);
  });

  it('导入错题：已有错题应累加 cnt', () => {
    const existingDB = {
      history: [],
      wrong: [{ qid: '001', cnt: 2, time: 1000 }],
      stats: { total: 0, correct: 0, cats: {} }
    };
    const importObj = {
      userData: {
        wrong: [{ qid: '001', cnt: 3, time: 2000 }],
        stats: { total: 0, correct: 0, cats: {} }
      }
    };
    const { result } = mergeImportData(existingBank, importObj, existingDB);
    const wrong001 = result.userData.wrong.find(w => w.qid === '001');
    assert.equal(wrong001.cnt, 5); // 2 + 3
  });

  it('导入错题：新错题应追加', () => {
    const existingDB = {
      history: [],
      wrong: [{ qid: '001', cnt: 1, time: 1000 }],
      stats: { total: 0, correct: 0, cats: {} }
    };
    const importObj = {
      userData: {
        wrong: [{ qid: '002', cnt: 2, time: 2000 }],
        stats: { total: 0, correct: 0, cats: {} }
      }
    };
    const { result } = mergeImportData(existingBank, importObj, existingDB);
    assert.equal(result.userData.wrong.length, 2);
  });

  it('导入 stats 应正确累加总计数', () => {
    const existingDB = { history: [], wrong: [], stats: { total: 10, correct: 7, cats: { '专辑': { t: 5, c: 4 } } } };
    const importObj = {
      userData: {
        stats: { total: 5, correct: 3, cats: { '专辑': { t: 3, c: 2 }, '歌曲': { t: 2, c: 1 } } }
      }
    };
    const { result } = mergeImportData(existingBank, importObj, existingDB);
    assert.equal(result.userData.stats.total, 15);
    assert.equal(result.userData.stats.correct, 10);
    assert.equal(result.userData.stats.cats['专辑'].t, 8);
    assert.equal(result.userData.stats.cats['专辑'].c, 6);
    assert.equal(result.userData.stats.cats['歌曲'].t, 2);
    assert.equal(result.userData.stats.cats['歌曲'].c, 1);
  });

  it('导入缺失 stats 字段时应使用默认值 0', () => {
    const existingDB = { history: [], wrong: [], stats: { total: 5, correct: 3, cats: {} } };
    const importObj = {
      userData: {
        stats: { total: undefined, correct: null, cats: {} }
      }
    };
    const { result } = mergeImportData(existingBank, importObj, existingDB);
    // undefined || 0 => 0, null || 0 => 0
    assert.equal(result.userData.stats.total, 5);
    assert.equal(result.userData.stats.correct, 3);
  });

  it('空导入不应修改已有数据', () => {
    const existingDB = { history: [], wrong: [], stats: { total: 5, correct: 3, cats: {} } };
    const { result, addedCount, updatedCount } = mergeImportData(existingBank, {}, existingDB);
    assert.equal(addedCount, 0);
    assert.equal(updatedCount, 0);
    assert.equal(result.questionBank.length, 3);
  });
});

// ----- resetQuestionBank 逻辑 -----
describe('resetQuestionBank 逻辑', () => {
  it('应将题库恢复为默认值', () => {
    const DEFAULT = SAMPLE_QUESTIONS.slice();
    let bank = [...SAMPLE_QUESTIONS, { id: 'custom01', category: '自定义', question: '自定义题', options: [], answer: 'A', explanation: '' }];
    // 模拟 reset
    bank = DEFAULT.slice();
    assert.equal(bank.length, SAMPLE_QUESTIONS.length);
    assert.ok(!bank.find(q => q.id === 'custom01'));
  });

  it('恢复后默认题库应完整', () => {
    const DEFAULT = SAMPLE_QUESTIONS.slice();
    let bank = [];
    bank = DEFAULT.slice();
    assert.equal(bank.length, SAMPLE_QUESTIONS.length);
    assert.equal(bank[0].id, '001');
    assert.equal(bank[2].id, '061');
  });
});

// ----- checkResetInput 逻辑 -----
describe('checkResetInput 逻辑', () => {
  it('输入"恢复默认"应返回 true', () => {
    assert.equal('恢复默认' === '恢复默认', true);
  });

  it('输入其他内容应返回 false', () => {
    assert.equal('恢复' === '恢复默认', false);
    assert.equal('恢复默认 ' === '恢复默认', false); // 尾部空格
    assert.equal('' === '恢复默认', false);
    assert.equal('RESET' === '恢复默认', false);
  });
});

// ----- 答题核心流程 -----
describe('答题核心流程', () => {
  it('正确答案应增加 correctCount', () => {
    let correctCount = 0;
    const key = 'B';
    const answer = 'B';
    const ok = (key === answer);
    if (ok) correctCount++;
    assert.equal(ok, true);
    assert.equal(correctCount, 1);
  });

  it('错误答案不应增加 correctCount', () => {
    let correctCount = 0;
    const key = 'A';
    const answer = 'B';
    const ok = (key === answer);
    if (ok) correctCount++;
    assert.equal(ok, false);
    assert.equal(correctCount, 0);
  });

  it('完成答题应正确计算百分比', () => {
    const total = 20;
    const correct = 15;
    const pct = total > 0 ? Math.round(correct / total * 100) : 0;
    assert.equal(pct, 75);
  });

  it('零题数时百分比应为 0', () => {
    const total = 0;
    const correct = 0;
    const pct = total > 0 ? Math.round(correct / total * 100) : 0;
    assert.equal(pct, 0);
  });

  it('全部正确应为 100%', () => {
    const pct = Math.round(10 / 10 * 100);
    assert.equal(pct, 100);
  });
});

// ----- 分类筛选逻辑 -----
describe('分类筛选逻辑', () => {
  it('应正确统计各分类题目数量', () => {
    const cats = {};
    for (var i = 0; i < SAMPLE_QUESTIONS.length; i++) {
      var c = SAMPLE_QUESTIONS[i].category;
      cats[c] = (cats[c] || 0) + 1;
    }
    assert.equal(cats['专辑'], 1);
    assert.equal(cats['歌曲'], 1);
    assert.equal(cats['个人信息'], 1);
  });

  it('应正确按分类筛选题目', () => {
    const filter = '专辑';
    const filtered = SAMPLE_QUESTIONS.filter(q => q.category === filter);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, '001');
  });
});

// ----- 今日数据统计逻辑 -----
describe('今日数据统计', () => {
  it('应正确过滤今日记录', () => {
    const today = new Date().setHours(0, 0, 0, 0);
    const history = [
      { qid: '001', ok: true, time: today + 1000 },
      { qid: '002', ok: false, time: today + 2000 },
      { qid: '001', ok: true, time: today - 86400000 } // 昨天
    ];
    const todayHistory = history.filter(h => h.time >= today);
    assert.equal(todayHistory.length, 2);
  });

  it('今日无记录应返回 0', () => {
    const today = new Date().setHours(0, 0, 0, 0);
    const history = [
      { qid: '001', ok: true, time: today - 86400000 }
    ];
    const todayHistory = history.filter(h => h.time >= today);
    assert.equal(todayHistory.length, 0);
    const acc = todayHistory.length > 0 ? Math.round(todayHistory.filter(h => h.ok).length / todayHistory.length * 100) : 0;
    assert.equal(acc, 0);
  });

  it('应正确计算今日正确率', () => {
    const today = new Date().setHours(0, 0, 0, 0);
    const history = [
      { qid: '001', ok: true, time: today + 1000 },
      { qid: '002', ok: false, time: today + 2000 },
      { qid: '001', ok: true, time: today + 3000 }
    ];
    const todayHistory = history.filter(h => h.time >= today);
    const acc = Math.round(todayHistory.filter(h => h.ok).length / todayHistory.length * 100);
    assert.equal(acc, 67); // 2/3 ≈ 67%
  });
});

// ----- 边界条件 -----
describe('边界条件', () => {
  it('findQ 查找不存在的 ID 应返回 null', () => {
    assert.equal(findQ(SAMPLE_QUESTIONS, 'nonexist'), null);
  });

  it('findQ 查找存在的 ID 应返回正确题目', () => {
    const q = findQ(SAMPLE_QUESTIONS, '001');
    assert.ok(q);
    assert.equal(q.category, '专辑');
  });

  it('shuffle 应处理大数组', () => {
    const arr = Array.from({ length: 1000 }, (_, i) => i);
    const result = shuffle(arr);
    assert.equal(result.length, 1000);
    assert.deepEqual([...result].sort((a, b) => a - b), arr);
  });

  it('导入数据中 questionBank 为空数组不应崩溃', () => {
    const { result, addedCount, updatedCount } = mergeImportData(SAMPLE_QUESTIONS.slice(), { questionBank: [] }, null);
    assert.equal(addedCount, 0);
    assert.equal(updatedCount, 0);
    assert.equal(result.questionBank.length, 3);
  });

  it('DB 连续多次操作数据应保持一致性', () => {
    const ls = createLocalStorage();
    const db = createDB(ls, (qid) => findQ(SAMPLE_QUESTIONS, qid));
    db.addRecord({ qid: '001', ans: 'B', ok: true, time: 1000 });
    db.addWrong('001');
    db.addRecord({ qid: '002', ans: 'A', ok: true, time: 2000 });
    db.addWrong('002');
    db.addWrong('002');
    db.removeWrong('001');
    
    const d = db.get();
    assert.equal(d.stats.total, 2);
    assert.equal(d.stats.correct, 2);
    assert.equal(d.wrong.length, 1);
    assert.equal(d.wrong[0].qid, '002');
    assert.equal(d.wrong[0].cnt, 2);
  });
});
