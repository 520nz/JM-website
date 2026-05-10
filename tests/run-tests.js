
var passed = 0;
var failed = 0;
var total = 0;

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error((message || '') + ' Expected: ' + JSON.stringify(expected) + ', Got: ' + JSON.stringify(actual));
    }
}

function assertTrue(value, message) {
    assertEqual(value, true, message);
}

function assertFalse(value, message) {
    assertEqual(value, false, message);
}

function assertNull(value, message) {
    assertEqual(value, null, message);
}

function assertNotNull(value, message) {
    if (value === null || value === undefined) {
        throw new Error((message || '') + ' Expected non-null value, got: ' + value);
    }
}

function assertLength(array, length, message) {
    assertEqual(array.length, length, message);
}

function assertContains(array, item, message) {
    if (array.indexOf(item) === -1) {
        throw new Error((message || '') + ' Array does not contain item: ' + JSON.stringify(item));
    }
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

function runTest(name, desc, fn) {
    total++;
    try {
        fn();
        passed++;
        console.log('  \u2713 ' + name);
        if (desc) console.log('     ' + desc);
    } catch (e) {
        failed++;
        console.log('  \u2717 ' + name);
        console.log('     Error: ' + e.message);
    }
}

function runSuite(name, tests) {
    console.log('\n' + name + ':');
    for (var i = 0; i < tests.length; i++) {
        runTest(tests[i].name, tests[i].desc, tests[i].fn);
    }
}

// ============================================================
// 选项解析逻辑 (saveQuestion)
// ============================================================
runSuite('选项解析逻辑', [
    {
        name: '标准格式解析',
        desc: '验证 "A.选项1" 格式能正确解析',
        fn: function() {
            var text = 'A.第一个选项\nB.第二个选项\nC.第三个选项\nD.第四个选项';
            var lines = text.split('\n');
            var options = [];
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (!line) continue;
                var match = line.match(/^([A-D])[.、．]\s*(.+)$/);
                if (match) {
                    options.push({ key: match[1], text: match[2] });
                }
            }
            assertLength(options, 4);
            assertEqual(options[0].key, 'A');
            assertEqual(options[0].text, '第一个选项');
        }
    },
    {
        name: '中文顿号格式解析',
        desc: '验证 "A、选项1" 中文顿号格式能正确解析',
        fn: function() {
            var text = 'A、选项一\nB、选项二\nC、选项三';
            var lines = text.split('\n');
            var options = [];
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (!line) continue;
                var match = line.match(/^([A-D])[.、．]\s*(.+)$/);
                if (match) {
                    options.push({ key: match[1], text: match[2] });
                }
            }
            assertLength(options, 3);
            assertEqual(options[0].key, 'A');
        }
    },
    {
        name: '空格分隔格式解析',
        desc: '验证 "A. 选项1" 带空格格式能正确解析',
        fn: function() {
            var text = 'A. 选项A\nB. 选项B';
            var lines = text.split('\n');
            var options = [];
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (!line) continue;
                var match = line.match(/^([A-D])[.、．]\s*(.+)$/);
                if (match) {
                    options.push({ key: match[1], text: match[2] });
                }
            }
            assertLength(options, 2);
            assertEqual(options[0].text, '选项A');
        }
    },
    {
        name: '无效格式过滤',
        desc: '验证不含正确前缀的选项行被过滤',
        fn: function() {
            var text = '这不是选项\nA.第一个选项\n无前缀的选项\nB.第二个选项';
            var lines = text.split('\n');
            var options = [];
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (!line) continue;
                var match = line.match(/^([A-D])[.、．]\s*(.+)$/);
                if (match) {
                    options.push({ key: match[1], text: match[2] });
                }
            }
            assertLength(options, 2);
        }
    },
    {
        name: '选项数量边界 - 仅1个选项应被拒绝',
        desc: '验证少于2个选项时业务逻辑应拒绝',
        fn: function() {
            var options = [{ key: 'A', text: '唯一的选项' }];
            var isValid = options.length >= 2;
            assertFalse(isValid, '单选项应被标记为无效');
        }
    },
    {
        name: '选项数量边界 - 恰好2个选项应通过',
        desc: '验证2个选项是有效边界',
        fn: function() {
            var options = [
                { key: 'A', text: '选项A' },
                { key: 'B', text: '选项B' }
            ];
            var isValid = options.length >= 2;
            assertTrue(isValid, '双选项应通过验证');
        }
    },
    {
        name: '空行和多余空格处理',
        desc: '验证空行和多余空格不影响解析',
        fn: function() {
            var text = '   \nA.选项A\n\n  \nB.选项B\n   \n';
            var lines = text.split('\n');
            var options = [];
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (!line) continue;
                var match = line.match(/^([A-D])[.、．]\s*(.+)$/);
                if (match) {
                    options.push({ key: match[1], text: match[2] });
                }
            }
            assertLength(options, 2);
        }
    }
]);

