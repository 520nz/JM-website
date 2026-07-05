const QUESTION_BANK = [
  {id:"001",category:"专辑",question:"测试题目1",options:[{key:"A",text:"选项A"},{key:"B",text:"选项B"},{key:"C",text:"选项C"},{key:"D",text:"选项D"}],answer:"B",explanation:"解析1"},
  {id:"002",category:"歌曲",question:"测试题目2",options:[{key:"A",text:"选项A"},{key:"B",text:"选项B"}],answer:"A",explanation:"解析2"},
  {id:"003",category:"个人信息",question:"测试题目3",options:[{key:"A",text:"选项A"},{key:"B",text:"选项B"},{key:"C",text:"选项C"}],answer:"C",explanation:"解析3"},
];

const DEFAULT_QUESTION_BANK = QUESTION_BANK.slice();

const DB = {
    KEY: 'jj_quiz_v2',
    get: function(){ var d = localStorage.getItem(DB.KEY); return d ? JSON.parse(d) : DB.defaults(); },
    defaults: function(){ return {history:[], wrong:[], stats:{total:0, correct:0, cats:{}}}; },
    save: function(d){ localStorage.setItem(DB.KEY, JSON.stringify(d)); },
    addRecord: function(rec){
        var d = DB.get();
        d.history.push(rec);
        d.stats.total++;
        if(rec.ok) d.stats.correct++;
        var q = DB.findQ(rec.qid);
        if(q){
            if(!d.stats.cats[q.category]) d.stats.cats[q.category] = {t:0, c:0};
            d.stats.cats[q.category].t++;
            if(rec.ok) d.stats.cats[q.category].c++;
        }
        DB.save(d);
    },
    addWrong: function(qid){
        var d = DB.get();
        var f = null;
        for(var i=0; i<d.wrong.length; i++){
            if(d.wrong[i].qid === qid){ f = d.wrong[i]; break; }
        }
        if(f){ f.cnt++; f.time = Date.now(); }
        else{ d.wrong.push({qid: qid, cnt:1, time: Date.now()}); }
        DB.save(d);
    },
    removeWrong: function(qid){
        var d = DB.get();
        d.wrong = d.wrong.filter(function(w){ return w.qid !== qid; });
        DB.save(d);
    },
    getWrong: function(){ return DB.get().wrong; },
    findQ: function(qid){
        for(var i=0; i<QUESTION_BANK.length; i++){
            if(QUESTION_BANK[i].id === qid) return QUESTION_BANK[i];
        }
        return null;
    }
};

function parseOptions(optsText) {
    var lines = optsText.split('\n');
    var options = [];
    for(var i=0; i<lines.length; i++){
        var line = lines[i].trim();
        if(!line) continue;
        var match = line.match(/^([A-D])[.、．]\s*(.+)$/);
        if(match){
            options.push({key: match[1], text: match[2]});
        }
    }
    return options;
}

