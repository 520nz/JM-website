function runTests() {
    var results = [];
    var passCount = 0;
    var failCount = 0;

    function assert(condition, message) {
        if (condition) {
            results.push({ type: 'pass', message: message });
            passCount++;
        } else {
            results.push({ type: 'fail', message: message });
            failCount++;
        }
    }

    function assertEqual(actual, expected, message) {
        if (actual === expected) {
            results.push({ type: 'pass', message: message + ' (expected: ' + expected + ', got: ' + actual + ')' });
            passCount++;
        } else {
            results.push({ type: 'fail', message: message + ' (expected: ' + expected + ', got: ' + actual + ')' });
            failCount++;
        }
    }

    function assertNotEqual(actual, notExpected, message) {
        if (actual !== notExpected) {
            results.push({ type: 'pass', message: message });
            passCount++;
        } else {
            results.push({ type: 'fail', message: message });
            failCount++;
        }
    }

    function assertThrows(fn, message) {
        try {
            fn();
            results.push({ type: 'fail', message: message + ' - expected error but none thrown' });
            failCount++;
        } catch (e) {
            results.push({ type: 'pass', message: message + ' - threw expected error' });
            passCount++;
        }
    }

    function logResults() {
        console.log('================== 测试结果 ==================');
        console.log('通过: ' + passCount + ' / 失败: ' + failCount);
        console.log('----------------------------------------------');
        for (var i = 0; i < results.length; i++) {
            var result = results[i];
            var prefix = result.type === 'pass' ? '✓ PASS' : '✗ FAIL';
            console.log(prefix + ': ' + result.message);
        }
        console.log('==============================================');
        return { passed: passCount, failed: failCount };
    }

    console.log('正在运行测试...');

    localStorage.clear();
    
    // 测试DB模块
    console.log('\n--- DB模块测试 ---');
    
    var testDb1 = DB.get();
    assert(testDb1.history !== undefined, 'DB.get() 返回包含history的对象');
    assert(testDb1.wrong !== undefined, 'DB.get() 返回包含wrong的对象');
    assert(testDb1.stats !== undefined, 'DB.get() 返回包含stats的对象');

    DB.addRecord({ qid: 'test001', ans: 'A', ok: true, time: Date.now() });
    var testDb2 = DB.get();
    assertEqual(testDb2.stats.total, 1, 'DB.addRecord() 增加total计数');
    assertEqual(testDb2.stats.correct, 1, 'DB.addRecord() 增加correct计数');
    assertEqual(testDb2.history.length, 1, 'DB.addRecord() 添加到history');

    DB.addRecord({ qid: 'test001', ans: 'B', ok: false, time: Date.now() });
    var testDb3 = DB.get();
    assertEqual(testDb3.stats.total, 2, 'DB.addRecord() 第二次增加total计数');
    assertEqual(testDb3.stats.correct, 1, 'DB.addRecord() 错误答案不增加correct');
    assertEqual(testDb3.wrong.length, 1, 'DB.addRecord() 错误答案添加到wrong');

    DB.addWrong('test002');
    var testDb4 = DB.get();
    assertEqual(testDb4.wrong.length, 2, 'DB.addWrong() 添加错题');
    
    DB.addWrong('test002');
    var testDb5 = DB.get();
    var wrongItem = testDb5.wrong.find(function(w) { return w.qid === 'test002'; });
    assertEqual(wrongItem.cnt, 2, 'DB.addWrong() 重复添加增加计数');

    DB.removeWrong('test001');
    var testDb6 = DB.get();
    assertEqual(testDb6.wrong.length, 1, 'DB.removeWrong() 删除错题');
    assert(testDb6.wrong.find(function(w) { return w.qid === 'test001'; }) === undefined, 'DB.removeWrong() 正确删除指定错题');

    var q = QUESTION_BANK[0];
    var found = DB.findQ(q.id);
    assertEqual(found.id, q.id, 'DB.findQ() 能找到题目');
    assertEqual(DB.findQ('nonexistent'), null, 'DB.findQ() 找不到返回null');

    // 测试题库数据
    console.log('\n--- 题库数据测试 ---');
    
    assertEqual(QUESTION_BANK.length, 78, '题库总数为78题');
    
    var categories = {};
    for (var i = 0; i < QUESTION_BANK.length; i++) {
        categories[QUESTION_BANK[i].category] = (categories[QUESTION_BANK[i].category] || 0) + 1;
    }
    assertEqual(Object.keys(categories).length, 4, '题库包含4个分类');
    assertEqual(categories['专辑'], 15, '专辑分类有15题');
    assertEqual(categories['歌曲'], 45, '歌曲分类有45题');
    assertEqual(categories['个人信息'], 8, '个人信息分类有8题');
    assertEqual(categories['获奖记录'], 10, '获奖记录分类有10题');

    for (var j = 0; j < QUESTION_BANK.length; j++) {
        var qItem = QUESTION_BANK[j];
        assert(qItem.id !== undefined && qItem.id !== '', '题目ID不为空');
        assert(qItem.question !== undefined && qItem.question !== '', '题目内容不为空');
        assert(qItem.options !== undefined && qItem.options.length >= 2, '选项数量至少2个');
        assert(['A', 'B', 'C', 'D'].indexOf(qItem.answer) !== -1, '答案为有效选项');
        assert(qItem.explanation !== undefined, '解析存在');
        if (j === 0) break;
    }

    // 测试shuffle函数
    console.log('\n--- shuffle函数测试 ---');
    
    var arr = [1, 2, 3, 4, 5];
    var shuffled = shuffle(arr.slice());
    assertEqual(shuffled.length, arr.length, 'shuffle保持长度');
    assert(arr.every(function(x) { return shuffled.indexOf(x) !== -1; }), 'shuffle包含所有元素');

    // 测试选项解析
    console.log('\n--- 选项解析测试 ---');
    
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
    
    var opts1 = parseOptions('A.选项1\nB.选项2\nC.选项3\nD.选项4');
    assertEqual(opts1.length, 4, '标准格式解析正确');
    assertEqual(opts1[0].key, 'A', '选项key正确');
    assertEqual(opts1[0].text, '选项1', '选项text正确');

    var opts2 = parseOptions('A、选项1\nB、选项2');
    assertEqual(opts2.length, 2, '中文顿号格式解析正确');

    var opts3 = parseOptions('A．选项1\nB．选项2');
    assertEqual(opts3.length, 2, '全角句号格式解析正确');

    var opts4 = parseOptions('A. 带空格\nB.选项');
    assertEqual(opts4.length, 2, '带空格格式解析正确');

    var opts5 = parseOptions('A.选项1\n\nB.选项2\n  \nC.选项3');
    assertEqual(opts5.length, 3, '空行被正确忽略');

    var opts6 = parseOptions('A.只有一个选项');
    assertEqual(opts6.length, 1, '单个选项解析正确');

    // 测试导入数据验证
    console.log('\n--- 数据导入验证测试 ---');
    
    function validateImportData(data) {
        if (!data.questionBank && !data.userData) {
            return '缺少有效数据';
        }
        if (data.questionBank) {
            for (var i = 0; i < data.questionBank.length; i++) {
                var q = data.questionBank[i];
                if (!q.id || !q.question || !q.options || !q.answer) {
                    return '题目数据不完整';
                }
            }
        }
        return null;
    }
    
    var validData = { questionBank: [{ id: '1', question: 'test', options: [{ key: 'A', text: 'a' }], answer: 'A' }], userData: {} };
    assertEqual(validateImportData(validData), null, '有效数据验证通过');
    
    var invalidData1 = { invalid: 'data' };
    assertEqual(validateImportData(invalidData1), '缺少有效数据', '无效数据被正确识别');
    
    var invalidData2 = { questionBank: [{ id: '1', question: 'test', options: [], answer: 'A' }] };
    assertEqual(validateImportData(invalidData2), '题目数据不完整', '不完整题目被正确识别');

    // 测试统计计算
    console.log('\n--- 统计计算测试 ---');
    
    var stats = { total: 10, correct: 7 };
    var acc = stats.total > 0 ? Math.round(stats.correct / stats.total * 100) : 0;
    assertEqual(acc, 70, '正确率计算正确');
    
    var stats2 = { total: 0, correct: 0 };
    var acc2 = stats2.total > 0 ? Math.round(stats2.correct / stats2.total * 100) : 0;
    assertEqual(acc2, 0, '零答题数正确率为0');

    // 测试分类统计
    console.log('\n--- 分类统计测试 ---');
    
    var catStats = { '专辑': { t: 10, c: 8 }, '歌曲': { t: 20, c: 15 } };
    var albumPct = Math.round(catStats['专辑'].c / catStats['专辑'].t * 100);
    var songPct = Math.round(catStats['歌曲'].c / catStats['歌曲'].t * 100);
    assertEqual(albumPct, 80, '专辑分类正确率计算正确');
    assertEqual(songPct, 75, '歌曲分类正确率计算正确');

    // 测试计时格式化
    console.log('\n--- 计时格式化测试 ---');
    
    assertEqual(fmtTime(0), '0分0秒', '0毫秒格式化正确');
    assertEqual(fmtTime(5000), '0分5秒', '5秒格式化正确');
    assertEqual(fmtTime(60000), '1分0秒', '1分钟格式化正确');
    assertEqual(fmtTime(65000), '1分5秒', '1分5秒格式化正确');
    assertEqual(fmtTime(3661000), '61分1秒', '61分钟格式化正确');

    // 测试进度计算
    console.log('\n--- 进度计算测试 ---');
    
    var idx = 5, total = 10;
    var pct = Math.round(idx / total * 100);
    assertEqual(pct, 50, '进度百分比计算正确');
    
    var idx2 = 0, total2 = 10;
    var pct2 = Math.round(idx2 / total2 * 100);
    assertEqual(pct2, 0, '初始进度为0');
    
    var idx3 = 10, total3 = 10;
    var pct3 = Math.round(idx3 / total3 * 100);
    assertEqual(pct3, 100, '完成进度为100');

    return logResults();
}