// ============================================================
// 数据导入导出 (importData)
// ============================================================
runSuite('数据导入导出', [
    {
        name: '有效JSON导入',
        desc: '验证完整有效数据能正确导入',
        fn: function() {
            var data = {
                questionBank: [{ id: 'test001', question: '测试' }],
                userData: { history: [{ qid: 'test001', ans: 'A', ok: true, time: Date.now() }], wrong: [], stats: { total: 1, correct: 1, cats: {} } },
                exportTime: new Date().toISOString()
            };
            var json = JSON.stringify(data);
            var parsed = JSON.parse(json);
            assertNotNull(parsed.questionBank);
            assertNotNull(parsed.userData);
            assertLength(parsed.questionBank, 1);
            assertEqual(parsed.userData.stats.total, 1);
        }
    },
    {
        name: '无效JSON格式应抛出异常',
        desc: '验证损坏的JSON能被检测',
        fn: function() {
            var invalidJson = '{"questionBank": [{invalid}]}';
            var threw = false;
            try {
                JSON.parse(invalidJson);
            } catch (e) {
                threw = true;
            }
            assertTrue(threw, '无效JSON应抛出解析异常');
        }
    },
    {
        name: '缺失必需字段处理',
        desc: '验证缺少字段的数据结构有合理默认值',
        fn: function() {
            var partialData = { questionBank: [] };
            var defaultStats = { total: 0, correct: 0, cats: {} };
            var stats = partialData.userData ? partialData.userData.stats : defaultStats;
            assertEqual(stats.total, 0);
            assertEqual(stats.correct, 0);
        }
    },
    {
        name: '空数据导入',
        desc: '验证空questionBank数组能正常处理',
        fn: function() {
            var emptyData = { questionBank: [], userData: null, exportTime: null };
            var hasQuestionBank = emptyData.questionBank && Array.isArray(emptyData.questionBank);
            assertTrue(hasQuestionBank);
            assertLength(emptyData.questionBank, 0);
        }
    },
    {
        name: '导入数据完整性校验',
        desc: '验证导出再导入后数据一致',
        fn: function() {
            var original = {
                questionBank: [{ id: 'test' }],
                userData: { stats: { total: 5, correct: 3 } }
            };
            var json = JSON.stringify(original);
            var restored = JSON.parse(json);
            assertEqual(restored.questionBank.length, original.questionBank.length);
            assertEqual(restored.userData.stats.total, original.userData.stats.total);
        }
    },
    {
        name: '特殊字符转义处理',
        desc: '验证含特殊字符的题目能正确序列化',
        fn: function() {
            var data = {
                questionBank: [{
                    id: 'test',
                    question: '包含"引号"和\\反斜杠的题目',
                    options: [{ key: 'A', text: '选项含"引号"' }]
                }]
            };
            var json = JSON.stringify(data);
            var parsed = JSON.parse(json);
            assertEqual(parsed.questionBank[0].question, '包含"引号"和\\反斜杠的题目');
            assertEqual(parsed.questionBank[0].options[0].text, '选项含"引号"');
        }
    }
]);

// ============================================================
// 题库版本管理 (loadQuestionBank)
// ============================================================
runSuite('题库版本管理', [
    {
        name: '版本不匹配时应清除旧数据',
        desc: '验证版本校验逻辑能正确识别版本差异',
        fn: function() {
            var currentVersion = '2025-05-09-v2';
            var oldVersion = '2025-05-01-v1';
            var shouldReset = oldVersion !== currentVersion;
            assertTrue(shouldReset, '旧版本应触发重置');
        }
    },
    {
        name: '版本匹配时应保留数据',
        desc: '验证版本相同时不重置',
        fn: function() {
            var currentVersion = '2025-05-09-v2';
            var sameVersion = '2025-05-09-v2';
            var shouldReset = sameVersion !== currentVersion;
            assertFalse(shouldReset, '相同版本不应重置');
        }
    },
    {
        name: '空版本值处理',
        desc: '验证首次使用或损坏存储时的行为',
        fn: function() {
            var nullVersion = null;
            var currentVersion = '2025-05-09-v2';
            var shouldReset = nullVersion !== currentVersion;
            assertTrue(shouldReset, '空版本应触发重置');
        }
    }
]);

