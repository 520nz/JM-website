const fs = require('fs');
const path = require('path');

const TestRunner = {
    results: [],
    
    assertEqual(actual, expected, message) {
        const pass = actual === expected;
        this.results.push({
            pass,
            message: message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
            error: pass ? null : `期望值: ${JSON.stringify(expected)}, 实际值: ${JSON.stringify(actual)}`
        });
        return pass;
    },

    assertDeepEqual(actual, expected, message) {
        const pass = JSON.stringify(actual) === JSON.stringify(expected);
        this.results.push({
            pass,
            message: message || `Objects are ${pass ? 'equal' : 'not equal'}`,
            error: pass ? null : `期望值: ${JSON.stringify(expected)}, 实际值: ${JSON.stringify(actual)}`
        });
        return pass;
    },

    assertTrue(condition, message) {
        const pass = !!condition;
        this.results.push({
            pass,
            message: message || `Expected true, got ${condition}`,
            error: pass ? null : `期望 true, 实际 ${condition}`
        });
        return pass;
    },

    assertFalse(condition, message) {
        const pass = !condition;
        this.results.push({
            pass,
            message: message || `Expected false, got ${condition}`,
            error: pass ? null : `期望 false, 实际 ${condition}`
        });
        return pass;
    },

    getStats() {
        const passed = this.results.filter(r => r.pass).length;
        const failed = this.results.filter(r => !r.pass).length;
        return { passed, failed, total: this.results.length };
    }
};

