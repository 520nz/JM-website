/**
 * 林俊杰粉丝答题网站 - 核心逻辑单元测试
 * 
 * 测试覆盖重点：
 * - 数据解析逻辑（选项解析）
 * - 数据导入逻辑（JSON解析、数据合并）
 * - 统计计算逻辑（正确率、分类统计）
 * - 错题管理逻辑（计数累加、移除）
 * - 输入验证逻辑（恢复确认）
 */

// ===== 测试框架（轻量级） =====
const TestRunner = {
    passed: 0,
    failed: 0,
    errors: [],
    
    test(name, fn) {
        try {
            fn();
            this.passed++;
            console.log(`✓ ${name}`);
        } catch (e) {
            this.failed++;
            this.errors.push({ name, error: e.message });
            console.log(`✗ ${name}: ${e.message}`);
        }
    },
    
    assertEqual(actual, expected, msg = '') {
        if (actual !== expected) {
            throw new Error(`${msg} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        }
    },
    
    assertDeepEqual(actual, expected, msg = '') {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(`${msg} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        }
    },
    
    assertTrue(condition, msg = '') {
        if (!condition) {
            throw new Error(`${msg} Expected true, got false`);
        }
    },
    
    assertFalse(condition, msg = '') {
        if (condition) {
            throw new Error(`${msg} Expected false, got true`);
        }
    },
    
    assertThrows(fn, msg = '') {
        let threw = false;
        try { fn(); } catch (e) { threw = true; }
        if (!threw) {
            throw new Error(`${msg} Expected function to throw`);
        }
    },
    
    summary() {
        console.log('\n===== 测试结果 =====');
        console.log(`通过: ${this.passed}`);
        console.log(`失败: ${this.failed}`);
        if (this.errors.length > 0) {
            console.log('\n失败详情:');
            this.errors.forEach(e => console.log(`  - ${e.name}: ${e.error}`));
        }
        return this.failed === 0;
    }
};

// ===== 从主文件提取的核心逻辑（用于测试） =====

// 选项解析逻辑（saveQuestion中的关键部分）
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

// shuffle洗牌算法
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

// 统计计算逻辑
function calculateAccuracy(correct, total) {
    return total > 0 ? Math.round(correct / total * 100) : 0;
}

// 错题计数更新逻辑
function updateWrongCount(existingWrong, newWrongItem) {
    var wrongMap = {};
    for (var w = 0; w < existingWrong.length; w++) {
        wrongMap[existingWrong[w].qid] = existingWrong[w];
    }
    if (wrongMap[newWrongItem.qid]) {
        wrongMap[newWrongItem.qid].cnt += newWrongItem.cnt;
    } else {
        existingWrong.push(newWrongItem);
    }
    return existingWrong;
}

// 恢复确认输入验证
function checkResetInputValid(input) {
    return input === '恢复默认';
}

// 数据导入验证逻辑
function validateImportData(data) {
    if (!data) return { valid: false, error: '数据为空' };
    try {
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }
    } catch (err) {
        return { valid: false, error: '文件格式不正确，请确保上传有效的JSON文件' };
    }
    if (!data.questionBank && !data.userData) {
        return { valid: false, error: '文件中未找到有效数据（questionBank 或 userData）' };
    }
    return { valid: true, data: data };
}

