/**
 * 题库管理模块 - 核心业务逻辑
 * 负责题目的增删改查、导入导出、解析验证
 */

var QuestionBank = {
    STORAGE_KEY: 'jj_question_bank',

    /**
     * 默认题库（78道题）
     */
    DEFAULT_BANK: null,

    /**
     * 当前题库
     */
    bank: [],

    /**
     * 初始化题库
     * @param {Array} defaultBank - 默认题库数据
     */
    init: function(defaultBank) {
        QuestionBank.DEFAULT_BANK = defaultBank.slice();
        QuestionBank.load();
    },

    /**
     * 从localStorage加载题库
     */
    load: function() {
        var saved = localStorage.getItem(QuestionBank.STORAGE_KEY);
        if (saved) {
            try {
                QuestionBank.bank = JSON.parse(saved);
            } catch (e) {
                QuestionBank.bank = QuestionBank.DEFAULT_BANK.slice();
            }
        } else {
            QuestionBank.bank = QuestionBank.DEFAULT_BANK.slice();
        }
    },

    /**
     * 保存题库到localStorage
     */
    save: function() {
        localStorage.setItem(QuestionBank.STORAGE_KEY, JSON.stringify(QuestionBank.bank));
    },

    /**
     * 获取所有题目
     * @returns {Array} 题目数组
     */
    getAll: function() {
        return QuestionBank.bank;
    },

    /**
     * 根据ID查找题目
     * @param {string} id - 题目ID
     * @returns {Object|null} 题目对象
     */
    findById: function(id) {
        for (var i = 0; i < QuestionBank.bank.length; i++) {
            if (QuestionBank.bank[i].id === id) {
                return QuestionBank.bank[i];
            }
        }
        return null;
    },

    /**
     * 根据分类获取题目
     * @param {string} category - 分类名称
     * @returns {Array} 题目数组
     */
    findByCategory: function(category) {
        return QuestionBank.bank.filter(function(q) {
            return q.category === category;
        });
    },

    /**
     * 获取所有分类
     * @returns {Object} 分类统计 {categoryName: count}
     */
    getCategories: function() {
        var cats = {};
        for (var i = 0; i < QuestionBank.bank.length; i++) {
            var c = QuestionBank.bank[i].category;
            cats[c] = (cats[c] || 0) + 1;
        }
        return cats;
    },

    /**
     * 解析选项文本
     * 输入格式：A.选项内容\nB.选项内容\nC.选项内容\nD.选项内容
     * @param {string} optsText - 选项文本
     * @returns {Object} {success, options, error}
     */
    parseOptions: function(optsText) {
        var lines = optsText.split('\n');
        var options = [];

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;

            // 支持多种格式：A.、A、A．
            var match = line.match(/^([A-D])[.、．]\s*(.+)$/);
            if (match) {
                options.push({
                    key: match[1],
                    text: match[2]
                });
            }
        }

        if (options.length < 2) {
            return {
                success: false,
                options: [],
                error: '请至少输入两个选项，格式：A.选项内容'
            };
        }

        return {
            success: true,
            options: options,
            error: null
        };
    },

    /**
     * 验证题目数据完整性
     * @param {Object} q - 题目对象
     * @returns {Object} {valid, errors}
     */
    validate: function(q) {
        var errors = [];

        if (!q.question || q.question.trim() === '') {
            errors.push('题目内容不能为空');
        }

        if (!q.options || q.options.length < 2) {
            errors.push('至少需要两个选项');
        }

        if (!q.answer || !['A', 'B', 'C', 'D'].includes(q.answer)) {
            errors.push('答案必须是A、B、C或D');
        }

        // 检查答案是否在选项中
        if (q.options && q.answer) {
            var hasAnswer = false;
            for (var i = 0; i < q.options.length; i++) {
                if (q.options[i].key === q.answer) {
                    hasAnswer = true;
                    break;
                }
            }
            if (!hasAnswer) {
                errors.push('答案必须在提供的选项中');
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    },

    /**
     * 添加新题目
     * @param {Object} q - 题目对象
     * @returns {Object} {success, id, error}
     */
    add: function(q) {
        var validation = QuestionBank.validate(q);
        if (!validation.valid) {
            return {
                success: false,
                id: null,
                error: validation.errors.join('; ')
            };
        }

        var newId = 'q' + Date.now();
        var newQuestion = {
            id: newId,
            category: q.category || '其他',
            question: q.question.trim(),
            options: q.options,
            answer: q.answer,
            explanation: (q.explanation || '').trim()
        };

        QuestionBank.bank.push(newQuestion);
        QuestionBank.save();

        return {
            success: true,
            id: newId,
            error: null
        };
    },

    /**
     * 更新题目
     * @param {string} id - 题目ID
     * @param {Object} q - 新的题目数据
     * @returns {Object} {success, error}
     */
    update: function(id, q) {
        var validation = QuestionBank.validate(q);
        if (!validation.valid) {
            return {
                success: false,
                error: validation.errors.join('; ')
            };
        }

        var found = false;
        for (var i = 0; i < QuestionBank.bank.length; i++) {
            if (QuestionBank.bank[i].id === id) {
                QuestionBank.bank[i].category = q.category || '其他';
                QuestionBank.bank[i].question = q.question.trim();
                QuestionBank.bank[i].options = q.options;
                QuestionBank.bank[i].answer = q.answer;
                QuestionBank.bank[i].explanation = (q.explanation || '').trim();
                found = true;
                break;
            }
        }

        if (!found) {
            return {
                success: false,
                error: '未找到该题目'
            };
        }

        QuestionBank.save();
        return {
            success: true,
            error: null
        };
    },

    /**
     * 删除题目
     * @param {string} id - 题目ID
     * @returns {boolean} 是否成功删除
     */
    delete: function(id) {
        var originalLength = QuestionBank.bank.length;
        QuestionBank.bank = QuestionBank.bank.filter(function(q) {
            return q.id !== id;
        });

        if (QuestionBank.bank.length < originalLength) {
            QuestionBank.save();
            return true;
        }
        return false;
    },

    /**
     * 恢复默认题库
     */
    reset: function() {
        QuestionBank.bank = QuestionBank.DEFAULT_BANK.slice();
        localStorage.removeItem(QuestionBank.STORAGE_KEY);
    },

    /**
     * 导出题库数据
     * @param {Object} userData - 用户数据（可选）
     * @returns {Object} 导出数据对象
     */
    exportData: function(userData) {
        var data = {
            questionBank: QuestionBank.bank,
            userData: userData || null,
            exportTime: new Date().toISOString()
        };
        return data;
    },

    /**
     * 导入题库数据
     * @param {Object} data - 导入的数据对象
     * @returns {Object} {success, addedCount, updatedCount, error}
     */
    importData: function(data) {
        // 验证数据格式
        if (!data || typeof data !== 'object') {
            return {
                success: false,
                addedCount: 0,
                updatedCount: 0,
                error: '导入失败：无效的数据格式'
            };
        }

        if (!data.questionBank && !data.userData) {
            return {
                success: false,
                addedCount: 0,
                updatedCount: 0,
                error: '导入失败：文件中未找到有效数据（questionBank 或 userData）'
            };
        }

        var addedCount = 0;
        var updatedCount = 0;

        if (data.questionBank) {
            // 验证题库数组
            if (!Array.isArray(data.questionBank)) {
                return {
                    success: false,
                    addedCount: 0,
                    updatedCount: 0,
                    error: '导入失败：questionBank 必须是数组'
                };
            }

            var existingIds = {};
            for (var i = 0; i < QuestionBank.bank.length; i++) {
                existingIds[QuestionBank.bank[i].id] = true;
            }

            for (var j = 0; j < data.questionBank.length; j++) {
                var q = data.questionBank[j];

                // 验证每道题目
                var validation = QuestionBank.validate(q);
                if (!validation.valid) {
                    continue; // 跳过无效题目
                }

                if (existingIds[q.id]) {
                    // 更新已有题目
                    for (var k = 0; k < QuestionBank.bank.length; k++) {
                        if (QuestionBank.bank[k].id === q.id) {
                            QuestionBank.bank[k] = q;
                            updatedCount++;
                            break;
                        }
                    }
                } else {
                    // 添加新题目
                    QuestionBank.bank.push(q);
                    addedCount++;
                }
            }

            QuestionBank.save();
        }

        return {
            success: true,
            addedCount: addedCount,
            updatedCount: updatedCount,
            error: null,
            userData: data.userData
        };
    },

    /**
     * 搜索题目
     * @param {string} keyword - 搜索关键词
     * @param {string} category - 分类过滤（可选）
     * @returns {Array} 匹配的题目数组
     */
    search: function(keyword, category) {
        var results = [];
        var kw = keyword.toLowerCase();

        for (var i = 0; i < QuestionBank.bank.length; i++) {
            var q = QuestionBank.bank[i];

            // 分类过滤
            if (category && q.category !== category) {
                continue;
            }

            // 关键词搜索
            if (kw && q.question.toLowerCase().indexOf(kw) === -1) {
                continue;
            }

            results.push(q);
        }

        return results;
    },

    /**
     * 随机抽取题目
     * @param {number} count - 抽取数量
     * @param {string} category - 分类（可选）
     * @returns {Array} 随机题目数组
     */
    getRandom: function(count, category) {
        var pool = category ?
            QuestionBank.findByCategory(category) :
            QuestionBank.bank;

        return QuestionBank.shuffle(pool).slice(0, count);
    },

    /**
     * Fisher-Yates 洗牌算法
     * @param {Array} arr - 数组
     * @returns {Array} 洗牌后的数组
     */
    shuffle: function(arr) {
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = a[i];
            a[i] = a[j];
            a[j] = t;
        }
        return a;
    }
};

module.exports = QuestionBank;