var assert = require('assert');

var QUESTION_BANK=[
{id:"001",category:"专辑",question:"林俊杰首张专辑《乐行者》发行于哪一天？",options:[{key:"A",text:"2003年4月1日"},{key:"B",text:"2003年4月10日"},{key:"C",text:"2003年5月1日"},{key:"D",text:"2003年5月10日"}],answer:"B",explanation:"《乐行者》于2003年4月10日正式发行，这也是林俊杰的出道专辑。"},
{id:"002",category:"歌曲",question:"《乐行者》专辑中由林俊杰本人作词的歌曲是？",options:[{key:"A",text:"就是我"},{key:"B",text:"会读书"},{key:"C",text:"不懂"},{key:"D",text:"翅膀"}],answer:"A",explanation:"《就是我》由林俊杰作词，这是他第一首完全由自己作词的作品。"},
{id:"003",category:"歌曲",question:"《第二天堂》中《江南》的作词人是谁？",options:[{key:"A",text:"林俊杰"},{key:"B",text:"张思尔"},{key:"C",text:"李瑞洵"},{key:"D",text:"方文山"}],answer:"C",explanation:"《江南》由李瑞洵作词，是林俊杰的代表作之一。"}
];

var DEFAULT_QUESTION_BANK = QUESTION_BANK.slice();

var mockLocalStorage = {
    data: {},
    getItem: function(key) { return this.data[key] || null; },
    setItem: function(key, value) { this.data[key] = value; },
    removeItem: function(key) { delete this.data[key]; }
};

var DB={
    KEY:'jj_quiz_v2',
    get:function(){var d=mockLocalStorage.getItem(DB.KEY);return d?JSON.parse(d):DB.defaults();},
    defaults:function(){return{history:[],wrong:[],stats:{total:0,correct:0,cats:{}}};},
    save:function(d){mockLocalStorage.setItem(DB.KEY,JSON.stringify(d));},
    addRecord:function(rec){var d=DB.get();d.history.push(rec);d.stats.total++;if(rec.ok)d.stats.correct++;var q=DB.findQ(rec.qid);if(q){if(!d.stats.cats[q.category])d.stats.cats[q.category]={t:0,c:0};d.stats.cats[q.category].t++;if(rec.ok)d.stats.cats[q.category].c++;}DB.save(d);},
    addWrong:function(qid){var d=DB.get();var f=null;for(var i=0;i<d.wrong.length;i++){if(d.wrong[i].qid===qid){f=d.wrong[i];break;}}if(f){f.cnt++;f.time=Date.now();}else{d.wrong.push({qid:qid,cnt:1,time:Date.now()});}DB.save(d);},
    removeWrong:function(qid){var d=DB.get();d.wrong=d.wrong.filter(function(w){return w.qid!==qid;});DB.save(d);},
    getWrong:function(){return DB.get().wrong;},
    findQ:function(qid){for(var i=0;i<QUESTION_BANK.length;i++){if(QUESTION_BANK[i].id===qid)return QUESTION_BANK[i];}return null;}
};

function shuffle(arr){var a=arr.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}

function fmtTime(ms){var sec=Math.floor(ms/1000);var m=Math.floor(sec/60);var s=sec%60;return m+'分'+s+'秒';}

function getCount(mode){var m={quick:10,standard:20,intensive:30};return m[mode]||10;}

function saveQuestionBank() {
    mockLocalStorage.setItem('jj_question_bank', JSON.stringify(QUESTION_BANK));
}

function loadQuestionBank() {
    var saved = mockLocalStorage.getItem('jj_question_bank');
    if (saved) {
        try {
            QUESTION_BANK = JSON.parse(saved);
        } catch (e) {}
    }
}

var passed = 0;
var failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log('✓ ' + name);
        passed++;
    } catch (err) {
        console.log('✗ ' + name);
        console.log('  Error: ' + err.message);
        failed++;
    }
}

test('DB.get() should return default data structure', function() {
    mockLocalStorage.removeItem(DB.KEY);
    var data = DB.get();
    assert.strictEqual(typeof data, 'object');
    assert(Array.isArray(data.history), 'history should be array');
    assert(Array.isArray(data.wrong), 'wrong should be array');
    assert.strictEqual(typeof data.stats, 'object');
    assert.strictEqual(data.stats.total, 0);
    assert.strictEqual(data.stats.correct, 0);
    assert.deepStrictEqual(data.stats.cats, {});
});

test('DB.addRecord() should add record and update stats', function() {
    mockLocalStorage.removeItem(DB.KEY);
    var testRecord = { qid: '001', ans: 'B', ok: true, time: Date.now() };
    DB.addRecord(testRecord);
    var data = DB.get();
    assert.strictEqual(data.history.length, 1);
    assert.strictEqual(data.stats.total, 1);
    assert.strictEqual(data.stats.correct, 1);
});

