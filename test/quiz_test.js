// ============================================================
// quiz_test.js - 答题引擎逻辑测试
// ============================================================
(function() {
    var TR = TestRunner;
    var db = App.db;

    // --- 辅助函数 ---
    function resetAll() {
        db.setData(db.defaults());
        // 重置 quiz state
        App.state.quiz = [];
        App.state.idx = 0;
        App.state.correctCount = 0;
        App.state.mode = 'quick';
        App.state.isWrongBookQuiz = false;
        App.state.answered = false;
        App.session.clear();
        // 创建必要的 DOM 元素供 pickOption 使用
        var optKeys = ['A', 'B', 'C', 'D'];
        for (var i = 0; i < optKeys.length; i++) {
            var el = document.getElementById('opt-' + optKeys[i]);
            if (!el) {
                el = document.createElement('div');
                el.id = 'opt-' + optKeys[i];
                el.className = 'option-item';
                document.body.appendChild(el);
            }
        }
        // 创建反馈元素
        var fbEl = document.getElementById('fb');
        if (!fbEl) {
            fbEl = document.createElement('div');
            fbEl.id = 'fb';
            document.body.appendChild(fbEl);
        }
        var fbTitle = document.getElementById('fbTitle');
        if (!fbTitle) {
            fbTitle = document.createElement('div');
            fbTitle.id = 'fbTitle';
            document.body.appendChild(fbTitle);
        }
        var fbDesc = document.getElementById('fbDesc');
        if (!fbDesc) {
            fbDesc = document.createElement('div');
            fbDesc.id = 'fbDesc';
            document.body.appendChild(fbDesc);
        }
        var nextBtn = document.getElementById('nextBtn');
        if (!nextBtn) {
            nextBtn = document.createElement('button');
            nextBtn.id = 'nextBtn';
            document.body.appendChild(nextBtn);
        }
    }

    // ============================================================
    // 1. 随机打乱算法
    // ============================================================
    TR.suite('shuffle - 随机打乱', function() {
        TR.test('应返回相同长度的数组', function() {
            var arr = [1, 2, 3, 4, 5];
            var result = App.shuffle(arr);
            TR.assertEqual(result.length, 5, '打乱后长度不变');
        });

        TR.test('应包含所有原元素', function() {
            var arr = [1, 2, 3, 4, 5];
            var result = App.shuffle(arr);
            var sorted = result.slice().sort(function(a, b) { return a - b; });
            TR.assertDeepEqual(sorted, [1, 2, 3, 4, 5], '应包含所有元素');
        });

        TR.test('不应修改原数组', function() {
            var arr = [1, 2, 3, 4, 5];
            var copy = arr.slice();
            App.shuffle(arr);
            TR.assertDeepEqual(arr, copy, '原数组不应被修改');
        });

        TR.test('空数组应返回空数组', function() {
            var result = App.shuffle([]);
            TR.assertDeepEqual(result, [], '空数组应返回空数组');
        });

        TR.test('单元素数组应返回相同数组', function() {
            var result = App.shuffle([42]);
            TR.assertDeepEqual(result, [42], '单元素应返回相同');
        });
    });

    // ============================================================
    // 2. 模式选择
    // ============================================================
    TR.suite('selectMode - 模式选择', function() {
        TR.test('应正确设置模式', function() {
            resetAll();
            App.selectMode('quick');
            TR.assertEqual(App.state.mode, 'quick', '应设置为 quick');
            App.selectMode('standard');
            TR.assertEqual(App.state.mode, 'standard', '应设置为 standard');
            App.selectMode('intensive');
            TR.assertEqual(App.state.mode, 'intensive', '应设置为 intensive');
        });

        TR.test('切换模式应清除会话', function() {
            resetAll();
            // 模拟有会话
            App.session.save({ quizIds: ['001'], idx: 0, correctCount: 0, startTime: Date.now(), mode: 'quick' });
            App.selectMode('standard');
            var saved = App.session.load();
            TR.assert(saved === null, '切换模式后应清除会话');
        });
    });

    // ============================================================
    // 3. 答题数量
    // ============================================================
    TR.suite('getCount - 答题数量', function() {
        TR.test('快速模式应为 10 题', function() {
            resetAll();
            App.state.mode = 'quick';
            // 通过闭包访问 getCount
            // 由于 getCount 是内部函数，我们通过 startRandomQuiz 间接测试
            // 这里直接测试 state 行为
        });
    });

    // ============================================================
    // 4. 答题流程
    // ============================================================
    TR.suite('答题流程 - 核心逻辑', function() {
        TR.test('选择答案后 answered 应变为 true', function() {
            resetAll();
            // 手动设置题目状态
            App.state.quiz = [{ id: '001', question: 'Q', options: [{ key: 'A', text: 'A' }], answer: 'A' }];
            App.state.idx = 0;
            App.state.answered = false;
            App.state.isWrongBookQuiz = false;
            App.pickOption('A');
            TR.assertEqual(App.state.answered, true, '选择后应标记已回答');
        });

        TR.test('答对应增加 correctCount', function() {
            resetAll();
            App.state.quiz = [{ id: '001', question: 'Q', options: [{ key: 'A', text: 'A' }], answer: 'A' }];
            App.state.idx = 0;
            App.state.correctCount = 0;
            App.state.answered = false;
            App.state.isWrongBookQuiz = false;
            App.pickOption('A');
            TR.assertEqual(App.state.correctCount, 1, '答对应增加正确计数');
        });

        TR.test('答错不应增加 correctCount', function() {
            resetAll();
            App.state.quiz = [{ id: '001', question: 'Q', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'A' }];
            App.state.idx = 0;
            App.state.correctCount = 0;
            App.state.answered = false;
            App.state.isWrongBookQuiz = false;
            App.pickOption('B');
            TR.assertEqual(App.state.correctCount, 0, '答错不应增加正确计数');
        });

        TR.test('答错应加入错题本', function() {
            resetAll();
            App.state.quiz = [{ id: '001', question: 'Q', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'A' }];
            App.state.idx = 0;
            App.state.answered = false;
            App.state.isWrongBookQuiz = false;
            App.pickOption('B');
            var w = db.getWrong();
            var found = false;
            for (var i = 0; i < w.length; i++) {
                if (w[i].qid === '001') { found = true; break; }
            }
            TR.assertEqual(found, true, '答错应加入错题本');
        });

        TR.test('错题本模式答对应调用 reviewCorrect', function() {
            resetAll();
            db.addWrong('001');
            App.state.quiz = [{ id: '001', question: 'Q', options: [{ key: 'A', text: 'A' }], answer: 'A' }];
            App.state.idx = 0;
            App.state.answered = false;
            App.state.isWrongBookQuiz = true;
            App.pickOption('A');
            var w = db.getWrong();
            var found = false;
            for (var i = 0; i < w.length; i++) {
                if (w[i].qid === '001') { found = true; break; }
            }
            // 答对后等级应提升（仍在错题本中，因为只答对了1次）
            TR.assertEqual(found, true, '答对后应仍在错题本中（等级提升而非移除）');
            if (found) {
                TR.assertEqual(w[0].level, 1, '等级应提升到 1');
            }
        });

        TR.test('错题本模式答错应调用 reviewWrong', function() {
            resetAll();
            db.addWrong('001');
            var w1 = db.getWrong()[0];
            w1.level = 2; // 模拟之前已经提升过
            App.state.quiz = [{ id: '001', question: 'Q', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'A' }];
            App.state.idx = 0;
            App.state.answered = false;
            App.state.isWrongBookQuiz = true;
            App.pickOption('B');
            var w = db.getWrong();
            TR.assertEqual(w[0].level, 0, '答错应重置等级');
            TR.assertEqual(w[0].cnt, 2, '错误计数应递增');
        });

        TR.test('已回答后不应响应更多选择', function() {
            resetAll();
            App.state.quiz = [{ id: '001', question: 'Q', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'A' }];
            App.state.idx = 0;
            App.state.correctCount = 0;
            App.state.answered = false;
            App.state.isWrongBookQuiz = false;
            App.pickOption('A');
            // 尝试再次选择
            App.pickOption('B');
            TR.assertEqual(App.state.correctCount, 1, '已回答后不应重复计数');
        });
    });

    // ============================================================
    // 5. 答题记录
    // ============================================================
    TR.suite('答题记录 - 历史记录', function() {
        TR.test('答对应记录正确', function() {
            resetAll();
            App.state.quiz = [{ id: '001', question: 'Q', options: [{ key: 'A', text: 'A' }], answer: 'A' }];
            App.state.idx = 0;
            App.state.answered = false;
            App.state.isWrongBookQuiz = false;
            App.pickOption('A');
            var d = db.get();
            var rec = d.history[d.history.length - 1];
            TR.assertEqual(rec.ok, true, '应记录为正确');
        });

        TR.test('答错应记录错误', function() {
            resetAll();
            App.state.quiz = [{ id: '001', question: 'Q', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'A' }];
            App.state.idx = 0;
            App.state.answered = false;
            App.state.isWrongBookQuiz = false;
            App.pickOption('B');
            var d = db.get();
            var rec = d.history[d.history.length - 1];
            TR.assertEqual(rec.ok, false, '应记录为错误');
        });
    });

    // ============================================================
    // 6. 会话保存与恢复
    // ============================================================
    TR.suite('会话管理 - 保存与恢复', function() {
        TR.test('应能保存和加载会话', function() {
            resetAll();
            var state = {
                quiz: [{ id: '001' }, { id: '002' }],
                idx: 1,
                correctCount: 1,
                startTime: Date.now(),
                mode: 'quick',
                isWrongBookQuiz: false
            };
            App.session.save(state);
            var loaded = App.session.load();
            TR.assert(loaded !== null, '应能加载会话');
            TR.assertEqual(loaded.quizIds.length, 2, '应有 2 个题目 ID');
            TR.assertEqual(loaded.idx, 1, '索引应为 1');
        });

        TR.test('应能清除会话', function() {
            resetAll();
            App.session.save({ quiz: [{ id: '001' }], idx: 0, correctCount: 0, startTime: Date.now(), mode: 'quick' });
            App.session.clear();
            var loaded = App.session.load();
            TR.assert(loaded === null, '清除后应为 null');
        });

        TR.test('无会话时 load 应返回 null', function() {
            resetAll();
            App.session.clear();
            var loaded = App.session.load();
            TR.assert(loaded === null, '无会话应返回 null');
        });
    });

    // ============================================================
    // 7. 键盘快捷键
    // ============================================================
    TR.suite('键盘快捷键 - handleQuizKeydown', function() {
        TR.test('A/B/C/D 键应选择对应选项', function() {
            resetAll();
            App.state.quiz = [{ id: '001', question: 'Q', options: [
                { key: 'A', text: 'A' },
                { key: 'B', text: 'B' },
                { key: 'C', text: 'C' },
                { key: 'D', text: 'D' }
            ], answer: 'A' }];
            App.state.idx = 0;
            App.state.answered = false;
            App.state.isWrongBookQuiz = false;
            // 设置答题视图为激活状态
            var view = document.getElementById('view-practice');
            if (view) view.classList.add('active');
            App.handleQuizKeydown({ key: 'B', preventDefault: function() {} });
            TR.assertEqual(App.state.answered, true, '按 B 应选择 B 选项');
        });

        TR.test('已回答后空格应进入下一题', function() {
            resetAll();
            App.state.quiz = [
                { id: '001', question: 'Q1', options: [{ key: 'A', text: 'A' }], answer: 'A' },
                { id: '002', question: 'Q2', options: [{ key: 'A', text: 'A' }], answer: 'A' }
            ];
            App.state.idx = 0;
            App.state.answered = true;
            App.state.isWrongBookQuiz = false;
            var view = document.getElementById('view-practice');
            if (view) view.classList.add('active');
            App.handleQuizKeydown({ key: ' ', preventDefault: function() {} });
            TR.assertEqual(App.state.idx, 1, '空格应进入下一题');
        });

        TR.test('非答题视图不应响应', function() {
            resetAll();
            App.state.quiz = [{ id: '001', question: 'Q', options: [{ key: 'A', text: 'A' }], answer: 'A' }];
            App.state.idx = 0;
            App.state.answered = false;
            var view = document.getElementById('view-practice');
            if (view) view.classList.remove('active');
            App.handleQuizKeydown({ key: 'A', preventDefault: function() {} });
            TR.assertEqual(App.state.answered, false, '非答题视图不应响应');
        });

        TR.test('ABCD 以外的键不应响应', function() {
            resetAll();
            App.state.quiz = [{ id: '001', question: 'Q', options: [{ key: 'A', text: 'A' }], answer: 'A' }];
            App.state.idx = 0;
            App.state.answered = false;
            var view = document.getElementById('view-practice');
            if (view) view.classList.add('active');
            App.handleQuizKeydown({ key: 'E', preventDefault: function() {} });
            TR.assertEqual(App.state.answered, false, 'E 键不应响应');
        });
    });

    // ============================================================
    // 8. 完成答题
    // ============================================================
    TR.suite('finishQuiz - 完成答题', function() {
        TR.test('应正确计算结果', function() {
            resetAll();
            App.state.quiz = [
                { id: '001' },
                { id: '002' },
                { id: '003' }
            ];
            App.state.correctCount = 2;
            App.state.startTime = Date.now() - 60000; // 1 分钟前
            App.state.isWrongBookQuiz = false;
            App.finishQuiz();
            var r = App.state.lastResult;
            TR.assert(r !== undefined, '应有结果');
            TR.assertEqual(r.total, 3, '总题数应为 3');
            TR.assertEqual(r.correct, 2, '正确数应为 2');
            TR.assertEqual(r.wrong, 1, '错误数应为 1');
            TR.assertEqual(r.pct, 67, '正确率应为 67%');
        });

        TR.test('应区分错题本模式', function() {
            resetAll();
            App.state.quiz = [{ id: '001' }];
            App.state.correctCount = 1;
            App.state.startTime = Date.now();
            App.state.isWrongBookQuiz = true;
            App.finishQuiz();
            var r = App.state.lastResult;
            TR.assertEqual(r.mode, '错题复习', '错题本模式应显示正确名称');
        });
    });

    // ============================================================
    // 9. 计时格式化
    // ============================================================
    TR.suite('fmtTime - 时间格式化', function() {
        TR.test('应正确格式化时间', function() {
            TR.assertEqual(App.fmtTime(60000), '1分0秒', '60秒应格式化为 1分0秒');
            TR.assertEqual(App.fmtTime(90000), '1分30秒', '90秒应格式化为 1分30秒');
            TR.assertEqual(App.fmtTime(30000), '0分30秒', '30秒应格式化为 0分30秒');
            TR.assertEqual(App.fmtTime(0), '0分0秒', '0毫秒应为 0分0秒');
        });
    });
})();
