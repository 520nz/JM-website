const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestEnv, loadAllSources } = require('./setup.js');

function setup() {
    const { window } = createTestEnv();
    loadAllSources(window);
    return window;
}

// ============ shuffle ============

test('shuffle - 打乱后长度不变', () => {
    const window = setup();
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = window.App.shuffle(arr);
    assert.equal(shuffled.length, arr.length);
});

test('shuffle - 打乱后元素集不变', () => {
    const window = setup();
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = window.App.shuffle(arr);
    assert.deepEqual([...shuffled].sort(), [...arr].sort());
});

test('shuffle - 不会修改原数组', () => {
    const window = setup();
    const arr = [1, 2, 3, 4, 5];
    const copy = arr.slice();
    window.App.shuffle(arr);
    assert.deepEqual(arr, copy);
});

test('shuffle - 空数组返回空数组', () => {
    const window = setup();
    const result = window.App.shuffle([]);
    assert.deepEqual(result, []);
});

test('shuffle - 单元素数组返回相同', () => {
    const window = setup();
    const result = window.App.shuffle([42]);
    assert.deepEqual(result, [42]);
});

// ============ 模式切换 ============

test('selectMode - 切换模式影响 state.mode', () => {
    const window = setup();
    const App = window.App;

    App.selectMode('quick');
    assert.equal(App.state.mode, 'quick');

    App.selectMode('standard');
    assert.equal(App.state.mode, 'standard');

    App.selectMode('intensive');
    assert.equal(App.state.mode, 'intensive');
});

test('selectMode - 切换后清除会话', () => {
    const window = setup();
    const App = window.App;
    App.session.save({ quizIds: ['001'], idx: 0, correctCount: 0, startTime: Date.now(), mode: 'quick' });
    App.selectMode('quick');
    assert.equal(App.session.load(), null);
});

// ============ 选项解析（admin.js saveQuestion 中的正则） ============

function parseOptions(optsText) {
    const lines = optsText.trim().split('\n');
    const options = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const match = trimmed.match(/^([A-Z])[.、．]\s*(.+)$/);
        if (match) options.push({ key: match[1], text: match[2] });
    }
    return options;
}

test('选项解析 - 标准格式 A.xxx', () => {
    const opts = parseOptions('A.选项一\nB.选项二\nC.选项三\nD.选项四');
    assert.equal(opts.length, 4);
    assert.deepEqual(opts[0], { key: 'A', text: '选项一' });
    assert.deepEqual(opts[2], { key: 'C', text: '选项三' });
});

test('选项解析 - 支持中文顿号 A、xxx', () => {
    const opts = parseOptions('A、中文顿号\nB、也行');
    assert.equal(opts.length, 2);
    assert.deepEqual(opts[0], { key: 'A', text: '中文顿号' });
});

test('选项解析 - 支持全角点 A．xxx', () => {
    const opts = parseOptions('A．全角点\nB．正常');
    assert.equal(opts.length, 2);
    assert.deepEqual(opts[0], { key: 'A', text: '全角点' });
});

test('选项解析 - 跳过空行', () => {
    const opts = parseOptions('A.选项一\n\nB.选项二\n\nC.选项三');
    assert.equal(opts.length, 3);
});

test('选项解析 - 点号后空格被 \s* 吸收，内容保留（已 trim）', () => {
    const opts = parseOptions('A.选项含空格\nB. 带空格的选项');
    assert.equal(opts.length, 2);
    assert.equal(opts[1].text, '带空格的选项');
});

test('选项解析 - 无效格式返回空数组', () => {
    const opts = parseOptions('随机文本\n不匹配的行');
    assert.equal(opts.length, 0);
});

// ============ tryResumeSession ============

test('tryResumeSession - 无保存会话返回 false', () => {
    const window = setup();
    const App = window.App;
    assert.equal(App.tryResumeSession(), false);
});

test('tryResumeSession - 已答完的会话不应恢复', () => {
    const window = setup();
    const App = window.App;
    App.db.init();

    const allIds = App.QUESTION_BANK.map(q => q.id);
    App.session.save({
        quizIds: allIds,
        idx: allIds.length,
        correctCount: 0,
        startTime: Date.now() - 60000,
        mode: 'quick'
    });

    App.state.quiz = App.QUESTION_BANK.slice();
    App.state.idx = allIds.length;

    assert.equal(App.tryResumeSession(), false);
    assert.equal(App.session.load(), null, '已答完的会话应被清除');
});

