/**
 * 数据导入功能测试
 * 测试JSON解析、数据验证、合并逻辑等关键路径
 */

const {
  parseImportData,
  mergeQuestionBank,
  mergeUserData,
  validateQuestion,
  generateExportData,
  validateResetInput
} = require('../src/dataParser');

describe('数据导入功能测试', () => {
  
  describe('parseImportData - JSON解析测试', () => {
    
    test('应该正确解析有效的JSON数据', () => {
      const validJson = JSON.stringify({
        questionBank: [
          {
            id: '001',
            category: '专辑',
            question: '测试题目',
            options: [
              { key: 'A', text: '选项A' },
              { key: 'B', text: '选项B' }
            ],
            answer: 'A',
            explanation: '测试解析'
          }
        ],
        userData: {
          history: [],
          wrong: [],
          stats: { total: 0, correct: 0, cats: {} }
        }
      });
      
      const result = parseImportData(validJson);
      expect(result.success).toBe(true);
      expect(result.data.questionBank).toHaveLength(1);
      expect(result.data.userData).toBeDefined();
      expect(result.error).toBeNull();
    });
    
    test('应该拒绝无效的JSON格式', () => {
      const invalidJson = '这不是有效的JSON';
      const result = parseImportData(invalidJson);
      expect(result.success).toBe(false);
      expect(result.error).toContain('文件格式不正确');
    });
    
    test('应该拒绝空内容', () => {
      const result = parseImportData('');
      expect(result.success).toBe(false);
      expect(result.error).toContain('文件内容为空');
    });
    
    test('应该拒绝null输入', () => {
      const result = parseImportData(null);
      expect(result.success).toBe(false);
      expect(result.error).toContain('文件内容为空');
    });
    
    test('应该拒绝缺少有效数据的JSON', () => {
      const jsonWithoutData = JSON.stringify({ otherField: 'value' });
      const result = parseImportData(jsonWithoutData);
      expect(result.success).toBe(false);
      expect(result.error).toContain('未找到有效数据');
    });
    
    test('应该拒绝题库不是数组的数据', () => {
      const invalidBank = JSON.stringify({
        questionBank: 'not an array'
      });
      const result = parseImportData(invalidBank);
      expect(result.success).toBe(false);
      expect(result.error).toContain('题库数据必须是数组格式');
    });
    
    test('应该拒绝用户数据不是对象的数据', () => {
      const invalidUserData = JSON.stringify({
        userData: 'not an object'
      });
      const result = parseImportData(invalidUserData);
      expect(result.success).toBe(false);
      expect(result.error).toContain('用户数据必须是对象格式');
    });
    
    test('应该只接受questionBank而忽略userData', () => {
      const onlyBank = JSON.stringify({
        questionBank: [
          {
            id: 'test',
            category: '测试',
            question: '问题',
            options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }],
            answer: 'A',
            explanation: ''
          }
        ]
      });
      const result = parseImportData(onlyBank);
      expect(result.success).toBe(true);
    });
    
    test('应该只接受userData而忽略questionBank', () => {
      const onlyUser = JSON.stringify({
        userData: { history: [], wrong: [], stats: {} }
      });
      const result = parseImportData(onlyUser);
      expect(result.success).toBe(true);
    });
  });
  
  describe('validateQuestion - 题目数据验证测试', () => {
    
    test('应该验证有效的题目结构', () => {
      const validQuestion = {
        id: '001',
        category: '专辑',
        question: '测试题目',
        options: [
          { key: 'A', text: '选项A' },
          { key: 'B', text: '选项B' },
          { key: 'C', text: '选项C' },
          { key: 'D', text: '选项D' }
        ],
        answer: 'A',
        explanation: '测试解析'
      };
      
      const result = validateQuestion(validQuestion);
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });
    
    test('应该拒绝缺少必需字段的题目', () => {
      const missingId = {
        category: '专辑',
        question: '测试题目',
        options: [{ key: 'A', text: '选项A' }],
        answer: 'A'
      };
      
      const result = validateQuestion(missingId);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('缺少必需字段');
    });
    
    test('应该拒绝选项少于2个的题目', () => {
      const singleOption = {
        id: '001',
        category: '专辑',
        question: '测试题目',
        options: [{ key: 'A', text: '选项A' }],
        answer: 'A',
        explanation: ''
      };
      
      const result = validateQuestion(singleOption);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('至少2个元素');
    });
    
    test('应该拒绝选项格式无效的题目', () => {
      const invalidOptionFormat = {
        id: '001',
        category: '专辑',
        question: '测试题目',
        options: [
          { text: '选项A' }, // 缺少key
          { key: 'B', text: '选项B' }
        ],
        answer: 'B',
        explanation: ''
      };
      
      const result = validateQuestion(invalidOptionFormat);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('选项格式无效');
    });
    
    test('应该拒绝无效的选项key', () => {
      const invalidKey = {
        id: '001',
        category: '专辑',
        question: '测试题目',
        options: [
          { key: 'E', text: '选项E' }, // E不是有效key
          { key: 'B', text: '选项B' }
        ],
        answer: 'B',
        explanation: ''
      };
      
      const result = validateQuestion(invalidKey);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('选项key必须是A、B、C或D');
    });
    
    test('应该拒绝无效的答案', () => {
      const invalidAnswer = {
        id: '001',
        category: '专辑',
        question: '测试题目',
        options: [
          { key: 'A', text: '选项A' },
          { key: 'B', text: '选项B' }
        ],
        answer: 'E', // E不是有效答案
        explanation: ''
      };
      
      const result = validateQuestion(invalidAnswer);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('答案必须是A、B、C或D');
    });
    
    test('应该拒绝答案不在选项中的题目', () => {
      const answerNotInOptions = {
        id: '001',
        category: '专辑',
        question: '测试题目',
        options: [
          { key: 'A', text: '选项A' },
          { key: 'B', text: '选项B' }
        ],
        answer: 'C', // C不在选项中
        explanation: ''
      };
      
      const result = validateQuestion(answerNotInOptions);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('答案必须在选项中存在');
    });
    
    test('应该拒绝null题目', () => {
      const result = validateQuestion(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('题目数据无效');
    });
    
    test('应该拒绝非对象类型的题目', () => {
      const result = validateQuestion('string');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('题目数据无效');
    });
  });
  
  describe('mergeQuestionBank - 题库合并测试', () => {
    
    test('应该正确合并新增题目', () => {
      const existing = [
        { id: '001', category: '专辑', question: '旧题目', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'A', explanation: '' }
      ];
      const newBank = [
        { id: '002', category: '歌曲', question: '新题目', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'A', explanation: '' }
      ];
      
      const result = mergeQuestionBank(existing, newBank);
      expect(result.bank).toHaveLength(2);
      expect(result.addedCount).toBe(1);
      expect(result.updatedCount).toBe(0);
    });
    
    test('应该正确更新已存在的题目', () => {
      const existing = [
        { id: '001', category: '专辑', question: '旧题目', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'A', explanation: '' }
      ];
      const newBank = [
        { id: '001', category: '专辑', question: '更新题目', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'B', explanation: '新解析' }
      ];
      
      const result = mergeQuestionBank(existing, newBank);
      expect(result.bank).toHaveLength(1);
      expect(result.bank[0].question).toBe('更新题目');
      expect(result.bank[0].answer).toBe('B');
      expect(result.addedCount).toBe(0);
      expect(result.updatedCount).toBe(1);
    });
    
    test('应该正确处理同时新增和更新', () => {
      const existing = [
        { id: '001', category: '专辑', question: '旧题目', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'A', explanation: '' }
      ];
      const newBank = [
        { id: '001', category: '专辑', question: '更新题目', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'B', explanation: '' },
        { id: '002', category: '歌曲', question: '新题目', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'A', explanation: '' }
      ];
      
      const result = mergeQuestionBank(existing, newBank);
      expect(result.bank).toHaveLength(2);
      expect(result.addedCount).toBe(1);
      expect(result.updatedCount).toBe(1);
    });
    
    test('应该正确处理空新题库', () => {
      const existing = [
        { id: '001', category: '专辑', question: '旧题目', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'A', explanation: '' }
      ];
      
      const result = mergeQuestionBank(existing, []);
      expect(result.bank).toHaveLength(1);
      expect(result.addedCount).toBe(0);
      expect(result.updatedCount).toBe(0);
    });
    
    test('应该正确处理空现有题库', () => {
      const newBank = [
        { id: '001', category: '专辑', question: '新题目', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'A', explanation: '' }
      ];
      
      const result = mergeQuestionBank([], newBank);
      expect(result.bank).toHaveLength(1);
      expect(result.addedCount).toBe(1);
      expect(result.updatedCount).toBe(0);
    });
    
    test('应该正确处理多个重复ID的更新', () => {
      const existing = [
        { id: '001', category: '专辑', question: '旧1', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'A', explanation: '' },
        { id: '002', category: '专辑', question: '旧2', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'A', explanation: '' }
      ];
      const newBank = [
        { id: '001', category: '专辑', question: '更新1', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'B', explanation: '' },
        { id: '002', category: '专辑', question: '更新2', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'B', explanation: '' }
      ];
      
      const result = mergeQuestionBank(existing, newBank);
      expect(result.bank).toHaveLength(2);
      expect(result.updatedCount).toBe(2);
    });
  });
  
  describe('mergeUserData - 用户数据合并测试', () => {
    
    test('应该正确合并历史记录', () => {
      const existing = {
        history: [{ qid: '001', ans: 'A', ok: true, time: 1000 }],
        wrong: [],
        stats: { total: 1, correct: 1, cats: {} }
      };
      const newData = {
        history: [{ qid: '002', ans: 'B', ok: false, time: 2000 }],
        stats: { total: 1, correct: 0, cats: {} }
      };
      
      const result = mergeUserData(existing, newData);
      expect(result.history).toHaveLength(2);
      expect(result.stats.total).toBe(2);
      expect(result.stats.correct).toBe(1);
    });
    
    test('应该正确合并错题记录（新增）', () => {
      const existing = {
        history: [],
        wrong: [{ qid: '001', cnt: 2, time: 1000 }],
        stats: { total: 0, correct: 0, cats: {} }
      };
      const newData = {
        wrong: [{ qid: '002', cnt: 1, time: 2000 }],
        stats: { total: 0, correct: 0, cats: {} }
      };
      
      const result = mergeUserData(existing, newData);
      expect(result.wrong).toHaveLength(2);
    });
    
    test('应该正确合并错题记录（累计次数）', () => {
      const existing = {
        history: [],
        wrong: [{ qid: '001', cnt: 2, time: 1000 }],
        stats: { total: 0, correct: 0, cats: {} }
      };
      const newData = {
        wrong: [{ qid: '001', cnt: 3, time: 2000 }],
        stats: { total: 0, correct: 0, cats: {} }
      };
      
      const result = mergeUserData(existing, newData);
      expect(result.wrong).toHaveLength(1);
      expect(result.wrong[0].cnt).toBe(5); // 2 + 3
    });
    
    test('应该正确合并分类统计', () => {
      const existing = {
        history: [],
        wrong: [],
        stats: {
          total: 10,
          correct: 8,
          cats: {
            '专辑': { t: 5, c: 4 },
            '歌曲': { t: 3, c: 3 }
          }
        }
      };
      const newData = {
        stats: {
          total: 5,
          correct: 3,
          cats: {
            '专辑': { t: 2, c: 1 },
            '获奖记录': { t: 3, c: 2 }
          }
        }
      };
      
      const result = mergeUserData(existing, newData);
      expect(result.stats.total).toBe(15);
      expect(result.stats.correct).toBe(11);
      expect(result.stats.cats['专辑'].t).toBe(7);
      expect(result.stats.cats['专辑'].c).toBe(5);
      expect(result.stats.cats['获奖记录'].t).toBe(3);
    });
    
    test('应该正确处理缺少stats的用户数据', () => {
      const existing = {
        history: [],
        wrong: [],
        stats: { total: 0, correct: 0, cats: {} }
      };
      const newData = {
        history: [{ qid: '001', ans: 'A', ok: true, time: 1000 }]
      };
      
      const result = mergeUserData(existing, newData);
      expect(result.history).toHaveLength(1);
    });
  });
  
  describe('generateExportData - 导出数据生成测试', () => {
    
    test('应该生成包含所有必需字段的导出数据', () => {
      const questionBank = [
        { id: '001', category: '专辑', question: '题目', options: [{ key: 'A', text: 'A' }], answer: 'A', explanation: '' }
      ];
      const userData = {
        history: [],
        wrong: [],
        stats: { total: 0, correct: 0, cats: {} }
      };
      
      const result = generateExportData(questionBank, userData);
      expect(result.questionBank).toBeDefined();
      expect(result.userData).toBeDefined();
      expect(result.exportTime).toBeDefined();
    });
    
    test('应该生成有效的ISO时间戳', () => {
      const result = generateExportData([], {});
      const timestamp = new Date(result.exportTime);
      expect(timestamp).toBeInstanceOf(Date);
    });
  });
  
  describe('validateResetInput - 重置确认验证测试', () => {
    
    test('应该接受正确的确认文本', () => {
      expect(validateResetInput('恢复默认')).toBe(true);
    });
    
    test('应该拒绝错误的确认文本', () => {
      expect(validateResetInput('恢复')).toBe(false);
      expect(validateResetInput('默认')).toBe(false);
      expect(validateResetInput('reset')).toBe(false);
      expect(validateResetInput('恢复默认题库')).toBe(false);
    });
    
    test('应该拒绝空输入', () => {
      expect(validateResetInput('')).toBe(false);
    });
    
    test('应该拒绝带空格的输入', () => {
      expect(validateResetInput('恢复默认 ')).toBe(false);
      expect(validateResetInput(' 恢复默认')).toBe(false);
      expect(validateResetInput('恢复 默认')).toBe(false);
    });
  });
  
  describe('边界条件和极端情况测试', () => {
    
    test('应该处理超大JSON数据', () => {
      // 生成大量题目
      const largeBank = [];
      for (let i = 0; i < 1000; i++) {
        largeBank.push({
          id: `q${i}`,
          category: '测试',
          question: `题目${i}`,
          options: [
            { key: 'A', text: 'A' },
            { key: 'B', text: 'B' }
          ],
          answer: 'A',
          explanation: ''
        });
      }
      
      const json = JSON.stringify({ questionBank: largeBank });
      const result = parseImportData(json);
      expect(result.success).toBe(true);
      expect(result.data.questionBank).toHaveLength(1000);
    });
    
    test('应该处理特殊字符在题目中', () => {
      const specialChars = {
        id: '001',
        category: '专辑',
        question: '题目包含特殊字符：<>&"\'\\n\\t',
        options: [
          { key: 'A', text: '选项<A>' },
          { key: 'B', text: '选项&B' }
        ],
        answer: 'A',
        explanation: '解析包含特殊字符'
      };
      
      const result = validateQuestion(specialChars);
      expect(result.valid).toBe(true);
    });
    
    test('应该处理Unicode字符', () => {
      const unicode = {
        id: '001',
        category: '专辑',
        question: '林俊杰的应援色是💜紫色',
        options: [
          { key: 'A', text: '蓝色💙' },
          { key: 'B', text: '紫色💜' }
        ],
        answer: 'B',
        explanation: '林俊杰的应援色为紫色💜'
      };
      
      const result = validateQuestion(unicode);
      expect(result.valid).toBe(true);
    });
    
    test('应该处理嵌套JSON结构', () => {
      const nested = JSON.stringify({
        questionBank: [{
          id: '001',
          category: '专辑',
          question: '题目',
          options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }],
          answer: 'A',
          explanation: ''
        }],
        userData: {
          history: [{
            qid: '001',
            ans: 'A',
            ok: true,
            time: 1234567890,
            nested: { deep: { value: 'test' } }
          }],
          wrong: [],
          stats: {}
        }
      });
      
      const result = parseImportData(nested);
      expect(result.success).toBe(true);
    });
    
    test('应该处理空字符串题目', () => {
      const emptyQuestion = {
        id: '001',
        category: '专辑',
        question: '',
        options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }],
        answer: 'A',
        explanation: ''
      };
      
      const result = validateQuestion(emptyQuestion);
      expect(result.valid).toBe(false);
    });
    
    test('应该处理空字符串选项', () => {
      const emptyOption = {
        id: '001',
        category: '专辑',
        question: '题目',
        options: [{ key: 'A', text: '' }, { key: 'B', text: 'B' }],
        answer: 'B',
        explanation: ''
      };
      
      const result = validateQuestion(emptyOption);
      // 空字符串text会被!opt.text判断为false，导致验证失败
      expect(result.valid).toBe(false);
      expect(result.error).toContain('选项格式无效');
    });
  });
});