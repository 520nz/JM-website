#!/usr/bin/env node
/**
 * 林俊杰粉丝答题 - 测试套件（Node.js版本）
 * 验证核心逻辑的正确性
 */

// 从主应用提取的核心逻辑
function parseOptions(optsText) {
    var lines = optsText.split('\n');
    var options = [];
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        var match = line.match(/^([A-D])[.、．]\s*(.+)$/);
        if (match) {
            options.push({ key: match[1], text: match[2] });
        }
    }
    return options;
}

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

// 测试框架
class TestRunner {
    constructor() {
        this.tests = [];
        this.suites = {};
        this.currentSuite = null;
        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            suites: {}
        };
    }
    
    suite(name) {
        this.currentSuite = name;
        if (!this.suites[name]) {
            this.suites[name] = [];
        }
    }
    
    test(name, fn) {
        this.tests.push({
            suite: this.currentSuite,
            name: name,
            fn: fn
        });
        if (this.currentSuite && this.suites[this.currentSuite]) {
            this.suites[this.currentSuite].push({
                name: name,
                fn: fn
            });
        }
    }
    
    assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(message || `Expected ${expected} but got ${actual}`);
        }
    }
    
    assertArrayEqual(actual, expected, message) {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(message || 'Arrays not equal');
        }
    }
    
    assert(condition, message) {
        if (!condition) {
            throw new Error(message || 'Assertion failed');
        }
    }
    
    run() {
        console.log('🧪 开始执行测试...\n');
        
        for (let i = 0; i < this.tests.length; i++) {
            const test = this.tests[i];
            const suiteName = test.suite;
            
            if (!this.results.suites[suiteName]) {
                this.results.suites[suiteName] = {
                    total: 0,
                    passed: 0,
                    failed: 0,
                    tests: []
                };
            }
            
            this.results.suites[suiteName].total++;
            this.results.total++;
            
            const result = {
                name: test.name,
                pass: true,
                error: null
            };
            
            try {
                test.fn();
                this.results.passed++;
                this.results.suites[suiteName].passed++;
                console.log(`  ✓ ${test.name}`);
            } catch (e) {
                this.results.failed++;
                this.results.suites[suiteName].failed++;
                result.pass = false;
                result.error = e.message;
                console.log(`  ✗ ${test.name}`);
                console.log(`    Error: ${e.message}`);
            }
            
            this.results.suites[suiteName].tests.push(result);
        }
        
        return this.results;
    }
    
    render() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 测试结果汇总');
        console.log('='.repeat(60));
        console.log(`总测试数: ${this.results.total}`);
        console.log(`通过: ${this.results.passed} ✓`);
        console.log(`失败: ${this.results.failed} ✗`);
        
        const pct = this.results.total > 0 
            ? Math.round(this.results.passed / this.results.total * 100) 
            : 0;
        console.log(`通过率: ${pct}%`);
        
        console.log('\n' + '='.repeat(60));
        console.log('📋 测试套件详情');
        console.log('='.repeat(60));
        
        const suiteNames = Object.keys(this.results.suites);
        for (let i = 0; i < suiteNames.length; i++) {
            const suiteName = suiteNames[i];
            const suite = this.results.suites[suiteName];
            
            console.log(`\n${suiteName}: ${suite.passed}/${suite.total} 通过`);
            
            for (let j = 0; j < suite.tests.length; j++) {
                const test = suite.tests[j];
                const symbol = test.pass ? '✓' : '✗';
                console.log(`  ${symbol} ${test.name}`);
                if (!test.pass) {
                    console.log(`    Error: ${test.error}`);
                }
            }
        }
        
        console.log('\n' + '='.repeat(60));
        if (pct >= 90) {
            console.log('✅ 测试成功！核心逻辑验证通过');
        } else {
            console.log('⚠️  测试通过率偏低，需要检查失败项');
        }
        console.log('='.repeat(60));
    }
}

// 创建测试实例
const runner = new TestRunner();

// 定义测试

// 1. 选项解析测试
runner.suite('选项解析逻辑');
runner.test('标准格式选项解析', () => {
    const opts = 'A.选项一\nB.选项二\nC.选项三\nD.选项四';
    const result = parseOptions(opts);
    runner.assertEqual(result.length, 4, '应解析出4个选项');
    runner.assertEqual(result[0].key, 'A', '第一个选项key应为A');
    runner.assertEqual(result[0].text, '选项一', '第一个选项text应为"选项一"');
});

