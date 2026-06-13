// 林俊杰粉丝答题 - 核心逻辑单元测试
// 使用 Node.js 运行: node tests/core.test.js

// ===== 测试框架 =====
let passed = 0;
let failed = 0;
let total = 0;

function describe(name, fn) {
    console.log(`\n📦 ${name}`);
    fn();
}

function it(name, fn) {
    total++;
    try {
        fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (e) {
        failed++;
        console.log(`  ❌ ${name}`);
        console.log(`     错误: ${e.message}`);
    }
}

function expect(actual) {
    return {
        toBe(expected) {
            if (actual !== expected) {
                throw new Error(`期望 ${JSON.stringify(expected)} 但得到 ${JSON.stringify(actual)}`);
            }
        },
        toEqual(expected) {
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                throw new Error(`期望 ${JSON.stringify(expected)} 但得到 ${JSON.stringify(actual)}`);
            }
        },
        toBeTruthy() {
            if (!actual) {
                throw new Error(`期望真值但得到 ${JSON.stringify(actual)}`);
            }
        },
        toBeFalsy() {
            if (actual) {
                throw new Error(`期望假值但得到 ${JSON.stringify(actual)}`);
            }
        },
        toContain(expected) {
            if (!actual.includes(expected)) {
                throw new Error(`期望 ${JSON.stringify(actual)} 包含 ${JSON.stringify(expected)}`);
            }
        },
        toBeGreaterThan(expected) {
            if (actual <= expected) {
                throw new Error(`期望 ${actual} 大于 ${expected}`);
            }
        },
        toBeNull() {
            if (actual !== null) {
                throw new Error(`期望 null 但得到 ${JSON.stringify(actual)}`);
            }
        }
    };
}

// ===== 核心逻辑（从 index.html 提取） =====

// 工具函数
function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = a[i];
        a[i] = a[j];
        a[j] = t;
    }
    return a;
}

// 选项解析函数（关键逻辑）
function parseOptions(optsText) {
    const lines = optsText.split('\n');
    const options = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const match = line.match(/^([A-D])[.、．]\s*(.+)$/);
        if (match) {
            options.push({ key: match[1], text: match[2] });
        }
    }
    return options;
}

// 数据导入验证函数
function validateImportData(data) {
    if (typeof data !== 'object' || data === null) {
        return { valid: false, error: '数据必须是一个对象' };
    }
    if (!data.questionBank && !data.userData) {
        return { valid: false, error: '文件中未找到有效数据（questionBank 或 userData）' };
    }
    if (data.questionBank) {
        if (!Array.isArray(data.questionBank)) {
            return { valid: false, error: 'questionBank 必须是数组' };
        }
        for (let i = 0; i < data.questionBank.length; i++) {
            const q = data.questionBank[i];
            if (!q.id || !q.question || !q.answer) {
                return { valid: false, error: '题目缺少必要字段（id, question, answer）' };
            }
        }
    }
    return { valid: true };
}

// 创建独立的 DB 实例
function createDB(questionBank) {
    let mockStorage = {};
    const localStorage = {
        getItem(key) { return mockStorage[key] || null; },
        setItem(key, value) { mockStorage[key] = value; },
        removeItem(key) { delete mockStorage[key]; }
    };

    return {
        KEY: 'jj_quiz_v2',
        get() {
            const d = localStorage.getItem(this.KEY);
            return d ? JSON.parse(d) : this.defaults();
        },
        defaults() {
            return { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } };
        },
        save(d) {
            localStorage.setItem(this.KEY, JSON.stringify(d));
        },
        addRecord(rec) {
            const d = this.get();
            d.history.push(rec);
            d.stats.total++;
            if (rec.ok) d.stats.correct++;
            const q = this.findQ(rec.qid);
            if (q) {
                if (!d.stats.cats[q.category]) d.stats.cats[q.category] = { t: 0, c: 0 };
                d.stats.cats[q.category].t++;
                if (rec.ok) d.stats.cats[q.category].c++;
            }
            this.save(d);
        },
        addWrong(qid) {
            const d = this.get();
            let f = null;
            for (let i = 0; i < d.wrong.length; i++) {
                if (d.wrong[i].qid === qid) { f = d.wrong[i]; break; }
            }
            if (f) {
                f.cnt++;
                f.time = Date.now();
            } else {
                d.wrong.push({ qid: qid, cnt: 1, time: Date.now() });
            }
            this.save(d);
        },
        removeWrong(qid) {
            const d = this.get();
            d.wrong = d.wrong.filter(w => w.qid !== qid);
            this.save(d);
        },
        getWrong() {
            return this.get().wrong;
        },
        findQ(qid) {
            for (let i = 0; i < questionBank.length; i++) {
                if (questionBank[i].id === qid) return questionBank[i];
            }
            return null;
        }
    };
}

