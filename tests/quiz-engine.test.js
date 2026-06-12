/**
 * 答题引擎模块测试
 * 测试覆盖：题目随机化、答案校验、进度追踪、结果统计
 */

// 测试用题库
const mockQuestionBank = [
    {
        id: '001',
        category: '专辑',
        question: '问题1',
        options: [
            { key: 'A', text: '选项A' },
            { key: 'B', text: '选项B' },
            { key: 'C', text: '选项C' },
            { key: 'D', text: '选项D' }
        ],
        answer: 'B',
        explanation: '解析1'
    },
    {
        id: '002',
        category: '歌曲',
        question: '问题2',
        options: [
            { key: 'A', text: '选项A' },
            { key: 'B', text: '选项B' },
            { key: 'C', text: '选项C' },
            { key: 'D', text: '选项D' }
        ],
        answer: 'A',
        explanation: '解析2'
    },
    {
        id: '003',
        category: '专辑',
        question: '问题3',
        options: [
            { key: 'A', text: '选项A' },
            { key: 'B', text: '选项B' },
            { key: 'C', text: '选项C' },
            { key: 'D', text: '选项D' }
        ],
        answer: 'C',
        explanation: '解析3'
    },
    {
        id: '004',
        category: '歌曲',
        question: '问题4',
        options: [
            { key: 'A', text: '选项A' },
            { key: 'B', text: '选项B' },
            { key: 'C', text: '选项C' },
            { key: 'D', text: '选项D' }
        ],
        answer: 'D',
        explanation: '解析4'
    },
    {
        id: '005',
        category: '个人信息',
        question: '问题5',
        options: [
            { key: 'A', text: '选项A' },
            { key: 'B', text: '选项B' }
        ],
        answer: 'A',
        explanation: '解析5'
    }
];

