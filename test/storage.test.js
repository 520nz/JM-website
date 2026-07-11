const fs = require('fs');
const path = require('path');

function createEscContext() {
    const code = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
    const vm = require('vm');
    const document = {
        createElement: (tag) => ({
            textContent: '',
            get innerHTML() {
                return this.textContent
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            },
            set innerHTML(val) { this.textContent = val; }
        })
    };
    const context = { document };
    vm.runInNewContext(code, context);
    return context;
}

describe('XSS转义工具 - esc', () => {
    it('应该转义HTML特殊字符', () => {
        const ctx = createEscContext();
        expect(ctx.esc('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
        expect(ctx.esc('<div>test</div>')).toBe('&lt;div&gt;test&lt;/div&gt;');
        expect(ctx.esc('"test"')).toBe('&quot;test&quot;');
        expect(ctx.esc("'test'")).toBe("&#39;test&#39;");
    });

    it('应该处理null和undefined', () => {
        const ctx = createEscContext();
        expect(ctx.esc(null)).toBe('');
        expect(ctx.esc(undefined)).toBe('');
    });

    it('应该处理数字和对象', () => {
        const ctx = createEscContext();
        expect(ctx.esc(123)).toBe('123');
        expect(ctx.esc({})).toBe('[object Object]');
    });
});

describe('DB模块 - 数据存储', () => {
    it('应该返回默认数据', () => {
        const code = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
        const vm = require('vm');
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const document = {
            createElement: (tag) => ({
                textContent: '',
                get innerHTML() { return this.textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
                set innerHTML(val) { this.textContent = val; }
            })
        };
        const QUESTION_BANK = [{ id: 'q1', category: '测试' }];
        const DEFAULT_QUESTION_BANK = QUESTION_BANK.slice();
        
        const context = { localStorage: localStorageMock, document, QUESTION_BANK, DEFAULT_QUESTION_BANK, Date };
        vm.runInNewContext(code, context);
        
        const data = context.DB.get();
        expect(data.history).toEqual([]);
        expect(data.wrong).toEqual([]);
        expect(data.stats).toEqual({ total: 0, correct: 0, cats: {} });
    });

    it('应该从localStorage加载数据', () => {
        const code = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
        const vm = require('vm');
        const localStorageMock = {
            getItem: jest.fn().mockReturnValue(JSON.stringify({
                history: [{ qid: 'q1', ans: 'A', ok: true, time: 123 }],
                wrong: [],
                stats: { total: 1, correct: 1, cats: {} }
            })),
            setItem: jest.fn()
        };
        const document = { createElement: () => ({ textContent: '', innerHTML: '' }) };
        const QUESTION_BANK = [{ id: 'q1', category: '测试' }];
        const DEFAULT_QUESTION_BANK = QUESTION_BANK.slice();
        
        const context = { localStorage: localStorageMock, document, QUESTION_BANK, DEFAULT_QUESTION_BANK, Date };
        vm.runInNewContext(code, context);
        
        const data = context.DB.get();
        expect(data.history).toEqual([{ qid: 'q1', ans: 'A', ok: true, time: 123 }]);
        expect(data.stats.total).toBe(1);
    });

    it('应该处理JSON解析错误', () => {
        const code = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
        const vm = require('vm');
        const localStorageMock = {
            getItem: jest.fn().mockReturnValue('invalid json'),
            setItem: jest.fn()
        };
        const document = { createElement: () => ({ textContent: '', innerHTML: '' }) };
        const QUESTION_BANK = [{ id: 'q1', category: '测试' }];
        const DEFAULT_QUESTION_BANK = QUESTION_BANK.slice();
        
        const context = { localStorage: localStorageMock, document, QUESTION_BANK, DEFAULT_QUESTION_BANK, Date };
        vm.runInNewContext(code, context);
        
        const data = context.DB.get();
        expect(data).toEqual({ history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } });
    });

    it('应该保存数据到localStorage', () => {
        const code = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
        const vm = require('vm');
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const document = { createElement: () => ({ textContent: '', innerHTML: '' }) };
        const QUESTION_BANK = [{ id: 'q1', category: '测试' }];
        const DEFAULT_QUESTION_BANK = QUESTION_BANK.slice();
        
        const context = { localStorage: localStorageMock, document, QUESTION_BANK, DEFAULT_QUESTION_BANK, Date };
        vm.runInNewContext(code, context);
        
        context.DB.addRecord({ qid: 'q1', ans: 'A', ok: true, time: Date.now() });
        expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('应该查找题目', () => {
        const code = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
        const vm = require('vm');
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const document = { createElement: () => ({ textContent: '', innerHTML: '' }) };
        const QUESTION_BANK = [{ id: 'q1', category: '测试' }];
        const DEFAULT_QUESTION_BANK = QUESTION_BANK.slice();
        
        const context = { localStorage: localStorageMock, document, QUESTION_BANK, DEFAULT_QUESTION_BANK, Date };
        vm.runInNewContext(code, context);
        
        const q = context.DB.findQ('q1');
        expect(q).toBeDefined();
        expect(q.id).toBe('q1');
        expect(context.DB.findQ('nonexistent')).toBeNull();
    });
});

describe('DB模块 - 答题记录', () => {
    it('应该添加正确答案记录', () => {
        const code = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
        const vm = require('vm');
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const document = { createElement: () => ({ textContent: '', innerHTML: '' }) };
        const QUESTION_BANK = [{ id: 'q1', category: '测试' }];
        const DEFAULT_QUESTION_BANK = QUESTION_BANK.slice();
        
        const context = { localStorage: localStorageMock, document, QUESTION_BANK, DEFAULT_QUESTION_BANK, Date };
        vm.runInNewContext(code, context);
        
        context.DB.addRecord({ qid: 'q1', ans: 'A', ok: true, time: Date.now() });
        const data = context.DB.get();
        expect(data.history.length).toBe(1);
        expect(data.stats.total).toBe(1);
        expect(data.stats.correct).toBe(1);
        expect(data.stats.cats['测试'].t).toBe(1);
        expect(data.stats.cats['测试'].c).toBe(1);
    });

    it('应该添加错误答案记录', () => {
        const code = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
        const vm = require('vm');
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const document = { createElement: () => ({ textContent: '', innerHTML: '' }) };
        const QUESTION_BANK = [{ id: 'q1', category: '测试' }];
        const DEFAULT_QUESTION_BANK = QUESTION_BANK.slice();
        
        const context = { localStorage: localStorageMock, document, QUESTION_BANK, DEFAULT_QUESTION_BANK, Date };
        vm.runInNewContext(code, context);
        
        context.DB.addRecord({ qid: 'q1', ans: 'B', ok: false, time: Date.now() });
        const data = context.DB.get();
        expect(data.history.length).toBe(1);
        expect(data.stats.total).toBe(1);
        expect(data.stats.correct).toBe(0);
        expect(data.stats.cats['测试'].t).toBe(1);
        expect(data.stats.cats['测试'].c).toBe(0);
    });
});

describe('DB模块 - 间隔重复逻辑', () => {
    it('应该添加错题', () => {
        const code = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
        const vm = require('vm');
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const document = { createElement: () => ({ textContent: '', innerHTML: '' }) };
        const QUESTION_BANK = [{ id: 'q1', category: '测试' }];
        const DEFAULT_QUESTION_BANK = QUESTION_BANK.slice();
        
        const context = { localStorage: localStorageMock, document, QUESTION_BANK, DEFAULT_QUESTION_BANK, Date };
        vm.runInNewContext(code, context);
        
        context.DB.addWrong('q1');
        const data = context.DB.get();
        expect(data.wrong.length).toBe(1);
        expect(data.wrong[0].qid).toBe('q1');
        expect(data.wrong[0].cnt).toBe(1);
        expect(data.wrong[0].level).toBe(0);
    });

    it('应该增加已有错题的计数并重置等级', () => {
        const code = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
        const vm = require('vm');
        const localStorageMock = {
            getItem: jest.fn().mockReturnValue(JSON.stringify({
                history: [],
                wrong: [{ qid: 'q1', cnt: 2, level: 3, time: Date.now() }],
                stats: { total: 0, correct: 0, cats: {} }
            })),
            setItem: jest.fn()
        };
        const document = { createElement: () => ({ textContent: '', innerHTML: '' }) };
        const QUESTION_BANK = [{ id: 'q1', category: '测试' }];
        const DEFAULT_QUESTION_BANK = QUESTION_BANK.slice();
        
        const context = { localStorage: localStorageMock, document, QUESTION_BANK, DEFAULT_QUESTION_BANK, Date };
        vm.runInNewContext(code, context);
        
        context.DB.addWrong('q1');
        const data = context.DB.get();
        expect(data.wrong[0].cnt).toBe(3);
        expect(data.wrong[0].level).toBe(0);
    });

    it('应该在答对错题时提升等级', () => {
        const code = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
        const vm = require('vm');
        const localStorageMock = {
            getItem: jest.fn().mockReturnValue(JSON.stringify({
                history: [],
                wrong: [{ qid: 'q1', cnt: 1, level: 0, time: Date.now(), nextReview: Date.now() }],
                stats: { total: 0, correct: 0, cats: {} }
            })),
            setItem: jest.fn()
        };
        const document = { createElement: () => ({ textContent: '', innerHTML: '' }) };
        const QUESTION_BANK = [{ id: 'q1', category: '测试' }];
        const DEFAULT_QUESTION_BANK = QUESTION_BANK.slice();
        
        const context = { localStorage: localStorageMock, document, QUESTION_BANK, DEFAULT_QUESTION_BANK, Date };
        vm.runInNewContext(code, context);
        
        context.DB.reviewCorrect('q1');
        const data = context.DB.get();
        expect(data.wrong[0].level).toBe(1);
        expect(data.wrong[0].nextReview).toBeGreaterThan(Date.now());
    });

    it('应该在等级达到5时移除错题', () => {
        const code = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
        const vm = require('vm');
        const localStorageMock = {
            getItem: jest.fn().mockReturnValue(JSON.stringify({
                history: [],
                wrong: [{ qid: 'q1', cnt: 1, level: 4, time: Date.now(), nextReview: Date.now() }],
                stats: { total: 0, correct: 0, cats: {} }
            })),
            setItem: jest.fn()
        };
        const document = { createElement: () => ({ textContent: '', innerHTML: '' }) };
        const QUESTION_BANK = [{ id: 'q1', category: '测试' }];
        const DEFAULT_QUESTION_BANK = QUESTION_BANK.slice();
        
        const context = { localStorage: localStorageMock, document, QUESTION_BANK, DEFAULT_QUESTION_BANK, Date };
        vm.runInNewContext(code, context);
        
        context.DB.reviewCorrect('q1');
        const data = context.DB.get();
        expect(data.wrong.length).toBe(0);
    });

    it('应该在答错错题时重置等级', () => {
        const code = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
        const vm = require('vm');
        const localStorageMock = {
            getItem: jest.fn().mockReturnValue(JSON.stringify({
                history: [],
                wrong: [{ qid: 'q1', cnt: 1, level: 3, time: Date.now(), nextReview: Date.now() }],
                stats: { total: 0, correct: 0, cats: {} }
            })),
            setItem: jest.fn()
        };
        const document = { createElement: () => ({ textContent: '', innerHTML: '' }) };
        const QUESTION_BANK = [{ id: 'q1', category: '测试' }];
        const DEFAULT_QUESTION_BANK = QUESTION_BANK.slice();
        
        const context = { localStorage: localStorageMock, document, QUESTION_BANK, DEFAULT_QUESTION_BANK, Date };
        vm.runInNewContext(code, context);
        
        context.DB.reviewWrong('q1');
        const data = context.DB.get();
        expect(data.wrong[0].level).toBe(0);
        expect(data.wrong[0].cnt).toBe(2);
    });

    it('应该获取到期的错题', () => {
        const code = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
        const vm = require('vm');
        const now = Date.now();
        const localStorageMock = {
            getItem: jest.fn().mockReturnValue(JSON.stringify({
                history: [],
                wrong: [
                    { qid: 'q1', cnt: 1, level: 0, nextReview: now - 1000 },
                    { qid: 'q2', cnt: 1, level: 0, nextReview: now + 1000 }
                ],
                stats: { total: 0, correct: 0, cats: {} }
            })),
            setItem: jest.fn()
        };
        const document = { createElement: () => ({ textContent: '', innerHTML: '' }) };
        const QUESTION_BANK = [{ id: 'q1', category: '测试' }, { id: 'q2', category: '测试' }];
        const DEFAULT_QUESTION_BANK = QUESTION_BANK.slice();
        
        const context = { localStorage: localStorageMock, document, QUESTION_BANK, DEFAULT_QUESTION_BANK, Date };
        vm.runInNewContext(code, context);
        
        const due = context.DB.getDueWrong();
        expect(due.length).toBe(1);
        expect(due[0].qid).toBe('q1');
    });

    it('应该移除错题', () => {
        const code = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
        const vm = require('vm');
        const localStorageMock = {
            getItem: jest.fn().mockReturnValue(JSON.stringify({
                history: [],
                wrong: [{ qid: 'q1', cnt: 1, level: 0 }],
                stats: { total: 0, correct: 0, cats: {} }
            })),
            setItem: jest.fn()
        };
        const document = { createElement: () => ({ textContent: '', innerHTML: '' }) };
        const QUESTION_BANK = [{ id: 'q1', category: '测试' }];
        const DEFAULT_QUESTION_BANK = QUESTION_BANK.slice();
        
        const context = { localStorage: localStorageMock, document, QUESTION_BANK, DEFAULT_QUESTION_BANK, Date };
        vm.runInNewContext(code, context);
        
        context.DB.removeWrong('q1');
        const data = context.DB.get();
        expect(data.wrong.length).toBe(0);
    });
});

describe('DB模块 - 统计重算', () => {
    it('应该从历史记录重新计算统计', () => {
        const code = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
        const vm = require('vm');
        const localStorageMock = {
            getItem: jest.fn().mockReturnValue(JSON.stringify({
                history: [
                    { qid: 'q1', ans: 'A', ok: true, time: Date.now() },
                    { qid: 'q1', ans: 'B', ok: false, time: Date.now() }
                ],
                wrong: [],
                stats: { total: 0, correct: 0, cats: {} }
            })),
            setItem: jest.fn()
        };
        const document = { createElement: () => ({ textContent: '', innerHTML: '' }) };
        const QUESTION_BANK = [{ id: 'q1', category: '测试' }];
        const DEFAULT_QUESTION_BANK = QUESTION_BANK.slice();
        
        const context = { localStorage: localStorageMock, document, QUESTION_BANK, DEFAULT_QUESTION_BANK, Date };
        vm.runInNewContext(code, context);
        
        context.DB.recalcStats();
        const data = context.DB.get();
        expect(data.stats.total).toBe(2);
        expect(data.stats.correct).toBe(1);
        expect(data.stats.cats['测试'].t).toBe(2);
        expect(data.stats.cats['测试'].c).toBe(1);
    });
});

describe('QuestionStore模块', () => {
    it('应该保存题库到localStorage', () => {
        const code = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
        const vm = require('vm');
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const document = { createElement: () => ({ textContent: '', innerHTML: '' }) };
        const QUESTION_BANK = [{ id: 'q1', category: '测试' }];
        const DEFAULT_QUESTION_BANK = QUESTION_BANK.slice();
        
        const context = { localStorage: localStorageMock, document, QUESTION_BANK, DEFAULT_QUESTION_BANK, Date };
        vm.runInNewContext(code, context);
        
        context.QuestionStore.save();
        expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('应该从localStorage加载题库', () => {
        const code = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
        const vm = require('vm');
        const localStorageMock = {
            getItem: jest.fn().mockReturnValue(JSON.stringify([{ id: 'q2', category: '测试', question: '测试题2' }])),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const document = { createElement: () => ({ textContent: '', innerHTML: '' }) };
        const QUESTION_BANK = [{ id: 'q1', category: '测试' }];
        const DEFAULT_QUESTION_BANK = QUESTION_BANK.slice();
        
        const context = { localStorage: localStorageMock, document, QUESTION_BANK, DEFAULT_QUESTION_BANK, Date };
        vm.runInNewContext(code, context);
        
        context.QuestionStore.load();
        expect(context.QUESTION_BANK.length).toBe(1);
        expect(context.QUESTION_BANK[0].id).toBe('q2');
    });

    it('应该恢复默认题库', () => {
        const code = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
        const vm = require('vm');
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const document = { createElement: () => ({ textContent: '', innerHTML: '' }) };
        const QUESTION_BANK = [{ id: 'modified', category: '测试' }];
        const DEFAULT_QUESTION_BANK = [{ id: 'q1', category: '测试' }];
        
        const context = { localStorage: localStorageMock, document, QUESTION_BANK, DEFAULT_QUESTION_BANK, Date };
        vm.runInNewContext(code, context);
        
        context.QuestionStore.reset();
        expect(localStorageMock.removeItem).toHaveBeenCalled();
        expect(context.QUESTION_BANK.length).toBe(1);
        expect(context.QUESTION_BANK[0].id).toBe('q1');
    });
});

describe('Session模块', () => {
    it('应该保存会话到sessionStorage', () => {
        const code = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
        const vm = require('vm');
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const document = { createElement: () => ({ textContent: '', innerHTML: '' }) };
        const QUESTION_BANK = [{ id: 'q1', category: '测试' }];
        const DEFAULT_QUESTION_BANK = QUESTION_BANK.slice();
        
        const context = { localStorage: localStorageMock, sessionStorage: sessionStorageMock, document, QUESTION_BANK, DEFAULT_QUESTION_BANK, Date };
        vm.runInNewContext(code, context);
        
        context.Session.save({
            quiz: [{ id: 'q1' }],
            idx: 0,
            correctCount: 0,
            startTime: Date.now(),
            mode: 'quick'
        });
        expect(sessionStorageMock.setItem).toHaveBeenCalled();
    });

    it('应该从sessionStorage加载会话', () => {
        const code = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
        const vm = require('vm');
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionData = {
            quizIds: ['q1'],
            idx: 0,
            correctCount: 0,
            startTime: Date.now(),
            mode: 'quick'
        };
        const sessionStorageMock = {
            getItem: jest.fn().mockReturnValue(JSON.stringify(sessionData)),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const document = { createElement: () => ({ textContent: '', innerHTML: '' }) };
        const QUESTION_BANK = [{ id: 'q1', category: '测试' }];
        const DEFAULT_QUESTION_BANK = QUESTION_BANK.slice();
        
        const context = { localStorage: localStorageMock, sessionStorage: sessionStorageMock, document, QUESTION_BANK, DEFAULT_QUESTION_BANK, Date };
        vm.runInNewContext(code, context);
        
        const loaded = context.Session.load();
        expect(loaded.quizIds).toEqual(['q1']);
        expect(loaded.idx).toBe(0);
    });

    it('应该处理加载失败', () => {
        const code = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
        const vm = require('vm');
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = {
            getItem: jest.fn().mockReturnValue('invalid'),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const document = { createElement: () => ({ textContent: '', innerHTML: '' }) };
        const QUESTION_BANK = [{ id: 'q1', category: '测试' }];
        const DEFAULT_QUESTION_BANK = QUESTION_BANK.slice();
        
        const context = { localStorage: localStorageMock, sessionStorage: sessionStorageMock, document, QUESTION_BANK, DEFAULT_QUESTION_BANK, Date };
        vm.runInNewContext(code, context);
        
        const loaded = context.Session.load();
        expect(loaded).toBeNull();
    });

    it('应该清除会话', () => {
        const code = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
        const vm = require('vm');
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const document = { createElement: () => ({ textContent: '', innerHTML: '' }) };
        const QUESTION_BANK = [{ id: 'q1', category: '测试' }];
        const DEFAULT_QUESTION_BANK = QUESTION_BANK.slice();
        
        const context = { localStorage: localStorageMock, sessionStorage: sessionStorageMock, document, QUESTION_BANK, DEFAULT_QUESTION_BANK, Date };
        vm.runInNewContext(code, context);
        
        context.Session.clear();
        expect(sessionStorageMock.removeItem).toHaveBeenCalled();
    });
});