// ============================================================
// test-quiz.js - quiz.js 答题引擎测试
// 重点覆盖：随机打乱算法、工具函数
// ============================================================

// 复制 shuffle 函数到测试环境（因为它在 quiz.js 中定义）
function shuffleTest(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
}

// 复制 fmtTime 函数
function fmtTimeTest(ms) {
    var sec = Math.floor(ms / 1000);
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + '分' + s + '秒';
}

// 复制 getCount 函数
function getCountTest(mode) {
    var m = { quick: 10, standard: 20, intensive: 30 };
    return m[mode] || 10;
}

TestRunner.register('Quiz 工具函数测试', {
    
    // ==================== shuffle 随机打乱测试 ====================
    
    'shuffle() - 保持数组长度': function() {
        var arr = [1, 2, 3, 4, 5];
        var shuffled = shuffleTest(arr);
        assertEqual(shuffled.length, arr.length, '长度应相同');
    },
    
    'shuffle() - 不修改原数组': function() {
        var arr = [1, 2, 3, 4, 5];
        var original = arr.slice();
        var shuffled = shuffleTest(arr);
        assertDeepEqual(arr, original, '原数组不应被修改');
    },
    
    'shuffle() - 包含所有元素': function() {
        var arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        var shuffled = shuffleTest(arr);
        
        // 检查所有元素都在
        var sortedOriginal = arr.slice().sort();
        var sortedShuffled = shuffled.slice().sort();
        assertDeepEqual(sortedShuffled, sortedOriginal, '应包含所有原始元素');
    },
    
    'shuffle() - 随机性验证': function() {
        var arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        var results = [];
        
        // 多次打乱，至少有一次结果不同
        for (var i = 0; i < 10; i++) {
            results.push(shuffleTest(arr).join(','));
        }
        
        // 检查是否有变化
        var uniqueResults = results.filter(function(r, idx) {
            return results.indexOf(r) === idx;
        });
        
        assertTrue(uniqueResults.length > 1, '多次打乱应产生不同结果，验证随机性');
    },
    
    'shuffle() - 空数组': function() {
        var arr = [];
        var shuffled = shuffleTest(arr);
        assertEqual(shuffled.length, 0, '空数组应返回空数组');
    },
    
    'shuffle() - 单元素数组': function() {
        var arr = [1];
        var shuffled = shuffleTest(arr);
        assertDeepEqual(shuffled, [1], '单元素数组应不变');
    },
    
    'shuffle() - 两元素数组': function() {
        var arr = [1, 2];
        var shuffled = shuffleTest(arr);
        assertEqual(shuffled.length, 2, '长度应为2');
        assertTrue(shuffled.indexOf(1) >= 0, '应包含1');
        assertTrue(shuffled.indexOf(2) >= 0, '应包含2');
    },
    
    'shuffle() - 对象数组': function() {
        var arr = [{ id: 1 }, { id: 2 }, { id: 3 }];
        var shuffled = shuffleTest(arr);
        assertEqual(shuffled.length, 3, '长度应为3');
        
        // 检查所有对象都在
        var ids = shuffled.map(function(o) { return o.id; });
        assertDeepEqual(ids.sort(), [1, 2, 3], '应包含所有对象');
    },
    
    // ==================== fmtTime 时间格式化测试 ====================
    
    'fmtTime() - 0毫秒': function() {
        assertEqual(fmtTimeTest(0), '0分0秒', '0ms应显示0分0秒');
    },
    
    'fmtTime() - 秒数': function() {
        assertEqual(fmtTimeTest(5000), '0分5秒', '5秒');
        assertEqual(fmtTimeTest(30000), '0分30秒', '30秒');
        assertEqual(fmtTimeTest(59000), '0分59秒', '59秒');
    },
    
    'fmtTime() - 分钟': function() {
        assertEqual(fmtTimeTest(60000), '1分0秒', '1分钟');
        assertEqual(fmtTimeTest(90000), '1分30秒', '1分30秒');
        assertEqual(fmtTimeTest(120000), '2分0秒', '2分钟');
        assertEqual(fmtTimeTest(3661000), '61分1秒', '61分1秒');
    },
    
    'fmtTime() - 小时': function() {
        assertEqual(fmtTimeTest(3600000), '60分0秒', '1小时=60分');
        assertEqual(fmtTimeTest(7200000), '120分0秒', '2小时=120分');
    },
    
    'fmtTime() - 毫秒截断': function() {
        // 测试毫秒部分被正确截断
        assertEqual(fmtTimeTest(15500), '0分15秒', '15.5秒应截断为15秒');
        assertEqual(fmtTimeTest(61500), '1分1秒', '61.5秒=1分1.5秒，截断为1分1秒');
    },
    
    // ==================== getCount 模式题数测试 ====================
    
    'getCount() - 快速模式': function() {
        assertEqual(getCountTest('quick'), 10, 'quick模式应为10题');
    },
    
    'getCount() - 标准模式': function() {
        assertEqual(getCountTest('standard'), 20, 'standard模式应为20题');
    },
    
    'getCount() - 深度模式': function() {
        assertEqual(getCountTest('intensive'), 30, 'intensive模式应为30题');
    },
    
    'getCount() - 无效模式默认': function() {
        assertEqual(getCountTest('unknown'), 10, '无效模式应默认10题');
        assertEqual(getCountTest(''), 10, '空模式应默认10题');
        assertEqual(getCountTest(null), 10, 'null模式应默认10题');
    }
});

