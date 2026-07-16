(function() {
    TestRunner.suite('题目选项解析逻辑');
    
    function parseOptions(optsText) {
        var lines = optsText.split('\n');
        var options = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            var match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
            if (match) {
                options.push({ key: match[1], text: match[2] });
            }
        }
        return options;
    }
    
    var standardOpts = 'A.选项一\nB.选项二\nC.选项三\nD.选项四';
    var parsed = parseOptions(standardOpts);
    TestRunner.assertEqual(parsed.length, 4, '标准格式解析4个选项');
    TestRunner.assertEqual(parsed[0].key, 'A', '第一个选项key为A');
    TestRunner.assertEqual(parsed[0].text, '选项一', '第一个选项text正确');
    TestRunner.assertEqual(parsed[3].key, 'D', '最后一个选项key为D');
    
    var withSpaces = 'A. 带空格的选项\nB. 另一个选项';
    parsed = parseOptions(withSpaces);
    TestRunner.assertEqual(parsed[0].text, '带空格的选项', '自动去除选项前空格');
    
    var chineseDot = 'A．中文句号\nB、中文顿号';
    parsed = parseOptions(chineseDot);
    TestRunner.assertEqual(parsed.length, 2, '支持中文标点');
    
    var mixedOpts = 'A.选项A\nB.选项B\n\nC.选项C';
    parsed = parseOptions(mixedOpts);
    TestRunner.assertEqual(parsed.length, 3, '自动过滤空行');
    
    var emptyOpts = '';
    parsed = parseOptions(emptyOpts);
    TestRunner.assertEqual(parsed.length, 0, '空字符串返回空数组');
    
    var singleOpt = 'A.单个选项';
    parsed = parseOptions(singleOpt);
    TestRunner.assertEqual(parsed.length, 1, '单个选项解析成功');
    
    TestRunner.suite('题目CRUD验证');
    
    var originalLength = App.QUESTION_BANK.length;
    var newQuestion = {
        id: 'test_new_q',
        category: '测试',
        question: '测试题目？',
        options: [{ key: 'A', text: 'A选项' }, { key: 'B', text: 'B选项' }],
        answer: 'A',
        explanation: '测试解释'
    };
    
    App.QUESTION_BANK.push(newQuestion);
    TestRunner.assertEqual(App.QUESTION_BANK.length, originalLength + 1, '新增题目后数量增加');
    
    var found = App.db.findQ('test_new_q');
    TestRunner.assertNotNull(found, '新增题目可被查找');
    TestRunner.assertEqual(found.question, '测试题目？', '题目内容正确');
    
    found.question = '修改后的题目';
    var updated = App.db.findQ('test_new_q');
    TestRunner.assertEqual(updated.question, '修改后的题目', '修改题目成功');
    
    App.QUESTION_BANK = App.QUESTION_BANK.filter(function(q) { return q.id !== 'test_new_q'; });
    TestRunner.assertEqual(App.QUESTION_BANK.length, originalLength, '删除题目后数量恢复');
    
    found = App.db.findQ('test_new_q');
    TestRunner.assertNull(found, '删除后题目不存在');
    
    TestRunner.suite('数据导出结构验证');
    
    var exportData = {
        questionBank: App.QUESTION_BANK,
        userData: App.db.get(),
        exportTime: new Date().toISOString()
    };
    
    TestRunner.assertNotNull(exportData.questionBank, '导出数据包含questionBank');
    TestRunner.assertNotNull(exportData.userData, '导出数据包含userData');
    TestRunner.assertNotNull(exportData.exportTime, '导出数据包含exportTime');
    TestRunner.assertEqual(exportData.questionBank.length, App.QUESTION_BANK.length, '导出的题目数量正确');
    
    TestRunner.suite('数据导入验证');
    
    var importData = {
        questionBank: [{
            id: 'import_q',
            category: '导入测试',
            question: '导入的题目',
            options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }],
            answer: 'A',
            explanation: ''
        }],
        userData: {
            history: [],
            wrong: [],
            stats: { total: 0, correct: 0, cats: {} }
        }
    };
    
    var beforeImport = App.QUESTION_BANK.length;
    var existingIds = {};
    for (var i = 0; i < App.QUESTION_BANK.length; i++) {
        existingIds[App.QUESTION_BANK[i].id] = true;
    }
    
    var addedCount = 0;
    var updatedCount = 0;
    for (var j = 0; j < importData.questionBank.length; j++) {
        var q = importData.questionBank[j];
        if (existingIds[q.id]) {
            for (var k = 0; k < App.QUESTION_BANK.length; k++) {
                if (App.QUESTION_BANK[k].id === q.id) {
                    App.QUESTION_BANK[k] = q;
                    updatedCount++;
                    break;
                }
            }
        } else {
            App.QUESTION_BANK.push(q);
            addedCount++;
        }
    }
    
    TestRunner.assertEqual(addedCount, 1, '新增1道题目');
    TestRunner.assertEqual(updatedCount, 0, '无更新题目');
    TestRunner.assertEqual(App.QUESTION_BANK.length, beforeImport + 1, '题库数量增加');
    
    var importedQ = App.db.findQ('import_q');
    TestRunner.assertNotNull(importedQ, '导入的题目可被查找');
    TestRunner.assertEqual(importedQ.category, '导入测试', '导入的题目分类正确');
    
    App.QUESTION_BANK = App.QUESTION_BANK.filter(function(q) { return q.id !== 'import_q'; });
    TestRunner.assertEqual(App.QUESTION_BANK.length, beforeImport, '清理后恢复原数量');
    
    TestRunner.suite('分类统计验证');
    
    var cats = {};
    for (var c = 0; c < App.QUESTION_BANK.length; c++) {
        var cat = App.QUESTION_BANK[c].category;
        cats[cat] = (cats[cat] || 0) + 1;
    }
    
    TestRunner.assertGreaterThan(Object.keys(cats).length, 0, '分类数量大于0');
    TestRunner.assertNotNull(cats['专辑'], '包含专辑分类');
    TestRunner.assertNotNull(cats['歌曲'], '包含歌曲分类');
    
    TestRunner.suite('搜索过滤验证');
    
    var searchTerm = '江南';
    var filtered = App.QUESTION_BANK.filter(function(q) {
        return q.question.toLowerCase().indexOf(searchTerm.toLowerCase()) !== -1;
    });
    
    TestRunner.assertGreaterThan(filtered.length, 0, '搜索"江南"找到题目');
    
    var noResult = App.QUESTION_BANK.filter(function(q) {
        return q.question.toLowerCase().indexOf('不存在的关键词') !== -1;
    });
    
    TestRunner.assertEqual(noResult.length, 0, '搜索不存在的关键词返回空');
    
})();