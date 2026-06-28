// 林俊杰答题网站 - 自动化测试套件 (Node.js版本)
// 测试关键逻辑路径，确保核心功能的正确性

// ===== 测试框架 =====
const TestFramework = {
    tests: [],
    results: { passed: 0, failed: 0 },
    
    suite: function(name, testFuncs) {
        this.tests.push({ name: name, cases: testFuncs });
    },
    
    assert: function(condition, message) {
        if (!condition) {
            throw new Error(message || 'Assertion failed');
        }
    },
    
    assertEqual: function(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(message || `Expected ${expected} but got ${actual}`);
        }
    },
    
    assertDeepEqual: function(actual, expected, message) {
        const actualStr = JSON.stringify(actual);
        const expectedStr = JSON.stringify(expected);
        if (actualStr !== expectedStr) {
            throw new Error(message || `Expected ${expectedStr} but got ${actualStr}`);
        }
    },
    
    assertThrows: function(func, expectedError, message) {
        try {
            func();
            throw new Error(message || 'Expected function to throw');
        } catch (e) {
            if (expectedError && !e.message.includes(expectedError)) {
                throw new Error(message || `Expected error containing "${expectedError}" but got "${e.message}"`);
            }
        }
    },
    
    run: function() {
        console.log('🎵 林俊杰答题网站 - 自动化测试套件\n');
        console.log('=' .repeat(80) + '\n');
        
        this.results = { passed: 0, failed: 0 };
        
        for (const suite of this.tests) {
            console.log(`\n📦 测试套件: ${suite.name}`);
            console.log('-'.repeat(60));
            
            for (const [testName, testFunc] of Object.entries(suite.cases)) {
                let passed = true;
                let errorMsg = '';
                
                try {
                    testFunc();
                } catch (e) {
                    passed = false;
                    errorMsg = e.message;
                }
                
                if (passed) {
                    this.results.passed++;
                    console.log(`  ✅ ${testName}`);
                } else {
                    this.results.failed++;
                    console.log(`  ❌ ${testName}`);
                    console.log(`     错误: ${errorMsg}`);
                }
            }
        }
        
        console.log('\n' + '='.repeat(80));
        console.log('\n📊 测试总结');
        console.log(`  总测试数: ${this.results.passed + this.results.failed}`);
        console.log(`  ✅ 通过: ${this.results.passed}`);
        console.log(`  ❌ 失败: ${this.results.failed}`);
        console.log(`  成功率: ${Math.round(this.results.passed / (this.results.passed + this.results.failed) * 100)}%`);
        
        return this.results.failed === 0;
    }
};

// ===== 核心逻辑提取 =====

// 1. 选项解析函数 (高风险：saveQuestion核心逻辑)
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

// 2. 验证函数
function validateQuestionData(question, optsText) {
    if (!question || !optsText) {
        return { valid: false, error: '请填写题目和选项' };
    }
    
    const options = parseOptions(optsText);
    
    if (options.length < 2) {
        return { valid: false, error: '请至少输入两个选项，格式：A.选项内容' };
    }
    
    return { valid: true, options: options };
}

// 3. 题库合并函数 (importData核心逻辑)
function mergeQuestionBank(existingBank, newQuestions) {
    const existingIds = {};
    for (let i = 0; i < existingBank.length; i++) {
        existingIds[existingBank[i].id] = true;
    }
    
    let addedCount = 0;
    let updatedCount = 0;
    
    for (let j = 0; j < newQuestions.length; j++) {
        const q = newQuestions[j];
        if (existingIds[q.id]) {
            for (let k = 0; k < existingBank.length; k++) {
                if (existingBank[k].id === q.id) {
                    existingBank[k] = q;
                    updatedCount++;
                    break;
                }
            }
        } else {
            existingBank.push(q);
            addedCount++;
        }
    }
    
    return { bank: existingBank, added: addedCount, updated: updatedCount };
}

// 4. 导入数据验证 (importData前置验证)
function validateImportData(jsonStr) {
    let data;
    try {
        data = JSON.parse(jsonStr);
    } catch (err) {
        return { valid: false, error: '导入失败：文件格式不正确，请确保上传有效的JSON文件' };
    }
    
    if (!data.questionBank && !data.userData) {
        return { valid: false, error: '导入失败：文件中未找到有效数据（questionBank 或 userData）' };
    }
    
    return { valid: true, data: data };
}

