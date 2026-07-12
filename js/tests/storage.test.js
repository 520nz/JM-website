var assert = {
    equal: function(a, b, msg) {
        if (a !== b) throw new Error((msg || '') + ' Expected ' + JSON.stringify(b) + ' but got ' + JSON.stringify(a));
    },
    notEqual: function(a, b, msg) {
        if (a === b) throw new Error((msg || '') + ' Expected not equal but got ' + JSON.stringify(a));
    },
    deepEqual: function(a, b, msg) {
        if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || '') + ' Expected ' + JSON.stringify(b) + ' but got ' + JSON.stringify(a));
    },
    truthy: function(a, msg) {
        if (!a) throw new Error((msg || '') + ' Expected truthy but got ' + JSON.stringify(a));
    },
    falsy: function(a, msg) {
        if (a) throw new Error((msg || '') + ' Expected falsy but got ' + JSON.stringify(a));
    },
    throws: function(fn, msg) {
        try {
            fn();
            throw new Error((msg || '') + ' Expected exception but none was thrown');
        } catch (e) {}
    }
};

var tests = [];

function test(name, fn) {
    tests.push({ name: name, fn: fn });
}

function runTests(moduleName) {
    var passed = 0;
    var failed = 0;
    console.log('\n=== Testing ' + moduleName + ' ===');
    for (var i = 0; i < tests.length; i++) {
        try {
            tests[i].fn();
            console.log('✓ ' + tests[i].name);
            passed++;
        } catch (e) {
            console.log('✗ ' + tests[i].name + ': ' + e.message);
            failed++;
        }
    }
    console.log('=== ' + passed + '/' + tests.length + ' passed (' + failed + ' failed) ===');
    tests = [];
    return failed === 0;
}

test('esc() handles null', function() {
    assert.equal(esc(null), '');
});

test('esc() handles undefined', function() {
    assert.equal(esc(undefined), '');
});

test('esc() handles plain text', function() {
    assert.equal(esc('hello'), 'hello');
});

test('esc() escapes HTML special characters', function() {
    var result = esc('<script>alert("XSS")</script>');
    assert.equal(result.indexOf('<'), -1);
    assert.equal(result.indexOf('>'), -1);
});

test('esc() escapes ampersand', function() {
    assert.equal(esc('foo & bar'), 'foo &amp; bar');
});

test('esc() preserves quotes', function() {
    assert.equal(esc('"hello"'), '"hello"');
});

test('DB.defaults() returns initial state', function() {
    var d = DB.defaults();
    assert.deepEqual(d.history, []);
    assert.deepEqual(d.wrong, []);
    assert.deepEqual(d.stats, { total: 0, correct: 0, cats: {} });
});

test('DB.addWrong() adds new wrong question', function() {
    DB.setData(DB.defaults());
    DB.addWrong('q1');
    var d = DB.get();
    assert.equal(d.wrong.length, 1);
    assert.equal(d.wrong[0].qid, 'q1');
    assert.equal(d.wrong[0].cnt, 1);
    assert.equal(d.wrong[0].level, 0);
});

test('DB.addWrong() increments count for existing question', function() {
    DB.setData(DB.defaults());
    DB.addWrong('q1');
    DB.addWrong('q1');
    var d = DB.get();
    assert.equal(d.wrong.length, 1);
    assert.equal(d.wrong[0].cnt, 2);
    assert.equal(d.wrong[0].level, 0);
});

test('DB.reviewCorrect() increases level', function() {
    DB.setData(DB.defaults());
    DB.addWrong('q1');
    DB.reviewCorrect('q1');
    var d = DB.get();
    assert.equal(d.wrong[0].level, 1);
});

test('DB.reviewCorrect() removes question at level 5', function() {
    DB.setData(DB.defaults());
    DB.addWrong('q1');
    DB.get().wrong[0].level = 4;
    DB.reviewCorrect('q1');
    var d = DB.get();
    assert.equal(d.wrong.length, 0);
});

test('DB.reviewWrong() resets level to 0', function() {
    DB.setData(DB.defaults());
    DB.addWrong('q1');
    DB.get().wrong[0].level = 3;
    DB.reviewWrong('q1');
    var d = DB.get();
    assert.equal(d.wrong[0].level, 0);
});