// 数据合并函数
function mergeQuestionBank(existingBank, importedQuestions) {
    const existingIds = {};
    for (let i = 0; i < existingBank.length; i++) {
        existingIds[existingBank[i].id] = true;
    }
    let addedCount = 0;
    let updatedCount = 0;
    for (let j = 0; j < importedQuestions.length; j++) {
        const q = importedQuestions[j];
        if (existingIds[q.id]) {
            for (let k = 0; k < existingBank.length; k++) {
                if (existingBank[k].id === q.id) {
                    existingBank[k] = q;
                    updatedCount++;
                    break;
                }
            }
        } else {
            existingBank.push(q);
            addedCount++;
        }
    }
    return { added: addedCount, updated: updatedCount };
}

// ===== 测试用例 =====

describe('选项解析逻辑', () => {
    it('正确解析标准格式的选项', () => {
        const opts = parseOptions('A.选项一\nB.选项二\nC.选项三\nD.选项四');
        expect(opts.length).toBe(4);
        expect(opts[0].key).toBe('A');
        expect(opts[0].text).toBe('选项一');
    });

    it('支持中文顿号分隔符', () => {
        const opts = parseOptions('A、选项一\nB、选项二');
        expect(opts.length).toBe(2);
        expect(opts[0].key).toBe('A');
    });

    it('支持全角点号分隔符', () => {
        const opts = parseOptions('A．选项一\nB．选项二');
        expect(opts.length).toBe(2);
    });

    it('忽略空行', () => {
        const opts = parseOptions('A.选项一\n\n\nB.选项二');
        expect(opts.length).toBe(2);
    });

    it('忽略无效格式的行', () => {
        const opts = parseOptions('A.选项一\n无效行\nB.选项二');
        expect(opts.length).toBe(2);
    });

    it('处理只有空格的情况', () => {
        const opts = parseOptions('   ');
        expect(opts.length).toBe(0);
    });

    it('处理带空格的选项文本', () => {
        const opts = parseOptions('A. 选项一  \nB.  选项二');
        expect(opts.length).toBe(2);
        expect(opts[0].text).toBe('选项一');
    });

    it('拒绝 E 选项（只允许 A-D）', () => {
        const opts = parseOptions('A.选项一\nE.选项五');
        expect(opts.length).toBe(1);
    });
});

describe('数据导入验证', () => {
    it('接受有效的完整数据', () => {
        const result = validateImportData({
            questionBank: [{ id: 'test', question: '测试', answer: 'A' }],
            userData: { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } }
        });
        expect(result.valid).toBe(true);
    });

    it('接受只有 questionBank 的数据', () => {
        const result = validateImportData({
            questionBank: [{ id: 'test', question: '测试', answer: 'A' }]
        });
        expect(result.valid).toBe(true);
    });

    it('接受只有 userData 的数据', () => {
        const result = validateImportData({
            userData: { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } }
        });
        expect(result.valid).toBe(true);
    });

    it('拒绝空对象', () => {
        const result = validateImportData({});
        expect(result.valid).toBe(false);
        expect(result.error).toContain('未找到有效数据');
    });

    it('拒绝 null', () => {
        const result = validateImportData(null);
        expect(result.valid).toBe(false);
    });

    it('拒绝非对象类型', () => {
        const result = validateImportData('字符串');
        expect(result.valid).toBe(false);
    });

    it('拒绝 questionBank 不是数组的情况', () => {
        const result = validateImportData({
            questionBank: '不是数组'
        });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('必须是数组');
    });

    it('拒绝缺少必要字段的题目', () => {
        const result = validateImportData({
            questionBank: [{ id: 'test' }] // 缺少 question 和 answer
        });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('缺少必要字段');
    });
});

