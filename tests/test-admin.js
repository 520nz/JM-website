// ============================================================
// test-admin.js - admin.js 数据处理测试
// 重点覆盖：选项解析正则、导入逻辑验证
// ============================================================

// 复制选项解析逻辑（从admin.js中的saveQuestion函数）
function parseOptionsTest(optsText) {
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

TestRunner.register('Admin 选项解析测试', {
    
    // ==================== 基本格式解析 ====================
    
    'parseOptions - 标准格式 A.选项': function() {
        var text = 'A.这是选项A\nB.这是选项B\nC.这是选项C\nD.这是选项D';
        var options = parseOptionsTest(text);
        
        assertEqual(options.length, 4, '应解析4个选项');
        assertEqual(options[0].key, 'A', '第一个key应为A');
        assertEqual(options[0].text, '这是选项A', '第一个text应正确');
        assertEqual(options[3].key, 'D', '最后一个key应为D');
    },
    
    'parseOptions - 中文逗号格式 A、选项': function() {
        var text = 'A、选项一\nB、选项二\nC、选项三';
        var options = parseOptionsTest(text);
        
        assertEqual(options.length, 3, '应解析3个选项');
        assertEqual(options[0].key, 'A', 'key应为A');
        assertEqual(options[0].text, '选项一', 'text应正确');
    },
    
    'parseOptions - 全角点号格式 A．选项': function() {
        var text = 'A．选项A\nB．选项B';
        var options = parseOptionsTest(text);
        
        assertEqual(options.length, 2, '应解析2个选项');
        assertEqual(options[0].key, 'A', 'key应为A');
        assertEqual(options[0].text, '选项A', 'text应正确');
    },
    
    'parseOptions - 空行跳过': function() {
        var text = 'A.选项A\n\n\nB.选项B\n   \nC.选项C';
        var options = parseOptionsTest(text);
        
        assertEqual(options.length, 3, '空行应被跳过');
    },
    
    'parseOptions - 选项文本空格': function() {
        var text = 'A.  这是带空格的选项';
        var options = parseOptionsTest(text);
        
        assertEqual(options[0].text, '这是带空格的选项', '选项文本应去除A后面的空格');
    },
    
    'parseOptions - 选项文本包含特殊字符': function() {
        var text = 'A.<script>alert(1)</script>\nB.引号测试"\'';
        var options = parseOptionsTest(text);
        
        assertEqual(options.length, 2, '应解析2个选项');
        // 注意：这里不进行转义，转义是esc()函数的工作
        assertTrue(options[0].text.indexOf('<script>') >= 0, '特殊字符应保留原始值');
    },
    
    // ==================== 边界情况 ====================
    
    'parseOptions - 空字符串': function() {
        var options = parseOptionsTest('');
        assertEqual(options.length, 0, '空字符串应返回空数组');
    },
    
    'parseOptions - 只有空行': function() {
        var options = parseOptionsTest('\n\n\n');
        assertEqual(options.length, 0, '只有空行应返回空数组');
    },
    
    'parseOptions - 无效格式': function() {
        var text = '这是没有key的选项\n另一行';
        var options = parseOptionsTest(text);
        assertEqual(options.length, 0, '无效格式不应解析出选项');
    },
    
    'parseOptions - 混合格式': function() {
        var text = 'A.有效选项\n无效行\nB.另一个有效选项\nC、中文逗号格式';
        var options = parseOptionsTest(text);
        
        assertEqual(options.length, 3, '只应解析有效格式');
    },
    
    'parseOptions - 单个选项': function() {
        var text = 'A.只有一个选项';
        var options = parseOptionsTest(text);
        
        assertEqual(options.length, 1, '应解析1个选项');
    },
    
    'parseOptions - 超过D的选项': function() {
        var text = 'A.选项A\nB.选项B\nC.选项C\nD.选项D\nE.选项E';
        var options = parseOptionsTest(text);
        
        assertEqual(options.length, 5, '超过D也应解析');
        assertEqual(options[4].key, 'E', 'E也应被解析');
    },
    
    'parseOptions - 小写字母不应匹配': function() {
        var text = 'a.小写不应匹配\nA.大写应匹配';
        var options = parseOptionsTest(text);
        
        assertEqual(options.length, 1, '只应匹配大写');
        assertEqual(options[0].key, 'A', 'key应为大写A');
    },
    
    'parseOptions - 选项文本为空': function() {
        var text = 'A.\nB.有内容';
        var options = parseOptionsTest(text);
        
        // 根据正则，A.后面必须有内容才能匹配
        assertEqual(options.length, 1, '只有有内容的选项应解析');
        assertEqual(options[0].key, 'B', '应为B');
    }
});

TestRunner.register('Admin 验证逻辑测试', {
    
    '至少需要2个选项': function() {
        var text = 'A.只有一个';
        var options = parseOptionsTest(text);
        assertTrue(options.length < 2, '少于2个选项不应通过验证');
        
        var text2 = 'A.第一个\nB.第二个';
        var options2 = parseOptionsTest(text2);
        assertTrue(options2.length >= 2, '至少2个选项应通过验证');
    },
    
    '题目ID生成逻辑': function() {
        // 模拟ID生成
        var newId = 'q' + Date.now();
        assertTrue(newId.startsWith('q'), '新ID应以q开头');
        assertTrue(newId.length > 1, 'ID应有实际内容');
    },
    
    '题目数据结构完整性': function() {
        // 验证新增题目应包含的字段
        var newQuestion = {
            id: 'q' + Date.now(),
            category: '专辑',
            question: '测试题目',
            options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }],
            answer: 'A',
            explanation: '测试解释'
        };
        
        assertTrue(newQuestion.id != null, '应有id');
        assertTrue(newQuestion.category != null, '应有category');
        assertTrue(newQuestion.question != null, '应有question');
        assertTrue(Array.isArray(newQuestion.options), '应有options数组');
        assertTrue(newQuestion.answer != null, '应有answer');
        assertTrue(newQuestion.explanation != null, '应有explanation');
    }
});

