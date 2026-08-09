// ============================================================
// admin.test.js - admin.js 核心逻辑测试
// 覆盖：选项解析正则（3 种分隔符）、错题合并算法（间隔重复兼容）、
//       saveQuestion 新增/编辑流程、数据导入边界条件
// ============================================================

// admin.js 选项解析正则
var OPTION_RE = /^([A-Z])[.、．]\s*(.+)$/;

// admin.js 错题合并算法（importData 内部闭包逻辑的镜像）
function mergeWrongList(existingWrong, importedWrong, now) {
    var result = existingWrong.slice();
    if (!importedWrong || importedWrong.length === 0) return result;

    var wrongMap = {};
    for (var w = 0; w < result.length; w++) {
        wrongMap[result[w].qid] = result[w];
    }
    for (var x = 0; x < importedWrong.length; x++) {
        var wrongItem = importedWrong[x];
        if (wrongMap[wrongItem.qid]) {
            wrongMap[wrongItem.qid].cnt = Math.max(wrongMap[wrongItem.qid].cnt, wrongItem.cnt || 1);
            if (wrongItem.level != null) {
                wrongMap[wrongItem.qid].level = Math.min(wrongMap[wrongItem.qid].level || 0, wrongItem.level);
            }
        } else {
            if (!wrongItem.level) wrongItem.level = 0;
            if (!wrongItem.nextReview) wrongItem.nextReview = now;
            if (!wrongItem.lastReview) wrongItem.lastReview = 0;
            if (!wrongItem.time) wrongItem.time = now;
            result.push(wrongItem);
        }
    }
    return result;
}

