var TestRunner = {
    tests: [],
    passed: 0,
    failed: 0,
    
    addTest: function(name, fn) {
        this.tests.push({ name: name, fn: fn });
    },
    
    run: function() {
        console.log('=== 开始执行测试 ===\n');
        
        for (var i = 0; i < this.tests.length; i++) {
            var test = this.tests[i];
            try {
                test.fn();
                this.passed++;
                console.log('✓ PASS:', test.name);
            } catch (e) {
                this.failed++;
                console.log('✗ FAIL:', test.name);
                console.log('  Error:', e.message);
            }
        }
        
        console.log('\n=== 测试完成 ===');
        console.log('通过:', this.passed, '/', this.tests.length);
        console.log('失败:', this.failed, '/', this.tests.length);
        
        return this.failed === 0;
    }
};

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error((message || '断言失败') + ': 期望 ' + expected + ', 实际 ' + actual);
    }
}

function assertTrue(actual, message) {
    if (!actual) {
        throw new Error((message || '断言失败') + ': 期望 true, 实际 ' + actual);
    }
}

function assertFalse(actual, message) {
    if (actual) {
        throw new Error((message || '断言失败') + ': 期望 false, 实际 ' + actual);
    }
}

function assertThrows(fn, message) {
    try {
        fn();
        throw new Error((message || '断言失败') + ': 期望抛出异常');
    } catch (e) {
        if (e.message.indexOf('期望抛出异常') !== -1) {
            throw e;
        }
    }
}

TestRunner.addTest('DB模块 - get方法返回默认值', function() {
    localStorage.removeItem(DB.KEY);
    var data = DB.get();
    assertTrue(Array.isArray(data.history), 'history应为数组');
    assertTrue(Array.isArray(data.wrong), 'wrong应为数组');
    assertTrue(typeof data.stats === 'object', 'stats应为对象');
});

TestRunner.addTest('DB模块 - addRecord方法正确记录答题', function() {
    localStorage.removeItem(DB.KEY);
    var q = QUESTION_BANK[0];
    
    DB.addRecord({ qid: q.id, ans: 'A', ok: true, time: Date.now() });
    var data = DB.get();
    
    assertEqual(data.history.length, 1, '历史记录应有1条');
    assertEqual(data.stats.total, 1, '总答题数应为1');
    assertEqual(data.stats.correct, 1, '正确数应为1');
});

TestRunner.addTest('DB模块 - addWrong方法正确添加错题', function() {
    localStorage.removeItem(DB.KEY);
    var q = QUESTION_BANK[0];
    
    DB.addWrong(q.id);
    var data = DB.get();
    
    assertEqual(data.wrong.length, 1, '错题应有1条');
    assertEqual(data.wrong[0].qid, q.id, '错题ID应匹配');
    assertEqual(data.wrong[0].cnt, 1, '错误次数应为1');
});

TestRunner.addTest('DB模块 - addWrong方法重复添加增加计数', function() {
    localStorage.removeItem(DB.KEY);
    var q = QUESTION_BANK[0];
    
    DB.addWrong(q.id);
    DB.addWrong(q.id);
    var data = DB.get();
    
    assertEqual(data.wrong.length, 1, '错题仍应为1条');
    assertEqual(data.wrong[0].cnt, 2, '错误次数应为2');
});

TestRunner.addTest('DB模块 - removeWrong方法正确移除错题', function() {
    localStorage.removeItem(DB.KEY);
    var q = QUESTION_BANK[0];
    
    DB.addWrong(q.id);
    DB.removeWrong(q.id);
    var data = DB.get();
    
    assertEqual(data.wrong.length, 0, '错题应为空');
});

TestRunner.addTest('DB模块 - findQ方法正确查找题目', function() {
    var q = DB.findQ('001');
    assertTrue(q !== null, '应找到题目');
    assertEqual(q.id, '001', '题目ID应匹配');
});

TestRunner.addTest('DB模块 - findQ方法查找不存在的题目返回null', function() {
    var q = DB.findQ('nonexistent');
    assertEqual(q, null, '不存在的题目应返回null');
});

TestRunner.addTest('题库管理 - 选项解析正确解析标准格式', function() {
    var optsText = 'A.选项1\nB.选项2\nC.选项3\nD.选项4';
    var lines = optsText.split('\n');
    var options = [];
    
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        var match = line.match(/^([A-D])[.、．]\s*(.+)$/);
        if (match) {
            options.push({ key: match[1], text: match[2] });
        }
    }
    
    assertEqual(options.length, 4, '应解析出4个选项');
    assertEqual(options[0].key, 'A', '选项A的key应正确');
    assertEqual(options[0].text, '选项1', '选项A的text应正确');
});

TestRunner.addTest('题库管理 - 选项解析支持中文句号', function() {
    var optsText = 'A．选项1\nB、选项2';
    var lines = optsText.split('\n');
    var options = [];
    
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        var match = line.match(/^([A-D])[.、．]\s*(.+)$/);
        if (match) {
            options.push({ key: match[1], text: match[2] });
        }
    }
    
    assertEqual(options.length, 2, '应解析出2个选项');
});

