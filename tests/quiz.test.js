/**
 * 答题逻辑模块测试
 * 测试覆盖：答题流程、计时、评分、模式切换
 */

const Quiz = require('../src/quiz.js');

// Mock题库
const mockQuestionBank = [
    {
        id: '001',
        category: '专辑',
        question: '测试题目1',
        options: [
            { key: 'A', text: '选项A' },
            { key: 'B', text: '选项B' },
            { key: 'C', text: '选项C' },
            { key: 'D', text: '选项D' }
        ],
        answer: 'A',
        explanation: '这是题目1的解析'
    },
    {
        id: '002',
        category: '歌曲',
        question: '测试题目2',
        options: [
            { key: 'A', text: '选项A' },
            { key: 'B', text: '选项B' },
            { key: 'C', text: '选项C' },
            { key: 'D', text: '选项D' }
        ],
        answer: 'B',
        explanation: '这是题目2的解析'
    },
    {
        id: '003',
        category: '专辑',
        question: '测试题目3',
        options: [
            { key: 'A', text: '选项A' },
            { key: 'B', text: '选项B' },
            { key: 'C', text: '选项C' },
            { key: 'D', text: '选项D' }
        ],
        answer: 'C',
        explanation: '这是题目3的解析'
    },
    {
        id: '004',
        category: '歌曲',
        question: '测试题目4',
        options: [
            { key: 'A', text: '选项A' },
            { key: 'B', text: '选项B' },
            { key: 'C', text: '选项C' },
            { key: 'D', text: '选项D' }
        ],
        answer: 'D',
        explanation: '这是题目4的解析'
    },
    {
        id: '005',
        category: '个人信息',
        question: '测试题目5',
        options: [
            { key: 'A', text: '选项A' },
            { key: 'B', text: '选项B' },
            { key: 'C', text: '选项C' },
            { key: 'D', text: '选项D' }
        ],
        answer: 'A',
        explanation: '这是题目5的解析'
    }
];

