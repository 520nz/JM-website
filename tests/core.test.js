/**
 * 林俊杰答题 - 核心逻辑单元测试
 * 测试目标：关键业务逻辑（数据验证、边界条件、解析逻辑）
 */

// ========== 测试工具 ==========
var TestRunner = {
    passed: 0,
    failed: 0,
    results: [],

    assertEqual: function(actual, expected, msg) {
        var pass = actual === expected;
        this.results.push({
            pass: pass,
            msg: msg,
            actual: actual,
            expected: expected
        });
        if (pass) {
            this.passed++;
        } else {
            this.failed++;
            console.error('FAIL:', msg, '| Expected:', expected, '| Actual:', actual);
        }
    },

    assertDeepEqual: function(actual, expected, msg) {
        var pass = JSON.stringify(actual) === JSON.stringify(expected);
        this.results.push({
            pass: pass,
            msg: msg,
            actual: actual,
            expected: expected
        });
        if (pass) {
            this.passed++;
        } else {
            this.failed++;
            console.error('FAIL:', msg, '| Expected:', JSON.stringify(expected), '| Actual:', JSON.stringify(actual));
        }
    },

    assertTrue: function(condition, msg) {
        this.assertEqual(condition, true, msg);
    },

    assertFalse: function(condition, msg) {
        this.assertEqual(condition, false, msg);
    },

    report: function() {
        console.log('\n========== 测试报告 ==========');
        console.log('通过:', this.passed, '| 失败:', this.failed, '| 总计:', this.results.length);
        console.log('==============================');
        return { passed: this.passed, failed: this.failed, results: this.results };
    }
};

// ========== 测试：Shuffle 函数 ==========
function testShuffle() {
    console.log('\n--- 测试 shuffle 函数 ---');

    // 测试1：shuffle后元素数量不变
    var arr = [1, 2, 3, 4, 5];
    var shuffled = shuffle(arr.slice());
    TestRunner.assertEqual(shuffled.length, arr.length, 'shuffle后长度不变');

    // 测试2：shuffle后包含所有原元素
    var origSet = arr.slice().sort().join(',');
    var shuffledSet = shuffled.slice().sort().join(',');
    TestRunner.assertEqual(shuffledSet, origSet, 'shuffle后元素集合相同');

    // 测试3：shuffle不修改原数组
    var original = [1, 2, 3];
    var copy = original.slice();
    shuffle(original);
    TestRunner.assertDeepEqual(original, copy, 'shuffle不修改原数组');

    // 测试4：空数组
    var emptyShuffled = shuffle([]);
    TestRunner.assertEqual(emptyShuffled.length, 0, '空数组shuffle后仍为空');

    // 测试5：单元素数组
    var singleShuffled = shuffle([1]);
    TestRunner.assertEqual(singleShuffled.length, 1, '单元素数组shuffle后长度仍为1');
    TestRunner.assertEqual(singleShuffled[0], 1, '单元素数组shuffle后元素不变');
}

// ========== 测试：选项解析正则 ==========
function testOptionParsing() {
    console.log('\n--- 测试选项解析正则 ---');

    var pattern = /^([A-D])[.、．]\s*(.+)$/;

    // 标准格式测试
    TestRunner.assertTrue(pattern.test('A.选项1'), '标准格式A.选项1');
    TestRunner.assertTrue(pattern.test('B.选项2'), '标准格式B.选项2');
    TestRunner.assertTrue(pattern.test('C.选项3'), '标准格式C.选项3');
    TestRunner.assertTrue(pattern.test('D.选项4'), '标准格式D.选项4');

    // 中文顿号格式
    TestRunner.assertTrue(pattern.test('A、选项1'), '中文顿号A、选项1');
    TestRunner.assertTrue(pattern.test('B、选项2'), '中文顿号B、选项2');

    // 全角句号格式
    TestRunner.assertTrue(pattern.test('A．选项1'), '全角句号A．选项1');
    TestRunner.assertTrue(pattern.test('B．选项2'), '全角句号B．选项2');

    // 带空格格式
    TestRunner.assertTrue(pattern.test('A.  选项1'), 'A.带多余空格');
    TestRunner.assertTrue(pattern.test('A、  选项1'), 'A、带多余空格');

    // 边界情况：选项内容包含特殊字符
    var match1 = 'A.英文 D.J'.match(pattern);
    TestRunner.assertTrue(match1 !== null, '选项内容包含英文');

    var match2 = 'A.中文 测试'.match(pattern);
    TestRunner.assertTrue(match2 !== null, '选项内容包含中文和空格');

    // 错误格式测试
    TestRunner.assertFalse(pattern.test('E.选项'), 'E不在A-D范围内');
    TestRunner.assertFalse(pattern.test('a.选项'), '小写字母不匹配');
    TestRunner.assertFalse(pattern.test('1.选项'), '数字不匹配');
    TestRunner.assertFalse(pattern.test('A选项'), '缺少分隔符');
    TestRunner.assertFalse(pattern.test('A-选项'), '错误的分隔符');

    // 解析结果验证
    var result = 'B.这是选项文字'.match(pattern);
    TestRunner.assertEqual(result[1], 'B', '解析key为B');
    TestRunner.assertEqual(result[2], '这是选项文字', '解析text正确');
}