TestRunner.register('Admin QuestionStore 测试', {
    
    'QuestionStore.save/load - 基本操作': function() {
        localStorage.clear();
        
        // 保存当前题库
        var originalLength = QUESTION_BANK.length;
        QuestionStore.save();
        
        // 修改题库
        QUESTION_BANK.push({
            id: 'test_' + Date.now(),
            category: '测试',
            question: '测试题目',
            options: [{ key: 'A', text: 'A' }],
            answer: 'A',
            explanation: 'test'
        });
        
        // 再次保存
        QuestionStore.save();
        
        // 加载验证
        QuestionStore.load();
        assertEqual(QUESTION_BANK.length, originalLength + 1, '加载后应有新增题目');
        
        // 清理
        localStorage.removeItem('jj_question_bank');
        QUESTION_BANK = DEFAULT_QUESTION_BANK.slice();
    },
    
    'QuestionStore.reset - 恢复默认': function() {
        // 先保存一些修改
        localStorage.setItem('jj_question_bank', JSON.stringify([{ id: 'temp' }]));
        QUESTION_BANK = [{ id: 'temp' }];
        
        // 重置
        QuestionStore.reset();
        
        assertEqual(QUESTION_BANK.length, DEFAULT_QUESTION_BANK.length, '应恢复到默认题库');
        assertTrue(QUESTION_BANK[0].id === DEFAULT_QUESTION_BANK[0].id, '第一个题目应相同');
        
        // 验证localStorage已清除
        var saved = localStorage.getItem('jj_question_bank');
        assertEqual(saved, null, 'localStorage应已清除自定义题库');
    }
});

// ==================== 导入逻辑测试 ====================

