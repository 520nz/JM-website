var TestRunner = {
    passed: 0,
    failed: 0,
    currentSuite: '',
    
    suite: function(name) {
        this.currentSuite = name;
        console.log('\n=== ' + name + ' ===');
    },
    
    assert: function(condition, message) {
        if (condition) {
            this.passed++;
            console.log('✓ PASS:', message);
        } else {
            this.failed++;
            console.log('✗ FAIL:', message);
        }
    },
    
    assertEqual: function(actual, expected, message) {
        if (actual === expected) {
            this.passed++;
            console.log('✓ PASS:', message, '(', expected, ')');
        } else {
            this.failed++;
            console.log('✗ FAIL:', message, '| Expected:', expected, 'Actual:', actual);
        }
    },
    
    assertNotEqual: function(actual, expected, message) {
        if (actual !== expected) {
            this.passed++;
            console.log('✓ PASS:', message);
        } else {
            this.failed++;
            console.log('✗ FAIL:', message, '(values are equal:', actual, ')');
        }
    },
    
    assertDeepEqual: function(actual, expected, message) {
        if (JSON.stringify(actual) === JSON.stringify(expected)) {
            this.passed++;
            console.log('✓ PASS:', message);
        } else {
            this.failed++;
            console.log('✗ FAIL:', message, '\n  Expected:', JSON.stringify(expected), '\n  Actual:', JSON.stringify(actual));
        }
    },
    
    assertThrows: function(fn, message) {
        try {
            fn();
            this.failed++;
            console.log('✗ FAIL:', message, '(did not throw)');
        } catch (e) {
            this.passed++;
            console.log('✓ PASS:', message);
        }
    },
    
    assertType: function(value, type, message) {
        if (typeof value === type) {
            this.passed++;
            console.log('✓ PASS:', message);
        } else {
            this.failed++;
            console.log('✗ FAIL:', message, '| Expected type:', type, 'Actual:', typeof value);
        }
    },
    
    assertNull: function(value, message) {
        if (value === null) {
            this.passed++;
            console.log('✓ PASS:', message);
        } else {
            this.failed++;
            console.log('✗ FAIL:', message, '| Expected: null Actual:', value);
        }
    },
    
    assertNotNull: function(value, message) {
        if (value !== null) {
            this.passed++;
            console.log('✓ PASS:', message);
        } else {
            this.failed++;
            console.log('✗ FAIL:', message, '(value is null)');
        }
    },
    
    assertGreaterThan: function(actual, expected, message) {
        if (actual > expected) {
            this.passed++;
            console.log('✓ PASS:', message);
        } else {
            this.failed++;
            console.log('✗ FAIL:', message, '| Expected:', expected, '< Actual:', actual);
        }
    },
    
    assertArrayContains: function(arr, item, message) {
        if (arr.indexOf(item) !== -1) {
            this.passed++;
            console.log('✓ PASS:', message);
        } else {
            this.failed++;
            console.log('✗ FAIL:', message, '| Array:', arr, 'does not contain:', item);
        }
    },
    
    finish: function() {
        console.log('\n' + '='.repeat(50));
        console.log('TEST SUMMARY:');
        console.log('Passed:', this.passed);
        console.log('Failed:', this.failed);
        console.log('Total:', this.passed + this.failed);
        console.log('Success rate:', Math.round(this.passed / (this.passed + this.failed) * 100) + '%');
        
        var el = document.getElementById('testResult');
        if (el) {
            el.innerHTML = '<h2>测试结果</h2>' +
                '<div style="color:' + (this.failed === 0 ? '#10B981' : '#EF4444') + ';">' +
                '<strong>通过: ' + this.passed + '</strong> / <strong>失败: ' + this.failed + '</strong>' +
                '</div>' +
                '<div>成功率: ' + Math.round(this.passed / (this.passed + this.failed) * 100) + '%</div>';
        }
        
        return this.failed === 0;
    }
};