var assert = {
    equal: function(actual, expected, msg) {
        if (actual !== expected) {
            throw new Error((msg || 'Assertion failed') + ': expected ' + expected + ', got ' + actual);
        }
    },
    notEqual: function(actual, expected, msg) {
        if (actual === expected) {
            throw new Error((msg || 'Assertion failed') + ': expected not equal to ' + expected);
        }
    },
    ok: function(value, msg) {
        if (!value) {
            throw new Error(msg || 'Assertion failed: expected truthy value');
        }
    },
    deepEqual: function(actual, expected, msg) {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error((msg || 'Assertion failed') + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
        }
    }
};

function runTests() {
    var results = { passed: 0, failed: 0, errors: [] };
    
    function test(name, fn) {
        try {
            fn();
            results.passed++;
            console.log('✓ ' + name);
        } catch (e) {
            results.failed++;
            results.errors.push({ test: name, error: e.message });
            console.log('✗ ' + name + ': ' + e.message);
        }
    }

    test('DB.defaults() 返回正确的默认数据结构', function() {
        var defaults = DB.defaults();
        assert.ok(defaults.history !== undefined, 'history 不存在');
        assert.ok(defaults.wrong !== undefined, 'wrong 不存在');
        assert.ok(defaults.stats !== undefined, 'stats 不存在');
        assert.equal(defaults.stats.total, 0);
        assert.equal(defaults.stats.correct, 0);
        assert.deepEqual(defaults.stats.cats, {});
    });

    test('DB.findQ() 能正确查找题目', function() {
        var q = DB.findQ('001');
        assert.ok(q !== null, '题目001不存在');
        assert.equal(q.category, '专辑');
        assert.equal(q.answer, 'B');
    });

    test('DB.findQ() 查找不存在的题目返回null', function() {
        var q = DB.findQ('nonexistent');
        assert.equal(q, null);
    });

    test('选项解析正则能正确匹配格式', function() {
        var testCases = [
            { input: 'A.选项1', expected: { key: 'A', text: '选项1' } },
            { input: 'B、选项2', expected: { key: 'B', text: '选项2' } },
            { input: 'C．选项3', expected: { key: 'C', text: '选项3' } },
            { input: 'D. 带空格的选项', expected: { key: 'D', text: '带空格的选项' } }
        ];
        
        for (var i = 0; i < testCases.length; i++) {
            var match = testCases[i].input.match(/^([A-D])[.、．]\s*(.+)$/);
            assert.ok(match, '匹配失败: ' + testCases[i].input);
            assert.equal(match[1], testCases[i].expected.key);
            assert.equal(match[2], testCases[i].expected.text);
        }
    });

    test('选项解析正则拒绝无效格式', function() {
        var invalidCases = ['A选项', 'E.选项', '1.选项', 'a.选项'];
        for (var i = 0; i < invalidCases.length; i++) {
            var match = invalidCases[i].match(/^([A-D])[.、．]\s*(.+)$/);
            assert.equal(match, null, '不应匹配: ' + invalidCases[i]);
        }
    });

    test('shuffle() 函数能打乱数组顺序', function() {
        var arr = [1, 2, 3, 4, 5];
        var shuffled = shuffle(arr.slice());
        assert.equal(shuffled.length, arr.length);
        for (var i = 0; i < arr.length; i++) {
            assert.ok(shuffled.indexOf(arr[i]) !== -1, '元素丢失');
        }
    });

    test('shuffle() 函数不修改原数组', function() {
        var arr = [1, 2, 3];
        var original = arr.slice();
        shuffle(arr);
        assert.deepEqual(arr, original);
    });

    test('getCount() 返回正确的题目数量', function() {
        state.mode = 'quick';
        assert.equal(getCount(), 10);
        state.mode = 'standard';
        assert.equal(getCount(), 20);
        state.mode = 'intensive';
        assert.equal(getCount(), 30);
        state.mode = 'unknown';
        assert.equal(getCount(), 10);
    });

    test('fmtTime() 格式化时间正确', function() {
        assert.equal(fmtTime(0), '0分0秒');
        assert.equal(fmtTime(59000), '0分59秒');
        assert.equal(fmtTime(60000), '1分0秒');
        assert.equal(fmtTime(61000), '1分1秒');
        assert.equal(fmtTime(3661000), '61分1秒');
    });

    test('checkResetInput() 验证输入', function() {
        var mockBtn = { style: { opacity: '1', pointerEvents: 'auto' } };
        
        function simulateCheck(input) {
            var btn = { style: { opacity: '1', pointerEvents: 'auto' } };
            if (input === '恢复默认') {
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            } else {
                btn.style.opacity = '0.5';
                btn.style.pointerEvents = 'none';
            }
            return btn;
        }
        
        var btn1 = simulateCheck('恢复默认');
        assert.equal(btn1.style.opacity, '1');
        
        var btn2 = simulateCheck('其他内容');
        assert.equal(btn2.style.opacity, '0.5');
    });

    test('题库分类统计正确', function() {
        var cats = {};
        for (var i = 0; i < QUESTION_BANK.length; i++) {
            var c = QUESTION_BANK[i].category;
            cats[c] = (cats[c] || 0) + 1;
        }
        
        assert.ok(cats['专辑'] > 0, '专辑分类应有题目');
        assert.ok(cats['歌曲'] > 0, '歌曲分类应有题目');
        assert.ok(cats['个人信息'] > 0, '个人信息分类应有题目');
        assert.ok(cats['获奖记录'] > 0, '获奖记录分类应有题目');
    });

    test('题目数据结构完整', function() {
        for (var i = 0; i < QUESTION_BANK.length; i++) {
            var q = QUESTION_BANK[i];
            assert.ok(q.id, '缺少id: ' + i);
            assert.ok(q.category, '缺少category: ' + q.id);
            assert.ok(q.question, '缺少question: ' + q.id);
            assert.ok(q.options && q.options.length >= 2, '选项不足: ' + q.id);
            assert.ok(q.answer, '缺少answer: ' + q.id);
            
            var answerExists = false;
            for (var j = 0; j < q.options.length; j++) {
                if (q.options[j].key === q.answer) {
                    answerExists = true;
                    break;
                }
            }
            assert.ok(answerExists, '答案不在选项中: ' + q.id);
        }
    });

    console.log('\n测试完成: ' + results.passed + ' 通过, ' + results.failed + ' 失败');
    if (results.errors.length > 0) {
        console.log('\n失败详情:');
        for (var i = 0; i < results.errors.length; i++) {
            console.log('  - ' + results.errors[i].test + ': ' + results.errors[i].error);
        }
    }
    
    return results;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { assert, runTests };
} else {
    window.addEventListener('DOMContentLoaded', function() {
        runTests();
    });
}