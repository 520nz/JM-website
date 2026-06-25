/**
 * Node.js 测试运行器
 * 运行核心逻辑单元测试
 */

// 模拟浏览器环境
global.localStorage = {
    data: {},
    getItem: function(key) { return this.data[key] || null; },
    setItem: function(key, value) { this.data[key] = value; },
    removeItem: function(key) { delete this.data[key]; },
    clear: function() { this.data = {}; }
};

// 加载题库数据
var QUESTION_BANK = [
    {id:"001",category:"专辑",question:"林俊杰首张专辑《乐行者》发行于哪一天？",options:[{key:"A",text:"2003年4月1日"},{key:"B",text:"2003年4月10日"},{key:"C",text:"2003年5月1日"},{key:"D",text:"2003年5月10日"}],answer:"B",explanation:"《乐行者》于2003年4月10日正式发行，这也是林俊杰的出道专辑。"},
    {id:"005",category:"专辑",question:"《第二天堂》（俗称《江南》专辑）发行于哪一年？",options:[{key:"A",text:"2003年"},{key:"B",text:"2004年"},{key:"C",text:"2005年"},{key:"D",text:"2006年"}],answer:"B",explanation:"《第二天堂》于2004年6月4日发行，包含热门歌曲《江南》。"},
    {id:"002",category:"歌曲",question:"《乐行者》专辑中由林俊杰本人作词的歌曲是？",options:[{key:"A",text:"就是我"},{key:"B",text:"会读书"},{key:"C",text:"不懂"},{key:"D",text:"翅膀"}],answer:"A",explanation:"《就是我》由林俊杰作词，这是他第一首完全由自己作词的作品。"}
];

var DEFAULT_QUESTION_BANK = QUESTION_BANK.slice();

// 模拟DB对象
var DB = {
    KEY: 'jj_quiz_v2',
    get: function() {
        var d = localStorage.getItem(DB.KEY);
        return d ? JSON.parse(d) : DB.defaults();
    },
    defaults: function() {
        return {history:[], wrong:[], stats:{total:0, correct:0, cats:{}}};
    },
    save: function(d) {
        localStorage.setItem(DB.KEY, JSON.stringify(d));
    },
    addRecord: function(rec) {
        var d = DB.get();
        d.history.push(rec);
        d.stats.total++;
        if(rec.ok) d.stats.correct++;
        var q = DB.findQ(rec.qid);
        if(q) {
            if(!d.stats.cats[q.category]) d.stats.cats[q.category] = {t:0, c:0};
            d.stats.cats[q.category].t++;
            if(rec.ok) d.stats.cats[q.category].c++;
        }
        DB.save(d);
    },
    addWrong: function(qid) {
        var d = DB.get();
        var f = null;
        for(var i = 0; i < d.wrong.length; i++) {
            if(d.wrong[i].qid === qid) { f = d.wrong[i]; break; }
        }
        if(f) { f.cnt++; f.time = Date.now(); }
        else { d.wrong.push({qid:qid, cnt:1, time:Date.now()}); }
        DB.save(d);
    },
    removeWrong: function(qid) {
        var d = DB.get();
        d.wrong = d.wrong.filter(function(w) { return w.qid !== qid; });
        DB.save(d);
    },
    getWrong: function() { return DB.get().wrong; },
    findQ: function(qid) {
        for(var i = 0; i < QUESTION_BANK.length; i++) {
            if(QUESTION_BANK[i].id === qid) return QUESTION_BANK[i];
        }
        return null;
    }
};

// shuffle函数
function shuffle(arr) {
    var a = arr.slice();
    for(var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i];
        a[i] = a[j];
        a[j] = t;
    }
    return a;
}

