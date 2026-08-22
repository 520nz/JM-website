// ============================================================
// storage_test.js - 数据存储层核心逻辑测试
// ============================================================
(function() {
    var TR = TestRunner;
    var db = App.db;

    // --- 辅助函数 ---
    function resetCache() {
        db.setData(db.defaults());
    }

    function makeHistoryItem(qid, ok, daysAgo) {
        var time = Date.now();
        if (daysAgo) time = time - daysAgo * 86400000;
        return { qid: qid, ans: 'A', ok: ok, time: time };
    }

    // ============================================================
    // 1. 答题记录与统计
    // ============================================================
    TR.suite('addRecord - 答题记录', function() {
        TR.test('应正确添加答题记录并更新统计', function() {
            resetCache();
            db.addRecord(makeHistoryItem('001', true));
            db.addRecord(makeHistoryItem('002', false));
            var d = db.get();
            TR.assertEqual(d.history.length, 2, '历史记录数应为 2');
            TR.assertEqual(d.stats.total, 2, '总答题数应为 2');
            TR.assertEqual(d.stats.correct, 1, '正确数应为 1');
        });

        TR.test('应正确按分类统计', function() {
            resetCache();
            db.addRecord(makeHistoryItem('001', true)); // 专辑
            db.addRecord(makeHistoryItem('002', true)); // 歌曲
            db.addRecord(makeHistoryItem('003', false)); // 歌曲
            var d = db.get();
            TR.assertEqual(d.stats.cats['专辑'].t, 1, '专辑答题数应为 1');
            TR.assertEqual(d.stats.cats['专辑'].c, 1, '专辑正确数应为 1');
            TR.assertEqual(d.stats.cats['歌曲'].t, 2, '歌曲答题数应为 2');
            TR.assertEqual(d.stats.cats['歌曲'].c, 1, '歌曲正确数应为 1');
        });

        TR.test('同一题目多次应答应正确累计', function() {
            resetCache();
            db.addRecord(makeHistoryItem('001', true));
            db.addRecord(makeHistoryItem('001', false));
            db.addRecord(makeHistoryItem('001', true));
            var d = db.get();
            TR.assertEqual(d.stats.total, 3, '总答题数应为 3');
            TR.assertEqual(d.stats.correct, 2, '正确数应为 2');
        });
    });

    // ============================================================
    // 2. 错题本与间隔重复
    // ============================================================
    TR.suite('addWrong - 错题管理', function() {
        TR.test('应新增错题并初始化', function() {
            resetCache();
            db.addWrong('001');
            var w = db.getWrong();
            TR.assertEqual(w.length, 1, '错题数应为 1');
            TR.assertEqual(w[0].qid, '001', '题目 ID 应为 001');
            TR.assertEqual(w[0].cnt, 1, '错误次数应为 1');
            TR.assertEqual(w[0].level, 0, '初始等级应为 0');
        });

        TR.test('重复添加错题应递增计数并重置等级', function() {
            resetCache();
            db.addWrong('001');
            var w1 = db.getWrong()[0];
            w1.level = 2; // 模拟之前已经提升过等级
            db.addWrong('001');
            var w = db.getWrong();
            TR.assertEqual(w.length, 1, '错题不应重复添加');
            TR.assertEqual(w[0].cnt, 2, '错误次数应递增为 2');
            TR.assertEqual(w[0].level, 0, '等级应重置为 0');
        });

        TR.test('不同题目应独立添加', function() {
            resetCache();
            db.addWrong('001');
            db.addWrong('002');
            var w = db.getWrong();
            TR.assertEqual(w.length, 2, '应有 2 道错题');
        });

        TR.test('应能正确移除错题', function() {
            resetCache();
            db.addWrong('001');
            db.addWrong('002');
            db.removeWrong('001');
            var w = db.getWrong();
            TR.assertEqual(w.length, 1, '移除后错题数应为 1');
            TR.assertEqual(w[0].qid, '002', '剩余的应是 002');
        });
    });

    TR.suite('reviewCorrect/reviewWrong - 间隔重复', function() {
        TR.test('答对错题应提升等级', function() {
            resetCache();
            db.addWrong('001');
            var result = db.reviewCorrect('001');
            TR.assertEqual(result.mastered, false, '首次答对不应掌握');
            TR.assertEqual(result.level, 1, '等级应提升到 1');
        });

        TR.test('答对 5 次应掌握并移除', function() {
            resetCache();
            db.addWrong('001');
            for (var i = 0; i < 5; i++) {
                var result = db.reviewCorrect('001');
                if (result.mastered) break;
            }
            var w = db.getWrong();
            var found = false;
            for (var j = 0; j < w.length; j++) {
                if (w[j].qid === '001') { found = true; break; }
            }
            TR.assertEqual(found, false, '掌握后应从错题本移除');
        });

        TR.test('答错错题应重置等级', function() {
            resetCache();
            db.addWrong('001');
            db.reviewCorrect('001'); // 提升到 level 1
            db.reviewCorrect('001'); // 提升到 level 2
            db.reviewWrong('001'); // 答错，重置
            var w = db.getWrong();
            var item = null;
            for (var i = 0; i < w.length; i++) {
                if (w[i].qid === '001') { item = w[i]; break; }
            }
            TR.assert(item !== null, '错题应存在');
            TR.assertEqual(item.level, 0, '等级应重置为 0');
            TR.assertEqual(item.cnt, 2, '计数应递增');
        });

        TR.test('答错不在错题本中的题目应新增', function() {
            resetCache();
            db.reviewWrong('001');
            var w = db.getWrong();
            TR.assertEqual(w.length, 1, '应新增错题');
            TR.assertEqual(w[0].qid, '001', '应为 001');
        });

        TR.test('答对不在错题本中的题目应返回未掌握', function() {
            resetCache();
            var result = db.reviewCorrect('999');
            TR.assertEqual(result.mastered, false, '未找到题目应返回未掌握');
        });

        TR.test('应能获取到期的错题', function() {
            resetCache();
            db.addWrong('001'); // nextReview = Date.now(), 立即可复习
            var due = db.getDueWrong();
            TR.assertEqual(due.length >= 1, true, '应有到期的错题');
        });
    });

    // ============================================================
    // 3. 连续打卡天数
    // ============================================================
    TR.suite('getStreak - 连续打卡', function() {
        TR.test('无记录时应返回 0', function() {
            resetCache();
            TR.assertEqual(db.getStreak(), 0, '空历史应返回 0');
        });

        TR.test('今天答题应算 1 天', function() {
            resetCache();
            var now = new Date();
            var time = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0).getTime();
            db.get().history.push({ qid: '001', ans: 'A', ok: true, time: time });
            // 手动设置缓存（因为 persist 是异步的）
            TR.assertEqual(db.getStreak(), 1, '今天答题应算 1 天');
        });

        TR.test('昨天和今天答题应算连续 2 天', function() {
            resetCache();
            var now = new Date();
            var yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            // 今天
            db.get().history.push({ qid: '001', ans: 'A', ok: true, time: now.getTime() });
            // 昨天
            db.get().history.push({ qid: '002', ans: 'A', ok: true, time: yesterday.getTime() });
            TR.assertEqual(db.getStreak(), 2, '应返回连续 2 天');
        });

        TR.test('中断后应正确计算', function() {
            resetCache();
            var now = new Date();
            var yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            var threeDaysAgo = new Date(now);
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
            // 今天
            db.get().history.push({ qid: '001', ans: 'A', ok: true, time: now.getTime() });
            // 昨天
            db.get().history.push({ qid: '002', ans: 'A', ok: true, time: yesterday.getTime() });
            // 3 天前（中断）
            db.get().history.push({ qid: '003', ans: 'A', ok: true, time: threeDaysAgo.getTime() });
            TR.assertEqual(db.getStreak(), 2, '应返回连续 2 天（3 天前中断）');
        });

        TR.test('归档数据应计入连续天数', function() {
            resetCache();
            var now = new Date();
            var todayKey = now.getFullYear() + '-' + now.getMonth() + '-' + now.getDate();
            db.get().archive = [{ date: todayKey, total: 5, correct: 3 }];
            // 没有历史记录，但归档有今天
            TR.assertEqual(db.getStreak(), 1, '归档数据应计入');
        });
    });

    // ============================================================
    // 4. 成就徽章检查
    // ============================================================
    TR.suite('checkAchievements - 成就检查', function() {
        TR.test('首次答题应解锁初出茅庐', function() {
            resetCache();
            db.addRecord(makeHistoryItem('001', true));
            var unlocks = db.checkAchievements();
            var found = false;
            for (var i = 0; i < unlocks.length; i++) {
                if (unlocks[i].id === 'first_answer') found = true;
            }
            TR.assertEqual(found, true, '应解锁 first_answer');
        });

        TR.test('答满 50 题且正确率 >= 90% 应解锁资深JM', function() {
            resetCache();
            // 添加 50 题，45 题正确
            for (var i = 0; i < 50; i++) {
                db.addRecord(makeHistoryItem('001', i < 45));
            }
            var unlocks = db.checkAchievements();
            var found = false;
            for (var j = 0; j < unlocks.length; j++) {
                if (unlocks[j].id === 'acc_90') found = true;
            }
            TR.assertEqual(found, true, '应解锁 acc_90');
        });

        TR.test('累计 100 题应解锁百题斩', function() {
            resetCache();
            for (var i = 0; i < 100; i++) {
                db.addRecord(makeHistoryItem('001', true));
            }
            var unlocks = db.checkAchievements();
            var found = false;
            for (var j = 0; j < unlocks.length; j++) {
                if (unlocks[j].id === 'total_100') found = true;
            }
            TR.assertEqual(found, true, '应解锁 total_100');
        });

        TR.test('累计 500 题应解锁五百题王', function() {
            resetCache();
            for (var i = 0; i < 500; i++) {
                db.addRecord(makeHistoryItem('001', true));
            }
            var unlocks = db.checkAchievements();
            var found = false;
            for (var j = 0; j < unlocks.length; j++) {
                if (unlocks[j].id === 'total_500') found = true;
            }
            TR.assertEqual(found, true, '应解锁 total_500');
        });

        TR.test('连续 3 天应解锁三日坚持', function() {
            resetCache();
            var now = new Date();
            for (var d = 0; d < 3; d++) {
                var day = new Date(now);
                day.setDate(day.getDate() - d);
                db.get().history.push({ qid: '001', ans: 'A', ok: true, time: day.getTime() });
            }
            var unlocks = db.checkAchievements();
            var found = false;
            for (var j = 0; j < unlocks.length; j++) {
                if (unlocks[j].id === 'streak_3') found = true;
            }
            TR.assertEqual(found, true, '应解锁 streak_3');
        });

        TR.test('所有分类都有答题记录应解锁全能粉丝', function() {
            resetCache();
            db.addRecord(makeHistoryItem('001', true)); // 专辑
            db.addRecord(makeHistoryItem('002', true)); // 歌曲
            db.addRecord(makeHistoryItem('061', true)); // 个人信息
            db.addRecord(makeHistoryItem('069', true)); // 获奖记录
            var unlocks = db.checkAchievements();
            var found = false;
            for (var j = 0; j < unlocks.length; j++) {
                if (unlocks[j].id === 'all_cats') found = true;
            }
            TR.assertEqual(found, true, '应解锁 all_cats');
        });

        TR.test('完美一轮（10题全对）应解锁十全十美', function() {
            resetCache();
            var context = { quizTotal: 10, quizCorrect: 10 };
            var unlocks = db.checkAchievements(context);
            var found = false;
            for (var i = 0; i < unlocks.length; i++) {
                if (unlocks[i].id === 'perfect_10') found = true;
            }
            TR.assertEqual(found, true, '应解锁 perfect_10');
        });

        TR.test('错题清零应解锁', function() {
            resetCache();
            // 先有答题记录
            db.addRecord(makeHistoryItem('001', true));
            db.addWrong('002'); // 有错题记录
            db.removeWrong('002'); // 错题清零
            var unlocks = db.checkAchievements();
            var found = false;
            for (var i = 0; i < unlocks.length; i++) {
                if (unlocks[i].id === 'wrong_clear') found = true;
            }
            TR.assertEqual(found, true, '应解锁 wrong_clear');
        });

        TR.test('已解锁的成就不应重复解锁', function() {
            resetCache();
            db.addRecord(makeHistoryItem('001', true));
            var unlocks1 = db.checkAchievements();
            var count1 = unlocks1.length;
            var unlocks2 = db.checkAchievements();
            TR.assertEqual(unlocks2.length, 0, '第二次检查不应有新解锁');
        });
    });

    // ============================================================
    // 5. 统计重算
    // ============================================================
    TR.suite('recalcStats - 统计重算', function() {
        TR.test('应从历史记录正确重算统计', function() {
            resetCache();
            db.addRecord(makeHistoryItem('001', true));
            db.addRecord(makeHistoryItem('002', true));
            db.addRecord(makeHistoryItem('003', false));
            // 手动修改 stats
            var d = db.get();
            d.stats.total = 100;
            d.stats.correct = 50;
            d.stats.cats = {};
            db.recalcStats();
            d = db.get();
            TR.assertEqual(d.stats.total, 3, '重算后总答题数应为 3');
            TR.assertEqual(d.stats.correct, 2, '重算后正确数应为 2');
        });

        TR.test('空历史应返回零统计', function() {
            resetCache();
            db.recalcStats();
            var d = db.get();
            TR.assertEqual(d.stats.total, 0, '空历史总答题数应为 0');
            TR.assertEqual(d.stats.correct, 0, '空历史正确数应为 0');
        });
    });

    // ============================================================
    // 6. 每日目标
    // ============================================================
    TR.suite('getDailyGoal/setDailyGoal - 每日目标', function() {
        TR.test('默认目标应为 20', function() {
            resetCache();
            TR.assertEqual(db.getDailyGoal(), 20, '默认目标应为 20');
        });

        TR.test('应能设置目标', function() {
            resetCache();
            db.setDailyGoal(50);
            TR.assertEqual(db.getDailyGoal(), 50, '设置后应为 50');
        });

        TR.test('设置超出范围应被限制', function() {
            resetCache();
            db.setDailyGoal(200);
            TR.assertEqual(db.getDailyGoal(), 100, '超出上限应为 100');
            db.setDailyGoal(1);
            TR.assertEqual(db.getDailyGoal(), 5, '低于下限应为 5');
        });
    });

    // ============================================================
    // 7. 答题记录归档
    // ============================================================
    TR.suite('addRecord - 归档逻辑', function() {
        TR.test('历史记录超过 1000 条时应归档旧数据', function() {
            resetCache();
            var now = Date.now();
            var oldTime = now - 100 * 86400000; // 100 天前
            // 添加 999 条近期记录
            for (var i = 0; i < 999; i++) {
                db.addRecord({ qid: '001', ans: 'A', ok: true, time: now - i * 1000 });
            }
            // 添加 2 条旧记录
            db.get().history.push({ qid: '001', ans: 'A', ok: true, time: oldTime });
            db.get().history.push({ qid: '001', ans: 'A', ok: false, time: oldTime });
            // 现在添加一条触发归档
            db.addRecord({ qid: '001', ans: 'A', ok: true, time: now });
            var d = db.get();
            TR.assert(d.history.length <= 1000, '历史记录应不超过 1000');
            TR.assert(d.archive.length >= 1, '应有归档数据');
        });
    });

    // ============================================================
    // 8. 查找题目
    // ============================================================
    TR.suite('findQ - 题目查找', function() {
        TR.test('应能找到存在的题目', function() {
            var q = db.findQ('001');
            TR.assert(q !== null, '应找到题目 001');
            TR.assertEqual(q.id, '001', '题目 ID 应为 001');
        });

        TR.test('不存在的题目应返回 null', function() {
            var q = db.findQ('99999');
            TR.assert(q === null, '不存在的题目应返回 null');
        });
    });

    // ============================================================
    // 9. XSS 转义
    // ============================================================
    TR.suite('esc - XSS 转义', function() {
        TR.test('应正确转义 HTML 标签', function() {
            var html = App.esc('<script>alert("xss")</script>');
            TR.assert(html.indexOf('<') === -1, '< 应被转义');
            TR.assert(html.indexOf('>') === -1, '> 应被转义');
        });

        TR.test('应转义 & 和引号', function() {
            var html = App.esc('a & b "c"');
            TR.assert(html.indexOf('&') === -1 || html.indexOf('&amp;') !== -1, '& 应被转义');
        });

        TR.test('应处理空值', function() {
            TR.assertEqual(App.esc(null), '', 'null 应返回空字符串');
            TR.assertEqual(App.esc(undefined), '', 'undefined 应返回空字符串');
        });

        TR.test('应正确处理普通文本', function() {
            TR.assertEqual(App.esc('hello world'), 'hello world', '普通文本应保持不变');
        });

        TR.test('应转义特殊字符', function() {
            var result = App.esc('a<b>c&d"e');
            TR.assert(result.indexOf('<') === -1, '< 应被转义');
            TR.assert(result.indexOf('>') === -1, '> 应被转义');
        });
    });
})();
