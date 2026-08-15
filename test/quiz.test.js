const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { setup, loadScript } = require('./setup');

async function bootstrap() {
    setup();

    // 预创建 quiz.js / app.js / admin.js 可能用到的所有 DOM 元素
    const el = (id, text = '') => {
        const d = global.document.createElement('div');
        d.id = id;
        d.textContent = text;
        d.classList = { add: () => {}, remove: () => {}, toggle: () => {} };
        d.style = {};
        d.innerHTML = '';
        return d;
    };

    // renderQ 需要
    global.document.body.appendChild(el('quizArea'));
    global.document.body.appendChild(el('opt-A'));
    global.document.body.appendChild(el('opt-B'));
    global.document.body.appendChild(el('opt-C'));
    global.document.body.appendChild(el('opt-D'));

    const fb = global.document.createElement('div');
    fb.id = 'fb';
    fb.classList = { add: () => {}, remove: () => {}, toggle: () => {} };
    global.document.body.appendChild(fb);

    global.document.body.appendChild(el('fbTitle'));
    global.document.body.appendChild(el('fbDesc'));
    const nextBtn = global.document.createElement('button');
    nextBtn.id = 'nextBtn';
    nextBtn.style = {};
    global.document.body.appendChild(nextBtn);

    const timerVal = global.document.createElement('span');
    timerVal.id = 'timerVal';
    global.document.body.appendChild(timerVal);

    // selectMode 需要
    const modeBtn = global.document.createElement('div');
    modeBtn.className = 'mode-btn';
    modeBtn.setAttribute('data-mode', 'quick');
    global.document.body.appendChild(modeBtn);

    // showCategoryView 需要
    global.document.body.appendChild(el('categoryList'));

    loadScript(path.join(__dirname, '..', 'js', 'data.js'));
    loadScript(path.join(__dirname, '..', 'js', 'storage.js'));
    loadScript(path.join(__dirname, '..', 'js', 'quiz.js'));

    // Mock app-level functions
    global.App.switchView = () => {};
    global.App.startTimer = () => {};
    global.App.stopTimer = () => {};

    await global.App.db.init();
    global.App.db.setData(global.App.db.defaults());
}

// ============================================================
// shuffle: Fisher-Yates
// ============================================================

test('shuffle: 打乱后元素数量保持不变', async () => {
    await bootstrap();
    const arr = [1, 2, 3, 4, 5];
    const shuffled = global.App.shuffle(arr);
    assert.equal(shuffled.length, 5);
    assert.equal(arr.length, 5, '原数组不应被修改');
});

test('shuffle: 打乱后集合相等', async () => {
    await bootstrap();
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = global.App.shuffle(arr);
    assert.deepEqual(shuffled.slice().sort(), arr.slice().sort());
});

test('shuffle: 空数组 -> 空数组', async () => {
    await bootstrap();
    assert.deepEqual(global.App.shuffle([]), []);
});

test('shuffle: 单元素 -> 相同', async () => {
    await bootstrap();
    assert.deepEqual(global.App.shuffle([42]), [42]);
});

// ============================================================
// fmtTime（同 quiz.js 内逻辑的本地副本，直接测试该算法）
// ============================================================

function fmtTime(ms) {
    var sec = Math.floor(ms / 1000);
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + '分' + s + '秒';
}

test('fmtTime: 59秒 -> 0分59秒', () => assert.equal(fmtTime(59000), '0分59秒'));
test('fmtTime: 60秒 -> 1分0秒', () => assert.equal(fmtTime(60000), '1分0秒'));
test('fmtTime: 90秒 -> 1分30秒', () => assert.equal(fmtTime(90000), '1分30秒'));
test('fmtTime: 3661秒 -> 61分1秒', () => assert.equal(fmtTime(3661000), '61分1秒'));

// ============================================================
// selectMode
// ============================================================

test('selectMode: 更新 state.mode 并清除 session', async () => {
    await bootstrap();
    global.App.state.quiz = [{ id: '001' }];
    global.App.state.idx = 0;
    global.App.state.correctCount = 0;
    global.App.state.startTime = 0;
    global.App.state.mode = 'quick';
    global.App.session.save(global.App.state);
    assert.ok(global.App.session.load(), '切换前有 session');
    global.App.selectMode('standard');
    assert.equal(global.App.state.mode, 'standard');
    assert.equal(global.App.session.load(), null, '切换后 session 应被清除');
});

// ============================================================
// pickOption: 答题状态机
// ============================================================

