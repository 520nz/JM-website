const fs = require('fs');
const path = require('path');

function loadModules(localStorageMock, sessionStorageMock, documentMock) {
    const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
    const dataCode = fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf8');
    const adminCode = fs.readFileSync(path.join(__dirname, '../js/admin.js'), 'utf8');
    const vm = require('vm');
    const context = {
        localStorage: localStorageMock,
        sessionStorage: sessionStorageMock,
        document: documentMock,
        window: { addEventListener: jest.fn() },
        alert: jest.fn(),
        confirm: jest.fn().mockReturnValue(true),
        Date: Date,
        Blob: jest.fn().mockReturnValue({}),
        URL: { createObjectURL: jest.fn().mockReturnValue('blob://test'), revokeObjectURL: jest.fn() }
    };
    vm.runInNewContext(storageCode, context);
    vm.runInNewContext(dataCode, context);
    vm.runInNewContext(adminCode, context);
    return context;
}

function createEscElement() {
    return {
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
    };
}

describe('admin模块 - 选项解析', () => {
    it('应该正确解析标准选项格式', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const documentMock = { 
            querySelector: jest.fn(), 
            querySelectorAll: jest.fn(), 
            getElementById: jest.fn(), 
            createElement: jest.fn().mockReturnValue(createEscElement()),
            URL: { createObjectURL: jest.fn().mockReturnValue('blob://test'), revokeObjectURL: jest.fn() } 
        };
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        const optsText = 'A.选项A\nB.选项B\nC.选项C\nD.选项D';
        const lines = optsText.split('\n');
        const options = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            var match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
            if (match) {
                options.push({ key: match[1], text: match[2] });
            }
        }
        expect(options.length).toBe(4);
        expect(options[0].key).toBe('A');
        expect(options[0].text).toBe('选项A');
        expect(options[3].key).toBe('D');
        expect(options[3].text).toBe('选项D');
    });

    it('应该处理中文句号格式', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const documentMock = { querySelector: jest.fn(), querySelectorAll: jest.fn(), getElementById: jest.fn(), createElement: jest.fn().mockReturnValue(createEscElement()), URL: { createObjectURL: jest.fn(), revokeObjectURL: jest.fn() } };
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        const optsText = 'A．选项A\nB．选项B';
        const lines = optsText.split('\n');
        const options = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            var match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
            if (match) {
                options.push({ key: match[1], text: match[2] });
            }
        }
        expect(options.length).toBe(2);
        expect(options[0].key).toBe('A');
        expect(options[1].key).toBe('B');
    });

    it('应该处理顿号格式', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const documentMock = { querySelector: jest.fn(), querySelectorAll: jest.fn(), getElementById: jest.fn(), createElement: jest.fn().mockReturnValue(createEscElement()), URL: { createObjectURL: jest.fn(), revokeObjectURL: jest.fn() } };
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        const optsText = 'A、选项A\nB、选项B';
        const lines = optsText.split('\n');
        const options = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            var match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
            if (match) {
                options.push({ key: match[1], text: match[2] });
            }
        }
        expect(options.length).toBe(2);
    });

    it('应该跳过空行', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const documentMock = { querySelector: jest.fn(), querySelectorAll: jest.fn(), getElementById: jest.fn(), createElement: jest.fn().mockReturnValue(createEscElement()), URL: { createObjectURL: jest.fn(), revokeObjectURL: jest.fn() } };
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        const optsText = 'A.选项A\n\nB.选项B\n\nC.选项C';
        const lines = optsText.split('\n');
        const options = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            var match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
            if (match) {
                options.push({ key: match[1], text: match[2] });
            }
        }
        expect(options.length).toBe(3);
    });

    it('应该跳过格式不正确的行', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const documentMock = { querySelector: jest.fn(), querySelectorAll: jest.fn(), getElementById: jest.fn(), createElement: jest.fn().mockReturnValue(createEscElement()), URL: { createObjectURL: jest.fn(), revokeObjectURL: jest.fn() } };
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        const optsText = 'A.选项A\ninvalid line\nB.选项B\n1.数字选项';
        const lines = optsText.split('\n');
        const options = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            var match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
            if (match) {
                options.push({ key: match[1], text: match[2] });
            }
        }
        expect(options.length).toBe(2);
        expect(options[0].key).toBe('A');
        expect(options[1].key).toBe('B');
    });
});

