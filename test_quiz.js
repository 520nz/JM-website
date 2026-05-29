var assert = {
    equal: function(actual, expected, msg) {
        if (actual !== expected) {
            console.error('FAIL: ' + (msg || '') + ' Expected: ' + expected + ', Actual: ' + actual);
            return false;
        }
        console.log('PASS: ' + (msg || ''));
        return true;
    },
    ok: function(actual, msg) {
        if (!actual) {
            console.error('FAIL: ' + (msg || '') + ' Expected truthy, got: ' + actual);
            return false;
        }
        console.log('PASS: ' + (msg || ''));
        return true;
    },
    notOk: function(actual, msg) {
        if (actual) {
            console.error('FAIL: ' + (msg || '') + ' Expected falsy, got: ' + actual);
            return false;
        }
        console.log('PASS: ' + (msg || ''));
        return true;
    },
    deepEqual: function(actual, expected, msg) {
        var actualStr = JSON.stringify(actual);
        var expectedStr = JSON.stringify(expected);
        if (actualStr !== expectedStr) {
            console.error('FAIL: ' + (msg || '') + ' Expected: ' + expectedStr + ', Actual: ' + actualStr);
            return false;
        }
        console.log('PASS: ' + (msg || ''));
        return true;
    }
};

function runTests() {
    console.log('\n=== 开始测试 ===\n');
    
    var passed = 0;
    var failed = 0;
    
    function test(name, fn) {
        console.log('测试: ' + name);
        try {
            if (fn()) passed++;
            else failed++;
        } catch (e) {
            console.error('ERROR: ' + e.message);
            failed++;
        }
        console.log('');
    }

    test('DB.get - 返回默认数据结构', function() {
        localStorage.removeItem('jj_quiz_v2');
        var data = DB.get();
        return assert.ok(data.history !== undefined, 'history存在') &&
               assert.ok(data.wrong !== undefined, 'wrong存在') &&
               assert.ok(data.stats !== undefined, 'stats存在') &&
               assert.equal(data.stats.total, 0, 'total初始为0') &&
               assert.equal(data.stats.correct, 0, 'correct初始为0');
    });

    test('DB.addRecord - 添加答题记录', function() {
        localStorage.removeItem('jj_quiz_v2');
        DB.addRecord({qid: '001', ans: 'A', ok: true, time: Date.now()});
        var data = DB.get();
        return assert.equal(data.history.length, 1, 'history长度为1') &&
               assert.equal(data.stats.total, 1, 'total为1') &&
               assert.equal(data.stats.correct, 1, 'correct为1');
    });

    test('DB.addRecord - 答错题目统计', function() {
        localStorage.removeItem('jj_quiz_v2');
        DB.addRecord({qid: '001', ans: 'B', ok: false, time: Date.now()});
        var data = DB.get();
        return assert.equal(data.stats.total, 1, 'total为1') &&
               assert.equal(data.stats.correct, 0, 'correct为0');
    });

    test('DB.addWrong - 添加错题', function() {
        localStorage.removeItem('jj_quiz_v2');
        DB.addWrong('001');
        var data = DB.get();
        return assert.equal(data.wrong.length, 1, 'wrong长度为1') &&
               assert.equal(data.wrong[0].qid, '001', 'qid正确') &&
               assert.equal(data.wrong[0].cnt, 1, 'cnt初始为1');
    });

    test('DB.addWrong - 重复添加同一错题', function() {
        localStorage.removeItem('jj_quiz_v2');
        DB.addWrong('001');
        DB.addWrong('001');
        var data = DB.get();
        return assert.equal(data.wrong.length, 1, 'wrong长度仍为1') &&
               assert.equal(data.wrong[0].cnt, 2, 'cnt增加到2');
    });

    test('DB.removeWrong - 移除错题', function() {
        localStorage.removeItem('jj_quiz_v2');
        DB.addWrong('001');
        DB.addWrong('002');
        DB.removeWrong('001');
        var data = DB.get();
        return assert.equal(data.wrong.length, 1, 'wrong长度为1') &&
               assert.equal(data.wrong[0].qid, '002', '剩余正确的错题');
    });

    test('DB.findQ - 查找存在的题目', function() {
        var q = DB.findQ('001');
        return assert.ok(q !== null, '找到题目') &&
               assert.equal(q.id, '001', 'id正确') &&
               assert.equal(q.category, '专辑', 'category正确');
    });

    test('DB.findQ - 查找不存在的题目', function() {
        var q = DB.findQ('nonexistent');
        return assert.equal(q, null, '返回null');
    });

    test('shuffle - 数组随机打乱', function() {
        var arr = [1, 2, 3, 4, 5];
        var shuffled = shuffle(arr.slice());
        var sameOrder = true;
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] !== shuffled[i]) {
                sameOrder = false;
                break;
            }
        }
        return assert.ok(!sameOrder || arr.length <= 1, '数组被打乱') &&
               assert.equal(shuffled.length, arr.length, '长度不变');
    });

    test('分类统计 - 添加记录后分类统计更新', function() {
        localStorage.removeItem('jj_quiz_v2');
        DB.addRecord({qid: '001', ans: 'B', ok: true, time: Date.now()});
        DB.addRecord({qid: '002', ans: 'A', ok: false, time: Date.now()});
        var data = DB.get();
        return assert.ok(data.stats.cats['专辑'] !== undefined, '专辑分类存在') &&
               assert.equal(data.stats.cats['专辑'].t, 1, '专辑分类总数') &&
               assert.equal(data.stats.cats['专辑'].c, 1, '专辑分类正确数') &&
               assert.ok(data.stats.cats['歌曲'] !== undefined, '歌曲分类存在') &&
               assert.equal(data.stats.cats['歌曲'].t, 1, '歌曲分类总数') &&
               assert.equal(data.stats.cats['歌曲'].c, 0, '歌曲分类正确数');
    });

    test('答题状态重置 - 完成后状态清零', function() {
        state.quiz = [{id: '001', question: 'test', options: [{key: 'A', text: 'a'}], answer: 'A'}];
        state.idx = 1;
        state.correctCount = 1;
        switchView('practice');
        return assert.equal(state.quiz.length, 0, 'quiz清空') &&
               assert.equal(state.idx, 0, 'idx重置') &&
               assert.equal(state.correctCount, 0, 'correctCount重置');
    });

    console.log('\n=== 测试完成 ===');
    console.log('通过: ' + passed + ' / 失败: ' + failed);
    
    return { passed: passed, failed: failed };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { assert, runTests };
}