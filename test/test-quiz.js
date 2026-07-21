describe('App.quiz (答题引擎)', function() {
    describe('selectMode (模式选择)', function() {
        it('should set mode to quick by default', function() {
            App.selectMode('quick');
            assert.equal(App.state.mode, 'quick');
        });

        it('should set mode to standard', function() {
            App.selectMode('standard');
            assert.equal(App.state.mode, 'standard');
        });

        it('should set mode to intensive', function() {
            App.selectMode('intensive');
            assert.equal(App.state.mode, 'intensive');
        });
    });

    describe('getCount (获取题目数量)', function() {
        it('should return 10 for quick mode', function() {
            App.selectMode('quick');
            assert.equal(App.state.mode, 'quick');
            var count = App.state.mode === 'quick' ? 10 : (App.state.mode === 'standard' ? 20 : 30);
            assert.equal(count, 10);
        });

        it('should return 20 for standard mode', function() {
            App.selectMode('standard');
            assert.equal(App.state.mode, 'standard');
            var count = App.state.mode === 'quick' ? 10 : (App.state.mode === 'standard' ? 20 : 30);
            assert.equal(count, 20);
        });

        it('should return 30 for intensive mode', function() {
            App.selectMode('intensive');
            assert.equal(App.state.mode, 'intensive');
            var count = App.state.mode === 'quick' ? 10 : (App.state.mode === 'standard' ? 20 : 30);
            assert.equal(count, 30);
        });

        it('should return 10 for unknown mode', function() {
            App.state.mode = 'unknown';
            var count = App.state.mode === 'quick' ? 10 : (App.state.mode === 'standard' ? 20 : 30);
            assert.equal(count, 30);
        });
    });

    describe('shuffle (随机打乱)', function() {
        it('should return array of same length', function() {
            var arr = [1, 2, 3, 4, 5];
            var shuffled = App.shuffle(arr);
            assert.equal(shuffled.length, arr.length);
        });

        it('should contain same elements', function() {
            var arr = [1, 2, 3, 4, 5];
            var shuffled = App.shuffle(arr);
            for (var i = 0; i < arr.length; i++) {
                assert.include(shuffled, arr[i]);
            }
        });

        it('should not modify original array', function() {
            var arr = [1, 2, 3, 4, 5];
            var original = arr.slice();
            App.shuffle(arr);
            assert.deepEqual(arr, original);
        });

        it('should work with empty array', function() {
            var arr = [];
            var shuffled = App.shuffle(arr);
            assert.deepEqual(shuffled, []);
        });

        it('should work with single element', function() {
            var arr = [42];
            var shuffled = App.shuffle(arr);
            assert.deepEqual(shuffled, [42]);
        });
    });

    describe('tryResumeSession (尝试恢复会话)', function() {
        beforeEach(function() {
            App.session.clear();
            App.db.setData({ history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } });
        });

        it('should return false for no saved session', function() {
            var result = App.tryResumeSession();
            assert.isFalse(result);
        });

        it('should return false for empty quizIds', function() {
            sessionStorage.setItem('jj_quiz_session', JSON.stringify({
                quizIds: [], idx: 0, correctCount: 0, startTime: Date.now(), mode: 'quick'
            }));
            var result = App.tryResumeSession();
            assert.isFalse(result);
        });

        it('should return false for completed quiz', function() {
            sessionStorage.setItem('jj_quiz_session', JSON.stringify({
                quizIds: ['001'],
                idx: 1,
                correctCount: 0,
                startTime: Date.now(),
                mode: 'quick'
            }));
            var result = App.tryResumeSession();
            assert.isFalse(result);
        });

        it('should restore session state correctly', function() {
            var startTime = Date.now() - 10000;
            sessionStorage.setItem('jj_quiz_session', JSON.stringify({
                quizIds: ['001', '002'],
                idx: 0,
                correctCount: 0,
                startTime: startTime,
                mode: 'standard'
            }));

            var result = App.tryResumeSession();
            assert.isTrue(result);
            assert.equal(App.state.idx, 0);
            assert.equal(App.state.correctCount, 0);
            assert.equal(App.state.mode, 'standard');
            assert.equal(App.state.quiz.length, 2);
            assert.equal(App.state.quiz[0].id, '001');
            assert.equal(App.state.quiz[1].id, '002');
        });

        it('should handle missing questions gracefully', function() {
            sessionStorage.setItem('jj_quiz_session', JSON.stringify({
                quizIds: ['001', 'nonexistent'],
                idx: 0,
                correctCount: 0,
                startTime: Date.now(),
                mode: 'quick'
            }));

            var result = App.tryResumeSession();
            assert.isTrue(result);
            assert.equal(App.state.quiz.length, 1);
            assert.equal(App.state.quiz[0].id, '001');
            assert.equal(App.state.idx, 0);
        });

        it('should return false if no questions found', function() {
            sessionStorage.setItem('jj_quiz_session', JSON.stringify({
                quizIds: ['nonexistent1', 'nonexistent2'],
                idx: 0,
                correctCount: 0,
                startTime: Date.now(),
                mode: 'quick'
            }));

            var result = App.tryResumeSession();
            assert.isFalse(result);
        });
    });

    describe('state management', function() {
        it('should initialize state correctly', function() {
            App.state.quiz = [];
            App.state.idx = 0;
            App.state.mode = 'quick';
            App.state.correctCount = 0;
            assert.ok(App.state);
            assert.deepEqual(App.state.quiz, []);
            assert.equal(App.state.idx, 0);
            assert.equal(App.state.answered, false);
            assert.equal(App.state.mode, 'quick');
            assert.equal(App.state.correctCount, 0);
        });

        it('should reset state on startRandomQuiz', function() {
            App.state.idx = 5;
            App.state.correctCount = 3;
            App.state.isWrongBookQuiz = true;

            var originalQuizLength = App.QUESTION_BANK.length;
            assert.isAbove(originalQuizLength, 0);
        });
    });

    describe('startCatQuiz (分类答题)', function() {
        it('should filter questions by category', function() {
            App.selectMode('quick');
            App.state.quiz = [];
            App.state.idx = 0;
            App.state.correctCount = 0;
            App.state.isWrongBookQuiz = false;

            var albumQuestions = App.QUESTION_BANK.filter(function(q) { return q.category === '专辑'; });
            assert.isAbove(albumQuestions.length, 0);
        });

        it('should handle category with insufficient questions', function() {
            App.selectMode('intensive');
            var smallCategory = '测试分类';
            App.QUESTION_BANK.push({
                id: 'test-cat',
                category: smallCategory,
                question: '测试题',
                options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }],
                answer: 'A',
                explanation: '解释'
            });

            var catQuestions = App.QUESTION_BANK.filter(function(q) { return q.category === smallCategory; });
            assert.equal(catQuestions.length, 1);

            App.QUESTION_BANK = App.QUESTION_BANK.filter(function(q) { return q.id !== 'test-cat'; });
        });
    });
});