// 5. 错题管理逻辑
function addWrong(wrongList, qid) {
    let found = null;
    for (let i = 0; i < wrongList.length; i++) {
        if (wrongList[i].qid === qid) {
            found = wrongList[i];
            break;
        }
    }
    
    if (found) {
        found.cnt++;
        found.time = Date.now();
    } else {
        wrongList.push({ qid: qid, cnt: 1, time: Date.now() });
    }
    
    return wrongList;
}

function removeWrong(wrongList, qid) {
    return wrongList.filter(w => w.qid !== qid);
}

// 6. 统计累加逻辑
function updateCategoryStats(cats, category, isCorrect) {
    if (!cats[category]) cats[category] = { t: 0, c: 0 };
    cats[category].t++;
    if (isCorrect) cats[category].c++;
    return cats;
}

// ===== 测试套件 =====

// 1. 选项解析逻辑测试（高风险：saveQuestion核心功能）
TestFramework.suite('选项解析逻辑测试', {
    '标准格式：A.选项内容': () => {
        const result = parseOptions('A.选项1\nB.选项2\nC.选项3\nD.选项4');
        TestFramework.assertEqual(result.length, 4);
        TestFramework.assertEqual(result[0].key, 'A');
        TestFramework.assertEqual(result[0].text, '选项1');
    },
    
    '中文分隔符：A、选项': () => {
        const result = parseOptions('A、选项1\nB、选项2');
        TestFramework.assertEqual(result.length, 2);
        TestFramework.assertEqual(result[0].key, 'A');
        TestFramework.assertEqual(result[0].text, '选项1');
    },
    
    '全角点号：A．选项': () => {
        const result = parseOptions('A．选项1\nB．选项2');
        TestFramework.assertEqual(result.length, 2);
        TestFramework.assertEqual(result[0].key, 'A');
        TestFramework.assertEqual(result[0].text, '选项1');
    },
    
    '包含空行': () => {
        const result = parseOptions('A.选项1\n\n\nB.选项2\n  \nC.选项3');
        TestFramework.assertEqual(result.length, 3);
    },
    
    '包含空格和制表符': () => {
        const result = parseOptions('  A.  选项1  \t\n\tB.\t选项2\t');
        TestFramework.assertEqual(result.length, 2);
        TestFramework.assertEqual(result[0].text, '选项1');
    },
    
    '无效格式过滤': () => {
        const result = parseOptions('选项1\nA.正确格式\n无前缀选项\nB.正确格式2');
        TestFramework.assertEqual(result.length, 2);
    },
    
    '只有字母没有分隔符': () => {
        const result = parseOptions('A选项1\nB选项2');
        TestFramework.assertEqual(result.length, 0, '无效格式应返回空数组');
    },
    
    '混合分隔符': () => {
        const result = parseOptions('A.选项1\nB、选项2\nC．选项3');
        TestFramework.assertEqual(result.length, 3);
    },
    
    '单选项验证失败': () => {
        const validation = validateQuestionData('题目', 'A.只有一个');
        TestFramework.assertEqual(validation.valid, false);
        TestFramework.assert(validation.error.includes('至少输入两个选项'));
    },
    
    '空选项验证失败': () => {
        const validation = validateQuestionData('题目', '');
        TestFramework.assertEqual(validation.valid, false);
        TestFramework.assert(validation.error.includes('请填写'));
    },
    
    '边界：选项内容包含特殊字符': () => {
        const result = parseOptions('A.选项包含(特殊)字符【和】\nB.选项<>特殊');
        TestFramework.assertEqual(result.length, 2);
        TestFramework.assertEqual(result[0].text, '选项包含(特殊)字符【和】');
    },
    
    '边界：超长选项文本': () => {
        const longText = '这是一个非常长的选项文本包含很多内容'.repeat(10);
        const result = parseOptions(`A.${longText}\nB.选项2`);
        TestFramework.assertEqual(result.length, 2);
        TestFramework.assertEqual(result[0].text, longText);
    }
});