describe('Quiz模块', () => {
    beforeEach(() => {
        Quiz.reset();
    });

    describe('模式管理', () => {
        test('应该正确设置答题模式', () => {
            expect(Quiz.setMode('quick')).toBe(true);
            expect(Quiz.state.mode).toBe('quick');

            expect(Quiz.setMode('standard')).toBe(true);
            expect(Quiz.state.mode).toBe('standard');

            expect(Quiz.setMode('intensive')).toBe(true);
            expect(Quiz.state.mode).toBe('intensive');
        });

        test('设置无效模式应该返回false', () => {
            expect(Quiz.setMode('invalid')).toBe(false);
        });

        test('getCount应该返回正确的题目数量', () => {
            Quiz.setMode('quick');
            expect(Quiz.getCount()).toBe(10);

            Quiz.setMode('standard');
            expect(Quiz.getCount()).toBe(20);

            Quiz.setMode('intensive');
            expect(Quiz.getCount()).toBe(30);
        });
    });

    describe('开始答题', () => {
        test('应该正确开始随机答题', () => {
            Quiz.setMode('quick');
            Quiz.startRandom(mockQuestionBank);

            expect(Quiz.state.quiz.length).toBe(5); // 题库只有5题
            expect(Quiz.state.idx).toBe(0);
            expect(Quiz.state.correctCount).toBe(0);
            expect(Quiz.state.startTime).toBeGreaterThan(0);
            expect(Quiz.state.answered).toBe(false);
        });

        test('应该正确开始分类答题', () => {
            Quiz.setMode('quick');
            Quiz.startRandom(mockQuestionBank, '专辑');

            expect(Quiz.state.quiz.length).toBe(2); // 专辑分类只有2题
            expect(Quiz.state.quiz.every(q => q.category === '专辑')).toBe(true);
        });

        test('空题库应该产生空答题列表', () => {
            Quiz.startRandom([]);
            expect(Quiz.state.quiz.length).toBe(0);
        });
    });

    describe('错题复习', () => {
        test('应该正确开始错题复习', () => {
            const wrongList = [
                { qid: '001', cnt: 2 },
                { qid: '002', cnt: 1 }
            ];
            const result = Quiz.startWrongBook(wrongList, mockQuestionBank);

            expect(result).toBe(true);
            expect(Quiz.state.quiz.length).toBe(2);
        });

        test('空错题列表应该返回false', () => {
            const result = Quiz.startWrongBook([], mockQuestionBank);
            expect(result).toBe(false);
        });

        test('错题ID不存在应该被过滤', () => {
            const wrongList = [
                { qid: '001', cnt: 1 },
                { qid: '999', cnt: 1 } // 不存在的ID
            ];
            const result = Quiz.startWrongBook(wrongList, mockQuestionBank);

            expect(result).toBe(true);
            expect(Quiz.state.quiz.length).toBe(1); // 只有001
        });
    });

    describe('答题流程', () => {
        beforeEach(() => {
            Quiz.setMode('quick');
            Quiz.startRandom(mockQuestionBank);
        });

        test('getCurrentQuestion应该返回当前题目', () => {
            const q = Quiz.getCurrentQuestion();
            expect(q).toBeDefined();
            expect(q.id).toBeDefined();
        });

        test('答题完成后getCurrentQuestion应该返回null', () => {
            Quiz.state.idx = Quiz.state.quiz.length;
            const q = Quiz.getCurrentQuestion();
            expect(q).toBeNull();
        });

        test('pickAnswer应该正确判断答案', () => {
            const currentQ = Quiz.getCurrentQuestion();
            const result = Quiz.pickAnswer(currentQ.answer);

            expect(result).toBeDefined();
            expect(result.correct).toBe(true);
            expect(result.answer).toBe(currentQ.answer);
            expect(result.questionId).toBe(currentQ.id);
            expect(Quiz.state.correctCount).toBe(1);
        });

        test('pickAnswer应该正确判断错误答案', () => {
            const currentQ = Quiz.getCurrentQuestion();
            const wrongAnswer = currentQ.answer === 'A' ? 'B' : 'A';
            const result = Quiz.pickAnswer(wrongAnswer);

            expect(result.correct).toBe(false);
            expect(Quiz.state.correctCount).toBe(0);
        });

        test('已答题后再次pickAnswer应该返回null', () => {
            const currentQ = Quiz.getCurrentQuestion();
            Quiz.pickAnswer(currentQ.answer);

            const result = Quiz.pickAnswer('A');
            expect(result).toBeNull();
        });

        test('next应该正确移动到下一题', () => {
            const currentQ = Quiz.getCurrentQuestion();
            Quiz.pickAnswer(currentQ.answer);

            const hasNext = Quiz.next();
            expect(hasNext).toBe(true);
            expect(Quiz.state.idx).toBe(1);
            expect(Quiz.state.answered).toBe(false);
        });

        test('最后一题next应该返回false', () => {
            // 快速前进到最后一题
            while (Quiz.state.idx < Quiz.state.quiz.length - 1) {
                const q = Quiz.getCurrentQuestion();
                Quiz.pickAnswer(q.answer);
                Quiz.next();
            }

            const q = Quiz.getCurrentQuestion();
            Quiz.pickAnswer(q.answer);
            const hasNext = Quiz.next();

            expect(hasNext).toBe(false);
            expect(Quiz.state.idx).toBe(Quiz.state.quiz.length);
        });
    });

    describe('进度和计时', () => {
        beforeEach(() => {
            Quiz.setMode('quick');
            Quiz.startRandom(mockQuestionBank);
        });

        test('getProgress应该返回正确的进度', () => {
            const progress = Quiz.getProgress();
            expect(progress.current).toBe(1);
            expect(progress.total).toBe(5);
            expect(progress.percentage).toBe(20);
        });

        test('答题后进度应该更新', () => {
            const q = Quiz.getCurrentQuestion();
            Quiz.pickAnswer(q.answer);
            Quiz.next();

            const progress = Quiz.getProgress();
            expect(progress.current).toBe(2);
            expect(progress.percentage).toBe(40);
        });

        test('getElapsedTime应该返回用时', () => {
            const elapsed = Quiz.getElapsedTime();
            expect(elapsed.milliseconds).toBeGreaterThanOrEqual(0);
            expect(elapsed.formatted).toBeDefined();
        });

        test('formatTime应该正确格式化时间', () => {
            expect(Quiz.formatTime(1000)).toBe('0分1秒');
            expect(Quiz.formatTime(60000)).toBe('1分0秒');
            expect(Quiz.formatTime(90000)).toBe('1分30秒');
            expect(Quiz.formatTime(0)).toBe('0分0秒');
        });
    });

    describe('完成答题', () => {
        beforeEach(() => {
            Quiz.setMode('quick');
            Quiz.startRandom(mockQuestionBank);
        });

        test('finish应该返回正确的答题结果', () => {
            // 答对所有题目
            while (!Quiz.isFinished()) {
                const q = Quiz.getCurrentQuestion();
                Quiz.pickAnswer(q.answer);
                Quiz.next();
            }

            const result = Quiz.finish();
            expect(result.total).toBe(5);
            expect(result.correct).toBe(5);
            expect(result.wrong).toBe(0);
            expect(result.percentage).toBe(100);
            expect(result.time).toBeDefined();
        });

        test('答错部分题目应该正确计算', () => {
            // 答对一半
            let count = 0;
            while (!Quiz.isFinished()) {
                const q = Quiz.getCurrentQuestion();
                if (count % 2 === 0) {
                    Quiz.pickAnswer(q.answer); // 正确
                } else {
                    Quiz.pickAnswer('X'); // 错误（假设X不是答案）
                }
                Quiz.next();
                count++;
            }

            const result = Quiz.finish();
            expect(result.correct).toBe(Math.ceil(5 / 2));
            expect(result.percentage).toBe(Math.ceil(5 / 2) * 20);
        });

        test('isFinished应该正确判断是否完成', () => {
            expect(Quiz.isFinished()).toBe(false);

            Quiz.state.idx = Quiz.state.quiz.length;
            expect(Quiz.isFinished()).toBe(true);
        });
    });

    describe('洗牌算法', () => {
        test('shuffle应该返回新数组', () => {
            const original = [1, 2, 3, 4, 5];
            const shuffled = Quiz.shuffle(original);

            expect(shuffled).not.toBe(original); // 不是同一个引用
            expect(shuffled.length).toBe(original.length);
        });

        test('shuffle应该保持所有元素', () => {
            const original = [1, 2, 3, 4, 5];
            const shuffled = Quiz.shuffle(original);

            expect(shuffled.sort()).toEqual(original.sort());
        });

        test('shuffle应该产生随机顺序', () => {
            const original = [1, 2, 3, 4, 5];
            const orders = [];

            for (let i = 0; i < 20; i++) {
                const shuffled = Quiz.shuffle(original.slice());
                orders.push(shuffled.join(','));
            }

            const uniqueOrders = new Set(orders);
            // 多次洗牌应该产生不同的顺序
            expect(uniqueOrders.size).toBeGreaterThan(1);
        });

        test('shuffle应该处理空数组', () => {
            const shuffled = Quiz.shuffle([]);
            expect(shuffled.length).toBe(0);
        });

        test('shuffle应该处理单元素数组', () => {
            const shuffled = Quiz.shuffle([1]);
            expect(shuffled).toEqual([1]);
        });
    });

    describe('题目查找', () => {
        test('findQ应该找到存在的题目', () => {
            const q = Quiz.findQ('001', mockQuestionBank);
            expect(q).toBeDefined();
            expect(q.id).toBe('001');
        });

        test('findQ找不到应该返回null', () => {
            const q = Quiz.findQ('999', mockQuestionBank);
            expect(q).toBeNull();
        });
    });

    describe('重置功能', () => {
        test('reset应该清空所有状态', () => {
            Quiz.setMode('quick');
            Quiz.startRandom(mockQuestionBank);
            const q = Quiz.getCurrentQuestion();
            Quiz.pickAnswer(q.answer);

            Quiz.reset();

            expect(Quiz.state.quiz.length).toBe(0);
            expect(Quiz.state.idx).toBe(0);
            expect(Quiz.state.correctCount).toBe(0);
            expect(Quiz.state.answered).toBe(false);
            expect(Quiz.state.startTime).toBe(0);
        });
    });

    describe('边界条件测试', () => {
        test('应该处理题库题目数量少于模式要求', () => {
            Quiz.setMode('intensive'); // 需要30题
            Quiz.startRandom(mockQuestionBank); // 只有5题

            expect(Quiz.state.quiz.length).toBe(5);
        });

        test('应该处理分类题目数量不足', () => {
            Quiz.setMode('standard'); // 需要20题
            Quiz.startRandom(mockQuestionBank, '专辑'); // 只有2题

            expect(Quiz.state.quiz.length).toBe(2);
        });

        test('应该处理连续快速答题', () => {
            Quiz.startRandom(mockQuestionBank);

            for (let i = 0; i < Quiz.state.quiz.length; i++) {
                const q = Quiz.getCurrentQuestion();
                Quiz.pickAnswer(q.answer);
                Quiz.next();
            }

            expect(Quiz.isFinished()).toBe(true);
        });

        test('应该处理空题库答题', () => {
            Quiz.startRandom([]);

            expect(Quiz.state.quiz.length).toBe(0);
            expect(Quiz.getCurrentQuestion()).toBeNull();
            expect(Quiz.isFinished()).toBe(true);

            const result = Quiz.finish();
            expect(result.total).toBe(0);
            expect(result.percentage).toBe(0);
        });
    });

    describe('并发和状态一致性', () => {
        test('答题过程中状态应该保持一致', () => {
            Quiz.startRandom(mockQuestionBank);

            const q1 = Quiz.getCurrentQuestion();
            Quiz.pickAnswer(q1.answer);

            // 检查状态一致性
            expect(Quiz.state.answered).toBe(true);
            expect(Quiz.state.correctCount).toBe(1);
            expect(Quiz.state.idx).toBe(0);

            Quiz.next();

            expect(Quiz.state.answered).toBe(false);
            expect(Quiz.state.idx).toBe(1);
        });

        test('重复开始答题应该重置状态', () => {
            Quiz.startRandom(mockQuestionBank);
            const q = Quiz.getCurrentQuestion();
            Quiz.pickAnswer(q.answer);

            // 再次开始答题
            Quiz.startRandom(mockQuestionBank);

            expect(Quiz.state.idx).toBe(0);
            expect(Quiz.state.correctCount).toBe(0);
            expect(Quiz.state.answered).toBe(false);
        });
    });
});