const QUIZ_Q = {
    id: '001', question: 'Q',
    options: [
        { key: 'A', text: 'answer' },
        { key: 'B', text: 'wrong' },
        { key: 'C', text: 'wrong' },
        { key: 'D', text: 'wrong' }
    ],
    answer: 'A', explanation: 'why A'
};

test('pickOption: 答对 -> correctCount++, answered=true', async () => {
    await bootstrap();
    global.App.db.setData(global.App.db.defaults());
    global.App.state.quiz = [QUIZ_Q];
    global.App.state.idx = 0;
    global.App.state.correctCount = 0;
    global.App.state.isWrongBookQuiz = false;
    global.App.state.startTime = Date.now();
    global.App.state.answered = false;

    global.App.pickOption('A');
    assert.equal(global.App.state.answered, true);
    assert.equal(global.App.state.correctCount, 1);

    // 二次调用被忽略
    global.App.pickOption('A');
    assert.equal(global.App.state.correctCount, 1);
});

test('pickOption: 答错（普通模式）-> 加入错题本', async () => {
    await bootstrap();
    global.App.db.setData(global.App.db.defaults());
    global.App.state.quiz = [QUIZ_Q];
    global.App.state.idx = 0;
    global.App.state.correctCount = 0;
    global.App.state.isWrongBookQuiz = false;
    global.App.state.startTime = Date.now();
    global.App.state.answered = false;

    global.App.pickOption('B');
    assert.equal(global.App.state.correctCount, 0);
    const wrong = global.App.db.getWrong();
    assert.equal(wrong.length, 1);
    assert.equal(wrong[0].qid, '001');
});

test('pickOption: 错题本模式答对 -> reviewCorrect 提升等级', async () => {
    await bootstrap();
    global.App.db.setData(global.App.db.defaults());
    global.App.db.addWrong('001');
    global.App.state.quiz = [QUIZ_Q];
    global.App.state.idx = 0;
    global.App.state.isWrongBookQuiz = true;
    global.App.state.startTime = Date.now();
    global.App.state.answered = false;

    global.App.pickOption('A');
    const wrong = global.App.db.getWrong();
    assert.equal(wrong[0].level, 1);
});

test('pickOption: 错题本模式答错 -> reviewWrong 重置 level 并 cnt++', async () => {
    await bootstrap();
    global.App.db.setData(global.App.db.defaults());
    global.App.db.addWrong('001');
    global.App.db.reviewCorrect('001');
    global.App.state.quiz = [QUIZ_Q];
    global.App.state.idx = 0;
    global.App.state.isWrongBookQuiz = true;
    global.App.state.startTime = Date.now();
    global.App.state.answered = false;

    global.App.pickOption('B');
    const wrong = global.App.db.getWrong();
    assert.equal(wrong[0].level, 0);
    assert.equal(wrong[0].cnt, 2);
});

test('pickOption: 错题本模式连对 5 次 -> 从错题本移除', async () => {
    await bootstrap();
    global.App.db.setData(global.App.db.defaults());
    global.App.db.addWrong('001');
    global.App.state.quiz = [QUIZ_Q];
    global.App.state.idx = 0;
    global.App.state.isWrongBookQuiz = true;
    global.App.state.startTime = Date.now();

    for (let i = 0; i < 5; i++) {
        global.App.state.answered = false;
        global.App.pickOption('A');
    }
    assert.equal(global.App.db.getWrong().length, 0, '掌握后应从错题本移除');
});

// ============================================================
// tryResumeSession
// ============================================================

test('tryResumeSession: 无保存会话 -> false', async () => {
    await bootstrap();
    assert.equal(global.App.tryResumeSession(), false);
});

test('tryResumeSession: 恢复未完成会话 -> 正确重建状态', async () => {
    await bootstrap();
    global.sessionStorage.setItem('jj_quiz_session', JSON.stringify({
        quizIds: ['001', '002', '003'],
        idx: 1,
        correctCount: 1,
        startTime: Date.now() - 60000,
        mode: 'quick'
    }));
    const ok = global.App.tryResumeSession();
    assert.equal(ok, true);
    assert.equal(global.App.state.quiz.length, 3);
    assert.equal(global.App.state.idx, 1);
    assert.equal(global.App.state.correctCount, 1);
    assert.equal(global.App.state.mode, 'quick');
});

