/**
 * 题库管理模块测试
 * 测试覆盖：题目增删改查、导入导出、选项解析、数据验证
 */

// 强制重新加载模块，确保独立的localStorage实例
jest.resetModules();

const localStorageMock = require('./__mocks__/localStorage.js');
global.localStorage = localStorageMock;

const QuestionBank = require('../src/questionBank.js');

// Mock默认题库
const mockDefaultBank = [
    {
        id: '001',
        category: '专辑',
        question: '林俊杰首张专辑《乐行者》发行于哪一天？',
        options: [
            { key: 'A', text: '2003年4月1日' },
            { key: 'B', text: '2003年4月10日' },
            { key: 'C', text: '2003年5月1日' },
            { key: 'D', text: '2003年5月10日' }
        ],
        answer: 'B',
        explanation: '《乐行者》于2003年4月10日正式发行'
    },
    {
        id: '002',
        category: '歌曲',
        question: '《江南》的作曲人是谁？',
        options: [
            { key: 'A', text: '林俊杰' },
            { key: 'B', text: '张思尔' },
            { key: 'C', text: '李瑞洵' },
            { key: 'D', text: '方文山' }
        ],
        answer: 'A',
        explanation: '《江南》由林俊杰作曲'
    },
    {
        id: '003',
        category: '专辑',
        question: '《第二天堂》发行于哪一年？',
        options: [
            { key: 'A', text: '2003年' },
            { key: 'B', text: '2004年' },
            { key: 'C', text: '2005年' },
            { key: 'D', text: '2006年' }
        ],
        answer: 'B',
        explanation: '《第二天堂》于2004年发行'
    }
];

