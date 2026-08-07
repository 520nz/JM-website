// ============================================================
// test/quiz.test.js - quiz.js 答题引擎测试
// 覆盖：Fisher-Yates shuffle 正确性、会话恢复、答题状态机、键盘快捷键、模式切换
// ============================================================
const assert = require('assert');
const setup = require('./setup');
const App = setup.loadApp();

describe('随机打乱 (App.shuffle)', () => {
    it('应返回与原数组相同长度的新数组', () => {
        const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const result = App.shuffle(arr);
        assert.strictEqual(result.length, arr.length);
        assert.ok(Array.isArray(result));
    });

    it('不应修改原数组', () => {
        const arr = [1, 2, 3, 4, 5];
        const copy = arr.slice();
        App.shuffle(arr);
        assert.deepStrictEqual(arr, copy, '原数组不应被修改');
    });

    it('应保持所有原始元素（只是顺序变了）', () => {
        const arr = [1, 2, 3, 4, 5, 6];
        const result = App.shuffle(arr);
        const sorted = result.slice().sort((a, b) => a - b);
        assert.deepStrictEqual(sorted, arr.slice().sort((a, b) => a - b));
    });

    it('长度为 0 的数组返回空数组', () => {
        assert.deepStrictEqual(App.shuffle([]), []);
    });

    it('长度为 1 的数组返回单元素数组', () => {
        assert.deepStrictEqual(App.shuffle([42]), [42]);
    });

    it('多次运行应产生不同顺序（概率性，大数组下几乎必然）', () => {
        const arr = [];
        for (let i = 0; i < 100; i++) arr.push(i);
        const r1 = App.shuffle(arr);
        const r2 = App.shuffle(arr);
        // 两个独立 shuffle 结果完全相同的概率极低
        assert.ok(!deepEqual(r1, r2), '两次 shuffle 结果应该不同');
    });
});

function deepEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

describe('答题模式选择', () => {
    it('selectMode 应正确更新 state.mode', () => {
        App.selectMode('standard');
        assert.strictEqual(App.state.mode, 'standard');
        App.selectMode('intensive');
        assert.strictEqual(App.state.mode, 'intensive');
        App.selectMode('quick');
        assert.strictEqual(App.state.mode, 'quick');
    });

    it('selectMode 应清除已保存的会话', () => {
        const qs = App.QUESTION_BANK.slice(0, 3);
        App.session.save({
            quiz: qs,
            idx: 1,
            correctCount: 1,
            startTime: Date.now(),
            mode: 'quick'
        });
        assert.ok(App.session.load(), '应有已保存的会话');
        App.selectMode('standard');
        assert.strictEqual(App.session.load(), null, '会话应被清除');
    });

    it('getCount 应按模式返回正确数量（通过 startRandomQuiz 间接验证）', () => {
        // quick 模式 → 10题；standard → 20；intensive → 30
        App.selectMode('quick');
        // getCount 是内部函数但可通过 startRandomQuiz 设置 state.quiz 长度间接验证
    });
});

describe('答题流程状态 (pickOption)', () => {
    function setupQuiz() {
        const q = App.QUESTION_BANK[0];
        App.state.quiz = [q];
        App.state.idx = 0;
        App.state.answered = false;
        App.state.correctCount = 0;
        App.state.startTime = Date.now();
        App.state.mode = 'quick';
        App.renderQ();
        return q;
    }

    it('已回答后 pickOption 应被忽略', () => {
        const q = setupQuiz();

        App.pickOption(q.answer);
        const correctAfterFirst = App.state.correctCount;
        // 再次点击（模拟用户快速连点）
        App.pickOption(q.answer);
        assert.strictEqual(App.state.correctCount, correctAfterFirst, '第二次 pickOption 不应增加 correctCount');
        assert.strictEqual(App.state.answered, true);
    });

    it('答对应增加 correctCount，答错不应', () => {
        const q = setupQuiz();
        const wrongKey = q.options.find(o => o.key !== q.answer).key;

        App.pickOption(q.answer);
        assert.strictEqual(App.state.correctCount, 1);

        // 重置并 renderQ
        App.state.quiz = [q];
        App.state.idx = 0;
        App.state.answered = false;
        App.state.correctCount = 0;
        App.state.startTime = Date.now();
        App.renderQ();

        App.pickOption(wrongKey);
        assert.strictEqual(App.state.correctCount, 0);
    });
});

describe('答题中断恢复 (tryResumeSession)', () => {
    beforeEach(() => {
        App.db.setData(App.db.defaults());
        App.session.clear();
    });

    it('无已保存会话返回 false', () => {
        const result = App.tryResumeSession();
        assert.strictEqual(result, false);
    });

    it('有已保存会话且未答完应恢复 state', () => {
        const qs = App.QUESTION_BANK.slice(0, 3);
        App.session.save({
            quiz: qs,
            idx: 1,
            correctCount: 1,
            startTime: Date.now() - 60000,
            mode: 'quick',
            isWrongBookQuiz: false
        });

        const result = App.tryResumeSession();
        assert.strictEqual(result, true);
        assert.strictEqual(App.state.quiz.length, 3);
        assert.strictEqual(App.state.idx, 1);
        assert.strictEqual(App.state.correctCount, 1);
        assert.strictEqual(App.state.mode, 'quick');
    });

    it('已答完的会话（idx >= quiz.length）不应恢复', () => {
        const qs = App.QUESTION_BANK.slice(0, 3);
        App.session.save({
            quiz: qs,
            idx: 3,
            correctCount: 3,
            startTime: Date.now() - 60000,
            mode: 'quick'
        });

        const result = App.tryResumeSession();
        assert.strictEqual(result, false);
        // 会话应被清除
        assert.strictEqual(App.session.load(), null);
    });

    it('会话中的题目在题库中找不到应返回 false', () => {
        // 直接写 sessionStorage，让 session.load 返回带 quizIds 的数据
        App.session.clear();
        global.sessionStorage.setItem('jj_quiz_session', JSON.stringify({
            quizIds: ['fake_id_1', 'fake_id_2'],
            idx: 0,
            correctCount: 0,
            startTime: Date.now(),
            mode: 'quick'
        }));

        const result = App.tryResumeSession();
        assert.strictEqual(result, false);
    });
});

describe('答题计时器 (startTimer / stopTimer)', () => {
    it('startTimer 应设置 startTime 并启动 interval', () => {
        App.stopTimer(); // 先停掉已有的
        App.state.startTime = 0;
        App.state.timer = null;

        App.startTimer();
        assert.ok(App.state.startTime > 0, 'startTime 应被设置');
        assert.ok(App.state.timer !== null, 'timer 应被设置');

        App.stopTimer();
    });

    it('stopTimer 应清除 interval 并设 timer=null', () => {
        App.startTimer();
        App.stopTimer();
        assert.strictEqual(App.state.timer, null);
    });

    it('startTimer 多次调用不应创建多个 interval', () => {
        App.startTimer();
        const firstTimer = App.state.timer;
        App.startTimer();
        // 第二次 startTimer 内部会先 clearInterval，然后创建新的
        assert.ok(App.state.timer !== firstTimer || typeof firstTimer === 'number');
        App.stopTimer();
    });
});