function parseOptions(optsText) {
    const lines = optsText.split('\n');
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

function parseOptionsTests() {
    console.log('\n📋 选项解析逻辑测试');
    console.log('─'.repeat(50));
    
    TestRunner.assertDeepEqual(
        parseOptions('A.选项1\nB.选项2\nC.选项3\nD.选项4'),
        [{key:'A',text:'选项1'},{key:'B',text:'选项2'},{key:'C',text:'选项3'},{key:'D',text:'选项4'}],
        '标准点号格式解析'
    );
    
    TestRunner.assertDeepEqual(
        parseOptions('A、选项1\nB、选项2'),
        [{key:'A',text:'选项1'},{key:'B',text:'选项2'}],
        '中文顿号格式解析'
    );
    
    TestRunner.assertDeepEqual(
        parseOptions('A．选项1\nB．选项2'),
        [{key:'A',text:'选项1'},{key:'B',text:'选项2'}],
        '全角点号格式解析'
    );
    
    TestRunner.assertDeepEqual(
        parseOptions('  A.  选项1  \n  B.  选项2  '),
        [{key:'A',text:'选项1'},{key:'B',text:'选项2'}],
        '带空格格式解析'
    );
    
    TestRunner.assertDeepEqual(
        parseOptions('A.选项1\nB.选项2'),
        [{key:'A',text:'选项1'},{key:'B',text:'选项2'}],
        '最少选项验证（2个）'
    );
    
    TestRunner.assertTrue(
        parseOptions('A.选项1').length < 2,
        '单选项应返回失败（少于2个）'
    );
    
    TestRunner.assertDeepEqual(
        parseOptions('E.选项1\nF.选项2'),
        [],
        '非法选项字母（E/F）应被忽略'
    );
    
    TestRunner.assertDeepEqual(
        parseOptions(''),
        [],
        '空字符串解析'
    );
    
    TestRunner.assertDeepEqual(
        parseOptions('  \n  \n  '),
        [],
        '仅空白字符解析'
    );
    
    TestRunner.assertDeepEqual(
        parseOptions('A.选项1\n\nB.选项2\n\n\nC.选项3'),
        [{key:'A',text:'选项1'},{key:'B',text:'选项2'},{key:'C',text:'选项3'}],
        '多行空行解析'
    );
    
    TestRunner.assertDeepEqual(
        parseOptions('A.包含[A]的选项\nB.包含(B)的选项'),
        [{key:'A',text:'包含[A]的选项'},{key:'B',text:'包含(B)的选项'}],
        '选项文本包含括号解析'
    );
    
    TestRunner.assertDeepEqual(
        parseOptions('A.选项1\nB.选项2\nC.\nD.选项4'),
        [{key:'A',text:'选项1'},{key:'B',text:'选项2'},{key:'D',text:'选项4'}],
        '空选项内容被忽略'
    );
}

function validateImportData(data) {
    const errors = [];
    if (!data.questionBank && !data.userData) {
        errors.push('文件中未找到有效数据');
        return { valid: false, errors };
    }
    if (data.questionBank && !Array.isArray(data.questionBank)) {
        errors.push('questionBank必须是数组');
        return { valid: false, errors };
    }
    if (data.questionBank) {
        data.questionBank.forEach((q, i) => {
            if (!q.id) errors.push(`题目${i+1}缺少id`);
            if (!q.question) errors.push(`题目${i+1}缺少question`);
            if (!q.options || !Array.isArray(q.options)) errors.push(`题目${i+1}的options格式错误`);
        });
    }
    return { valid: errors.length === 0, errors };
}

function importDataTests() {
    console.log('\n📥 数据导入逻辑测试');
    console.log('─'.repeat(50));
    
    TestRunner.assertDeepEqual(
        validateImportData({ questionBank: [{ id: '001', question: 'test', options: [] }] }),
        { valid: true, errors: [] },
        '有效数据验证'
    );
    
    TestRunner.assertDeepEqual(
        validateImportData({}),
        { valid: false, errors: ['文件中未找到有效数据'] },
        '空数据验证'
    );
    
    TestRunner.assertDeepEqual(
        validateImportData({ userData: { history: [] } }),
        { valid: true, errors: [] },
        '仅包含userData验证'
    );
    
    TestRunner.assertDeepEqual(
        validateImportData({ questionBank: 'not array' }),
        { valid: false, errors: ['questionBank必须是数组'] },
        'questionBank类型错误验证'
    );
    
    TestRunner.assertDeepEqual(
        validateImportData({ questionBank: [{ id: '001', question: '', options: [] }] }),
        { valid: false, errors: ['题目1缺少question'] },
        '缺少题目内容验证'
    );
    
    TestRunner.assertDeepEqual(
        validateImportData({ questionBank: [{ id: '', question: 'test', options: [] }] }),
        { valid: false, errors: ['题目1缺少id'] },
        '缺少id字段验证'
    );
}

function mergeWrongData(existing, imported) {
    const wrongMap = {};
    for (const w of existing) {
        wrongMap[w.qid] = w;
    }
    const merged = [...existing];
    for (const item of imported) {
        if (wrongMap[item.qid]) {
            wrongMap[item.qid].cnt += item.cnt;
        } else {
            merged.push(item);
        }
    }
    return merged;
}

function wrongBookTests() {
    console.log('\n📝 错题本逻辑测试');
    console.log('─'.repeat(50));
    
    function addWrongItem(wrongList, qid) {
        const existing = wrongList.find(w => w.qid === qid);
        if (existing) {
            existing.cnt++;
            existing.time = Date.now();
        } else {
            wrongList.push({ qid, cnt: 1, time: Date.now() });
        }
        return wrongList;
    }
    
    function removeWrongItem(wrongList, qid) {
        return wrongList.filter(w => w.qid !== qid);
    }
    
    TestRunner.assertTrue(
        addWrongItem([], '001')[0].qid === '001' && 
        addWrongItem([], '001')[0].cnt === 1 &&
        typeof addWrongItem([], '001')[0].time === 'number',
        '首次添加错题（验证字段）'
    );
    
    TestRunner.assertEqual(
        addWrongItem([{ qid: '001', cnt: 1, time: 1000 }], '001')[0].cnt,
        2,
        '重复错题计数递增'
    );
    
    TestRunner.assertDeepEqual(
        removeWrongItem([{ qid: '001', cnt: 2 }, { qid: '002', cnt: 1 }], '001'),
        [{ qid: '002', cnt: 1 }],
        '移除指定错题'
    );
    
    TestRunner.assertDeepEqual(
        removeWrongItem([{ qid: '001', cnt: 1 }], 'nonexistent'),
        [{ qid: '001', cnt: 1 }],
        '移除不存在的错题'
    );
    
    TestRunner.assertTrue(
        mergeWrongData([], [{ qid: '001', cnt: 2 }]).length === 1,
        '空错题列表合并'
    );
    
    TestRunner.assertEqual(
        mergeWrongData([{ qid: '001', cnt: 1 }], [{ qid: '001', cnt: 2 }])[0].cnt,
        3,
        '重复错题计数合并'
    );
}

function shuffleTests() {
    console.log('\n🔀 随机打乱算法测试');
    console.log('─'.repeat(50));
    
    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = a[i];
            a[i] = a[j];
            a[j] = t;
        }
        return a;
    }
    
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    
    TestRunner.assertEqual(
        shuffle([...original]).length,
        original.length,
        '打乱后数组长度不变'
    );
    
    TestRunner.assertDeepEqual(
        [...shuffle([...original])].sort(),
        [...original].sort(),
        '打乱后元素不变'
    );
    
    let differentOrder = false;
    const base = [...original];
    for (let i = 0; i < 20; i++) {
        if (JSON.stringify(shuffle(base)) !== JSON.stringify(base)) {
            differentOrder = true;
            break;
        }
    }
    TestRunner.assertTrue(
        differentOrder,
        '多次打乱应产生不同顺序'
    );
    
    TestRunner.assertTrue(
        shuffle([1]).length === 1,
        '单元素数组打乱'
    );
    
    TestRunner.assertTrue(
        shuffle([]).length === 0,
        '空数组打乱'
    );
}