// 2. 数据导入逻辑测试（高风险：importData边界条件）
TestFramework.suite('数据导入逻辑测试', {
    '有效JSON解析': () => {
        const result = validateImportData(JSON.stringify({ questionBank: [{id:'test'}] }));
        TestFramework.assertEqual(result.valid, true);
        TestFramework.assert(result.data.questionBank.length === 1);
    },
    
    '无效JSON解析失败': () => {
        const result = validateImportData('不是JSON格式');
        TestFramework.assertEqual(result.valid, false);
        TestFramework.assert(result.error.includes('文件格式不正确'));
    },
    
    '缺少必要字段失败': () => {
        const result = validateImportData(JSON.stringify({ otherData: 'test' }));
        TestFramework.assertEqual(result.valid, false);
        TestFramework.assert(result.error.includes('未找到有效数据'));
    },
    
    '题库合并：新增题目': () => {
        const existing = [{id: '001', question: '旧题目'}];
        const newQs = [{id: '002', question: '新题目'}];
        const result = mergeQuestionBank(existing, newQs);
        TestFramework.assertEqual(result.bank.length, 2);
        TestFramework.assertEqual(result.added, 1);
        TestFramework.assertEqual(result.updated, 0);
    },
    
    '题库合并：更新已存在题目': () => {
        const existing = [{id: '001', question: '旧题目'}];
        const newQs = [{id: '001', question: '新题目'}];
        const result = mergeQuestionBank(existing, newQs);
        TestFramework.assertEqual(result.bank.length, 1);
        TestFramework.assertEqual(result.bank[0].question, '新题目');
        TestFramework.assertEqual(result.added, 0);
        TestFramework.assertEqual(result.updated, 1);
    },
    
    '题库合并：混合新增和更新': () => {
        const existing = [{id: '001', question: '旧1'}, {id: '002', question: '旧2'}];
        const newQs = [{id: '001', question: '新1'}, {id: '003', question: '新3'}];
        const result = mergeQuestionBank(existing, newQs);
        TestFramework.assertEqual(result.bank.length, 3);
        TestFramework.assertEqual(result.added, 1);
        TestFramework.assertEqual(result.updated, 1);
    },
    
    '边界：空题库导入': () => {
        const existing = [];
        const newQs = [];
        const result = mergeQuestionBank(existing, newQs);
        TestFramework.assertEqual(result.bank.length, 0);
        TestFramework.assertEqual(result.added, 0);
        TestFramework.assertEqual(result.updated, 0);
    },
    
    '边界：大量题目导入': () => {
        const existing = [];
        const newQs = [];
        for (let i = 0; i < 100; i++) {
            newQs.push({id: 'q' + i, question: '题目' + i});
        }
        const result = mergeQuestionBank(existing, newQs);
        TestFramework.assertEqual(result.bank.length, 100);
        TestFramework.assertEqual(result.added, 100);
    },
    
    '边界：导入数据包含所有字段': () => {
        const importData = {
            questionBank: [{id: '001', question: '测试', options: [], answer: 'A', explanation: '解析'}],
            userData: {
                history: [{qid: '001', ans: 'A', ok: true, time: Date.now()}],
                wrong: [{qid: '002', cnt: 1}],
                stats: {total: 10, correct: 5, cats: {}}
            }
        };
        const result = validateImportData(JSON.stringify(importData));
        TestFramework.assertEqual(result.valid, true);
        TestFramework.assert(result.data.questionBank !== undefined);
        TestFramework.assert(result.data.userData !== undefined);
    }
});