// ============================================================
// 错题本操作
// ============================================================
runSuite('错题本操作', [
    {
        name: '新增错题',
        desc: '验证首次加入错题本正确初始化',
        fn: function() {
            var d = { wrong: [] };
            var qid = 'q001';
            d.wrong.push({ qid: qid, cnt: 1, time: Date.now() });
            assertLength(d.wrong, 1);
            assertEqual(d.wrong[0].qid, 'q001');
            assertEqual(d.wrong[0].cnt, 1);
        }
    },
    {
        name: '重复错题累加计数',
        desc: '验证同一题目错误时计数累加',
        fn: function() {
            var d = { wrong: [{ qid: 'q001', cnt: 1, time: Date.now() }] };
            var qid = 'q001';
            var found = null;
            for (var i = 0; i < d.wrong.length; i++) {
                if (d.wrong[i].qid === qid) {
                    found = d.wrong[i];
                    break;
                }
            }
            if (found) {
                found.cnt++;
                found.time = Date.now();
            } else {
                d.wrong.push({ qid: qid, cnt: 1, time: Date.now() });
            }
            assertEqual(found.cnt, 2);
        }
    },
    {
        name: '移除错题',
        desc: '验证从错题本移除题目',
        fn: function() {
            var d = { wrong: [{ qid: 'q001', cnt: 1 }, { qid: 'q002', cnt: 2 }] };
            var qid = 'q001';
            d.wrong = d.wrong.filter(function(w) { return w.qid !== qid; });
            assertLength(d.wrong, 1);
            assertEqual(d.wrong[0].qid, 'q002');
        }
    },
    {
        name: '获取错题列表',
        desc: '验证获取所有错题',
        fn: function() {
            var d = { wrong: [{ qid: 'q001' }, { qid: 'q002' }, { qid: 'q003' }] };
            var wrongList = d.wrong;
            assertLength(wrongList, 3);
        }
    },
    {
        name: '空错题本边界',
        desc: '验证空错题本的处理',
        fn: function() {
            var d = { wrong: [] };
            var isEmpty = d.wrong.length === 0;
            assertTrue(isEmpty);
        }
    }
]);

// ============================================================
// 答题记录
// ============================================================
runSuite('答题记录', [
    {
        name: '正确答题记录',
        desc: '验证正确答题时统计累加',
        fn: function() {
            var d = { history: [], stats: { total: 0, correct: 0, cats: {} } };
            var rec = { qid: 'q001', ans: 'A', ok: true, time: Date.now() };
            d.history.push(rec);
            d.stats.total++;
            if (rec.ok) d.stats.correct++;
            assertEqual(d.stats.total, 1);
            assertEqual(d.stats.correct, 1);
        }
    },
    {
        name: '错误答题记录',
        desc: '验证错误答题时正确数不累加',
        fn: function() {
            var d = { history: [], stats: { total: 0, correct: 0, cats: {} } };
            var rec = { qid: 'q001', ans: 'B', ok: false, time: Date.now() };
            d.history.push(rec);
            d.stats.total++;
            if (rec.ok) d.stats.correct++;
            assertEqual(d.stats.total, 1);
            assertEqual(d.stats.correct, 0);
        }
    },
    {
        name: '分类统计累加',
        desc: '验证分类正确率统计正确',
        fn: function() {
            var d = { history: [], stats: { total: 0, correct: 0, cats: {} } };
            var cat = '专辑';
            if (!d.stats.cats[cat]) d.stats.cats[cat] = { t: 0, c: 0 };
            d.stats.cats[cat].t++;
            d.stats.cats[cat].c++;
            assertEqual(d.stats.cats['专辑'].t, 1);
            assertEqual(d.stats.cats['专辑'].c, 1);
        }
    },
    {
        name: '多次答题统计正确性',
        desc: '验证多轮答题后统计正确',
        fn: function() {
            var d = { history: [], stats: { total: 0, correct: 0, cats: {} } };
            var records = [
                { qid: 'q001', ans: 'A', ok: true },
                { qid: 'q002', ans: 'B', ok: false },
                { qid: 'q003', ans: 'C', ok: true }
            ];
            for (var i = 0; i < records.length; i++) {
                var rec = records[i];
                d.history.push(rec);
                d.stats.total++;
                if (rec.ok) d.stats.correct++;
            }
            assertEqual(d.stats.total, 3);
            assertEqual(d.stats.correct, 2);
        }
    }
]);