test('DB.addRecord() should handle wrong answers', function() {
    mockLocalStorage.removeItem(DB.KEY);
    DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
    DB.addRecord({ qid: '002', ans: 'A', ok: false, time: Date.now() });
    var data = DB.get();
    assert.strictEqual(data.stats.total, 2);
    assert.strictEqual(data.stats.correct, 1);
});

test('DB.addRecord() should update category stats', function() {
    mockLocalStorage.removeItem(DB.KEY);
    DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
    DB.addRecord({ qid: '002', ans: 'A', ok: false, time: Date.now() });
    var data = DB.get();
    assert(data.stats.cats['专辑'], 'category "专辑" should exist');
    assert(data.stats.cats['歌曲'], 'category "歌曲" should exist');
    assert.strictEqual(data.stats.cats['专辑'].t, 1);
    assert.strictEqual(data.stats.cats['专辑'].c, 1);
    assert.strictEqual(data.stats.cats['歌曲'].t, 1);
    assert.strictEqual(data.stats.cats['歌曲'].c, 0);
});

test('DB.addWrong() should add new wrong question', function() {
    mockLocalStorage.removeItem(DB.KEY);
    DB.addWrong('001');
    var data = DB.get();
    assert.strictEqual(data.wrong.length, 1);
    assert.strictEqual(data.wrong[0].qid, '001');
    assert.strictEqual(data.wrong[0].cnt, 1);
});

test('DB.addWrong() should increment count for existing wrong question', function() {
    mockLocalStorage.removeItem(DB.KEY);
    DB.addWrong('001');
    DB.addWrong('001');
    var data = DB.get();
    assert.strictEqual(data.wrong.length, 1);
    assert.strictEqual(data.wrong[0].cnt, 2);
});

test('DB.removeWrong() should remove existing wrong question', function() {
    mockLocalStorage.removeItem(DB.KEY);
    DB.addWrong('001');
    DB.addWrong('002');
    DB.removeWrong('001');
    var data = DB.get();
    assert.strictEqual(data.wrong.length, 1);
    assert.strictEqual(data.wrong[0].qid, '002');
});

test('DB.findQ() should find existing question', function() {
    var q = DB.findQ('001');
    assert.strictEqual(q.id, '001');
    assert.strictEqual(q.category, '专辑');
});

test('DB.findQ() should return null for non-existent question', function() {
    var q = DB.findQ('nonexistent');
    assert.strictEqual(q, null);
});

test('shuffle() should maintain array length', function() {
    var arr = [1, 2, 3, 4, 5];
    var shuffled = shuffle(arr);
    assert.strictEqual(shuffled.length, 5);
});

test('shuffle() should contain all original elements', function() {
    var arr = [1, 2, 3, 4, 5];
    var shuffled = shuffle(arr);
    shuffled.forEach(function(n) {
        assert(arr.indexOf(n) !== -1, 'element ' + n + ' should be in original array');
    });
});

test('fmtTime() should format time correctly', function() {
    assert.strictEqual(fmtTime(0), '0分0秒');
    assert.strictEqual(fmtTime(5000), '0分5秒');
    assert.strictEqual(fmtTime(65000), '1分5秒');
    assert.strictEqual(fmtTime(3660000), '61分0秒');
});

test('getCount() should return correct count for different modes', function() {
    assert.strictEqual(getCount('quick'), 10);
    assert.strictEqual(getCount('standard'), 20);
    assert.strictEqual(getCount('intensive'), 30);
    assert.strictEqual(getCount('unknown'), 10);
});

test('saveQuestionBank and loadQuestionBank should work correctly', function() {
    mockLocalStorage.removeItem('jj_question_bank');
    var originalLength = QUESTION_BANK.length;
    var newQuestion = {
        id: 'test_new',
        category: '专辑',
        question: '测试题目',
        options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }],
        answer: 'A',
        explanation: '测试解析'
    };
    QUESTION_BANK.push(newQuestion);
    saveQuestionBank();
    QUESTION_BANK = [];
    loadQuestionBank();
    assert.strictEqual(QUESTION_BANK.length, originalLength + 1);
    var found = false;
    for (var i = 0; i < QUESTION_BANK.length; i++) {
        if (QUESTION_BANK[i].id === 'test_new') {
            found = true;
            break;
        }
    }
    assert(found, 'test question should be found');
    QUESTION_BANK = QUESTION_BANK.filter(function(q) { return q.id !== 'test_new'; });
    saveQuestionBank();
});

console.log('\n========== 测试结果 ==========');
console.log('通过: ' + passed + ', 失败: ' + failed);
console.log('总计: ' + (passed + failed) + ' 个测试');

if (failed > 0) {
    process.exit(1);
}