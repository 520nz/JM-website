var localStorage = {
    data: {},
    getItem: function(key) { return this.data[key] || null; },
    setItem: function(key, value) { this.data[key] = value; },
    removeItem: function(key) { delete this.data[key]; }
};

var state = {quiz:[],idx:0,answered:false,mode:'quick',correctCount:0,startTime:0,timer:null};

var QUESTION_BANK=[
    {id:'001',category:'专辑',question:'测试题1',options:[{key:'A',text:'a'},{key:'B',text:'b'}],answer:'B',explanation:'test'},
    {id:'002',category:'歌曲',question:'测试题2',options:[{key:'A',text:'c'},{key:'B',text:'d'}],answer:'A',explanation:'test2'}
];

var DB={
    KEY:'jj_quiz_v2',
    get:function(){var d=localStorage.getItem(DB.KEY);return d?JSON.parse(d):DB.defaults();},
    defaults:function(){return{history:[],wrong:[],stats:{total:0,correct:0,cats:{}}};},
    save:function(d){localStorage.setItem(DB.KEY,JSON.stringify(d));},
    addRecord:function(rec){var d=DB.get();d.history.push(rec);d.stats.total++;if(rec.ok)d.stats.correct++;var q=DB.findQ(rec.qid);if(q){if(!d.stats.cats[q.category])d.stats.cats[q.category]={t:0,c:0};d.stats.cats[q.category].t++;if(rec.ok)d.stats.cats[q.category].c++;}DB.save(d);},
    addWrong:function(qid){var d=DB.get();var f=null;for(var i=0;i<d.wrong.length;i++){if(d.wrong[i].qid===qid){f=d.wrong[i];break;}}if(f){f.cnt++;f.time=Date.now();}else{d.wrong.push({qid:qid,cnt:1,time:Date.now()});}DB.save(d);},
    removeWrong:function(qid){var d=DB.get();d.wrong=d.wrong.filter(function(w){return w.qid!==qid;});DB.save(d);},
    getWrong:function(){return DB.get().wrong;},
    findQ:function(qid){for(var i=0;i<QUESTION_BANK.length;i++){if(QUESTION_BANK[i].id===qid)return QUESTION_BANK[i];}return null;}
};

var assert = {
    ok: function(condition, msg) {
        if (!condition) throw new Error('Assertion failed: ' + (msg || 'unknown'));
        console.log('✓', msg || 'OK');
    },
    equal: function(actual, expected, msg) {
        if (actual !== expected) throw new Error('Assertion failed: expected ' + expected + ', got ' + actual + (msg ? ' (' + msg + ')' : ''));
        console.log('✓', msg || 'Equal');
    },
    deepEqual: function(actual, expected, msg) {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Assertion failed: expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual) + (msg ? ' (' + msg + ')' : ''));
        console.log('✓', msg || 'Deep equal');
    }
};

function runTests() {
    console.log('\n========== JJ Quiz 应用测试 ==========');
    testDB();
    testQuizLogic();
    testQuestionParsing();
    testCategoryStats();
    console.log('\n========== 所有测试通过！ ==========');
}

function testDB() {
    console.log('\n--- 测试 DB 模块 ---');
    
    localStorage.removeItem('jj_quiz_v2');
    
    var d = DB.get();
    assert.deepEqual(d, {history: [], wrong: [], stats: {total: 0, correct: 0, cats: {}}}, 'DB.get() 返回默认值');
    
    DB.addRecord({qid: '001', ans: 'B', ok: true, time: Date.now()});
    d = DB.get();
    assert.equal(d.stats.total, 1, '添加正确答题记录后 total = 1');
    assert.equal(d.stats.correct, 1, '添加正确答题记录后 correct = 1');
    assert.equal(d.history.length, 1, '历史记录长度为 1');
    assert.equal(d.stats.cats['专辑'].t, 1, '分类统计增加');
    assert.equal(d.stats.cats['专辑'].c, 1, '分类正确数增加');
    
    DB.addRecord({qid: '002', ans: 'B', ok: false, time: Date.now()});
    d = DB.get();
    assert.equal(d.stats.total, 2, '添加错误答题记录后 total = 2');
    assert.equal(d.stats.correct, 1, '添加错误答题记录后 correct 仍为 1');
    
    DB.addWrong('002');
    d = DB.get();
    assert.equal(d.wrong.length, 1, '错题记录添加成功');
    assert.equal(d.wrong[0].qid, '002', '错题 qid 正确');
    assert.equal(d.wrong[0].cnt, 1, '错题计数初始为 1');
    
    DB.addWrong('002');
    d = DB.get();
    assert.equal(d.wrong.length, 1, '重复添加同一错题不增加记录');
    assert.equal(d.wrong[0].cnt, 2, '错题计数增加为 2');
    
    DB.removeWrong('002');
    d = DB.get();
    assert.equal(d.wrong.length, 0, '移除错题成功');
    
    var q = DB.findQ('001');
    assert.ok(q, 'findQ 能找到存在的题目');
    assert.equal(q.id, '001', 'findQ 返回正确的题目');
    
    q = DB.findQ('nonexistent');
    assert.equal(q, null, 'findQ 返回 null 当题目不存在');
    
    console.log('DB 模块测试完成');
}