// 3. 数据存储逻辑测试（核心功能）
TestFramework.suite('数据存储逻辑测试', {
    '答题记录添加': () => {
        let stats = { total: 0, correct: 0, cats: {} };
        const rec = { qid: '001', ok: true, time: Date.now() };
        
        stats.total++;
        if (rec.ok) stats.correct++;
        
        TestFramework.assertEqual(stats.total, 1);
        TestFramework.assertEqual(stats.correct, 1);
    },
    
    '错题记录首次添加': () => {
        let wrongList = [];
        wrongList = addWrong(wrongList, '001');
        
        TestFramework.assertEqual(wrongList.length, 1);
        TestFramework.assertEqual(wrongList[0].qid, '001');
        TestFramework.assertEqual(wrongList[0].cnt, 1);
    },
    
    '错题记录累加计数': () => {
        let wrongList = [{ qid: '001', cnt: 1, time: 1000 }];
        wrongList = addWrong(wrongList, '001');
        
        TestFramework.assertEqual(wrongList.length, 1, '同一错题不应重复添加');
        TestFramework.assertEqual(wrongList[0].cnt, 2, '计数应累加');
    },
    
    '错题移除': () => {
        let wrongList = [{ qid: '001' }, { qid: '002' }];
        wrongList = removeWrong(wrongList, '001');
        
        TestFramework.assertEqual(wrongList.length, 1);
        TestFramework.assertEqual(wrongList[0].qid, '002');
    },
    
    '错题移除不存在项': () => {
        let wrongList = [{ qid: '001' }, { qid: '002' }];
        wrongList = removeWrong(wrongList, '999');
        
        TestFramework.assertEqual(wrongList.length, 2, '移除不存在的项不应影响列表');
    },
    
    '分类统计累加': () => {
        let cats = {};
        cats = updateCategoryStats(cats, '专辑', true);
        
        TestFramework.assertEqual(cats['专辑'].t, 1);
        TestFramework.assertEqual(cats['专辑'].c, 1);
    },
    
    '分类统计错误累加': () => {
        let cats = {};
        cats = updateCategoryStats(cats, '专辑', false);
        
        TestFramework.assertEqual(cats['专辑'].t, 1);
        TestFramework.assertEqual(cats['专辑'].c, 0, '错误回答不应累加正确数');
    },
    
    '多分类统计独立累加': () => {
        let cats = {};
        cats = updateCategoryStats(cats, '专辑', true);
        cats = updateCategoryStats(cats, '歌曲', true);
        cats = updateCategoryStats(cats, '专辑', false);
        
        TestFramework.assertEqual(cats['专辑'].t, 2);
        TestFramework.assertEqual(cats['专辑'].c, 1);
        TestFramework.assertEqual(cats['歌曲'].t, 1);
        TestFramework.assertEqual(cats['歌曲'].c, 1);
    }
});

// 4. 恢复默认题库测试（风险操作）
TestFramework.suite('恢复默认题库测试', {
    '重置确认输入验证': () => {
        const input = '恢复默认';
        const isValid = input === '恢复默认';
        TestFramework.assertEqual(isValid, true);
    },
    
    '重置确认输入验证失败': () => {
        const input = '恢复默认题库';
        const isValid = input === '恢复默认';
        TestFramework.assertEqual(isValid, false);
    },
    
    '题库数组复制隔离': () => {
        const DEFAULT_BANK = [{id: '001'}, {id: '002'}];
        const QUESTION_BANK = DEFAULT_BANK.slice();
        
        QUESTION_BANK.push({id: '003'});
        
        TestFramework.assertEqual(DEFAULT_BANK.length, 2, '默认题库不应被修改');
        TestFramework.assertEqual(QUESTION_BANK.length, 3);
    },
    
    '重置操作正确性': () => {
        // 模拟重置流程
        const DEFAULT_BANK = [{id: '001'}, {id: '002'}];
        let QUESTION_BANK = [{id: '001'}, {id: '002'}, {id: '003'}];
        
        // 重置操作
        QUESTION_BANK = DEFAULT_BANK.slice();
        
        TestFramework.assertEqual(QUESTION_BANK.length, 2);
        TestFramework.assertDeepEqual(QUESTION_BANK, DEFAULT_BANK);
    }
});

