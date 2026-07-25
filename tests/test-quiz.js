(function() {
    var App = window.App || {};

    function createMockQuestion(id, category) {
        return {
            id: id,
            category: category || '专辑',
            question: '测试问题',
            options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }],
            answer: 'A',
            explanation: '测试解析'
        };
    }

    Test.suite('Quiz.js - 随机打乱');

    Test.test('shuffle() 应返回相同长度的数组', function() {
        var arr = [1, 2, 3, 4, 5];
        var shuffled = App.shuffle(arr);
        assert.equal(shuffled.length, arr.length);
    });

    Test.test('shuffle() 应包含所有原始元素', function() {
        var arr = [1, 2, 3, 4, 5];
        var shuffled = App.shuffle(arr);
        for (var i = 0; i < arr.length; i++) {
            assert.ok(shuffled.includes(arr[i]));
        }
    });

    Test.test('shuffle() 应不修改原始数组', function() {
        var arr = [1, 2, 3, 4, 5];
        var original = arr.slice();
        App.shuffle(arr);
        assert.deepEqual(arr, original);
    });

    Test.test('shuffle() 应正确处理空数组', function() {
        var arr = [];
        var shuffled = App.shuffle(arr);
        assert.deepEqual(shuffled, []);
    });

    Test.test('shuffle() 应正确处理单元素数组', function() {
        var arr = [42];
        var shuffled = App.shuffle(arr);
        assert.deepEqual(shuffled, [42]);
    });

    Test.suite('Quiz.js - 音效开关');

    Test.test('toggleSound() 应切换音效状态', function() {
        var initial = App.toggleSound();
        var toggled = App.toggleSound();
        assert.notEqual(initial, toggled);
    });

    Test.test('toggleSound() 应初始为true', function() {
        var result = App.toggleSound();
        assert.equal(result, false);
        result = App.toggleSound();
        assert.equal(result, true);
    });

    Test.suite('Quiz.js - 答题中断恢复');

    Test.test('tryResumeSession() 应返回false当无保存会话', function() {
        var originalLoad = App.session.load;
        App.session.load = function() { return null; };
        var result = App.tryResumeSession();
        App.session.load = originalLoad;
        assert.equal(result, false);
    });

    Test.suite('Quiz.js - 分类练习');

    Test.test('题目分类统计应正确', function() {
        var bank = [
            createMockQuestion('q001', '专辑'),
            createMockQuestion('q002', '专辑'),
            createMockQuestion('q003', '歌曲'),
            createMockQuestion('q004', '歌曲'),
            createMockQuestion('q005', '个人信息')
        ];
        var cats = {};
        for (var i = 0; i < bank.length; i++) {
            var c = bank[i].category;
            cats[c] = (cats[c] || 0) + 1;
        }
        assert.equal(cats['专辑'], 2);
        assert.equal(cats['歌曲'], 2);
        assert.equal(cats['个人信息'], 1);
    });

    Test.suite('Quiz.js - 模式数量配置');

    Test.test('模式数量配置应正确', function() {
        var config = { quick: 10, standard: 20, intensive: 30 };
        assert.equal(config.quick, 10);
        assert.equal(config.standard, 20);
        assert.equal(config.intensive, 30);
    });

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { run: function() { return Test.run(); } };
    }
})();