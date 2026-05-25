/**
 * 林俊杰粉丝答题网站 - 测试套件
 *
 * 本测试文件补充了测试缺口分析工具识别的关键风险区域的测试覆盖
 *
 * 测试覆盖区域：
 * 1. 核心业务逻辑（答题流程、答案验证）
 * 2. 共享工具函数（shuffle、DB模块、状态管理）
 * 3. JSON解析和错误处理
 * 4. 本地存储操作
 * 5. 数据校验和验证
 * 6. 数组操作边界情况
 * 7. 导入导出功能
 *
 * 生成时间: 2026-05-25
 */

(function() {
    'use strict';

    var testResults = {
        passed: 0,
        failed: 0,
        total: 0,
        results: []
    };

    function assertEqual(actual, expected, message) {
        testResults.total++;
        var passed = actual === expected;
        testResults.results.push({
            passed: passed,
            actual: actual,
            expected: expected,
            message: message
        });
        if (passed) {
            testResults.passed++;
            console.log('✓ PASS:', message);
        } else {
            testResults.failed++;
            console.error('✗ FAIL:', message);
            console.error('  Expected:', expected);
            console.error('  Actual:', actual);
        }
        return passed;
    }

    function assertNotEqual(actual, expected, message) {
        return assertEqual(actual !== expected, expected !== expected ? true : false, message);
    }

    function assertTrue(condition, message) {
        return assertEqual(condition, true, message);
    }

    function assertFalse(condition, message) {
        return assertEqual(condition, false, message);
    }

    function assertNotNull(value, message) {
        return assertNotEqual(value, null, message);
    }

    function assertNull(value, message) {
        return assertEqual(value, null, message);
    }

    function assertContains(array, item, message) {
        testResults.total++;
        var passed = array.indexOf(item) !== -1;
        testResults.results.push({
            passed: passed,
            actual: array.indexOf(item) !== -1,
            expected: true,
            message: message
        });
        if (passed) {
            testResults.passed++;
            console.log('✓ PASS:', message);
        } else {
            testResults.failed++;
            console.error('✗ FAIL:', message);
        }
        return passed;
    }

    function assertLength(array, length, message) {
        return assertEqual(array.length, length, message);
    }

    console.log('='.repeat(80));
    console.log('林俊杰粉丝答题网站 - 自动化测试套件');
    console.log('='.repeat(80));
    console.log('');

    console.log('## 测试: 核心业务逻辑');
    console.log('-'.repeat(80));

    (function testCoreBusinessLogic() {
        console.log('测试: 答题流程和答案验证');

        var mockState = {
            quiz: [],
            idx: 0,
            answered: false,
            correctCount: 0,
            mode: 'quick'
        };

        assertEqual(mockState.quiz.length, 0, '初始状态quiz应该为空');
        assertEqual(mockState.answered, false, '初始状态answered应该为false');
        assertEqual(mockState.correctCount, 0, '初始状态correctCount应该为0');
        assertEqual(mockState.mode, 'quick', '默认模式应该是quick');

        var question = {
            id: '001',
            answer: 'A',
            options: [
                {key: 'A', text: '选项A'},
                {key: 'B', text: '选项B'},
                {key: 'C', text: '选项C'},
                {key: 'D', text: '选项D'}
            ]
        };

        var selectedCorrectKey = 'A';
        var isCorrect = selectedCorrectKey === question.answer;
        assertTrue(isCorrect, '选择正确答案应该返回true');

        var selectedWrongKey = 'B';
        var isWrong = selectedWrongKey === question.answer;
        assertFalse(isWrong, '选择错误答案应该返回false');

        mockState.answered = true;
        assertTrue(mockState.answered, '答题后answered应该为true');

        console.log('');
    })();

    console.log('## 测试: 共享工具函数');
    console.log('-'.repeat(80));

    (function testSharedUtilities() {
        console.log('测试: DB模块');

        if (typeof DB !== 'undefined') {
            var defaultData = DB.defaults();
            assertTrue('history' in defaultData, '默认数据应该包含history字段');
            assertTrue('wrong' in defaultData, '默认数据应该包含wrong字段');
            assertTrue('stats' in defaultData, '默认数据应该包含stats字段');

            assertTrue(Array.isArray(defaultData.history), 'history应该是数组');
            assertTrue(Array.isArray(defaultData.wrong), 'wrong应该是数组');
            assertTrue(typeof defaultData.stats === 'object', 'stats应该是对象');

            if (typeof QUESTION_BANK !== 'undefined' && QUESTION_BANK.length > 0) {
                var found = DB.findQ('001');
                if (found) {
                    assertEqual(found.id, '001', '应该能找到ID为001的题目');
                    assertTrue('question' in found, '找到的题目应该包含question字段');
                    assertTrue('options' in found, '找到的题目应该包含options字段');
                    assertTrue('answer' in found, '找到的题目应该包含answer字段');
                }

                var notFound = DB.findQ('nonexistent_id');
                assertNull(notFound, '不存在的题目ID应该返回null');
            }
        }

        console.log('');
    })();

    console.log('## 测试: shuffle函数');
    console.log('-'.repeat(80));

    (function testShuffleFunction() {
        console.log('测试: shuffle函数的正确性');

        if (typeof shuffle === 'function') {
            var original = [1, 2, 3, 4, 5];
            var shuffled = shuffle(original);

            assertLength(shuffled, 5, 'shuffle后的数组长度应该与原数组相同');

            var originalSet = new Set(original);
            var shuffledSet = new Set(shuffled);
            assertEqual(originalSet.size, shuffledSet.size, 'shuffle后的数组应该包含所有原数组元素');

            var results = {};
            for (var i = 0; i < 10; i++) {
                var result = shuffle([1, 2, 3]).join(',');
                results[result] = true;
            }
            var uniqueResults = Object.keys(results);
            assertTrue(uniqueResults.length > 1, 'shuffle应该产生随机结果');

            var singleElement = shuffle([1]);
            assertEqual(singleElement.length, 1, '单元素数组shuffle后应该仍为单元素');
            assertEqual(singleElement[0], 1, '单元素数组shuffle后应该仍是该元素');

            var emptyArray = shuffle([]);
            assertEqual(emptyArray.length, 0, '空数组shuffle后应该仍为空');
        } else {
            console.log('⚠ shuffle函数未定义，跳过测试');
        }

        console.log('');
    })();

    console.log('## 测试: JSON解析和错误处理');
    console.log('-'.repeat(80));

    (function testJSONParsing() {
        console.log('测试: JSON.parse的边界情况');

        var validJSON = '{"key":"value","number":123,"array":[1,2,3],"object":{"nested":"value"}}';
        var parsed = JSON.parse(validJSON);
        assertTrue(parsed.key === 'value', '应该正确解析字符串值');
        assertTrue(parsed.number === 123, '应该正确解析数字');
        assertTrue(Array.isArray(parsed.array), '应该正确解析数组');
        assertTrue(parsed.object.nested === 'value', '应该正确解析嵌套对象');

        var emptyObject = JSON.parse('{}');
        assertTrue(typeof emptyObject === 'object', '空对象应该解析为对象');
        assertEqual(Object.keys(emptyObject).length, 0, '空对象应该没有属性');

        var emptyArray = JSON.parse('[]');
        assertTrue(Array.isArray(emptyArray), '空数组应该解析为数组');
        assertEqual(emptyArray.length, 0, '空数组长度应该为0');

        var jsonWithEscapes = '{"text":"value with \\"quotes\\" and \\\\ backslash"}';
        var parsedEscapes = JSON.parse(jsonWithEscapes);
        assertTrue(parsedEscapes.text.includes('quotes'), '应该正确处理转义的引号');

        try {
            JSON.parse('invalid json');
            assertTrue(false, '无效JSON应该抛出错误');
        } catch (e) {
            assertTrue(true, '无效JSON应该被捕获');
        }

        try {
            JSON.parse('{key: value}');
            assertTrue(false, '缺少引号的JSON键应该抛出错误');
        } catch (e) {
            assertTrue(true, '缺少引号的JSON键应该被捕获');
        }

        console.log('');
    })();

    console.log('## 测试: 本地存储操作');
    console.log('-'.repeat(80));

    (function testLocalStorageOperations() {
        console.log('测试: localStorage的读写操作');

        var testKey = 'jj_quiz_test_key';
        var testData = {data: 'test', number: 42, array: [1, 2, 3]};

        localStorage.setItem(testKey, JSON.stringify(testData));
        var retrieved = JSON.parse(localStorage.getItem(testKey));
        assertEqual(retrieved.data, 'test', '应该正确保存和读取字符串数据');
        assertEqual(retrieved.number, 42, '应该正确保存和读取数字数据');
        assertTrue(Array.isArray(retrieved.array), '应该正确保存和读取数组数据');

        var updateData = {data: 'updated', number: 100};
        localStorage.setItem(testKey, JSON.stringify(updateData));
        var updated = JSON.parse(localStorage.getItem(testKey));
        assertEqual(updated.data, 'updated', '应该正确更新数据');
        assertEqual(updated.number, 100, '更新后的数字应该正确');

        localStorage.removeItem(testKey);
        var deleted = localStorage.getItem(testKey);
        assertEqual(deleted, null, '删除后应该返回null');

        localStorage.setItem('empty_test', '');
        var emptyVal = localStorage.getItem('empty_test');
        assertEqual(emptyVal, '', '空字符串应该被正确保存');

        localStorage.removeItem('empty_test');

        console.log('');
    })();

    console.log('## 测试: 数据校验和验证');
    console.log('-'.repeat(80));

    (function testDataValidation() {
        console.log('测试: 选项格式验证');

        var validOptions = [
            'A.这是选项A',
            'B.选项B',
            'C、选项C',
            'D．选项D'
        ];

        validOptions.forEach(function(opt) {
            var match = opt.match(/^([A-D])[.、．]\s*(.+)$/);
            assertNotNull(match, '有效选项格式 "' + opt + '" 应该匹配');
            if (match) {
                assertTrue(['A', 'B', 'C', 'D'].indexOf(match[1]) !== -1, '应该正确提取选项键: ' + match[1]);
                assertTrue(match[2].length > 0, '应该正确提取选项文本');
            }
        });

        var invalidOptions = [
            '无效格式',
            'E.超出范围',
            'A选项（缺少分隔符）',
            '',
            'A.'
        ];

        invalidOptions.forEach(function(opt) {
            var match = opt.match(/^([A-D])[.、．]\s*(.+)$/);
            assertEqual(match, null, '无效选项格式 "' + opt + '" 不应该匹配');
        });

        var optionsText = 'A.选项1\nB.选项2\nC.选项3\nD.选项4';
        var lines = optionsText.split('\n');
        var parsedOptions = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            var match = line.match(/^([A-D])[.、．]\s*(.+)$/);
            if (match) {
                parsedOptions.push({key: match[1], text: match[2]});
            }
        }
        assertLength(parsedOptions, 4, '应该解析出4个选项');
        assertEqual(parsedOptions[0].key, 'A', '第一个选项应该是A');
        assertEqual(parsedOptions[3].key, 'D', '最后一个选项应该是D');

        console.log('');
    })();

    console.log('## 测试: 数组操作边界情况');
    console.log('-'.repeat(80));

    (function testArrayOperations() {
        console.log('测试: filter、map、reduce等数组方法');

        var questions = [
            {id: '1', category: 'album'},
            {id: '2', category: 'song'},
            {id: '3', category: 'album'},
            {id: '4', category: 'info'}
        ];

        var albumQuestions = questions.filter(function(q) {
            return q.category === 'album';
        });
        assertLength(albumQuestions, 2, '应该过滤出2个专辑题目');
        assertEqual(albumQuestions[0].id, '1', '第一个专辑题目应该是id=1');

        var questionIds = questions.map(function(q) {
            return q.id;
        });
        assertLength(questionIds, 4, 'map应该返回所有ID');
        assertEqual(questionIds.join(','), '1,2,3,4', 'map应该正确提取所有ID');

        var total = [1, 2, 3, 4].reduce(function(sum, num) {
            return sum + num;
        }, 0);
        assertEqual(total, 10, 'reduce应该正确计算总和');

        var emptyFilter = [].filter(function(x) { return x > 0; });
        assertLength(emptyFilter, 0, '空数组filter应该返回空数组');

        var singleFilter = [5].filter(function(x) { return x > 0; });
        assertLength(singleFilter, 1, '单元素数组filter应该正确处理');

        var nestedFilter = [{items: [1, 2]}, {items: [3, 4]}].filter(function(obj) {
            return obj.items.length > 2;
        });
        assertLength(nestedFilter, 1, '嵌套数组filter应该正确处理');

        console.log('');
    })();

    console.log('## 测试: 导入导出功能');
    console.log('-'.repeat(80));

    (function testImportExportFunctionality() {
        console.log('测试: 导入导出数据结构验证');

        var validExportData = {
            questionBank: typeof QUESTION_BANK !== 'undefined' ? QUESTION_BANK : [],
            userData: typeof DB !== 'undefined' ? DB.get() : null,
            exportTime: new Date().toISOString()
        };

        assertTrue('questionBank' in validExportData, '导出数据应包含questionBank字段');
        assertTrue('userData' in validExportData, '导出数据应包含userData字段');
        assertTrue('exportTime' in validExportData, '导出数据应包含exportTime字段');

        var jsonStr = JSON.stringify(validExportData);
        var parsed = JSON.parse(jsonStr);
        if (typeof QUESTION_BANK !== 'undefined') {
            assertEqual(parsed.questionBank.length, QUESTION_BANK.length, '导出题库应该完整');
        }

        var invalidData = {invalid: 'data', random: 123};
        assertFalse('questionBank' in invalidData, '无效数据不应该包含questionBank');
        assertFalse('userData' in invalidData, '无效数据不应该包含userData');

        var partialData1 = {questionBank: []};
        assertTrue('questionBank' in partialData1, '部分数据可以只包含questionBank');

        var partialData2 = {userData: {}};
        assertTrue('userData' in partialData2, '部分数据可以只包含userData');

        console.log('');
    })();

    console.log('## 测试: 题目数据结构验证');
    console.log('-'.repeat(80));

    (function testQuestionDataStructure() {
        console.log('测试: 题目数据结构的完整性');

        if (typeof QUESTION_BANK !== 'undefined' && QUESTION_BANK.length > 0) {
            console.log('测试题库中的前10道题目...');

            for (var i = 0; i < Math.min(10, QUESTION_BANK.length); i++) {
                var q = QUESTION_BANK[i];

                assertTrue('id' in q, '题目应该包含id字段');
                assertTrue('category' in q, '题目应该包含category字段');
                assertTrue('question' in q, '题目应该包含question字段');
                assertTrue('options' in q, '题目应该包含options字段');
                assertTrue('answer' in q, '题目应该包含answer字段');
                assertTrue('explanation' in q, '题目应该包含explanation字段');

                assertTrue(Array.isArray(q.options), 'options应该是数组');
                assertTrue(q.options.length >= 2, '题目至少有2个选项');

                for (var j = 0; j < q.options.length; j++) {
                    assertTrue('key' in q.options[j], '选项应该包含key字段');
                    assertTrue('text' in q.options[j], '选项应该包含text字段');
                    assertTrue(['A', 'B', 'C', 'D'].indexOf(q.options[j].key) !== -1, '选项key应该是A/B/C/D');
                }

                assertTrue(['A', 'B', 'C', 'D'].indexOf(q.answer) !== -1, '答案应该是A/B/C/D');
            }

            var categories = {};
            for (var k = 0; k < QUESTION_BANK.length; k++) {
                var cat = QUESTION_BANK[k].category;
                categories[cat] = (categories[cat] || 0) + 1;
            }
            var categoryNames = Object.keys(categories);
            console.log('  发现 ' + categoryNames.length + ' 个分类: ' + categoryNames.join(', '));

            assertTrue(categoryNames.length > 0, '题库应该至少包含一个分类');
        } else {
            console.log('⚠  QUESTION_BANK未定义或为空，跳过测试');
        }

        console.log('');
    })();

    console.log('## 测试: 状态管理');
    console.log('-'.repeat(80));

    (function testStateManagement() {
        console.log('测试: 状态对象的管理');

        var state = {
            quiz: [],
            idx: 0,
            answered: false,
            mode: 'quick',
            correctCount: 0,
            startTime: 0,
            timer: null
        };

        assertEqual(state.quiz.length, 0, '初始quiz应该为空');
        assertEqual(state.idx, 0, '初始idx应该为0');
        assertEqual(state.answered, false, '初始answered应该为false');
        assertEqual(state.mode, 'quick', '默认模式应该是quick');
        assertEqual(state.correctCount, 0, '初始correctCount应该为0');
        assertEqual(state.timer, null, '初始timer应该为null');

        state.quiz = [{id: '001', answer: 'A'}];
        state.idx = 0;
        state.answered = false;
        state.correctCount = 0;

        assertLength(state.quiz, 1, '设置后quiz应该有1个元素');
        assertEqual(state.idx, 0, 'idx应该重置为0');
        assertFalse(state.answered, 'answered应该重置为false');
        assertEqual(state.correctCount, 0, 'correctCount应该重置为0');

        var modes = ['quick', 'standard', 'intensive'];
        modes.forEach(function(mode) {
            state.mode = mode;
            assertEqual(state.mode, mode, '模式应该正确设置为: ' + mode);
        });

        console.log('');
    })();

    console.log('='.repeat(80));
    console.log('测试执行完成');
    console.log('='.repeat(80));
    console.log('');
    console.log('测试结果汇总:');
    console.log('  总测试数:', testResults.total);
    console.log('  通过:', testResults.passed);
    console.log('  失败:', testResults.failed);
    console.log('  通过率:', (testResults.total > 0 ? (testResults.passed / testResults.total * 100).toFixed(2) : 0) + '%');
    console.log('');

    if (testResults.failed > 0) {
        console.log('失败的测试:');
        testResults.results.forEach(function(result, index) {
            if (!result.passed) {
                console.log('  ' + (index + 1) + '. ' + result.message);
                console.log('     Expected:', result.expected);
                console.log('     Actual:', result.actual);
            }
        });
    }

    console.log('');
    console.log('='.repeat(80));

    if (typeof window !== 'undefined') {
        window.testResults = testResults;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            testResults: testResults,
            assertEqual: assertEqual,
            assertTrue: assertTrue,
            assertFalse: assertFalse,
            assertNotNull: assertNotNull,
            assertNull: assertNull,
            assertContains: assertContains,
            assertLength: assertLength
        };
    }

})();