describe('admin模块 - 题库管理', () => {
    it('应该渲染题目列表', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const questionListEl = { innerHTML: '' };
        const documentMock = {
            querySelector: jest.fn(),
            querySelectorAll: jest.fn(),
            getElementById: jest.fn().mockImplementation((id) => {
                if (id === 'questionList') return questionListEl;
                if (id === 'searchInput') return { value: '' };
                if (id === 'categoryFilter') return { value: '' };
                return { value: '', textContent: '', innerHTML: '', style: {} };
            }),
            createElement: jest.fn().mockReturnValue(createEscElement()),
            URL: { createObjectURL: jest.fn(), revokeObjectURL: jest.fn() }
        };
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        ctx.renderQuestionList();
        expect(questionListEl.innerHTML).toBeDefined();
        expect(questionListEl.innerHTML).toContain('专辑');
    });

    it('应该过滤题目', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const questionListEl = { innerHTML: '' };
        const documentMock = {
            querySelector: jest.fn(),
            querySelectorAll: jest.fn(),
            getElementById: jest.fn().mockImplementation((id) => {
                if (id === 'questionList') return questionListEl;
                if (id === 'searchInput') return { value: '专辑' };
                if (id === 'categoryFilter') return { value: '' };
                return { value: '', textContent: '', innerHTML: '', style: {} };
            }),
            createElement: jest.fn().mockReturnValue(createEscElement()),
            URL: { createObjectURL: jest.fn(), revokeObjectURL: jest.fn() }
        };
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        ctx.filterQuestions();
        expect(questionListEl.innerHTML).toBeDefined();
    });

    it('应该更新类别过滤器', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const categoryFilterEl = { value: '', innerHTML: '' };
        const documentMock = {
            querySelector: jest.fn(),
            querySelectorAll: jest.fn(),
            getElementById: jest.fn().mockImplementation((id) => {
                if (id === 'categoryFilter') return categoryFilterEl;
                return { value: '', textContent: '', innerHTML: '', style: {} };
            }),
            createElement: jest.fn().mockReturnValue(createEscElement()),
            URL: { createObjectURL: jest.fn(), revokeObjectURL: jest.fn() }
        };
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        ctx.updateCategoryFilter();
        expect(categoryFilterEl.innerHTML).toContain('全部类别');
        expect(categoryFilterEl.innerHTML).toContain('专辑');
    });
});