test('tryResumeSession - 正常恢复会话', () => {
    const window = setup();
    const App = window.App;
    App.db.init();

    const ids = ['001', '005', '009'];
    const startTime = Date.now() - 30000;
    // sessionSave 期望完整 state，包含 quiz 数组
    const fakeQuiz = ids.map(id => ({ id, question: 'dummy' }));
    App.session.save({
        quiz: fakeQuiz,
        idx: 1,
        correctCount: 0,
        startTime: startTime,
        mode: 'quick'
    });

    const result = App.tryResumeSession();
    assert.equal(result, true);
    assert.equal(App.state.idx, 1);
    assert.equal(App.state.quiz.length, 3);
    assert.ok(App.state.startTime <= Date.now());
    assert.equal(App.state.mode, 'quick');
});

// ============ 答题流程（pickOption） ============

function setupQuiz() {
    const window = setup();
    const App = window.App;
    App.db.init();

    // 创建渲染好的 DOM 结构
    const quizArea = window.document.createElement('div');
    quizArea.id = 'quizArea';
    window.document.body.appendChild(quizArea);

    App.state.quiz = [App.QUESTION_BANK[0]];
    App.state.idx = 0;
    App.state.answered = false;
    App.state.isWrongBookQuiz = false;

    // 模拟 renderQ 产生的 DOM
    App.renderQ();

    return { window, App };
}

test('pickOption - 答对时 correctCount 增加', () => {
    const { App } = setupQuiz();
    const q = App.state.quiz[0];
    const before = App.state.correctCount;
    App.pickOption(q.answer);
    assert.equal(App.state.correctCount, before + 1);
});

test('pickOption - 答错时 correctCount 不变', () => {
    const { App } = setupQuiz();
    const q = App.state.quiz[0];
    const before = App.state.correctCount;
    const wrongKey = q.options.find(o => o.key !== q.answer).key;
    App.pickOption(wrongKey);
    assert.equal(App.state.correctCount, before);
});

test('pickOption - 答错时加入错题本（普通模式）', () => {
    const { App } = setupQuiz();
    const q = App.state.quiz[0];
    const before = App.db.getWrong().length;
    const wrongKey = q.options.find(o => o.key !== q.answer).key;
    App.pickOption(wrongKey);
    assert.equal(App.db.getWrong().length, before + 1, '普通模式答错应加入错题本');
});

test('pickOption - 已回答后再次选择不生效', () => {
    const { App } = setupQuiz();
    const q = App.state.quiz[0];
    App.pickOption(q.answer);
    const countAfterFirst = App.state.correctCount;

    App.state.answered = true;
    const wrongKey = q.options.find(o => o.key !== q.answer).key;
    App.pickOption(wrongKey);
    assert.equal(App.state.correctCount, countAfterFirst);
});

test('pickOption - 记录答题记录', () => {
    const { App } = setupQuiz();
    const beforeTotal = App.db.get().stats.total;
    const q = App.state.quiz[0];
    App.pickOption(q.answer);
    assert.equal(App.db.get().stats.total, beforeTotal + 1);
});

test('pickOption - 错题本模式答对时调用 reviewCorrect', () => {
    const { App } = setupQuiz();
    App.state.isWrongBookQuiz = true;
    const q = App.state.quiz[0];
    App.db.addWrong(q.id);

    App.pickOption(q.answer);
    const w = App.db.getWrong()[0];
    assert.ok(w.level >= 1, '错题本模式答对应提升等级');
});

test('pickOption - 错题本模式答错时调用 reviewWrong', () => {
    const { App } = setupQuiz();
    App.state.isWrongBookQuiz = true;
    const q = App.state.quiz[0];
    App.db.addWrong(q.id);
    App.db.getWrong()[0].level = 3;

    const wrongKey = q.options.find(o => o.key !== q.answer).key;
    App.pickOption(wrongKey);
    const w = App.db.getWrong()[0];
    assert.equal(w.level, 0, '错题本模式答错应重置等级为 0');
});

test('startWrongBookQuiz - 无错题时不启动', () => {
    const { App } = setupQuiz();
    App.state.quiz = [];
    App.startWrongBookQuiz();
    assert.equal(App.state.quiz.length, 0);
});
