const fs = require('fs');
const path = require('path');

function loadModules(localStorageMock, sessionStorageMock, documentMock) {
    const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
    const dataCode = fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf8');
    const quizCode = fs.readFileSync(path.join(__dirname, '../js/quiz.js'), 'utf8');
    const vm = require('vm');
    const context = {
        localStorage: localStorageMock,
        sessionStorage: sessionStorageMock,
        document: documentMock,
        window: { addEventListener: jest.fn() },
        Date: Date,
        clearInterval: jest.fn(),
        setInterval: jest.fn().mockReturnValue(1),
        switchView: jest.fn()
    };
    vm.runInNewContext(storageCode, context);
    vm.runInNewContext(dataCode, context);
    vm.runInNewContext(quizCode, context);
    return context;
}

function createDocumentMock() {
    return {
        querySelector: jest.fn().mockReturnValue({ classList: { add: jest.fn(), remove: jest.fn(), contains: jest.fn() } }),
        querySelectorAll: jest.fn().mockReturnValue([]),
        getElementById: jest.fn().mockReturnValue({ 
            value: '', 
            textContent: '', 
            innerHTML: '', 
            style: {}, 
            classList: { add: jest.fn(), remove: jest.fn(), contains: jest.fn() } 
        }),
        addEventListener: jest.fn(),
        createElement: jest.fn().mockReturnValue({
            textContent: '',
            get innerHTML() {
                return this.textContent
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            },
            set innerHTML(val) { this.textContent = val; },
            classList: { add: jest.fn(), remove: jest.fn() },
            style: {},
            insertBefore: jest.fn()
        })
    };
}

describe('答题引擎 - 状态管理', () => {
    it('应该初始化默认状态', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const documentMock = createDocumentMock();
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        expect(ctx.state.quiz).toEqual([]);
        expect(ctx.state.idx).toBe(0);
        expect(ctx.state.answered).toBe(false);
        expect(ctx.state.mode).toBe('quick');
        expect(ctx.state.correctCount).toBe(0);
        expect(ctx.state.isWrongBookQuiz).toBe(false);
    });

    it('应该切换模式', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const documentMock = createDocumentMock();
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        ctx.selectMode('standard');
        expect(ctx.state.mode).toBe('standard');
        ctx.selectMode('intensive');
        expect(ctx.state.mode).toBe('intensive');
    });

    it('应该根据模式返回不同题目数量', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const documentMock = createDocumentMock();
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        expect(ctx.getCount()).toBe(10);
        ctx.selectMode('standard');
        expect(ctx.getCount()).toBe(20);
        ctx.selectMode('intensive');
        expect(ctx.getCount()).toBe(30);
    });
});

describe('答题引擎 - 计时器', () => {
    it('应该启动计时器', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const documentMock = createDocumentMock();
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        ctx.startTimer();
        expect(ctx.state.startTime).toBeDefined();
        expect(ctx.state.timer).toBe(1);
    });

    it('应该停止计时器', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const documentMock = createDocumentMock();
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        ctx.startTimer();
        expect(ctx.state.timer).toBe(1);
        ctx.stopTimer();
        expect(ctx.state.timer).toBeNull();
    });

    it('应该格式化时间', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const documentMock = createDocumentMock();
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        expect(ctx.fmtTime(60000)).toBe('1分0秒');
        expect(ctx.fmtTime(65000)).toBe('1分5秒');
        expect(ctx.fmtTime(3600000)).toBe('60分0秒');
    });
});

describe('答题引擎 - 随机打乱', () => {
    it('应该打乱数组顺序', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const documentMock = createDocumentMock();
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        const arr = [1, 2, 3, 4, 5];
        const shuffled = ctx.shuffle(arr);
        expect(shuffled).toHaveLength(5);
        expect(shuffled).toEqual(expect.arrayContaining(arr));
    });

    it('应该返回新数组不修改原数组', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const documentMock = createDocumentMock();
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        const arr = [1, 2, 3];
        const original = [...arr];
        ctx.shuffle(arr);
        expect(arr).toEqual(original);
    });
});

