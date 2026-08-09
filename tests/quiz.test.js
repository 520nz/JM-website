// ============================================================
// quiz.test.js - quiz.js 工具函数测试
// 覆盖：Fisher-Yates 洗牌、会话管理、答题流程状态机、键盘快捷键
// ============================================================
module.exports = {
    name: 'quiz.js 答题引擎',
    beforeEach: function(App) {
        if (!App.QUESTION_BANK || App.QUESTION_BANK.length === 0) {
            App.QUESTION_BANK = [
                { id: '001', category: '专辑', question: 'Q1', options: [{key:'A',text:'a'},{key:'B',text:'b'},{key:'C',text:'c'},{key:'D',text:'d'}], answer: 'B', explanation: 'exp1' },
                { id: '002', category: '歌曲', question: 'Q2', options: [{key:'A',text:'a'},{key:'B',text:'b'},{key:'C',text:'c'},{key:'D',text:'d'}], answer: 'B', explanation: 'exp2' },
                { id: '003', category: '个人信息', question: 'Q3', options: [{key:'A',text:'a'},{key:'B',text:'b'},{key:'C',text:'c'},{key:'D',text:'d'}], answer: 'C', explanation: 'exp3' },
                { id: '004', category: '获奖记录', question: 'Q4', options: [{key:'A',text:'a'},{key:'B',text:'b'},{key:'C',text:'c'},{key:'D',text:'d'}], answer: 'D', explanation: 'exp4' }
            ];
        }
        App.db.setData(App.db.defaults());
        // 确保 practice 视图有 active class
        var pv = App._testEnv.window.document.getElementById('view-practice');
        if (pv && !pv.classList.contains('active')) pv.classList.add('active');
    },
    cases: [
        // ===================== Fisher-Yates 洗牌 =====================
        { name: 'shuffle 应保持数组长度不变', fn: function(App, H) {
            var arr = [1, 2, 3, 4, 5];
            var shuffled = App.shuffle(arr);
            H.equal(shuffled.length, 5);
            H.equal(arr.length, 5);
            H.ok(arr.indexOf(1) !== -1);
        }},
        { name: 'shuffle 应保留所有元素（无重复无丢失）', fn: function(App, H) {
            var arr = ['a', 'b', 'c', 'd', 'e'];
            var shuffled = App.shuffle(arr);
            H.deepEqual(arr.slice().sort(), shuffled.slice().sort());
        }},
        { name: 'shuffle 空数组应返回空数组', fn: function(App, H) {
            H.deepEqual(App.shuffle([]), []);
        }},
        { name: 'shuffle 大数组 100 次应有足够随机性', fn: function(App, H) {
            var orig = [];
            for (var i = 0; i < 20; i++) orig.push(i);
            var diff = 0;
            for (var j = 0; j < 100; j++) {
                var sh = App.shuffle(orig);
                var same = true;
                for (var k = 0; k < orig.length; k++) { if (sh[k] !== orig[k]) { same = false; break; } }
                if (!same) diff++;
            }
            H.ok(diff > 50, '洗牌应有足够随机性（' + diff + '/100 次不同）');
        }},

        // ===================== 会话管理 =====================
        { name: 'session.save/load/clear 应正确工作', fn: function(App, H) {
            App.session.save({
                quiz: App.QUESTION_BANK.slice(0, 3),
                idx: 1, correctCount: 2,
                startTime: Date.now() - 60000,
                mode: 'quick', isWrongBookQuiz: false
            });
            var s = App.session.load();
            H.ok(s !== null);
            H.equal(s.quizIds.length, 3);
            H.equal(s.idx, 1);
            H.equal(s.correctCount, 2);
            App.session.clear();
            H.equal(App.session.load(), null);
        }},

        // ===================== 答题流程状态机 =====================
        { name: 'pickOption 答对应增加 correctCount 且不应加入错题本', fn: function(App, H) {
            App.state.quiz = [App.QUESTION_BANK[0]];
            App.state.idx = 0; App.state.correctCount = 0;
            App.state.mode = 'quick'; App.state.isWrongBookQuiz = false;
            App.state.answered = false; App.state.startTime = Date.now();
            App.renderQ();

            App.pickOption('B');
            H.equal(App.state.correctCount, 1);
            H.equal(App.state.answered, true);

            var wl = App.db.getWrong();
            var found = false;
            for (var i = 0; i < wl.length; i++) if (wl[i].qid === '001') found = true;
            H.ok(!found, '答对的题不应加入错题本');

            var d = App.db.get();
            H.equal(d.stats.total, 1);
            H.equal(d.stats.correct, 1);
        }},
        { name: 'pickOption 答错普通模式应加入错题本', fn: function(App, H) {
            App.state.quiz = [App.QUESTION_BANK[0]];
            App.state.idx = 0; App.state.correctCount = 0;
            App.state.mode = 'quick'; App.state.isWrongBookQuiz = false;
            App.state.answered = false; App.state.startTime = Date.now();
            App.renderQ();

            App.pickOption('A');
            H.equal(App.state.correctCount, 0);
            var wl = App.db.getWrong();
            H.equal(wl.length, 1);
            H.equal(wl[0].qid, '001');
            H.equal(wl[0].level, 0);
            H.equal(wl[0].cnt, 1);
        }},
        { name: 'pickOption 错题复习模式答对应提升间隔重复等级', fn: function(App, H) {
            App.state.quiz = [App.QUESTION_BANK[0]];
            App.state.idx = 0; App.state.correctCount = 0;
            App.state.mode = 'quick'; App.state.isWrongBookQuiz = true;
            App.state.answered = false; App.state.startTime = Date.now();
            App.renderQ();

            App.db.addWrong('001');
            var d = App.db.get();
            d.wrong[0].level = 2;
            App.db.setData(d);

            App.pickOption('B');
            var after = App.db.get();
            H.equal(after.wrong[0].level, 3);
            H.ok(after.wrong[0].nextReview > Date.now());
        }},
        { name: 'pickOption 错题复习模式答错应重置等级为 0', fn: function(App, H) {
            App.state.quiz = [App.QUESTION_BANK[0]];
            App.state.idx = 0; App.state.correctCount = 0;
            App.state.mode = 'quick'; App.state.isWrongBookQuiz = true;
            App.state.answered = false; App.state.startTime = Date.now();
            App.renderQ();

            App.db.addWrong('001');
            var d = App.db.get();
            d.wrong[0].level = 3;
            App.db.setData(d);

            App.pickOption('A');
            var after = App.db.get();
            H.equal(after.wrong[0].level, 0);
            H.equal(after.wrong[0].cnt, 2);
            H.ok(after.wrong[0].nextReview <= Date.now());
        }},
        { name: 'pickOption 同一题答两次第二次应被阻止', fn: function(App, H) {
            App.state.quiz = [App.QUESTION_BANK[0]];
            App.state.idx = 0; App.state.correctCount = 0;
            App.state.mode = 'quick'; App.state.isWrongBookQuiz = false;
            App.state.answered = false; App.state.startTime = Date.now();
            App.renderQ();

            App.pickOption('B');
            var first = App.state.correctCount;
            App.pickOption('A');
            H.equal(App.state.correctCount, first);
        }},
        { name: 'nextQ 应推进 idx 并重置 answered 状态', fn: function(App, H) {
            App.state.quiz = App.QUESTION_BANK.slice(0, 3);
            App.state.idx = 0; App.state.correctCount = 0;
            App.state.mode = 'quick'; App.state.isWrongBookQuiz = false;
            App.state.answered = false; App.state.startTime = Date.now();
            App.renderQ();

            App.pickOption(App.QUESTION_BANK[0].answer);
            H.equal(App.state.idx, 0);
            H.equal(App.state.answered, true);

            App.nextQ();
            H.equal(App.state.idx, 1);
            H.equal(App.state.answered, false);
        }},

        // ===================== 成就上下文触发 =====================
        { name: '10题全对上下文应触发 perfect_10 成就', fn: function(App, H) {
            var now = new Date(); now.setHours(12, 0, 0, 0);
            for (var i = 0; i < 10; i++) {
                App.db.addRecord({
                    qid: App.QUESTION_BANK[i % App.QUESTION_BANK.length].id,
                    ans: App.QUESTION_BANK[i % App.QUESTION_BANK.length].answer,
                    ok: true, time: now.getTime() + i * 1000
                });
            }
            var unlocks = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 10 });
            var found = false;
            for (var j = 0; j < unlocks.length; j++) if (unlocks[j].id === 'perfect_10') found = true;
            H.ok(found, '10题全对应解锁 perfect_10');
        }},

        // ===================== 键盘快捷键 =====================
        { name: 'handleQuizKeydown 在 practice 视图应响应 A/B/C/D', fn: function(App, H) {
            App.state.quiz = [App.QUESTION_BANK[0]];
            App.state.idx = 0; App.state.correctCount = 0;
            App.state.answered = false; App.state.startTime = Date.now();
            App.renderQ();
            var ev = { key: 'b', preventDefault: function() {} };
            App.handleQuizKeydown(ev);
            H.equal(App.state.answered, true, '按 B 应触发选择');
            H.equal(App.state.correctCount, 1, '正确答案 B 应增加分数');
        }},
        { name: 'handleQuizKeydown 非 practice 视图不应响应', fn: function(App, H) {
            // 先移除 practice 视图
            var pv = App._testEnv.window.document.getElementById('view-practice');
            if (pv) pv.classList.remove('active');
            App.state.quiz = [App.QUESTION_BANK[0]];
            App.state.idx = 0; App.state.answered = false;
            var ev = { key: 'a', preventDefault: function() {} };
            App.handleQuizKeydown(ev);
            H.equal(App.state.answered, false);
        }},
        { name: 'handleQuizKeydown 已回答后回车应推进下一题', fn: function(App, H) {
            App.state.quiz = App.QUESTION_BANK.slice(0, 2);
            App.state.idx = 0;
            App.state.answered = true;
            var ev = { key: 'Enter', preventDefault: function() {} };
            App.handleQuizKeydown(ev);
            H.equal(App.state.idx, 1, '回车应推进到下一题');
        }},

        // ===================== 分类数据完整性 =====================
        { name: '题库应覆盖4个分类且每类有足够题目', fn: function(App, H) {
            var cats = {};
            for (var i = 0; i < App.QUESTION_BANK.length; i++) {
                var c = App.QUESTION_BANK[i].category;
                cats[c] = (cats[c] || 0) + 1;
            }
            H.ok(cats['专辑'] >= 15, '专辑 >= 15（实际:' + (cats['专辑']||0) + '）');
            H.ok(cats['歌曲'] >= 45, '歌曲 >= 45（实际:' + (cats['歌曲']||0) + '）');
            H.ok(cats['个人信息'] >= 8);
            H.ok(cats['获奖记录'] >= 10);
        }},

        // ===================== finishQuiz 结算 =====================
        { name: 'finishQuiz 应生成正确的 lastResult 数据结构', fn: function(App, H) {
            App.state.quiz = App.QUESTION_BANK.slice(0, 4);
            App.state.idx = 4; // 触发 finishQuiz
            App.state.correctCount = 3;
            App.state.mode = 'quick';
            App.state.isWrongBookQuiz = false;
            App.state.startTime = Date.now() - 65000;

            App.finishQuiz();
            var r = App.state.lastResult;
            H.ok(r !== undefined);
            H.equal(r.total, 4);
            H.equal(r.correct, 3);
            H.equal(r.wrong, 1);
            H.equal(r.pct, 75);
            H.ok(r.elapsed > 0);
            H.equal(r.mode, '快速');
        }},
        { name: 'finishQuiz 错题复习模式应正确设置 mode 标签', fn: function(App, H) {
            App.state.quiz = App.QUESTION_BANK.slice(0, 2);
            App.state.idx = 2;
            App.state.correctCount = 1;
            App.state.mode = 'standard';
            App.state.isWrongBookQuiz = true;
            App.state.startTime = Date.now();

            App.finishQuiz();
            H.equal(App.state.lastResult.mode, '错题复习');
        }},
        { name: 'finishQuiz total 为 0 时 pct 应安全返回 0', fn: function(App, H) {
            App.state.quiz = [];
            App.state.idx = 0;
            App.state.correctCount = 0;
            App.state.mode = 'quick';
            App.state.isWrongBookQuiz = false;
            App.state.startTime = Date.now();

            App.finishQuiz();
            H.ok(App.state.lastResult.pct === 0, '0 题正确率应为 0');
            H.ok(isFinite(App.state.lastResult.pct));
        }},
        { name: 'finishQuiz 应清除 session（防止恢复旧会话）', fn: function(App, H) {
            App.state.quiz = App.QUESTION_BANK.slice(0, 1);
            App.state.idx = 0;
            App.state.correctCount = 0;
            App.state.mode = 'quick';
            App.state.startTime = Date.now();
            App.session.save(App.state);
            H.ok(App.session.load() !== null, '先保存会话成功');

            App.state.idx = 1;
            App.state.correctCount = 1;
            App.finishQuiz();

            H.equal(App.session.load(), null, 'finishQuiz 后应清除会话');
        }},

        // ===================== tryResumeSession 恢复逻辑 =====================
        { name: 'tryResumeSession 应恢复保存的答题状态', fn: function(App, H) {
            App.state.quiz = App.QUESTION_BANK.slice(0, 3);
            App.state.idx = 1;
            App.state.correctCount = 1;
            App.state.mode = 'standard';
            App.state.startTime = Date.now() - 120000;
            App.state.isWrongBookQuiz = false;
            App.session.save(App.state);

            var ok = App.tryResumeSession();
            H.equal(ok, true);
            H.equal(App.state.quiz.length, 3);
            H.equal(App.state.idx, 1);
            H.equal(App.state.correctCount, 1);
            H.equal(App.state.mode, 'standard');
        }},
        { name: 'tryResumeSession idx >= quiz.length 时不应恢复并清除会话', fn: function(App, H) {
            App.state.quiz = App.QUESTION_BANK.slice(0, 2);
            App.state.idx = 2;
            App.state.correctCount = 2;
            App.state.mode = 'quick';
            App.state.startTime = Date.now();
            App.session.save(App.state);

            var ok = App.tryResumeSession();
            H.equal(ok, false, '答完的会话不应恢复');
            H.equal(App.session.load(), null, '应清除已完成的会话');
        }},
        { name: 'tryResumeSession 无保存会话时应返回 false', fn: function(App, H) {
            App.session.clear();
            var ok = App.tryResumeSession();
            H.equal(ok, false);
        }},
        { name: 'tryResumeSession 恢复后 startTime 应保留已用时间（从中断继续）', fn: function(App, H) {
            var twoMinAgo = Date.now() - 120000;
            App.state.quiz = App.QUESTION_BANK.slice(0, 2);
            App.state.idx = 1;
            App.state.correctCount = 0;
            App.state.mode = 'quick';
            App.state.startTime = twoMinAgo;
            App.session.save(App.state);

            App.tryResumeSession();
            var diff = Math.abs(App.state.startTime - twoMinAgo);
            H.ok(diff < 2000, 'startTime 应接近原始保存值（允许 2s 误差，实际 diff=' + diff + 'ms）');
        }},
        { name: 'quitQuiz 应清除 session（switchView 不可用时也应清除）', fn: function(App, H) {
            App.state.quiz = App.QUESTION_BANK.slice(0, 3);
            App.state.idx = 1;
            App.state.startTime = Date.now();
            App.session.save(App.state);
            H.ok(App.session.load() !== null, '保存成功');

            // switchView 不存在（app.js 未加载），但 session.clear 应该先被调用
            try { App.quitQuiz(); } catch(e) {}
            H.equal(App.session.load(), null, 'quitQuiz 应清除 session');
        }},

        // ===================== 音效切换 =====================
        { name: 'toggleSound 应切换音效开关状态', fn: function(App, H) {
            var s1 = App.toggleSound();
            var s2 = App.toggleSound();
            // toggleSound 返回新状态，两次调用应恢复原值
            H.ok(typeof s1 === 'boolean');
            H.ok(typeof s2 === 'boolean');
            H.ok(s1 !== s2, '两次 toggle 应得到不同值');
        }},

        // ===================== 答题边界：finishQuiz 由 renderQ 自动触发 =====================
        { name: 'renderQ 在 idx 越界时应自动触发 finishQuiz', fn: function(App, H) {
            // 保存 practice 视图为 active（否则 finishQuiz 里 stopTimer 有依赖）
            var pv = App._testEnv.window.document.getElementById('view-practice');
            if (pv && !pv.classList.contains('active')) pv.classList.add('active');

            App.state.quiz = App.QUESTION_BANK.slice(0, 1);
            App.state.idx = 1; // 超过数组长度
            App.state.startTime = Date.now();
            App.state.mode = 'quick';
            App.state.answered = true;

            App.renderQ();
            H.ok(App.state.lastResult !== undefined, 'idx 越界应触发 finishQuiz');
        }}
    ]
};