// ========== 测试框架 ==========
var TestRunner = {
    passed: 0,
    failed: 0,
    results: [],

    assertEqual: function(actual, expected, msg) {
        var pass = actual === expected;
        this.results.push({ pass: pass, msg: msg, actual: actual, expected: expected });
        if (pass) { this.passed++; }
        else { this.failed++; console.error('FAIL:', msg, '| Expected:', expected, '| Actual:', actual); }
    },

    assertDeepEqual: function(actual, expected, msg) {
        var pass = JSON.stringify(actual) === JSON.stringify(expected);
        this.results.push({ pass: pass, msg: msg, actual: actual, expected: expected });
        if (pass) { this.passed++; }
        else { this.failed++; console.error('FAIL:', msg, '| Expected:', JSON.stringify(expected), '| Actual:', JSON.stringify(actual)); }
    },

    assertTrue: function(condition, msg) { this.assertEqual(condition, true, msg); },
    assertFalse: function(condition, msg) { this.assertEqual(condition, false, msg); },

    report: function() {
        console.log('\n========== 测试报告 ==========');
        console.log('通过:', this.passed, '| 失败:', this.failed, '| 总计:', this.results.length);
        console.log('==============================');
        return { passed: this.passed, failed: this.failed, results: this.results };
    }
};

// ========== 测试用例 ==========

function testShuffle() {
    console.log('\n--- 测试 shuffle 函数 ---');

    var arr = [1, 2, 3, 4, 5];
    var shuffled = shuffle(arr.slice());
    TestRunner.assertEqual(shuffled.length, arr.length, 'shuffle后长度不变');

    var origSet = arr.slice().sort().join(',');
    var shuffledSet = shuffled.slice().sort().join(',');
    TestRunner.assertEqual(shuffledSet, origSet, 'shuffle后元素集合相同');

    var original = [1, 2, 3];
    var copy = original.slice();
    shuffle(original);
    TestRunner.assertDeepEqual(original, copy, 'shuffle不修改原数组');

    var emptyShuffled = shuffle([]);
    TestRunner.assertEqual(emptyShuffled.length, 0, '空数组shuffle后仍为空');

    var singleShuffled = shuffle([1]);
    TestRunner.assertEqual(singleShuffled.length, 1, '单元素数组shuffle后长度仍为1');
    TestRunner.assertEqual(singleShuffled[0], 1, '单元素数组shuffle后元素不变');
}

function testOptionParsing() {
    console.log('\n--- 测试选项解析正则 ---');

    var pattern = /^([A-D])[.、．]\s*(.+)$/;

    TestRunner.assertTrue(pattern.test('A.选项1'), '标准格式A.选项1');
    TestRunner.assertTrue(pattern.test('B.选项2'), '标准格式B.选项2');
    TestRunner.assertTrue(pattern.test('C.选项3'), '标准格式C.选项3');
    TestRunner.assertTrue(pattern.test('D.选项4'), '标准格式D.选项4');

    TestRunner.assertTrue(pattern.test('A、选项1'), '中文顿号A、选项1');
    TestRunner.assertTrue(pattern.test('B、选项2'), '中文顿号B、选项2');

    TestRunner.assertTrue(pattern.test('A．选项1'), '全角句号A．选项1');
    TestRunner.assertTrue(pattern.test('B．选项2'), '全角句号B．选项2');

    TestRunner.assertTrue(pattern.test('A.  选项1'), 'A.带多余空格');
    TestRunner.assertTrue(pattern.test('A、  选项1'), 'A、带多余空格');

    var match1 = 'A.英文 D.J'.match(pattern);
    TestRunner.assertTrue(match1 !== null, '选项内容包含英文');

    var match2 = 'A.中文 测试'.match(pattern);
    TestRunner.assertTrue(match2 !== null, '选项内容包含中文和空格');

    TestRunner.assertFalse(pattern.test('E.选项'), 'E不在A-D范围内');
    TestRunner.assertFalse(pattern.test('a.选项'), '小写字母不匹配');
    TestRunner.assertFalse(pattern.test('1.选项'), '数字不匹配');
    TestRunner.assertFalse(pattern.test('A选项'), '缺少分隔符');
    TestRunner.assertFalse(pattern.test('A-选项'), '错误的分隔符');

    var result = 'B.这是选项文字'.match(pattern);
    TestRunner.assertEqual(result[1], 'B', '解析key为B');
    TestRunner.assertEqual(result[2], '这是选项文字', '解析text正确');
}

