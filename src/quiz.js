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

function fmtTime(ms) {
    var sec = Math.floor(ms / 1000);
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + '分' + s + '秒';
}

function getModeCount(mode) {
    var m = { quick: 10, standard: 20, intensive: 30 };
    return m[mode] || 10;
}

function generateQuestionId() {
    return 'q' + Date.now();
}

function parseOptions(optsText) {
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
    return options;
}

function validateQuestion(question, options) {
    if (!question || !options) return false;
    if (options.length < 2) return false;
    return true;
}

function calculateStats(quiz, correctCount, startTime) {
    var total = quiz.length;
    var correct = correctCount;
    var wrong = total - correct;
    var pct = total > 0 ? Math.round(correct / total * 100) : 0;
    var elapsed = Date.now() - startTime;
    return { total, correct, wrong, pct, elapsed };
}

function getTodayRecords(history) {
    var today = new Date().setHours(0, 0, 0, 0);
    return history.filter(function (h) { return h.time >= today; });
}

function calculateDailyAccuracy(records) {
    if (records.length === 0) return 0;
    var correct = records.filter(function (h) { return h.ok; }).length;
    return Math.round(correct / records.length * 100);
}

function mergeUserData(existingData, newUserData) {
    if (!newUserData) return existingData;

    if (newUserData.history) {
        existingData.history = existingData.history.concat(newUserData.history);
    }

    if (newUserData.wrong) {
        var wrongMap = {};
        for (var w = 0; w < existingData.wrong.length; w++) {
            wrongMap[existingData.wrong[w].qid] = existingData.wrong[w];
        }
        for (var x = 0; x < newUserData.wrong.length; x++) {
            var wrongItem = newUserData.wrong[x];
            if (wrongMap[wrongItem.qid]) {
                wrongMap[wrongItem.qid].cnt += wrongItem.cnt;
            } else {
                existingData.wrong.push(wrongItem);
            }
        }
    }

    if (newUserData.stats) {
        if (!existingData.stats) existingData.stats = { total: 0, correct: 0, cats: {} };
        existingData.stats.total += newUserData.stats.total || 0;
        existingData.stats.correct += newUserData.stats.correct || 0;
        if (newUserData.stats.cats) {
            for (var catName in newUserData.stats.cats) {
                if (!existingData.stats.cats[catName]) {
                    existingData.stats.cats[catName] = { t: 0, c: 0 };
                }
                existingData.stats.cats[catName].t += newUserData.stats.cats[catName].t || 0;
                existingData.stats.cats[catName].c += newUserData.stats.cats[catName].c || 0;
            }
        }
    }

    return existingData;
}

module.exports = {
    shuffle,
    fmtTime,
    getModeCount,
    generateQuestionId,
    parseOptions,
    validateQuestion,
    calculateStats,
    getTodayRecords,
    calculateDailyAccuracy,
    mergeUserData
};