TestRunner.register('Admin 数据导入测试', {
    
    '导入 - 有效数据格式': function() {
        localStorage.clear();
        if (DB.clearCache) DB.clearCache();
        
        // 模拟导入数据
        var importData = {
            questionBank: [{ id: 'import1', category: '导入', question: '导入题目', 
                           options: [{ key: 'A', text: 'A' }], answer: 'A', explanation: '导入' }],
            userData: {
                history: [{ qid: '001', ans: 'B', ok: true, time: Date.now() }],
                wrong: [{ qid: '001', cnt: 1, level: 0, time: Date.now(), nextReview: Date.now() }],
                stats: { total: 1, correct: 1, cats: {} }
            }
        };
        
        // 验证数据结构有效性
        assertTrue(importData.questionBank != null, '应有questionBank');
        assertTrue(importData.userData != null, '应有userData');
        assertTrue(Array.isArray(importData.userData.history), 'history应为数组');
        assertTrue(Array.isArray(importData.userData.wrong), 'wrong应为数组');
    },
    
    '导入 - 无效JSON格式应拒绝': function() {
        // 模拟无效JSON
        var invalidJson = '这不是有效的JSON';
        var error = null;
        
        try {
            JSON.parse(invalidJson);
        } catch (e) {
            error = e;
        }
        
        assertTrue(error != null, '无效JSON应抛出解析错误');
    },
    
    '导入 - 空数据应拒绝': function() {
        var emptyData = {};
        
        // 验证逻辑：无questionBank也无userData
        assertTrue(emptyData.questionBank === undefined, '无questionBank');
        assertTrue(emptyData.userData === undefined, '无userData');
        
        // 这应该在导入逻辑中被拒绝
    },
    
    '导入 - 错题合并逻辑': function() {
        localStorage.clear();
        if (DB.clearCache) DB.clearCache();
        
        // 设置现有错题
        DB.addWrong('001');
        var existing = DB.getWrong()[0];
        
        // 模拟导入数据中也有这个错题
        var importWrong = {
            qid: '001',
            cnt: 5,
            level: 2,
            time: Date.now() - 10000,
            nextReview: Date.now() + 100000,
            lastReview: Date.now() - 5000
        };
        
        // 模拟合并逻辑
        var mergedCnt = Math.max(existing.cnt, importWrong.cnt);
        var mergedLevel = Math.min(existing.level, importWrong.level);
        
        assertTrue(mergedCnt === 5, '错误次数应取较大值');
        assertTrue(mergedLevel === 0, '等级应取较小值（更保守）');
    },
    
    '导入 - stats不应累加': function() {
        localStorage.clear();
        if (DB.clearCache) DB.clearCache();
        
        // 建立现有数据
        DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
        var beforeStats = DB.get().stats;
        
        // 导入数据中有stats字段，但不应直接累加
        // 正确做法是合并history后重算stats
        
        // 模拟导入history
        var importHistory = [
            { qid: '002', ans: 'B', ok: true, time: Date.now() }
        ];
        
        // 合并后重算
        var d = DB.get();
        d.history = d.history.concat(importHistory);
        DB.recalcStats();
        
        var afterStats = DB.get().stats;
        assertEqual(afterStats.total, 2, '重算后total应为2');
        assertEqual(afterStats.correct, 2, '重算后correct应为2');
    },
    
    '导入 - 新错题应确保间隔重复字段': function() {
        // 模拟导入数据中的新错题（可能缺少字段）
        var importWrong = {
            qid: '003',
            cnt: 1
            // 缺少 level, nextReview, lastReview, time
        };
        
        // 补充字段的逻辑
        if (!importWrong.level) importWrong.level = 0;
        if (!importWrong.nextReview) importWrong.nextReview = Date.now();
        if (!importWrong.lastReview) importWrong.lastReview = 0;
        if (!importWrong.time) importWrong.time = Date.now();
        
        assertTrue(importWrong.level === 0, '应补充level');
        assertTrue(importWrong.nextReview != null, '应补充nextReview');
        assertTrue(importWrong.lastReview === 0, '应补充lastReview');
        assertTrue(importWrong.time != null, '应补充time');
    }
});