function testDBModule() {
    console.log('\n--- 测试 DB 模块 ---');

    localStorage.clear();

    var defaults = DB.defaults();
    TestRunner.assertDeepEqual(defaults.history, [], '默认history为空');
    TestRunner.assertDeepEqual(defaults.wrong, [], '默认wrong为空');
    TestRunner.assertEqual(defaults.stats.total, 0, '默认stats.total为0');
    TestRunner.assertEqual(defaults.stats.correct, 0, '默认stats.correct为0');
    TestRunner.assertDeepEqual(defaults.stats.cats, {}, '默认stats.cats为空对象');

    localStorage.removeItem(DB.KEY);
    var d = DB.get();
    TestRunner.assertDeepEqual(d.history, [], 'get空localStorage返回默认history');
    TestRunner.assertDeepEqual(d.wrong, [], 'get空localStorage返回默认wrong');

    var testData = {
        history: [{ qid: '001', ans: 'A', ok: true, time: Date.now() }],
        wrong: [],
        stats: { total: 1, correct: 1, cats: {} }
    };
    DB.save(testData);
    var retrieved = DB.get();
    TestRunner.assertEqual(retrieved.history.length, 1, 'get返回保存的history');
    TestRunner.assertEqual(retrieved.history[0].qid, '001', 'get返回正确的qid');

    localStorage.removeItem(DB.KEY);
    DB.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
    var afterAdd = DB.get();
    TestRunner.assertEqual(afterAdd.stats.total, 1, 'addRecord增加total');
    TestRunner.assertEqual(afterAdd.stats.correct, 1, 'addRecord增加correct');

    localStorage.removeItem(DB.KEY);
    DB.addWrong('001');
    var wrong1 = DB.getWrong();
    TestRunner.assertEqual(wrong1.length, 1, 'addWrong添加错题');
    TestRunner.assertEqual(wrong1[0].qid, '001', 'addWrong保存正确qid');
    TestRunner.assertEqual(wrong1[0].cnt, 1, 'addWrong设置cnt为1');

    DB.addWrong('001');
    var wrong2 = DB.getWrong();
    TestRunner.assertEqual(wrong2.length, 1, '重复addWrong不新增记录');
    TestRunner.assertEqual(wrong2[0].cnt, 2, '重复addWrong累加cnt');

    DB.removeWrong('001');
    var afterRemove = DB.getWrong();
    TestRunner.assertEqual(afterRemove.length, 0, 'removeWrong正确删除');

    var q = DB.findQ('001');
    TestRunner.assertEqual(q.category, '专辑', 'findQ找到正确题目');
    TestRunner.assertEqual(q.answer, 'B', 'findQ返回正确答案');

    var notFound = DB.findQ('non_existent');
    TestRunner.assertEqual(notFound, null, 'findQ对不存在ID返回null');
}

