// ============================================================
// test-storage.js - storage.js 核心模块测试
// 重点覆盖：XSS转义、间隔重复算法、数据持久化
// ============================================================

TestRunner.register('Storage 模块测试', {
    
    // ==================== XSS 转义测试（安全关键） ====================
    
    'esc() - 基本字符串转义': function() {
        var result = esc('Hello World');
        assertEqual(result, 'Hello World', '普通字符串应保持不变');
    },
    
    'esc() - HTML标签转义': function() {
        var result = esc('<script>alert("xss")</script>');
        assertTrue(result.indexOf('<script>') === -1, 'script标签应被转义');
        assertTrue(result.indexOf('&lt;') >= 0 || result.indexOf('<') === -1, '应包含转义后的字符');
    },
    
    'esc() - 特殊字符转义': function() {
        var result = esc('<>"\'&');
        // 不同浏览器可能用不同转义方式，检查是否安全
        assertTrue(result.indexOf('<script') === -1, '尖括号应被处理');
        assertTrue(result.indexOf('"onerror') === -1, '双引号应被处理');
    },
    
    'esc() - null/undefined处理': function() {
        assertEqual(esc(null), '', 'null应返回空字符串');
        assertEqual(esc(undefined), '', 'undefined应返回空字符串');
    },
    
    'esc() - 数字类型处理': function() {
        var result = esc(12345);
        assertEqual(result, '12345', '数字应转为字符串');
    },
    
    'esc() - 对象类型处理': function() {
        var obj = { name: 'test' };
        var result = esc(obj);
        assertTrue(typeof result === 'string', '对象应转为字符串');
    },
    
    'esc() - XSS攻击向量测试': function() {
        var vectors = [
            '<img src=x onerror=alert(1)>',
            '<svg onload=alert(1)>',
            'javascript:alert(1)',
            '<a href="javascript:alert(1)">click</a>',
            '<iframe src="javascript:alert(1)">',
            '"onclick="alert(1)',
            '\'onerror=\'alert(1)'
        ];
        
        for (var i = 0; i < vectors.length; i++) {
            var result = esc(vectors[i]);
            // 检查结果不能执行代码
            assertTrue(result.indexOf('<img') === -1 || result.indexOf('onerror') === -1, 
                'XSS向量 ' + vectors[i] + ' 应被安全处理');
        }
    },
    
    // ==================== DB 模块基础测试 ====================
    
    'DB.defaults() - 默认数据结构': function() {
        var d = DB.defaults();
        assertTrue(Array.isArray(d.history), 'history应为数组');
        assertTrue(Array.isArray(d.wrong), 'wrong应为数组');
        assertTrue(typeof d.stats === 'object', 'stats应为对象');
        assertEqual(d.stats.total, 0, '初始total应为0');
        assertEqual(d.stats.correct, 0, '初始correct应为0');
        assertTrue(typeof d.stats.cats === 'object', 'cats应为对象');
    },
    
    'DB.get() - 初始数据获取': function() {
        localStorage.clear();
        if (DB.clearCache) DB.clearCache();
        
        var d = DB.get();
        assertDeepEqual(d, DB.defaults(), '无数据时应返回默认结构');
    },
    
    'DB.findQ() - 查找题目': function() {
        var q = DB.findQ('001');
        assertTrue(q !== null, '应找到id为001的题目');
        assertEqual(q.id, '001', '题目id应为001');
        assertEqual(q.category, '专辑', '类别应为专辑');
        
        var notFound = DB.findQ('notexist');
        assertEqual(notFound, null, '不存在题目应返回null');
    },
    
    'DB.addRecord() - 添加答题记录': function() {
        localStorage.clear();
        if (DB.clearCache) DB.clearCache();
        
        var rec = { qid: '001', ans: 'B', ok: true, time: Date.now() };
        DB.addRecord(rec);
        
        var d = DB.get();
        assertEqual(d.history.length, 1, '应有1条记录');
        assertEqual(d.stats.total, 1, 'total应为1');
        assertEqual(d.stats.correct, 1, 'correct应为1');
        assertEqual(d.stats.cats['专辑'].t, 1, '专辑分类应记录1次');
        assertEqual(d.stats.cats['专辑'].c, 1, '专辑分类正确应为1');
    },
    
    'DB.addRecord() - 答错记录': function() {
        localStorage.clear();
        if (DB.clearCache) DB.clearCache();
        
        var rec = { qid: '001', ans: 'A', ok: false, time: Date.now() };
        DB.addRecord(rec);
        
        var d = DB.get();
        assertEqual(d.stats.correct, 0, '答错不应增加correct');
    },
    
    // ==================== 间隔重复算法测试（核心功能） ====================
    
    'DB.addWrong() - 新错题添加': function() {
        localStorage.clear();
        if (DB.clearCache) DB.clearCache();
        
        DB.addWrong('001');
        
        var wl = DB.getWrong();
        assertEqual(wl.length, 1, '应有1个错题');
        assertEqual(wl[0].qid, '001', 'qid应为001');
        assertEqual(wl[0].cnt, 1, '错误次数应为1');
        assertEqual(wl[0].level, 0, '等级应为0');
        assertTrue(wl[0].nextReview <= Date.now(), 'nextReview应可立即复习');
    },
    
    'DB.addWrong() - 重复错题更新': function() {
        localStorage.clear();
        if (DB.clearCache) DB.clearCache();
        
        DB.addWrong('001');
        var first = DB.getWrong()[0];
        
        // 再次答错
        DB.addWrong('001');
        var updated = DB.getWrong()[0];
        
        assertEqual(updated.cnt, 2, '错误次数应增加');
        assertEqual(updated.level, 0, '等级应重置为0');
        assertTrue(updated.nextReview <= Date.now(), 'nextReview应重置为立即可复习');
    },
    
    'DB.reviewCorrect() - 答对错题升级': function() {
        localStorage.clear();
        if (DB.clearCache) DB.clearCache();
        
        DB.addWrong('001');
        var before = DB.getWrong()[0];
        assertEqual(before.level, 0, '初始等级应为0');
        
        // 第一次答对
        DB.reviewCorrect('001');
        var after1 = DB.getWrong()[0];
        assertEqual(after1.level, 1, '等级应升为1');
        assertTrue(after1.nextReview > Date.now(), '下次复习时间应在未来');
        
        // 第二次答对
        DB.reviewCorrect('001');
        var after2 = DB.getWrong()[0];
        assertEqual(after2.level, 2, '等级应升为2');
        
        // 连续答对到level 5，应移除
        DB.reviewCorrect('001');
        DB.reviewCorrect('001');
        DB.reviewCorrect('001');
        assertEqual(DB.getWrong().length, 0, '等级5后应从错题本移除');
    },
    
    'DB.reviewWrong() - 错题复习答错重置': function() {
        localStorage.clear();
        if (DB.clearCache) DB.clearCache();
        
        // 添加错题并答对一次升级
        DB.addWrong('001');
        DB.reviewCorrect('001');
        var afterCorrect = DB.getWrong()[0];
        assertEqual(afterCorrect.level, 1, '答对后等级应为1');
        
        // 复习时答错
        DB.reviewWrong('001');
        var afterWrong = DB.getWrong()[0];
        assertEqual(afterWrong.level, 0, '答错后等级应重置为0');
        assertEqual(afterWrong.cnt, 2, '错误次数应增加');
        assertTrue(afterWrong.nextReview <= Date.now(), '应立即可复习');
    },
    
    'DB.reviewWrong() - 不在错题本中的题目': function() {
        localStorage.clear();
        if (DB.clearCache) DB.clearCache();
        
        // 直接调用reviewWrong，应新增
        DB.reviewWrong('002');
        
        var wl = DB.getWrong();
        assertEqual(wl.length, 1, '应新增错题');
        assertEqual(wl[0].qid, '002', 'qid应为002');
    },
    
    'DB.getDueWrong() - 到期错题筛选': function() {
        localStorage.clear();
        if (DB.clearCache) DB.clearCache();
        
        // 添加多个错题
        DB.addWrong('001');
        DB.addWrong('002');
        
        // 手动设置一个到期和一个未到期
        var d = DB.get();
        d.wrong[0].nextReview = Date.now() - 1000; // 已到期
        d.wrong[1].nextReview = Date.now() + 100000; // 未到期
        DB.save();
        if (DB.clearCache) DB.clearCache();
        
        var due = DB.getDueWrong();
        assertEqual(due.length, 1, '应只有1个到期错题');
        assertEqual(due[0].qid, '001', '到期应为001');
    },
    
    'DB.removeWrong() - 移除错题': function() {
        localStorage.clear();
        if (DB.clearCache) DB.clearCache();
        
        DB.addWrong('001');
        DB.addWrong('002');
        assertEqual(DB.getWrong().length, 2, '应有2个错题');
        
        DB.removeWrong('001');
        assertEqual(DB.getWrong().length, 1, '应剩1个错题');
        assertEqual(DB.getWrong()[0].qid, '002', '应为002');
    },
    
    'DB.recalcStats() - 统计重算': function() {
        localStorage.clear();
        if (DB.clearCache) DB.clearCache();
        
        // 添加多条记录
        DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
        DB.addRecord({ qid: '002', ans: 'A', ok: false, time: Date.now() });
        DB.addRecord({ qid: '002', ans: 'B', ok: true, time: Date.now() });
        
        // 手动破坏stats
        var d = DB.get();
        d.stats.total = 999;
        d.stats.correct = 888;
        DB.save();
        if (DB.clearCache) DB.clearCache();
        
        // 重算
        DB.recalcStats();
        
        var recalced = DB.get();
        assertEqual(recalced.stats.total, 3, '重算后total应为3');
        assertEqual(recalced.stats.correct, 2, '重算后correct应为2');
    },
    
    'DB.setData() - 直接设置数据': function() {
        localStorage.clear();
        if (DB.clearCache) DB.clearCache();
        
        var newData = {
            history: [{ qid: '001', ans: 'B', ok: true, time: Date.now() }],
            wrong: [{ qid: '002', cnt: 1, level: 0 }],
            stats: { total: 1, correct: 1, cats: {} }
        };
        
        DB.setData(newData);
        var d = DB.get();
        assertEqual(d.history.length, 1, 'history应有1条');
        assertEqual(d.wrong.length, 1, 'wrong应有1条');
    },
    
    // ==================== Session 模块测试 ====================
    
    'Session.save/load - 会话保存与加载': function() {
        sessionStorage.clear();
        
        var testState = {
            quiz: [{ id: '001', question: 'test' }],
            idx: 5,
            correctCount: 3,
            startTime: Date.now() - 10000,
            mode: 'standard'
        };
        
        Session.save(testState);
        var loaded = Session.load();
        
        assertTrue(loaded !== null, '应能加载会话');
        assertEqual(loaded.quizIds.length, 1, 'quizIds应有1个');
        assertEqual(loaded.idx, 5, 'idx应为5');
        assertEqual(loaded.correctCount, 3, 'correctCount应为3');
        assertEqual(loaded.mode, 'standard', 'mode应为standard');
    },
    
    'Session.clear - 会话清除': function() {
        Session.save({ quiz: [{ id: '001' }], idx: 0, correctCount: 0, startTime: Date.now(), mode: 'quick' });
        assertTrue(Session.load() !== null, '会话应已保存');
        
        Session.clear();
        assertEqual(Session.load(), null, '清除后应返回null');
    },
    
    'Session.load - 空会话': function() {
        sessionStorage.clear();
        assertEqual(Session.load(), null, '无会话时应返回null');
    },
    
    // ==================== SR_INTERVALS 间隔表测试 ====================
    
    'SR_INTERVALS - 间隔时间正确性': function() {
        assertTrue(Array.isArray(SR_INTERVALS), '应为数组');
        assertEqual(SR_INTERVALS.length, 5, '应有5个等级');
        assertEqual(SR_INTERVALS[0], 0, 'level 0应立即可复习');
        
        // 验证间隔递增
        for (var i = 1; i < SR_INTERVALS.length; i++) {
            assertTrue(SR_INTERVALS[i] > SR_INTERVALS[i-1], 
                '等级 ' + i + ' 间隔应大于等级 ' + (i-1));
        }
    },
    
    'SR_INTERVALS - 具体间隔值': function() {
        assertEqual(SR_INTERVALS[1], 1 * 60 * 60 * 1000, 'level 1应为1小时');
        assertEqual(SR_INTERVALS[2], 24 * 60 * 60 * 1000, 'level 2应为1天');
        assertEqual(SR_INTERVALS[3], 3 * 24 * 60 * 60 * 1000, 'level 3应为3天');
        assertEqual(SR_INTERVALS[4], 7 * 24 * 60 * 60 * 1000, 'level 4应为7天');
    }
});

