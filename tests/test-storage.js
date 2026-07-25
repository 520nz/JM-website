(function() {
    var App = window.App || {};

    function createMockQuestion(id, category) {
        return {
            id: id,
            category: category || '专辑',
            question: '测试问题',
            options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }],
            answer: 'A',
            explanation: '测试解析'
        };
    }

    function setupTestData() {
        var mockData = {
            history: [],
            wrong: [],
            stats: { total: 0, correct: 0, cats: {} },
            theme: 'dark',
            dailyGoal: 20,
            achievements: [],
            archive: []
        };
        App.db.setData(mockData);
        App.QUESTION_BANK = [
            createMockQuestion('q001', '专辑'),
            createMockQuestion('q002', '歌曲'),
            createMockQuestion('q003', '个人信息')
        ];
    }

    Test.suite('Storage.js - XSS转义工具');

    Test.test('esc() 应转义HTML特殊字符', function() {
        assert.equal(App.esc('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
        assert.equal(App.esc('<div>hello</div>'), '&lt;div&gt;hello&lt;/div&gt;');
        assert.equal(App.esc('&'), '&amp;');
    });

    Test.test('esc() 应处理null和undefined', function() {
        assert.equal(App.esc(null), '');
        assert.equal(App.esc(undefined), '');
        assert.equal(App.esc(0), '0');
        assert.equal(App.esc(false), 'false');
    });

    Test.test('esc() 应处理普通字符串', function() {
        assert.equal(App.esc('Hello World'), 'Hello World');
        assert.equal(App.esc('林俊杰'), '林俊杰');
    });

    Test.suite('Storage.js - 错题管理与间隔重复');

    Test.test('addWrong() 应添加新错题', function() {
        setupTestData();
        App.db.addWrong('q001');
        var wrong = App.db.getWrong();
        assert.equal(wrong.length, 1);
        assert.equal(wrong[0].qid, 'q001');
        assert.equal(wrong[0].cnt, 1);
        assert.equal(wrong[0].level, 0);
        assert.ok(wrong[0].time > 0);
        assert.ok(wrong[0].nextReview > 0);
    });

    Test.test('addWrong() 应增加已存在错题的计数并重置等级', function() {
        setupTestData();
        App.db.addWrong('q001');
        App.db.addWrong('q001');
        var wrong = App.db.getWrong();
        assert.equal(wrong.length, 1);
        assert.equal(wrong[0].cnt, 2);
        assert.equal(wrong[0].level, 0);
    });

    Test.test('reviewCorrect() 应提升等级并返回mastered状态', function() {
        setupTestData();
        App.db.addWrong('q001');
        var result = App.db.reviewCorrect('q001');
        assert.equal(result.mastered, false);
        assert.equal(result.level, 1);
        assert.equal(result.qid, 'q001');

        var wrong = App.db.getWrong();
        assert.equal(wrong.length, 1);
        assert.equal(wrong[0].level, 1);
        assert.ok(wrong[0].nextReview > Date.now());
    });

    Test.test('reviewCorrect() 应在level>=5时移除错题并返回mastered=true', function() {
        setupTestData();
        App.db.addWrong('q001');
        App.db.reviewCorrect('q001');
        App.db.reviewCorrect('q001');
        App.db.reviewCorrect('q001');
        App.db.reviewCorrect('q001');
        var result = App.db.reviewCorrect('q001');
        assert.equal(result.mastered, true);
        assert.equal(result.qid, 'q001');

        var wrong = App.db.getWrong();
        assert.equal(wrong.length, 0);
    });

    Test.test('reviewCorrect() 应处理不存在的错题', function() {
        setupTestData();
        var result = App.db.reviewCorrect('nonexistent');
        assert.equal(result.mastered, false);
        assert.equal(result.qid, 'nonexistent');
    });

    Test.test('reviewWrong() 应重置等级并增加计数', function() {
        setupTestData();
        App.db.addWrong('q001');
        App.db.reviewCorrect('q001');
        var wrong = App.db.getWrong();
        assert.equal(wrong[0].level, 1);

        App.db.reviewWrong('q001');
        wrong = App.db.getWrong();
        assert.equal(wrong[0].level, 0);
        assert.equal(wrong[0].cnt, 2);
        assert.ok(Math.abs(wrong[0].nextReview - Date.now()) < 100);
    });

    Test.test('reviewWrong() 应在错题不存在时添加新错题', function() {
        setupTestData();
        App.db.reviewWrong('q001');
        var wrong = App.db.getWrong();
        assert.equal(wrong.length, 1);
        assert.equal(wrong[0].qid, 'q001');
        assert.equal(wrong[0].cnt, 1);
    });

    Test.test('removeWrong() 应移除指定错题', function() {
        setupTestData();
        App.db.addWrong('q001');
        App.db.addWrong('q002');
        assert.equal(App.db.getWrong().length, 2);

        App.db.removeWrong('q001');
        assert.equal(App.db.getWrong().length, 1);
        assert.equal(App.db.getWrong()[0].qid, 'q002');
    });

    Test.test('getDueWrong() 应返回到期或无nextReview的错题', function() {
        setupTestData();
        App.db.addWrong('q001');
        var wrong = App.db.get();
        wrong.wrong[0].nextReview = Date.now() - 1000;
        App.db.setData(wrong);

        var due = App.db.getDueWrong();
        assert.equal(due.length, 1);
        assert.equal(due[0].qid, 'q001');
    });

    Test.test('getDueWrong() 应过滤未到期的错题', function() {
        setupTestData();
        App.db.addWrong('q001');
        var wrong = App.db.get();
        wrong.wrong[0].nextReview = Date.now() + 86400000;
        App.db.setData(wrong);

        var due = App.db.getDueWrong();
        assert.equal(due.length, 0);
    });

    Test.suite('Storage.js - 答题记录与统计');

    Test.test('addRecord() 应添加答题记录并更新统计', function() {
        setupTestData();
        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: Date.now() });

        var data = App.db.get();
        assert.equal(data.history.length, 1);
        assert.equal(data.stats.total, 1);
        assert.equal(data.stats.correct, 1);
        assert.ok(data.stats.cats['专辑']);
        assert.equal(data.stats.cats['专辑'].t, 1);
        assert.equal(data.stats.cats['专辑'].c, 1);
    });

    Test.test('addRecord() 应正确统计错题', function() {
        setupTestData();
        App.db.addRecord({ qid: 'q001', ans: 'B', ok: false, time: Date.now() });

        var data = App.db.get();
        assert.equal(data.stats.total, 1);
        assert.equal(data.stats.correct, 0);
        assert.equal(data.stats.cats['专辑'].t, 1);
        assert.equal(data.stats.cats['专辑'].c, 0);
    });

    Test.test('addRecord() 应按分类统计', function() {
        setupTestData();
        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: Date.now() });
        App.db.addRecord({ qid: 'q002', ans: 'A', ok: true, time: Date.now() });
        App.db.addRecord({ qid: 'q002', ans: 'B', ok: false, time: Date.now() });

        var cats = App.db.get().stats.cats;
        assert.equal(cats['专辑'].t, 1);
        assert.equal(cats['专辑'].c, 1);
        assert.equal(cats['歌曲'].t, 2);
        assert.equal(cats['歌曲'].c, 1);
    });

    Test.test('findQ() 应根据ID查找题目', function() {
        setupTestData();
        var q = App.db.findQ('q001');
        assert.ok(q);
        assert.equal(q.id, 'q001');
        assert.equal(q.category, '专辑');
    });

    Test.test('findQ() 应返回null当题目不存在', function() {
        setupTestData();
        var q = App.db.findQ('nonexistent');
        assert.equal(q, null);
    });

    Test.suite('Storage.js - 每日目标');

    Test.test('getDailyGoal() 应返回默认目标20', function() {
        setupTestData();
        assert.equal(App.db.getDailyGoal(), 20);
    });

    Test.test('setDailyGoal() 应设置每日目标并限制在5-100之间', function() {
        setupTestData();
        App.db.setDailyGoal(50);
        assert.equal(App.db.getDailyGoal(), 50);

        App.db.setDailyGoal(3);
        assert.equal(App.db.getDailyGoal(), 5);

        App.db.setDailyGoal(150);
        assert.equal(App.db.getDailyGoal(), 100);
    });

    Test.suite('Storage.js - 默认数据');

    Test.test('defaults() 应返回正确的默认数据结构', function() {
        var def = App.db.defaults();
        assert.deepEqual(def.history, []);
        assert.deepEqual(def.wrong, []);
        assert.deepEqual(def.stats, { total: 0, correct: 0, cats: {} });
        assert.equal(def.theme, 'dark');
        assert.equal(def.dailyGoal, 20);
        assert.deepEqual(def.achievements, []);
        assert.deepEqual(def.archive, []);
    });

    Test.suite('Storage.js - Session管理');

    Test.test('session.save() 和 session.load() 应正确序列化状态', function() {
        var state = {
            quiz: [createMockQuestion('q001'), createMockQuestion('q002')],
            idx: 1,
            correctCount: 0,
            startTime: Date.now(),
            mode: 'quick'
        };
        App.session.save(state);
        var loaded = App.session.load();

        assert.ok(loaded);
        assert.deepEqual(loaded.quizIds, ['q001', 'q002']);
        assert.equal(loaded.idx, 1);
        assert.equal(loaded.correctCount, 0);
        assert.equal(loaded.mode, 'quick');
        assert.ok(loaded.startTime > 0);
    });

    Test.test('session.clear() 应清除保存的会话', function() {
        var state = {
            quiz: [createMockQuestion('q001')],
            idx: 0,
            correctCount: 0,
            startTime: Date.now(),
            mode: 'quick'
        };
        App.session.save(state);
        assert.ok(App.session.load());

        App.session.clear();
        assert.equal(App.session.load(), null);
    });

    Test.suite('Storage.js - 历史数据归档');

    Test.test('addRecord() 应在超过1000条时归档90天前的数据', function() {
        setupTestData();
        var oldTime = Date.now() - 91 * 24 * 60 * 60 * 1000;
        for (var i = 0; i < 1050; i++) {
            App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: oldTime - i * 1000 });
        }

        var data = App.db.get();
        assert.ok(data.archive.length > 0);
        assert.ok(data.history.length <= 1000);

        var totalArchived = 0;
        for (var j = 0; j < data.archive.length; j++) {
            totalArchived += data.archive[j].total;
        }
        assert.ok(totalArchived > 0);
    });

    Test.test('addRecord() 归档数据应按天聚合', function() {
        setupTestData();
        var oldTime = Date.now() - 91 * 24 * 60 * 60 * 1000;
        var day1 = oldTime;
        var day2 = oldTime + 25 * 60 * 60 * 1000;

        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: day1 });
        App.db.addRecord({ qid: 'q002', ans: 'B', ok: false, time: day1 });
        App.db.addRecord({ qid: 'q003', ans: 'A', ok: true, time: day2 });

        for (var i = 0; i < 1000; i++) {
            App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: Date.now() - i * 1000 });
        }

        var data = App.db.get();
        assert.ok(data.archive.length >= 1);

        var totalArchived = 0;
        for (var j = 0; j < data.archive.length; j++) {
            totalArchived += data.archive[j].total;
        }
        assert.ok(totalArchived >= 3);
    });

    Test.test('addRecord() 应保留90天内的数据', function() {
        setupTestData();
        var recentTime = Date.now() - 30 * 24 * 60 * 60 * 1000;
        for (var i = 0; i < 1100; i++) {
            App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: recentTime - i * 1000 });
        }

        var data = App.db.get();
        assert.equal(data.archive.length, 0);
        assert.equal(data.history.length, 1100);
    });

    Test.suite('Storage.js - 成就检查边界条件');

    Test.test('checkAchievements() 应解锁 streak_3 成就', function() {
        setupTestData();
        var today = new Date().setHours(0, 0, 0, 0);
        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: today - 2 * 86400000 });
        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: today - 1 * 86400000 });
        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: today });

        var unlocks = App.db.checkAchievements();
        var ids = unlocks.map(function(u) { return u.id; });
        assert.ok(ids.includes('streak_3'));
    });

    Test.test('checkAchievements() 应解锁 streak_7 成就', function() {
        setupTestData();
        var today = new Date().setHours(0, 0, 0, 0);
        for (var i = 0; i < 7; i++) {
            App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: today - i * 86400000 });
        }

        var unlocks = App.db.checkAchievements();
        var ids = unlocks.map(function(u) { return u.id; });
        assert.ok(ids.includes('streak_7'));
    });

    Test.test('checkAchievements() 应解锁 total_500 成就', function() {
        setupTestData();
        var now = Date.now();
        for (var i = 0; i < 500; i++) {
            App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: now - i * 1000 });
        }

        var unlocks = App.db.checkAchievements();
        var ids = unlocks.map(function(u) { return u.id; });
        assert.ok(ids.includes('total_500'));
    });

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { run: function() { return Test.run(); } };
    }
})();