function formatTime(ms) {
    const sec = Math.floor(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + '分' + s + '秒';
}

function timerTests() {
    console.log('\n⏱️ 计时器逻辑测试');
    console.log('─'.repeat(50));
    
    TestRunner.assertEqual(formatTime(0), '0分0秒', '零时间格式化');
    TestRunner.assertEqual(formatTime(1000), '0分1秒', '1秒格式化');
    TestRunner.assertEqual(formatTime(60000), '1分0秒', '1分钟格式化');
    TestRunner.assertEqual(formatTime(90000), '1分30秒', '1分30秒格式化');
    TestRunner.assertEqual(formatTime(3600000), '60分0秒', '1小时格式化');
    TestRunner.assertEqual(formatTime(3599000), '59分59秒', '接近1小时格式化');
}

function progressTests() {
    console.log('\n📊 进度计算测试');
    console.log('─'.repeat(50));
    
    function calculateProgress(idx, total) {
        return Math.round(idx / total * 100);
    }
    
    TestRunner.assertEqual(calculateProgress(0, 10), 0, '进度0%');
    TestRunner.assertEqual(calculateProgress(5, 10), 50, '进度50%');
    TestRunner.assertEqual(calculateProgress(10, 10), 100, '进度100%');
    TestRunner.assertEqual(calculateProgress(3, 9), 33, '非整除进度计算');
    TestRunner.assertEqual(calculateProgress(1, 3), 33, '三分之一进度');
    TestRunner.assertEqual(calculateProgress(2, 3), 67, '三分之二进度');
}

function validateQuestionTests() {
    console.log('\n🔍 题目验证逻辑测试');
    console.log('─'.repeat(50));
    
    function validateQuestion(question, options) {
        const errors = [];
        if (!question || !question.trim()) {
            errors.push('请填写题目');
        }
        if (!options || options.length < 2) {
            errors.push('请至少输入两个选项');
        }
        return { valid: errors.length === 0, errors };
    }
    
    TestRunner.assertDeepEqual(
        validateQuestion('测试题目', [{key:'A',text:'选项1'},{key:'B',text:'选项2'}]),
        { valid: true, errors: [] },
        '有效题目验证'
    );
    
    TestRunner.assertDeepEqual(
        validateQuestion('', [{key:'A',text:'选项1'},{key:'B',text:'选项2'}]),
        { valid: false, errors: ['请填写题目'] },
        '空题目验证'
    );
    
    TestRunner.assertDeepEqual(
        validateQuestion('   ', [{key:'A',text:'选项1'},{key:'B',text:'选项2'}]),
        { valid: false, errors: ['请填写题目'] },
        '空白题目验证'
    );
    
    TestRunner.assertDeepEqual(
        validateQuestion('测试', [{key:'A',text:'选项1'}]),
        { valid: false, errors: ['请至少输入两个选项'] },
        '单选项验证'
    );
    
    TestRunner.assertDeepEqual(
        validateQuestion('', []),
        { valid: false, errors: ['请填写题目', '请至少输入两个选项'] },
        '空题目和空选项'
    );
}

function exportFormatTests() {
    console.log('\n📤 导出格式测试');
    console.log('─'.repeat(50));
    
    function createExportData(questionBank, userData) {
        return {
            questionBank,
            userData,
            exportTime: new Date().toISOString()
        };
    }
    
    const data = createExportData([{id:'001'}], {stats:{total:10}});
    
    TestRunner.assertTrue(
        typeof data.exportTime === 'string',
        '导出包含时间戳'
    );
    
    TestRunner.assertTrue(
        data.exportTime.includes('T'),
        '时间戳格式正确(ISO)'
    );
    
    TestRunner.assertTrue(
        JSON.parse(JSON.stringify(data)).questionBank.length === 1,
        'JSON序列化后数据完整'
    );
}

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║         林俊杰粉丝答题 - 单元测试                          ║');
console.log('╚══════════════════════════════════════════════════════════╝');

parseOptionsTests();
importDataTests();
wrongBookTests();
shuffleTests();
timerTests();
progressTests();
validateQuestionTests();
exportFormatTests();

const stats = TestRunner.getStats();

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║                      测试结果摘要                          ║');
console.log('╠══════════════════════════════════════════════════════════╣');
console.log(`║  ✅ 通过: ${stats.passed}                                              ║`);
console.log(`║  ❌ 失败: ${stats.failed}                                              ║`);
console.log(`║  📊 总计: ${stats.total}                                              ║`);
console.log('╚══════════════════════════════════════════════════════════╝');

if (stats.failed > 0) {
    console.log('\n❌ 失败测试详情:');
    TestRunner.results.filter(r => !r.pass).forEach(r => {
        console.log(`  - ${r.message}`);
        console.log(`    ${r.error}`);
    });
    process.exit(1);
} else {
    console.log('\n✅ 所有测试通过！');
    process.exit(0);
}
