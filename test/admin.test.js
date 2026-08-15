const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { setup, loadScript } = require('./setup');

function makeFileReader(content) {
    return function () {
        const self = this;
        this.onload = null;
        this.onerror = null;
        this.result = content;
        this.readAsText = function () {
            self.result = content;
            if (self.onload) self.onload({ target: { result: content } });
        };
    };
}

async function bootstrap() {
    setup();

    global.window.alert = () => {};
    global.window.FileReader = makeFileReader('');

    loadScript(path.join(__dirname, '..', 'js', 'data.js'));
    loadScript(path.join(__dirname, '..', 'js', 'storage.js'));
    loadScript(path.join(__dirname, '..', 'js', 'quiz.js'));

    global.App.store = { save: () => {}, reset: () => {} };
    global.App.updateHome = () => {};
    // 让 setTimeout 同步执行，避免 JSDOM event loop 问题
    global.window.setTimeout = (fn) => fn();

    await global.App.db.init();
    global.App.db.setData(global.App.db.defaults());

    loadScript(path.join(__dirname, '..', 'js', 'admin.js'));
}

function triggerImport(fileContent) {
    global.window.FileReader = makeFileReader(fileContent);

    let savedBank = null;
    const origSave = global.App.store.save;
    global.App.store.save = function () { savedBank = global.App.QUESTION_BANK; };

    const file = { name: 'test.json' };
    const event = { target: { files: [file], value: '' } };
    global.App.importData(event);

    global.App.store.save = origSave;
    return { savedBank };
}

// ============================================================
// importData: 题库去重与更新
// ============================================================

test('importData: 导入新题目应追加到 QUESTION_BANK', async () => {
    await bootstrap();
    const beforeLen = global.App.QUESTION_BANK.length;
    const data = {
        questionBank: [
            { id: 'NEW001', question: 'q1', options: [], answer: 'A', category: '测试' }
        ]
    };
    triggerImport(JSON.stringify(data));
    assert.equal(global.App.QUESTION_BANK.length, beforeLen + 1);
    const found = global.App.QUESTION_BANK.find(q => q.id === 'NEW001');
    assert.ok(found);
});

test('importData: 导入重复 ID 题目应更新而非追加', async () => {
    await bootstrap();
    const existing = global.App.QUESTION_BANK[0];
    const data = {
        questionBank: [
            { id: existing.id, question: '更新后的题目', options: [], answer: 'B', category: existing.category }
        ]
    };
    triggerImport(JSON.stringify(data));
    const updated = global.App.QUESTION_BANK.find(q => q.id === existing.id);
    assert.equal(updated.question, '更新后的题目');
    assert.equal(updated.answer, 'B');
});

// ============================================================
// importData: 用户数据 - history 合并
// ============================================================

test('importData: history 应直接 concat 合并', async () => {
    await bootstrap();
    global.App.db.addRecord({ qid: '001', ok: true, time: Date.now() - 1000 });

    const data = {
        userData: {
            history: [
                { qid: '002', ok: false, time: Date.now() },
                { qid: '003', ok: true, time: Date.now() }
            ],
            wrong: []
        }
    };
    triggerImport(JSON.stringify(data));
    const d = global.App.db.get();
    assert.equal(d.history.length, 3);
});

// ============================================================
// importData: 错题本合并逻辑（核心复杂度）
// ============================================================

test('importData: 新错题应自动补全间隔重复字段', async () => {
    await bootstrap();
    const data = {
        userData: {
            history: [],
            wrong: [
                { qid: 'ABC', cnt: 3 }
            ]
        }
    };
    triggerImport(JSON.stringify(data));
    const wrong = global.App.db.getWrong();
    assert.equal(wrong.length, 1);
    assert.equal(wrong[0].qid, 'ABC');
    assert.equal(wrong[0].level, 0, '新错题默认 level=0');
    assert.equal(typeof wrong[0].nextReview, 'number');
    assert.equal(typeof wrong[0].time, 'number');
    assert.equal(wrong[0].lastReview, 0);
});

test('importData: 错题合并 - cnt 取两者最大值', async () => {
    await bootstrap();
    // 本地已有错题 qid=X, addWrong 会使 cnt=1, 再次 addWrong 会 cnt=2
    global.App.db.addWrong('X');
    global.App.db.addWrong('X');

    const data = {
        userData: {
            history: [],
            wrong: [
                { qid: 'X', cnt: 5, level: 3 }
            ]
        }
    };
    triggerImport(JSON.stringify(data));
    const wrong = global.App.db.getWrong();
    const x = wrong.find(w => w.qid === 'X');
    assert.ok(x, '错题 X 应存在');
    assert.ok(x.cnt >= 5, 'cnt 应取 max(2,5)=5');
});

