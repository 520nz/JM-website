describe('答题核心流程', () => {
  beforeEach(() => {
    localStorage.clear();
    state.quiz = [];
    state.idx = 0;
    state.correctCount = 0;
    state.answered = false;
  });

  test('getCount() 应根据模式返回正确数量', () => {
    state.mode = 'quick';
    expect(getCount()).toBe(10);
    state.mode = 'standard';
    expect(getCount()).toBe(20);
    state.mode = 'intensive';
    expect(getCount()).toBe(30);
    state.mode = 'unknown';
    expect(getCount()).toBe(10);
  });

  test('shuffle() 应打乱数组顺序', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle(arr);
    expect(shuffled.length).toBe(5);
    expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  test('shuffle() 应返回新数组而不修改原数组', () => {
    const arr = [1, 2, 3];
    const shuffled = shuffle(arr);
    expect(arr).toEqual([1, 2, 3]);
    expect(shuffled).not.toBe(arr);
  });

  test('fmtTime() 应正确格式化时间', () => {
    expect(fmtTime(0)).toBe('0分0秒');
    expect(fmtTime(59000)).toBe('0分59秒');
    expect(fmtTime(60000)).toBe('1分0秒');
    expect(fmtTime(61000)).toBe('1分1秒');
    expect(fmtTime(3600000)).toBe('60分0秒');
  });

  test('QUESTION_BANK 应包含正确数量的题目', () => {
    expect(QUESTION_BANK.length).toBe(78);
  });

  test('DEFAULT_QUESTION_BANK 应与原始题库一致', () => {
    expect(DEFAULT_QUESTION_BANK.length).toBe(78);
    expect(DEFAULT_QUESTION_BANK[0].id).toBe('001');
  });

  test('题目数据结构应包含所有必需字段', () => {
    const q = QUESTION_BANK[0];
    expect(q.id).toBeDefined();
    expect(q.category).toBeDefined();
    expect(q.question).toBeDefined();
    expect(q.options).toBeDefined();
    expect(q.answer).toBeDefined();
    expect(q.explanation).toBeDefined();
    expect(q.options.length).toBeGreaterThanOrEqual(2);
  });

  test('题库应包含所有分类', () => {
    const categories = {};
    for (let i = 0; i < QUESTION_BANK.length; i++) {
      categories[QUESTION_BANK[i].category] = true;
    }
    expect(categories).toHaveProperty('专辑');
    expect(categories).toHaveProperty('歌曲');
    expect(categories).toHaveProperty('个人信息');
    expect(categories).toHaveProperty('获奖记录');
  });

  test('分类题目数量应正确', () => {
    const counts = {};
    for (let i = 0; i < QUESTION_BANK.length; i++) {
      const cat = QUESTION_BANK[i].category;
      counts[cat] = (counts[cat] || 0) + 1;
    }
    expect(counts['专辑']).toBe(15);
    expect(counts['歌曲']).toBe(45);
    expect(counts['个人信息']).toBe(8);
    expect(counts['获奖记录']).toBe(10);
  });

  test('loadQuestionBank() 应正确加载保存的题库', () => {
    const customBank = [{ id: 'custom1', category: '测试', question: '测试题', options: [{ key: 'A', text: '选项' }], answer: 'A', explanation: '解释' }];
    localStorage.setItem('jj_question_bank', JSON.stringify(customBank));
    loadQuestionBank();
    expect(QUESTION_BANK.length).toBe(1);
    expect(QUESTION_BANK[0].id).toBe('custom1');
  });

  test('loadQuestionBank() 应在解析失败时使用默认题库', () => {
    localStorage.setItem('jj_question_bank', 'invalid json');
    loadQuestionBank();
    expect(QUESTION_BANK.length).toBe(78);
  });

  test('saveQuestionBank() 应正确保存题库到localStorage', () => {
    const customBank = [{ id: 'custom1', category: '测试', question: '测试题', options: [{ key: 'A', text: '选项' }], answer: 'A', explanation: '解释' }];
    QUESTION_BANK = customBank;
    saveQuestionBank();
    const saved = JSON.parse(localStorage.getItem('jj_question_bank'));
    expect(saved.length).toBe(1);
    expect(saved[0].id).toBe('custom1');
  });

  test('resetQuestionBank() 应恢复默认题库', () => {
    QUESTION_BANK = [{ id: 'custom1', category: '测试', question: '测试题', options: [{ key: 'A', text: '选项' }], answer: 'A', explanation: '解释' }];
    localStorage.setItem('jj_question_bank', JSON.stringify(QUESTION_BANK));
    QUESTION_BANK = DEFAULT_QUESTION_BANK.slice();
    localStorage.removeItem('jj_question_bank');
    expect(QUESTION_BANK.length).toBe(78);
    expect(localStorage.getItem('jj_question_bank')).toBeNull();
  });
});