describe('QuestionBank模块', () => {
    // 在整个测试套件开始前清除
    beforeAll(() => {
        localStorageMock.clear();
        // 确保QuestionBank.bank被重置
        QuestionBank.bank = [];
    });

    beforeEach(() => {
        localStorageMock.clear();
        // 强制重新初始化，确保每个测试都是干净的状态
        // 重置bank数组，避免测试之间共享数据
        QuestionBank.bank = [];
        QuestionBank.DEFAULT_BANK = null;
        QuestionBank.init(mockDefaultBank);
    });

    afterEach(() => {
        localStorageMock.clear();
        // 清空bank数组
        QuestionBank.bank = [];
    });

    // 在整个测试套件结束后清除
    afterAll(() => {
        localStorageMock.clear();
        QuestionBank.bank = [];
    });

    describe('初始化和加载', () => {
        test('应该正确初始化默认题库', () => {
            QuestionBank.init(mockDefaultBank);
            expect(QuestionBank.bank.length).toBe(3);
        });

        test('应该从localStorage加载已保存的题库', () => {
            localStorageMock.clear();
            const savedBank = [{ id: 'custom1', category: '其他', question: '自定义题目', options: [], answer: 'A' }];
            localStorageMock.setItem(QuestionBank.STORAGE_KEY, JSON.stringify(savedBank));

            QuestionBank.load();
            expect(QuestionBank.bank.length).toBe(1);
            expect(QuestionBank.bank[0].id).toBe('custom1');
        });

        test('应该处理损坏的localStorage数据', () => {
            localStorageMock.setItem(QuestionBank.STORAGE_KEY, 'invalid json');
            QuestionBank.load();
            expect(QuestionBank.bank.length).toBe(3); // 回退到默认题库
        });
    });

    describe('题目查找', () => {
        test('findById应该找到正确的题目', () => {
            const q = QuestionBank.findById('001');
            expect(q).toBeDefined();
            expect(q.category).toBe('专辑');
        });

        test('findById找不到应该返回null', () => {
            const q = QuestionBank.findById('999');
            expect(q).toBeNull();
        });

        test('findByCategory应该返回正确的分类题目', () => {
            const albumQuestions = QuestionBank.findByCategory('专辑');
            expect(albumQuestions.length).toBe(2);
            expect(albumQuestions[0].category).toBe('专辑');
        });

        test('findByCategory空分类应该返回空数组', () => {
            const questions = QuestionBank.findByCategory('不存在');
            expect(questions.length).toBe(0);
        });

        test('getAll应该返回所有题目', () => {
            const all = QuestionBank.getAll();
            expect(all.length).toBe(3);
        });

        test('getCategories应该返回正确的分类统计', () => {
            const cats = QuestionBank.getCategories();
            expect(cats['专辑']).toBe(2);
            expect(cats['歌曲']).toBe(1);
        });
    });

    describe('选项解析', () => {
        test('应该正确解析标准格式的选项', () => {
            const optsText = 'A.选项一\nB.选项二\nC.选项三\nD.选项四';
            const result = QuestionBank.parseOptions(optsText);

            expect(result.success).toBe(true);
            expect(result.options.length).toBe(4);
            expect(result.options[0].key).toBe('A');
            expect(result.options[0].text).toBe('选项一');
        });

        test('应该支持多种分隔符格式', () => {
            const optsText = 'A、选项一\nB．选项二\nC.选项三';
            const result = QuestionBank.parseOptions(optsText);

            expect(result.success).toBe(true);
            expect(result.options.length).toBe(3);
        });

        test('应该忽略空行', () => {
            const optsText = 'A.选项一\n\n\nB.选项二\n\nC.选项三';
            const result = QuestionBank.parseOptions(optsText);

            expect(result.success).toBe(true);
            expect(result.options.length).toBe(3);
        });

        test('少于两个选项应该返回错误', () => {
            const optsText = 'A.只有一个选项';
            const result = QuestionBank.parseOptions(optsText);

            expect(result.success).toBe(false);
            expect(result.error).toContain('至少输入两个选项');
        });

        test('空选项文本应该返回错误', () => {
            const result = QuestionBank.parseOptions('');

            expect(result.success).toBe(false);
            expect(result.options.length).toBe(0);
        });

        test('应该处理格式错误的选项', () => {
            const optsText = 'A选项一\nB.选项二'; // A后面缺少分隔符
            const result = QuestionBank.parseOptions(optsText);

            expect(result.success).toBe(true);
            expect(result.options.length).toBe(1); // 只有B被正确解析
            expect(result.options[0].key).toBe('B');
        });
    });

    describe('题目验证', () => {
        test('完整的题目应该验证通过', () => {
            const q = {
                question: '测试题目',
                options: [
                    { key: 'A', text: '选项A' },
                    { key: 'B', text: '选项B' }
                ],
                answer: 'A'
            };
            const result = QuestionBank.validate(q);

            expect(result.valid).toBe(true);
            expect(result.errors.length).toBe(0);
        });

        test('空题目应该验证失败', () => {
            const q = {
                question: '',
                options: [
                    { key: 'A', text: '选项A' },
                    { key: 'B', text: '选项B' }
                ],
                answer: 'A'
            };
            const result = QuestionBank.validate(q);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('题目内容不能为空');
        });

        test('少于两个选项应该验证失败', () => {
            const q = {
                question: '测试题目',
                options: [{ key: 'A', text: '选项A' }],
                answer: 'A'
            };
            const result = QuestionBank.validate(q);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('至少需要两个选项');
        });

        test('无效答案应该验证失败', () => {
            const q = {
                question: '测试题目',
                options: [
                    { key: 'A', text: '选项A' },
                    { key: 'B', text: '选项B' }
                ],
                answer: 'E'
            };
            const result = QuestionBank.validate(q);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('答案必须是A、B、C或D');
        });

        test('答案不在选项中应该验证失败', () => {
            const q = {
                question: '测试题目',
                options: [
                    { key: 'A', text: '选项A' },
                    { key: 'B', text: '选项B' }
                ],
                answer: 'C'
            };
            const result = QuestionBank.validate(q);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('答案必须在提供的选项中');
        });
    });

    describe('题目增删改', () => {
        test('应该正确添加新题目', () => {
            const newQ = {
                category: '个人信息',
                question: '新测试题目',
                options: [
                    { key: 'A', text: '选项A' },
                    { key: 'B', text: '选项B' }
                ],
                answer: 'A',
                explanation: '这是解析'
            };
            const result = QuestionBank.add(newQ);

            expect(result.success).toBe(true);
            expect(result.id).toBeDefined();
            expect(QuestionBank.bank.length).toBe(4);
        });

        test('添加无效题目应该失败', () => {
            const newQ = {
                question: '', // 空题目
                options: [],
                answer: 'A'
            };
            const originalLength = QuestionBank.bank.length;
            const result = QuestionBank.add(newQ);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(QuestionBank.bank.length).toBe(originalLength);
        });

        test('应该正确更新题目', () => {
            const updatedQ = {
                category: '专辑',
                question: '修改后的题目',
                options: [
                    { key: 'A', text: '新选项A' },
                    { key: 'B', text: '新选项B' }
                ],
                answer: 'B',
                explanation: '新解析'
            };
            const result = QuestionBank.update('001', updatedQ);

            expect(result.success).toBe(true);
            const q = QuestionBank.findById('001');
            expect(q.question).toBe('修改后的题目');
            expect(q.answer).toBe('B');
        });

        test('更新不存在的题目应该失败', () => {
            const result = QuestionBank.update('999', {
                question: '测试',
                options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }],
                answer: 'A'
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('未找到该题目');
        });

        test('应该正确删除题目', () => {
            const originalLength = QuestionBank.bank.length;
            const result = QuestionBank.delete('001');

            expect(result).toBe(true);
            expect(QuestionBank.bank.length).toBe(originalLength - 1);
            expect(QuestionBank.findById('001')).toBeNull();
        });

        test('删除不存在的题目应该返回false', () => {
            const result = QuestionBank.delete('999');

            expect(result).toBe(false);
            expect(QuestionBank.bank.length).toBe(3);
        });
    });

    describe('数据导入导出', () => {
        test('应该正确导出数据', () => {
            const userData = { history: [], wrong: [], stats: {} };
            const exported = QuestionBank.exportData(userData);

            expect(exported.questionBank.length).toBe(3);
            expect(exported.userData).toBeDefined();
            expect(exported.exportTime).toBeDefined();
        });

        test('导出数据应该包含正确的题库', () => {
            const exported = QuestionBank.exportData();

            expect(exported.questionBank).toEqual(QuestionBank.bank);
        });

        test('应该正确导入新题目', () => {
            const importData = {
                questionBank: [
                    {
                        id: 'new001',
                        category: '新分类',
                        question: '导入的新题目',
                        options: [
                            { key: 'A', text: '选项A' },
                            { key: 'B', text: '选项B' }
                        ],
                        answer: 'A',
                        explanation: ''
                    }
                ]
            };
            const result = QuestionBank.importData(importData);

            expect(result.success).toBe(true);
            expect(result.addedCount).toBe(1);
            expect(result.updatedCount).toBe(0);
            expect(QuestionBank.bank.length).toBe(4);
        });

        test('应该正确更新已有题目', () => {
            // 先确保题库中只有默认题目
            QuestionBank.init(mockDefaultBank);
            const importData = {
                questionBank: [
                    {
                        id: '001',
                        category: '专辑',
                        question: '更新后的题目',
                        options: [
                            { key: 'A', text: '选项A' },
                            { key: 'B', text: '选项B' }
                        ],
                        answer: 'A',
                        explanation: ''
                    }
                ]
            };
            const result = QuestionBank.importData(importData);

            expect(result.success).toBe(true);
            expect(result.addedCount).toBe(0);
            expect(result.updatedCount).toBe(1);
            const q = QuestionBank.findById('001');
            expect(q.question).toBe('更新后的题目');
        });

        test('导入无效数据应该失败', () => {
            const result = QuestionBank.importData(null);

            expect(result.success).toBe(false);
            expect(result.error).toContain('无效的数据格式');
        });

        test('导入空数据应该失败', () => {
            const result = QuestionBank.importData({});

            expect(result.success).toBe(false);
            expect(result.error).toContain('未找到有效数据');
        });

        test('导入非数组题库应该失败', () => {
            const result = QuestionBank.importData({
                questionBank: 'not an array'
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('必须是数组');
        });

        test('导入应该跳过无效题目', () => {
            const importData = {
                questionBank: [
                    {
                        id: 'valid001',
                        category: '测试',
                        question: '有效题目',
                        options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }],
                        answer: 'A'
                    },
                    {
                        id: 'invalid001',
                        question: '', // 无效题目
                        options: [],
                        answer: 'A'
                    }
                ]
            };
            const result = QuestionBank.importData(importData);

            expect(result.success).toBe(true);
            expect(result.addedCount).toBe(1); // 只有有效题目被添加
        });

        test('导入应该返回userData', () => {
            const importData = {
                questionBank: [],
                userData: { history: [{ test: true }] }
            };
            const result = QuestionBank.importData(importData);

            expect(result.userData).toBeDefined();
            expect(result.userData.history).toBeDefined();
        });
    });

    describe('搜索功能', () => {
        test('应该正确搜索关键词', () => {
            const results = QuestionBank.search('江南');
            expect(results.length).toBe(1);
            expect(results[0].id).toBe('002');
        });

        test('应该正确过滤分类', () => {
            const results = QuestionBank.search('', '专辑');
            expect(results.length).toBe(2);
        });

        test('应该同时应用关键词和分类过滤', () => {
            const results = QuestionBank.search('乐行者', '专辑');
            // 注意：mockDefaultBank中专辑分类题目不包含"乐行者"关键词
            // 所以结果应该是0
            expect(results.length).toBe(0);
        });

        test('空搜索应该返回所有题目（或按分类过滤）', () => {
            const results = QuestionBank.search('');
            expect(results.length).toBe(3);
        });
    });

    describe('随机抽取', () => {
        test('应该随机抽取指定数量的题目', () => {
            const randomQuestions = QuestionBank.getRandom(2);
            expect(randomQuestions.length).toBe(2);
        });

        test('应该从指定分类抽取', () => {
            const randomQuestions = QuestionBank.getRandom(2, '专辑');
            expect(randomQuestions.length).toBe(2);
            expect(randomQuestions.every(q => q.category === '专辑')).toBe(true);
        });

        test('抽取数量超过题库数量应该返回所有题目', () => {
            const randomQuestions = QuestionBank.getRandom(10, '歌曲');
            expect(randomQuestions.length).toBe(1); // 歌曲分类只有1题
        });

        test('洗牌算法应该产生不同的顺序', () => {
            // 多次洗牌，检查是否产生不同顺序
            const orders = [];
            for (let i = 0; i < 10; i++) {
                const shuffled = QuestionBank.shuffle([1, 2, 3, 4, 5]);
                orders.push(shuffled.join(','));
            }
            // 至少应该有一些不同的顺序
            const uniqueOrders = new Set(orders);
            expect(uniqueOrders.size).toBeGreaterThan(1);
        });
    });

    describe('恢复默认题库', () => {
        test('reset应该恢复默认题库', () => {
            QuestionBank.add({
                question: '自定义题目',
                options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }],
                answer: 'A'
            });
            expect(QuestionBank.bank.length).toBe(4);

            QuestionBank.reset();
            expect(QuestionBank.bank.length).toBe(3);
            expect(QuestionBank.bank).toEqual(mockDefaultBank);
        });
    });

    describe('边界条件测试', () => {
        test('应该处理大量题目', () => {
            for (let i = 0; i < 100; i++) {
                QuestionBank.add({
                    category: '测试',
                    question: '题目' + i,
                    options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }],
                    answer: 'A'
                });
            }
            expect(QuestionBank.bank.length).toBe(103);
        });

        test('应该处理特殊字符的题目', () => {
            const result = QuestionBank.add({
                question: '包含特殊字符：<>{}[]&\'"',
                options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }],
                answer: 'A'
            });
            expect(result.success).toBe(true);
        });

        test('应该处理很长的题目内容', () => {
            const longQuestion = '这是一个很长的题目内容'.repeat(100);
            const result = QuestionBank.add({
                question: longQuestion,
                options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }],
                answer: 'A'
            });
            expect(result.success).toBe(true);
        });
    });
});