runner.test('包含空行的选项解析', () => {
    const opts = 'A.选项一\n\nB.选项二\n   \nC.选项三\nD.选项四';
    const result = parseOptions(opts);
    runner.assertEqual(result.length, 4, '应跳过空行，解析出4个选项');
});

runner.test('中文点号分隔符', () => {
    const opts = 'A．选项一\nB．选项二';
    const result = parseOptions(opts);
    runner.assertEqual(result.length, 2, '应支持中文点号．');
    runner.assertEqual(result[0].text, '选项一', '中文点号解析正确');
});

runner.test('顿号分隔符', () => {
    const opts = 'A、选项一\nB、选项二';
    const result = parseOptions(opts);
    runner.assertEqual(result.length, 2, '应支持顿号、');
});

runner.test('带空格的选项解析', () => {
    const opts = 'A. 选项一\nB.  选项二\nC.选项三';
    const result = parseOptions(opts);
    runner.assertEqual(result.length, 3, '应正确处理各种空格');
    runner.assertEqual(result[0].text, '选项一', '应去除多余空格');
});

runner.test('无选项时返回空数组', () => {
    const opts = '';
    const result = parseOptions(opts);
    runner.assertEqual(result.length, 0, '空字符串应返回空数组');
});

runner.test('无效格式选项被跳过', () => {
    const opts = 'A.有效选项\n无效行\nB.另一个有效';
    const result = parseOptions(opts);
    runner.assertEqual(result.length, 2, '无效格式应被跳过');
});

// 2. shuffle算法测试
runner.suite('随机排序算法');
runner.test('shuffle返回数组副本', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle(arr);
    runner.assert(shuffled !== arr, '应返回新数组而非修改原数组');
});

runner.test('shuffle保持元素数量', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle(arr);
    runner.assertEqual(shuffled.length, arr.length, '元素数量应保持不变');
});

runner.test('shuffle包含所有元素', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle(arr);
    for (let i = 0; i < arr.length; i++) {
        runner.assert(shuffled.indexOf(arr[i]) >= 0, '所有元素应存在');
    }
});

runner.test('shuffle分布均匀性', () => {
    // 多次shuffle测试分布
    const arr = [1, 2, 3];
    const counts = { '1,2,3': 0, '1,3,2': 0, '2,1,3': 0, '2,3,1': 0, '3,1,2': 0, '3,2,1': 0 };
    const trials = 1000;
    
    for (let i = 0; i < trials; i++) {
        const shuffled = shuffle(arr.slice());
        counts[JSON.stringify(shuffled)]++;
    }
    
    // 检查每种排列都有出现（粗略测试）
    const minCount = Math.min(...Object.keys(counts).map(k => counts[k]));
    runner.assert(minCount > 50, '所有排列都应出现，最小次数>50');
});

runner.test('shuffle单元素数组', () => {
    const arr = [42];
    const shuffled = shuffle(arr);
    runner.assertEqual(shuffled[0], 42, '单元素数组保持不变');
});

runner.test('shuffle空数组', () => {
    const arr = [];
    const shuffled = shuffle(arr);
    runner.assertEqual(shuffled.length, 0, '空数组应返回空数组');
});

// 3. 数据导入验证测试
runner.suite('数据导入验证');
runner.test('有效JSON解析', () => {
    const jsonStr = '{"questionBank":[],"userData":{"history":[],"wrong":[]}}';
    let data;
    try {
        data = JSON.parse(jsonStr);
    } catch (e) {
        throw new Error('有效JSON应能正确解析');
    }
    runner.assert(data.questionBank, '应包含questionBank字段');
    runner.assert(data.userData, '应包含userData字段');
});

runner.test('无效JSON解析错误', () => {
    const invalidJson = 'not a json';
    let threw = false;
    try {
        JSON.parse(invalidJson);
    } catch (e) {
        threw = true;
    }
    runner.assert(threw, '无效JSON应抛出错误');
});

runner.test('数据结构验证', () => {
    const data = {
        questionBank: [{id: '001', category: '专辑', question: '测试问题', options: [], answer: 'A', explanation: ''}],
        userData: { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } }
    };
    runner.assert(data.questionBank[0].id, '题目应包含id字段');
    runner.assert(data.userData.hasOwnProperty('history'), 'userData应包含history');
});

runner.test('题目数据完整性', () => {
    const q = {
        id: 'test001',
        category: '专辑',
        question: '测试问题',
        options: [{key: 'A', text: '选项A'}],
        answer: 'A',
        explanation: '解释'
    };
    runner.assertEqual(q.id, 'test001', '应有id');
    runner.assertEqual(q.category, '专辑', '应有category');
    runner.assertEqual(q.question, '测试问题', '应有question');
    runner.assertEqual(q.options.length, 1, '应有options');
    runner.assertEqual(q.answer, 'A', '应有answer');
    runner.assertEqual(q.explanation, '解释', '应有explanation');
});