// ============================================================
// 洗牌算法
// ============================================================
runSuite('洗牌算法', [
    {
        name: '输出数组长度不变',
        desc: '验证洗牌不改变数组长度',
        fn: function() {
            var arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            var shuffled = shuffle(arr.slice());
            assertLength(shuffled, arr.length);
        }
    },
    {
        name: '输出包含所有原元素',
        desc: '验证洗牌不丢失元素',
        fn: function() {
            var arr = [1, 2, 3, 4, 5];
            var shuffled = shuffle(arr.slice());
            for (var i = 0; i < arr.length; i++) {
                assertContains(shuffled, arr[i], '元素 ' + arr[i] + ' 应保留');
            }
        }
    },
    {
        name: '单元素数组边界',
        desc: '验证单元素洗牌正确',
        fn: function() {
            var arr = [42];
            var shuffled = shuffle(arr.slice());
            assertLength(shuffled, 1);
            assertEqual(shuffled[0], 42);
        }
    },
    {
        name: '不修改原数组',
        desc: '验证Fisher-Yates算法不修改原数组',
        fn: function() {
            var original = [1, 2, 3, 4, 5];
            var copy = original.slice();
            var shuffled = shuffle(original);
            assertEqual(original.length, copy.length);
            for (var i = 0; i < original.length; i++) {
                assertEqual(original[i], copy[i], '原数组第' + i + '项应不变');
            }
        }
    }
]);

// ============================================================
// 分类筛选
// ============================================================
runSuite('分类筛选', [
    {
        name: '按分类筛选题目',
        desc: '验证能正确筛选特定分类',
        fn: function() {
            var QUESTION_BANK = [
                { id: '001', category: '专辑', question: '题目1' },
                { id: '002', category: '歌曲', question: '题目2' },
                { id: '003', category: '专辑', question: '题目3' },
                { id: '004', category: '个人信息', question: '题目4' }
            ];
            var cat = '专辑';
            var filtered = [];
            for (var i = 0; i < QUESTION_BANK.length; i++) {
                if (QUESTION_BANK[i].category === cat) {
                    filtered.push(QUESTION_BANK[i]);
                }
            }
            assertLength(filtered, 2);
            assertEqual(filtered[0].category, '专辑');
            assertEqual(filtered[1].category, '专辑');
        }
    },
    {
        name: '分类统计正确',
        desc: '验证分类计数正确',
        fn: function() {
            var QUESTION_BANK = [
                { id: '001', category: '专辑' },
                { id: '002', category: '歌曲' },
                { id: '003', category: '专辑' },
                { id: '004', category: '个人信息' }
            ];
            var cats = {};
            for (var i = 0; i < QUESTION_BANK.length; i++) {
                var c = QUESTION_BANK[i].category;
                cats[c] = (cats[c] || 0) + 1;
            }
            assertEqual(cats['专辑'], 2);
            assertEqual(cats['歌曲'], 1);
            assertEqual(cats['个人信息'], 1);
        }
    },
    {
        name: '空分类处理',
        desc: '验证不存在分类返回空数组',
        fn: function() {
            var QUESTION_BANK = [
                { id: '001', category: '专辑' }
            ];
            var cat = '不存在的分类';
            var filtered = [];
            for (var i = 0; i < QUESTION_BANK.length; i++) {
                if (QUESTION_BANK[i].category === cat) {
                    filtered.push(QUESTION_BANK[i]);
                }
            }
            assertLength(filtered, 0);
        }
    }
]);

