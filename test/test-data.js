const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestEnv, loadSource } = require('./setup.js');

test('题库数据完整性 - 加载 data.js 后 QUESTION_BANK 存在且非空', () => {
    const { window } = createTestEnv();
    loadSource(window, 'data.js');
    const App = window.App;
    assert.ok(Array.isArray(App.QUESTION_BANK), 'QUESTION_BANK 应为数组');
    assert.ok(App.QUESTION_BANK.length > 0, 'QUESTION_BANK 不应为空');
    console.log(`  题库总数: ${App.QUESTION_BANK.length} 题`);
});

test('题库数据完整性 - DEFAULT_QUESTION_BANK 是 QUESTION_BANK 的副本', () => {
    const { window } = createTestEnv();
    loadSource(window, 'data.js');
    const App = window.App;
    assert.equal(App.DEFAULT_QUESTION_BANK.length, App.QUESTION_BANK.length);
    // 修改 QUESTION_BANK 不应影响 DEFAULT_QUESTION_BANK
    App.QUESTION_BANK.pop();
    assert.equal(App.DEFAULT_QUESTION_BANK.length, App.QUESTION_BANK.length + 1);
});

test('题库数据完整性 - 每道题都有必需字段', () => {
    const { window } = createTestEnv();
    loadSource(window, 'data.js');
    const App = window.App;
    const required = ['id', 'category', 'question', 'options', 'answer', 'explanation'];
    for (const q of App.QUESTION_BANK) {
        for (const f of required) {
            assert.ok(q[f] !== undefined && q[f] !== null, `题目 ${q.id} 缺少字段 ${f}`);
        }
        assert.ok(Array.isArray(q.options) && q.options.length >= 2, `题目 ${q.id} 选项数量不够`);
        assert.ok(['A', 'B', 'C', 'D'].indexOf(q.answer) !== -1, `题目 ${q.id} 答案不在 A-D 范围内: ${q.answer}`);
    }
});

test('题库数据完整性 - 每道题答案对应有效选项', () => {
    const { window } = createTestEnv();
    loadSource(window, 'data.js');
    const App = window.App;
    for (const q of App.QUESTION_BANK) {
        const optKeys = q.options.map(o => o.key);
        assert.ok(optKeys.indexOf(q.answer) !== -1, `题目 ${q.id} 的答案 ${q.answer} 不在选项中`);
    }
});

test('题库数据完整性 - 所有题目 ID 唯一', () => {
    const { window } = createTestEnv();
    loadSource(window, 'data.js');
    const App = window.App;
    const ids = App.QUESTION_BANK.map(q => q.id);
    const unique = new Set(ids);
    assert.equal(ids.length, unique.size, `存在重复 ID: ${ids.filter((id, i) => ids.indexOf(id) !== i)}`);
});

test('题库数据完整性 - 分类统计正确', () => {
    const { window } = createTestEnv();
    loadSource(window, 'data.js');
    const App = window.App;
    const cats = {};
    for (const q of App.QUESTION_BANK) {
        cats[q.category] = (cats[q.category] || 0) + 1;
    }
    console.log('  分类统计:', cats);
    const expected = { '专辑': 15, '歌曲': 45, '个人信息': 8, '获奖记录': 10 };
    for (const cat in expected) {
        assert.equal(cats[cat], expected[cat], `分类 ${cat} 期望 ${expected[cat]} 题，实际 ${cats[cat]} 题`);
    }
});

test('题库数据完整性 - 选项键为 A/B/C/D 且格式一致', () => {
    const { window } = createTestEnv();
    loadSource(window, 'data.js');
    const App = window.App;
    for (const q of App.QUESTION_BANK) {
        const keys = q.options.map(o => o.key).join('');
        assert.ok(/^[A-D]+$/.test(keys), `题目 ${q.id} 选项键异常: ${keys}`);
    }
});