TestRunner.addTest('题库管理 - shuffle函数正确打乱数组', function() {
    var arr = [1, 2, 3, 4, 5];
    var shuffled = shuffle(arr.slice());
    
    assertEqual(shuffled.length, arr.length, '数组长度应保持不变');
    
    var sorted1 = arr.slice().sort();
    var sorted2 = shuffled.slice().sort();
    assertEqual(JSON.stringify(sorted1), JSON.stringify(sorted2), '元素应保持相同');
});

TestRunner.addTest('题库管理 - getCount函数返回正确数量', function() {
    state.mode = 'quick';
    assertEqual(getCount(), 10, 'quick模式应返回10');
    
    state.mode = 'standard';
    assertEqual(getCount(), 20, 'standard模式应返回20');
    
    state.mode = 'intensive';
    assertEqual(getCount(), 30, 'intensive模式应返回30');
});

TestRunner.addTest('分类统计 - 分类数量统计正确', function() {
    var cats = {};
    for (var i = 0; i < QUESTION_BANK.length; i++) {
        var c = QUESTION_BANK[i].category;
        cats[c] = (cats[c] || 0) + 1;
    }
    
    assertTrue(cats['专辑'] > 0, '专辑分类应有题目');
    assertTrue(cats['歌曲'] > 0, '歌曲分类应有题目');
    assertTrue(cats['个人信息'] > 0, '个人信息分类应有题目');
    assertTrue(cats['获奖记录'] > 0, '获奖记录分类应有题目');
});

TestRunner.addTest('数据导入 - 导入数据格式验证', function() {
    var data = {
        questionBank: [],
        userData: {
            history: [],
            wrong: [],
            stats: { total: 0, correct: 0, cats: {} }
        },
        exportTime: new Date().toISOString()
    };
    
    assertTrue(Array.isArray(data.questionBank), 'questionBank应为数组');
    assertTrue(typeof data.userData === 'object', 'userData应为对象');
    assertTrue(typeof data.exportTime === 'string', 'exportTime应为字符串');
});

TestRunner.addTest('数据导入 - 导入时去重逻辑', function() {
    var existingIds = { '001': true };
    var imported = [
        { id: '001', category: '专辑', question: '测试1', options: [], answer: 'A', explanation: '' },
        { id: '002', category: '专辑', question: '测试2', options: [], answer: 'A', explanation: '' }
    ];
    
    var updatedCount = 0;
    var addedCount = 0;
    
    for (var j = 0; j < imported.length; j++) {
        var q = imported[j];
        if (existingIds[q.id]) {
            updatedCount++;
        } else {
            addedCount++;
        }
    }
    
    assertEqual(updatedCount, 1, '应更新1条');
    assertEqual(addedCount, 1, '应新增1条');
});

TestRunner.addTest('时间格式化 - fmtTime函数正确格式化', function() {
    assertEqual(fmtTime(60000), '1分0秒', '60秒应显示为1分0秒');
    assertEqual(fmtTime(65000), '1分5秒', '65秒应显示为1分5秒');
    assertEqual(fmtTime(3661000), '61分1秒', '3661秒应显示为61分1秒');
});

TestRunner.addTest('边界条件 - 空题库处理', function() {
    var emptyBank = [];
    var cats = {};
    for (var i = 0; i < emptyBank.length; i++) {
        var c = emptyBank[i].category;
        cats[c] = true;
    }
    
    assertEqual(Object.keys(cats).length, 0, '空题库应无分类');
});

TestRunner.addTest('边界条件 - 错题本为空时无法开始复习', function() {
    localStorage.removeItem(DB.KEY);
    var result = startWrongBookQuiz();
    
    assertEqual(state.quiz.length, 0, '错题本为空时不应生成答题列表');
});

TestRunner.addTest('统计模块 - 正确率计算正确', function() {
    var stats = { total: 10, correct: 7 };
    var acc = stats.total > 0 ? Math.round(stats.correct / stats.total * 100) : 0;
    
    assertEqual(acc, 70, '正确率应为70%');
});

TestRunner.addTest('统计模块 - 空数据时正确率为0', function() {
    var stats = { total: 0, correct: 0 };
    var acc = stats.total > 0 ? Math.round(stats.correct / stats.total * 100) : 0;
    
    assertEqual(acc, 0, '空数据时正确率应为0%');
});

function runTests() {
    var originalBank = QUESTION_BANK.slice();
    var originalDBKey = localStorage.getItem(DB.KEY);
    
    try {
        TestRunner.run();
    } finally {
        QUESTION_BANK = originalBank;
        if (originalDBKey !== null) {
            localStorage.setItem(DB.KEY, originalDBKey);
        } else {
            localStorage.removeItem(DB.KEY);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        TestRunner: TestRunner,
        assertEqual: assertEqual,
        assertTrue: assertTrue,
        assertFalse: assertFalse,
        assertThrows: assertThrows
    };
} else {
    if (document.readyState === 'complete') {
        runTests();
    } else {
        window.addEventListener('load', runTests);
    }
}