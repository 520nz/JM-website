var assert = {
    equal: function(a, b, msg) {
        if (a !== b) throw new Error((msg || '') + ' Expected ' + JSON.stringify(b) + ' but got ' + JSON.stringify(a));
    },
    notEqual: function(a, b, msg) {
        if (a === b) throw new Error((msg || '') + ' Expected not equal but got ' + JSON.stringify(a));
    },
    deepEqual: function(a, b, msg) {
        if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || '') + ' Expected ' + JSON.stringify(b) + ' but got ' + JSON.stringify(a));
    },
    truthy: function(a, msg) {
        if (!a) throw new Error((msg || '') + ' Expected truthy but got ' + JSON.stringify(a));
    },
    falsy: function(a, msg) {
        if (a) throw new Error((msg || '') + ' Expected falsy but got ' + JSON.stringify(a));
    },
    throws: function(fn, msg) {
        try {
            fn();
            throw new Error((msg || '') + ' Expected exception but none was thrown');
        } catch (e) {}
    }
};

var tests = [];

function test(name, fn) {
    tests.push({ name: name, fn: fn });
}

function runTests(moduleName) {
    var passed = 0;
    var failed = 0;
    console.log('\n=== Testing ' + moduleName + ' ===');
    for (var i = 0; i < tests.length; i++) {
        try {
            tests[i].fn();
            console.log('✓ ' + tests[i].name);
            passed++;
        } catch (e) {
            console.log('✗ ' + tests[i].name + ': ' + e.message);
            failed++;
        }
    }
    console.log('=== ' + passed + '/' + tests.length + ' passed (' + failed + ' failed) ===');
    tests = [];
    return failed === 0;
}

test('shuffle() returns array of same length', function() {
    var arr = [1, 2, 3, 4, 5];
    var shuffled = shuffle(arr);
    assert.equal(shuffled.length, arr.length);
});

test('shuffle() contains all original elements', function() {
    var arr = [1, 2, 3, 4, 5];
    var shuffled = shuffle(arr);
    for (var i = 0; i < arr.length; i++) {
        assert.equal(shuffled.indexOf(arr[i]) !== -1, true, 'Missing element: ' + arr[i]);
    }
});

test('shuffle() does not modify original array', function() {
    var arr = [1, 2, 3, 4, 5];
    var original = arr.slice();
    shuffle(arr);
    assert.deepEqual(arr, original);
});

test('getCount() returns correct count for quick mode', function() {
    state.mode = 'quick';
    assert.equal(getCount(), 10);
});

test('getCount() returns correct count for standard mode', function() {
    state.mode = 'standard';
    assert.equal(getCount(), 20);
});

test('getCount() returns correct count for intensive mode', function() {
    state.mode = 'intensive';
    assert.equal(getCount(), 30);
});

test('getCount() returns default 10 for unknown mode', function() {
    state.mode = 'unknown';
    assert.equal(getCount(), 10);
});

test('selectMode() updates state.mode', function() {
    selectMode('standard');
    assert.equal(state.mode, 'standard');
});

test('fmtTime() formats 0 milliseconds', function() {
    assert.equal(fmtTime(0), '0分0秒');
});

test('fmtTime() formats seconds', function() {
    assert.equal(fmtTime(5000), '0分5秒');
});

test('fmtTime() formats minutes', function() {
    assert.equal(fmtTime(65000), '1分5秒');
});

test('fmtTime() formats multiple minutes', function() {
    assert.equal(fmtTime(125000), '2分5秒');
});

test('VIEW_NAMES mapping is correct', function() {
    assert.equal(VIEW_NAMES.home, '首页');
    assert.equal(VIEW_NAMES.practice, '练习');
    assert.equal(VIEW_NAMES.wrongbook, '错题本');
    assert.equal(VIEW_NAMES.stats, '统计');
    assert.equal(VIEW_NAMES.admin, '管理');
});

runTests('quiz.js');