describe('答题引擎 - 答题流程', () => {
    it('应该开始随机答题', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const documentMock = {
            querySelector: jest.fn().mockReturnValue({ classList: { add: jest.fn(), remove: jest.fn() } }),
            querySelectorAll: jest.fn().mockReturnValue([]),
            getElementById: jest.fn().mockReturnValue({ innerHTML: '', textContent: '', style: {}, classList: { add: jest.fn(), remove: jest.fn() } }),
            addEventListener: jest.fn(),
            createElement: jest.fn().mockReturnValue({
                textContent: '',
                get innerHTML() { return this.textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
                set innerHTML(val) { this.textContent = val; },
                classList: { add: jest.fn(), remove: jest.fn() },
                style: {}
            })
        };
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        ctx.startRandomQuiz();
        expect(ctx.state.quiz.length).toBe(10);
        expect(ctx.state.idx).toBe(0);
        expect(ctx.state.correctCount).toBe(0);
        expect(ctx.state.isWrongBookQuiz).toBe(false);
    });

    it('应该开始分类答题', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const documentMock = {
            querySelector: jest.fn().mockReturnValue({ classList: { add: jest.fn(), remove: jest.fn() } }),
            querySelectorAll: jest.fn().mockReturnValue([]),
            getElementById: jest.fn().mockReturnValue({ innerHTML: '', textContent: '', style: {}, classList: { add: jest.fn(), remove: jest.fn() } }),
            addEventListener: jest.fn(),
            createElement: jest.fn().mockReturnValue({
                textContent: '',
                get innerHTML() { return this.textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
                set innerHTML(val) { this.textContent = val; },
                classList: { add: jest.fn(), remove: jest.fn() },
                style: {}
            })
        };
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        ctx.startCatQuiz('专辑');
        expect(ctx.state.quiz.length).toBeGreaterThan(0);
        expect(ctx.state.idx).toBe(0);
        expect(ctx.state.isWrongBookQuiz).toBe(false);
    });

    it('应该开始错题本复习', () => {
        const localStorageMock = {
            getItem: jest.fn().mockReturnValue(JSON.stringify({
                history: [],
                wrong: [{ qid: '001', cnt: 1, level: 0, nextReview: Date.now() }],
                stats: { total: 0, correct: 0, cats: {} }
            })),
            setItem: jest.fn()
        };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const documentMock = {
            querySelector: jest.fn().mockReturnValue({ classList: { add: jest.fn(), remove: jest.fn() } }),
            querySelectorAll: jest.fn().mockReturnValue([]),
            getElementById: jest.fn().mockReturnValue({ innerHTML: '', textContent: '', style: {}, classList: { add: jest.fn(), remove: jest.fn() } }),
            addEventListener: jest.fn(),
            createElement: jest.fn().mockReturnValue({
                textContent: '',
                get innerHTML() { return this.textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
                set innerHTML(val) { this.textContent = val; },
                classList: { add: jest.fn(), remove: jest.fn() },
                style: {}
            })
        };
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        ctx.startWrongBookQuiz();
        expect(ctx.state.isWrongBookQuiz).toBe(true);
    });
});

describe('答题引擎 - 答题中断恢复', () => {
    it('应该恢复有效的会话', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const savedTime = Date.now() - 10000;
        const sessionStorageMock = {
            getItem: jest.fn().mockReturnValue(JSON.stringify({
                quizIds: ['001'],
                idx: 0,
                correctCount: 0,
                startTime: savedTime,
                mode: 'quick'
            })),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const documentMock = createDocumentMock();
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        const result = ctx.tryResumeSession();
        expect(result).toBe(true);
        expect(ctx.state.idx).toBe(0);
        expect(ctx.state.correctCount).toBe(0);
    });

    it('应该不恢复已完成的会话', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = {
            getItem: jest.fn().mockReturnValue(JSON.stringify({
                quizIds: ['001'],
                idx: 1,
                correctCount: 0,
                startTime: Date.now(),
                mode: 'quick'
            })),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        const documentMock = createDocumentMock();
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        const result = ctx.tryResumeSession();
        expect(result).toBe(false);
    });

    it('应该不恢复无效会话', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const documentMock = createDocumentMock();
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        const result = ctx.tryResumeSession();
        expect(result).toBe(false);
    });

    it('应该清除会话', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const documentMock = createDocumentMock();
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        ctx.Session.clear();
        expect(sessionStorageMock.removeItem).toHaveBeenCalled();
    });
});

describe('答题引擎 - 键盘快捷键', () => {
    it('应该处理A-D键选择答案', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const documentMock = {
            querySelector: jest.fn(),
            querySelectorAll: jest.fn().mockReturnValue([]),
            getElementById: jest.fn().mockImplementation((id) => {
                if (id === 'view-practice') return { classList: { contains: () => true } };
                if (id.startsWith('opt-')) return { classList: { add: jest.fn(), remove: jest.fn() } };
                if (id === 'fb') return { className: '', classList: { add: jest.fn() } };
                if (id === 'fbTitle') return { textContent: '' };
                if (id === 'fbDesc') return { textContent: '' };
                if (id === 'nextBtn') return { style: {} };
                return { innerHTML: '', textContent: '', style: {} };
            }),
            addEventListener: jest.fn(),
            createElement: jest.fn().mockReturnValue({ textContent: '', innerHTML: '', classList: { add: jest.fn(), remove: jest.fn() }, style: {} })
        };
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        ctx.state.quiz = [{ id: 'q1', answer: 'A', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }] }];
        ctx.state.idx = 0;
        ctx.state.answered = false;
        const event = { key: 'a', preventDefault: jest.fn(), toUpperCase: () => 'A' };
        ctx.handleQuizKeydown(event);
        expect(ctx.state.answered).toBe(true);
    });

    it('应该处理空格键进入下一题', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const documentMock = {
            querySelector: jest.fn(),
            querySelectorAll: jest.fn().mockReturnValue([]),
            getElementById: jest.fn().mockImplementation((id) => {
                if (id === 'view-practice') return { classList: { contains: () => true } };
                if (id === 'quizArea') return { innerHTML: '' };
                return { innerHTML: '', textContent: '', style: {} };
            }),
            addEventListener: jest.fn(),
            createElement: jest.fn().mockReturnValue({ textContent: '', innerHTML: '', classList: { add: jest.fn(), remove: jest.fn() }, style: {} })
        };
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        ctx.state.quiz = [{ id: 'q1', answer: 'A', options: [{ key: 'A', text: 'A' }] }, { id: 'q2', answer: 'B', options: [{ key: 'B', text: 'B' }] }];
        ctx.state.idx = 0;
        ctx.state.answered = true;
        const event = { key: ' ', preventDefault: jest.fn() };
        ctx.handleQuizKeydown(event);
        expect(ctx.state.idx).toBe(1);
    });
});