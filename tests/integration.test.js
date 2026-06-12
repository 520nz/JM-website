/**
 * 边界条件和集成测试
 * 测试覆盖：极端情况、错误处理、模块间协作
 */

describe('边界条件测试', () => {
    let QuizEngine;
    let DataManager;

    beforeEach(() => {
        // 设置全局localStorage mock
        global.localStorage = {
            store: {},
            getItem: function(key) { return this.store[key] || null; },
            setItem: function(key, value) { this.store[key] = value; },
            removeItem: function(key) { delete this.store[key]; },
            clear: function() { this.store = {}; }
        };
        global.URL = {
            createObjectURL: jest.fn(() => 'blob:mock-url'),
            revokeObjectURL: jest.fn()
        };
        global.document = {
            createElement: jest.fn(() => ({
                href: '',
                download: '',
                click: jest.fn()
            }))
        };

        // 清除模块缓存并重新加载
        jest.resetModules();
        QuizEngine = require('../js/quiz-engine.js');
        DataManager = require('../js/data-manager.js');
    });

    describe('空数据处理', () => {
        test('空题库应能正常启动答题', () => {
            const state = QuizEngine.startRandomQuiz([], 'quick');
            expect(state.quiz.length).toBe(0);
            expect(state.idx).toBe(0);
        });

        test('空题库获取当前题目应返回null', () => {
            const state = { quiz: [], idx: 0 };
            const current = QuizEngine.getCurrentQuestion(state);
            expect(current).toBeNull();
        });

        test('空题库答题结果应为0%', () => {
            const state = { quiz: [], idx: 0, correctCount: 0, startTime: Date.now() };
            const result = QuizEngine.getQuizResult(state);
            expect(result.percentage).toBe(0);
            expect(result.total).toBe(0);
        });

        test('空用户数据导入应不改变现有数据', () => {
            const existing = {
                history: [{ qid: '001' }],
                wrong: [],
                stats: { total: 1, correct: 1, cats: {} }
            };

            const result = DataManager.mergeUserData(
                JSON.parse(JSON.stringify(existing)),
                {}
            );

            expect(result.history.length).toBe(1);
        });
    });

    describe('大数据处理', () => {
        test('大量题目洗牌性能', () => {
            const largeBank = [];
            for (let i = 0; i < 1000; i++) {
                largeBank.push({ id: 'q' + i, question: '问题' + i });
            }

            const start = Date.now();
            const shuffled = QuizEngine.shuffle(largeBank);
            const elapsed = Date.now() - start;

            expect(shuffled.length).toBe(1000);
            expect(elapsed).toBeLessThan(100); // 应在100ms内完成
        });
    });

    describe('无效输入处理', () => {
        test('undefined模式应使用默认值', () => {
            const count = QuizEngine.getCount(undefined);
            expect(count).toBe(10);
        });

        test('无效JSON解析应返回错误', () => {
            const result = DataManager.parseJSON('{invalid}');
            expect(result.success).toBe(false);
        });

        test('选项解析空字符串应返回空数组', () => {
            const result = DataManager.parseOptions('');
            expect(result.options.length).toBe(0);
        });
    });

    describe('重复数据处理', () => {
        test('重复ID题目合并应更新而非添加', () => {
            const existing = [
                { id: '001', question: '旧问题', answer: 'A' }
            ];
            const newBank = [
                { id: '001', question: '新问题', answer: 'B' }
            ];

            const result = DataManager.mergeQuestionBanks(existing, newBank);

            expect(result.questionBank.length).toBe(1);
            expect(result.questionBank[0].question).toBe('新问题');
            expect(result.updatedCount).toBe(1);
        });
    });
});