describe('题库合并逻辑', () => {
    it('新增不存在的题目', () => {
        const bank = [
            { id: '001', category: '专辑', question: '原题目', options: [], answer: 'A' }
        ];
        const result = mergeQuestionBank(bank, [
            { id: '002', category: '歌曲', question: '新题目', options: [], answer: 'B' }
        ]);
        expect(result.added).toBe(1);
        expect(result.updated).toBe(0);
        expect(bank.length).toBe(2);
    });

    it('更新已存在的题目', () => {
        const bank = [
            { id: '001', category: '专辑', question: '原题目', options: [], answer: 'A' }
        ];
        const result = mergeQuestionBank(bank, [
            { id: '001', category: '专辑', question: '更新后的题目', options: [], answer: 'B' }
        ]);
        expect(result.added).toBe(0);
        expect(result.updated).toBe(1);
        expect(bank[0].question).toBe('更新后的题目');
    });

    it('同时处理新增和更新', () => {
        const bank = [
            { id: '001', category: '专辑', question: '原题目', options: [], answer: 'A' }
        ];
        const result = mergeQuestionBank(bank, [
            { id: '001', category: '专辑', question: '更新题目', options: [], answer: 'B' },
            { id: '002', category: '歌曲', question: '新题目', options: [], answer: 'A' }
        ]);
        expect(result.added).toBe(1);
        expect(result.updated).toBe(1);
        expect(bank.length).toBe(2);
    });
});

describe('DB 数据存储模块', () => {
    it('返回默认数据结构', () => {
        const questionBank = [
            { id: '001', category: '专辑', question: '测试题目', options: [], answer: 'A' }
        ];
        const db = createDB(questionBank);
        const data = db.get();
        expect(JSON.stringify(data.history)).toBe('[]');
        expect(JSON.stringify(data.wrong)).toBe('[]');
        expect(data.stats.total).toBe(0);
    });

    it('正确添加答题记录', () => {
        const questionBank = [
            { id: '001', category: '专辑', question: '测试题目', options: [], answer: 'A' }
        ];
        const db = createDB(questionBank);
        db.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
        const data = db.get();
        expect(data.history.length).toBe(1);
        expect(data.stats.total).toBe(1);
        expect(data.stats.correct).toBe(1);
    });

    it('正确统计分类数据', () => {
        const questionBank = [
            { id: '001', category: '专辑', question: '测试题目', options: [], answer: 'A' }
        ];
        const db = createDB(questionBank);
        db.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
        const data = db.get();
        expect(data.stats.cats['专辑'].t).toBe(1);
        expect(data.stats.cats['专辑'].c).toBe(1);
    });

    it('正确添加错题', () => {
        const questionBank = [
            { id: '001', category: '专辑', question: '测试题目', options: [], answer: 'A' }
        ];
        const db = createDB(questionBank);
        db.addWrong('001');
        const wrong = db.getWrong();
        expect(wrong.length).toBe(1);
        expect(wrong[0].qid).toBe('001');
        expect(wrong[0].cnt).toBe(1);
    });

    it('重复添加错题时增加计数', () => {
        const questionBank = [
            { id: '001', category: '专辑', question: '测试题目', options: [], answer: 'A' }
        ];
        const db = createDB(questionBank);
        db.addWrong('001');
        db.addWrong('001');
        const wrong = db.getWrong();
        expect(wrong.length).toBe(1);
        expect(wrong[0].cnt).toBe(2);
    });

    it('正确移除错题', () => {
        const questionBank = [
            { id: '001', category: '专辑', question: '测试题目', options: [], answer: 'A' }
        ];
        const db = createDB(questionBank);
        db.addWrong('001');
        db.removeWrong('001');
        const wrong = db.getWrong();
        expect(wrong.length).toBe(0);
    });

    it('findQ 返回正确的题目', () => {
        const questionBank = [
            { id: '001', category: '专辑', question: '测试题目', options: [], answer: 'A' }
        ];
        const db = createDB(questionBank);
        const q = db.findQ('001');
        expect(q).toBeTruthy();
        expect(q.question).toBe('测试题目');
    });

    it('findQ 对不存在的题目返回 null', () => {
        const questionBank = [
            { id: '001', category: '专辑', question: '测试题目', options: [], answer: 'A' }
        ];
        const db = createDB(questionBank);
        const q = db.findQ('999');
        expect(q).toBeNull();
    });
});

