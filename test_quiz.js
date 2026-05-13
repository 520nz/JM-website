function runTests() {
    var results = [];
    var passed = 0;
    var failed = 0;

    function assert(condition, message) {
        if (condition) {
            passed++;
            results.push({ type: 'PASS', message: message });
        } else {
            failed++;
            results.push({ type: 'FAIL', message: message });
        }
    }

    function assertEqual(actual, expected, message) {
        if (actual === expected) {
            passed++;
            results.push({ type: 'PASS', message: message });
        } else {
            failed++;
            results.push({ type: 'FAIL', message: message + ' (实际: ' + actual + ', 期望: ' + expected + ')' });
        }
    }

    function assertDeepEqual(actual, expected, message) {
        var actualStr = JSON.stringify(actual);
        var expectedStr = JSON.stringify(expected);
        if (actualStr === expectedStr) {
            passed++;
            results.push({ type: 'PASS', message: message });
        } else {
            failed++;
            results.push({ type: 'FAIL', message: message + ' (实际: ' + actualStr + ', 期望: ' + expectedStr + ')' });
        }
    }

    function testDBModule() {
        localStorage.removeItem(DB.KEY);
        
        assertEqual(DB.get(), DB.defaults(), 'DB.get() 返回默认值');
        
        DB.save({ test: 'data' });
        assertDeepEqual(DB.get(), { test: 'data' }, 'DB.save() 和 DB.get() 正常工作');
        
        localStorage.removeItem(DB.KEY);
    }

    function testFindQ() {
        var q = DB.findQ('001');
        assert(q !== null, 'DB.findQ() 能找到存在的题目');
        assertEqual(q.id, '001', '找到的题目ID正确');
        assertEqual(q.category, '专辑', '找到的题目分类正确');
        
        var notFound = DB.findQ('nonexistent');
        assertEqual(notFound, null, 'DB.findQ() 对不存在的ID返回null');
    }

    function testAddRecord() {
        localStorage.removeItem(DB.KEY);
        
        DB.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
        var data = DB.get();
        
        assertEqual(data.history.length, 1, 'addRecord 正确添加记录');
        assertEqual(data.stats.total, 1, '统计总数正确');
        assertEqual(data.stats.correct, 1, '统计正确数正确');
        
        DB.addRecord({ qid: '001', ans: 'B', ok: false, time: Date.now() });
        data = DB.get();
        
        assertEqual(data.history.length, 2, 'addRecord 连续添加记录');
        assertEqual(data.stats.total, 2, '统计总数更新正确');
        assertEqual(data.stats.correct, 1, '统计正确数保持正确');
        
        localStorage.removeItem(DB.KEY);
    }

    function testWrongBook() {
        localStorage.removeItem(DB.KEY);
        
        DB.addWrong('001');
        var wrong = DB.getWrong();
        assertEqual(wrong.length, 1, 'addWrong 添加错题');
        assertEqual(wrong[0].qid, '001', '错题ID正确');
        assertEqual(wrong[0].cnt, 1, '错误次数初始为1');
        
        DB.addWrong('001');
        wrong = DB.getWrong();
        assertEqual(wrong.length, 1, '同一错题重复添加不增加条目');
        assertEqual(wrong[0].cnt, 2, '错误次数递增');
        
        DB.removeWrong('001');
        wrong = DB.getWrong();
        assertEqual(wrong.length, 0, 'removeWrong 删除错题');
        
        localStorage.removeItem(DB.KEY);
    }

    function testShuffle() {
        var arr = [1, 2, 3, 4, 5];
        var shuffled = shuffle(arr.slice());
        
        assertEqual(shuffled.length, arr.length, 'shuffle 保持数组长度');
        
        var sorted = shuffled.slice().sort((a, b) => a - b);
        assertDeepEqual(sorted, arr, 'shuffle 保持元素不变');
        
        var isShuffled = JSON.stringify(shuffled) !== JSON.stringify(arr);
        assert(isShuffled || arr.length <= 1, 'shuffle 确实打乱了数组顺序');
    }

    function testQuestionValidation() {
        var originalLength = QUESTION_BANK.length;
        var backupBank = QUESTION_BANK.slice();
        
        try {
            var q = {
                id: 'test001',
                category: '测试',
                question: '测试题目',
                options: [
                    { key: 'A', text: '选项A' },
                    { key: 'B', text: '选项B' },
                    { key: 'C', text: '选项C' },
                    { key: 'D', text: '选项D' }
                ],
                answer: 'A',
                explanation: '测试解析'
            };
            
            QUESTION_BANK.push(q);
            assertEqual(QUESTION_BANK.length, originalLength + 1, '题目添加成功');
            
            var found = DB.findQ('test001');
            assertDeepEqual(found, q, '新增题目可被查询');
        } finally {
            QUESTION_BANK.length = 0;
            QUESTION_BANK.push(...backupBank);
        }
    }

    function testAnswerValidation() {
        var q = DB.findQ('001');
        assert(q !== null, '获取测试题目');
        
        var correctAnswer = q.answer;
        var wrongAnswer = correctAnswer === 'A' ? 'B' : 'A';
        
        assert(correctAnswer !== wrongAnswer, '正确答案与错误答案不同');
        assert(['A', 'B', 'C', 'D'].includes(correctAnswer), '答案在有效范围内');
    }

    function testCategoryStats() {
        localStorage.removeItem(DB.KEY);
        
        DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
        DB.addRecord({ qid: '002', ans: 'A', ok: false, time: Date.now() });
        
        var data = DB.get();
        
        assert(data.stats.cats['专辑'] !== undefined, '分类统计存在');
        assertEqual(data.stats.cats['专辑'].t, 2, '分类总答题数正确');
        assertEqual(data.stats.cats['专辑'].c, 1, '分类正确数正确');
        
        localStorage.removeItem(DB.KEY);
    }

    testDBModule();
    testFindQ();
    testAddRecord();
    testWrongBook();
    testShuffle();
    testQuestionValidation();
    testAnswerValidation();
    testCategoryStats();

    var html = '<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">';
    html += '<h1>🎵 林俊杰答题网站测试报告</h1>';
    html += '<div style="margin-bottom: 20px; padding: 10px; background: #f5f5f5; border-radius: 8px;">';
    html += '<strong>测试结果：</strong> ' + passed + ' 通过，' + failed + ' 失败';
    html += '</div>';
    html += '<ul style="list-style: none; padding: 0;">';
    
    for (var i = 0; i < results.length; i++) {
        var style = results[i].type === 'PASS' 
            ? 'color: #10B981; background: rgba(16, 185, 129, 0.1);' 
            : 'color: #EF4444; background: rgba(239, 68, 68, 0.1);';
        html += '<li style="padding: 8px 12px; margin-bottom: 4px; border-radius: 4px; ' + style + '">';
        html += results[i].type + ': ' + results[i].message;
        html += '</li>';
    }
    
    html += '</ul></div>';
    
    var newWindow = window.open('', '_blank');
    newWindow.document.write(html);
    newWindow.document.close();

    console.log('测试完成: ' + passed + ' 通过, ' + failed + ' 失败');
    return { passed: passed, failed: failed, total: passed + failed };
}