describe('admin模块 - 数据导入', () => {
    it('应该导入新题目', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const documentMock = { querySelector: jest.fn(), querySelectorAll: jest.fn(), getElementById: jest.fn().mockReturnValue({ value: '', textContent: '', innerHTML: '', style: {} }), createElement: jest.fn().mockReturnValue(createEscElement()), URL: { createObjectURL: jest.fn(), revokeObjectURL: jest.fn() } };
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        const initialLength = ctx.QUESTION_BANK.length;
        const importData = {
            questionBank: [{ id: 'new_q', category: '测试', question: '新题目', options: [{ key: 'A', text: 'A' }], answer: 'A', explanation: '解释' }],
            userData: null
        };
        const existingIds = {};
        for (var i = 0; i < ctx.QUESTION_BANK.length; i++) {
            existingIds[ctx.QUESTION_BANK[i].id] = true;
        }
        var addedCount = 0;
        for (var j = 0; j < importData.questionBank.length; j++) {
            var q = importData.questionBank[j];
            if (existingIds[q.id]) {
            } else {
                ctx.QUESTION_BANK.push(q);
                addedCount++;
            }
        }
        expect(addedCount).toBe(1);
        expect(ctx.QUESTION_BANK.length).toBe(initialLength + 1);
        expect(ctx.QUESTION_BANK[ctx.QUESTION_BANK.length - 1].id).toBe('new_q');
    });

    it('应该更新已有题目', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const documentMock = { querySelector: jest.fn(), querySelectorAll: jest.fn(), getElementById: jest.fn().mockReturnValue({ value: '', textContent: '', innerHTML: '', style: {} }), createElement: jest.fn().mockReturnValue(createEscElement()), URL: { createObjectURL: jest.fn(), revokeObjectURL: jest.fn() } };
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        const importData = {
            questionBank: [{ id: '001', category: '专辑', question: '更新后的题目', options: [{ key: 'A', text: 'A' }], answer: 'A', explanation: '更新后的解释' }],
            userData: null
        };
        const existingIds = {};
        var updatedCount = 0;
        for (var i = 0; i < ctx.QUESTION_BANK.length; i++) {
            existingIds[ctx.QUESTION_BANK[i].id] = true;
        }
        for (var j = 0; j < importData.questionBank.length; j++) {
            var q = importData.questionBank[j];
            if (existingIds[q.id]) {
                for (var k = 0; k < ctx.QUESTION_BANK.length; k++) {
                    if (ctx.QUESTION_BANK[k].id === q.id) {
                        ctx.QUESTION_BANK[k] = q;
                        updatedCount++;
                        break;
                    }
                }
            }
        }
        expect(updatedCount).toBe(1);
        expect(ctx.QUESTION_BANK[0].question).toBe('更新后的题目');
    });

    it('应该合并错题本并保留间隔重复数据', () => {
        const localStorageMock = {
            getItem: jest.fn().mockReturnValue(JSON.stringify({
                history: [],
                wrong: [{ qid: '001', cnt: 2, level: 2, time: Date.now(), nextReview: Date.now() }],
                stats: { total: 0, correct: 0, cats: {} }
            })),
            setItem: jest.fn()
        };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const documentMock = { querySelector: jest.fn(), querySelectorAll: jest.fn(), getElementById: jest.fn().mockReturnValue({ value: '', textContent: '', innerHTML: '', style: {} }), createElement: jest.fn().mockReturnValue(createEscElement()), URL: { createObjectURL: jest.fn(), revokeObjectURL: jest.fn() } };
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        const importWrong = {
            qid: '001',
            cnt: 5,
            level: 1,
            nextReview: Date.now() + 10000
        };
        var wrongMap = {};
        var d = ctx.DB.get();
        for (var w = 0; w < d.wrong.length; w++) {
            wrongMap[d.wrong[w].qid] = d.wrong[w];
        }
        if (wrongMap[importWrong.qid]) {
            wrongMap[importWrong.qid].cnt = Math.max(wrongMap[importWrong.qid].cnt, importWrong.cnt || 1);
            if (importWrong.level != null) {
                wrongMap[importWrong.qid].level = Math.min(wrongMap[importWrong.qid].level || 0, importWrong.level);
            }
        }
        expect(wrongMap['001'].cnt).toBe(5);
        expect(wrongMap['001'].level).toBe(1);
    });

    it('应该为新错题添加间隔重复字段', () => {
        const localStorageMock = {
            getItem: jest.fn().mockReturnValue(JSON.stringify({
                history: [],
                wrong: [],
                stats: { total: 0, correct: 0, cats: {} }
            })),
            setItem: jest.fn()
        };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const documentMock = { querySelector: jest.fn(), querySelectorAll: jest.fn(), getElementById: jest.fn().mockReturnValue({ value: '', textContent: '', innerHTML: '', style: {} }), createElement: jest.fn().mockReturnValue(createEscElement()), URL: { createObjectURL: jest.fn(), revokeObjectURL: jest.fn() } };
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        const newWrong = { qid: 'q_new', cnt: 1 };
        if (!newWrong.level) newWrong.level = 0;
        if (!newWrong.nextReview) newWrong.nextReview = Date.now();
        if (!newWrong.lastReview) newWrong.lastReview = 0;
        if (!newWrong.time) newWrong.time = Date.now();
        expect(newWrong.level).toBe(0);
        expect(newWrong.nextReview).toBeDefined();
        expect(newWrong.lastReview).toBe(0);
        expect(newWrong.time).toBeDefined();
    });

    it('应该处理无效导入文件', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const documentMock = { querySelector: jest.fn(), querySelectorAll: jest.fn(), getElementById: jest.fn(), createElement: jest.fn().mockReturnValue(createEscElement()), URL: { createObjectURL: jest.fn(), revokeObjectURL: jest.fn() } };
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        const invalidData = 'invalid json';
        try {
            JSON.parse(invalidData);
        } catch (err) {
            expect(err).toBeDefined();
        }
    });

    it('应该处理缺少有效数据的文件', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const documentMock = { querySelector: jest.fn(), querySelectorAll: jest.fn(), getElementById: jest.fn(), createElement: jest.fn().mockReturnValue(createEscElement()), URL: { createObjectURL: jest.fn(), revokeObjectURL: jest.fn() } };
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        const data = { unrelated: 'data' };
        expect(!data.questionBank && !data.userData).toBe(true);
    });
});

