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

test('SR_INTERVALS has correct values', function() {
    assert.equal(SR_INTERVALS[0], 0);
    assert.equal(SR_INTERVALS[1], 1 * 60 * 60 * 1000);
    assert.equal(SR_INTERVALS[2], 1 * 24 * 60 * 60 * 1000);
    assert.equal(SR_INTERVALS[3], 3 * 24 * 60 * 60 * 1000);
    assert.equal(SR_INTERVALS[4], 7 * 24 * 60 * 60 * 1000);
});

test('checkResetInput() enables button when input matches', function() {
    var input = { value: '恢复默认' };
    var btn = { style: {} };
    var originalGetElementById = document.getElementById;
    document.getElementById = function(id) {
        if (id === 'resetConfirmInput') return input;
        if (id === 'resetConfirmBtn') return btn;
        return null;
    };
    checkResetInput();
    assert.equal(btn.style.opacity, '1');
    assert.equal(btn.style.pointerEvents, 'auto');
    document.getElementById = originalGetElementById;
});

test('checkResetInput() disables button when input does not match', function() {
    var input = { value: 'wrong' };
    var btn = { style: {} };
    var originalGetElementById = document.getElementById;
    document.getElementById = function(id) {
        if (id === 'resetConfirmInput') return input;
        if (id === 'resetConfirmBtn') return btn;
        return null;
    };
    checkResetInput();
    assert.equal(btn.style.opacity, '0.5');
    assert.equal(btn.style.pointerEvents, 'none');
    document.getElementById = originalGetElementById;
});

runTests('admin.js');