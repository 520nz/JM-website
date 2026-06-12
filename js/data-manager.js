/**
 * 数据导入导出模块
 * 核心功能：JSON导出、导入验证、数据合并
 */

const DataManager = {
    /**
     * 导出数据为JSON
     * @param {Array} questionBank - 题库数组
     * @param {Object} userData - 用户数据
     * @returns {Object} 导出数据对象
     */
    exportData: function(questionBank, userData) {
        return {
            questionBank: questionBank,
            userData: userData,
            exportTime: new Date().toISOString()
        };
    },

    /**
     * 下载JSON文件
     * @param {Object} data - 要导出的数据
     * @param {string} filename - 文件名（可选）
     */
    downloadJSON: function(data, filename) {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const defaultFilename = 'jj_quiz_backup_' + new Date().toISOString().slice(0, 10) + '.json';
        const finalFilename = filename || defaultFilename;

        // 在浏览器环境中创建下载链接
        if (typeof document !== 'undefined') {
            const a = document.createElement('a');
            a.href = url;
            a.download = finalFilename;
            a.click();
            URL.revokeObjectURL(url);
        }

        return { json: json, filename: finalFilename };
    },

    /**
     * 验证导入数据格式
     * @param {Object} data - 要验证的数据
     * @returns {Object} 验证结果 {valid, errors}
     */
    validateImportData: function(data) {
        const errors = [];

        if (typeof data !== 'object' || data === null) {
            return { valid: false, errors: ['数据格式无效：必须为对象'] };
        }

        // 检查是否有有效数据
        if (!data.questionBank && !data.userData) {
            errors.push('文件中未找到有效数据（questionBank 或 userData）');
        }

        // 验证题库格式
        if (data.questionBank) {
            if (!Array.isArray(data.questionBank)) {
                errors.push('questionBank 必须是数组');
            } else {
                for (let i = 0; i < data.questionBank.length; i++) {
                    const q = data.questionBank[i];
                    const qErrors = DataManager.validateQuestion(q, i);
                    errors.push(...qErrors);
                }
            }
        }

        // 验证用户数据格式
        if (data.userData) {
            const udErrors = DataManager.validateUserData(data.userData);
            errors.push(...udErrors);
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    },

    /**
     * 验证单个题目格式
     * @param {Object} q - 题目对象
     * @param {number} index - 题目索引
     * @returns {Array} 错误信息数组
     */
    validateQuestion: function(q, index) {
        const errors = [];
        const prefix = '题目[' + index + ']';

        if (!q.id) {
            errors.push(prefix + ' 缺少id字段');
        }

        if (!q.category) {
            errors.push(prefix + ' 缺少category字段');
        }

        if (!q.question) {
            errors.push(prefix + ' 缺少question字段');
        }

        if (!Array.isArray(q.options) || q.options.length < 2) {
            errors.push(prefix + ' options必须为至少包含2个选项的数组');
        } else {
            for (let i = 0; i < q.options.length; i++) {
                const opt = q.options[i];
                if (!opt.key || !opt.text) {
                    errors.push(prefix + ' 选项[' + i + ']缺少key或text字段');
                }
            }
        }

        if (!q.answer) {
            errors.push(prefix + ' 缺少answer字段');
        }

        return errors;
    },

    /**
     * 验证用户数据格式
     * @param {Object} userData - 用户数据对象
     * @returns {Array} 错误信息数组
     */
    validateUserData: function(userData) {
        const errors = [];

        if (userData.history && !Array.isArray(userData.history)) {
            errors.push('userData.history 必须是数组');
        }

        if (userData.wrong && !Array.isArray(userData.wrong)) {
            errors.push('userData.wrong 必须是数组');
        }

        if (userData.stats && typeof userData.stats !== 'object') {
            errors.push('userData.stats 必须是对象');
        }

        return errors;
    },

    /**
     * 解析JSON字符串
     * @param {string} jsonString - JSON字符串
     * @returns {Object} 解析结果 {success, data, error}
     */
    parseJSON: function(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            return { success: true, data: data, error: null };
        } catch (e) {
            return {
                success: false,
                data: null,
                error: '文件格式不正确，请确保上传有效的JSON文件'
            };
        }
    },

    /**
     * 合并题库数据
     * @param {Array} existingBank - 现有题库
     * @param {Array} newBank - 新题库
     * @returns {Object} 合并结果 {questionBank, addedCount, updatedCount}
     */
    mergeQuestionBanks: function(existingBank, newBank) {
        const existingIds = {};
        for (let i = 0; i < existingBank.length; i++) {
            existingIds[existingBank[i].id] = true;
        }

        let addedCount = 0;
        let updatedCount = 0;

        for (let j = 0; j < newBank.length; j++) {
            const q = newBank[j];
            if (existingIds[q.id]) {
                // 更新现有题目
                for (let k = 0; k < existingBank.length; k++) {
                    if (existingBank[k].id === q.id) {
                        existingBank[k] = q;
                        updatedCount++;
                        break;
                    }
                }
            } else {
                // 添加新题目
                existingBank.push(q);
                addedCount++;
            }
        }

        return {
            questionBank: existingBank,
            addedCount: addedCount,
            updatedCount: updatedCount
        };
    },

    /**
     * 合并用户数据
     * @param {Object} existingData - 现有用户数据
     * @param {Object} newData - 新用户数据
     * @returns {Object} 合并后的用户数据
     */
    mergeUserData: function(existingData, newData) {
        // 合并历史记录
        if (newData.history) {
            existingData.history = existingData.history.concat(newData.history);
        }

        // 合并错题本
        if (newData.wrong) {
            const wrongMap = {};
            for (let w = 0; w < existingData.wrong.length; w++) {
                wrongMap[existingData.wrong[w].qid] = existingData.wrong[w];
            }

            for (let x = 0; x < newData.wrong.length; x++) {
                const wrongItem = newData.wrong[x];
                if (wrongMap[wrongItem.qid]) {
                    wrongMap[wrongItem.qid].cnt += wrongItem.cnt;
                } else {
                    existingData.wrong.push(wrongItem);
                }
            }
        }

        // 合并统计数据
        if (newData.stats) {
            if (!existingData.stats) {
                existingData.stats = { total: 0, correct: 0, cats: {} };
            }
            existingData.stats.total += newData.stats.total || 0;
            existingData.stats.correct += newData.stats.correct || 0;

            if (newData.stats.cats) {
                for (const catName in newData.stats.cats) {
                    if (!existingData.stats.cats[catName]) {
                        existingData.stats.cats[catName] = { t: 0, c: 0 };
                    }
                    existingData.stats.cats[catName].t += newData.stats.cats[catName].t || 0;
                    existingData.stats.cats[catName].c += newData.stats.cats[catName].c || 0;
                }
            }
        }

        return existingData;
    },

    /**
     * 完整的导入流程
     * @param {string} jsonString - JSON字符串
     * @param {Array} existingQuestionBank - 现有题库
     * @param {Object} existingUserData - 现有用户数据
     * @returns {Object} 导入结果
     */
    importData: function(jsonString, existingQuestionBank, existingUserData) {
        // 1. 解析JSON
        const parseResult = DataManager.parseJSON(jsonString);
        if (!parseResult.success) {
            return {
                success: false,
                error: parseResult.error,
                questionBank: existingQuestionBank,
                userData: existingUserData
            };
        }

        const data = parseResult.data;

        // 2. 验证数据格式
        const validationResult = DataManager.validateImportData(data);
        if (!validationResult.valid) {
            return {
                success: false,
                error: validationResult.errors.join('; '),
                questionBank: existingQuestionBank,
                userData: existingUserData
            };
        }

        // 3. 合并数据
        let questionBank = existingQuestionBank;
        let userData = existingUserData;
        let addedCount = 0;
        let updatedCount = 0;

        if (data.questionBank) {
            const mergeResult = DataManager.mergeQuestionBanks(
                existingQuestionBank.slice(),
                data.questionBank
            );
            questionBank = mergeResult.questionBank;
            addedCount = mergeResult.addedCount;
            updatedCount = mergeResult.updatedCount;
        }

        if (data.userData) {
            userData = DataManager.mergeUserData(
                JSON.parse(JSON.stringify(existingUserData)),
                data.userData
            );
        }

        return {
            success: true,
            error: null,
            questionBank: questionBank,
            userData: userData,
            addedCount: addedCount,
            updatedCount: updatedCount
        };
    },

    /**
     * 解析选项文本
     * @param {string} optsText - 选项文本（每行一个，格式：A.选项内容）
     * @returns {Object} 解析结果 {options, errors}
     */
    parseOptions: function(optsText) {
        const lines = optsText.split('\n');
        const options = [];
        const errors = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const match = line.match(/^([A-D])[.、．]\s*(.+)$/);
            if (match) {
                options.push({ key: match[1], text: match[2] });
            } else {
                errors.push('第' + (i + 1) + '行格式不正确: ' + line);
            }
        }

        return { options: options, errors: errors };
    },

    /**
     * 创建新题目
     * @param {Object} params - 题目参数
     * @returns {Object} 新题目对象
     */
    createQuestion: function(params) {
        return {
            id: params.id || 'q' + Date.now(),
            category: params.category,
            question: params.question,
            options: params.options,
            answer: params.answer,
            explanation: params.explanation || ''
        };
    },

    /**
     * 更新题目
     * @param {Array} questionBank - 题库数组
     * @param {string} qid - 题目ID
     * @param {Object} updates - 更新内容
     * @returns {boolean} 是否更新成功
     */
    updateQuestion: function(questionBank, qid, updates) {
        for (let i = 0; i < questionBank.length; i++) {
            if (questionBank[i].id === qid) {
                Object.assign(questionBank[i], updates);
                return true;
            }
        }
        return false;
    },

    /**
     * 删除题目
     * @param {Array} questionBank - 题库数组
     * @param {string} qid - 题目ID
     * @returns {Array} 过滤后的题库
     */
    deleteQuestion: function(questionBank, qid) {
        return questionBank.filter(function(q) {
            return q.id !== qid;
        });
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataManager;
}