runner.test('历史记录数据结构', () => {
    const record = {
        qid: '001',
        ans: 'A',
        ok: true,
        time: Date.now()
    };
    runner.assertEqual(record.qid, '001', '应有qid');
    runner.assertEqual(record.ans, 'A', '应有ans');
    runner.assert(record.ok === true || record.ok === false, 'ok应为布尔值');
    runner.assert(typeof record.time === 'number', 'time应为数字');
});

runner.test('错题数据结构', () => {
    const wrong = {
        qid: '002',
        cnt: 3,
        time: Date.now()
    };
    runner.assertEqual(wrong.qid, '002', '应有qid');
    runner.assertEqual(wrong.cnt, 3, '应有cnt计数');
    runner.assert(typeof wrong.time === 'number', 'time应为数字');
});

// 4. 边界条件和异常处理
runner.suite('边界条件和异常处理');
runner.test('题目ID唯一性检查', () => {
    const ids = ['001', '002', '003', '001']; // 有重复
    const unique = {};
    let duplicates = 0;
    for (let i = 0; i < ids.length; i++) {
        if (unique[ids[i]]) {
            duplicates++;
        }
        unique[ids[i]] = true;
    }
    runner.assertEqual(duplicates, 1, '应检测到1个重复ID');
});

runner.test('选项数量不足检测', () => {
    const opts = 'A.只有一个选项';
    const result = parseOptions(opts);
    runner.assertEqual(result.length, 1, '只解析出1个选项');
    runner.assert(result.length < 2, '选项数量不足(小于2)');
});

runner.test('答案不在选项中检测', () => {
    const options = [{key: 'A', text: '选项A'}, {key: 'B', text: '选项B'}];
    const answer = 'C';
    let validAnswer = false;
    for (let i = 0; i < options.length; i++) {
        if (options[i].key === answer) {
            validAnswer = true;
            break;
        }
    }
    runner.assert(!validAnswer, '答案C不在选项中');
});

runner.test('空题目检测', () => {
    const question = '';
    runner.assert(!question.trim(), '应检测到空题目');
});

runner.test('特殊字符题目处理', () => {
    const opts = 'A.选项包含特殊字符!@#$%\nB.正常选项';
    const result = parseOptions(opts);
    runner.assertEqual(result.length, 2, '特殊字符不影响解析');
    runner.assertEqual(result[0].text, '选项包含特殊字符!@#$%', '特殊字符应保留');
});

// 5. 数据统计逻辑测试
runner.suite('统计数据计算');
runner.test('正确率计算', () => {
    const total = 10;
    const correct = 7;
    const pct = Math.round(correct / total * 100);
    runner.assertEqual(pct, 70, '正确率应为70%');
});

runner.test('零答题正确率', () => {
    const total = 0;
    const correct = 0;
    const pct = total > 0 ? Math.round(correct / total * 100) : 0;
    runner.assertEqual(pct, 0, '零答题应显示0%');
});

runner.test('分类统计合并', () => {
    const stats1 = { cats: { '专辑': { t: 10, c: 7 } } };
    const stats2 = { cats: { '专辑': { t: 5, c: 3 } } };
    const merged = { cats: {} };
    
    for (let cat in stats1.cats) {
        merged.cats[cat] = { t: stats1.cats[cat].t, c: stats1.cats[cat].c };
    }
    for (let cat2 in stats2.cats) {
        if (!merged.cats[cat2]) {
            merged.cats[cat2] = { t: 0, c: 0 };
        }
        merged.cats[cat2].t += stats2.cats[cat2].t;
        merged.cats[cat2].c += stats2.cats[cat2].c;
    }
    
    runner.assertEqual(merged.cats['专辑'].t, 15, '总数应合并为15');
    runner.assertEqual(merged.cats['专辑'].c, 10, '正确数应合并为10');
});

runner.test('历史记录时间过滤', () => {
    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const history = [
        { time: todayStart + 1000, ok: true },
        { time: todayStart + 2000, ok: false },
        { time: todayStart - 1000, ok: true } // 昨天
    ];
    
    const todayRecords = history.filter(h => h.time >= todayStart);
    
    runner.assertEqual(todayRecords.length, 2, '应只包含今天的2条记录');
});

// 运行测试
const results = runner.run();
runner.render();

// 返回退出码
process.exit(results.failed > 0 ? 1 : 0);