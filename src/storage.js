var QUESTION_BANK = [];
var DEFAULT_QUESTION_BANK = [];

function initQuestionBank(bank) {
    QUESTION_BANK = bank;
    DEFAULT_QUESTION_BANK = bank.slice();
}

function setQuestionBank(bank) {
    QUESTION_BANK = bank;
}

function getQuestionBank() {
    return QUESTION_BANK;
}

function getDefaultQuestionBank() {
    return DEFAULT_QUESTION_BANK;
}

var DB = {
    KEY: 'jj_quiz_v2',
    get: function () {
        var d = localStorage.getItem(DB.KEY);
        return d ? JSON.parse(d) : DB.defaults();
    },
    defaults: function () {
        return { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } };
    },
    save: function (d) {
        localStorage.setItem(DB.KEY, JSON.stringify(d));
    },
    addRecord: function (rec) {
        var d = DB.get();
        d.history.push(rec);
        d.stats.total++;
        if (rec.ok) d.stats.correct++;
        var q = DB.findQ(rec.qid);
        if (q) {
            if (!d.stats.cats[q.category]) d.stats.cats[q.category] = { t: 0, c: 0 };
            d.stats.cats[q.category].t++;
            if (rec.ok) d.stats.cats[q.category].c++;
        }
        DB.save(d);
    },
    addWrong: function (qid) {
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
            d.wrong.push({ qid: qid, cnt: 1, time: Date.now() });
        }
        DB.save(d);
    },
    removeWrong: function (qid) {
        var d = DB.get();
        d.wrong = d.wrong.filter(function (w) { return w.qid !== qid; });
        DB.save(d);
    },
    getWrong: function () {
        return DB.get().wrong;
    },
    findQ: function (qid) {
        for (var i = 0; i < QUESTION_BANK.length; i++) {
            if (QUESTION_BANK[i].id === qid) return QUESTION_BANK[i];
        }
        return null;
    },
    saveQuestionBank: function () {
        localStorage.setItem('jj_question_bank', JSON.stringify(QUESTION_BANK));
    },
    loadQuestionBank: function () {
        var saved = localStorage.getItem('jj_question_bank');
        if (saved) {
            try {
                QUESTION_BANK = JSON.parse(saved);
            } catch (e) { }
        }
    },
    resetQuestionBank: function () {
        QUESTION_BANK = DEFAULT_QUESTION_BANK.slice();
        localStorage.removeItem('jj_question_bank');
        return QUESTION_BANK.length;
    }
};

module.exports = {
    DB,
    QUESTION_BANK,
    DEFAULT_QUESTION_BANK,
    initQuestionBank,
    setQuestionBank,
    getQuestionBank,
    getDefaultQuestionBank
};