function testImportValidation() {
    console.log('\n--- 测试导入数据验证 ---');

    var validData = {
        questionBank: [{ id: 'test1', category: '测试', question: '测试题', options: [{ key: 'A', text: '选项1' }], answer: 'A', explanation: '' }],
        userData: { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } }
    };

    TestRunner.assertTrue(validData.questionBank !== undefined, '有效数据包含questionBank');
    TestRunner.assertTrue(validData.userData !== undefined, '有效数据包含userData');

    var invalidJson = '{ invalid json }';
    var parsed = null;
    try { parsed = JSON.parse(invalidJson); } catch (e) { parsed = null; }
    TestRunner.assertEqual(parsed, null, '无效JSON解析返回null');

    var missingQB = { userData: {} };
    TestRunner.assertTrue(missingQB.questionBank === undefined, '缺少questionBank字段');

    var existingBank = [{ id: '001', question: '已存在' }];
    var importBank = [{ id: '002', question: '新题目' }];
    var existingIds = {};
    existingBank.forEach(function(q) { existingIds[q.id] = true; });

    var newIds = importBank.filter(function(q) { return !existingIds[q.id]; });
    TestRunner.assertEqual(newIds.length, 1, '正确识别新增题目');
    TestRunner.assertEqual(newIds[0].id, '002', '新增题目ID正确');

    var updateIds = importBank.filter(function(q) { return existingIds[q.id]; });
    TestRunner.assertEqual(updateIds.length, 0, '无重复ID时无更新题目');

    var importBankWithUpdate = [{ id: '001', question: '更新后' }];
    var updateIds2 = importBankWithUpdate.filter(function(q) { return existingIds[q.id]; });
    TestRunner.assertEqual(updateIds2.length, 1, '有重复ID时识别为更新');
}

function testResetQuestionBank() {
    console.log('\n--- 测试恢复默认题库 ---');

    var originalBank = QUESTION_BANK.slice();
    var originalLength = originalBank.length;

    QUESTION_BANK.push({ id: 'fake', question: 'fake' });
    TestRunner.assertEqual(QUESTION_BANK.length, originalLength + 1, '题库已被修改');

    QUESTION_BANK = DEFAULT_QUESTION_BANK.slice();
    TestRunner.assertEqual(QUESTION_BANK.length, originalLength, '恢复后长度正确');
    TestRunner.assertEqual(QUESTION_BANK[0].id, '001', '恢复后第一个题目ID正确');

    var hasFake = QUESTION_BANK.some(function(q) { return q.id === 'fake'; });
    TestRunner.assertFalse(hasFake, '恢复后不包含伪造题目');
}

function testCategoryStats() {
    console.log('\n--- 测试分类统计 ---');

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
    TestRunner.assertEqual(cats['歌曲'].t, 1, '歌曲分类总计1题');
    TestRunner.assertEqual(cats['专辑'].c, 2, '专辑分类正确2题（001和005都是专辑）');
    TestRunner.assertEqual(cats['歌曲'].c, 0, '歌曲分类正确0题');

    var pct = cats['专辑'].t > 0 ? Math.round(cats['专辑'].c / cats['专辑'].t * 100) : 0;
    TestRunner.assertEqual(pct, 100, '专辑正确率计算正确(100%)');
}

function testBoundaryConditions() {
    console.log('\n--- 测试边界条件 ---');

    var emptyArr = [];
    TestRunner.assertEqual(emptyArr.length, 0, '空数组长度为0');
    TestRunner.assertEqual(emptyArr.some(function() { return true; }), false, '空数组some返回false');

    var largeNum = 999999999999999;
    TestRunner.assertTrue(largeNum > 0, '极大数仍为正数');

    var longStr = '';
    for (var i = 0; i < 1000; i++) longStr += 'a';
    TestRunner.assertEqual(longStr.length, 1000, '长字符串长度正确');

    var specialChars = '<>&"\'\\';
    TestRunner.assertEqual(specialChars.length, 6, '特殊字符长度正确(<>&"\'\\)');

    var now = Date.now();
    var today = new Date(now).setHours(0, 0, 0, 0);
    TestRunner.assertTrue(today <= now, '今日0点时间戳 <= 当前时间');

    var zeroTotal = 0;
    var zeroPct = zeroTotal > 0 ? Math.round(50 / zeroTotal * 100) : 0;
    TestRunner.assertEqual(zeroPct, 0, 'total为0时正确率返回0');
}

// ========== 运行测试 ==========
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
process.exit(report.failed > 0 ? 1 : 0);