function shuffle(arr){
    var a = arr.slice();
    for(var i=a.length-1; i>0; i--){
        var j = Math.floor(Math.random()*(i+1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
}

function calculateAccuracy(total, correct) {
    return total > 0 ? Math.round(correct / total * 100) : 0;
}

function mergeUserData(existing, incoming) {
    if (!incoming) return existing;
    
    if (incoming.history) {
        existing.history = existing.history.concat(incoming.history);
    }
    
    if (incoming.wrong) {
        var wrongMap = {};
        for(var w=0; w<existing.wrong.length; w++){
            wrongMap[existing.wrong[w].qid] = existing.wrong[w];
        }
        for(var x=0; x<incoming.wrong.length; x++){
            var wrongItem = incoming.wrong[x];
            if(wrongMap[wrongItem.qid]){
                wrongMap[wrongItem.qid].cnt += wrongItem.cnt;
            } else {
                existing.wrong.push(wrongItem);
            }
        }
    }
    
    if (incoming.stats) {
        if(!existing.stats) existing.stats = {total:0, correct:0, cats:{}};
        existing.stats.total += incoming.stats.total || 0;
        existing.stats.correct += incoming.stats.correct || 0;
        if(incoming.stats.cats){
            for(var catName in incoming.stats.cats){
                if(!existing.stats.cats[catName]){
                    existing.stats.cats[catName] = {t:0, c:0};
                }
                existing.stats.cats[catName].t += incoming.stats.cats[catName].t || 0;
                existing.stats.cats[catName].c += incoming.stats.cats[catName].c || 0;
            }
        }
    }
    
    return existing;
}

function mergeQuestionBank(existing, incoming) {
    if (!incoming || !incoming.length) return {added: 0, updated: 0};
    
    var existingIds = {};
    for(var i=0; i<existing.length; i++){
        existingIds[existing[i].id] = true;
    }
    
    var addedCount = 0;
    var updatedCount = 0;
    
    for(var j=0; j<incoming.length; j++){
        var q = incoming[j];
        if(existingIds[q.id]){
            for(var k=0; k<existing.length; k++){
                if(existing[k].id === q.id){
                    existing[k] = q;
                    updatedCount++;
                    break;
                }
            }
        } else {
            existing.push(q);
            addedCount++;
        }
    }
    
    return {added: addedCount, updated: updatedCount};
}

global.localStorage = {
    data: {},
    getItem: function(key) { return this.data[key] || null; },
    setItem: function(key, value) { this.data[key] = value; },
    removeItem: function(key) { delete this.data[key]; },
    clear: function() { this.data = {}; }
};

beforeEach(() => {
    localStorage.clear();
});

describe('DB存储模块', () => {
    test('get() 初始化返回默认值', () => {
        const data = DB.get();
        expect(data).toEqual({history: [], wrong: [], stats: {total: 0, correct: 0, cats: {}}});
    });

    test('save() 和 get() 能够正确持久化数据', () => {
        const testData = {history: [], wrong: [], stats: {total: 10, correct: 8, cats: {}}};
        DB.save(testData);
        const retrieved = DB.get();
        expect(retrieved).toEqual(testData);
    });

    test('findQ() 能正确查找题目', () => {
        const q = DB.findQ('001');
        expect(q).not.toBeNull();
        expect(q.id).toBe('001');
        expect(q.category).toBe('专辑');
    });

    test('findQ() 返回不存在的题目的null', () => {
        const q = DB.findQ('999');
        expect(q).toBeNull();
    });

    test('addRecord() 增加正确答题记录', () => {
        DB.addRecord({qid: '001', ans: 'B', ok: true, time: Date.now()});
        const data = DB.get();
        expect(data.history.length).toBe(1);
        expect(data.stats.total).toBe(1);
        expect(data.stats.correct).toBe(1);
        expect(data.stats.cats['专辑']).toEqual({t: 1, c: 1});
    });

    test('addRecord() 增加错误答题记录', () => {
        DB.addRecord({qid: '001', ans: 'A', ok: false, time: Date.now()});
        const data = DB.get();
        expect(data.history.length).toBe(1);
        expect(data.stats.total).toBe(1);
        expect(data.stats.correct).toBe(0);
        expect(data.stats.cats['专辑']).toEqual({t: 1, c: 0});
    });

    test('addWrong() 添加新错题', () => {
        DB.addWrong('001');
        const data = DB.get();
        expect(data.wrong.length).toBe(1);
        expect(data.wrong[0].qid).toBe('001');
        expect(data.wrong[0].cnt).toBe(1);
    });

    test('addWrong() 增加已有错题计数', () => {
        DB.addWrong('001');
        DB.addWrong('001');
        const data = DB.get();
        expect(data.wrong.length).toBe(1);
        expect(data.wrong[0].cnt).toBe(2);
    });

    test('removeWrong() 移除错题', () => {
        DB.addWrong('001');
        DB.removeWrong('001');
        const data = DB.get();
        expect(data.wrong.length).toBe(0);
    });

    test('getWrong() 返回错题列表', () => {
        DB.addWrong('001');
        DB.addWrong('002');
        const wrong = DB.getWrong();
        expect(wrong.length).toBe(2);
        expect(wrong[0].qid).toBe('001');
        expect(wrong[1].qid).toBe('002');
    });
});

describe('选项解析逻辑', () => {
    test('正确解析标准格式选项', () => {
        const optsText = 'A.选项1\nB.选项2\nC.选项3\nD.选项4';
        const options = parseOptions(optsText);
        expect(options.length).toBe(4);
        expect(options[0]).toEqual({key: 'A', text: '选项1'});
        expect(options[1]).toEqual({key: 'B', text: '选项2'});
        expect(options[2]).toEqual({key: 'C', text: '选项3'});
        expect(options[3]).toEqual({key: 'D', text: '选项4'});
    });

    test('解析中文句号格式选项', () => {
        const optsText = 'A．选项1\nB．选项2\nC．选项3';
        const options = parseOptions(optsText);
        expect(options.length).toBe(3);
        expect(options[0].key).toBe('A');
        expect(options[1].key).toBe('B');
        expect(options[2].key).toBe('C');
    });

    test('解析全角顿号格式选项', () => {
        const optsText = 'A、选项1\nB、选项2';
        const options = parseOptions(optsText);
        expect(options.length).toBe(2);
        expect(options[0].key).toBe('A');
        expect(options[1].key).toBe('B');
    });

    test('跳过空行', () => {
        const optsText = 'A.选项1\n\nB.选项2\n\n\nC.选项3';
        const options = parseOptions(optsText);
        expect(options.length).toBe(3);
    });

    test('忽略无效格式行', () => {
        const optsText = 'A.选项1\n无效行\nB.选项2\nE.选项5';
        const options = parseOptions(optsText);
        expect(options.length).toBe(2);
        expect(options[0].key).toBe('A');
        expect(options[1].key).toBe('B');
    });

    test('处理选项前空格', () => {
        const optsText = 'A. 选项1\nB.  选项2\nC.   选项3';
        const options = parseOptions(optsText);
        expect(options.length).toBe(3);
        expect(options[0].text).toBe('选项1');
        expect(options[1].text).toBe('选项2');
        expect(options[2].text).toBe('选项3');
    });
});

describe('统计计算功能', () => {
    test('calculateAccuracy() 计算正确率', () => {
        expect(calculateAccuracy(10, 5)).toBe(50);
        expect(calculateAccuracy(20, 15)).toBe(75);
        expect(calculateAccuracy(0, 0)).toBe(0);
        expect(calculateAccuracy(100, 100)).toBe(100);
        expect(calculateAccuracy(7, 4)).toBe(57);
    });

    test('addRecord() 更新分类统计', () => {
        DB.addRecord({qid: '001', ans: 'B', ok: true, time: Date.now()});
        DB.addRecord({qid: '001', ans: 'A', ok: false, time: Date.now()});
        DB.addRecord({qid: '002', ans: 'A', ok: true, time: Date.now()});
        
        const data = DB.get();
        expect(data.stats.cats['专辑']).toEqual({t: 2, c: 1});
        expect(data.stats.cats['歌曲']).toEqual({t: 1, c: 1});
        expect(data.stats.total).toBe(3);
        expect(data.stats.correct).toBe(2);
    });
});

describe('数据导入导出逻辑', () => {
    test('mergeQuestionBank() 新增题目', () => {
        const existing = QUESTION_BANK.slice();
        const incoming = [{id: 'new001', category: '测试', question: '新题', options: [{key:'A',text:'A'}], answer: 'A', explanation: '解析'}];
        
        const result = mergeQuestionBank(existing, incoming);
        expect(result.added).toBe(1);
        expect(result.updated).toBe(0);
        expect(existing.length).toBe(4);
        expect(existing[3].id).toBe('new001');
    });

    test('mergeQuestionBank() 更新已有题目', () => {
        const existing = QUESTION_BANK.slice();
        const originalQuestion = existing[0].question;
        const incoming = [{id: '001', category: '专辑', question: '更新后的题目', options: [{key:'A',text:'A'}], answer: 'A', explanation: '解析'}];
        
        const result = mergeQuestionBank(existing, incoming);
        expect(result.added).toBe(0);
        expect(result.updated).toBe(1);
        expect(existing.length).toBe(3);
        expect(existing[0].question).toBe('更新后的题目');
        expect(existing[0].question).not.toBe(originalQuestion);
    });

    test('mergeQuestionBank() 同时新增和更新', () => {
        const existing = QUESTION_BANK.slice();
        const incoming = [
            {id: '001', category: '专辑', question: '更新', options: [{key:'A',text:'A'}], answer: 'A', explanation: '解析'},
            {id: 'new001', category: '测试', question: '新题', options: [{key:'A',text:'A'}], answer: 'A', explanation: '解析'}
        ];
        
        const result = mergeQuestionBank(existing, incoming);
        expect(result.added).toBe(1);
        expect(result.updated).toBe(1);
    });

    test('mergeUserData() 合并历史记录', () => {
        const existing = {history: [], wrong: [], stats: {total: 0, correct: 0, cats: {}}};
        const incoming = {
            history: [{qid: '001', ans: 'B', ok: true, time: 123}],
            wrong: [{qid: '002', cnt: 2, time: 456}],
            stats: {total: 5, correct: 3, cats: {'专辑': {t: 3, c: 2}}}
        };
        
        const result = mergeUserData(existing, incoming);
        expect(result.history.length).toBe(1);
        expect(result.wrong.length).toBe(1);
        expect(result.stats.total).toBe(5);
        expect(result.stats.correct).toBe(3);
        expect(result.stats.cats['专辑']).toEqual({t: 3, c: 2});
    });

    test('mergeUserData() 合并错题计数', () => {
        const existing = {history: [], wrong: [{qid: '001', cnt: 1, time: 100}], stats: {total: 0, correct: 0, cats: {}}};
        const incoming = {wrong: [{qid: '001', cnt: 2, time: 200}, {qid: '002', cnt: 1, time: 300}]};
        
        const result = mergeUserData(existing, incoming);
        expect(result.wrong.length).toBe(2);
        expect(result.wrong[0].cnt).toBe(3);
        expect(result.wrong[1].qid).toBe('002');
        expect(result.wrong[1].cnt).toBe(1);
    });

    test('mergeUserData() 合并分类统计', () => {
        const existing = {history: [], wrong: [], stats: {total: 10, correct: 6, cats: {'专辑': {t: 5, c: 3}}}};
        const incoming = {stats: {total: 5, correct: 4, cats: {'专辑': {t: 3, c: 3}, '歌曲': {t: 2, c: 1}}}};
        
        const result = mergeUserData(existing, incoming);
        expect(result.stats.total).toBe(15);
        expect(result.stats.correct).toBe(10);
        expect(result.stats.cats['专辑']).toEqual({t: 8, c: 6});
        expect(result.stats.cats['歌曲']).toEqual({t: 2, c: 1});
    });
});

describe('题库操作', () => {
    test('resetQuestionBank() 恢复默认题库', () => {
        const modifiedBank = [...QUESTION_BANK, {id: 'extra', category: '测试', question: '额外题目', options: [{key:'A',text:'A'}], answer: 'A', explanation: ''}];
        expect(modifiedBank.length).toBe(4);
        
        const resetBank = DEFAULT_QUESTION_BANK.slice();
        expect(resetBank.length).toBe(3);
        expect(resetBank[0].id).toBe('001');
    });
});

describe('随机打乱函数', () => {
    test('shuffle() 返回相同长度的数组', () => {
        const arr = [1, 2, 3, 4, 5];
        const shuffled = shuffle(arr);
        expect(shuffled.length).toBe(5);
    });

    test('shuffle() 不修改原数组', () => {
        const arr = [1, 2, 3];
        const original = arr.slice();
        shuffle(arr);
        expect(arr).toEqual(original);
    });

    test('shuffle() 返回包含所有原元素的数组', () => {
        const arr = [1, 2, 3, 4, 5];
        const shuffled = shuffle(arr);
        expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5]);
    });
});

describe('边界条件测试', () => {
    test('空题库时 findQ 返回 null', () => {
        const emptyBank = [];
        const findQEmpty = (qid) => {
            for(var i=0; i<emptyBank.length; i++){
                if(emptyBank[i].id === qid) return emptyBank[i];
            }
            return null;
        };
        expect(findQEmpty('001')).toBeNull();
    });

    test('空错题列表时 getWrong 返回空数组', () => {
        expect(DB.getWrong()).toEqual([]);
    });

    test('解析空选项文本返回空数组', () => {
        const options = parseOptions('');
        expect(options.length).toBe(0);
    });

    test('解析仅空格的选项文本返回空数组', () => {
        const options = parseOptions('   \n  \n');
        expect(options.length).toBe(0);
    });

    test('无效题目ID的 addRecord 不更新分类统计', () => {
        DB.addRecord({qid: 'nonexistent', ans: 'A', ok: true, time: Date.now()});
        const data = DB.get();
        expect(data.stats.total).toBe(1);
        expect(data.stats.correct).toBe(1);
        expect(Object.keys(data.stats.cats).length).toBe(0);
    });
});