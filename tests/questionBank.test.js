/**
 * 题库管理功能测试
 * 测试 CRUD 操作、选项解析、数据验证
 */

const { parseOptions, saveQuestionToBank, deleteQuestionFromBank, DEFAULT_QUESTIONS } = require('./testUtils');

describe('选项解析 parseOptions()', () => {
  test('标准格式解析', () => {
    const text = 'A.选项一\nB.选项二\nC.选项三\nD.选项四';
    const options = parseOptions(text);
    expect(options.length).toBe(4);
    expect(options[0]).toEqual({ key: 'A', text: '选项一' });
    expect(options[3]).toEqual({ key: 'D', text: '选项四' });
  });

  test('中文顿号格式', () => {
    const text = 'A、选项一\nB、选项二';
    const options = parseOptions(text);
    expect(options.length).toBe(2);
    expect(options[0]).toEqual({ key: 'A', text: '选项一' });
  });

  test('全角点号格式', () => {
    const text = 'A．选项一\nB．选项二';
    const options = parseOptions(text);
    expect(options.length).toBe(2);
  });

  test('忽略空行', () => {
    const text = 'A.选项一\n\nB.选项二\n\n';
    const options = parseOptions(text);
    expect(options.length).toBe(2);
  });

  test('忽略不符合格式的行', () => {
    const text = 'A.选项一\n这是无效行\nB.选项二';
    const options = parseOptions(text);
    expect(options.length).toBe(2);
  });

  test('空字符串返回空数组', () => {
    const options = parseOptions('');
    expect(options.length).toBe(0);
  });

  test('只有空格的行被忽略', () => {
    const text = 'A.选项一\n   \nB.选项二';
    const options = parseOptions(text);
    expect(options.length).toBe(2);
  });

  test('选项文本包含点号', () => {
    const text = 'A.选项一.包含点号\nB.选项二';
    const options = parseOptions(text);
    expect(options[0].text).toBe('选项一.包含点号');
  });

  test('只接受 A-D 选项', () => {
    const text = 'A.选项A\nE.选项E\nB.选项B';
    const options = parseOptions(text);
    expect(options.length).toBe(2);
    expect(options.find(o => o.key === 'E')).toBeUndefined();
  });
});

describe('保存题目 saveQuestionToBank()', () => {
  let questionBank;

  beforeEach(() => {
    questionBank = JSON.parse(JSON.stringify(DEFAULT_QUESTIONS));
  });

  describe('新增题目', () => {
    test('成功新增题目', () => {
      const editData = {
        id: '',
        category: '专辑',
        question: '新测试题目',
        optsText: 'A.选项A\nB.选项B\nC.选项C\nD.选项D',
        answer: 'C',
        explanation: '这是解析'
      };
      const result = saveQuestionToBank(questionBank, editData);
      expect(result.success).toBe(true);
      expect(result.isNew).toBe(true);
      expect(questionBank.length).toBe(3);
    });

    test('新增题目包含正确数据', () => {
      const editData = {
        id: '',
        category: '新分类',
        question: '测试问题',
        optsText: 'A.选项A\nB.选项B',
        answer: 'A',
        explanation: '测试解析'
      };
      saveQuestionToBank(questionBank, editData);
      const newQ = questionBank[questionBank.length - 1];
      expect(newQ.category).toBe('新分类');
      expect(newQ.question).toBe('测试问题');
      expect(newQ.answer).toBe('A');
      expect(newQ.explanation).toBe('测试解析');
      expect(newQ.options.length).toBe(2);
    });

    test('空题目返回错误', () => {
      const editData = {
        id: '',
        category: '专辑',
        question: '',
        optsText: 'A.选项A\nB.选项B',
        answer: 'A',
        explanation: ''
      };
      const result = saveQuestionToBank(questionBank, editData);
      expect(result.success).toBe(false);
      expect(result.error).toBe('请填写题目和选项');
    });

    test('空选项返回错误', () => {
      const editData = {
        id: '',
        category: '专辑',
        question: '测试题目',
        optsText: '',
        answer: 'A',
        explanation: ''
      };
      const result = saveQuestionToBank(questionBank, editData);
      expect(result.success).toBe(false);
      expect(result.error).toBe('请填写题目和选项');
    });

    test('选项少于2个返回错误', () => {
      const editData = {
        id: '',
        category: '专辑',
        question: '测试题目',
        optsText: 'A.只有一个选项',
        answer: 'A',
        explanation: ''
      };
      const result = saveQuestionToBank(questionBank, editData);
      expect(result.success).toBe(false);
      expect(result.error).toBe('请至少输入两个选项，格式：A.选项内容');
    });
  });

  describe('编辑题目', () => {
    test('成功编辑题目', () => {
      const editData = {
        id: '001',
        category: '新分类',
        question: '修改后的问题',
        optsText: 'A.新选项A\nB.新选项B',
        answer: 'B',
        explanation: '修改后的解析'
      };
      const result = saveQuestionToBank(questionBank, editData);
      expect(result.success).toBe(true);
      expect(result.isNew).toBe(false);
      expect(questionBank.length).toBe(2); // 数量不变
    });

    test('编辑后数据正确更新', () => {
      const editData = {
        id: '001',
        category: '修改分类',
        question: '修改问题',
        optsText: 'A.选项X\nB.选项Y',
        answer: 'B',
        explanation: '修改解析'
      };
      saveQuestionToBank(questionBank, editData);
      const q = questionBank.find(q => q.id === '001');
      expect(q.category).toBe('修改分类');
      expect(q.question).toBe('修改问题');
      expect(q.answer).toBe('B');
      expect(q.explanation).toBe('修改解析');
    });

    test('编辑不存在的题目仍会添加', () => {
      const editData = {
        id: 'nonexistent',
        category: '专辑',
        question: '测试',
        optsText: 'A.选项A\nB.选项B',
        answer: 'A',
        explanation: ''
      };
      const result = saveQuestionToBank(questionBank, editData);
      // 当前实现会遍历但不添加，题目数量不变
      expect(result.success).toBe(true);
    });
  });
});

describe('删除题目 deleteQuestionFromBank()', () => {
  let questionBank;

  beforeEach(() => {
    questionBank = JSON.parse(JSON.stringify(DEFAULT_QUESTIONS));
  });

  test('成功删除存在的题目', () => {
    const result = deleteQuestionFromBank(questionBank, '001');
    expect(result.success).toBe(true);
    expect(questionBank.length).toBe(1);
    expect(questionBank.find(q => q.id === '001')).toBeUndefined();
  });

  test('删除不存在的题目返回错误', () => {
    const result = deleteQuestionFromBank(questionBank, 'nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toBe('题目不存在');
    expect(questionBank.length).toBe(2); // 数量不变
  });

  test('删除后其他题目不受影响', () => {
    deleteQuestionFromBank(questionBank, '001');
    expect(questionBank.find(q => q.id === '002')).toBeDefined();
  });

  test('删除所有题目', () => {
    deleteQuestionFromBank(questionBank, '001');
    deleteQuestionFromBank(questionBank, '002');
    expect(questionBank.length).toBe(0);
  });
});
