// 林俊杰答题应用核心逻辑测试

const quizCore = require('../src/quiz-core.js');

describe('答题应用核心逻辑测试', () => {
  beforeEach(() => {
    // 清理 localStorage 和重置状态
    localStorage.clear();
    // 使用初始化函数重新创建题库（深拷贝）
    quizCore.initializeQuestionBank();
  });

  describe('importData() 函数测试', () => {
    test('正常导入包含题库和用户数据的 JSON', () => {
      // 先重置题库确保干净状态
      quizCore.QUESTION_BANK = quizCore.DEFAULT_QUESTION_BANK.slice();
      
      const testData = {
        questionBank: [
          { id: 'test001', category: '测试', question: '测试题目', options: [{key:'A',text:'选项A'}, {key:'B',text:'选项B'}], answer: 'A', explanation: '测试解析' }
        ],
        userData: {
          history: [{qid: '001', ans: 'B', ok: true, time: 1000000}],
          wrong: [{qid: '002', cnt: 1, time: 1000000}],
          stats: { total: 10, correct: 8, cats: { '专辑': { t: 5, c: 4 } } }
        },
        exportTime: '2024-01-01T00:00:00.000Z'
      };

      const initialCount = quizCore.QUESTION_BANK.length;
      const result = quizCore.importData(JSON.stringify(testData));

      expect(result.addedCount).toBe(1);
      expect(result.updatedCount).toBe(0);
      expect(quizCore.QUESTION_BANK.length).toBe(initialCount + 1);
    });

    test('导入格式错误的 JSON 应抛出错误', () => {
      expect(() => {
        quizCore.importData('这不是有效的JSON');
      }).toThrow('文件格式不正确，请确保上传有效的JSON文件');
    });

    test('导入无效数据结构应抛出错误', () => {
      const testData = {
        someOtherField: '无意义数据'
      };

      expect(() => {
        quizCore.importData(JSON.stringify(testData));
      }).toThrow('文件中未找到有效数据（questionBank 或 userData）');
    });

    test('数据合并逻辑 - 更新已存在的题目', () => {
      quizCore.QUESTION_BANK = quizCore.DEFAULT_QUESTION_BANK.slice();
      
      // 先添加一个题目
      quizCore.QUESTION_BANK.push({
        id: 'merge001',
        category: '合并测试',
        question: '旧题目',
        options: [{key:'A',text:'旧选项'}],
        answer: 'A',
        explanation: '旧解析'
      });

      const testData = {
        questionBank: [
          { id: 'merge001', category: '新分类', question: '新题目', options: [{key:'A',text:'新选项'}], answer: 'B', explanation: '新解析' }
        ]
      };

      const result = quizCore.importData(JSON.stringify(testData));

      expect(result.updatedCount).toBe(1);
      expect(result.addedCount).toBe(0);

      const updatedQuestion = quizCore.DB.findQ('merge001');
      expect(updatedQuestion.question).toBe('新题目');
      expect(updatedQuestion.category).toBe('新分类');
    });

    test('数据合并逻辑 - 错题计数累加', () => {
      // 设置初始错题记录
      quizCore.DB.addWrong('001');
      quizCore.DB.addWrong('001');

      const testData = {
        userData: {
          wrong: [{qid: '001', cnt: 3, time: 1000000}]
        }
      };

      quizCore.importData(JSON.stringify(testData));

      const wrongList = quizCore.DB.getWrong();
      const wrongItem = wrongList.find(w => w.qid === '001');
      expect(wrongItem.cnt).toBe(5); // 2 + 3 = 5
    });
  });

  describe('exportData() 函数测试', () => {
    test('导出数据格式正确', () => {
      // 添加一些数据
      quizCore.DB.addRecord({qid: '001', ans: 'B', ok: true, time: Date.now()});
      quizCore.DB.addWrong('002');

      const exportedJson = quizCore.exportData();
      const exportedData = JSON.parse(exportedJson);

      expect(exportedData).toHaveProperty('questionBank');
      expect(exportedData).toHaveProperty('userData');
      expect(exportedData).toHaveProperty('exportTime');

      expect(exportedData.questionBank.length).toBeGreaterThan(0);
      expect(exportedData.userData.history.length).toBe(1);
      expect(exportedData.userData.wrong.length).toBe(1);
    });

    test('导出的数据可以被重新导入', () => {
      quizCore.QUESTION_BANK = quizCore.DEFAULT_QUESTION_BANK.slice();
      
      quizCore.DB.addRecord({qid: '001', ans: 'B', ok: true, time: Date.now()});
      
      const exportedJson = quizCore.exportData();
      
      // 清空数据并重置题库
      localStorage.clear();
      quizCore.QUESTION_BANK = [];
      
      // 导入之前导出的数据
      const result = quizCore.importData(exportedJson);
      
      // 应该添加了导出的所有题目（默认题库数量）
      expect(quizCore.QUESTION_BANK.length).toBeGreaterThan(0);
    });
  });

  describe('saveQuestion() 函数测试', () => {
    test('选项解析 - 正确格式的选项文本', () => {
      const optsText = 'A.第一选项\nB.第二选项\nC.第三选项\nD.第四选项';
      const options = quizCore.parseOptions(optsText);

      expect(options.length).toBe(4);
      expect(options[0]).toEqual({ key: 'A', text: '第一选项' });
      expect(options[3]).toEqual({ key: 'D', text: '第四选项' });
    });

    test('选项解析 - 支持多种分隔符（点号、逗号、中文逗号）', () => {
      const optsText1 = 'A,选项A\nB,选项B';
      const optsText2 = 'A．选项A\nB．选项B';

      const options1 = quizCore.parseOptions(optsText1);
      const options2 = quizCore.parseOptions(optsText2);

      expect(options1.length).toBe(2);
      expect(options2.length).toBe(2);
    });

    test('选项解析 - 少于2个选项应抛出错误', () => {
      const questionData = {
        id: null,
        category: '测试',
        question: '测试题目',
        optionsText: 'A.只有一个选项',
        answer: 'A',
        explanation: '测试'
      };

      expect(() => {
        quizCore.saveQuestion(questionData);
      }).toThrow('请至少输入两个选项，格式：A.选项内容');
    });

    test('选项解析 - 空行和无效格式应被忽略', () => {
      const optsText = 'A.有效选项\n\n无效行\nB.另一个有效选项\nC选项（缺少分隔符）';
      const options = quizCore.parseOptions(optsText);

      expect(options.length).toBe(2);
      expect(options[0].text).toBe('有效选项');
      expect(options[1].text).toBe('另一个有效选项');
    });

    test('新增题目 - 成功添加到题库', () => {
      quizCore.QUESTION_BANK = quizCore.DEFAULT_QUESTION_BANK.slice();
      const initialCount = quizCore.QUESTION_BANK.length;
      
      const questionData = {
        id: null,
        category: '新分类',
        question: '这是一个新题目',
        optionsText: 'A.选项1\nB.选项2\nC.选项3',
        answer: 'B',
        explanation: '这是新题目的解析'
      };

      const result = quizCore.saveQuestion(questionData);

      expect(result.action).toBe('added');
      expect(result.question.id).toMatch(/^q\d+$/);
      expect(result.question.category).toBe('新分类');
      expect(quizCore.QUESTION_BANK.length).toBe(initialCount + 1);
    });

    test('编辑题目 - 成功更新现有题目', () => {
      const existingId = '001';
      const questionData = {
        id: existingId,
        category: '更新分类',
        question: '题目已更新',
        optionsText: 'A.新选项1\nB.新选项2',
        answer: 'A',
        explanation: '解析已更新'
      };

      const result = quizCore.saveQuestion(questionData);

      expect(result.action).toBe('updated');
      expect(result.question.id).toBe(existingId);
      expect(result.question.question).toBe('题目已更新');

      // 验证题库中的题目已被更新
      const updatedQ = quizCore.DB.findQ(existingId);
      expect(updatedQ.question).toBe('题目已更新');
      expect(updatedQ.category).toBe('更新分类');
    });

    test('边界条件 - 空题目文本应抛出错误', () => {
      const questionData = {
        id: null,
        category: '测试',
        question: '',
        optionsText: 'A.选项',
        answer: 'A',
        explanation: ''
      };

      expect(() => {
        quizCore.saveQuestion(questionData);
      }).toThrow('请填写题目和选项');
    });

    test('边界条件 - 空选项文本应抛出错误', () => {
      const questionData = {
        id: null,
        category: '测试',
        question: '有题目',
        optionsText: '',
        answer: 'A',
        explanation: ''
      };

      expect(() => {
        quizCore.saveQuestion(questionData);
      }).toThrow('请填写题目和选项');
    });
  });

  describe('DB 模块测试', () => {
    test('addRecord() - 正确添加答题记录', () => {
      const record = {
        qid: '001',
        ans: 'B',
        ok: true,
        time: 1000000
      };

      quizCore.DB.addRecord(record);

      const data = quizCore.DB.get();
      expect(data.history.length).toBe(1);
      expect(data.history[0]).toEqual(record);
      expect(data.stats.total).toBe(1);
      expect(data.stats.correct).toBe(1);
    });

    test('addRecord() - 统计分类数据', () => {
      // 完全重置题库确保题目001是原始数据
      quizCore.QUESTION_BANK = quizCore.DEFAULT_QUESTION_BANK.slice();
      
      const record = {
        qid: '001', // 专辑类题目
        ans: 'B',
        ok: true,
        time: 1000000
      };

      quizCore.DB.addRecord(record);

      const data = quizCore.DB.get();
      expect(data.stats.cats['专辑']).toBeDefined();
      expect(data.stats.cats['专辑'].t).toBe(1);
      expect(data.stats.cats['专辑'].c).toBe(1);
    });

    test('addWrong() - 首次添加错题', () => {
      quizCore.DB.addWrong('001');

      const wrongList = quizCore.DB.getWrong();
      expect(wrongList.length).toBe(1);
      expect(wrongList[0].qid).toBe('001');
      expect(wrongList[0].cnt).toBe(1);
    });

    test('addWrong() - 重复添加同一错题应累加计数', () => {
      quizCore.DB.addWrong('001');
      quizCore.DB.addWrong('001');
      quizCore.DB.addWrong('001');

      const wrongList = quizCore.DB.getWrong();
      expect(wrongList.length).toBe(1);
      expect(wrongList[0].cnt).toBe(3);
    });

    test('removeWrong() - 成功移除错题', () => {
      quizCore.DB.addWrong('001');
      quizCore.DB.addWrong('002');

      quizCore.DB.removeWrong('001');

      const wrongList = quizCore.DB.getWrong();
      expect(wrongList.length).toBe(1);
      expect(wrongList.find(w => w.qid === '001')).toBeUndefined();
    });

    test('findQ() - 根据ID查找题目', () => {
      // 重置题库确保题目001未被修改
      quizCore.QUESTION_BANK = quizCore.DEFAULT_QUESTION_BANK.slice();
      
      const q = quizCore.DB.findQ('001');

      expect(q).toBeDefined();
      expect(q.id).toBe('001');
      expect(q.category).toBe('专辑');
    });

    test('findQ() - 查找不存在的题目返回null', () => {
      const q = quizCore.DB.findQ('nonexistent');

      expect(q).toBeNull();
    });

    test('defaults() - 返回正确的默认数据结构', () => {
      const defaults = quizCore.DB.defaults();

      expect(defaults).toEqual({
        history: [],
        wrong: [],
        stats: { total: 0, correct: 0, cats: {} }
      });
    });
  });

  describe('题库管理测试', () => {
    test('saveQuestionBank() - 保存题库到localStorage', () => {
      quizCore.QUESTION_BANK = quizCore.DEFAULT_QUESTION_BANK.slice();
      const initialCount = quizCore.QUESTION_BANK.length;
      
      quizCore.QUESTION_BANK.push({
        id: 'test001',
        category: '测试',
        question: '测试题目',
        options: [{key:'A',text:'选项'}],
        answer: 'A',
        explanation: ''
      });

      quizCore.saveQuestionBank();

      const saved = localStorage.getItem('jj_question_bank');
      expect(saved).toBeDefined();
      const parsed = JSON.parse(saved);
      expect(parsed.length).toBe(initialCount + 1);
    });

    test('loadQuestionBank() - 从localStorage加载题库', () => {
      const customBank = [
        { id: 'custom001', category: '自定义', question: '自定义题目', options: [{key:'A',text:'选项'}], answer: 'A', explanation: '' }
      ];

      localStorage.setItem('jj_question_bank', JSON.stringify(customBank));

      quizCore.loadQuestionBank();

      expect(quizCore.QUESTION_BANK.length).toBe(1);
      expect(quizCore.QUESTION_BANK[0].id).toBe('custom001');
    });

    test('deleteQuestion() - 成功删除题目', () => {
      quizCore.QUESTION_BANK = quizCore.DEFAULT_QUESTION_BANK.slice();
      const initialCount = quizCore.QUESTION_BANK.length;
      
      quizCore.deleteQuestion('001');

      expect(quizCore.QUESTION_BANK.length).toBe(initialCount - 1);
      expect(quizCore.DB.findQ('001')).toBeNull();
    });

    test('resetQuestionBank() - 恢复默认题库', () => {
      quizCore.QUESTION_BANK = quizCore.DEFAULT_QUESTION_BANK.slice();
      const defaultCount = quizCore.DEFAULT_QUESTION_BANK.length;
      
      // 添加自定义题目
      quizCore.QUESTION_BANK.push({
        id: 'custom001',
        category: '自定义',
        question: '自定义题目',
        options: [{key:'A',text:'选项'}],
        answer: 'A',
        explanation: ''
      });

      const count = quizCore.resetQuestionBank();

      expect(count).toBe(defaultCount);
      expect(quizCore.QUESTION_BANK.length).toBe(defaultCount);
      expect(localStorage.getItem('jj_question_bank')).toBeNull();
    });
  });

  describe('数据持久化测试', () => {
    test('localStorage 数据可以被正确保存和读取', () => {
      const testData = { test: 'value', number: 123 };
      
      localStorage.setItem('test_key', JSON.stringify(testData));
      const retrieved = JSON.parse(localStorage.getItem('test_key'));
      
      expect(retrieved).toEqual(testData);
    });

    test('DB.get() 在无数据时返回默认值', () => {
      const data = quizCore.DB.get();
      
      expect(data).toEqual(quizCore.DB.defaults());
    });
  });
});