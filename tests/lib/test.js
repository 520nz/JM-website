var Test = {
    _tests: [],
    _currentSuite: '',
    _passed: 0,
    _failed: 0,
    _startTime: 0,

    suite: function(name) {
        this._currentSuite = name;
        console.log('\n=== ' + name + ' ===');
    },

    test: function(name, fn) {
        this._tests.push({ suite: this._currentSuite, name: name, fn: fn });
    },

    equal: function(actual, expected, msg) {
        if (actual === expected) {
            this._passed++;
            console.log('✓ ' + (msg || ''));
        } else {
            this._failed++;
            console.log('✗ ' + (msg || '') + '\n  Expected: ' + this._format(expected) + '\n  Actual:   ' + this._format(actual));
        }
    },

    notEqual: function(actual, expected, msg) {
        if (actual !== expected) {
            this._passed++;
            console.log('✓ ' + (msg || ''));
        } else {
            this._failed++;
            console.log('✗ ' + (msg || '') + '\n  Expected not to be: ' + this._format(expected));
        }
    },

    deepEqual: function(actual, expected, msg) {
        if (this._isDeepEqual(actual, expected)) {
            this._passed++;
            console.log('✓ ' + (msg || ''));
        } else {
            this._failed++;
            console.log('✗ ' + (msg || '') + '\n  Expected: ' + JSON.stringify(expected) + '\n  Actual:   ' + JSON.stringify(actual));
        }
    },

    ok: function(actual, msg) {
        if (!!actual) {
            this._passed++;
            console.log('✓ ' + (msg || ''));
        } else {
            this._failed++;
            console.log('✗ ' + (msg || '') + '\n  Expected truthy, got: ' + this._format(actual));
        }
    },

    throws: function(fn, msg) {
        try {
            fn();
            this._failed++;
            console.log('✗ ' + (msg || '') + '\n  Expected exception, none thrown');
        } catch (e) {
            this._passed++;
            console.log('✓ ' + (msg || ''));
        }
    },

    _isDeepEqual: function(a, b) {
        if (a === b) return true;
        if (typeof a !== typeof b) return false;
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) return false;
            for (var i = 0; i < a.length; i++) {
                if (!this._isDeepEqual(a[i], b[i])) return false;
            }
            return true;
        }
        if (typeof a === 'object' && a !== null && b !== null) {
            var keysA = Object.keys(a);
            var keysB = Object.keys(b);
            if (keysA.length !== keysB.length) return false;
            for (var k = 0; k < keysA.length; k++) {
                if (!keysB.includes(keysA[k])) return false;
                if (!this._isDeepEqual(a[keysA[k]], b[keysA[k]])) return false;
            }
            return true;
        }
        return false;
    },

    _format: function(val) {
        if (typeof val === 'string') return '"' + val + '"';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
    },

    run: function() {
        this._passed = 0;
        this._failed = 0;
        this._startTime = Date.now();

        console.log('Running ' + this._tests.length + ' tests...\n');

        for (var i = 0; i < this._tests.length; i++) {
            var t = this._tests[i];
            try {
                console.log('  Test: ' + t.name);
                t.fn();
            } catch (e) {
                this._failed++;
                console.log('  ✗ ERROR: ' + e.message + '\n' + e.stack);
            }
        }

        var elapsed = Date.now() - this._startTime;
        console.log('\n=== RESULTS ===');
        console.log('Passed: ' + this._passed);
        console.log('Failed: ' + this._failed);
        console.log('Total:  ' + (this._passed + this._failed));
        console.log('Time:   ' + elapsed + 'ms');

        if (typeof window !== 'undefined') {
            var resultEl = document.getElementById('testResult');
            if (resultEl) {
                var color = this._failed === 0 ? '#10B981' : '#EF4444';
                resultEl.innerHTML =
                    '<div style="color:' + color + ';font-weight:bold;font-size:18px;">' +
                    (this._failed === 0 ? '✓ All tests passed!' : '✗ ' + this._failed + ' test(s) failed') +
                    '</div>' +
                    '<div style="margin-top:8px;color:#666;">' +
                    this._passed + ' passed, ' + this._failed + ' failed, ' +
                    (this._passed + this._failed) + ' total (' + elapsed + 'ms)' +
                    '</div>';
            }
        }

        return this._failed === 0;
    }
};

var assert = {
    equal: function(a, b, m) { Test.equal(a, b, m); },
    notEqual: function(a, b, m) { Test.notEqual(a, b, m); },
    deepEqual: function(a, b, m) { Test.deepEqual(a, b, m); },
    ok: function(a, m) { Test.ok(a, m); },
    throws: function(f, m) { Test.throws(f, m); }
};