describe('集成测试', () => {
    let QuizEngine;
    let DataManager;

    beforeEach(() => {
        global.localStorage = {
            store: {},
            getItem: function(key) { return this.store[key] || null; },
            setItem: function(key, value) { this.store[key] = value; },
            removeItem: function(key) { delete this.store[key]; },
            clear: function() { this.store = {}; }
        };
        global.URL = {
            createObjectURL: jest.fn(() => 'blob:mock-url'),
            revokeObjectURL: jest.fn()
        };
        global.document = {
            createElement: jest.fn(() => ({
                href: '',
                download: '',
                click: jest.fn()
            }))
        };

        jest.resetModules();
        QuizEngine = require('../js/quiz-engine.js');
        DataManager = require('../js/data-manager.js');
    });

    describe('完整答题流程', () => {
        test('从开始到结束的完整流程', () => {
            const questionBank = [
                {
                    id: '001',
                    category: '专辑',
                    question: '问题1',
                    options: [
                        { key: 'A', text: 'A' },
                        { key: 'B', text: 'B' }
                    ],
                    answer: 'B',
                    explanation: '解析1'
                },
                {
                    id: '002',
                    category: '歌曲',
                    question: '问题2',
                    options: [
                        { key: 'A', text: 'A' },
                        { key: 'B', text: 'B' }
                    ],
                    answer: 'A',
                    explanation: '解析2'
                }
            ];

            // 1. 开始答题
            const state = QuizEngine.startRandomQuiz(questionBank, 'quick');
            expect(state.quiz.length).toBe(2);

            // 2. 答第一题（正确）
            const q1 = QuizEngine.getCurrentQuestion(state);
            const result1 = QuizEngine.submitAnswer(state, q1.answer);
            expect(result1.correct).toBe(true);

            // 3. 下一题
            QuizEngine.nextQuestion(state);

            // 4. 答第二题（错误）
            const q2 = QuizEngine.getCurrentQuestion(state);
            const wrongAnswer = q2.answer === 'A' ? 'B' : 'A'; // 故意选错误答案
            const result2 = QuizEngine.submitAnswer(state, wrongAnswer);
            expect(result2.correct).toBe(false);

            // 5. 完成答题
            QuizEngine.nextQuestion(state);
            const quizResult = QuizEngine.getQuizResult(state);

            expect(quizResult.total).toBe(2);
            expect(quizResult.correct).toBe(1);
            expect(quizResult.percentage).toBe(50);
        });
    });

    describe('数据导入导出流程', () => {
        test('导出后导入应保持数据一致', () => {
            const questionBank = [
                {
                    id: '001',
                    category: '专辑',
                    question: '问题1',
                    options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }],
                    answer: 'A'
                }
            ];

            const userData = {
                history: [{ qid: '001', ans: 'A', ok: true, time: Date.now() }],
                wrong: [],
                stats: { total: 1, correct: 1, cats: {} }
            };

            // 导出
            const exported = DataManager.exportData(questionBank, userData);
            const json = JSON.stringify(exported);

            // 导入
            const result = DataManager.importData(json, [], { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } });

            expect(result.success).toBe(true);
            expect(result.questionBank.length).toBe(1);
            expect(result.userData.history.length).toBe(1);
        });
    });

    describe('错题复习流程', () => {
        test('错题添加后复习应包含错题', () => {
            const questionBank = [
                { id: '001', category: '测试', question: 'Q1', answer: 'A' },
                { id: '002', category: '测试', question: 'Q2', answer: 'B' },
                { id: '003', category: '测试', question: 'Q3', answer: 'C' }
            ];

            const wrongList = [
                { qid: '001', cnt: 2 },
                { qid: '003', cnt: 1 }
            ];

            const state = QuizEngine.startWrongBookQuiz(questionBank, wrongList);

            expect(state.quiz.length).toBe(2);
            expect(state.mode).toBe('wrongbook');
        });
    });
});

describe('性能边界测试', () => {
    let DataManager;

    beforeEach(() => {
        global.localStorage = {
            store: {},
            getItem: function(key) { return this.store[key] || null; },
            setItem: function(key, value) { this.store[key] = value; },
            removeItem: function(key) { delete this.store[key]; },
            clear: function() { this.store = {}; }
        };

        jest.resetModules();
        DataManager = require('../js/data-manager.js');
    });

    test('大量数据导出性能', () => {
        const largeBank = [];
        for (let i = 0; i < 500; i++) {
            largeBank.push({
                id: 'q' + i,
                category: '分类' + (i % 10),
                question: '问题' + i,
                options: [
                    { key: 'A', text: 'A' },
                    { key: 'B', text: 'B' }
                ],
                answer: 'A'
            });
        }

        const largeUserData = {
            history: Array(1000).fill({ qid: '001', ans: 'A', ok: true, time: Date.now() }),
            wrong: Array(100).fill({ qid: '001', cnt: 1, time: Date.now() }),
            stats: { total: 1000, correct: 800, cats: {} }
        };

        const start = Date.now();
        const exported = DataManager.exportData(largeBank, largeUserData);
        const elapsed = Date.now() - start;

        expect(exported.questionBank.length).toBe(500);
        expect(elapsed).toBeLessThan(1000); // 应在1秒内完成
    });

    test('大量数据导入验证性能', () => {
        const largeData = {
            questionBank: Array(500).fill({
                id: '001',
                category: '测试',
                question: '问题',
                options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }],
                answer: 'A'
            })
        };

        const start = Date.now();
        const result = DataManager.validateImportData(largeData);
        const elapsed = Date.now() - start;

        expect(elapsed).toBeLessThan(500); // 应在500ms内完成
    });
});