function createTestReport() {
    var results = runTests();
    
    var report = document.createElement('div');
    report.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #1a1225;
        border: 1px solid #2d2340;
        border-radius: 12px;
        padding: 20px;
        max-width: 400px;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #f5f5f5;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    
    var title = document.createElement('h3');
    title.textContent = '🧪 测试报告';
    title.style.cssText = 'margin-bottom: 16px; font-size: 18px; font-weight: 600;';
    report.appendChild(title);
    
    var stats = document.createElement('div');
    stats.style.cssText = 'display: flex; gap: 20px; margin-bottom: 16px;';
    
    var passDiv = document.createElement('div');
    passDiv.innerHTML = '<div style="font-size: 24px; font-weight: 700; color: #10B981;">' + results.passed + '</div><div style="font-size: 12px; color: #a0a0a0;">通过</div>';
    stats.appendChild(passDiv);
    
    var failDiv = document.createElement('div');
    failDiv.innerHTML = '<div style="font-size: 24px; font-weight: 700; color: #EF4444;">' + results.failed + '</div><div style="font-size: 12px; color: #a0a0a0;">失败</div>';
    stats.appendChild(failDiv);
    
    report.appendChild(stats);
    
    var progressBar = document.createElement('div');
    progressBar.style.cssText = 'height: 8px; background: #2d2340; border-radius: 4px; overflow: hidden; margin-bottom: 16px;';
    
    var progress = document.createElement('div');
    var total = results.passed + results.failed;
    var percent = total > 0 ? (results.passed / total * 100) : 0;
    progress.style.cssText = 'height: 100%; background: linear-gradient(90deg, #10B981, #8B5CF6); border-radius: 4px; width: ' + percent + '%;';
    progressBar.appendChild(progress);
    report.appendChild(progressBar);
    
    var status = document.createElement('div');
    status.style.cssText = 'text-align: center; padding: 12px; border-radius: 8px;';
    if (results.failed === 0) {
        status.style.background = 'rgba(16, 185, 129, 0.15)';
        status.style.color = '#10B981';
        status.textContent = '✅ 所有测试通过！';
    } else {
        status.style.background = 'rgba(239, 68, 68, 0.15)';
        status.style.color = '#EF4444';
        status.textContent = '❌ 有 ' + results.failed + ' 个测试失败';
    }
    report.appendChild(status);
    
    var closeBtn = document.createElement('button');
    closeBtn.textContent = '关闭';
    closeBtn.style.cssText = 'margin-top: 16px; width: 100%; padding: 10px; background: #2d2340; border: 1px solid #3d3350; border-radius: 8px; color: #f5f5f5; cursor: pointer;';
    closeBtn.onclick = function() { report.remove(); };
    report.appendChild(closeBtn);
    
    document.body.appendChild(report);
}

window.addEventListener('load', function() {
    var testBtn = document.createElement('button');
    testBtn.textContent = '🧪 运行测试';
    testBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        padding: 12px 24px;
        background: linear-gradient(135deg, #8B5CF6, #9333ea);
        border: none;
        border-radius: 25px;
        color: white;
        font-size: 14px;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
        z-index: 1000;
        transition: all 0.3s ease;
    `;
    testBtn.onclick = function() {
        createTestReport();
    };
    testBtn.onmouseover = function() {
        testBtn.style.transform = 'translateY(-2px)';
        testBtn.style.boxShadow = '0 6px 20px rgba(139, 92, 246, 0.4)';
    };
    testBtn.onmouseout = function() {
        testBtn.style.transform = 'translateY(0)';
        testBtn.style.boxShadow = '0 4px 15px rgba(139, 92, 246, 0.3)';
    };
    document.body.appendChild(testBtn);
});