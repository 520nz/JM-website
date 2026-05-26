function createQuizModule() {
    var QUESTION_BANK = [
    {id:"001",category:"专辑",question:"林俊杰首张专辑《乐行者》发行于哪一天？",options:[{key:"A",text:"2003年4月1日"},{key:"B",text:"2003年4月10日"},{key:"C",text:"2003年5月1日"},{key:"D",text:"2003年5月10日"}],answer:"B",explanation:"《乐行者》于2003年4月10日正式发行，这也是林俊杰的出道专辑。"},
    {id:"005",category:"专辑",question:"《第二天堂》（俗称《江南》专辑）发行于哪一年？",options:[{key:"A",text:"2003年"},{key:"B",text:"2004年"},{key:"C",text:"2005年"},{key:"D",text:"2006年"}],answer:"B",explanation:"《第二天堂》于2004年6月4日发行，包含热门歌曲《江南》。"},
    {id:"061",category:"个人信息",question:"林俊杰的本名（非艺名）是什么？",options:[{key:"A",text:"JJ Lin"},{key:"B",text:"Wayne"},{key:"C",text:"Lim Junjie"},{key:"D",text:"林俊峰"}],answer:"B",explanation:"林俊杰本名Wayne，JJ Lin为艺名，Lim Junjie为外文名拼音。"}
    ];

    var DEFAULT_QUESTION_BANK = JSON.parse(JSON.stringify(QUESTION_BANK));

    var state = {
        quiz: [],
        idx: 0,
        answered: false,
        mode: 'quick',
        correctCount: 0,
        startTime: 0,
        timer: null
    };

    var DB = {
        KEY: 'jj_quiz_v2',
        get: function() {
            var d = localStorage.getItem(DB.KEY);
            return d ? JSON.parse(d) : DB.defaults();
        },
        defaults: function() {
            return {history: [], wrong: [], stats: {total: 0, correct: 0, cats: {}}};
        },
        save: function(d) {
            localStorage.setItem(DB.KEY, JSON.stringify(d));
        },
        addRecord: function(rec) {
            var d = DB.get();
            d.history.push(rec);
            d.stats.total++;
            if (rec.ok) d.stats.correct++;
            var q = DB.findQ(rec.qid);
            if (q) {
                if (!d.stats.cats[q.category]) d.stats.cats[q.category] = {t: 0, c: 0};
                d.stats.cats[q.category].t++;
                if (rec.ok) d.stats.cats[q.category].c++;
            }
            DB.save(d);
        },
        addWrong: function(qid) {
            var d = DB.get();
            var f = null;
            for (var i = 0; i < d.wrong.length; i++) {
                if (d.wrong[i].qid === qid) {
                    f = d.wrong[i];
                    break;
                }
            }
            if (f) {
                f.cnt++;
                f.time = Date.now();
            } else {
                d.wrong.push({qid: qid, cnt: 1, time: Date.now()});
            }
            DB.save(d);
        },
        removeWrong: function(qid) {
            var d = DB.get();
            d.wrong = d.wrong.filter(function(w) { return w.qid !== qid; });
            DB.save(d);
        },
        getWrong: function() {
            return DB.get().wrong;
        },
        findQ: function(qid) {
            for (var i = 0; i < QUESTION_BANK.length; i++) {
                if (QUESTION_BANK[i].id === qid) return QUESTION_BANK[i];
            }
            return null;
        }
    };

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

    function parseOptions(optsText) {
        var lines = optsText.split('\n');
        var options = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            var match = line.match(/^([A-D])[.、．]\s*(.+)$/);
            if (match) {
                options.push({key: match[1], text: match[2]});
            }
        }
        return options;
    }

    function saveQuestionBank() {
        localStorage.setItem('jj_question_bank', JSON.stringify(QUESTION_BANK));
    }

    function loadQuestionBank() {
        var saved = localStorage.getItem('jj_question_bank');
        if (saved) {
            try {
                var loaded = JSON.parse(saved);
                QUESTION_BANK.length = 0;
                for (var i = 0; i < loaded.length; i++) {
                    QUESTION_BANK.push(loaded[i]);
                }
            } catch (e) {}
        }
    }

    function resetQuestionBank() {
        QUESTION_BANK.length = 0;
        for (var i = 0; i < DEFAULT_QUESTION_BANK.length; i++) {
            QUESTION_BANK.push(JSON.parse(JSON.stringify(DEFAULT_QUESTION_BANK[i])));
        }
        localStorage.removeItem('jj_question_bank');
    }

    function validateAnswer(key, q) {
        return key === q.answer;
    }

    function calculateAccuracy(correct, total) {
        return total > 0 ? Math.round(correct / total * 100) : 0;
    }

    function getTodayRecords() {
        var d = DB.get();
        var today = new Date().setHours(0, 0, 0, 0);
        return d.history.filter(function(h) { return h.time >= today; });
    }

    function getCategoryStats() {
        var d = DB.get();
        return d.stats.cats || {};
    }

    function mergeImportedData(data) {
        var addedCount = 0;
        var updatedCount = 0;
        
        if (data.questionBank) {
            var existingIds = {};
            for (var i = 0; i < QUESTION_BANK.length; i++) {
                existingIds[QUESTION_BANK[i].id] = i;
            }
            for (var j = 0; j < data.questionBank.length; j++) {
                var q = data.questionBank[j];
                if (existingIds[q.id] !== undefined) {
                    var idx = existingIds[q.id];
                    QUESTION_BANK[idx] = JSON.parse(JSON.stringify(q));
                    updatedCount++;
                } else {
                    QUESTION_BANK.push(JSON.parse(JSON.stringify(q)));
                    addedCount++;
                }
            }
            saveQuestionBank();
        }
        
        if (data.userData) {
            var existingData = DB.get();
            if (data.userData.history) {
                existingData.history = existingData.history.concat(data.userData.history);
            }
            if (data.userData.wrong) {
                var wrongMap = {};
                for (var w = 0; w < existingData.wrong.length; w++) {
                    wrongMap[existingData.wrong[w].qid] = existingData.wrong[w];
                }
                for (var x = 0; x < data.userData.wrong.length; x++) {
                    var wrongItem = data.userData.wrong[x];
                    if (wrongMap[wrongItem.qid]) {
                        wrongMap[wrongItem.qid].cnt += wrongItem.cnt;
                    } else {
                        existingData.wrong.push(wrongItem);
                    }
                }
            }
            if (data.userData.stats) {
                if (!existingData.stats) existingData.stats = {total: 0, correct: 0, cats: {}};
                existingData.stats.total += data.userData.stats.total || 0;
                existingData.stats.correct += data.userData.stats.correct || 0;
                if (data.userData.stats.cats) {
                    for (var catName in data.userData.stats.cats) {
                        if (!existingData.stats.cats[catName]) {
                            existingData.stats.cats[catName] = {t: 0, c: 0};
                        }
                        existingData.stats.cats[catName].t += data.userData.stats.cats[catName].t || 0;
                        existingData.stats.cats[catName].c += data.userData.stats.cats[catName].c || 0;
                    }
                }
            }
            DB.save(existingData);
        }
        
        return {addedCount: addedCount, updatedCount: updatedCount};
    }

    function resetForTest() {
        QUESTION_BANK.length = 0;
        for (var i = 0; i < DEFAULT_QUESTION_BANK.length; i++) {
            QUESTION_BANK.push(JSON.parse(JSON.stringify(DEFAULT_QUESTION_BANK[i])));
        }
        localStorage.clear();
    }

    return {
        QUESTION_BANK: QUESTION_BANK,
        DEFAULT_QUESTION_BANK: DEFAULT_QUESTION_BANK,
        DB: DB,
        state: state,
        shuffle: shuffle,
        parseOptions: parseOptions,
        saveQuestionBank: saveQuestionBank,
        loadQuestionBank: loadQuestionBank,
        resetQuestionBank: resetQuestionBank,
        validateAnswer: validateAnswer,
        calculateAccuracy: calculateAccuracy,
        getTodayRecords: getTodayRecords,
        getCategoryStats: getCategoryStats,
        mergeImportedData: mergeImportedData,
        resetForTest: resetForTest
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = createQuizModule();
} else {
    window.QuizApp = createQuizModule();
}