describe('QuizEngine模块', () => {
    let QuizEngine;

    beforeEach(() => {
        // 设置全局localStorage mock
        global.localStorage = {
            store: {},
            getItem: function(key) { return this.store[key] || null; },
            setItem: function(key, value) { this.store[key] = value; },
            removeItem: function(key) { delete this.store[key]; },
            clear: function() { this.store = {}; }
        };

        // 清除模块缓存并重新加载
        jest.resetModules();
        QuizEngine = require('../js/quiz-engine.js');
    });

    describe('shuffle()', () => {
        test('应返回打乱后的数组', () => {
            const arr = [1, 2, 3, 4, 5];
            const shuffled = QuizEngine.shuffle(arr);

            // 检查长度相同
            expect(shuffled.length).toBe(arr.length);

            // 检查元素相同（顺序可能不同）
            expect(shuffled.sort()).toEqual(arr.sort());
        });

        test('不应修改原数组', () => {
            const arr = [1, 2, 3, 4, 5];
            const original = [...arr];
            QuizEngine.shuffle(arr);

            expect(arr).toEqual(original);
        });

        test('空数组应返回空数组', () => {
            const result = QuizEngine.shuffle([]);
            expect(result).toEqual([]);
        });

        test('单元素数组应返回相同数组', () => {
            const result = QuizEngine.shuffle([1]);
            expect(result).toEqual([1]);
        });

        test('多次洗牌应产生不同结果（概率测试）', () => {
            const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            const results = new Set();

            // 执行多次洗牌
            for (let i = 0; i < 100; i++) {
                results.add(QuizEngine.shuffle(arr).join(','));
            }

            // 应该有多种不同的排列结果
            expect(results.size).toBeGreaterThan(50);
        });
    });

    describe('getCount()', () => {
        test('quick模式应返回10', () => {
            expect(QuizEngine.getCount('quick')).toBe(10);
        });

        test('standard模式应返回20', () => {
            expect(QuizEngine.getCount('standard')).toBe(20);
        });

        test('intensive模式应返回30', () => {
            expect(QuizEngine.getCount('intensive')).toBe(30);
        });

        test('未知模式应返回默认值10', () => {
            expect(QuizEngine.getCount('unknown')).toBe(10);
            expect(QuizEngine.getCount('')).toBe(10);
            expect(QuizEngine.getCount(null)).toBe(10);
        });
    });

    describe('startRandomQuiz()', () => {
        test('应返回正确的答题状态对象', () => {
            const state = QuizEngine.startRandomQuiz(mockQuestionBank, 'quick');

            expect(state).toHaveProperty('quiz');
            expect(state).toHaveProperty('idx', 0);
            expect(state).toHaveProperty('correctCount', 0);
            expect(state).toHaveProperty('startTime');
            expect(state).toHaveProperty('mode', 'quick');
        });

        test('应返回正确数量的题目', () => {
            const state = QuizEngine.startRandomQuiz(mockQuestionBank, 'quick');
            expect(state.quiz.length).toBe(5); // 题库只有5题
        });

        test('题库数量不足时应返回所有题目', () => {
            const smallBank = mockQuestionBank.slice(0, 3);
            const state = QuizEngine.startRandomQuiz(smallBank, 'intensive');

            expect(state.quiz.length).toBe(3);
        });

        test('空题库应返回空数组', () => {
            const state = QuizEngine.startRandomQuiz([], 'quick');
            expect(state.quiz.length).toBe(0);
        });
    });

    describe('startCategoryQuiz()', () => {
        test('应只返回指定分类的题目', () => {
            const state = QuizEngine.startCategoryQuiz(mockQuestionBank, '专辑', 'quick');

            state.quiz.forEach(q => {
                expect(q.category).toBe('专辑');
            });
        });

        test('不存在的分类应返回空数组', () => {
            const state = QuizEngine.startCategoryQuiz(mockQuestionBank, '不存在的分类', 'quick');
            expect(state.quiz.length).toBe(0);
        });

        test('应正确设置模式', () => {
            const state = QuizEngine.startCategoryQuiz(mockQuestionBank, '专辑', 'standard');
            expect(state.mode).toBe('standard');
        });
    });

    describe('startWrongBookQuiz()', () => {
        test('应返回错题列表中的题目', () => {
            const wrongList = [
                { qid: '001', cnt: 2 },
                { qid: '003', cnt: 1 }
            ];

            const state = QuizEngine.startWrongBookQuiz(mockQuestionBank, wrongList);

            expect(state.quiz.length).toBe(2);
            expect(state.mode).toBe('wrongbook');
        });

        test('错题ID不存在时应跳过', () => {
            const wrongList = [
                { qid: '001', cnt: 1 },
                { qid: '999', cnt: 1 } // 不存在的ID
            ];

            const state = QuizEngine.startWrongBookQuiz(mockQuestionBank, wrongList);
            expect(state.quiz.length).toBe(1);
        });

        test('空错题列表应返回空数组', () => {
            const state = QuizEngine.startWrongBookQuiz(mockQuestionBank, []);
            expect(state.quiz.length).toBe(0);
        });
    });

    describe('checkAnswer()', () => {
        test('正确答案应返回true', () => {
            const question = mockQuestionBank[0];
            expect(QuizEngine.checkAnswer(question, 'B')).toBe(true);
        });

        test('错误答案应返回false', () => {
            const question = mockQuestionBank[0];
            expect(QuizEngine.checkAnswer(question, 'A')).toBe(false);
            expect(QuizEngine.checkAnswer(question, 'C')).toBe(false);
            expect(QuizEngine.checkAnswer(question, 'D')).toBe(false);
        });

        test('大小写应敏感', () => {
            const question = mockQuestionBank[0];
            expect(QuizEngine.checkAnswer(question, 'b')).toBe(false);
        });
    });

    describe('submitAnswer()', () => {
        test('正确答案应增加正确计数', () => {
            const state = QuizEngine.startRandomQuiz(mockQuestionBank, 'quick');
            const currentQ = state.quiz[0];
            const result = QuizEngine.submitAnswer(state, currentQ.answer);

            expect(result.correct).toBe(true);
            expect(state.correctCount).toBe(1);
        });

        test('错误答案不应增加正确计数', () => {
            const state = QuizEngine.startRandomQuiz(mockQuestionBank, 'quick');
            const result = QuizEngine.submitAnswer(state, 'X');

            expect(result.correct).toBe(false);
            expect(state.correctCount).toBe(0);
        });

        test('应返回题目解析', () => {
            const state = QuizEngine.startRandomQuiz(mockQuestionBank, 'quick');
            const result = QuizEngine.submitAnswer(state, 'B');

            expect(result).toHaveProperty('explanation');
            expect(result).toHaveProperty('question');
            expect(result).toHaveProperty('userAnswer');
        });
    });

    describe('nextQuestion()', () => {
        test('应正确递增索引', () => {
            const state = QuizEngine.startRandomQuiz(mockQuestionBank, 'quick');
            state.idx = 0;

            QuizEngine.nextQuestion(state);
            expect(state.idx).toBe(1);
        });

        test('到达末尾应返回false', () => {
            const state = QuizEngine.startRandomQuiz(mockQuestionBank.slice(0, 2), 'quick');
            state.idx = 1;

            const hasMore = QuizEngine.nextQuestion(state);
            expect(hasMore).toBe(false);
        });

        test('未到达末尾应返回true', () => {
            const state = QuizEngine.startRandomQuiz(mockQuestionBank, 'quick');
            state.idx = 0;

            const hasMore = QuizEngine.nextQuestion(state);
            expect(hasMore).toBe(true);
        });
    });

    describe('getElapsedTime()', () => {
        test('应返回正数', () => {
            const state = {
                startTime: Date.now() - 1000
            };

            const elapsed = QuizEngine.getElapsedTime(state);
            expect(elapsed).toBeGreaterThanOrEqual(1000);
        });
    });

    describe('formatTime()', () => {
        test('应正确格式化时间', () => {
            expect(QuizEngine.formatTime(65000)).toBe('1分5秒');
            expect(QuizEngine.formatTime(30000)).toBe('0分30秒');
            expect(QuizEngine.formatTime(125000)).toBe('2分5秒');
        });

        test('0秒应显示0分0秒', () => {
            expect(QuizEngine.formatTime(0)).toBe('0分0秒');
        });
    });

    describe('getQuizResult()', () => {
        test('应返回正确的统计结果', () => {
            const state = {
                quiz: mockQuestionBank.slice(0, 5),
                idx: 5,
                correctCount: 3,
                startTime: Date.now() - 60000
            };

            const result = QuizEngine.getQuizResult(state);

            expect(result.total).toBe(5);
            expect(result.correct).toBe(3);
            expect(result.wrong).toBe(2);
            expect(result.percentage).toBe(60);
            expect(result).toHaveProperty('elapsed');
            expect(result).toHaveProperty('formattedTime');
        });

        test('空答题应返回0%正确率', () => {
            const state = {
                quiz: [],
                idx: 0,
                correctCount: 0,
                startTime: Date.now()
            };

            const result = QuizEngine.getQuizResult(state);
            expect(result.percentage).toBe(0);
        });

        test('全对应返回100%正确率', () => {
            const state = {
                quiz: mockQuestionBank.slice(0, 3),
                idx: 3,
                correctCount: 3,
                startTime: Date.now()
            };

            const result = QuizEngine.getQuizResult(state);
            expect(result.percentage).toBe(100);
        });
    });

    describe('getCurrentQuestion()', () => {
        test('应返回当前题目', () => {
            const state = QuizEngine.startRandomQuiz(mockQuestionBank, 'quick');
            const current = QuizEngine.getCurrentQuestion(state);

            expect(current).not.toBeNull();
            expect(current).toHaveProperty('id');
            expect(current).toHaveProperty('question');
        });

        test('答题完成后应返回null', () => {
            const state = QuizEngine.startRandomQuiz(mockQuestionBank.slice(0, 2), 'quick');
            state.idx = 2;

            const current = QuizEngine.getCurrentQuestion(state);
            expect(current).toBeNull();
        });
    });

    describe('getProgress()', () => {
        test('应返回正确的进度百分比', () => {
            const state = {
                quiz: [1, 2, 3, 4, 5],
                idx: 2
            };

            expect(QuizEngine.getProgress(state)).toBe(40);
        });

        test('空题库应返回0', () => {
            const state = {
                quiz: [],
                idx: 0
            };

            expect(QuizEngine.getProgress(state)).toBe(0);
        });

        test('完成应返回100', () => {
            const state = {
                quiz: [1, 2, 3, 4, 5],
                idx: 5
            };

            expect(QuizEngine.getProgress(state)).toBe(100);
        });
    });
});
