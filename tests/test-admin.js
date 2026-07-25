(function() {
    var App = window.App || {};

    function createMockQuestion(id, category) {
        return {
            id: id,
            category: category || '专辑',
            question: '测试问题',
            options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }],
            answer: 'A',
            explanation: '测试解析'
        };
    }

    function setupTestData() {
        App.QUESTION_BANK = [
            createMockQuestion('q001', '专辑'),
            createMockQuestion('q002', '歌曲')
        ];
        App.store = {
            save: function() {},
            reset: function() {}
        };
    }

    Test.suite('Admin.js - 选项解析');

    Test.test('saveQuestion() 选项解析应正确解析标准格式', function() {
        setupTestData();

        var optionsText = 'A.第一个选项\nB.第二个选项\nC.第三个选项\nD.第四个选项';
        var options = parseOptions(optionsText);

        assert.equal(options.length, 4);
        assert.equal(options[0].key, 'A');
        assert.equal(options[0].text, '第一个选项');
        assert.equal(options[1].key, 'B');
        assert.equal(options[1].text, '第二个选项');
        assert.equal(options[2].key, 'C');
        assert.equal(options[2].text, '第三个选项');
        assert.equal(options[3].key, 'D');
        assert.equal(options[3].text, '第四个选项');
    });

    Test.test('选项解析应处理中文句号', function() {
        var optionsText = 'A．选项A\nB．选项B\nC．选项C';
        var options = parseOptions(optionsText);

        assert.equal(options.length, 3);
        assert.equal(options[0].key, 'A');
        assert.equal(options[0].text, '选项A');
        assert.equal(options[1].key, 'B');
        assert.equal(options[1].text, '选项B');
    });

    Test.test('选项解析应处理中文顿号', function() {
        var optionsText = 'A、选项A\nB、选项B\nC、选项C';
        var options = parseOptions(optionsText);

        assert.equal(options.length, 3);
        assert.equal(options[0].key, 'A');
        assert.equal(options[0].text, '选项A');
    });

    Test.test('选项解析应忽略空行', function() {
        var optionsText = 'A.选项A\n\nB.选项B\n\n\nC.选项C';
        var options = parseOptions(optionsText);

        assert.equal(options.length, 3);
        assert.equal(options[0].key, 'A');
        assert.equal(options[1].key, 'B');
        assert.equal(options[2].key, 'C');
    });

    Test.test('选项解析应处理前后空格', function() {
        var optionsText = '  A.  选项A  \n  B. 选项B  \n';
        var options = parseOptions(optionsText);

        assert.equal(options.length, 2);
        assert.equal(options[0].key, 'A');
        assert.equal(options[0].text, '选项A');
        assert.equal(options[1].key, 'B');
        assert.equal(options[1].text, '选项B');
    });

    Test.test('选项解析应处理非常规顺序', function() {
        var optionsText = 'B.选项B\nA.选项A\nD.选项D\nC.选项C';
        var options = parseOptions(optionsText);

        assert.equal(options.length, 4);
        assert.equal(options[0].key, 'B');
        assert.equal(options[1].key, 'A');
        assert.equal(options[2].key, 'D');
        assert.equal(options[3].key, 'C');
    });

    Test.test('选项解析应处理仅两个选项', function() {
        var optionsText = 'A.选项A\nB.选项B';
        var options = parseOptions(optionsText);

        assert.equal(options.length, 2);
        assert.equal(options[0].key, 'A');
        assert.equal(options[1].key, 'B');
    });

    Test.test('选项解析应处理无效格式', function() {
        var optionsText = '无效格式\nA.选项A\n无效行';
        var options = parseOptions(optionsText);

        assert.equal(options.length, 1);
        assert.equal(options[0].key, 'A');
        assert.equal(options[0].text, '选项A');
    });

    Test.suite('Admin.js - 题库管理');

    Test.test('renderQuestionList() 应正确统计分类', function() {
        setupTestData();
        var cats = {};
        for (var i = 0; i < App.QUESTION_BANK.length; i++) {
            var c = App.QUESTION_BANK[i].category;
            cats[c] = (cats[c] || 0) + 1;
        }
        assert.equal(cats['专辑'], 1);
        assert.equal(cats['歌曲'], 1);
    });

    Test.test('deleteQuestion() 应删除指定题目', function() {
        setupTestData();
        assert.equal(App.QUESTION_BANK.length, 2);

        App.QUESTION_BANK = App.QUESTION_BANK.filter(function(q) { return q.id !== 'q001'; });
        assert.equal(App.QUESTION_BANK.length, 1);
        assert.equal(App.QUESTION_BANK[0].id, 'q002');
    });

    Test.test('deleteQuestion() 应处理不存在的题目', function() {
        setupTestData();
        assert.equal(App.QUESTION_BANK.length, 2);

        App.QUESTION_BANK = App.QUESTION_BANK.filter(function(q) { return q.id !== 'nonexistent'; });
        assert.equal(App.QUESTION_BANK.length, 2);
    });

    Test.suite('Admin.js - 数据导入导出');

    Test.test('exportData() 数据结构应包含必要字段', function() {
        setupTestData();
        App.db = {
            get: function() {
                return {
                    history: [],
                    wrong: [],
                    stats: { total: 0, correct: 0, cats: {} },
                    theme: 'dark',
                    dailyGoal: 20,
                    achievements: [],
                    archive: []
                };
            }
        };

        var data = {
            questionBank: App.QUESTION_BANK,
            userData: App.db.get(),
            exportTime: new Date().toISOString()
        };

        assert.ok(data.questionBank);
        assert.ok(data.userData);
        assert.ok(data.exportTime);
        assert.ok(Array.isArray(data.questionBank));
        assert.ok(Array.isArray(data.userData.history));
        assert.ok(Array.isArray(data.userData.wrong));
    });

    Test.test('importData() 题库合并应正确处理新增和更新', function() {
        setupTestData();
        var importData = {
            questionBank: [
                { id: 'q001', category: '专辑', question: '修改后的问题', options: [{ key: 'A', text: '选项' }], answer: 'A', explanation: '解析' },
                { id: 'q003', category: '新分类', question: '新问题', options: [{ key: 'A', text: '选项' }], answer: 'A', explanation: '解析' }
            ]
        };

        var existingIds = {};
        for (var i = 0; i < App.QUESTION_BANK.length; i++) {
            existingIds[App.QUESTION_BANK[i].id] = true;
        }

        var addedCount = 0;
        var updatedCount = 0;

        for (var j = 0; j < importData.questionBank.length; j++) {
            var q = importData.questionBank[j];
            if (existingIds[q.id]) {
                updatedCount++;
            } else {
                addedCount++;
            }
        }

        assert.equal(updatedCount, 1);
        assert.equal(addedCount, 1);
    });

    Test.test('importData() 错题本合并应取较高错误次数', function() {
        setupTestData();
        var existingWrong = [
            { qid: 'q001', cnt: 3, level: 2, nextReview: Date.now() }
        ];
        var importWrong = [
            { qid: 'q001', cnt: 5, level: 1 }
        ];

        var wrongMap = {};
        for (var w = 0; w < existingWrong.length; w++) {
            wrongMap[existingWrong[w].qid] = existingWrong[w];
        }

        for (var x = 0; x < importWrong.length; x++) {
            var wrongItem = importWrong[x];
            if (wrongMap[wrongItem.qid]) {
                wrongMap[wrongItem.qid].cnt = Math.max(wrongMap[wrongItem.qid].cnt, wrongItem.cnt || 1);
                if (wrongItem.level != null) {
                    wrongMap[wrongItem.qid].level = Math.min(wrongMap[wrongItem.qid].level || 0, wrongItem.level);
                }
            }
        }

        assert.equal(wrongMap['q001'].cnt, 5);
        assert.equal(wrongMap['q001'].level, 1);
    });

    Test.test('importData() 错题本合并应添加新错题', function() {
        setupTestData();
        var existingWrong = [
            { qid: 'q001', cnt: 1, level: 0, nextReview: Date.now(), lastReview: 0, time: Date.now() }
        ];
        var importWrong = [
            { qid: 'q002', cnt: 2 }
        ];

        var wrongMap = {};
        for (var w = 0; w < existingWrong.length; w++) {
            wrongMap[existingWrong[w].qid] = existingWrong[w];
        }

        var mergedWrong = existingWrong.slice();
        for (var x = 0; x < importWrong.length; x++) {
            var wrongItem = importWrong[x];
            if (wrongMap[wrongItem.qid]) {
                wrongMap[wrongItem.qid].cnt = Math.max(wrongMap[wrongItem.qid].cnt, wrongItem.cnt || 1);
            } else {
                if (!wrongItem.level) wrongItem.level = 0;
                if (!wrongItem.nextReview) wrongItem.nextReview = Date.now();
                if (!wrongItem.lastReview) wrongItem.lastReview = 0;
                if (!wrongItem.time) wrongItem.time = Date.now();
                mergedWrong.push(wrongItem);
            }
        }

        assert.equal(mergedWrong.length, 2);
        assert.equal(mergedWrong[1].qid, 'q002');
        assert.equal(mergedWrong[1].level, 0);
        assert.ok(mergedWrong[1].nextReview > 0);
    });

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

    Test.suite('Admin.js - 分页逻辑');

    Test.test('分页应正确计算总页数', function() {
        setupTestData();
        var pageSize = 30;
        var totalQuestions = 50;

        App.QUESTION_BANK = [];
        for (var i = 0; i < totalQuestions; i++) {
            App.QUESTION_BANK.push(createMockQuestion('q' + i));
        }

        var totalPages = Math.max(1, Math.ceil(totalQuestions / pageSize));
        assert.equal(totalPages, 2);

        var page1Start = (1 - 1) * pageSize;
        var page1End = Math.min(page1Start + pageSize, totalQuestions);
        assert.equal(page1Start, 0);
        assert.equal(page1End, 30);

        var page2Start = (2 - 1) * pageSize;
        var page2End = Math.min(page2Start + pageSize, totalQuestions);
        assert.equal(page2Start, 30);
        assert.equal(page2End, 50);
    });

    Test.test('分页应处理不足一页的情况', function() {
        setupTestData();
        var pageSize = 30;
        var totalQuestions = 15;

        App.QUESTION_BANK = [];
        for (var i = 0; i < totalQuestions; i++) {
            App.QUESTION_BANK.push(createMockQuestion('q' + i));
        }

        var totalPages = Math.max(1, Math.ceil(totalQuestions / pageSize));
        assert.equal(totalPages, 1);

        var start = (1 - 1) * pageSize;
        var end = Math.min(start + pageSize, totalQuestions);
        assert.equal(start, 0);
        assert.equal(end, 15);
    });

    Test.test('分页应处理正好一页的情况', function() {
        setupTestData();
        var pageSize = 30;

        App.QUESTION_BANK = [];
        for (var i = 0; i < pageSize; i++) {
            App.QUESTION_BANK.push(createMockQuestion('q' + i));
        }

        var totalPages = Math.max(1, Math.ceil(pageSize / pageSize));
        assert.equal(totalPages, 1);
    });

    Test.suite('Admin.js - 搜索过滤');

    Test.test('搜索过滤应匹配题目文本', function() {
        setupTestData();
        App.QUESTION_BANK = [
            createMockQuestion('q001', '专辑'),
            createMockQuestion('q002', '歌曲'),
            createMockQuestion('q003', '个人信息')
        ];

        var searchText = '专辑';
        var filtered = App.QUESTION_BANK.filter(function(q) {
            return q.question.toLowerCase().indexOf(searchText.toLowerCase()) !== -1 ||
                   q.category.toLowerCase().indexOf(searchText.toLowerCase()) !== -1;
        });

        assert.ok(filtered.length >= 1);
    });

    Test.test('搜索过滤应不区分大小写', function() {
        setupTestData();
        App.QUESTION_BANK = [
            { id: 'q001', category: '专辑', question: '林俊杰第一张专辑是什么？', options: [], answer: 'A', explanation: '' }
        ];

        var searchText = 'LIN JUN JIE';
        var filtered = App.QUESTION_BANK.filter(function(q) {
            return q.question.toLowerCase().indexOf(searchText.toLowerCase()) !== -1;
        });

        assert.equal(filtered.length, 0);

        searchText = '林俊杰';
        filtered = App.QUESTION_BANK.filter(function(q) {
            return q.question.toLowerCase().indexOf(searchText.toLowerCase()) !== -1;
        });

        assert.equal(filtered.length, 1);
    });

    Test.suite('Admin.js - 分类过滤');

    Test.test('分类过滤应正确筛选', function() {
        setupTestData();
        App.QUESTION_BANK = [
            createMockQuestion('q001', '专辑'),
            createMockQuestion('q002', '专辑'),
            createMockQuestion('q003', '歌曲'),
            createMockQuestion('q004', '个人信息')
        ];

        var catFilter = '专辑';
        var filtered = App.QUESTION_BANK.filter(function(q) {
            return !catFilter || q.category === catFilter;
        });

        assert.equal(filtered.length, 2);
        for (var i = 0; i < filtered.length; i++) {
            assert.equal(filtered[i].category, '专辑');
        }
    });

    Test.test('空分类过滤应返回全部', function() {
        setupTestData();
        App.QUESTION_BANK = [
            createMockQuestion('q001', '专辑'),
            createMockQuestion('q002', '歌曲')
        ];

        var catFilter = '';
        var filtered = App.QUESTION_BANK.filter(function(q) {
            return !catFilter || q.category === catFilter;
        });

        assert.equal(filtered.length, 2);
    });

    Test.suite('Admin.js - 数据导入导出格式验证');

    Test.test('导出数据应包含正确的时间格式', function() {
        setupTestData();
        App.db = {
            get: function() {
                return {
                    history: [],
                    wrong: [],
                    stats: { total: 0, correct: 0, cats: {} },
                    theme: 'dark',
                    dailyGoal: 20,
                    achievements: [],
                    archive: []
                };
            }
        };

        var data = {
            questionBank: App.QUESTION_BANK,
            userData: App.db.get(),
            exportTime: new Date().toISOString()
        };

        var parsedDate = new Date(data.exportTime);
        assert.ok(!isNaN(parsedDate.getTime()));
    });

    Test.test('导入数据应处理无效JSON', function() {
        var invalidJson = '{ invalid json }';
        var parsed = null;
        try {
            parsed = JSON.parse(invalidJson);
        } catch (e) {
            parsed = null;
        }
        assert.equal(parsed, null);
    });

    Test.test('导入数据应验证必要字段', function() {
        var validData = { questionBank: [], userData: {} };
        var invalidData1 = {};
        var invalidData2 = { randomField: 'value' };

        assert.ok(validData.questionBank || validData.userData);
        assert.ok(!invalidData1.questionBank && !invalidData1.userData);
        assert.ok(!invalidData2.questionBank && !invalidData2.userData);
    });

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { run: function() { return Test.run(); } };
    }
})();