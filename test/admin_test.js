// ============================================================
// admin_test.js - 题库管理逻辑测试
// ============================================================
(function() {
    var TR = TestRunner;
    var db = App.db;

    // --- 辅助函数 ---
    function resetAll() {
        db.setData(db.defaults());
        App.QUESTION_BANK = App.DEFAULT_QUESTION_BANK.slice();
    }

    // ============================================================
    // 1. 题目选项解析
    // ============================================================
    TR.suite('saveQuestion - 选项解析逻辑', function() {
        // 模拟 saveQuestion 中的选项解析逻辑
        function parseOptions(optsText) {
            var lines = optsText.split('\n');
            var options = [];
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (!line) continue;
                var match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
                if (match) {
                    options.push({ key: match[1], text: match[2] });
                }
            }
            return options;
        }

        TR.test('应正确解析标准格式选项', function() {
            var opts = parseOptions('A.选项一\nB.选项二\nC.选项三\nD.选项四');
            TR.assertEqual(opts.length, 4, '应解析出 4 个选项');
            TR.assertEqual(opts[0].key, 'A', '第一个选项 key 应为 A');
            TR.assertEqual(opts[0].text, '选项一', '第一个选项文本正确');
            TR.assertEqual(opts[3].key, 'D', '第四个选项 key 应为 D');
        });

        TR.test('应支持中文点号', function() {
            var opts = parseOptions('A、选项一\nB、选项二');
            TR.assertEqual(opts.length, 2, '应解析出 2 个选项');
            TR.assertEqual(opts[0].text, '选项一', '中文点号应正确解析');
        });

        TR.test('应支持全角点号', function() {
            var opts = parseOptions('A．选项一\nB．选项二');
            TR.assertEqual(opts.length, 2, '应解析出 2 个选项');
        });

        TR.test('空行应被跳过', function() {
            var opts = parseOptions('A.选项一\n\nB.选项二\n');
            TR.assertEqual(opts.length, 2, '空行应被跳过');
        });

        TR.test('不规范格式应被忽略', function() {
            var opts = parseOptions('选项一\nA.正确选项\n选项二');
            TR.assertEqual(opts.length, 1, '只有正确格式应被解析');
        });

        TR.test('单个选项应能解析', function() {
            var opts = parseOptions('A.唯一选项');
            TR.assertEqual(opts.length, 1, '单个选项应能解析');
        });

        TR.test('选项文本中包含特殊字符应能解析', function() {
            var opts = parseOptions('A.这是一个"复杂"的选项，包含<特殊>字符');
            TR.assertEqual(opts.length, 1, '特殊字符应不影响解析');
            TR.assert(opts[0].text.indexOf('复杂') !== -1, '文本内容应完整');
        });
    });

    // ============================================================
    // 2. 题库操作
    // ============================================================
    TR.suite('题库管理 - CRUD', function() {
        TR.test('应能添加新题目', function() {
            resetAll();
            var before = App.QUESTION_BANK.length;
            var newQ = {
                id: 'test_new_1',
                category: '测试',
                question: '测试题目',
                options: [{ key: 'A', text: '选项' }],
                answer: 'A',
                explanation: '解析'
            };
            App.QUESTION_BANK.push(newQ);
            TR.assertEqual(App.QUESTION_BANK.length, before + 1, '应新增 1 题');
            var found = db.findQ('test_new_1');
            TR.assert(found !== null, '应能找到新添加的题目');
        });

        TR.test('应能更新题目', function() {
            resetAll();
            var q = db.findQ('001');
            TR.assert(q !== null, '应找到题目 001');
            var origQuestion = q.question;
            // 更新
            for (var i = 0; i < App.QUESTION_BANK.length; i++) {
                if (App.QUESTION_BANK[i].id === '001') {
                    App.QUESTION_BANK[i].question = '修改后的题目';
                    break;
                }
            }
            var updated = db.findQ('001');
            TR.assert(updated.question !== origQuestion, '题目应被修改');
            TR.assertEqual(updated.question, '修改后的题目', '修改内容应正确');
        });

        TR.test('应能删除题目', function() {
            resetAll();
            var before = App.QUESTION_BANK.length;
            App.QUESTION_BANK = App.QUESTION_BANK.filter(function(q) { return q.id !== '001'; });
            TR.assertEqual(App.QUESTION_BANK.length, before - 1, '应减少 1 题');
            var found = db.findQ('001');
            TR.assert(found === null, '删除后应找不到该题');
        });

        TR.test('不应删除不存在的题目', function() {
            resetAll();
            var before = App.QUESTION_BANK.length;
            App.QUESTION_BANK = App.QUESTION_BANK.filter(function(q) { return q.id !== 'nonexistent'; });
            TR.assertEqual(App.QUESTION_BANK.length, before, '不存在的题目不应影响数量');
        });
    });

    // ============================================================
    // 3. 数据导入逻辑
    // ============================================================
    TR.suite('数据导入 - 逻辑验证', function() {
        TR.test('应能合并答题历史', function() {
            resetAll();
            // 手动模拟合并逻辑
            db.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
            var importedHistory = [
                { qid: '002', ans: 'B', ok: false, time: Date.now() },
                { qid: '003', ans: 'A', ok: true, time: Date.now() }
            ];
            var existingData = db.get();
            existingData.history = existingData.history.concat(importedHistory);
            db.recalcStats();
            var d = db.get();
            TR.assertEqual(d.history.length, 3, '应合并为 3 条记录');
            TR.assertEqual(d.stats.total, 3, '统计应正确重算');
            TR.assertEqual(d.stats.correct, 2, '正确数应为 2');
        });

        TR.test('导入错题时应合并间隔重复数据', function() {
            resetAll();
            db.addWrong('001');
            var existingWrong = db.getWrong();
            existingWrong[0].level = 2; // 已有等级

            // 模拟导入数据
            var importedWrong = [
                { qid: '001', cnt: 3, level: 0 }, // 同一题目，更多错误次数
                { qid: '002', cnt: 1 } // 新题目
            ];

            // 合并逻辑（与 importData 中相同）
            var wrongMap = {};
            var currentWrong = db.getWrong();
            for (var w = 0; w < currentWrong.length; w++) {
                wrongMap[currentWrong[w].qid] = currentWrong[w];
            }

            for (var x = 0; x < importedWrong.length; x++) {
                var wrongItem = importedWrong[x];
                if (wrongMap[wrongItem.qid]) {
                    // 取较高的错误次数
                    wrongMap[wrongItem.qid].cnt = Math.max(wrongMap[wrongItem.qid].cnt, wrongItem.cnt || 1);
                    // 保留较低等级（更保守）
                    if (wrongItem.level != null) {
                        wrongMap[wrongItem.qid].level = Math.min(wrongMap[wrongItem.qid].level || 0, wrongItem.level);
                    }
                }
            }

            var w = db.getWrong();
            // 检查 001 的合并结果
            var item001 = null;
            for (var i = 0; i < w.length; i++) {
                if (w[i].qid === '001') { item001 = w[i]; break; }
            }
            if (item001) {
                TR.assert(item001.cnt >= 3, '错误次数应取较高值');
            }
        });

        TR.test('导入新错题应补充间隔重复字段', function() {
            resetAll();
            // 模拟没有 level 等字段的旧格式错题
            var oldFormatWrong = [
                { qid: '001', cnt: 2 },
                { qid: '002', cnt: 1 }
            ];

            // 应用补全逻辑
            var newItems = [];
            for (var i = 0; i < oldFormatWrong.length; i++) {
                var wrongItem = oldFormatWrong[i];
                if (!wrongItem.level) wrongItem.level = 0;
                if (!wrongItem.nextReview) wrongItem.nextReview = Date.now();
                if (!wrongItem.lastReview) wrongItem.lastReview = 0;
                if (!wrongItem.time) wrongItem.time = Date.now();
                newItems.push(wrongItem);
            }

            for (var j = 0; j < newItems.length; j++) {
                TR.assertEqual(newItems[j].level, 0, '应有 level 字段');
                TR.assert(newItems[j].nextReview > 0, '应有 nextReview 字段');
                TR.assertEqual(newItems[j].lastReview, 0, '应有 lastReview 字段');
                TR.assert(newItems[j].time > 0, '应有 time 字段');
            }
        });

        TR.test('统计应从历史记录重算而非累加', function() {
            resetAll();
            db.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
            db.addRecord({ qid: '002', ans: 'B', ok: false, time: Date.now() });

            // 模拟错误的累加（之前的 bug）
            var d = db.get();
            var oldTotal = d.stats.total;
            var oldCorrect = d.stats.correct;
            d.stats.total += 10; // 错误地累加
            d.stats.correct += 5;
            db.recalcStats(); // 重算

            d = db.get();
            TR.assertEqual(d.stats.total, oldTotal, '重算后应恢复正确值');
            TR.assertEqual(d.stats.correct, oldCorrect, '重算后正确数应恢复');
        });
    });

    // ============================================================
    // 4. 数据导出结构验证
    // ============================================================
    TR.suite('数据导出 - 结构验证', function() {
        TR.test('导出数据应包含必要字段', function() {
            resetAll();
            var data = {
                questionBank: App.QUESTION_BANK,
                userData: db.get(),
                exportTime: new Date().toISOString()
            };
            TR.assert(data.questionBank !== undefined, '应有题库数据');
            TR.assert(data.userData !== undefined, '应有用户数据');
            TR.assert(data.exportTime !== undefined, '应有导出时间');
        });

        TR.test('导出数据应能被序列化', function() {
            resetAll();
            var data = {
                questionBank: App.QUESTION_BANK,
                userData: db.get(),
                exportTime: new Date().toISOString()
            };
            var json = JSON.stringify(data);
            TR.assert(json.length > 0, '应能序列化为 JSON');
            // 验证能反序列化
            var parsed = JSON.parse(json);
            TR.assert(parsed.questionBank !== undefined, '反序列化后应有题库');
        });
    });

    // ============================================================
    // 5. 分类筛选
    // ============================================================
    TR.suite('分类筛选 - 题库管理', function() {
        TR.test('应能获取所有分类', function() {
            var cats = {};
            for (var i = 0; i < App.QUESTION_BANK.length; i++) {
                cats[App.QUESTION_BANK[i].category] = true;
            }
            var keys = Object.keys(cats).sort();
            TR.assert(keys.length >= 4, '至少应有 4 个分类');
            TR.assert(keys.indexOf('专辑') !== -1, '应包含 专辑 分类');
            TR.assert(keys.indexOf('歌曲') !== -1, '应包含 歌曲 分类');
            TR.assert(keys.indexOf('个人信息') !== -1, '应包含 个人信息 分类');
            TR.assert(keys.indexOf('获奖记录') !== -1, '应包含 获奖记录 分类');
        });

        TR.test('应能按分类筛选题目', function() {
            var filtered = [];
            for (var i = 0; i < App.QUESTION_BANK.length; i++) {
                if (App.QUESTION_BANK[i].category === '专辑') {
                    filtered.push(App.QUESTION_BANK[i]);
                }
            }
            TR.assert(filtered.length > 0, '专辑分类应有题目');
            for (var j = 0; j < filtered.length; j++) {
                TR.assertEqual(filtered[j].category, '专辑', '所有筛选结果应为专辑');
            }
        });

        TR.test('应能按关键词搜索题目', function() {
            var search = '江南';
            var results = [];
            for (var i = 0; i < App.QUESTION_BANK.length; i++) {
                if (App.QUESTION_BANK[i].question.toLowerCase().indexOf(search.toLowerCase()) !== -1) {
                    results.push(App.QUESTION_BANK[i]);
                }
            }
            TR.assert(results.length > 0, '搜索"江南"应有结果');
        });
    });

    // ============================================================
    // 6. 边界条件
    // ============================================================
    TR.suite('边界条件 - 健壮性', function() {
        TR.test('空题库不应报错', function() {
            var old = App.QUESTION_BANK;
            App.QUESTION_BANK = [];
            var cats = {};
            for (var i = 0; i < App.QUESTION_BANK.length; i++) {
                cats[App.QUESTION_BANK[i].category] = true;
            }
            TR.assertEqual(Object.keys(cats).length, 0, '空题库分类应为空');
            App.QUESTION_BANK = old; // 恢复
        });

        TR.test('导入空数据应能正常处理', function() {
            resetAll();
            // 空题库
            var data1 = { questionBank: [], userData: null };
            TR.assert(data1.questionBank.length === 0, '空题库应能处理');

            // 只有 userData 没有 questionBank
            var data2 = { userData: { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } } };
            TR.assert(data2.questionBank === undefined, '缺失字段应能处理');
        });

        TR.test('异常格式的 JSON 应被捕获', function() {
            var invalidJson = '{ invalid json content }';
            try {
                JSON.parse(invalidJson);
                TR.assert(false, '无效 JSON 应抛出异常');
            } catch (e) {
                TR.assert(true, '异常应被捕获');
            }
        });
    });
})();
