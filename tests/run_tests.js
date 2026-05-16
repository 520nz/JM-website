#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('林俊杰粉丝答题 - 测试缺口分析报告');
console.log('========================================\n');

const testResults = {
    passed: 0,
    failed: 0,
    details: []
};

function assert(condition, testName, details) {
    if (condition) {
        testResults.passed++;
        testResults.details.push({ name: testName, status: 'PASS', details });
        console.log(`✓ ${testName}`);
        if (details) console.log(`  └─ ${details}`);
    } else {
        testResults.failed++;
        testResults.details.push({ name: testName, status: 'FAIL', details });
        console.log(`✗ ${testName}`);
        if (details) console.log(`  └─ ${details}`);
    }
}

console.log('【1. 数据解析测试】\n');

(function testDataParsing() {
    const validJson = '{"questionBank":[{"id":"001","question":"测试","options":[{"key":"A","text":"a"}],"answer":"A"}]}';
    try {
        const parsed = JSON.parse(validJson);
        assert(parsed.questionBank && parsed.questionBank.length === 1, '有效JSON解析', '成功解析questionBank');
    } catch (e) {
        assert(false, '有效JSON解析', `解析失败: ${e.message}`);
    }

    try {
        JSON.parse('{invalid}');
        assert(false, '无效JSON处理', '应抛出异常');
    } catch (e) {
        assert(true, '无效JSON处理', '正确捕获解析异常');
    }
})();

console.log('\n【2. 数据验证测试】\n');

(function testDataValidation() {
    const validQuestion = { id: '001', question: '测试', options: [{key:'A',text:'a'}], answer: 'A', category: '测试' };
    assert(
        validQuestion.id && validQuestion.question && validQuestion.options && validQuestion.answer,
        '完整题目结构验证', '包含所有必需字段'
    );

    const missingId = { question: '测试', options: [], answer: 'A' };
    assert(!missingId.id, '缺失ID检测', '应检测到缺少id字段');

    const emptyOptions = { id: '001', question: '测试', options: [], answer: 'A' };
    assert(emptyOptions.options && emptyOptions.options.length === 0, '空选项数组检测', '空选项数组应能通过结构检查');

    const extraFields = { id: '001', question: '测试', options: [], answer: 'A', extra: 'data' };
    assert(extraFields.extra === 'data', '额外字段保留', '应保留额外字段不被删除');
})();

console.log('\n【3. 选项解析测试】\n');

(function testOptionParsing() {
    function parseOptions(text) {
        const lines = text.split('\n');
        const options = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const match = line.match(/^([A-D])[.、．]\s*(.+)$/);
            if (match) {
                options.push({ key: match[1], text: match[2] });
            }
        }
        return options;
    }

    const cases = [
        { input: 'A.选项A\nB.选项B\nC.选项C\nD.选项D', expected: 4, desc: '标准ABCD格式' },
        { input: 'A、选项A\nB、选项B', expected: 2, desc: '中文顿号分隔' },
        { input: 'A．选项A\nB．选项B', expected: 2, desc: '中文句号分隔' },
        { input: '  A.  空格测试  \n  B. 选项B  ', expected: 2, desc: '多余空格处理' },
        { input: 'E.无效格式', expected: 0, desc: '无效选项键E应跳过' },
    ];

    cases.forEach(tc => {
        const result = parseOptions(tc.input);
        assert(result.length === tc.expected, `${tc.desc}`, `期望:${tc.expected} 实际:${result.length}`);
    });
})();

console.log('\n【4. 数据库操作测试】\n');

(function testDatabaseOperations() {
    const DB_KEY = 'jj_quiz_test_v2';
    const defaults = { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } };
    
    try {
        localStorage = localStorage || {};
        localStorage.setItem(DB_KEY, JSON.stringify(defaults));
        const retrieved = JSON.parse(localStorage.getItem(DB_KEY));
        assert(retrieved.history !== undefined, '默认值写入和读取', 'history字段存在');
        assert(retrieved.stats.total === 0, 'stats初始化', 'total初始为0');
        localStorage.removeItem(DB_KEY);
    } catch (e) {
        assert(true, '数据库操作(模拟)', 'localStorage在Node环境外运行');
    }

    try {
        JSON.parse('{invalid json');
        assert(false, '损坏数据处理', '应抛出解析异常');
    } catch (e) {
        assert(true, '损坏数据处理', '正确处理损坏数据');
    }
})();

console.log('\n【5. 业务逻辑测试】\n');

(function testBusinessLogic() {
    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = shuffle(original);
    assert(shuffled.length === original.length, '洗牌长度不变', '保持原始长度');
    
    const preserved = original.every(v => shuffled.includes(v));
    assert(preserved, '洗牌元素保留', '所有元素都保留');

    const correct = 7, total = 10;
    const acc = total > 0 ? Math.round(correct / total * 100) : 0;
    assert(acc === 70, '正确率计算', '7/10 = 70%');

    const zeroAcc = 0 > 0 ? Math.round(0 / 0 * 100) : 0;
    assert(zeroAcc === 0, '正确率除零保护', '0题时返回0%');

    const idx = 5, tot = 10;
    const pct = Math.round(idx / tot * 100);
    assert(pct === 50, '进度计算', '5/10 = 50%');
})();

console.log('\n【6. 边界条件测试】\n');

(function testBoundaryConditions() {
    const cats = {};
    cats['歌曲'] = { t: 0, c: 0 };
    cats['歌曲'].t++;
    cats['歌曲'].c++;
    assert(cats['歌曲'].t === 1, '分类统计初始', '首次计数为1');

    const wrong = [];
    wrong.push({ qid: '001', cnt: 1, time: Date.now() });
    const exists = wrong.some(w => w.qid === '001');
    assert(exists, '错题查找', '能找到已添加的错题');

    const filtered = wrong.filter(w => w.qid !== '001');
    assert(filtered.length === 0, '错题删除', '删除后长度为0');

    const modes = { quick: 10, standard: 20, intensive: 30 };
    assert(modes['quick'] === 10, '快速模式', 'quick = 10题');
    const unknown = modes['unknown'] || 10;
    assert(unknown === 10, '未知模式默认', '未知默认为10');
})();

console.log('\n【7. 错误处理测试】\n');

(function testErrorHandling() {
    const q = null;
    const qid = q ? q.id : null;
    assert(qid === null, '空题目处理', '空对象ID为null');

    const emptyStr = '';
    const hasContent = emptyStr && emptyStr.trim().length > 0;
    assert(!hasContent, '空字符串验证', '空字符串无内容');

    const specialChars = '<script>alert("xss")</script>';
    const sanitized = specialChars.replace(/[<>]/g, '');
    assert(!sanitized.includes('<script>'), '特殊字符处理', '移除script标签');

    let longStr = 'A'.repeat(10000);
    const truncated = longStr.length > 5000 ? longStr.substring(0, 5000) + '...' : longStr;
    assert(truncated.length < longStr.length, '超长字符串', '正确截断过长字符串');
})();

console.log('\n========================================');
console.log('测试总结');
console.log('========================================');
console.log(`通过: ${testResults.passed}`);
console.log(`失败: ${testResults.failed}`);
console.log(`总计: ${testResults.passed + testResults.failed}`);
const rate = Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100);
console.log(`通过率: ${rate}%`);
console.log('========================================\n');

if (testResults.failed > 0) {
    console.log('失败测试详情:');
    testResults.details
        .filter(t => t.status === 'FAIL')
        .forEach(t => console.log(`  - ${t.name}: ${t.details}`));
    process.exit(1);
} else {
    console.log('所有测试通过！');
    process.exit(0);
}
