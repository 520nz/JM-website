import { describe, it } from 'node:test';
import assert from 'node:assert';

function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i];
        a[i] = a[j];
        a[j] = t;
    }
    return a;
}

function fmtTime(ms) {
    var sec = Math.floor(ms / 1000);
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + '分' + s + '秒';
}

function getCount(mode) {
    var m = { quick: 10, standard: 20, intensive: 30 };
    return m[mode] || 10;
}

describe('工具函数', function() {
    describe('shuffle', function() {
        it('应该返回相同长度的数组', function() {
            var arr = [1, 2, 3, 4, 5];
            var result = shuffle(arr);
            assert.strictEqual(result.length, arr.length);
        });

        it('应该返回包含相同元素的数组', function() {
            var arr = ['a', 'b', 'c', 'd', 'e'];
            var result = shuffle(arr);
            var sortedOriginal = arr.slice().sort();
            var sortedResult = result.slice().sort();
            assert.deepStrictEqual(sortedOriginal, sortedResult);
        });

        it('应该不修改原始数组', function() {
            var arr = [1, 2, 3];
            var original = arr.slice();
            shuffle(arr);
            assert.deepStrictEqual(arr, original);
        });

        it('应该正确处理空数组', function() {
            var result = shuffle([]);
            assert.deepStrictEqual(result, []);
        });

        it('应该正确处理单元素数组', function() {
            var result = shuffle([42]);
            assert.deepStrictEqual(result, [42]);
        });

        it('应该正确处理两元素数组', function() {
            var result = shuffle([1, 2]);
            assert.strictEqual(result.length, 2);
            assert.ok(result.indexOf(1) !== -1 && result.indexOf(2) !== -1);
        });

        it('多次调用应该产生不同顺序（概率性测试）', function() {
            var arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            var results = [];
            for (var i = 0; i < 10; i++) {
                results.push(shuffle(arr).join(','));
            }
            var unique = [...new Set(results)];
            assert.ok(unique.length > 1, '多次调用应该产生不同顺序');
        });
    });

    describe('fmtTime', function() {
        it('应该正确格式化0毫秒', function() {
            assert.strictEqual(fmtTime(0), '0分0秒');
        });

        it('应该正确格式化少于1分钟的时间', function() {
            assert.strictEqual(fmtTime(5000), '0分5秒');
            assert.strictEqual(fmtTime(30000), '0分30秒');
            assert.strictEqual(fmtTime(59000), '0分59秒');
        });

        it('应该正确格式化1分钟', function() {
            assert.strictEqual(fmtTime(60000), '1分0秒');
        });

        it('应该正确格式化1分钟以上的时间', function() {
            assert.strictEqual(fmtTime(90000), '1分30秒');
            assert.strictEqual(fmtTime(125000), '2分5秒');
            assert.strictEqual(fmtTime(3665000), '61分5秒');
        });

        it('应该正确格式化负数（边界情况）', function() {
            assert.strictEqual(fmtTime(-5000), '-1分-5秒');
        });

        it('应该正确格式化小数毫秒', function() {
            assert.strictEqual(fmtTime(5555.5), '0分5秒');
        });
    });

    describe('getCount', function() {
        it('应该返回quick模式的题目数量', function() {
            assert.strictEqual(getCount('quick'), 10);
        });

        it('应该返回standard模式的题目数量', function() {
            assert.strictEqual(getCount('standard'), 20);
        });

        it('应该返回intensive模式的题目数量', function() {
            assert.strictEqual(getCount('intensive'), 30);
        });

        it('应该返回默认值当模式不存在', function() {
            assert.strictEqual(getCount('unknown'), 10);
            assert.strictEqual(getCount(null), 10);
            assert.strictEqual(getCount(undefined), 10);
        });
    });
});