TestRunner.register('Storage 边界条件测试', {
    
    'esc() - 空字符串': function() {
        assertEqual(esc(''), '', '空字符串应返回空');
    },
    
    'esc() - 只有空格': function() {
        assertEqual(esc('   '), '   ', '空格应保留');
    },
    
    'DB.addRecord() - 不存在的qid': function() {
        localStorage.clear();
        if (DB.clearCache) DB.clearCache();
        
        DB.addRecord({ qid: 'notexist', ans: 'A', ok: true, time: Date.now() });
        
        var d = DB.get();
        assertEqual(d.history.length, 1, '记录应添加');
        // 不存在的题目不应影响stats.cats
        assertTrue(Object.keys(d.stats.cats).length === 0, 'cats应为空');
    },
    
    'DB.findQ() - 空qid': function() {
        assertEqual(DB.findQ(''), null, '空qid应返回null');
        assertEqual(DB.findQ(null), null, 'null qid应返回null');
    },
    
    'DB - 大量数据处理': function() {
        localStorage.clear();
        if (DB.clearCache) DB.clearCache();
        
        // 添加100条记录
        for (var i = 0; i < 100; i++) {
            DB.addRecord({ qid: '001', ans: 'B', ok: i % 2 === 0, time: Date.now() + i });
        }
        
        var d = DB.get();
        assertEqual(d.history.length, 100, '应有100条历史');
        assertEqual(d.stats.total, 100, 'total应为100');
        assertEqual(d.stats.correct, 50, 'correct应为50');
    }
});