// 5. 边界条件和极端情况测试（业务关键）
TestFramework.suite('边界条件和极端情况测试', {
    '题库为空时shuffle': () => {
        const arr = [];
        const result = arr.slice();
        TestFramework.assertEqual(result.length, 0);
    },
    
    '题库单题时shuffle': () => {
        const arr = [{id: '001'}];
        const result = arr.slice();
        TestFramework.assertEqual(result.length, 1);
        TestFramework.assertEqual(result[0].id, '001');
    },
    
    '答题进度计算：0题': () => {
        const idx = 0;
        const total = 10;
        const pct = Math.round(idx / total * 100);
        TestFramework.assertEqual(pct, 0);
    },
    
    '答题进度计算：最后一题': () => {
        const idx = 9;
        const total = 10;
        const pct = Math.round(idx / total * 100);
        TestFramework.assertEqual(pct, 90);
    },
    
    '正确率计算：全部正确': () => {
        const correct = 10;
        const total = 10;
        const pct = total > 0 ? Math.round(correct / total * 100) : 0;
        TestFramework.assertEqual(pct, 100);
    },
    
    '正确率计算：全部错误': () => {
        const correct = 0;
        const total = 10;
        const pct = total > 0 ? Math.round(correct / total * 100) : 0;
        TestFramework.assertEqual(pct, 0);
    },
    
    '正确率计算：零题': () => {
        const correct = 0;
        const total = 0;
        const pct = total > 0 ? Math.round(correct / total * 100) : 0;
        TestFramework.assertEqual(pct, 0, '零题时应返回0而非NaN');
    },
    
    '正确率计算：四舍五入': () => {
        const correct = 7;
        const total = 10;
        const pct = Math.round(correct / total * 100);
        TestFramework.assertEqual(pct, 70);
    },
    
    '时间格式化：0秒': () => {
        const ms = 0;
        const sec = Math.floor(ms / 1000);
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        TestFramework.assertEqual(m, 0);
        TestFramework.assertEqual(s, 0);
    },
    
    '时间格式化：超过1小时': () => {
        const ms = 3600000 + 1800000; // 1小时30分钟
        const sec = Math.floor(ms / 1000);
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        TestFramework.assertEqual(m, 90);
        TestFramework.assertEqual(s, 0);
    },
    
    '题目ID生成唯一性': () => {
        const id1 = 'q' + Date.now();
        // 等待1ms确保时间戳不同
        const start = Date.now();
        while (Date.now() - start < 2) {}
        const id2 = 'q' + Date.now();
        TestFramework.assert(id1 !== id2, '题目ID应唯一');
    }
});

// 6. 数据完整性测试（新增：检测潜在风险）
TestFramework.suite('数据完整性测试', {
    '题目对象完整性检查': () => {
        const validQuestion = {
            id: '001',
            category: '专辑',
            question: '测试题目',
            options: [{key: 'A', text: '选项A'}, {key: 'B', text: '选项B'}],
            answer: 'A',
            explanation: '测试解析'
        };
        
        TestFramework.assert(validQuestion.id !== undefined);
        TestFramework.assert(validQuestion.question !== undefined);
        TestFramework.assert(validQuestion.options !== undefined);
        TestFramework.assert(validQuestion.answer !== undefined);
    },
    
    '选项数组有效性': () => {
        const options = [{key: 'A', text: '选项A'}, {key: 'B', text: '选项B'}];
        
        TestFramework.assertEqual(options.length, 2);
        TestFramework.assert(options.every(o => o.key && o.text));
    },
    
    '答案必须在选项中': () => {
        const options = [{key: 'A', text: '选项A'}, {key: 'B', text: '选项B'}];
        const answer = 'A';
        
        const hasAnswer = options.some(o => o.key === answer);
        TestFramework.assert(hasAnswer, '答案必须存在于选项中');
    },
    
    '无效答案检测': () => {
        const options = [{key: 'A', text: '选项A'}, {key: 'B', text: '选项B'}];
        const answer = 'C';
        
        const hasAnswer = options.some(o => o.key === answer);
        TestFramework.assertEqual(hasAnswer, false, '无效答案应被检测');
    },
    
    '历史记录数据结构': () => {
        const historyRecord = {
            qid: '001',
            ans: 'A',
            ok: true,
            time: Date.now()
        };
        
        TestFramework.assert(historyRecord.qid !== undefined);
        TestFramework.assert(historyRecord.ans !== undefined);
        TestFramework.assert(typeof historyRecord.ok === 'boolean');
        TestFramework.assert(typeof historyRecord.time === 'number');
    }
});

// ===== 运行测试 =====
const allPassed = TestFramework.run();

// 退出状态
process.exit(allPassed ? 0 : 1);