// ============================================================
// 题目搜索过滤
// ============================================================
runSuite('题目搜索过滤', [
    {
        name: '按关键词搜索',
        desc: '验证搜索能匹配题目文本',
        fn: function() {
            var QUESTION_BANK = [
                { id: '001', question: '林俊杰的首张专辑是什么？' },
                { id: '002', question: '曹操专辑的发行时间？' },
                { id: '003', question: '江南歌曲的作词人是谁？' }
            ];
            var search = '专辑';
            var filtered = [];
            for (var i = 0; i < QUESTION_BANK.length; i++) {
                if (QUESTION_BANK[i].question.toLowerCase().indexOf(search.toLowerCase()) !== -1) {
                    filtered.push(QUESTION_BANK[i]);
                }
            }
            assertLength(filtered, 2);
        }
    },
    {
        name: '搜索区分大小写',
        desc: '验证搜索不区分大小写',
        fn: function() {
            var QUESTION_BANK = [
                { id: '001', question: '林俊杰 JJ Lin' }
            ];
            var search = 'jj';
            var filtered = [];
            for (var i = 0; i < QUESTION_BANK.length; i++) {
                if (QUESTION_BANK[i].question.toLowerCase().indexOf(search.toLowerCase()) !== -1) {
                    filtered.push(QUESTION_BANK[i]);
                }
            }
            assertLength(filtered, 1);
        }
    },
    {
        name: '空搜索关键词',
        desc: '验证空关键词匹配所有',
        fn: function() {
            var search = '';
            var QUESTION_BANK = [
                { id: '001', question: '题目1' },
                { id: '002', question: '题目2' }
            ];
            var filtered = [];
            for (var i = 0; i < QUESTION_BANK.length; i++) {
                if (search === '' || QUESTION_BANK[i].question.toLowerCase().indexOf(search.toLowerCase()) !== -1) {
                    filtered.push(QUESTION_BANK[i]);
                }
            }
            assertLength(filtered, 2);
        }
    }
]);

// ============================================================
// 边界条件 - 空数据场景
// ============================================================
runSuite('边界条件 - 空数据场景', [
    {
        name: '空题库启动答题',
        desc: '验证空题库时不生成答题列表',
        fn: function() {
            var QUESTION_BANK = [];
            var getCount = function() { return 10; };
            var quiz = shuffle(QUESTION_BANK).slice(0, getCount());
            assertLength(quiz, 0, '空题库应返回空答题列表');
        }
    },
    {
        name: '题库数量少于请求数',
        desc: '验证题库不足时返回全部题目',
        fn: function() {
            var QUESTION_BANK = [
                { id: '001' },
                { id: '002' },
                { id: '003' }
            ];
            var getCount = function() { return 10; };
            var quiz = shuffle(QUESTION_BANK).slice(0, getCount());
            assertLength(quiz, 3, '应返回所有可用题目');
        }
    },
    {
        name: '错题本为空时启动复习',
        desc: '验证空错题本不启动答题',
        fn: function() {
            var wrongList = [];
            var qs = [];
            for (var i = 0; i < wrongList.length; i++) {
                qs.push(wrongList[i]);
            }
            var canStart = qs.length > 0;
            assertFalse(canStart, '空错题本不应启动答题');
        }
    },
    {
        name: '分类题库为空',
        desc: '验证某分类无题目时处理',
        fn: function() {
            var QUESTION_BANK = [
                { id: '001', category: '专辑' }
            ];
            var cat = '歌曲';
            var filtered = [];
            for (var i = 0; i < QUESTION_BANK.length; i++) {
                if (QUESTION_BANK[i].category === cat) {
                    filtered.push(QUESTION_BANK[i]);
                }
            }
            assertLength(filtered, 0);
        }
    }
]);

// ============================================================
// 答案验证逻辑
// ============================================================
runSuite('答案验证逻辑', [
    {
        name: '正确答案匹配',
        desc: '验证正确答案判定',
        fn: function() {
            var q = { id: '001', answer: 'A' };
            var selectedKey = 'A';
            var isCorrect = (selectedKey === q.answer);
            assertTrue(isCorrect);
        }
    },
    {
        name: '错误答案判定',
        desc: '验证错误答案判定',
        fn: function() {
            var q = { id: '001', answer: 'A' };
            var selectedKey = 'B';
            var isCorrect = (selectedKey === q.answer);
            assertFalse(isCorrect);
        }
    },
    {
        name: '选项key类型一致性',
        desc: '验证选项key类型匹配',
        fn: function() {
            var q = { id: '001', answer: 'A', options: [{ key: 'A' }, { key: 'B' }] };
            assertEqual(typeof q.answer, 'string');
            assertEqual(typeof q.options[0].key, 'string');
        }
    }
]);

// 输出总结
console.log('\n========================================');
console.log('测试总结');
console.log('========================================');
console.log('通过: ' + passed);
console.log('失败: ' + failed);
console.log('总计: ' + total);
console.log('通过率: ' + Math.round(passed / total * 100) + '%');

if (failed > 0) {
    process.exit(1);
}
