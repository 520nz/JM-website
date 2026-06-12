/**
 * 数据导入导出模块测试
 * 测试覆盖：JSON导出、导入验证、数据合并、选项解析
 */

// 测试数据
const mockQuestionBank = [
    {
        id: '001',
        category: '专辑',
        question: '问题1',
        options: [
            { key: 'A', text: '选项A' },
            { key: 'B', text: '选项B' }
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
            { key: 'B', text: '选项B' }
        ],
        answer: 'A',
        explanation: '解析2'
    }
];

const mockUserData = {
    history: [
        { qid: '001', ans: 'B', ok: true, time: Date.now() }
    ],
    wrong: [
        { qid: '002', cnt: 1, time: Date.now() }
    ],
    stats: {
        total: 1,
        correct: 1,
        cats: {
            '专辑': { t: 1, c: 1 }
        }
    }
};

describe('DataManager模块', () => {
    let DataManager;

    beforeEach(() => {
        // 设置全局mock
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
        DataManager = require('../js/data-manager.js');
    });

    describe('exportData()', () => {
        test('应返回正确的导出数据结构', () => {
            const exported = DataManager.exportData(mockQuestionBank, mockUserData);

            expect(exported).toHaveProperty('questionBank');
            expect(exported).toHaveProperty('userData');
            expect(exported).toHaveProperty('exportTime');
            expect(exported.questionBank.length).toBe(2);
        });

        test('导出时间应为ISO格式', () => {
            const exported = DataManager.exportData(mockQuestionBank, mockUserData);
            const date = new Date(exported.exportTime);
            expect(date.toISOString()).toBe(exported.exportTime);
        });
    });

    describe('downloadJSON()', () => {
        test('应生成正确的JSON字符串', () => {
            const data = { test: 'value' };
            const result = DataManager.downloadJSON(data);

            expect(result.json).toContain('"test"');
            expect(result.json).toContain('"value"');
        });

        test('应生成正确的文件名', () => {
            const data = { test: 'value' };
            const result = DataManager.downloadJSON(data);

            expect(result.filename).toMatch(/^jj_quiz_backup_\d{4}-\d{2}-\d{2}\.json$/);
        });

        test('应使用自定义文件名', () => {
            const data = { test: 'value' };
            const result = DataManager.downloadJSON(data, 'custom.json');

            expect(result.filename).toBe('custom.json');
        });
    });

    describe('validateImportData()', () => {
        test('有效数据应通过验证', () => {
            const data = {
                questionBank: mockQuestionBank,
                userData: mockUserData
            };

            const result = DataManager.validateImportData(data);
            expect(result.valid).toBe(true);
            expect(result.errors.length).toBe(0);
        });

        test('非对象数据应失败', () => {
            const result = DataManager.validateImportData('not an object');
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        test('缺少有效数据应失败', () => {
            const result = DataManager.validateImportData({});
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('文件中未找到有效数据（questionBank 或 userData）');
        });

        test('questionBank非数组应失败', () => {
            const result = DataManager.validateImportData({
                questionBank: 'not an array'
            });
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('questionBank 必须是数组');
        });

        test('缺少必要字段的题目应失败', () => {
            const result = DataManager.validateImportData({
                questionBank: [
                    { id: '001' } // 缺少其他必要字段
                ]
            });
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('缺少category'))).toBe(true);
            expect(result.errors.some(e => e.includes('缺少question'))).toBe(true);
        });

        test('选项不足应失败', () => {
            const result = DataManager.validateImportData({
                questionBank: [
                    {
                        id: '001',
                        category: '测试',
                        question: '问题',
                        options: [{ key: 'A', text: '选项A' }], // 只有1个选项
                        answer: 'A'
                    }
                ]
            });
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('options必须为至少包含2个选项'))).toBe(true);
        });

        test('选项缺少key或text应失败', () => {
            const result = DataManager.validateImportData({
                questionBank: [
                    {
                        id: '001',
                        category: '测试',
                        question: '问题',
                        options: [
                            { key: 'A' }, // 缺少text
                            { text: '选项B' } // 缺少key
                        ],
                        answer: 'A'
                    }
                ]
            });
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('缺少key或text'))).toBe(true);
        });

        test('无效的userData格式应失败', () => {
            const result = DataManager.validateImportData({
                userData: {
                    history: 'not an array',
                    wrong: 'not an array',
                    stats: 'not an object'
                }
            });
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('userData.history 必须是数组');
            expect(result.errors).toContain('userData.wrong 必须是数组');
            expect(result.errors).toContain('userData.stats 必须是对象');
        });
    });

    describe('validateQuestion()', () => {
        test('有效题目应返回空错误数组', () => {
            const errors = DataManager.validateQuestion(mockQuestionBank[0], 0);
            expect(errors.length).toBe(0);
        });

        test('缺少id应返回错误', () => {
            const q = { ...mockQuestionBank[0], id: undefined };
            const errors = DataManager.validateQuestion(q, 0);
            expect(errors).toContain('题目[0] 缺少id字段');
        });

        test('错误信息应包含题目索引', () => {
            const q = { id: 'test' };
            const errors = DataManager.validateQuestion(q, 5);
            expect(errors[0]).toContain('[5]');
        });
    });

    describe('parseJSON()', () => {
        test('有效JSON应成功解析', () => {
            const result = DataManager.parseJSON('{"key":"value"}');
            expect(result.success).toBe(true);
            expect(result.data).toEqual({ key: 'value' });
        });

        test('无效JSON应返回错误', () => {
            const result = DataManager.parseJSON('not valid json');
            expect(result.success).toBe(false);
            expect(result.error).toContain('文件格式不正确');
        });

        test('空字符串应返回错误', () => {
            const result = DataManager.parseJSON('');
            expect(result.success).toBe(false);
        });
    });

    describe('mergeQuestionBanks()', () => {
        test('应正确合并新题目', () => {
            const existing = [{ id: '001', question: 'Q1' }];
            const newBank = [{ id: '002', question: 'Q2' }];

            const result = DataManager.mergeQuestionBanks(existing, newBank);

            expect(result.questionBank.length).toBe(2);
            expect(result.addedCount).toBe(1);
            expect(result.updatedCount).toBe(0);
        });

        test('应正确更新现有题目', () => {
            const existing = [{ id: '001', question: '旧问题' }];
            const newBank = [{ id: '001', question: '新问题' }];

            const result = DataManager.mergeQuestionBanks(existing, newBank);

            expect(result.questionBank.length).toBe(1);
            expect(result.questionBank[0].question).toBe('新问题');
            expect(result.addedCount).toBe(0);
            expect(result.updatedCount).toBe(1);
        });

        test('应同时处理新增和更新', () => {
            const existing = [
                { id: '001', question: 'Q1' },
                { id: '002', question: 'Q2' }
            ];
            const newBank = [
                { id: '002', question: 'Q2更新' },
                { id: '003', question: 'Q3' }
            ];

            const result = DataManager.mergeQuestionBanks(existing, newBank);

            expect(result.questionBank.length).toBe(3);
            expect(result.addedCount).toBe(1);
            expect(result.updatedCount).toBe(1);
        });

        test('空新题库应不改变原题库', () => {
            const existing = [{ id: '001', question: 'Q1' }];
            const result = DataManager.mergeQuestionBanks(existing, []);

            expect(result.questionBank.length).toBe(1);
            expect(result.addedCount).toBe(0);
            expect(result.updatedCount).toBe(0);
        });
    });

    describe('mergeUserData()', () => {
        test('应正确合并历史记录', () => {
            const existing = {
                history: [{ qid: '001' }],
                wrong: [],
                stats: { total: 0, correct: 0, cats: {} }
            };
            const newData = {
                history: [{ qid: '002' }]
            };

            const result = DataManager.mergeUserData(existing, newData);
            expect(result.history.length).toBe(2);
        });

        test('应正确合并错题计数', () => {
            const existing = {
                history: [],
                wrong: [{ qid: '001', cnt: 2 }],
                stats: { total: 0, correct: 0, cats: {} }
            };
            const newData = {
                wrong: [{ qid: '001', cnt: 3 }]
            };

            const result = DataManager.mergeUserData(existing, newData);
            expect(result.wrong[0].cnt).toBe(5);
        });

        test('应正确合并统计数据', () => {
            const existing = {
                history: [],
                wrong: [],
                stats: {
                    total: 10,
                    correct: 8,
                    cats: {
                        '专辑': { t: 5, c: 4 }
                    }
                }
            };
            const newData = {
                stats: {
                    total: 5,
                    correct: 3,
                    cats: {
                        '专辑': { t: 3, c: 2 },
                        '歌曲': { t: 2, c: 1 }
                    }
                }
            };

            const result = DataManager.mergeUserData(existing, newData);
            expect(result.stats.total).toBe(15);
            expect(result.stats.correct).toBe(11);
            expect(result.stats.cats['专辑'].t).toBe(8);
            expect(result.stats.cats['专辑'].c).toBe(6);
            expect(result.stats.cats['歌曲'].t).toBe(2);
        });
    });

    describe('importData()', () => {
        test('完整导入流程应成功', () => {
            const json = JSON.stringify({
                questionBank: [{ id: '003', category: '测试', question: 'Q3', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'A' }],
                userData: {
                    history: [{ qid: '003', ans: 'A', ok: true, time: Date.now() }],
                    wrong: [],
                    stats: { total: 1, correct: 1, cats: {} }
                }
            });

            const result = DataManager.importData(json, mockQuestionBank, mockUserData);

            expect(result.success).toBe(true);
            expect(result.questionBank.length).toBe(3);
            expect(result.addedCount).toBe(1);
        });

        test('无效JSON应返回错误', () => {
            const result = DataManager.importData('invalid json', mockQuestionBank, mockUserData);

            expect(result.success).toBe(false);
            expect(result.error).toContain('文件格式不正确');
        });

        test('验证失败应返回错误', () => {
            const json = JSON.stringify({
                questionBank: [{ id: '001' }] // 缺少必要字段
            });

            const result = DataManager.importData(json, mockQuestionBank, mockUserData);

            expect(result.success).toBe(false);
            expect(result.error).toContain('缺少');
        });
    });

    describe('parseOptions()', () => {
        test('应正确解析标准格式选项', () => {
            const text = 'A.选项A\nB.选项B\nC.选项C\nD.选项D';
            const result = DataManager.parseOptions(text);

            expect(result.options.length).toBe(4);
            expect(result.options[0]).toEqual({ key: 'A', text: '选项A' });
            expect(result.errors.length).toBe(0);
        });

        test('应支持中文句号', () => {
            const text = 'A．选项A\nB．选项B';
            const result = DataManager.parseOptions(text);

            expect(result.options.length).toBe(2);
        });

        test('应支持顿号分隔', () => {
            const text = 'A、选项A\nB、选项B';
            const result = DataManager.parseOptions(text);

            expect(result.options.length).toBe(2);
        });

        test('应忽略空行', () => {
            const text = 'A.选项A\n\nB.选项B\n';
            const result = DataManager.parseOptions(text);

            expect(result.options.length).toBe(2);
        });

        test('格式错误应返回错误信息', () => {
            const text = 'A.选项A\n错误格式\nB.选项B';
            const result = DataManager.parseOptions(text);

            expect(result.errors.length).toBe(1);
            expect(result.errors[0]).toContain('格式不正确');
        });
    });

    describe('createQuestion()', () => {
        test('应创建正确的题目对象', () => {
            const q = DataManager.createQuestion({
                category: '测试',
                question: '问题',
                options: [{ key: 'A', text: 'A' }],
                answer: 'A',
                explanation: '解析'
            });

            expect(q).toHaveProperty('id');
            expect(q.category).toBe('测试');
            expect(q.question).toBe('问题');
        });

        test('应自动生成ID', () => {
            const q1 = DataManager.createQuestion({ question: 'Q1' });
            const q2 = DataManager.createQuestion({ question: 'Q2' });

            expect(q1.id).toBeDefined();
            expect(q2.id).toBeDefined();
            // 注意：由于Date.now()可能相同，这个测试可能偶尔失败
        });
    });

    describe('updateQuestion()', () => {
        test('应正确更新题目', () => {
            const bank = [{ id: '001', question: '旧问题' }];
            const result = DataManager.updateQuestion(bank, '001', { question: '新问题' });

            expect(result).toBe(true);
            expect(bank[0].question).toBe('新问题');
        });

        test('更新不存在的题目应返回false', () => {
            const bank = [{ id: '001', question: '问题' }];
            const result = DataManager.updateQuestion(bank, '999', { question: '新问题' });

            expect(result).toBe(false);
        });
    });

    describe('deleteQuestion()', () => {
        test('应正确删除题目', () => {
            const bank = [
                { id: '001', question: 'Q1' },
                { id: '002', question: 'Q2' }
            ];

            const result = DataManager.deleteQuestion(bank, '001');

            expect(result.length).toBe(1);
            expect(result[0].id).toBe('002');
        });

        test('删除不存在的题目应返回原数组', () => {
            const bank = [{ id: '001', question: 'Q1' }];
            const result = DataManager.deleteQuestion(bank, '999');

            expect(result.length).toBe(1);
        });
    });
});