test('DB.reviewWrong() increments count', function() {
    DB.setData(DB.defaults());
    DB.addWrong('q1');
    DB.reviewWrong('q1');
    var d = DB.get();
    assert.equal(d.wrong[0].cnt, 2);
});

test('DB.reviewWrong() adds new question if not in wrong list', function() {
    DB.setData(DB.defaults());
    DB.reviewWrong('q1');
    var d = DB.get();
    assert.equal(d.wrong.length, 1);
    assert.equal(d.wrong[0].qid, 'q1');
});

test('DB.removeWrong() removes question', function() {
    DB.setData(DB.defaults());
    DB.addWrong('q1');
    DB.removeWrong('q1');
    var d = DB.get();
    assert.equal(d.wrong.length, 0);
});

test('DB.getDueWrong() returns due questions', function() {
    DB.setData(DB.defaults());
    DB.addWrong('q1');
    DB.get().wrong[0].nextReview = Date.now() - 1000;
    DB.get().wrong[0].level = 1;
    DB.save();
    var due = DB.getDueWrong();
    assert.equal(due.length, 1);
});

test('DB.getDueWrong() excludes not-due questions', function() {
    DB.setData(DB.defaults());
    DB.addWrong('q1');
    DB.get().wrong[0].nextReview = Date.now() + 1000 * 60 * 60;
    DB.save();
    var due = DB.getDueWrong();
    assert.equal(due.length, 0);
});

test('DB.addRecord() updates stats', function() {
    DB.setData(DB.defaults());
    var existingQ = QUESTION_BANK[0];
    DB.addRecord({ qid: existingQ.id, ans: existingQ.answer, ok: true, time: Date.now() });
    var d = DB.get();
    assert.equal(d.stats.total, 1);
    assert.equal(d.stats.correct, 1);
    assert.equal(d.stats.cats[existingQ.category].t, 1);
    assert.equal(d.stats.cats[existingQ.category].c, 1);
});

test('DB.addRecord() updates stats for wrong answer', function() {
    DB.setData(DB.defaults());
    var existingQ = QUESTION_BANK[0];
    DB.addRecord({ qid: existingQ.id, ans: 'X', ok: false, time: Date.now() });
    var d = DB.get();
    assert.equal(d.stats.total, 1);
    assert.equal(d.stats.correct, 0);
});

test('DB.recalcStats() recalculates from history', function() {
    var existingQ = QUESTION_BANK[0];
    
    DB.setData({
        history: [
            { qid: existingQ.id, ans: existingQ.answer, ok: true, time: 1 },
            { qid: existingQ.id, ans: 'X', ok: false, time: 2 },
            { qid: existingQ.id, ans: existingQ.answer, ok: true, time: 3 }
        ],
        wrong: [],
        stats: { total: 100, correct: 50, cats: {} }
    });
    
    DB.recalcStats();
    var d = DB.get();
    assert.equal(d.stats.total, 3);
    assert.equal(d.stats.correct, 2);
    assert.equal(d.stats.cats[existingQ.category].t, 3);
    assert.equal(d.stats.cats[existingQ.category].c, 2);
});

test('Session.save() and Session.load() round trip', function() {
    Session.clear();
    var state = {
        quiz: [{ id: 'q1' }, { id: 'q2' }],
        idx: 1,
        correctCount: 0,
        startTime: Date.now(),
        mode: 'quick'
    };
    Session.save(state);
    var loaded = Session.load();
    assert.deepEqual(loaded.quizIds, ['q1', 'q2']);
    assert.equal(loaded.idx, 1);
    assert.equal(loaded.correctCount, 0);
    assert.equal(loaded.mode, 'quick');
});

test('Session.load() returns null when empty', function() {
    Session.clear();
    assert.equal(Session.load(), null);
});

test('Session.clear() removes session', function() {
    Session.save({ quiz: [{ id: 'q1' }], idx: 0, correctCount: 0, startTime: Date.now(), mode: 'quick' });
    Session.clear();
    assert.equal(Session.load(), null);
});

runTests('storage.js');