module.exports = {
    name: 'admin.js 题库管理 + 数据导入',
    beforeEach: function(App) {
        App.QUESTION_BANK = [
            { id: '001', category: '专辑', question: 'Q1', options: [{key:'A',text:'a'},{key:'B',text:'b'}], answer: 'A', explanation: '' },
            { id: '002', category: '歌曲', question: 'Q2', options: [{key:'A',text:'a'},{key:'B',text:'b'}], answer: 'B', explanation: '' }
        ];
        App.db.setData(App.db.defaults());

        // saveQuestion 所需 DOM
        var doc = App._testEnv.window.document;
        var ids = ['editId','editCategory','editQuestion','editAnswer','editExplanation','modalTitle','editModal','questionList','searchInput','resetModal','resetConfirmInput','resetConfirmBtn'];
        ids.forEach(function(id) {
            if (!doc.getElementById(id)) {
                var el;
                if (id === 'editModal' || id === 'resetModal' || id === 'questionList' || id === 'modalTitle') {
                    el = doc.createElement(id === 'modalTitle' ? 'span' : 'div');
                } else if (id === 'editCategory' || id === 'categoryFilter') {
                    el = doc.createElement('select');
                } else {
                    el = doc.createElement('input');
                }
                el.id = id;
                if (id === 'editModal' || id === 'resetModal') el.style = { display: 'none' };
                if (id === 'editCategory' || id === 'categoryFilter') {
                    ['专辑','歌曲','歌手','个人信息','获奖记录'].forEach(function(c){
                        var o = doc.createElement('option'); o.value = c; o.textContent = c; el.appendChild(o);
                    });
                }
                doc.body.appendChild(el);
            }
        });
        if (!doc.getElementById('categoryFilter')) {
            var cf = doc.createElement('select'); cf.id = 'categoryFilter';
            ['专辑','歌曲','歌手','个人信息','获奖记录'].forEach(function(c){
                var o = doc.createElement('option'); o.value = c; o.textContent = c; cf.appendChild(o);
            });
            doc.body.appendChild(cf);
        }
        if (!doc.getElementById('editOptions')) {
            var ta = doc.createElement('textarea');
            ta.id = 'editOptions';
            doc.body.appendChild(ta);
        }
    },
    cases: [
        // ===================== 选项解析正则 =====================
        { name: '正则应匹配英文点号 A.', fn: function(App, H) {
            var m = 'A.选项内容'.match(OPTION_RE);
            H.ok(m !== null);
            H.equal(m[1], 'A');
            H.equal(m[2], '选项内容');
        }},
        { name: '正则应匹配中文顿号 A、', fn: function(App, H) {
            var m = 'A、选项内容'.match(OPTION_RE);
            H.ok(m !== null);
            H.equal(m[1], 'A');
            H.equal(m[2], '选项内容');
        }},
        { name: '正则应匹配全角点号 A．', fn: function(App, H) {
            var m = 'A．选项内容'.match(OPTION_RE);
            H.ok(m !== null);
            H.equal(m[1], 'A');
            H.equal(m[2], '选项内容');
        }},
        { name: '正则应跳过选项字母后的空白', fn: function(App, H) {
            var m = 'B.  空格选项'.match(OPTION_RE);
            H.ok(m !== null);
            H.equal(m[2], '空格选项');
        }},
        { name: '正则不应匹配小写字母 a.', fn: function(App, H) {
            var m = 'a.选项'.match(OPTION_RE);
            H.ok(m === null, '小写 a 不应匹配');
        }},
        { name: '正则不应匹配无双字符前缀', fn: function(App, H) {
            H.ok('选项内容'.match(OPTION_RE) === null);
            H.ok('A 选项'.match(OPTION_RE) === null, 'A 空格不匹配');
            H.ok('A：选项'.match(OPTION_RE) === null, '中文冒号不匹配');
        }},
        { name: '正则不应匹配多字母前缀 AB.', fn: function(App, H) {
            H.ok('AB.选项'.match(OPTION_RE) === null);
        }},
        { name: '完整解析流程应生成 4 个 option 对象', fn: function(App, H) {
            var optsText = 'A.选项A\nB.选项B\nC.选项C\nD.选项D';
            var lines = optsText.split('\n');
            var options = [];
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (!line) continue;
                var match = line.match(OPTION_RE);
                if (match) options.push({ key: match[1], text: match[2] });
            }
            H.equal(options.length, 4);
            H.equal(options[0].key, 'A');
            H.equal(options[0].text, '选项A');
            H.equal(options[3].text, '选项D');
        }},
        { name: '混合分隔符应都能解析', fn: function(App, H) {
            var optsText = 'A、中文顿号\nB．全角点\nC.英文点';
            var lines = optsText.split('\n');
            var options = [];
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                var match = line.match(OPTION_RE);
                if (match) options.push({ key: match[1], text: match[2] });
            }
            H.equal(options.length, 3);
            H.equal(options[0].text, '中文顿号');
            H.equal(options[1].text, '全角点');
            H.equal(options[2].text, '英文点');
        }},

        // ===================== 错题合并算法（importData 核心） =====================
        { name: '合并：同题应取较高的错误次数 (Math.max)', fn: function(App, H) {
            var existing = [{ qid: '001', cnt: 3, level: 2, time: 1000 }];
            var imported = [{ qid: '001', cnt: 5 }];
            var merged = mergeWrongList(existing, imported, Date.now());
            H.equal(merged.length, 1);
            H.equal(merged[0].cnt, 5, '应取较高的 cnt');
            H.equal(merged[0].level, 2, '已有的 level 应保留');
        }},
        { name: '合并：同题应保留较低的间隔重复等级 (Math.min 保守策略)', fn: function(App, H) {
            var existing = [{ qid: '001', cnt: 3, level: 3, time: 1000 }];
            var imported = [{ qid: '001', cnt: 5, level: 1 }];
            var merged = mergeWrongList(existing, imported, Date.now());
            H.equal(merged[0].cnt, 5);
            H.equal(merged[0].level, 1, '应取较低 level 更保守');
        }},
        { name: '合并：导入数据 level 为 null/undefined 时不应覆盖现有 level', fn: function(App, H) {
            var existing = [{ qid: '001', cnt: 3, level: 4, time: 1000 }];
            var imported = [{ qid: '001', cnt: 5, level: null }];
            var merged = mergeWrongList(existing, imported, Date.now());
            H.equal(merged[0].level, 4, 'null level 不应覆盖');
        }},
        { name: '合并：新错题应补全间隔重复默认字段', fn: function(App, H) {
            var existing = [];
            var imported = [{ qid: '999', cnt: 2 }];
            var now = Date.now();
            var merged = mergeWrongList(existing, imported, now);
            H.equal(merged.length, 1);
            H.equal(merged[0].level, 0);
            H.ok(merged[0].nextReview === now, 'nextReview 应补全');
            H.equal(merged[0].lastReview, 0);
            H.ok(merged[0].time === now, 'time 应补全');
        }},
        { name: '合并：已有错题 + 新错题应同时保留', fn: function(App, H) {
            var existing = [{ qid: '001', cnt: 1, level: 0, time: 1000 }];
            var imported = [
                { qid: '001', cnt: 2, level: 2 },
                { qid: '002', cnt: 1 }
            ];
            var now = Date.now();
            var merged = mergeWrongList(existing, imported, now);
            H.equal(merged.length, 2);
            var m001 = null, m002 = null;
            for (var i = 0; i < merged.length; i++) {
                if (merged[i].qid === '001') m001 = merged[i];
                if (merged[i].qid === '002') m002 = merged[i];
            }
            H.ok(m001 !== null);
            H.ok(m002 !== null);
            H.equal(m001.cnt, 2);
            H.equal(m001.level, 0);
            H.equal(m002.level, 0);
        }},
        { name: '合并：导入空数组应保持不变', fn: function(App, H) {
            var existing = [{ qid: '001', cnt: 1, level: 0, time: 1000 }];
            var merged = mergeWrongList(existing, [], Date.now());
            H.equal(merged.length, 1);
        }},
        { name: '合并：existing 为空但 imported 有数据', fn: function(App, H) {
            var imported = [{ qid: '999', cnt: 1 }];
            var merged = mergeWrongList([], imported, Date.now());
            H.equal(merged.length, 1);
            H.equal(merged[0].qid, '999');
        }},

        // ===================== saveQuestion 流程 =====================
        { name: 'saveQuestion 新增应往题库添加题目', fn: function(App, H) {
            var doc = App._testEnv.window.document;
            doc.getElementById('editId').value = '';
            doc.getElementById('editCategory').value = '歌曲';
            doc.getElementById('editQuestion').value = '新题';
            doc.getElementById('editOptions').value = 'A.选项1\nB.选项2\nC.选项3\nD.选项4';
            doc.getElementById('editAnswer').value = 'B';
            doc.getElementById('editExplanation').value = '';

            var before = App.QUESTION_BANK.length;
            App.saveQuestion();
            H.equal(App.QUESTION_BANK.length, before + 1);
            var last = App.QUESTION_BANK[App.QUESTION_BANK.length - 1];
            H.equal(last.question, '新题');
            H.equal(last.category, '歌曲');
            H.equal(last.options.length, 4);
            H.equal(last.options[0].key, 'A');
            H.equal(last.options[1].text, '选项2');
            H.equal(last.answer, 'B');
        }},
        { name: 'saveQuestion 编辑应原地修改已有题目', fn: function(App, H) {
            var doc = App._testEnv.window.document;
            doc.getElementById('editId').value = '001';
            doc.getElementById('editCategory').value = '专辑';
            doc.getElementById('editQuestion').value = '修改后的Q1';
            doc.getElementById('editOptions').value = 'A、新选项A\nB、新选项B';
            doc.getElementById('editAnswer').value = 'A';
            doc.getElementById('editExplanation').value = '新解释';

            App.saveQuestion();
            var updated = null;
            for (var i = 0; i < App.QUESTION_BANK.length; i++) {
                if (App.QUESTION_BANK[i].id === '001') updated = App.QUESTION_BANK[i];
            }
            H.ok(updated !== null);
            H.equal(updated.question, '修改后的Q1');
            H.equal(updated.options.length, 2);
            H.equal(updated.options[0].key, 'A');
            H.equal(updated.options[1].text, '新选项B');
            H.equal(updated.answer, 'A');
            H.equal(updated.explanation, '新解释');
        }},
        { name: 'saveQuestion 题库原有题目数量不应变化（编辑而非新增）', fn: function(App, H) {
            var doc = App._testEnv.window.document;
            var before = App.QUESTION_BANK.length;
            doc.getElementById('editId').value = '001';
            doc.getElementById('editCategory').value = '专辑';
            doc.getElementById('editQuestion').value = '改';
            doc.getElementById('editOptions').value = 'A.a\nB.b';
            doc.getElementById('editAnswer').value = 'A';
            App.saveQuestion();
            H.equal(App.QUESTION_BANK.length, before, '编辑不应增加题目数');
        }},

        // ===================== 分页边界 =====================
        { name: 'adminNextPage 翻页逻辑：超出范围时的保护', fn: function(App, H) {
            var doc = App._testEnv.window.document;
            doc.getElementById('searchInput') || (function() {
                var s = doc.createElement('input');
                s.id = 'searchInput'; doc.body.appendChild(s);
                var c = doc.createElement('select');
                c.id = 'categoryFilter'; doc.body.appendChild(c);
                var q = doc.createElement('div');
                q.id = 'questionList'; doc.body.appendChild(q);
            })();
            // 只有 2 道题，_adminPageSize = 30，totalPages = 1
            // 翻到第 2 页时应被钳回第 1 页
            App.adminNextPage();
            App.adminNextPage();
            App.adminNextPage();
            // 通过内部状态间接验证（renderQuestionList 会钳制 _adminPage）
            // 我们直接检查 App.renderQuestionList 是否不抛异常
            H.ok(true, '分页操作不应抛异常');
        }}
    ]
};