test('tryResumeSession: 已答完 (idx >= quizIds.length) -> false 并清除', async () => {
    await bootstrap();
    global.sessionStorage.setItem('jj_quiz_session', JSON.stringify({
        quizIds: ['001', '002'],
        idx: 2,
        correctCount: 2,
        startTime: Date.now() - 60000,
        mode: 'quick'
    }));
    const ok = global.App.tryResumeSession();
    assert.equal(ok, false);
    assert.equal(global.App.session.load(), null);
});

test('tryResumeSession: 全部题目找不到 -> false', async () => {
    await bootstrap();
    global.sessionStorage.setItem('jj_quiz_session', JSON.stringify({
        quizIds: ['ZZZ', 'YYY'],
        idx: 0,
        correctCount: 0,
        startTime: Date.now() - 60000,
        mode: 'quick'
    }));
    assert.equal(global.App.tryResumeSession(), false);
});

// ============================================================
// startCatQuiz: 分类筛选 + 题目数不足处理
// ============================================================

test('startCatQuiz: 题目只包含指定分类', async () => {
    await bootstrap();
    global.App.startCatQuiz('获奖记录');
    const quiz = global.App.state.quiz;
    assert.ok(quiz.length > 0);
    for (let i = 0; i < quiz.length; i++) {
        assert.equal(quiz[i].category, '获奖记录');
    }
});

test('startCatQuiz: 不存在的分类 -> quiz 为空', async () => {
    await bootstrap();
    global.App.startCatQuiz('不存在的分类_XYZ');
    assert.equal(global.App.state.quiz.length, 0);
});

// ============================================================
// startWrongBookQuiz
// ============================================================

test('startWrongBookQuiz: 无错题 -> 不启动', async () => {
    await bootstrap();
    global.App.db.setData(global.App.db.defaults());
    global.App.state.quiz = [];
    global.App.state.idx = 0;
    global.App.startWrongBookQuiz();
    assert.equal(global.App.state.quiz.length, 0);
});

test('startWrongBookQuiz: 有错题 -> 加载错题且 isWrongBookQuiz=true', async () => {
    await bootstrap();
    global.App.db.setData(global.App.db.defaults());
    global.App.db.addWrong('001');
    global.App.db.addWrong('002');
    global.App.state.startTime = Date.now();
    global.App.startWrongBookQuiz();
    assert.ok(global.App.state.quiz.length >= 1);
    assert.equal(global.App.state.isWrongBookQuiz, true);
});

// ============================================================
// esc: XSS 转义
// ============================================================

test('esc: null/undefined -> 空字符串', async () => {
    await bootstrap();
    assert.equal(global.App.esc(null), '');
    assert.equal(global.App.esc(undefined), '');
});

test('esc: 纯文本保持不变', async () => {
    await bootstrap();
    assert.equal(global.App.esc('hello'), 'hello');
});

test('esc: script 标签应被转义', async () => {
    await bootstrap();
    const result = global.App.esc('<script>alert(1)</script>');
    assert.ok(!result.includes('<script>'), '不应包含原始 script 标签');
});

test('esc: 数字 -> 字符串', async () => {
    await bootstrap();
    assert.equal(global.App.esc(42), '42');
});

// ============================================================
// 答题完整流程：pickOption -> finishQuiz 结果计算
// ============================================================

test('完整流程: 10题全对 -> correctCount=10, state.lastResult 正确', async () => {
    await bootstrap();
    global.App.db.setData(global.App.db.defaults());
    // Mock renderQ 让它不操作 DOM
    global.App.renderQ = () => {};
    global.App.finishQuiz = () => {
        const total = global.App.state.quiz.length;
        const correct = global.App.state.correctCount;
        global.App.state.lastResult = {
            total, correct, wrong: total - correct,
            pct: total > 0 ? Math.round(correct / total * 100) : 0
        };
    };

    // 构造 10 道正确答案都是 A 的题
    global.App.state.quiz = [];
    for (let i = 0; i < 10; i++) {
        global.App.state.quiz.push({
            id: String(i + 1).padStart(3, '0'),
            question: 'Q' + i,
            options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }],
            answer: 'A', explanation: 'e'
        });
    }
    global.App.state.idx = 0;
    global.App.state.correctCount = 0;
    global.App.state.isWrongBookQuiz = false;
    global.App.state.startTime = Date.now();

    for (let i = 0; i < 10; i++) {
        global.App.state.answered = false;
        global.App.pickOption('A');
        global.App.state.idx++;
    }

    global.App.finishQuiz();
    assert.equal(global.App.state.lastResult.correct, 10);
    assert.equal(global.App.state.lastResult.wrong, 0);
    assert.equal(global.App.state.lastResult.pct, 100);
});