// 题目合并逻辑
function mergeQuestionBank(existingBank, newQuestions) {
    var existingIds = {};
    for (var i = 0; i < existingBank.length; i++) {
        existingIds[existingBank[i].id] = true;
    }
    var addedCount = 0;
    var updatedCount = 0;
    for (var j = 0; j < newQuestions.length; j++) {
        var q = newQuestions[j];
        if (existingIds[q.id]) {
            for (var k = 0; k < existingBank.length; k++) {
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

// ===== 测试用例 =====

console.log('\n===== 开始测试 =====\n');

// --- 选项解析测试 ---
console.log('\n【选项解析逻辑测试】');

TestRunner.test('标准格式选项解析', () => {
    const input = 'A.选项一\nB.选项二\nC.选项三\nD.选项四';
    const result = parseOptions(input);
    TestRunner.assertEqual(result.length, 4);
    TestRunner.assertEqual(result[0].key, 'A');
    TestRunner.assertEqual(result[0].text, '选项一');
    TestRunner.assertEqual(result[3].key, 'D');
});

TestRunner.test('中文顿号格式解析', () => {
    const input = 'A、选项一\nB、选项二';
    const result = parseOptions(input);
    TestRunner.assertEqual(result.length, 2);
    TestRunner.assertEqual(result[0].key, 'A');
});

TestRunner.test('全角点号格式解析', () => {
    const input = 'A．选项一\nB．选项二';
    const result = parseOptions(input);
    TestRunner.assertEqual(result.length, 2);
});

TestRunner.test('带空格格式解析', () => {
    const input = 'A. 选项一\nB.  选项二';
    const result = parseOptions(input);
    TestRunner.assertEqual(result.length, 2);
    TestRunner.assertEqual(result[0].text, '选项一');
});

TestRunner.test('空行过滤', () => {
    const input = 'A.选项一\n\nB.选项二\n   \nC.选项三';
    const result = parseOptions(input);
    TestRunner.assertEqual(result.length, 3);
});

TestRunner.test('无效格式过滤', () => {
    const input = 'A选项一\nB.选项二\n无效行\nC.选项三';
    const result = parseOptions(input);
    TestRunner.assertEqual(result.length, 2); // 只有B和C被解析
});

TestRunner.test('选项不足边界', () => {
    const input = 'A.只有一个';
    const result = parseOptions(input);
    TestRunner.assertEqual(result.length, 1);
});

TestRunner.test('空输入处理', () => {
    const result = parseOptions('');
    TestRunner.assertEqual(result.length, 0);
});

TestRunner.test('仅空行输入', () => {
    const result = parseOptions('\n\n\n');
    TestRunner.assertEqual(result.length, 0);
});

// --- shuffle洗牌测试 ---
console.log('\n【洗牌算法测试】');

TestRunner.test('洗牌后长度不变', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle(arr);
    TestRunner.assertEqual(shuffled.length, arr.length);
});

TestRunner.test('洗牌不改变元素', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle(arr);
    const sortedOriginal = arr.slice().sort();
    const sortedShuffled = shuffled.slice().sort();
    TestRunner.assertDeepEqual(sortedShuffled, sortedOriginal);
});

TestRunner.test('洗牌产生新数组', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle(arr);
    TestRunner.assertTrue(arr !== shuffled, '应返回新数组');
});

TestRunner.test('单元素数组洗牌', () => {
    const arr = [1];
    const shuffled = shuffle(arr);
    TestRunner.assertDeepEqual(shuffled, [1]);
});

TestRunner.test('空数组洗牌', () => {
    const shuffled = shuffle([]);
    TestRunner.assertDeepEqual(shuffled, []);
});

// --- 统计计算测试 ---
console.log('\n【统计计算逻辑测试】');

TestRunner.test('正确率计算-正常值', () => {
    TestRunner.assertEqual(calculateAccuracy(8, 10), 80);
});

TestRunner.test('正确率计算-满分', () => {
    TestRunner.assertEqual(calculateAccuracy(10, 10), 100);
});

TestRunner.test('正确率计算-零分', () => {
    TestRunner.assertEqual(calculateAccuracy(0, 10), 0);
});

TestRunner.test('正确率计算-边界值', () => {
    TestRunner.assertEqual(calculateAccuracy(1, 3), 33); // 33.33... -> 33
});

TestRunner.test('正确率计算-总数为零', () => {
    TestRunner.assertEqual(calculateAccuracy(0, 0), 0);
});

TestRunner.test('正确率计算-四舍五入', () => {
    TestRunner.assertEqual(calculateAccuracy(7, 9), 78); // 77.77... -> 78
});

// --- 错题计数更新测试 ---
console.log('\n【错题管理逻辑测试】');

TestRunner.test('新增错题', () => {
    const existing = [];
    const newItem = { qid: 'q001', cnt: 1 };
    const result = updateWrongCount(existing, newItem);
    TestRunner.assertEqual(result.length, 1);
    TestRunner.assertEqual(result[0].qid, 'q001');
    TestRunner.assertEqual(result[0].cnt, 1);
});

TestRunner.test('累加错题计数', () => {
    const existing = [{ qid: 'q001', cnt: 2 }];
    const newItem = { qid: 'q001', cnt: 3 };
    const result = updateWrongCount(existing, newItem);
    TestRunner.assertEqual(result.length, 1);
    TestRunner.assertEqual(result[0].cnt, 5);
});

TestRunner.test('多题目错题管理', () => {
    const existing = [{ qid: 'q001', cnt: 2 }, { qid: 'q002', cnt: 1 }];
    const newItem = { qid: 'q003', cnt: 1 };
    const result = updateWrongCount(existing, newItem);
    TestRunner.assertEqual(result.length, 3);
});

TestRunner.test('错题计数累加不覆盖其他', () => {
    const existing = [{ qid: 'q001', cnt: 2 }, { qid: 'q002', cnt: 5 }];
    const newItem = { qid: 'q001', cnt: 3 };
    const result = updateWrongCount(existing, newItem);
    TestRunner.assertEqual(result.length, 2);
    TestRunner.assertEqual(result[0].cnt, 5);
    TestRunner.assertEqual(result[1].cnt, 5); // q002不受影响
});

// --- 输入验证测试 ---
console.log('\n【输入验证逻辑测试】');

TestRunner.test('恢复确认-正确输入', () => {
    TestRunner.assertTrue(checkResetInputValid('恢复默认'));
});

TestRunner.test('恢复确认-错误输入', () => {
    TestRunner.assertFalse(checkResetInputValid('恢复'));
    TestRunner.assertFalse(checkResetInputValid('默认'));
    TestRunner.assertFalse(checkResetInputValid('恢复默认 '));
});

TestRunner.test('恢复确认-空输入', () => {
    TestRunner.assertFalse(checkResetInputValid(''));
});

TestRunner.test('恢复确认-精确匹配', () => {
    // "恢复默认"本身就是精确匹配，大小写敏感测试应该验证其他变体
    TestRunner.assertTrue(checkResetInputValid('恢复默认'));
    TestRunner.assertFalse(checkResetInputValid('恢复默认 ')); // 带空格
    TestRunner.assertFalse(checkResetInputValid('恢复默认\n')); // 带换行
});

// --- 数据导入验证测试 ---
console.log('\n【数据导入验证测试】');

TestRunner.test('有效JSON数据', () => {
    const data = { questionBank: [{ id: '001', question: 'test' }] };
    const result = validateImportData(data);
    TestRunner.assertTrue(result.valid);
});

TestRunner.test('有效JSON字符串', () => {
    const dataStr = '{"questionBank":[{"id":"001"}]}';
    const result = validateImportData(dataStr);
    TestRunner.assertTrue(result.valid);
});

TestRunner.test('无效JSON字符串', () => {
    const dataStr = 'not a json';
    const result = validateImportData(dataStr);
    TestRunner.assertFalse(result.valid);
    TestRunner.assertTrue(result.error.includes('格式不正确'));
});

TestRunner.test('空数据', () => {
    const result = validateImportData(null);
    TestRunner.assertFalse(result.valid);
});

TestRunner.test('缺少必要字段', () => {
    const data = { otherField: 'value' };
    const result = validateImportData(data);
    TestRunner.assertFalse(result.valid);
    TestRunner.assertTrue(result.error.includes('未找到有效数据'));
});

TestRunner.test('仅userData有效', () => {
    const data = { userData: { history: [] } };
    const result = validateImportData(data);
    TestRunner.assertTrue(result.valid);
});

// --- 题目合并测试 ---
console.log('\n【题目合并逻辑测试】');

TestRunner.test('新增题目', () => {
    const existing = [{ id: '001', question: 'old' }];
    const newQs = [{ id: '002', question: 'new' }];
    const result = mergeQuestionBank(existing, newQs);
    TestRunner.assertEqual(result.bank.length, 2);
    TestRunner.assertEqual(result.added, 1);
    TestRunner.assertEqual(result.updated, 0);
});

TestRunner.test('更新现有题目', () => {
    const existing = [{ id: '001', question: 'old' }];
    const newQs = [{ id: '001', question: 'updated' }];
    const result = mergeQuestionBank(existing, newQs);
    TestRunner.assertEqual(result.bank.length, 1);
    TestRunner.assertEqual(result.bank[0].question, 'updated');
    TestRunner.assertEqual(result.updated, 1);
    TestRunner.assertEqual(result.added, 0);
});

TestRunner.test('混合新增和更新', () => {
    const existing = [{ id: '001', question: 'q1' }, { id: '002', question: 'q2' }];
    const newQs = [{ id: '001', question: 'q1_updated' }, { id: '003', question: 'q3' }];
    const result = mergeQuestionBank(existing, newQs);
    TestRunner.assertEqual(result.bank.length, 3);
    TestRunner.assertEqual(result.added, 1);
    TestRunner.assertEqual(result.updated, 1);
});

TestRunner.test('空题库合并', () => {
    const existing = [];
    const newQs = [{ id: '001', question: 'q1' }];
    const result = mergeQuestionBank(existing, newQs);
    TestRunner.assertEqual(result.bank.length, 1);
    TestRunner.assertEqual(result.added, 1);
});

TestRunner.test('空新题目合并', () => {
    const existing = [{ id: '001', question: 'q1' }];
    const newQs = [];
    const result = mergeQuestionBank(existing, newQs);
    TestRunner.assertEqual(result.bank.length, 1);
    TestRunner.assertEqual(result.added, 0);
    TestRunner.assertEqual(result.updated, 0);
});

// ===== 输出测试结果 =====
const success = TestRunner.summary();

// 导出测试结果供外部使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        TestRunner,
        parseOptions,
        shuffle,
        calculateAccuracy,
        updateWrongCount,
        checkResetInputValid,
        validateImportData,
        mergeQuestionBank,
        success
    };
}