test('importData: 错题合并 - level 取两者较小值（更保守）', async () => {
    await bootstrap();
    // 本地: 通过多次 reviewCorrect 让 level=4
    global.App.db.addWrong('Q01');
    global.App.db.reviewCorrect('Q01'); // level=1
    global.App.db.reviewCorrect('Q01'); // level=2
    global.App.db.reviewCorrect('Q01'); // level=3
    global.App.db.reviewCorrect('Q01'); // level=4

    const data = {
        userData: {
            history: [],
            wrong: [
                { qid: 'Q01', cnt: 10, level: 0 }
            ]
        }
    };
    triggerImport(JSON.stringify(data));
    const wrong = global.App.db.getWrong();
    const q = wrong.find(w => w.qid === 'Q01');
    assert.ok(q);
    assert.equal(q.level, 0, 'level 应取 min(4,0)=0');
});

// ============================================================
// importData: 关键 Bug 修复 - 不直接累加 stats，而是从 history 重算
// ============================================================

test('importData: 导入 userData 后 stats 应从 history 重算而非累加', async () => {
    await bootstrap();
    // 本地：2 条记录（1对1错）
    global.App.db.addRecord({ qid: '001', ok: true, time: Date.now() - 2000 });
    global.App.db.addRecord({ qid: '002', ok: false, time: Date.now() - 1000 });

    // 导入：history 3 条（2对1错），但 userData.stats 是伪造的 { total: 999, correct: 999 }
    const data = {
        userData: {
            history: [
                { qid: '003', ok: true, time: Date.now() - 3000 },
                { qid: '004', ok: true, time: Date.now() - 3000 },
                { qid: '005', ok: false, time: Date.now() - 3000 }
            ],
            wrong: [],
            stats: { total: 999, correct: 999 } // 伪造的 stats 必须被 recalcStats 覆盖
        }
    };
    triggerImport(JSON.stringify(data));

    const d = global.App.db.get();
    assert.equal(d.stats.total, 5, '应为 2+3=5，不是 2+999');
    assert.equal(d.stats.correct, 3, '应为 1+2=3，不是 1+999');
});

// ============================================================
// importData: 边界条件 - 无效输入
// ============================================================

test('importData: 无效 JSON 应触发 alert 且不修改数据', async () => {
    await bootstrap();
    const beforeLen = global.App.QUESTION_BANK.length;
    const beforeStats = JSON.stringify(global.App.db.get().stats);
    let alertMsg = null;
    global.window.alert = function (msg) { alertMsg = msg; };

    global.window.FileReader = makeFileReader('{ invalid json }');
    const event = { target: { files: [{ name: 'bad.json' }] } };
    global.App.importData(event);

    assert.ok(alertMsg && alertMsg.includes('JSON'), '应提示 JSON 格式错误');
    assert.equal(global.App.QUESTION_BANK.length, beforeLen);
    assert.equal(JSON.stringify(global.App.db.get().stats), beforeStats);
});

test('importData: 缺少 questionBank 和 userData 字段应失败', async () => {
    await bootstrap();
    let alertMsg = null;
    global.window.alert = function (msg) { alertMsg = msg; };

    global.window.FileReader = makeFileReader(JSON.stringify({ foo: 'bar' }));
    global.App.importData({ target: { files: [{ name: 'x.json' }] } });
    assert.ok(alertMsg && alertMsg.includes('未找到有效数据'));
});

// ============================================================
// importData: 只导入 questionBank（无 userData）
// ============================================================

test('importData: 只导入题库不影响用户数据', async () => {
    await bootstrap();
    global.App.db.addRecord({ qid: '001', ok: true, time: Date.now() });

    const data = {
        questionBank: [
            { id: 'NEW002', question: 'q2', options: [], answer: 'C', category: '测试' }
        ]
    };
    triggerImport(JSON.stringify(data));

    assert.ok(global.App.QUESTION_BANK.find(q => q.id === 'NEW002'));
    const d = global.App.db.get();
    assert.equal(d.stats.total, 1, '用户数据不应受影响');
});