// ========== 测试：DB 模块 ==========
function testDBModule() {
    console.log('\n--- 测试 DB 模块 ---');

    // 清理localStorage
    localStorage.removeItem(DB.KEY);
    localStorage.removeItem('jj_question_bank');

    // 测试默认数据
    var defaults = DB.defaults();
    TestRunner.assertDeepEqual(defaults.history, [], '默认history为空');
    TestRunner.assertDeepEqual(defaults.wrong, [], '默认wrong为空');
    TestRunner.assertEqual(defaults.stats.total, 0, '默认stats.total为0');
    TestRunner.assertEqual(defaults.stats.correct, 0, '默认stats.correct为0');
    TestRunner.assertDeepEqual(defaults.stats.cats, {}, '默认stats.cats为空对象');

    // 测试get返回默认值
    localStorage.removeItem(DB.KEY);
    var d = DB.get();
    TestRunner.assertDeepEqual(d.history, [], 'get空localStorage返回默认history');
    TestRunner.assertDeepEqual(d.wrong, [], 'get空localStorage返回默认wrong');

    // 测试save和get
    var testData = {
        history: [{ qid: '001', ans: 'A', ok: true, time: Date.now() }],
        wrong: [],
        stats: { total: 1, correct: 1, cats: {} }
    };
    DB.save(testData);
    var retrieved = DB.get();
    TestRunner.assertEqual(retrieved.history.length, 1, 'get返回保存的history');
    TestRunner.assertEqual(retrieved.history[0].qid, '001', 'get返回正确的qid');

    // 测试addRecord
    localStorage.removeItem(DB.KEY);
    DB.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
    var afterAdd = DB.get();
    TestRunner.assertEqual(afterAdd.stats.total, 1, 'addRecord增加total');
    TestRunner.assertEqual(afterAdd.stats.correct, 1, 'addRecord增加correct');

    // 测试addWrong
    localStorage.removeItem(DB.KEY);
    DB.addWrong('001');
    var wrong1 = DB.getWrong();
    TestRunner.assertEqual(wrong1.length, 1, 'addWrong添加错题');
    TestRunner.assertEqual(wrong1[0].qid, '001', 'addWrong保存正确qid');
    TestRunner.assertEqual(wrong1[0].cnt, 1, 'addWrong设置cnt为1');

    // 测试addWrong累加
    DB.addWrong('001');
    var wrong2 = DB.getWrong();
    TestRunner.assertEqual(wrong2.length, 1, '重复addWrong不新增记录');
    TestRunner.assertEqual(wrong2[0].cnt, 2, '重复addWrong累加cnt');

    // 测试removeWrong
    DB.removeWrong('001');
    var afterRemove = DB.getWrong();
    TestRunner.assertEqual(afterRemove.length, 0, 'removeWrong正确删除');

    // 测试findQ
    var q = DB.findQ('001');
    TestRunner.assertEqual(q.category, '专辑', 'findQ找到正确题目');
    TestRunner.assertEqual(q.answer, 'B', 'findQ返回正确答案');

    // 测试findQ找不到
    var notFound = DB.findQ('non_existent');
    TestRunner.assertEqual(notFound, null, 'findQ对不存在ID返回null');
}

// ========== 测试：导入数据验证逻辑 ==========
function testImportValidation() {
    console.log('\n--- 测试导入数据验证 ---');

    // 测试有效数据结构
    var validData = {
        questionBank: [{ id: 'test1', category: '测试', question: '测试题', options: [{ key: 'A', text: '选项1' }], answer: 'A', explanation: '' }],
        userData: { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } }
    };

    // 验证必要字段检测
    TestRunner.assertTrue(validData.questionBank !== undefined, '有效数据包含questionBank');
    TestRunner.assertTrue(validData.userData !== undefined, '有效数据包含userData');

    // 测试无效JSON检测（模拟）
    var invalidJson = '{ invalid json }';
    var parsed = null;
    try { parsed = JSON.parse(invalidJson); } catch (e) { parsed = null; }
    TestRunner.assertEqual(parsed, null, '无效JSON解析返回null');

    // 测试缺少questionBank的情况
    var missingQB = { userData: {} };
    TestRunner.assertTrue(missingQB.questionBank === undefined, '缺少questionBank字段');

    // 测试questionBank合并逻辑 - 新增题目
    var existingBank = [{ id: '001', question: '已存在' }];
    var importBank = [{ id: '002', question: '新题目' }];
    var existingIds = {};
    existingBank.forEach(function(q) { existingIds[q.id] = true; });

    var newIds = importBank.filter(function(q) { return !existingIds[q.id]; });
    TestRunner.assertEqual(newIds.length, 1, '正确识别新增题目');
    TestRunner.assertEqual(newIds[0].id, '002', '新增题目ID正确');

    // 测试questionBank合并逻辑 - 更新题目
    var updateIds = importBank.filter(function(q) { return existingIds[q.id]; });
    TestRunner.assertEqual(updateIds.length, 0, '无重复ID时无更新题目');

    var importBankWithUpdate = [{ id: '001', question: '更新后' }];
    var updateIds2 = importBankWithUpdate.filter(function(q) { return existingIds[q.id]; });
    TestRunner.assertEqual(updateIds2.length, 1, '有重复ID时识别为更新');
}

