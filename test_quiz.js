var QUESTION_BANK = [];
var DEFAULT_QUESTION_BANK = [];

var DB = {
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
            if(!d.stats.cats[q.category]) d.stats.cats[q.category] = {t:0,c:0};
            d.stats.cats[q.category].t++;
            if(rec.ok) d.stats.cats[q.category].c++;
        }
        DB.save(d);
    },
    addWrong: function(qid){
        var d = DB.get();
        var f = null;
        for(var i=0;i<d.wrong.length;i++){
            if(d.wrong[i].qid === qid){ f = d.wrong[i]; break; }
        }
        if(f){ f.cnt++; f.time = Date.now(); }
        else { d.wrong.push({qid: qid, cnt:1, time:Date.now()}); }
        DB.save(d);
    },
    removeWrong: function(qid){
        var d = DB.get();
        d.wrong = d.wrong.filter(function(w){ return w.qid !== qid; });
        DB.save(d);
    },
    getWrong: function(){ return DB.get().wrong; },
    findQ: function(qid){
        for(var i=0;i<QUESTION_BANK.length;i++){
            if(QUESTION_BANK[i].id === qid) return QUESTION_BANK[i];
        }
        return null;
    }
};

function shuffle(arr){
    var a = arr.slice();
    for(var i=a.length-1;i>0;i--){
        var j = Math.floor(Math.random()*(i+1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
}

function parseOptions(optsText){
    var lines = optsText.split('\n');
    var options = [];
    for(var i=0;i<lines.length;i++){
        var line = lines[i].trim();
        if(!line) continue;
        var match = line.match(/^([A-D])[.、．]\s*(.+)$/);
        if(match){
            options.push({ key: match[1], text: match[2] });
        }
    }
    return options;
}

function mergeUserData(existing, imported){
    if(imported.history){
        existing.history = existing.history.concat(imported.history);
    }
    if(imported.wrong){
        var wrongMap = {};
        for(var w=0;w<existing.wrong.length;w++){
            wrongMap[existing.wrong[w].qid] = existing.wrong[w];
        }
        for(var x=0;x<imported.wrong.length;x++){
            var wrongItem = imported.wrong[x];
            if(wrongMap[wrongItem.qid]){
                wrongMap[wrongItem.qid].cnt += wrongItem.cnt;
            } else {
                existing.wrong.push(wrongItem);
            }
        }
    }
    if(imported.stats){
        if(!existing.stats) existing.stats = {total:0, correct:0, cats:{}};
        existing.stats.total += imported.stats.total || 0;
        existing.stats.correct += imported.stats.correct || 0;
        if(imported.stats.cats){
            for(var catName in imported.stats.cats){
                if(!existing.stats.cats[catName]){
                    existing.stats.cats[catName] = {t:0, c:0};
                }
                existing.stats.cats[catName].t += imported.stats.cats[catName].t || 0;
                existing.stats.cats[catName].c += imported.stats.cats[catName].c || 0;
            }
        }
    }
    return existing;
}

function runTests(){
    var tests = [
        { name: 'DB模块初始化测试', fn: testDBInit },
        { name: 'DB addRecord测试', fn: testDBAddRecord },
        { name: 'DB addWrong重复添加测试', fn: testDBAddWrongDuplicate },
        { name: 'DB removeWrong测试', fn: testDBRemoveWrong },
        { name: '选项解析测试-标准格式', fn: testParseOptionsStandard },
        { name: '选项解析测试-中文句号', fn: testParseOptionsChinesePeriod },
        { name: '选项解析测试-空行过滤', fn: testParseOptionsEmptyLines },
        { name: '选项解析测试-无效格式', fn: testParseOptionsInvalid },
        { name: 'shuffle函数测试', fn: testShuffle },
        { name: '用户数据合并测试', fn: testMergeUserData },
        { name: '统计计算测试', fn: testStatsCalculation }
    ];
    
    var passed = 0;
    var failed = 0;
    var results = [];
    
    localStorage.clear();
    
    for(var i=0;i<tests.length;i++){
        try {
            tests[i].fn();
            passed++;
            results.push('✓ ' + tests[i].name);
        } catch(e) {
            failed++;
            results.push('✗ ' + tests[i].name + ': ' + e.message);
        }
    }
    
    console.log('========== 测试结果 ==========');
    for(var j=0;j<results.length;j++){
        console.log(results[j]);
    }
    console.log('------------------------------');
    console.log('通过: ' + passed + ' / 失败: ' + failed);
    console.log('==============================');
    
    return { passed: passed, failed: failed, results: results };
}

function testDBInit(){
    localStorage.clear();
    var data = DB.get();
    if(!data || !data.history || !data.wrong || !data.stats){
        throw new Error('DB初始化失败');
    }
    if(data.stats.total !== 0 || data.stats.correct !== 0){
        throw new Error('初始统计值不正确');
    }
}

function testDBAddRecord(){
    localStorage.clear();
    QUESTION_BANK = [{id:'test1', category:'测试', question:'测试题', options:[], answer:'A', explanation:''}];
    
    DB.addRecord({qid:'test1', ans:'A', ok:true, time:Date.now()});
    var data = DB.get();
    
    if(data.history.length !== 1){
        throw new Error('历史记录添加失败');
    }
    if(data.stats.total !== 1 || data.stats.correct !== 1){
        throw new Error('统计更新失败');
    }
    if(!data.stats.cats['测试'] || data.stats.cats['测试'].t !== 1 || data.stats.cats['测试'].c !== 1){
        throw new Error('分类统计更新失败');
    }
}

function testDBAddWrongDuplicate(){
    localStorage.clear();
    
    DB.addWrong('q1');
    DB.addWrong('q1');
    DB.addWrong('q2');
    
    var wrong = DB.getWrong();
    
    if(wrong.length !== 2){
        throw new Error('错题数量不正确');
    }
    
    var q1Item = wrong.find(function(w){ return w.qid === 'q1'; });
    if(!q1Item || q1Item.cnt !== 2){
        throw new Error('重复错题计数失败');
    }
}

function testDBRemoveWrong(){
    localStorage.clear();
    
    DB.addWrong('q1');
    DB.addWrong('q2');
    DB.removeWrong('q1');
    
    var wrong = DB.getWrong();
    
    if(wrong.length !== 1){
        throw new Error('错题删除后数量不正确');
    }
    if(wrong[0].qid !== 'q2'){
        throw new Error('删除了错误的错题');
    }
}

function testParseOptionsStandard(){
    var input = 'A.选项1\nB.选项2\nC.选项3\nD.选项4';
    var result = parseOptions(input);
    
    if(result.length !== 4){
        throw new Error('选项数量不正确');
    }
    if(result[0].key !== 'A' || result[0].text !== '选项1'){
        throw new Error('选项解析失败');
    }
}

function testParseOptionsChinesePeriod(){
    var input = 'A．选项1\nB、选项2\nC.选项3';
    var result = parseOptions(input);
    
    if(result.length !== 3){
        throw new Error('中文标点解析失败');
    }
}

function testParseOptionsEmptyLines(){
    var input = 'A.选项1\n\nB.选项2\n\n\nC.选项3';
    var result = parseOptions(input);
    
    if(result.length !== 3){
        throw new Error('空行过滤失败');
    }
}

function testParseOptionsInvalid(){
    var input = 'A.选项1\n无效行\nB选项2\nC. 选项3';
    var result = parseOptions(input);
    
    if(result.length !== 2){
        throw new Error('无效格式处理失败');
    }
}

function testShuffle(){
    var arr = [1,2,3,4,5,6,7,8,9,10];
    var results = [];
    
    for(var i=0;i<100;i++){
        var shuffled = shuffle(arr);
        results.push(shuffled.join(','));
    }
    
    var unique = [...new Set(results)];
    if(unique.length < 50){
        throw new Error('shuffle随机性不足');
    }
    
    var stillSorted = results.filter(function(r){ return r === '1,2,3,4,5,6,7,8,9,10'; });
    if(stillSorted.length > 5){
        throw new Error('shuffle排序保持概率过高');
    }
}

function testMergeUserData(){
    var existing = {
        history: [{qid:'q1', ok:true}],
        wrong: [{qid:'q1', cnt:1, time:1000}],
        stats: { total:1, correct:1, cats:{'专辑':{t:1, c:1}} }
    };
    
    var imported = {
        history: [{qid:'q2', ok:false}],
        wrong: [{qid:'q1', cnt:2, time:2000}, {qid:'q3', cnt:1, time:3000}],
        stats: { total:2, correct:1, cats:{'歌曲':{t:2, c:1}, '专辑':{t:1, c:0}} }
    };
    
    var result = mergeUserData(existing, imported);
    
    if(result.history.length !== 2){
        throw new Error('历史记录合并失败');
    }
    if(result.wrong.length !== 2){
        throw new Error('错题合并失败');
    }
    var q1Wrong = result.wrong.find(function(w){ return w.qid === 'q1'; });
    if(q1Wrong.cnt !== 3){
        throw new Error('错题计数合并失败');
    }
    if(result.stats.total !== 3 || result.stats.correct !== 2){
        throw new Error('统计合并失败');
    }
    if(result.stats.cats['专辑'].t !== 2 || result.stats.cats['专辑'].c !== 1){
        throw new Error('分类统计合并失败');
    }
}

function testStatsCalculation(){
    localStorage.clear();
    QUESTION_BANK = [
        {id:'q1', category:'专辑', question:'', options:[], answer:'A', explanation:''},
        {id:'q2', category:'专辑', question:'', options:[], answer:'B', explanation:''},
        {id:'q3', category:'歌曲', question:'', options:[], answer:'C', explanation:''}
    ];
    
    DB.addRecord({qid:'q1', ans:'A', ok:true, time:Date.now()});
    DB.addRecord({qid:'q2', ans:'C', ok:false, time:Date.now()});
    DB.addRecord({qid:'q3', ans:'C', ok:true, time:Date.now()});
    
    var data = DB.get();
    
    if(data.stats.total !== 3 || data.stats.correct !== 2){
        throw new Error('总体统计计算失败');
    }
    if(data.stats.cats['专辑'].t !== 2 || data.stats.cats['专辑'].c !== 1){
        throw new Error('专辑分类统计失败');
    }
    if(data.stats.cats['歌曲'].t !== 1 || data.stats.cats['歌曲'].c !== 1){
        throw new Error('歌曲分类统计失败');
    }
}

if(typeof module !== 'undefined' && module.exports){
    module.exports = {
        DB: DB,
        shuffle: shuffle,
        parseOptions: parseOptions,
        mergeUserData: mergeUserData,
        runTests: runTests
    };
}
