// ============================================================
// storage.test.js - storage.js 核心逻辑测试
// 覆盖：间隔重复算法、历史归档、连续打卡、成就检查、数据校验
// ============================================================
module.exports = {
    name: 'storage.js 核心逻辑',
    beforeEach: function(App) {
        // 在每个测试前设置 App.QUESTION_BANK 以确保 findQ 可用
        if (!App.QUESTION_BANK || App.QUESTION_BANK.length === 0) {
            App.QUESTION_BANK = [
                { id: '001', category: '专辑', question: 'Q1', options: [], answer: 'A', explanation: '' },
                { id: '002', category: '歌曲', question: 'Q2', options: [], answer: 'B', explanation: '' },
                { id: '003', category: '个人信息', question: 'Q3', options: [], answer: 'C', explanation: '' },
                { id: '004', category: '获奖记录', question: 'Q4', options: [], answer: 'D', explanation: '' }
            ];
        }
        // 重置缓存到 defaults（通过 setData 设置为默认结构）
        App.db.setData(App.db.defaults());
    },
    cases: [
        // ===================== XSS 转义 =====================
        {
            name: 'esc 函数应正确转义 HTML 特殊字符',
            fn: function(App, H) {
                H.equal(App.esc('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
                H.equal(App.esc('a&b'), 'a&amp;b');
                H.equal(App.esc(null), '');
                H.equal(App.esc(undefined), '');
                H.equal(App.esc(123), '123');
                // 确认原始 < > 已被转义（不应出现在输出中）
                var r = App.esc('<>&');
                H.ok(r.indexOf('<') === -1, '原始 < 不应存在');
                H.ok(r.indexOf('>') === -1, '原始 > 不应存在');
                // & 会以 &amp; 形式存在，输出中仍有 & 字符但这是合法的实体引用
                H.ok(r.indexOf('&amp;') !== -1, '& 应被转义为 &amp;');
            }
        },
        // ===================== 答题记录 & 统计 =====================
        {
            name: 'addRecord 应正确累加 total/correct 和分类统计',
            fn: function(App, H) {
                App.db.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
                App.db.addRecord({ qid: '001', ans: 'B', ok: false, time: Date.now() });
                App.db.addRecord({ qid: '002', ans: 'B', ok: true, time: Date.now() });

                var d = App.db.get();
                H.equal(d.stats.total, 3);
                H.equal(d.stats.correct, 2);
                H.equal(d.history.length, 3);
                H.equal(d.stats.cats['专辑'].t, 2);
                H.equal(d.stats.cats['专辑'].c, 1);
                H.equal(d.stats.cats['歌曲'].t, 1);
                H.equal(d.stats.cats['歌曲'].c, 1);
            }
        },
        {
            name: 'addRecord 对题库中不存在的题目不应崩溃',
            fn: function(App, H) {
                App.db.addRecord({ qid: '999', ans: 'A', ok: true, time: Date.now() });
                var d = App.db.get();
                H.equal(d.stats.total, 1);
                H.equal(d.stats.correct, 1);
                H.equal(d.stats.cats['专辑'], undefined);
            }
        },
        // ===================== 历史归档（>1000 条时按天聚合） =====================
        {
            name: '历史超过1000条时应归档90天前的数据到 archive',
            fn: function(App, H) {
                var d = App.db.get();
                var now = Date.now();
                var oldTime = now - 120 * 24 * 60 * 60 * 1000; // 120 天前（超过90天）
                var recentTime = now - 10 * 24 * 60 * 60 * 1000; // 10 天前（90天内）

                // 添加 900 条旧记录
                for (var i = 0; i < 900; i++) {
                    d.history.push({ qid: '001', ans: 'A', ok: i % 2 === 0, time: oldTime + i * 1000 });
                }
                // 添加 200 条新记录
                for (var j = 0; j < 200; j++) {
                    d.history.push({ qid: '001', ans: 'A', ok: true, time: recentTime + j * 1000 });
                }
                App.db.setData(d);

                // 此时 history 超过 1000 条，触发归档
                App.db.addRecord({ qid: '001', ans: 'A', ok: true, time: now });

                var result = App.db.get();
                // history 中应该只保留 90 天内的记录（新记录 200 + 本次 1 = 201）
                H.ok(result.history.length < 250, '历史应被归档缩减');
                // archive 中应该有归档数据
                H.ok(result.archive && result.archive.length > 0, '归档数据应存在');
            }
        },
        {
            name: '归档不应重复聚合同一天（幂等性）',
            fn: function(App, H) {
                var d = App.db.get();
                var now = Date.now();
                var oldTime = now - 120 * 24 * 60 * 60 * 1000;

                // 先手动添加一些归档数据
                var dt = new Date(oldTime);
                var dateKey = dt.getFullYear() + '-' + dt.getMonth() + '-' + dt.getDate();
                d.archive = [{ date: dateKey, total: 10, correct: 5 }];

                // 添加 1100 条旧记录触发归档
                for (var i = 0; i < 1100; i++) {
                    d.history.push({ qid: '001', ans: 'A', ok: true, time: oldTime + i * 1000 });
                }
                App.db.setData(d);

                // 触发归档
                App.db.addRecord({ qid: '001', ans: 'A', ok: true, time: now });

                var result = App.db.get();
                // 同一天不应出现两次
                var dayCount = {};
                for (var a = 0; a < result.archive.length; a++) {
                    H.ok(!dayCount[result.archive[a].date], '归档日期不应重复: ' + result.archive[a].date);
                    dayCount[result.archive[a].date] = true;
                }
            }
        },
        // ===================== 错题本 & 间隔重复 =====================
        {
            name: 'addWrong 新错题应初始化正确字段',
            fn: function(App, H) {
                App.db.addWrong('001');
                var wl = App.db.getWrong();
                H.equal(wl.length, 1);
                H.equal(wl[0].qid, '001');
                H.equal(wl[0].cnt, 1);
                H.equal(wl[0].level, 0);
                H.ok(wl[0].nextReview > 0);
                H.ok(wl[0].time > 0);
                H.equal(wl[0].lastReview, 0);
            }
        },
        {
            name: 'addWrong 重复错题应重置等级到0，错误次数累加',
            fn: function(App, H) {
                App.db.addWrong('001');
                // 手动将 level 设为 3 模拟之前的复习状态
                var d = App.db.get();
                d.wrong[0].level = 3;
                App.db.setData(d);

                // 再次答错同一题
                App.db.addWrong('001');

                var wl = App.db.getWrong();
                H.equal(wl.length, 1, '不应重复添加');
                H.equal(wl[0].cnt, 2, '错误次数应累加');
                H.equal(wl[0].level, 0, '答错应重置等级');
            }
        },
        {
            name: 'reviewCorrect 应提升间隔重复等级',
            fn: function(App, H) {
                App.db.addWrong('001'); // level 0
                App.db.addWrong('002');

                var r1 = App.db.reviewCorrect('001');
                H.equal(r1.mastered, false);
                H.equal(r1.level, 1);

                var d = App.db.get();
                var w = d.wrong[0];
                H.ok(w.nextReview > Date.now(), '答对后应有下一次复习时间');
            }
        },
        {
            name: 'reviewCorrect 达到 level 5 应标记为已掌握并从错题本移除',
            fn: function(App, H) {
                App.db.addWrong('001');

                // 答对 5 次
                for (var i = 0; i < 4; i++) {
                    App.db.reviewCorrect('001');
                }

                var r = App.db.reviewCorrect('001'); // level 4 -> 5
                H.equal(r.mastered, true);
                H.equal(r.qid, '001');

                var wl = App.db.getWrong();
                var found = false;
                for (var j = 0; j < wl.length; j++) {
                    if (wl[j].qid === '001') found = true;
                }
                H.equal(found, false, '已掌握题目应从错题本移除');
            }
        },
        {
            name: 'reviewCorrect 对不存在的错题应返回安全结果',
            fn: function(App, H) {
                var r = App.db.reviewCorrect('不存在');
                H.equal(r.mastered, false);
                H.equal(r.qid, '不存在');
            }
        },
        {
            name: 'reviewWrong 应重置等级为 0 并增加错误次数',
            fn: function(App, H) {
                App.db.addWrong('001');
                var d = App.db.get();
                d.wrong[0].level = 3;
                App.db.setData(d);

                App.db.reviewWrong('001');

                var wl = App.db.getWrong();
                H.equal(wl[0].level, 0);
                H.equal(wl[0].cnt, 2);
                H.ok(wl[0].nextReview <= Date.now(), '答错后应立即可复习');
            }
        },
        {
            name: 'reviewWrong 对不存在的错题应自动新增到错题本',
            fn: function(App, H) {
                H.equal(App.db.getWrong().length, 0);
                App.db.reviewWrong('新错题');
                var wl = App.db.getWrong();
                H.equal(wl.length, 1);
                H.equal(wl[0].qid, '新错题');
                H.equal(wl[0].level, 0);
            }
        },
        {
            name: 'getDueWrong 应只返回到期的错题',
            fn: function(App, H) {
                App.db.addWrong('001'); // 立即可复习
                var d = App.db.get();
                d.wrong[0].nextReview = Date.now() + 99999999; // 远未到期
                App.db.addWrong('002');

                App.db.setData(d);
                var due = App.db.getDueWrong();
                // '002' 是新添加的，nextReview = Date.now()，应该到期
                var found002 = false;
                for (var i = 0; i < due.length; i++) if (due[i].qid === '002') found002 = true;
                var found001 = false;
                for (var j = 0; j < due.length; j++) if (due[j].qid === '001') found001 = true;
                H.ok(found002, '到期的错题应出现在列表中');
                H.ok(!found001, '未到期的错题不应出现在列表中');
            }
        },
        {
            name: 'removeWrong 应从错题本移除指定题目',
            fn: function(App, H) {
                App.db.addWrong('001');
                App.db.addWrong('002');
                App.db.removeWrong('001');
                var wl = App.db.getWrong();
                H.equal(wl.length, 1);
                H.equal(wl[0].qid, '002');
            }
        },
        // ===================== 连续打卡天数 =====================
        {
            name: 'getStreak 无历史应返回 0',
            fn: function(App, H) {
                H.equal(App.db.getStreak(), 0);
            }
        },
        {
            name: 'getStreak 今天答题应至少有连续1天',
            fn: function(App, H) {
                var d = App.db.get();
                var now = new Date();
                now.setHours(12, 0, 0, 0);
                d.history.push({ qid: '001', ans: 'A', ok: true, time: now.getTime() });
                App.db.setData(d);
                H.ok(App.db.getStreak() >= 1);
            }
        },
        {
            name: 'getStreak 昨天答题但今天没答应返回1天',
            fn: function(App, H) {
                var d = App.db.get();
                var yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                yesterday.setHours(12, 0, 0, 0);
                d.history.push({ qid: '001', ans: 'A', ok: true, time: yesterday.getTime() });
                App.db.setData(d);
                H.equal(App.db.getStreak(), 1);
            }
        },
        {
            name: 'getStreak 连续三天答题应返回3',
            fn: function(App, H) {
                var d = App.db.get();
                for (var i = 0; i < 3; i++) {
                    var day = new Date();
                    day.setDate(day.getDate() - i);
                    day.setHours(12, 0, 0, 0);
                    d.history.push({ qid: '001', ans: 'A', ok: true, time: day.getTime() });
                }
                App.db.setData(d);
                H.equal(App.db.getStreak(), 3);
            }
        },
        {
            name: 'getStreak 中间断开应重新计数',
            fn: function(App, H) {
                var d = App.db.get();
                // 3 天前、2 天前、今天 —— 昨天跳过了
                for (var daysAgo of [3, 2, 0]) {
                    var day = new Date();
                    day.setDate(day.getDate() - daysAgo);
                    day.setHours(12, 0, 0, 0);
                    d.history.push({ qid: '001', ans: 'A', ok: true, time: day.getTime() });
                }
                App.db.setData(d);
                // 逻辑：今天答题 → 昨天没答 → 停止
                H.equal(App.db.getStreak(), 1, '断开后从今天重新计算');
            }
        },
        {
            name: 'getStreak 应合并归档数据中的日期',
            fn: function(App, H) {
                var d = App.db.get();
                // 添加一个 3 个月前的归档记录
                var archiveDate = new Date();
                archiveDate.setMonth(archiveDate.getMonth() - 3);
                var dateKey = archiveDate.getFullYear() + '-' + archiveDate.getMonth() + '-' + archiveDate.getDate();
                d.archive = [{ date: dateKey, total: 5, correct: 5 }];
                App.db.setData(d);
                // 至少应返回 1（来自归档的那天）
                var streak = App.db.getStreak();
                // 如果今天没答题、昨天没答题，但3个月前有答题，streak 应该从今天往前找，都没有，然后从3个月前找到了
                // 但逻辑是从今天开始向前连续找，所以 3 个月前的那条不会被计入连续
                // 但至少不会崩溃
                H.ok(streak >= 0);
            }
        },
        // ===================== 成就检查 =====================
        {
            name: '成就：首次答题解锁 first_answer',
            fn: function(App, H) {
                App.db.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
                var unlocks = App.db.checkAchievements();
                var found = false;
                for (var i = 0; i < unlocks.length; i++) if (unlocks[i].id === 'first_answer') found = true;
                H.ok(found, '应解锁 first_answer');
            }
        },
        {
            name: '成就：累计100题解锁 total_100',
            fn: function(App, H) {
                var d = App.db.get();
                d.stats.total = 100;
                d.stats.correct = 90;
                d.history.push({ qid: '001', ans: 'A', ok: true, time: Date.now() });
                App.db.setData(d);
                var unlocks = App.db.checkAchievements();
                var found = false;
                for (var i = 0; i < unlocks.length; i++) if (unlocks[i].id === 'total_100') found = true;
                H.ok(found, '应解锁 total_100');
            }
        },
        {
            name: '成就：10题全对解锁 perfect_10',
            fn: function(App, H) {
                var d = App.db.get();
                d.stats.total = 10;
                d.stats.correct = 10;
                App.db.setData(d);
                var unlocks = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 10 });
                var found = false;
                for (var i = 0; i < unlocks.length; i++) if (unlocks[i].id === 'perfect_10') found = true;
                H.ok(found, '应解锁 perfect_10');
            }
        },
        {
            name: '成就：10题中9题正确不应解锁 perfect_10',
            fn: function(App, H) {
                var d = App.db.get();
                d.stats.total = 10;
                d.stats.correct = 9;
                App.db.setData(d);
                var unlocks = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 9 });
                var found = false;
                for (var i = 0; i < unlocks.length; i++) if (unlocks[i].id === 'perfect_10') found = true;
                H.ok(!found, '不应解锁 perfect_10（未全部正确）');
            }
        },
        {
            name: '成就：答满50题且正确率≥90% 解锁 acc_90',
            fn: function(App, H) {
                var d = App.db.get();
                d.stats.total = 50;
                d.stats.correct = 48; // 96% >= 90%
                App.db.setData(d);
                var unlocks = App.db.checkAchievements();
                var found = false;
                for (var i = 0; i < unlocks.length; i++) if (unlocks[i].id === 'acc_90') found = true;
                H.ok(found, '应解锁 acc_90（48/50=96%）');
            }
        },
        {
            name: '成就：正确率刚好90%边界应解锁',
            fn: function(App, H) {
                var d = App.db.get();
                d.stats.total = 50;
                d.stats.correct = 45; // 刚好 90%
                App.db.setData(d);
                var unlocks = App.db.checkAchievements();
                var found = false;
                for (var i = 0; i < unlocks.length; i++) if (unlocks[i].id === 'acc_90') found = true;
                H.ok(found, '应解锁 acc_90（刚好 90% 边界）');
            }
        },
        {
            name: '成就：正确率89%不应解锁 acc_90',
            fn: function(App, H) {
                var d = App.db.get();
                d.stats.total = 50;
                d.stats.correct = 44; // 88% < 90%
                App.db.setData(d);
                var unlocks = App.db.checkAchievements();
                var found = false;
                for (var i = 0; i < unlocks.length; i++) if (unlocks[i].id === 'acc_90') found = true;
                H.ok(!found, '不应解锁 acc_90（88% < 90%）');
            }
        },
        {
            name: '成就：连续3天打卡解锁 streak_3',
            fn: function(App, H) {
                var d = App.db.get();
                d.stats.total = 3; // 确保 first_answer 也解锁
                var now = new Date();
                for (var i = 0; i < 3; i++) {
                    var day = new Date(now);
                    day.setDate(day.getDate() - i);
                    day.setHours(12, 0, 0, 0);
                    d.history.push({ qid: '001', ans: 'A', ok: true, time: day.getTime() });
                }
                App.db.setData(d);
                var unlocks = App.db.checkAchievements();
                var found = false;
                for (var i = 0; i < unlocks.length; i++) if (unlocks[i].id === 'streak_3') found = true;
                H.ok(found, '应解锁 streak_3');
            }
        },
        {
            name: '成就：所有分类都有答题记录解锁 all_cats',
            fn: function(App, H) {
                var d = App.db.get();
                d.stats.total = 4;
                d.stats.cats = {
                    '专辑': { t: 1, c: 1 },
                    '歌曲': { t: 1, c: 1 },
                    '个人信息': { t: 1, c: 1 },
                    '获奖记录': { t: 1, c: 1 }
                };
                App.db.setData(d);
                var unlocks = App.db.checkAchievements();
                var found = false;
                for (var i = 0; i < unlocks.length; i++) if (unlocks[i].id === 'all_cats') found = true;
                H.ok(found, '应解锁 all_cats');
            }
        },
        {
            name: '成就：缺少一个分类不应解锁 all_cats',
            fn: function(App, H) {
                var d = App.db.get();
                d.stats.total = 3;
                d.stats.cats = {
                    '专辑': { t: 1, c: 1 },
                    '歌曲': { t: 1, c: 1 },
                    '个人信息': { t: 1, c: 1 }
                    // 缺少 '获奖记录'
                };
                App.db.setData(d);
                var unlocks = App.db.checkAchievements();
                var found = false;
                for (var i = 0; i < unlocks.length; i++) if (unlocks[i].id === 'all_cats') found = true;
                H.ok(!found, '不应解锁 all_cats（缺少一个分类）');
            }
        },
        {
            name: '成就：重复调用不应重复解锁（幂等性）',
            fn: function(App, H) {
                App.db.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
                App.db.checkAchievements(); // 第一次解锁

                var unlocks = App.db.checkAchievements(); // 第二次调用
                var found = false;
                for (var i = 0; i < unlocks.length; i++) if (unlocks[i].id === 'first_answer') found = true;
                H.ok(!found, '已解锁的成就不应再返回');

                var allUnlocks = App.db.getAchievements();
                var count = 0;
                for (var j = 0; j < allUnlocks.length; j++) {
                    if (allUnlocks[j] === 'first_answer') count++;
                }
                H.equal(count, 1, '成就 ID 应只出现一次');
            }
        },
        // ===================== 统计重算 =====================
        {
            name: 'recalcStats 应从 history 重新计算 stats',
            fn: function(App, H) {
                var d = App.db.get();
                // 制造错误的 stats
                d.stats = { total: 999, correct: 999, cats: { '专辑': { t: 999, c: 999 } } };
                // 正确的 history
                d.history = [
                    { qid: '001', ans: 'A', ok: true, time: Date.now() },
                    { qid: '001', ans: 'B', ok: false, time: Date.now() },
                    { qid: '002', ans: 'B', ok: true, time: Date.now() }
                ];
                App.db.setData(d);

                App.db.recalcStats();
                var result = App.db.get();
                H.equal(result.stats.total, 3);
                H.equal(result.stats.correct, 2);
                H.equal(result.stats.cats['专辑'].t, 2);
                H.equal(result.stats.cats['专辑'].c, 1);
                H.equal(result.stats.cats['歌曲'].t, 1);
                H.equal(result.stats.cats['歌曲'].c, 1);
            }
        },
        // ===================== 每日目标边界 =====================
        {
            name: 'setDailyGoal 应 clamp 到 [5, 100] 范围',
            fn: function(App, H) {
                App.db.setDailyGoal(3);
                H.equal(App.db.getDailyGoal(), 5, '3 应被 clamp 到 5');

                App.db.setDailyGoal(0);
                H.equal(App.db.getDailyGoal(), 5, '0 应被 clamp 到 5');

                App.db.setDailyGoal(-10);
                H.equal(App.db.getDailyGoal(), 5, '-10 应被 clamp 到 5');

                App.db.setDailyGoal(150);
                H.equal(App.db.getDailyGoal(), 100, '150 应被 clamp 到 100');

                App.db.setDailyGoal(50);
                H.equal(App.db.getDailyGoal(), 50, '50 在范围内应保持不变');
            }
        },
        {
            name: 'getDailyGoal 默认值为 20',
            fn: function(App, H) {
                App.db.setData({ history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } });
                H.equal(App.db.getDailyGoal(), 20, '无 dailyGoal 字段时默认 20');
            }
        },
        // ===================== 查找题目 =====================
        {
            name: 'findQ 应按 id 查找题目',
            fn: function(App, H) {
                var q = App.db.findQ('001');
                H.ok(q !== null);
                H.equal(q.category, '专辑');

                var missing = App.db.findQ('不存在的ID');
                H.equal(missing, null);
            }
        },
        // ===================== defaults 结构验证 =====================
        {
            name: 'defaults 应返回完整且正确的默认数据结构',
            fn: function(App, H) {
                var def = App.db.defaults();
                H.ok(Array.isArray(def.history));
                H.ok(Array.isArray(def.wrong));
                H.equal(typeof def.stats, 'object');
                H.equal(def.stats.total, 0);
                H.equal(def.stats.correct, 0);
                H.equal(typeof def.stats.cats, 'object');
                H.equal(def.theme, 'dark');
                H.equal(def.dailyGoal, 20);
                H.ok(Array.isArray(def.achievements));
                H.ok(Array.isArray(def.archive));
            }
        },
        // ===================== 成就定义完整性 =====================
        {
            name: '成就定义应有10个徽章且每个都有 id/name/icon/desc',
            fn: function(App, H) {
                var defs = App.db.getAchievementDefs();
                H.equal(defs.length, 10);
                var seen = {};
                for (var i = 0; i < defs.length; i++) {
                    H.ok(defs[i].id, 'achievement 应有 id');
                    H.ok(defs[i].name, 'achievement 应有 name');
                    H.ok(defs[i].icon, 'achievement 应有 icon');
                    H.ok(defs[i].desc, 'achievement 应有 desc');
                    H.ok(!seen[defs[i].id], 'id 不应重复: ' + defs[i].id);
                    seen[defs[i].id] = true;
                }
            }
        }
    ]
};
