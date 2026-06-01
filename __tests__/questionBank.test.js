const { createQuestionBank } = require('../src/questionBank');

describe('题库管理模块', () => {
  let mockLocalStorage;
  let defaultQuestions;
  let questionBank;

  beforeEach(() => {
    mockLocalStorage = {
      store: {},
      getItem: jest.fn((key) => mockLocalStorage.store[key] || null),
      setItem: jest.fn((key, value) => { mockLocalStorage.store[key] = value; }),
      removeItem: jest.fn((key) => { delete mockLocalStorage.store[key]; })
    };

    defaultQuestions = [
      { id: 'q1', category: '专辑', question: '问题1' },
      { id: 'q2', category: '歌曲', question: '问题2' },
      { id: 'q3', category: '专辑', question: '问题3' }
    ];

    questionBank = createQuestionBank(mockLocalStorage, defaultQuestions);
  });

  test('应该正确初始化并获取所有问题', () => {
    const questions = questionBank.get();
    expect(questions.length).toBe(3);
    expect(questions).toEqual(defaultQuestions);
  });

  test('应该正确添加新问题', () => {
    const newQuestion = { id: 'q4', category: '个人信息', question: '问题4' };
    questionBank.add(newQuestion);
    expect(questionBank.get().length).toBe(4);
    expect(questionBank.find('q4')).toEqual(newQuestion);
  });

  test('应该正确更新问题', () => {
    questionBank.update('q1', { question: '更新后的问题1' });
    const updatedQuestion = questionBank.find('q1');
    expect(updatedQuestion.question).toBe('更新后的问题1');
  });

  test('应该正确删除问题', () => {
    questionBank.delete('q1');
    expect(questionBank.get().length).toBe(2);
    expect(questionBank.find('q1')).toBeUndefined();
  });

  test('应该正确按分类筛选问题', () => {
    const albumQuestions = questionBank.filterByCategory('专辑');
    expect(albumQuestions.length).toBe(2);
    expect(albumQuestions.every(q => q.category === '专辑')).toBe(true);
  });

  test('应该正确获取所有分类及其数量', () => {
    const categories = questionBank.getCategories();
    expect(categories).toEqual({
      '专辑': 2,
      '歌曲': 1
    });
  });

  test('应该正确保存和加载题库', () => {
    questionBank.add({ id: 'q4', category: '专辑', question: '问题4' });
    questionBank.save();
    
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
    
    const newQuestionBank = createQuestionBank(mockLocalStorage, defaultQuestions);
    newQuestionBank.load();
    expect(newQuestionBank.get().length).toBe(4);
  });

  test('应该正确重置为默认题库', () => {
    questionBank.add({ id: 'q4', category: '专辑', question: '问题4' });
    questionBank.resetToDefault();
    expect(questionBank.get().length).toBe(3);
    expect(questionBank.get()).toEqual(defaultQuestions);
  });
});
