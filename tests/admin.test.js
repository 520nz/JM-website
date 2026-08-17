import { describe, it, beforeAll, beforeEach, expect } from 'vitest';
import { loadApp, initStorage, resetStorage } from './_common.js';

let A;

function setupAdminDOM() {
    const defs = {
        categoryFilter: 'select', editCategory: 'select', editAnswer: 'select',
        searchInput: 'input', editId: 'input', editQuestion: 'input', resetConfirmInput: 'input',
        editOptions: 'textarea', editExplanation: 'textarea',
    };
    const ids = Object.keys(defs);
    for (const id of ids) {
        if (!document.getElementById(id)) {
            const el = document.createElement(defs[id]);
            el.id = id;
            if (defs[id] === 'select') {
                el.innerHTML = '<option value=""></option><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>';
            }
            document.body.appendChild(el);
        }
    }
    const extra = ['editModal', 'resetModal', 'resetConfirmBtn', 'saveBtn', 'form-msg', 'q-form', 'import-file', 'questionList', 'modalTitle'];
    for (const id of extra) {
        if (!document.getElementById(id)) {
            const el = document.createElement('div');
            el.id = id;
            document.body.appendChild(el);
        }
    }
    if (!document.querySelector('.modal')) {
        const m = document.createElement('div');
        m.className = 'modal';
        document.body.appendChild(m);
    }
}

beforeAll(async () => {
    A = loadApp();
    await initStorage();
});

beforeEach(() => {
    resetStorage();
    A.QUESTION_BANK = A.DEFAULT_QUESTION_BANK.slice();
    setupAdminDOM();
});

function getEl(id) {
    const el = document.getElementById(id);
    if (!el.value) {
        Object.defineProperty(el, 'value', { writable: true, configurable: true, value: '' });
    }
    return el;
}

describe('admin.js - 模块暴露', () => {
    it('应暴露管理页所有操作函数', () => {
        for (const name of ['renderAdmin', 'filterQuestions', 'showAddForm', 'showEditForm',
                            'saveQuestion', 'deleteQuestion', 'exportData', 'importData',
                            'resetQuestionBank', 'closeModal']) {
            expect(typeof A[name]).toBe('function');
        }
    });
});

describe('admin.js - saveQuestion', () => {
    function fillForm(id, category, questionText, optionsText, answer, explanation) {
        getEl('editId').value = id;
        getEl('editCategory').value = category;
        getEl('editQuestion').value = questionText;
        getEl('editOptions').value = optionsText;
        getEl('editAnswer').value = answer;
        getEl('editExplanation').value = explanation;
    }

    it('新增题目应追加到题库末尾', () => {
        const origLen = A.QUESTION_BANK.length;
        fillForm('', '测试分类', '测试题？', 'A.选项A\nB.选项B\nC.选项C\nD.选项D', 'A', '解释');
        A.saveQuestion();
        expect(A.QUESTION_BANK.length).toBe(origLen + 1);
        const newQ = A.QUESTION_BANK[A.QUESTION_BANK.length - 1];
        expect(newQ.category).toBe('测试分类');
        expect(newQ.question).toBe('测试题？');
        expect(newQ.answer).toBe('A');
        expect(newQ.options.length).toBe(4);
    });

    it('题目为空应弹出提示且不保存', () => {
        const origLen = A.QUESTION_BANK.length;
        fillForm('', '测试', '', 'A.a\nB.b', 'A', '');
        A.saveQuestion();
        expect(A.QUESTION_BANK.length).toBe(origLen);
    });

    it('选项不足 2 个应提示且不保存', () => {
        const origLen = A.QUESTION_BANK.length;
        fillForm('', '测试', 'Q?', 'A.a', 'A', '');
        A.saveQuestion();
        expect(A.QUESTION_BANK.length).toBe(origLen);
    });

    it('编辑已有题目应更新字段而非新增', () => {
        const origLen = A.QUESTION_BANK.length;
        const existingId = A.QUESTION_BANK[0].id;
        fillForm(existingId, '新分类', '新题？', 'A.a\nB.b', 'B', '');
        A.saveQuestion();
        expect(A.QUESTION_BANK.length).toBe(origLen);
        const q = A.QUESTION_BANK.find(x => x.id === existingId);
        expect(q.category).toBe('新分类');
        expect(q.answer).toBe('B');
    });
});

describe('admin.js - deleteQuestion', () => {
    it('应从题库移除指定 id', () => {
        const origLen = A.QUESTION_BANK.length;
        const id = A.QUESTION_BANK[0].id;
        A.deleteQuestion(id);
        expect(A.QUESTION_BANK.length).toBe(origLen - 1);
        expect(A.QUESTION_BANK.find(q => q.id === id)).toBeUndefined();
    });

    it('confirm 返回 false 时不应删除', () => {
        const origLen = A.QUESTION_BANK.length;
        const id = A.QUESTION_BANK[0].id;
        const origConfirm = window.confirm;
        window.confirm = () => false;
        try {
            A.deleteQuestion(id);
            expect(A.QUESTION_BANK.length).toBe(origLen);
        } finally {
            window.confirm = origConfirm;
        }
    });
});

describe('admin.js - 选项解析正则', () => {
    function parseOptions(text) {
        const lines = text.split('\n');
        const options = [];
        for (const line of lines) {
            const match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
            if (match) options.push({ key: match[1], text: match[2] });
        }
        return options;
    }

    it('应识别标准 "A.选项内容" 格式', () => {
        const opts = parseOptions('A.选项A\nB.选项B');
        expect(opts.length).toBe(2);
        expect(opts[0]).toEqual({ key: 'A', text: '选项A' });
        expect(opts[1]).toEqual({ key: 'B', text: '选项B' });
    });

    it('应识别中文顿号 "B、选项" 格式', () => {
        const opts = parseOptions('A、一\nB、二');
        expect(opts.length).toBe(2);
        expect(opts[0]).toEqual({ key: 'A', text: '一' });
    });

    it('应识别全角点 "C．选项" 格式', () => {
        const opts = parseOptions('C．中文');
        expect(opts.length).toBe(1);
        expect(opts[0].key).toBe('C');
        expect(opts[0].text).toBe('中文');
    });

    it('应允许冒号后 0 或多个空白', () => {
        const opts = parseOptions('D.  有多个空格');
        expect(opts.length).toBe(1);
        expect(opts[0].text).toBe('有多个空格');
    });

    it('非 A-Z 字母不应匹配', () => {
        const opts = parseOptions('1.数字\nx.小写\nAa.多字母');
        expect(opts.length).toBe(0);
    });
});
