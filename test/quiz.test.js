// ============================================================
// test/quiz.test.js
// quiz.js 答题引擎核心逻辑测试
// 重点覆盖：shuffle、tryResumeSession、pickOption（普通/错题模式分支）
// ============================================================

const T = require('./test-runner');

// ========== shuffle ==========
T.describe('App.shuffle — Fisher-Yates 洗牌', function() {
    T.it('空数组返回空数组', function() {
        T.loadFreshSource();
        T.assertDeepEqual(global.window.App.shuffle([]), []);
    });
    T.it('单元素数组保持不变', function() {
        T.loadFreshSource();
        T.assertDeepEqual(global.window.App.shuffle([42]), [42]);
    });
    T.it('返回原数组的拷贝（不修改入参）', function() {
        T.loadFreshSource();
        const input = [1, 2, 3, 4, 5];
        const inputCopy = input.slice();
        const out = global.window.App.shuffle(input);
        T.assertDeepEqual(input, inputCopy, 'input untouched');
        T.assertNotEqual(out, input, 'returned a different array reference');
    });
    T.it('洗牌后元素集合一致（无丢失/无新增）', function() {
        T.loadFreshSource();
        const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const out = global.window.App.shuffle(input);
        T.assertDeepEqual(out.slice().sort(), input.slice().sort());
    });
    T.it('多次洗牌结果可不同（统计意义）', function() {
        T.loadFreshSource();
        const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        // 元素太少无法保证打乱差异，但 12 元素 1000 次应至少出现 2 种以上不同结果
        const seen = new Set();
        for (let i = 0; i < 200; i++) {
            seen.add(global.window.App.shuffle(input).join(','));
        }
        T.assertTrue(seen.size > 1, 'should produce varied permutations, got ' + seen.size);
    });
});

// ========== getCount（间接验证） ==========
T.describe('App.getCount — 模式对应题数（间接验证）', function() {
    T.it('quick/standard/intensive 通过 selectMode 影响 state.mode', function() {
        T.loadFreshSource();
        const A = global.window.App;
        A.selectMode('quick');
        T.assertEqual(A.state.mode, 'quick');
        A.selectMode('standard');
        T.assertEqual(A.state.mode, 'standard');
        A.selectMode('intensive');
        T.assertEqual(A.state.mode, 'intensive');
    });
    T.it('selectMode 同时清除 session（避免切模式后误恢复）', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const A = global.window.App;
        A.session.save({ quiz: [{ id: '001' }], idx: 0, correctCount: 0, startTime: 0, mode: 'quick' });
        T.assertNotNull(A.session.load());
        A.selectMode('standard');
        T.assertNull(A.session.load(), '切模式后 session 被清空');
    });
});

// ========== fmtTime / tickTimer 间接 ==========
T.describe('App.fmtTime — 时间格式化', function() {
    // 内部函数，间接通过 finishQuiz 触发；这里只测可观察行为：
    // 完成答题后 lastResult.elapsed 由 Date.now() 推算
    T.it('通过 finishQuiz 暴露的 lastResult 校验 elapsed 与 pct', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const A = global.window.App;
        // 模拟一次 3 题全对
        A.state.quiz = [
            { id: 'q001', options: [{ key: 'A', text: '' }], answer: 'A', explanation: '' },
            { id: 'q002', options: [{ key: 'A', text: '' }], answer: 'A', explanation: '' },
            { id: 'q003', options: [{ key: 'A', text: '' }], answer: 'A', explanation: '' }
        ];
        A.state.idx = 0;
        A.state.correctCount = 0;
        A.state.startTime = Date.now() - 65 * 1000; // 1分05秒前开始
        A.state.mode = 'quick';
        A.state.isWrongBookQuiz = false;
        A.finishQuiz();
        T.assertEqual(A.state.lastResult.total, 3);
        T.assertEqual(A.state.lastResult.correct, 0, 'no picks made');
        T.assertEqual(A.state.lastResult.pct, 0);
        T.assertTrue(A.state.lastResult.elapsed >= 65000);
    });
});

// ========== tryResumeSession ==========
T.describe('App.tryResumeSession — 答题中断恢复', function() {
    T.it('没有保存会话时返回 false', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        T.assertFalse(global.window.App.tryResumeSession());
    });
    T.it('已答完（idx >= quiz.length）清除会话并返回 false', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const A = global.window.App;
        // 写入一个 idx >= length 的会话（用真实题 id）
        A.session.save({ quiz: [{ id: '001' }], idx: 1, correctCount: 1, startTime: Date.now(), mode: 'quick' });
        T.assertFalse(A.tryResumeSession());
        T.assertNull(A.session.load(), 'cleared');
    });
    T.it('正常恢复：state.quiz / idx / correctCount 重建', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const A = global.window.App;
        A.session.save({
            quiz: [{ id: '001' }, { id: '002' }, { id: '003' }],
            idx: 1,
            correctCount: 1,
            startTime: Date.now(),
            mode: 'standard',
            isWrongBookQuiz: false
        });
        T.assertTrue(A.tryResumeSession());
        T.assertEqual(A.state.quiz.length, 3);
        T.assertEqual(A.state.idx, 1);
        T.assertEqual(A.state.correctCount, 1);
        T.assertEqual(A.state.mode, 'standard');
        T.assertFalse(A.state.isWrongBookQuiz, 'resumed sessions are always normal mode');
    });
    T.it('会话中引用的 qid 找不到对应题目时返回 false', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const A = global.window.App;
        A.session.save({
            quiz: [{ id: 'nonexistent_id' }],
            idx: 0,
            correctCount: 0,
            startTime: Date.now(),
            mode: 'quick'
        });
        T.assertFalse(A.tryResumeSession());
    });
});

