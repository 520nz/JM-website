describe('App.esc (XSS转义)', function() {
    it('should escape HTML special characters', function() {
        assert.equal(App.esc('<script>alert("XSS")</script>').indexOf('<'), -1);
        assert.equal(App.esc('<script>alert("XSS")</script>').indexOf('>'), -1);
        assert.equal(App.esc('<div class="test">').indexOf('<'), -1);
        assert.equal(App.esc('<div class="test">').indexOf('>'), -1);
        assert.equal(App.esc('&'), '&amp;');
    });

    it('should handle null and undefined', function() {
        assert.equal(App.esc(null), '');
        assert.equal(App.esc(undefined), '');
    });

    it('should handle numbers and other types', function() {
        assert.equal(App.esc(123), '123');
        assert.equal(App.esc(true), 'true');
    });

    it('should return empty string for null input', function() {
        assert.equal(App.esc(null), '');
    });
});

describe('App.db (数据存储)', function() {
    beforeEach(function() {
        App.db.setData({ history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } });
    });

    describe('findQ (查找题目)', function() {
        it('should find question by id', function() {
            var q = App.db.findQ('001');
            assert.ok(q);
            assert.equal(q.id, '001');
            assert.equal(q.category, '专辑');
        });

        it('should return null for non-existent id', function() {
            assert.isNull(App.db.findQ('nonexistent'));
        });
    });

    describe('addRecord (添加答题记录)', function() {
        it('should add record to history', function() {
            var initialHistory = App.db.get().history.length;
            App.db.addRecord({ qid: '001', ans: 'A', ok: false, time: Date.now() });
            assert.equal(App.db.get().history.length, initialHistory + 1);
        });

        it('should update stats correctly', function() {
            App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
            App.db.addRecord({ qid: '002', ans: 'A', ok: false, time: Date.now() });
            var stats = App.db.get().stats;
            assert.equal(stats.total, 2);
            assert.equal(stats.correct, 1);
        });

        it('should update category stats', function() {
            App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
            App.db.addRecord({ qid: '001', ans: 'A', ok: false, time: Date.now() });
            var cats = App.db.get().stats.cats;
            assert.ok(cats['专辑']);
            assert.equal(cats['专辑'].t, 2);
            assert.equal(cats['专辑'].c, 1);
        });
    });

    describe('addWrong (添加错题)', function() {
        it('should add new wrong question', function() {
            App.db.addWrong('test-qid');
            var wrong = App.db.get().wrong;
            assert.equal(wrong.length, 1);
            assert.equal(wrong[0].qid, 'test-qid');
            assert.equal(wrong[0].cnt, 1);
            assert.equal(wrong[0].level, 0);
        });

        it('should increment count for existing wrong question', function() {
            App.db.addWrong('test-qid');
            App.db.addWrong('test-qid');
            var wrong = App.db.get().wrong;
            assert.equal(wrong.length, 1);
            assert.equal(wrong[0].cnt, 2);
            assert.equal(wrong[0].level, 0);
        });

        it('should reset level when adding existing wrong question', function() {
            App.db.addWrong('test-qid');
            App.db.get().wrong[0].level = 3;
            App.db.addWrong('test-qid');
            assert.equal(App.db.get().wrong[0].level, 0);
        });
    });

    describe('reviewCorrect (答对复习)', function() {
        it('should increase level when review correct', function() {
            App.db.addWrong('test-qid');
            App.db.reviewCorrect('test-qid');
            assert.equal(App.db.get().wrong[0].level, 1);
        });

        it('should remove from wrong when level >= 5', function() {
            App.db.addWrong('test-qid');
            for (var i = 0; i < 5; i++) {
                App.db.reviewCorrect('test-qid');
            }
            assert.equal(App.db.get().wrong.length, 0);
        });

        it('should set nextReview based on level', function() {
            App.db.addWrong('test-qid');
            var now = Date.now();
            App.db.reviewCorrect('test-qid');
            var nextReview = App.db.get().wrong[0].nextReview;
            assert.isAbove(nextReview, now);
        });

        it('should do nothing for non-existent qid', function() {
            assert.doesNotThrow(function() {
                App.db.reviewCorrect('nonexistent');
            });
        });
    });

    describe('reviewWrong (答错复习)', function() {
        it('should reset level to 0 when review wrong', function() {
            App.db.addWrong('test-qid');
            App.db.get().wrong[0].level = 3;
            App.db.reviewWrong('test-qid');
            assert.equal(App.db.get().wrong[0].level, 0);
            assert.equal(App.db.get().wrong[0].cnt, 2);
        });

        it('should add to wrong if not exists', function() {
            App.db.reviewWrong('new-qid');
            assert.equal(App.db.get().wrong.length, 1);
            assert.equal(App.db.get().wrong[0].qid, 'new-qid');
        });
    });

    describe('removeWrong (移除错题)', function() {
        it('should remove specified question', function() {
            App.db.addWrong('q1');
            App.db.addWrong('q2');
            App.db.removeWrong('q1');
            assert.equal(App.db.get().wrong.length, 1);
            assert.equal(App.db.get().wrong[0].qid, 'q2');
        });

        it('should do nothing for non-existent qid', function() {
            assert.doesNotThrow(function() {
                App.db.removeWrong('nonexistent');
            });
        });
    });

    describe('getDueWrong (获取到期错题)', function() {
        it('should return wrong with nextReview <= now', function() {
            App.db.addWrong('q1');
            App.db.addWrong('q2');
            var now = Date.now();
            App.db.get().wrong[0].nextReview = now - 1000;
            App.db.get().wrong[1].nextReview = now + 100000;
            var due = App.db.getDueWrong();
            assert.equal(due.length, 1);
            assert.equal(due[0].qid, 'q1');
        });

        it('should return all if nextReview not set', function() {
            App.db.addWrong('q1');
            App.db.addWrong('q2');
            delete App.db.get().wrong[0].nextReview;
            delete App.db.get().wrong[1].nextReview;
            var due = App.db.getDueWrong();
            assert.equal(due.length, 2);
        });
    });

    describe('recalcStats (重新计算统计)', function() {
        it('should recalculate stats from history', function() {
            App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
            App.db.addRecord({ qid: '002', ans: 'A', ok: false, time: Date.now() });
            App.db.get().stats = { total: 100, correct: 50, cats: {} };
            App.db.recalcStats();
            var stats = App.db.get().stats;
            assert.equal(stats.total, 2);
            assert.equal(stats.correct, 1);
        });
    });

    describe('defaults (默认数据)', function() {
        it('should return default structure', function() {
            var def = App.db.defaults();
            assert.deepEqual(def.history, []);
            assert.deepEqual(def.wrong, []);
            assert.deepEqual(def.stats, { total: 0, correct: 0, cats: {} });
        });
    });
});

describe('App.session (会话管理)', function() {
    beforeEach(function() {
        App.session.clear();
    });

    it('should save and load session', function() {
        var testState = {
            quiz: [{ id: 'q1' }, { id: 'q2' }],
            idx: 1,
            correctCount: 5,
            startTime: Date.now(),
            mode: 'quick'
        };
        App.session.save(testState);
        var loaded = App.session.load();
        assert.ok(loaded);
        assert.deepEqual(loaded.quizIds, ['q1', 'q2']);
        assert.equal(loaded.idx, 1);
        assert.equal(loaded.correctCount, 5);
        assert.equal(loaded.mode, 'quick');
    });

    it('should return null for empty session', function() {
        assert.isNull(App.session.load());
    });

    it('should clear session', function() {
        var testState = { quiz: [{ id: 'q1' }], idx: 0, correctCount: 0, startTime: Date.now(), mode: 'quick' };
        App.session.save(testState);
        assert.ok(App.session.load());
        App.session.clear();
        assert.isNull(App.session.load());
    });
});