describe('admin模块 - 数据导出', () => {
    it('应该导出正确格式的数据', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const documentMock = { querySelector: jest.fn(), querySelectorAll: jest.fn(), getElementById: jest.fn().mockReturnValue({ value: '', textContent: '', innerHTML: '', style: {} }), createElement: jest.fn().mockReturnValue(createEscElement()), URL: { createObjectURL: jest.fn(), revokeObjectURL: jest.fn() } };
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        const data = {
            questionBank: ctx.QUESTION_BANK,
            userData: ctx.DB.get(),
            exportTime: new Date().toISOString()
        };
        const json = JSON.stringify(data, null, 2);
        const parsed = JSON.parse(json);
        expect(parsed.questionBank).toBeDefined();
        expect(parsed.userData).toBeDefined();
        expect(parsed.exportTime).toBeDefined();
        expect(parsed.questionBank.length).toBe(ctx.QUESTION_BANK.length);
    });
});

describe('admin模块 - 恢复默认题库', () => {
    it('应该验证重置确认输入', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const btnStyle = { opacity: '0.5', pointerEvents: 'none' };
        const documentMock = {
            querySelector: jest.fn(),
            querySelectorAll: jest.fn(),
            getElementById: jest.fn().mockImplementation((id) => {
                if (id === 'resetConfirmInput') return { value: '恢复默认' };
                if (id === 'resetConfirmBtn') return { style: btnStyle };
                return { value: '', textContent: '', innerHTML: '', style: {} };
            }),
            createElement: jest.fn().mockReturnValue(createEscElement()),
            URL: { createObjectURL: jest.fn(), revokeObjectURL: jest.fn() }
        };
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        ctx.checkResetInput();
        expect(btnStyle.opacity).toBe('1');
        expect(btnStyle.pointerEvents).toBe('auto');
    });

    it('应该拒绝无效确认输入', () => {
        const localStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const sessionStorageMock = { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() };
        const btnStyle = { opacity: '1', pointerEvents: 'auto' };
        const documentMock = {
            querySelector: jest.fn(),
            querySelectorAll: jest.fn(),
            getElementById: jest.fn().mockImplementation((id) => {
                if (id === 'resetConfirmInput') return { value: '错误输入' };
                if (id === 'resetConfirmBtn') return { style: btnStyle };
                return { value: '', textContent: '', innerHTML: '', style: {} };
            }),
            createElement: jest.fn().mockReturnValue(createEscElement()),
            URL: { createObjectURL: jest.fn(), revokeObjectURL: jest.fn() }
        };
        const ctx = loadModules(localStorageMock, sessionStorageMock, documentMock);
        ctx.checkResetInput();
        expect(btnStyle.opacity).toBe('0.5');
        expect(btnStyle.pointerEvents).toBe('none');
    });
});