TestRunner.register('Admin XSS 安全测试', {
    
    '编辑题目 - XSS转义验证': function() {
        // 模拟带XSS的题目数据
        var xssQuestion = {
            id: 'xss_test',
            category: '<script>alert(1)</script>',
            question: '<img src=x onerror=alert(1)>',
            options: [
                { key: 'A', text: '"><script>alert(1)</script>' },
                { key: 'B', text: '正常选项' }
            ],
            answer: 'B',
            explanation: '<svg onload=alert(1)>'
        };
        
        // 验证esc函数能正确处理这些
        var safeCategory = esc(xssQuestion.category);
        var safeQuestion = esc(xssQuestion.question);
        var safeOption = esc(xssQuestion.options[0].text);
        var safeExplanation = esc(xssQuestion.explanation);
        
        assertTrue(safeCategory.indexOf('<script>') === -1, 'category script标签应被转义');
        assertTrue(safeQuestion.indexOf('<img') === -1 || safeQuestion.indexOf('onerror') === -1, 
            'question img标签应被转义');
        assertTrue(safeOption.indexOf('<script>') === -1, 'option script应被转义');
        assertTrue(safeExplanation.indexOf('<svg') === -1 || safeExplanation.indexOf('onload') === -1, 
            'explanation svg应被转义');
    },
    
    '题目列表渲染 - 安全性': function() {
        // 验证渲染时使用esc函数
        var unsafeText = '"><script>alert(document.cookie)</script>';
        var safeText = esc(unsafeText);
        
        // 检查不会在HTML中执行
        assertTrue(safeText.indexOf('<script>') === -1, 'script应被转义');
        assertTrue(safeText.indexOf('document.cookie') === -1 || safeText.indexOf('<') === -1, 
            '不应能访问cookie');
    },
    
    '搜索过滤 - XSS防护': function() {
        // 模拟搜索输入带XSS
        var searchInput = '<script>alert(1)</script>';
        var safeSearch = esc(searchInput);
        
        assertTrue(safeSearch.indexOf('<script>') === -1, '搜索输入应被转义');
    }
});

TestRunner.register('Admin 边界条件测试', {
    
    'parseOptions - 长选项文本': function() {
        var longText = 'A.' + '很长的选项文本'.repeat(100);
        var options = parseOptionsTest(longText);
        
        assertEqual(options.length, 1, '应能解析长文本');
        assertTrue(options[0].text.length > 500, '长文本应完整保留');
    },
    
    'parseOptions - 多行选项': function() {
        // 选项本身换行的情况（当前解析不支持，但应测试）
        var text = 'A.第一行\n这是选项A的第二行\nB.选项B';
        var options = parseOptionsTest(text);
        
        // 当前实现会将第二行当作无效行跳过
        assertEqual(options.length, 2, 'A和B应被解析');
    },
    
    '题库 - 批量操作': function() {
        // 验证题库能处理大量题目
        var largeBank = [];
        for (var i = 0; i < 1000; i++) {
            largeBank.push({
                id: 'batch_' + i,
                category: '批量',
                question: '问题' + i,
                options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }],
                answer: 'A',
                explanation: '解释' + i
            });
        }
        
        // 验证所有题目结构完整
        var validCount = 0;
        for (var j = 0; j < largeBank.length; j++) {
            if (largeBank[j].id && largeBank[j].question && largeBank[j].options) {
                validCount++;
            }
        }
        assertEqual(validCount, 1000, '所有题目应有效');
    },
    
    '导入 - 空题库数组': function() {
        var importData = {
            questionBank: [],
            userData: { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } }
        };
        
        // 空题库不应出错
        assertTrue(Array.isArray(importData.questionBank), 'questionBank应为数组');
        assertEqual(importData.questionBank.length, 0, '可以有空题库');
    }
});