// ============================================================
// 轻量级测试运行器 - 零依赖
// ============================================================
var TestRunner = (function() {
    var _suites = [];
    var _currentSuite = null;
    var _passed = 0;
    var _failed = 0;
    var _errors = [];

    function suite(name, fn) {
        _currentSuite = { name: name, tests: [] };
        _suites.push(_currentSuite);
        fn();
        _currentSuite = null;
    }

    function test(name, fn) {
        if (!_currentSuite) return;
        _currentSuite.tests.push({ name: name, fn: fn });
    }

    function assert(condition, msg) {
        if (!condition) {
            throw new Error('断言失败: ' + (msg || '') + '\n    在 ' + (new Error()).stack.split('\n')[2].trim());
        }
    }

    function assertEqual(actual, expected, msg) {
        if (actual !== expected) {
            throw new Error(
                '断言失败: ' + (msg || '') +
                '\n    预期: ' + JSON.stringify(expected) +
                '\n    实际: ' + JSON.stringify(actual)
            );
        }
    }

    function assertDeepEqual(actual, expected, msg) {
        var a = JSON.stringify(actual);
        var b = JSON.stringify(expected);
        if (a !== b) {
            throw new Error(
                '断言失败: ' + (msg || '') +
                '\n    预期: ' + b +
                '\n    实际: ' + a
            );
        }
    }

    function assertThrows(fn, expectedMsg) {
        try {
            fn();
            throw new Error('预期会抛出异常，但没有抛出');
        } catch (e) {
            if (expectedMsg && e.message.indexOf(expectedMsg) === -1) {
                throw new Error(
                    '断言失败: 预期异常消息包含 "' + expectedMsg + '"，实际为: "' + e.message + '"'
                );
            }
        }
    }

    function run() {
        var results = [];
        for (var s = 0; s < _suites.length; s++) {
            var suite = _suites[s];
            var suiteResult = { name: suite.name, passed: 0, failed: 0, tests: [] };
            for (var t = 0; t < suite.tests.length; t++) {
                var testCase = suite.tests[t];
                try {
                    testCase.fn();
                    suiteResult.passed++;
                    _passed++;
                    suiteResult.tests.push({ name: testCase.name, passed: true });
                } catch (e) {
                    suiteResult.failed++;
                    _failed++;
                    suiteResult.tests.push({
                        name: testCase.name,
                        passed: false,
                        error: e.message
                    });
                    _errors.push({ suite: suite.name, test: testCase.name, error: e.message });
                }
            }
            results.push(suiteResult);
        }
        return { results: results, passed: _passed, failed: _failed, errors: _errors };
    }

    function reset() {
        _suites = [];
        _currentSuite = null;
        _passed = 0;
        _failed = 0;
        _errors = [];
    }

    return {
        suite: suite,
        test: test,
        assert: assert,
        assertEqual: assertEqual,
        assertDeepEqual: assertDeepEqual,
        assertThrows: assertThrows,
        run: run,
        reset: reset
    };
})();

window.TestRunner = TestRunner;
