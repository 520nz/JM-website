'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { createBrowserShim } = require('./browser-shim');

function loadData() {
  const shim = createBrowserShim();
  shim.loadFile(path.join(__dirname, '..', 'js', 'data.js'));
  return shim.window.App;
}

test.describe('data.js —— 题库数据完整性', () => {
  test('QUESTION_BANK 是数组且不为空', () => {
    const App = loadData();
    assert.ok(Array.isArray(App.QUESTION_BANK));
    assert.ok(App.QUESTION_BANK.length > 0, '题库不应为空');
  });

  test('每道题都有必需字段且类型正确', () => {
    const App = loadData();
    for (const [i, q] of App.QUESTION_BANK.entries()) {
      assert.ok(q.id, `第 ${i} 题缺少 id`);
      assert.ok(typeof q.id === 'string', `第 ${i} 题 id 应为字符串`);
      assert.ok(q.category, `第 ${i} 题缺少 category`);
      assert.ok(typeof q.category === 'string', `第 ${i} 题 category 应为字符串`);
      assert.ok(q.question, `第 ${i} 题缺少 question`);
      assert.ok(typeof q.question === 'string', `第 ${i} 题 question 应为字符串`);
      assert.ok(Array.isArray(q.options), `第 ${i} 题 options 应为数组`);
      assert.ok(q.answer, `第 ${i} 题缺少 answer`);
      assert.ok(typeof q.answer === 'string', `第 ${i} 题 answer 应为字符串`);
      assert.ok(q.explanation, `第 ${i} 题缺少 explanation`);
      assert.ok(typeof q.explanation === 'string', `第 ${i} 题 explanation 应为字符串`);
    }
  });

  test('每道题都恰好 4 个选项（A/B/C/D）', () => {
    const App = loadData();
    for (const q of App.QUESTION_BANK) {
      assert.equal(q.options.length, 4, `题 ${q.id} 应有 4 个选项，实际 ${q.options.length}`);
      const keys = q.options.map((o) => o.key).sort();
      assert.deepEqual(keys, ['A', 'B', 'C', 'D'], `题 ${q.id} 选项键应为 A/B/C/D`);
      for (const opt of q.options) {
        assert.ok(opt.text, `题 ${q.id} 选项 ${opt.key} 缺少 text`);
      }
    }
  });

  test('answer 必须是四个选项之一', () => {
    const App = loadData();
    for (const q of App.QUESTION_BANK) {
      const validKeys = q.options.map((o) => o.key);
      assert.ok(validKeys.includes(q.answer), `题 ${q.id} 的 answer "${q.answer}" 不在选项中`);
    }
  });

  test('所有 id 唯一', () => {
    const App = loadData();
    const ids = App.QUESTION_BANK.map((q) => q.id);
    const uniqueIds = new Set(ids);
    assert.equal(ids.length, uniqueIds.size, `存在重复 id`);
  });

  test('题目总数是 78', () => {
    const App = loadData();
    assert.equal(App.QUESTION_BANK.length, 78);
  });

  test('分类分布符合预期', () => {
    const App = loadData();
    const byCat = {};
    for (const q of App.QUESTION_BANK) {
      byCat[q.category] = (byCat[q.category] || 0) + 1;
    }
    assert.equal(byCat['专辑'], 15);
    assert.equal(byCat['歌曲'], 45);
    assert.equal(byCat['个人信息'], 8);
    assert.equal(byCat['获奖记录'], 10);
  });

  test('没有空字符串字段', () => {
    const App = loadData();
    for (const q of App.QUESTION_BANK) {
      assert.ok(q.id.trim(), `题 ${q.id} id 不应为空字符串`);
      assert.ok(q.question.trim(), `题 ${q.id} question 不应为空字符串`);
      assert.ok(q.explanation.trim(), `题 ${q.id} explanation 不应为空字符串`);
      for (const opt of q.options) {
        assert.ok(opt.text.trim(), `题 ${q.id} 选项 ${opt.key} text 不应为空字符串`);
      }
    }
  });
});