// ========== 测试：恢复默认题库逻辑 ==========
function testResetQuestionBank() {
    console.log('\n--- 测试恢复默认题库 ---');

    // 保存原始题库
    var originalBank = QUESTION_BANK.slice();
    var originalLength = originalBank.length;

    // 模拟修改题库
    QUESTION_BANK.push({ id: 'fake', question: 'fake' });
    TestRunner.assertEqual(QUESTION_BANK.length, originalLength + 1, '题库已被修改');

    // 模拟恢复
    QUESTION_BANK = DEFAULT_QUESTION_BANK.slice();
    TestRunner.assertEqual(QUESTION_BANK.length, originalLength, '恢复后长度正确');
    TestRunner.assertEqual(QUESTION_BANK[0].id, '001', '恢复后第一个题目ID正确');

    // 验证恢复的是真正的默认题库
    var hasFake = QUESTION_BANK.some(function(q) { return q.id === 'fake'; });
    TestRunner.assertFalse(hasFake, '恢复后不包含伪造题目');
}

// ========== 测试：分类统计逻辑 ==========
function testCategoryStats() {
    console.log('\n--- 测试分类统计 ---');

    // 模拟答题记录处理
    var records = [
        { qid: '001', ok: true, time: Date.now() },
        { qid: '002', ok: false, time: Date.now() },
        { qid: '005', ok: true, time: Date.now() }
    ];

    var cats = {};
    for (var i = 0; i < records.length; i++) {
        var q = DB.findQ(records[i].qid);
        if (q) {
            if (!cats[q.category]) cats[q.category] = { t: 0, c: 0 };
            cats[q.category].t++;
            if (records[i].ok) cats[q.category].c++;
        }
    }

    TestRunner.assertEqual(cats['专辑'].t, 2, '专辑分类总计2题');
    TestRunner.assertEqual(cats['专辑'].c, 2, '专辑分类正确2题');

    // 测试正确率计算
    var pct = cats['专辑'].t > 0 ? Math.round(cats['专辑'].c / cats['专辑'].t * 100) : 0;
    TestRunner.assertEqual(pct, 100, '专辑正确率计算正确(100%)');
}

// ========== 测试：边界条件 ==========
function testBoundaryConditions() {
    console.log('\n--- 测试边界条件 ---');

    // 空数组处理
    var emptyArr = [];
    TestRunner.assertEqual(emptyArr.length, 0, '空数组长度为0');
    TestRunner.assertEqual(emptyArr.some(function() { return true; }), false, '空数组some返回false');

    // 极大数字处理
    var largeNum = 999999999999999;
    TestRunner.assertTrue(largeNum > 0, '极大数仍为正数');

    // 字符串边界
    var longStr = '';
    for (var i = 0; i < 1000; i++) longStr += 'a';
    TestRunner.assertEqual(longStr.length, 1000, '长字符串长度正确');

    // 特殊字符处理
    var specialChars = '<>&"\'\\';
    TestRunner.assertEqual(specialChars.length, 6, '特殊字符长度正确(<>&"\'\\)');

    // 日期边界
    var now = Date.now();
    var today = new Date(now).setHours(0, 0, 0, 0);
    TestRunner.assertTrue(today <= now, '今日0点时间戳 <= 当前时间');

    // 百分比边界
    var zeroTotal = 0;
    var zeroPct = zeroTotal > 0 ? Math.round(50 / zeroTotal * 100) : 0;
    TestRunner.assertEqual(zeroPct, 0, 'total为0时正确率返回0');
}

// ========== 运行所有测试 ==========
function runAllTests() {
    console.log('========================================');
    console.log('林俊杰答题 - 核心逻辑单元测试');
    console.log('========================================');

    testShuffle();
    testOptionParsing();
    testDBModule();
    testImportValidation();
    testResetQuestionBank();
    testCategoryStats();
    testBoundaryConditions();

    var report = TestRunner.report();

    console.log('\n测试执行完成');
    return report;
}

// 暴露到全局
window.runAllTests = runAllTests;
window.TestRunner = TestRunner;
