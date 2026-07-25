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
            createMockQuestion('q003', '个人信息'),
            createMockQuestion('q004', '获奖记录')
        ];
    }

    Test.suite('Storage.js - 成就徽章');

    Test.test('getAchievementDefs() 应返回所有成就定义', function() {
        var defs = App.db.getAchievementDefs();
        assert.ok(Array.isArray(defs));
        assert.ok(defs.length > 0);
        var ids = defs.map(function(d) { return d.id; });
        assert.ok(ids.includes('first_answer'));
        assert.ok(ids.includes('perfect_10'));
        assert.ok(ids.includes('daily_50'));
        assert.ok(ids.includes('streak_3'));
        assert.ok(ids.includes('streak_7'));
        assert.ok(ids.includes('total_100'));
        assert.ok(ids.includes('total_500'));
        assert.ok(ids.includes('acc_90'));
        assert.ok(ids.includes('wrong_clear'));
        assert.ok(ids.includes('all_cats'));
    });

    Test.test('checkAchievements() 应解锁 first_answer 成就', function() {
        setupTestData();
        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: Date.now() });
        var unlocks = App.db.checkAchievements();
        var ids = unlocks.map(function(u) { return u.id; });
        assert.ok(ids.includes('first_answer'));
    });

    Test.test('checkAchievements() 应解锁 total_100 成就', function() {
        setupTestData();
        var now = Date.now();
        for (var i = 0; i < 100; i++) {
            App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: now - i * 1000 });
        }
        var unlocks = App.db.checkAchievements();
        var ids = unlocks.map(function(u) { return u.id; });
        assert.ok(ids.includes('total_100'));
    });

    Test.test('checkAchievements() 应解锁 perfect_10 成就', function() {
        setupTestData();
        for (var i = 0; i < 5; i++) {
            App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: Date.now() });
        }
        var unlocks = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 10 });
        var ids = unlocks.map(function(u) { return u.id; });
        assert.ok(ids.includes('perfect_10'));
    });

    Test.test('checkAchievements() 不应重复解锁成就', function() {
        setupTestData();
        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: Date.now() });
        App.db.checkAchievements();
        var unlocks = App.db.checkAchievements();
        assert.equal(unlocks.length, 0);
    });

    Test.test('checkAchievements() 应解锁 acc_90 成就', function() {
        setupTestData();
        var now = Date.now();
        for (var i = 0; i < 45; i++) {
            App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: now - i * 1000 });
        }
        for (var j = 0; j < 5; j++) {
            App.db.addRecord({ qid: 'q002', ans: 'B', ok: false, time: now - j * 1000 });
        }
        var unlocks = App.db.checkAchievements();
        var ids = unlocks.map(function(u) { return u.id; });
        assert.ok(ids.includes('acc_90'));
    });

    Test.test('checkAchievements() 应解锁 daily_50 成就', function() {
        setupTestData();
        var today = new Date().setHours(0, 0, 0, 0);
        for (var i = 0; i < 50; i++) {
            App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: today + i * 1000 });
        }
        var unlocks = App.db.checkAchievements();
        var ids = unlocks.map(function(u) { return u.id; });
        assert.ok(ids.includes('daily_50'));
    });

    Test.test('checkAchievements() 应解锁 all_cats 成就', function() {
        setupTestData();
        var now = Date.now();
        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: now });
        App.db.addRecord({ qid: 'q002', ans: 'A', ok: true, time: now });
        App.db.addRecord({ qid: 'q003', ans: 'A', ok: true, time: now });
        App.db.addRecord({ qid: 'q004', ans: 'A', ok: true, time: now });
        var unlocks = App.db.checkAchievements();
        var ids = unlocks.map(function(u) { return u.id; });
        assert.ok(ids.includes('all_cats'));
    });

    Test.test('checkAchievements() 应解锁 wrong_clear 成就', function() {
        setupTestData();
        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: Date.now() });
        App.db.addWrong('q001');
        var wrong = App.db.getWrong();
        assert.equal(wrong.length, 1);

        App.db.removeWrong('q001');
        var unlocks = App.db.checkAchievements();
        var ids = unlocks.map(function(u) { return u.id; });
        assert.ok(ids.includes('wrong_clear'));
    });

    Test.suite('Storage.js - 连续打卡');

    Test.test('getStreak() 应返回0当无历史记录', function() {
        setupTestData();
        assert.equal(App.db.getStreak(), 0);
    });

    Test.test('getStreak() 应返回1当只有今天答题', function() {
        setupTestData();
        var today = new Date().setHours(0, 0, 0, 0);
        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: today + 1000 });
        assert.equal(App.db.getStreak(), 1);
    });

    Test.test('getStreak() 应返回连续天数', function() {
        setupTestData();
        var today = new Date().setHours(0, 0, 0, 0);
        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: today - 2 * 86400000 });
        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: today - 1 * 86400000 });
        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: today });
        assert.equal(App.db.getStreak(), 3);
    });

    Test.test('getStreak() 应在断签时重置', function() {
        setupTestData();
        var today = new Date().setHours(0, 0, 0, 0);
        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: today - 3 * 86400000 });
        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: today - 2 * 86400000 });
        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: today });
        assert.equal(App.db.getStreak(), 1);
    });

    Test.test('getStreak() 应从昨天开始计算当今天未答题', function() {
        setupTestData();
        var today = new Date().setHours(0, 0, 0, 0);
        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: today - 1 * 86400000 });
        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: today - 2 * 86400000 });
        assert.equal(App.db.getStreak(), 2);
    });

    Test.test('getStreak() 应处理同一天多次答题', function() {
        setupTestData();
        var today = new Date().setHours(0, 0, 0, 0);
        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: today });
        App.db.addRecord({ qid: 'q002', ans: 'A', ok: true, time: today + 1000 });
        App.db.addRecord({ qid: 'q003', ans: 'A', ok: true, time: today + 2000 });
        assert.equal(App.db.getStreak(), 1);
    });

    Test.suite('Storage.js - 统计重算');

    Test.test('recalcStats() 应从历史记录重新计算统计', function() {
        setupTestData();
        var now = Date.now();
        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: now });
        App.db.addRecord({ qid: 'q002', ans: 'B', ok: false, time: now });

        var data = App.db.get();
        data.stats = { total: 999, correct: 999, cats: {} };
        App.db.setData(data);

        App.db.recalcStats();
        var stats = App.db.get().stats;
        assert.equal(stats.total, 2);
        assert.equal(stats.correct, 1);
        assert.equal(stats.cats['专辑'].t, 1);
        assert.equal(stats.cats['专辑'].c, 1);
        assert.equal(stats.cats['歌曲'].t, 1);
        assert.equal(stats.cats['歌曲'].c, 0);
    });

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { run: function() { return Test.run(); } };
    }
})();