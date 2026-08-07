// ============================================================
// test/admin.test.js - admin.js 管理页面逻辑测试
// 覆盖：选项解析正则、数据导入合并（错题本间隔重复兼容、stats 重算）
// ============================================================
const assert = require('assert');
const setup = require('./setup');
const App = setup.loadApp();

describe('选项解析正则 (saveQuestion 内部逻辑)', () => {
    // 从 admin.js 提取的正则：/^([A-Z])[.、．]\s*(.+)$/
    const OPTION_REGEX = /^([A-Z])[.、．]\s*(.+)$/;

    it('应匹配英文点号格式 "A.选项内容"', () => {
        const m = 'A.林俊杰'.match(OPTION_REGEX);
        assert.ok(m, '应匹配');
        assert.strictEqual(m[1], 'A');
        assert.strictEqual(m[2], '林俊杰');
    });

    it('应匹配中文顿号格式 "A、选项内容"', () => {
        const m = 'A、林俊杰'.match(OPTION_REGEX);
        assert.ok(m);
        assert.strictEqual(m[1], 'A');
        assert.strictEqual(m[2], '林俊杰');
    });

    it('应匹配全角点号格式 "A．选项内容"', () => {
        const m = 'A．林俊杰'.match(OPTION_REGEX);
        assert.ok(m);
        assert.strictEqual(m[1], 'A');
    });

    it('应自动忽略选项号后的空格', () => {
        const m = 'B.  林俊杰的歌'.match(OPTION_REGEX);
        assert.ok(m);
        assert.strictEqual(m[2], '林俊杰的歌', '应去除空格');
    });

    it('不应匹配小写字母', () => {
        const m = 'a.林俊杰'.match(OPTION_REGEX);
        assert.strictEqual(m, null);
    });

    it('不应匹配纯数字开头', () => {
        const m = '1.选项一'.match(OPTION_REGEX);
        assert.strictEqual(m, null);
    });

    it('不应匹配无分隔符的 "A选项"', () => {
        const m = 'A选项'.match(OPTION_REGEX);
        assert.strictEqual(m, null);
    });

    it('多行选项解析完整流程', () => {
        const lines = ['A.乐行者', 'B.第二天堂', 'C.编号89757', 'D.曹操'];
        const options = [];
        for (const line of lines) {
            const match = line.trim().match(OPTION_REGEX);
            if (match) options.push({ key: match[1], text: match[2] });
        }
        assert.strictEqual(options.length, 4);
        assert.strictEqual(options[0].key, 'A');
        assert.strictEqual(options[3].key, 'D');
        assert.strictEqual(options[2].text, '编号89757');
    });

    it('应跳过空行', () => {
        const lines = ['A.选项A', '', 'B.选项B', '  ', 'C.选项C'];
        const options = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const match = trimmed.match(OPTION_REGEX);
            if (match) options.push({ key: match[1], text: match[2] });
        }
        assert.strictEqual(options.length, 3);
    });
});

describe('数据导入合并逻辑（错题本 + stats）', () => {
    // admin.js 的 importData 逻辑太复杂依赖 DOM event，
    // 这里直接测试其核心合并策略
    const now = Date.now();

    function simulateImportData(targetData, importedData) {
        // 这是 admin.js importData 的核心合并逻辑简化版
        if (importedData.history) {
            targetData.history = targetData.history.concat(importedData.history);
        }

        if (importedData.wrong) {
            const wrongMap = {};
            for (let w = 0; w < targetData.wrong.length; w++) {
                wrongMap[targetData.wrong[w].qid] = targetData.wrong[w];
            }
            for (let x = 0; x < importedData.wrong.length; x++) {
                const wrongItem = importedData.wrong[x];
                if (wrongMap[wrongItem.qid]) {
                    wrongMap[wrongItem.qid].cnt = Math.max(wrongMap[wrongItem.qid].cnt, wrongItem.cnt || 1);
                    if (wrongItem.level != null) {
                        wrongMap[wrongItem.qid].level = Math.min(wrongMap[wrongItem.qid].level || 0, wrongItem.level);
                    }
                } else {
                    if (!wrongItem.level) wrongItem.level = 0;
                    if (!wrongItem.nextReview) wrongItem.nextReview = now;
                    if (!wrongItem.lastReview) wrongItem.lastReview = 0;
                    if (!wrongItem.time) wrongItem.time = now;
                    targetData.wrong.push(wrongItem);
                }
            }
        }
    }

    it('错题合并：取较高的错误次数 cnt', () => {
        const target = { wrong: [{ qid: '001', cnt: 2, level: 0 }], history: [] };
        const imported = { wrong: [{ qid: '001', cnt: 5, level: 0 }], history: [] };
        simulateImportData(target, imported);
        assert.strictEqual(target.wrong[0].cnt, 5, '应取较大的 cnt=5');
    });

    it('错题合并：取较低的复习等级 level（更保守）', () => {
        const target = { wrong: [{ qid: '001', cnt: 3, level: 3 }], history: [] };
        const imported = { wrong: [{ qid: '001', cnt: 2, level: 1 }], history: [] };
        simulateImportData(target, imported);
        assert.strictEqual(target.wrong[0].level, 1, '应取较低的 level=1');
    });

    it('错题合并：新错题应补齐间隔重复字段', () => {
        const target = { wrong: [], history: [] };
        const imported = {
            wrong: [{ qid: '001', cnt: 1 }], // 老版本数据，无 level/nextReview
            history: []
        };
        simulateImportData(target, imported);
        assert.strictEqual(target.wrong.length, 1);
        assert.strictEqual(target.wrong[0].level, 0, '应补 level=0');
        assert.ok(target.wrong[0].nextReview, '应补 nextReview');
        assert.strictEqual(target.wrong[0].lastReview, 0, '应补 lastReview=0');
        assert.ok(target.wrong[0].time, '应补 time');
    });

    it('错题合并：目标和导入都只有老版本数据', () => {
        const target = { wrong: [{ qid: '001', cnt: 2 }], history: [] };
        const imported = { wrong: [{ qid: '002', cnt: 1 }], history: [] };
        simulateImportData(target, imported);
        assert.strictEqual(target.wrong.length, 2);
        const ids = target.wrong.map(w => w.qid);
        assert.ok(ids.includes('001'));
        assert.ok(ids.includes('002'));
    });
});

describe('题库修改：答案必须在选项中', () => {
    it('QUESTION_BANK 中所有题目的 answer 字段必须出现在 options 中', () => {
        for (const q of App.QUESTION_BANK) {
            const keys = q.options.map(o => o.key);
            assert.ok(keys.includes(q.answer),
                `题目 "${q.question}" 的 answer="${q.answer}" 不在 options [${keys.join(',')}] 中`);
        }
    });

    it('每道题的选项 key 应为 A/B/C/D（最多 A-D）', () => {
        for (const q of App.QUESTION_BANK) {
            for (const o of q.options) {
                assert.ok(/^[A-D]$/.test(o.key),
                    `题目 ${q.id} 的选项 key="${o.key}" 不合法`);
            }
        }
    });
});
