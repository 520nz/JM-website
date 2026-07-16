(function() {
    TestRunner.suite('App.esc (XSS转义)');
    
    TestRunner.assertEqual(App.esc('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;', '转义HTML标签');
    TestRunner.assertEqual(App.esc('&'), '&amp;', '转义&符号');
    TestRunner.assertEqual(App.esc('<div>'), '&lt;div&gt;', '转义尖括号');
    TestRunner.assertEqual(App.esc('"test"'), '&quot;test&quot;', '转义双引号');
    TestRunner.assertEqual(App.esc(null), '', 'null返回空字符串');
    TestRunner.assertEqual(App.esc(undefined), '', 'undefined返回空字符串');
    TestRunner.assertEqual(App.esc(''), '', '空字符串返回空字符串');
    TestRunner.assertEqual(App.esc('normal text'), 'normal text', '普通文本不转义');
    
    TestRunner.suite('App.db.findQ (题目查找)');
    
    TestRunner.assertNotNull(App.db.findQ('001'), '查找存在的题目');
    TestRunner.assertNull(App.db.findQ('nonexistent'), '查找不存在的题目返回null');
    TestRunner.assertEqual(App.db.findQ('001').category, '专辑', '验证题目分类');
    TestRunner.assertEqual(App.db.findQ('001').answer, 'B', '验证题目答案');
    
    TestRunner.suite('App.db 默认值与初始化');
    
    var defaults = App.db.defaults();
    TestRunner.assertEqual(defaults.history.length, 0, '默认history为空');
    TestRunner.assertEqual(defaults.wrong.length, 0, '默认wrong为空');
    TestRunner.assertEqual(defaults.stats.total, 0, '默认stats.total为0');
    TestRunner.assertEqual(defaults.stats.correct, 0, '默认stats.correct为0');
    TestRunner.assertEqual(Object.keys(defaults.stats.cats).length, 0, '默认stats.cats为空');
    
    TestRunner.suite('App.db.get (内存缓存)');
    
    var cache = App.db.get();
    TestRunner.assertNotNull(cache, 'get()返回非null');
    TestRunner.assertType(cache.history, 'object', 'history是数组');
    TestRunner.assertType(cache.wrong, 'object', 'wrong是数组');
    TestRunner.assertType(cache.stats, 'object', 'stats是对象');
    
    TestRunner.suite('App.db.addRecord (答题记录)');
    
    var initialTotal = cache.stats.total;
    var initialCorrect = cache.stats.correct;
    App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
    var newCache = App.db.get();
    TestRunner.assertEqual(newCache.stats.total, initialTotal + 1, 'total增加1');
    TestRunner.assertEqual(newCache.stats.correct, initialCorrect + 1, 'correct增加1');
    TestRunner.assertEqual(newCache.history.length, initialTotal + 1, 'history长度增加');
    
    App.db.addRecord({ qid: '002', ans: 'X', ok: false, time: Date.now() });
    newCache = App.db.get();
    TestRunner.assertEqual(newCache.stats.total, initialTotal + 2, 'total继续增加');
    TestRunner.assertEqual(newCache.stats.correct, initialCorrect + 1, 'correct不变（答错）');
    
    TestRunner.suite('App.db.addWrong (错题管理)');
    
    App.db.addWrong('test_qid_1');
    newCache = App.db.get();
    var wrongItem = newCache.wrong.find(function(w) { return w.qid === 'test_qid_1'; });
    TestRunner.assertNotNull(wrongItem, '新增错题存在');
    TestRunner.assertEqual(wrongItem.cnt, 1, '错题计数为1');
    TestRunner.assertEqual(wrongItem.level, 0, '错题等级为0');
    TestRunner.assertNotNull(wrongItem.time, '错题有时间戳');
    TestRunner.assertNotNull(wrongItem.nextReview, '错题有nextReview');
    
    App.db.addWrong('test_qid_1');
    newCache = App.db.get();
    wrongItem = newCache.wrong.find(function(w) { return w.qid === 'test_qid_1'; });
    TestRunner.assertEqual(wrongItem.cnt, 2, '重复答错计数增加');
    TestRunner.assertEqual(wrongItem.level, 0, '重复答错等级重置为0');
    
    TestRunner.suite('App.db.reviewCorrect (答对错题提升等级)');
    
    App.db.reviewCorrect('test_qid_1');
    newCache = App.db.get();
    wrongItem = newCache.wrong.find(function(w) { return w.qid === 'test_qid_1'; });
    TestRunner.assertEqual(wrongItem.level, 1, '答对后等级提升至1');
    
    App.db.reviewCorrect('test_qid_1');
    newCache = App.db.get();
    wrongItem = newCache.wrong.find(function(w) { return w.qid === 'test_qid_1'; });
    TestRunner.assertEqual(wrongItem.level, 2, '再次答对等级提升至2');
    
    App.db.reviewCorrect('test_qid_1');
    App.db.reviewCorrect('test_qid_1');
    App.db.reviewCorrect('test_qid_1');
    newCache = App.db.get();
    wrongItem = newCache.wrong.find(function(w) { return w.qid === 'test_qid_1'; });
    TestRunner.assert(wrongItem === undefined, '等级达到5后从错题本移除');
    
    TestRunner.suite('App.db.reviewWrong (答错错题重置等级)');
    
    App.db.addWrong('test_qid_2');
    App.db.reviewCorrect('test_qid_2');
    App.db.reviewCorrect('test_qid_2');
    newCache = App.db.get();
    wrongItem = newCache.wrong.find(function(w) { return w.qid === 'test_qid_2'; });
    TestRunner.assertEqual(wrongItem.level, 2, '初始等级为2');
    
    App.db.reviewWrong('test_qid_2');
    newCache = App.db.get();
    wrongItem = newCache.wrong.find(function(w) { return w.qid === 'test_qid_2'; });
    TestRunner.assertEqual(wrongItem.level, 0, '答错后等级重置为0');
    TestRunner.assertEqual(wrongItem.cnt, 2, '答错后计数增加');
    
    TestRunner.suite('App.db.reviewWrong (错题不在列表时新增)');
    
    App.db.reviewWrong('test_qid_not_exist');
    newCache = App.db.get();
    wrongItem = newCache.wrong.find(function(w) { return w.qid === 'test_qid_not_exist'; });
    TestRunner.assertNotNull(wrongItem, 'reviewWrong新增不存在的错题');
    TestRunner.assertEqual(wrongItem.cnt, 1, '新增长错题计数为1');
    
    TestRunner.suite('App.db.getWrong (获取错题列表)');
    
    var wrongList = App.db.getWrong();
    TestRunner.assertType(wrongList, 'object', 'getWrong返回数组');
    TestRunner.assert(wrongList.length >= 2, '错题列表至少有2项');
    
    TestRunner.suite('App.db.getDueWrong (获取到期错题)');
    
    var dueList = App.db.getDueWrong();
    TestRunner.assertType(dueList, 'object', 'getDueWrong返回数组');
    
    var futureItem = { qid: 'future_qid', cnt: 1, level: 1, nextReview: Date.now() + 86400000 };
    newCache.wrong.push(futureItem);
    dueList = App.db.getDueWrong();
    var hasFuture = dueList.some(function(w) { return w.qid === 'future_qid'; });
    TestRunner.assert(!hasFuture, '未到期的错题不在到期列表中');
    
    TestRunner.suite('App.db.removeWrong (移除错题)');
    
    var beforeCount = newCache.wrong.length;
    App.db.removeWrong('test_qid_2');
    newCache = App.db.get();
    TestRunner.assertEqual(newCache.wrong.length, beforeCount - 1, '移除后数量减少');
    wrongItem = newCache.wrong.find(function(w) { return w.qid === 'test_qid_2'; });
    TestRunner.assert(wrongItem === undefined, '移除后不存在');
    
    TestRunner.suite('App.db.recalcStats (重新计算统计)');
    
    var originalHistory = newCache.history.slice();
    var originalStats = JSON.parse(JSON.stringify(newCache.stats));
    
    newCache.history.push({ qid: '001', ans: 'B', ok: true, time: Date.now() });
    newCache.history.push({ qid: '002', ans: 'X', ok: false, time: Date.now() });
    
    App.db.recalcStats();
    newCache = App.db.get();
    
    TestRunner.assertEqual(newCache.stats.total, originalStats.total + 2, 'recalcStats重新计算total');
    TestRunner.assertEqual(newCache.stats.correct, originalStats.correct + 1, 'recalcStats重新计算correct');
    
    TestRunner.suite('App.session (会话存储)');
    
    var testState = { quiz: [{ id: 'q1' }, { id: 'q2' }], idx: 1, correctCount: 5, startTime: Date.now(), mode: 'quick' };
    App.session.save(testState);
    
    var loaded = App.session.load();
    TestRunner.assertNotNull(loaded, 'session.load返回非null');
    TestRunner.assertEqual(loaded.idx, 1, 'session加载idx正确');
    TestRunner.assertEqual(loaded.correctCount, 5, 'session加载correctCount正确');
    TestRunner.assertEqual(loaded.mode, 'quick', 'session加载mode正确');
    TestRunner.assertEqual(loaded.quizIds.length, 2, 'session加载quizIds正确');
    
    App.session.clear();
    loaded = App.session.load();
    TestRunner.assertNull(loaded, 'session.clear后返回null');
    
})();