TestRunner.register('Quiz 边界条件测试', {
    
    'shuffle() - 大数组性能': function() {
        var arr = [];
        for (var i = 0; i < 1000; i++) arr.push(i);
        
        var start = Date.now();
        var shuffled = shuffleTest(arr);
        var elapsed = Date.now() - start;
        
        assertEqual(shuffled.length, 1000, '大数组长度应保持');
        assertTrue(elapsed < 100, '1000元素打乱应在100ms内完成');
    },
    
    'shuffle() - 重复元素': function() {
        var arr = [1, 1, 1, 2, 2, 2];
        var shuffled = shuffleTest(arr);
        
        // 应保留重复元素
        var count1 = shuffled.filter(function(n) { return n === 1; }).length;
        var count2 = shuffled.filter(function(n) { return n === 2; }).length;
        assertEqual(count1, 3, '应有3个1');
        assertEqual(count2, 3, '应有3个2');
    },
    
    'fmtTime() - 极大值': function() {
        // 测试极大值不会出错
        var result = fmtTimeTest(999999999999);
        assertTrue(typeof result === 'string', '应返回字符串');
        assertTrue(result.indexOf('分') >= 0, '应包含"分"');
        assertTrue(result.indexOf('秒') >= 0, '应包含"秒"');
    }
});

// ==================== 答题逻辑模拟测试 ====================

TestRunner.register('Quiz 答题逻辑测试', {
    
    '答题正确性判断 - 匹配答案': function() {
        // 模拟答题判断逻辑
        var q = { id: '001', answer: 'B' };
        var selectedKey = 'B';
        var ok = (selectedKey === q.answer);
        
        assertTrue(ok, '选择正确答案应返回true');
    },
    
    '答题正确性判断 - 不匹配答案': function() {
        var q = { id: '001', answer: 'B' };
        var selectedKey = 'A';
        var ok = (selectedKey === q.answer);
        
        assertFalse(ok, '选择错误答案应返回false');
    },
    
    '题目数据完整性检查': function() {
        // 验证题目结构完整性
        var q = QUESTION_BANK[0];
        
        assertTrue(q.id != null, '应有id');
        assertTrue(q.category != null, '应有category');
        assertTrue(q.question != null, '应有question');
        assertTrue(Array.isArray(q.options), 'options应为数组');
        assertTrue(q.options.length >= 2, '应有至少2个选项');
        assertTrue(q.answer != null, '应有answer');
        assertTrue(q.explanation != null, '应有explanation');
        
        // 验证选项结构
        for (var i = 0; i < q.options.length; i++) {
            assertTrue(q.options[i].key != null, '选项应有key');
            assertTrue(q.options[i].text != null, '选项应有text');
        }
    },
    
    '题库总数验证': function() {
        assertTrue(QUESTION_BANK.length > 0, '题库应有题目');
        assertTrue(QUESTION_BANK.length >= 78, '题库应至少有78题（根据data.js）');
    },
    
    '答案有效性验证': function() {
        // 检查所有题目答案有效
        var validAnswers = ['A', 'B', 'C', 'D'];
        for (var i = 0; i < QUESTION_BANK.length; i++) {
            var q = QUESTION_BANK[i];
            assertTrue(validAnswers.indexOf(q.answer) >= 0, 
                '题目 ' + q.id + ' 答案 ' + q.answer + ' 应为A/B/C/D');
        }
    },
    
    '选项key有效性验证': function() {
        // 检查所有题目选项有效
        var validKeys = ['A', 'B', 'C', 'D'];
        for (var i = 0; i < QUESTION_BANK.length; i++) {
            var q = QUESTION_BANK[i];
            for (var j = 0; j < q.options.length; j++) {
                assertTrue(validKeys.indexOf(q.options[j].key) >= 0, 
                    '题目 ' + q.id + ' 选项key应为A/B/C/D');
            }
        }
    },
    
    '答案必须在选项中': function() {
        // 检查答案对应的选项存在
        for (var i = 0; i < QUESTION_BANK.length; i++) {
            var q = QUESTION_BANK[i];
            var found = false;
            for (var j = 0; j < q.options.length; j++) {
                if (q.options[j].key === q.answer) {
                    found = true;
                    break;
                }
            }
            assertTrue(found, '题目 ' + q.id + ' 答案 ' + q.answer + ' 必须在选项中存在');
        }
    },
    
    '题目ID唯一性验证': function() {
        // 检查所有题目ID唯一
        var ids = {};
        for (var i = 0; i < QUESTION_BANK.length; i++) {
            var id = QUESTION_BANK[i].id;
            assertTrue(ids[id] === undefined, 'ID ' + id + ' 应唯一');
            ids[id] = true;
        }
    }
});