function testQuizLogic() {
    console.log('\n--- 测试答题逻辑 ---');
    
    state.quiz = [{
        id: 'test1',
        category: '测试',
        question: '测试题',
        options: [{key: 'A', text: '错'}, {key: 'B', text: '对'}],
        answer: 'B',
        explanation: '解释'
    }];
    state.idx = 0;
    state.correctCount = 0;
    state.answered = false;
    
    assert.equal(state.idx, 0, '初始 idx = 0');
    assert.equal(state.correctCount, 0, '初始 correctCount = 0');
    assert.equal(state.answered, false, '初始 answered = false');
    
    state.answered = true;
    state.correctCount = 1;
    state.idx++;
    
    assert.equal(state.idx, 1, 'idx 增加后 = 1');
    assert.equal(state.correctCount, 1, 'correctCount 正确');
    assert.equal(state.answered, true, 'answered 为 true');
    
    var total = 1, correct = 1;
    var pct = total > 0 ? Math.round(correct / total * 100) : 0;
    assert.equal(pct, 100, '正确率计算正确 (100%)');
    
    total = 4; correct = 3;
    pct = total > 0 ? Math.round(correct / total * 100) : 0;
    assert.equal(pct, 75, '正确率计算正确 (75%)');
    
    total = 0;
    pct = total > 0 ? Math.round(correct / total * 100) : 0;
    assert.equal(pct, 0, '正确率计算正确 (0道题时为0)');
    
    console.log('答题逻辑测试完成');
}

function testQuestionParsing() {
    console.log('\n--- 测试题目解析逻辑 ---');
    
    var optsText = 'A.选项1\nB.选项2\nC.选项3\nD.选项4';
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
    
    assert.equal(options.length, 4, '正确解析4个选项');
    assert.equal(options[0].key, 'A', '选项A解析正确');
    assert.equal(options[0].text, '选项1', '选项A文本正确');
    
    optsText = 'A.第一个选项\nB.第二个选项';
    lines = optsText.split('\n');
    options = [];
    for (i = 0; i < lines.length; i++) {
        line = lines[i].trim();
        if (!line) continue;
        match = line.match(/^([A-D])[.、．]\s*(.+)$/);
        if (match) {
            options.push({ key: match[1], text: match[2] });
        }
    }
    assert.equal(options.length, 2, '正确解析2个选项');
    
    optsText = 'A.选项\n\nB.选项';
    lines = optsText.split('\n');
    options = [];
    for (i = 0; i < lines.length; i++) {
        line = lines[i].trim();
        if (!line) continue;
        match = line.match(/^([A-D])[.、．]\s*(.+)$/);
        if (match) {
            options.push({ key: match[1], text: match[2] });
        }
    }
    assert.equal(options.length, 2, '正确跳过空行');
    
    console.log('题目解析逻辑测试完成');
}

function testCategoryStats() {
    console.log('\n--- 测试分类统计 ---');
    
    var cats = {};
    var questions = [
        {category: '专辑'}, {category: '歌曲'}, {category: '专辑'}, {category: '个人信息'}
    ];
    
    for (var i = 0; i < questions.length; i++) {
        var c = questions[i].category;
        cats[c] = (cats[c] || 0) + 1;
    }
    
    assert.equal(cats['专辑'], 2, '专辑类别计数正确');
    assert.equal(cats['歌曲'], 1, '歌曲类别计数正确');
    assert.equal(cats['个人信息'], 1, '个人信息类别计数正确');
    
    var keys = Object.keys(cats).sort();
    assert.equal(keys.length, 3, '类别数量正确');
    
    var stats = {
        cats: { '专辑': {t: 10, c: 8}, '歌曲': {t: 20, c: 15} }
    };
    
    var albumPct = stats.cats['专辑'].t > 0 ? Math.round(stats.cats['专辑'].c / stats.cats['专辑'].t * 100) : 0;
    var songPct = stats.cats['歌曲'].t > 0 ? Math.round(stats.cats['歌曲'].c / stats.cats['歌曲'].t * 100) : 0;
    
    assert.equal(albumPct, 80, '专辑正确率计算正确 (80%)');
    assert.equal(songPct, 75, '歌曲正确率计算正确 (75%)');
    
    console.log('分类统计测试完成');
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runTests, DB, state, QUESTION_BANK };
    if (require.main === module) {
        runTests();
    }
} else {
    runTests();
}