// ========== pickOption — 答题核心逻辑 ==========
T.describe('App.pickOption — 答题核心路径', function() {
    T.beforeEach(function() {
        T.loadFreshSource();
        T.loadSource('data.js');
    });

    T.it('答对：correctCount++，history 追加 ok=true 记录', function() {
        const A = global.window.App;
        A.state.quiz = [{ id: 'q001', options: [{ key: 'A', text: 'x' }, { key: 'B', text: 'y' }], answer: 'A', explanation: '解释' }];
        A.state.idx = 0;
        A.state.correctCount = 0;
        A.state.isWrongBookQuiz = false;
        A.pickOption('A');
        T.assertEqual(A.state.correctCount, 1);
        T.assertEqual(A.state.answered, true);
        T.assertEqual(A.db.get().history.length, 1);
        T.assertEqual(A.db.get().history[0].ok, true);
        T.assertEqual(A.db.get().history[0].qid, 'q001');
    });

    T.it('答错：correctCount 不增、history 追加 ok=false、普通模式加入错题本', function() {
        const A = global.window.App;
        A.state.quiz = [{ id: 'q001', options: [{ key: 'A', text: '' }, { key: 'B', text: '' }], answer: 'A', explanation: '' }];
        A.state.idx = 0;
        A.state.correctCount = 0;
        A.state.isWrongBookQuiz = false;
        A.pickOption('B');
        T.assertEqual(A.state.correctCount, 0);
        T.assertEqual(A.db.get().history[0].ok, false);
        T.assertEqual(A.db.getWrong().length, 1, '普通模式答错入错题本');
        T.assertEqual(A.db.getWrong()[0].qid, 'q001');
    });

    T.it('普通模式答对：不加入错题本', function() {
        const A = global.window.App;
        A.state.quiz = [{ id: 'q001', options: [{ key: 'A', text: '' }], answer: 'A', explanation: '' }];
        A.state.idx = 0;
        A.state.correctCount = 0;
        A.state.isWrongBookQuiz = false;
        A.pickOption('A');
        T.assertEqual(A.db.getWrong().length, 0, '普通模式答对不入错题本');
    });

    T.it('错题本模式答对：调用 reviewCorrect（level 提升）', function() {
        const A = global.window.App;
        A.db.addWrong('q001');
        A.state.quiz = [{ id: 'q001', options: [{ key: 'A', text: '' }], answer: 'A', explanation: '' }];
        A.state.idx = 0;
        A.state.correctCount = 0;
        A.state.isWrongBookQuiz = true;
        A.pickOption('A');
        T.assertEqual(A.db.getWrong()[0].level, 1, 'level 提升到 1');
    });

    T.it('错题本模式答错：调用 reviewWrong（level 重置为 0）', function() {
        const A = global.window.App;
        A.db.addWrong('q001');
        A.db.reviewCorrect('q001'); // L1
        A.db.reviewCorrect('q001'); // L2
        T.assertEqual(A.db.getWrong()[0].level, 2);
        A.state.quiz = [{ id: 'q001', options: [{ key: 'A', text: '' }, { key: 'B', text: '' }], answer: 'A', explanation: '' }];
        A.state.idx = 0;
        A.state.correctCount = 0;
        A.state.isWrongBookQuiz = true;
        A.pickOption('B');
        T.assertEqual(A.db.getWrong()[0].level, 0, 'reviewWrong 重置 level');
    });

    T.it('已答过的题再次调用 pickOption：不重复计分', function() {
        const A = global.window.App;
        A.state.quiz = [{ id: 'q001', options: [{ key: 'A', text: '' }], answer: 'A', explanation: '' }];
        A.state.idx = 0;
        A.state.correctCount = 0;
        A.state.isWrongBookQuiz = false;
        A.pickOption('A');
        T.assertEqual(A.state.answered, true);
        const histBefore = A.db.get().history.length;
        A.pickOption('A'); // 重复选
        T.assertEqual(A.db.get().history.length, histBefore, 'no duplicate history');
    });
});

// ========== finishQuiz 行为 ==========
T.describe('App.finishQuiz — 收尾统计', function() {
    T.it('lastResult.mode 在错题本模式下为"错题复习"', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const A = global.window.App;
        A.state.quiz = [{ id: 'q001', options: [{ key: 'A', text: '' }], answer: 'A', explanation: '' }];
        A.state.idx = 0;
        A.state.correctCount = 1;
        A.state.isWrongBookQuiz = true;
        A.state.startTime = Date.now() - 5000;
        A.finishQuiz();
        T.assertEqual(A.state.lastResult.mode, '错题复习');
    });

    T.it('lastResult.mode 按当前 mode 映射', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const A = global.window.App;
        A.state.quiz = [{ id: 'q001', options: [{ key: 'A', text: '' }], answer: 'A', explanation: '' }];
        A.state.idx = 0;
        A.state.correctCount = 1;
        A.state.isWrongBookQuiz = false;
        A.state.startTime = Date.now();
        A.state.mode = 'standard';
        A.finishQuiz();
        T.assertEqual(A.state.lastResult.mode, '标准');
    });
});

// ========== session 与 state 互不影响 ==========
T.describe('App.session — 与 quiz state 解耦', function() {
    T.it('session.save 不修改 state 字段', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const A = global.window.App;
        const beforeIdx = A.state.idx;
        A.session.save({ quiz: [{ id: 'q001' }], idx: 99, correctCount: 99, startTime: 0, mode: 'quick' });
        T.assertEqual(A.state.idx, beforeIdx, 'state.idx unchanged');
    });
});