describe('shuffle 随机化函数', () => {
    it('返回新数组，不修改原数组', () => {
        const arr = [1, 2, 3, 4, 5];
        const shuffled = shuffle(arr);
        expect(arr.length).toBe(5);
        expect(shuffled.length).toBe(5);
        expect(arr === shuffled).toBe(false);
    });

    it('保持所有元素存在', () => {
        const arr = [1, 2, 3, 4, 5];
        const shuffled = shuffle(arr);
        const sum1 = arr.reduce((a, b) => a + b, 0);
        const sum2 = shuffled.reduce((a, b) => a + b, 0);
        expect(sum1).toBe(sum2);
    });

    it('处理空数组', () => {
        const shuffled = shuffle([]);
        expect(shuffled.length).toBe(0);
    });

    it('处理单元素数组', () => {
        const shuffled = shuffle([1]);
        expect(shuffled.length).toBe(1);
        expect(shuffled[0]).toBe(1);
    });
});

describe('边界条件和异常处理', () => {
    it('处理超长选项文本', () => {
        const longText = 'A.' + '很长的选项'.repeat(1000);
        const opts = parseOptions(longText);
        expect(opts.length).toBe(1);
    });

    it('处理特殊字符', () => {
        const opts = parseOptions('A.<script>alert(1)</script>\nB.正常选项');
        expect(opts.length).toBe(2);
        expect(opts[0].text).toContain('<script>');
    });

    it('处理 Unicode 字符', () => {
        const opts = parseOptions('A.🎵 音乐\nB.🎤 唱歌');
        expect(opts.length).toBe(2);
    });

    it('处理只有选项键没有内容', () => {
        const opts = parseOptions('A.\nB.');
        expect(opts.length).toBe(0);
    });

    it('处理混合有效无效格式', () => {
        const opts = parseOptions('A.有效\n无效行\nB.有效\nC.有效');
        expect(opts.length).toBe(3);
    });
});

describe('统计计算逻辑', () => {
    it('正确计算正确率', () => {
        const questionBank = [
            { id: '001', category: '专辑', question: '题目1', options: [], answer: 'A' },
            { id: '002', category: '专辑', question: '题目2', options: [], answer: 'B' }
        ];
        const db = createDB(questionBank);
        db.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
        db.addRecord({ qid: '002', ans: 'A', ok: false, time: Date.now() });
        const data = db.get();
        const acc = Math.round(data.stats.correct / data.stats.total * 100);
        expect(acc).toBe(50);
    });

    it('空历史时正确率为 0', () => {
        const questionBank = [
            { id: '001', category: '专辑', question: '题目1', options: [], answer: 'A' }
        ];
        const db = createDB(questionBank);
        const data = db.get();
        const acc = data.stats.total > 0 ? Math.round(data.stats.correct / data.stats.total * 100) : 0;
        expect(acc).toBe(0);
    });

    it('正确统计多个分类', () => {
        const questionBank = [
            { id: '001', category: '专辑', question: '题目1', options: [], answer: 'A' },
            { id: '002', category: '专辑', question: '题目2', options: [], answer: 'B' },
            { id: '003', category: '歌曲', question: '题目3', options: [], answer: 'C' }
        ];
        const db = createDB(questionBank);
        db.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
        db.addRecord({ qid: '002', ans: 'B', ok: true, time: Date.now() });
        db.addRecord({ qid: '003', ans: 'C', ok: false, time: Date.now() });
        const data = db.get();
        expect(data.stats.cats['专辑'].t).toBe(2);
        expect(data.stats.cats['专辑'].c).toBe(2);
        expect(data.stats.cats['歌曲'].t).toBe(1);
        expect(data.stats.cats['歌曲'].c).toBe(0);
    });
});

// 输出结果
console.log('\n' + '='.repeat(50));
console.log(`📊 测试结果: ${passed}/${total} 通过`);
console.log('='.repeat(50));

if (failed > 0) {
    console.log(`\n❌ 有 ${failed} 个测试失败`);
    process.exit(1);
} else {
    console.log('\n✅ 所有测试通过！');
    process.exit(0);
}
