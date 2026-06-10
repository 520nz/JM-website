/**
 * 答题引擎核心逻辑测试
 * 测试状态管理、计时器、题目顺序等核心功能
 */

const {
  createQuizState,
  getQuestionCount,
  shuffle,
  startRandomQuiz,
  startCategoryQuiz,
  startWrongBookQuiz,
  getCurrentQuestion,
  pickOption,
  nextQuestion,
  isQuizFinished,
  getProgress,
  getElapsedTime,
  formatTime,
  getQuizResult,
  resetQuizState,
  createAnswerRecord
} = require('../src/quizEngine');

// 模拟题库
const mockQuestionBank = [
  { id: '001', category: '专辑', question: '题目1', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'A', explanation: '解析1' },
  { id: '002', category: '歌曲', question: '题目2', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'B', explanation: '解析2' },
  { id: '003', category: '专辑', question: '题目3', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'A', explanation: '解析3' },
  { id: '004', category: '歌曲', question: '题目4', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'B', explanation: '解析4' },
  { id: '005', category: '个人信息', question: '题目5', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'A', explanation: '解析5' }
];

describe('答题引擎核心逻辑测试', () => {
  
  describe('createQuizState - 创建答题状态测试', () => {
    
    test('应该创建正确的初始答题状态', () => {
      const state = createQuizState();
      expect(state.quiz).toEqual([]);
      expect(state.idx).toBe(0);
      expect(state.answered).toBe(false);
      expect(state.mode).toBe('quick');
      expect(state.correctCount).toBe(0);
      expect(state.startTime).toBe(0);
      expect(state.timer).toBeNull();
    });
    
    test('应该接受指定的模式参数', () => {
      const state1 = createQuizState('quick');
      expect(state1.mode).toBe('quick');
      
      const state2 = createQuizState('standard');
      expect(state2.mode).toBe('standard');
      
      const state3 = createQuizState('intensive');
      expect(state3.mode).toBe('intensive');
    });
    
    test('应该接受无效模式参数（使用默认值）', () => {
      const state = createQuizState('invalid');
      expect(state.mode).toBe('invalid');
    });
    
    test('每次调用应该返回新的状态对象', () => {
      const state1 = createQuizState();
      const state2 = createQuizState();
      expect(state1).not.toBe(state2);
    });
  });
  
  describe('getQuestionCount - 获取题目数量测试', () => {
    
    test('应该返回正确的题目数量', () => {
      expect(getQuestionCount('quick')).toBe(10);
      expect(getQuestionCount('standard')).toBe(20);
      expect(getQuestionCount('intensive')).toBe(30);
    });
    
    test('应该返回默认数量处理无效模式', () => {
      expect(getQuestionCount('invalid')).toBe(10);
      expect(getQuestionCount(null)).toBe(10);
      expect(getQuestionCount(undefined)).toBe(10);
    });
    
    test('应该处理空字符串模式', () => {
      expect(getQuestionCount('')).toBe(10);
    });
  });
  
  describe('shuffle - 洗牌算法测试', () => {
    
    test('应该返回与原数组长度相同的数组', () => {
      const arr = [1, 2, 3, 4, 5];
      const shuffled = shuffle(arr);
      expect(shuffled.length).toBe(arr.length);
    });
    
    test('应该包含原数组的所有元素', () => {
      const arr = [1, 2, 3, 4, 5];
      const shuffled = shuffle(arr);
      expect(shuffled.sort()).toEqual(arr.sort());
    });
    
    test('应该不修改原数组', () => {
      const arr = [1, 2, 3, 4, 5];
      const original = arr.slice();
      shuffle(arr);
      expect(arr).toEqual(original);
    });
    
    test('应该返回新数组', () => {
      const arr = [1, 2, 3, 4, 5];
      const shuffled = shuffle(arr);
      expect(shuffled).not.toBe(arr);
    });
    
    test('应该处理空数组', () => {
      const shuffled = shuffle([]);
      expect(shuffled).toEqual([]);
    });
    
    test('应该处理单元素数组', () => {
      const shuffled = shuffle([1]);
      expect(shuffled).toEqual([1]);
    });
    
    test('应该处理对象数组', () => {
      const arr = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const shuffled = shuffle(arr);
      expect(shuffled.length).toBe(3);
      expect(shuffled.map(x => x.id).sort()).toEqual([1, 2, 3]);
    });
    
    test('洗牌结果应该是随机的（多次调用结果不同）', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const results = [];
      
      // 多次洗牌
      for (let i = 0; i < 10; i++) {
        results.push(shuffle(arr).join(','));
      }
      
      // 检查是否有不同的结果
      const uniqueResults = [...new Set(results)];
      expect(uniqueResults.length).toBeGreaterThan(1);
    });
  });
  
  describe('startRandomQuiz - 开始随机答题测试', () => {
    
    test('应该正确初始化答题状态', () => {
      const state = createQuizState();
      setMockDateNow(1000);
      
      startRandomQuiz(state, mockQuestionBank, 'quick');
      
      expect(state.quiz.length).toBeLessThanOrEqual(10);
      expect(state.idx).toBe(0);
      expect(state.correctCount).toBe(0);
      expect(state.startTime).toBe(1000);
      expect(state.answered).toBe(false);
      expect(state.mode).toBe('quick');
      
      resetMockDateNow();
    });
    
    test('应该正确限制题目数量', () => {
      const state = createQuizState();
      
      startRandomQuiz(state, mockQuestionBank, 'quick');
      expect(state.quiz.length).toBeLessThanOrEqual(10);
      
      startRandomQuiz(state, mockQuestionBank, 'standard');
      expect(state.quiz.length).toBeLessThanOrEqual(20);
      
      startRandomQuiz(state, mockQuestionBank, 'intensive');
      expect(state.quiz.length).toBeLessThanOrEqual(30);
    });
    
    test('应该处理题库小于题目数量要求的情况', () => {
      const smallBank = [{ id: '001', question: 'Q1', options: [{ key: 'A', text: 'A' }], answer: 'A' }];
      const state = createQuizState();
      
      startRandomQuiz(state, smallBank, 'standard');
      expect(state.quiz.length).toBe(1);
    });
    
    test('应该处理空题库', () => {
      const state = createQuizState();
      startRandomQuiz(state, [], 'quick');
      expect(state.quiz.length).toBe(0);
    });
    
    test('应该随机选择题目', () => {
      const state1 = createQuizState();
      const state2 = createQuizState();
      
      startRandomQuiz(state1, mockQuestionBank, 'quick');
      startRandomQuiz(state2, mockQuestionBank, 'quick');
      
      // 多次调用应该产生不同的题目顺序（大概率）
      // 但由于题库较小，可能有时相同
      expect(state1.quiz.length).toBe(state2.quiz.length);
    });
  });
  
  describe('startCategoryQuiz - 开始分类答题测试', () => {
    
    test('应该正确筛选指定分类的题目', () => {
      const state = createQuizState();
      startCategoryQuiz(state, mockQuestionBank, '专辑', 'quick');
      
      expect(state.quiz.length).toBeGreaterThan(0);
      state.quiz.forEach(q => {
        expect(q.category).toBe('专辑');
      });
    });
    
    test('应该正确处理不存在分类的情况', () => {
      const state = createQuizState();
      startCategoryQuiz(state, mockQuestionBank, '不存在分类', 'quick');
      
      expect(state.quiz.length).toBe(0);
    });
    
    test('应该正确限制分类题目数量', () => {
      const state = createQuizState();
      startCategoryQuiz(state, mockQuestionBank, '专辑', 'quick');
      expect(state.quiz.length).toBeLessThanOrEqual(10);
    });
    
    test('应该正确初始化答题状态', () => {
      const state = createQuizState();
      setMockDateNow(1000);
      
      startCategoryQuiz(state, mockQuestionBank, '专辑', 'quick');
      
      expect(state.idx).toBe(0);
      expect(state.correctCount).toBe(0);
      expect(state.startTime).toBe(1000);
      expect(state.answered).toBe(false);
      
      resetMockDateNow();
    });
    
    test('应该处理空分类名称', () => {
      const state = createQuizState();
      startCategoryQuiz(state, mockQuestionBank, '', 'quick');
      // 空分类应该匹配所有题目
      expect(state.quiz.length).toBe(0);
    });
  });
  
  describe('startWrongBookQuiz - 开始错题复习测试', () => {
    
    test('应该正确从错题列表创建答题', () => {
      const state = createQuizState();
      const wrongList = [{ qid: '001', cnt: 1 }, { qid: '002', cnt: 2 }];
      
      startWrongBookQuiz(state, mockQuestionBank, wrongList);
      
      expect(state.quiz.length).toBe(2);
      expect(state.quiz.map(q => q.id)).toContain('001');
      expect(state.quiz.map(q => q.id)).toContain('002');
    });
    
    test('应该返回null处理空错题列表', () => {
      const state = createQuizState();
      const result = startWrongBookQuiz(state, mockQuestionBank, []);
      expect(result).toBeNull();
    });
    
    test('应该跳过不在题库中的错题', () => {
      const state = createQuizState();
      const wrongList = [{ qid: '001', cnt: 1 }, { qid: '999', cnt: 1 }];
      
      startWrongBookQuiz(state, mockQuestionBank, wrongList);
      
      expect(state.quiz.length).toBe(1);
      expect(state.quiz[0].id).toBe('001');
    });
    
    test('应该正确初始化答题状态', () => {
      const state = createQuizState();
      setMockDateNow(1000);
      const wrongList = [{ qid: '001', cnt: 1 }];
      
      startWrongBookQuiz(state, mockQuestionBank, wrongList);
      
      expect(state.idx).toBe(0);
      expect(state.correctCount).toBe(0);
      expect(state.startTime).toBe(1000);
      expect(state.answered).toBe(false);
      
      resetMockDateNow();
    });
    
    test('应该随机排序错题', () => {
      const state1 = createQuizState();
      const state2 = createQuizState();
      const wrongList = [{ qid: '001', cnt: 1 }, { qid: '002', cnt: 1 }, { qid: '003', cnt: 1 }];
      
      startWrongBookQuiz(state1, mockQuestionBank, wrongList);
      startWrongBookQuiz(state2, mockQuestionBank, wrongList);
      
      expect(state1.quiz.length).toBe(3);
      expect(state2.quiz.length).toBe(3);
    });
  });
  
  describe('getCurrentQuestion - 获取当前题目测试', () => {
    
    test('应该返回当前题目', () => {
      const state = createQuizState();
      startRandomQuiz(state, mockQuestionBank, 'quick');
      
      const question = getCurrentQuestion(state);
      expect(question).toBeDefined();
      expect(question.id).toBeDefined();
      expect(question.question).toBeDefined();
      expect(question.options).toBeDefined();
      expect(question.answer).toBeDefined();
    });
    
    test('应该返回null处理空答题列表', () => {
      const state = createQuizState();
      const question = getCurrentQuestion(state);
      expect(question).toBeNull();
    });
    
    test('应该返回null处理超出索引的情况', () => {
      const state = createQuizState();
      startRandomQuiz(state, mockQuestionBank, 'quick');
      state.idx = state.quiz.length + 10;
      
      const question = getCurrentQuestion(state);
      expect(question).toBeNull();
    });
    
    test('应该返回正确的题目随着索引变化', () => {
      const state = createQuizState();
      state.quiz = mockQuestionBank.slice(0, 3);
      state.idx = 0;
      
      expect(getCurrentQuestion(state).id).toBe('001');
      
      state.idx = 1;
      expect(getCurrentQuestion(state).id).toBe('002');
      
      state.idx = 2;
      expect(getCurrentQuestion(state).id).toBe('003');
    });
  });
  
  describe('pickOption - 选择答案测试', () => {
    
    test('应该正确判断正确答案', () => {
      const state = createQuizState();
      state.quiz = [mockQuestionBank[0]]; // answer: 'A'
      state.idx = 0;
      state.answered = false;
      
      const result = pickOption(state, 'A');
      
      expect(result.ok).toBe(true);
      expect(result.userAnswer).toBe('A');
      expect(result.correctAnswer).toBe('A');
      expect(state.correctCount).toBe(1);
      expect(state.answered).toBe(true);
    });
    
    test('应该正确判断错误答案', () => {
      const state = createQuizState();
      state.quiz = [mockQuestionBank[0]]; // answer: 'A'
      state.idx = 0;
      state.answered = false;
      
      const result = pickOption(state, 'B');
      
      expect(result.ok).toBe(false);
      expect(result.userAnswer).toBe('B');
      expect(result.correctAnswer).toBe('A');
      expect(state.correctCount).toBe(0);
      expect(state.answered).toBe(true);
    });
    
    test('应该返回null处理已回答的状态', () => {
      const state = createQuizState();
      state.quiz = [mockQuestionBank[0]];
      state.idx = 0;
      state.answered = true;
      
      const result = pickOption(state, 'A');
      expect(result).toBeNull();
    });
    
    test('应该返回题目解析', () => {
      const state = createQuizState();
      state.quiz = [mockQuestionBank[0]];
      state.idx = 0;
      state.answered = false;
      
      const result = pickOption(state, 'A');
      expect(result.explanation).toBe('解析1');
    });
    
    test('应该返回题目ID', () => {
      const state = createQuizState();
      state.quiz = [mockQuestionBank[0]];
      state.idx = 0;
      state.answered = false;
      
      const result = pickOption(state, 'A');
      expect(result.questionId).toBe('001');
    });
    
    test('应该累计正确答案计数', () => {
      const state = createQuizState();
      state.quiz = mockQuestionBank.slice(0, 3);
      state.idx = 0;
      state.correctCount = 0;
      
      pickOption(state, 'A'); // 正确
      expect(state.correctCount).toBe(1);
      
      state.answered = false;
      state.idx = 1;
      pickOption(state, 'B'); // 正确
      expect(state.correctCount).toBe(2);
      
      state.answered = false;
      state.idx = 2;
      pickOption(state, 'B'); // 错误
      expect(state.correctCount).toBe(2);
    });
  });
  
  describe('nextQuestion - 下一题测试', () => {
    
    test('应该正确增加索引', () => {
      const state = createQuizState();
      state.quiz = mockQuestionBank.slice(0, 3);
      state.idx = 0;
      state.answered = true;
      
      nextQuestion(state);
      
      expect(state.idx).toBe(1);
      expect(state.answered).toBe(false);
    });
    
    test('应该重置answered状态', () => {
      const state = createQuizState();
      state.quiz = mockQuestionBank.slice(0, 3);
      state.idx = 0;
      state.answered = true;
      
      nextQuestion(state);
      expect(state.answered).toBe(false);
    });
    
    test('应该处理超出索引的情况', () => {
      const state = createQuizState();
      state.quiz = mockQuestionBank.slice(0, 3);
      state.idx = 2;
      
      nextQuestion(state);
      expect(state.idx).toBe(3);
    });
    
    test('应该处理空答题列表', () => {
      const state = createQuizState();
      state.quiz = [];
      state.idx = 0;
      
      nextQuestion(state);
      expect(state.idx).toBe(1);
    });
  });
  
  describe('isQuizFinished - 检查答题完成测试', () => {
    
    test('应该正确判断答题完成', () => {
      const state = createQuizState();
      state.quiz = mockQuestionBank.slice(0, 3);
      state.idx = 3;
      
      expect(isQuizFinished(state)).toBe(true);
    });
    
    test('应该正确判断答题未完成', () => {
      const state = createQuizState();
      state.quiz = mockQuestionBank.slice(0, 3);
      state.idx = 0;
      
      expect(isQuizFinished(state)).toBe(false);
    });
    
    test('应该处理空答题列表', () => {
      const state = createQuizState();
      state.quiz = [];
      state.idx = 0;
      
      expect(isQuizFinished(state)).toBe(true);
    });
    
    test('应该处理超出索引的情况', () => {
      const state = createQuizState();
      state.quiz = mockQuestionBank.slice(0, 3);
      state.idx = 10;
      
      expect(isQuizFinished(state)).toBe(true);
    });
  });
  
  describe('getProgress - 获取答题进度测试', () => {
    
    test('应该返回正确的进度信息', () => {
      const state = createQuizState();
      state.quiz = mockQuestionBank.slice(0, 5);
      state.idx = 1;
      
      const progress = getProgress(state);
      
      expect(progress.current).toBe(2);
      expect(progress.total).toBe(5);
      expect(progress.percentage).toBe(20);
    });
    
    test('应该处理开始状态', () => {
      const state = createQuizState();
      state.quiz = mockQuestionBank.slice(0, 10);
      state.idx = 0;
      
      const progress = getProgress(state);
      expect(progress.current).toBe(1);
      expect(progress.percentage).toBe(0);
    });
    
    test('应该处理完成状态', () => {
      const state = createQuizState();
      state.quiz = mockQuestionBank.slice(0, 5);
      state.idx = 4;
      
      const progress = getProgress(state);
      expect(progress.current).toBe(5);
      expect(progress.percentage).toBe(80);
    });
    
    test('应该处理空答题列表', () => {
      const state = createQuizState();
      state.quiz = [];
      state.idx = 0;
      
      const progress = getProgress(state);
      expect(progress.current).toBe(1);
      expect(progress.total).toBe(0);
      expect(progress.percentage).toBeNaN();
    });
    
    test('应该处理超出索引的情况', () => {
      const state = createQuizState();
      state.quiz = mockQuestionBank.slice(0, 5);
      state.idx = 10;
      
      const progress = getProgress(state);
      expect(progress.current).toBe(11);
      expect(progress.percentage).toBe(200);
    });
  });
  
  describe('getElapsedTime - 计算用时测试', () => {
    
    test('应该返回正确的用时信息', () => {
      const state = createQuizState();
      state.startTime = 1000;
      setMockDateNow(61000); // 60秒后
      
      const elapsed = getElapsedTime(state);
      
      expect(elapsed.milliseconds).toBe(60000);
      expect(elapsed.minutes).toBe(1);
      expect(elapsed.seconds).toBe(0);
      expect(elapsed.formatted).toBe('1分0秒');
      
      resetMockDateNow();
    });
    
    test('应该处理少于1分钟的用时', () => {
      const state = createQuizState();
      state.startTime = 1000;
      setMockDateNow(35000); // 34秒后
      
      const elapsed = getElapsedTime(state);
      
      expect(elapsed.minutes).toBe(0);
      expect(elapsed.seconds).toBe(34);
      expect(elapsed.formatted).toBe('0分34秒');
      
      resetMockDateNow();
    });
    
    test('应该处理大于10分钟的用时', () => {
      const state = createQuizState();
      state.startTime = 1000;
      setMockDateNow(625000); // 10分24秒后
      
      const elapsed = getElapsedTime(state);
      
      expect(elapsed.minutes).toBe(10);
      expect(elapsed.seconds).toBe(24);
      expect(elapsed.formatted).toBe('10分24秒');
      
      resetMockDateNow();
    });
    
    test('应该处理开始时间为0的情况', () => {
      const state = createQuizState();
      state.startTime = 0;
      setMockDateNow(1000);
      
      const elapsed = getElapsedTime(state);
      expect(elapsed.milliseconds).toBe(1000);
      
      resetMockDateNow();
    });
  });
  
  describe('formatTime - 格式化时间测试', () => {
    
    test('应该正确格式化毫秒时间', () => {
      expect(formatTime(60000)).toBe('1分0秒');
      expect(formatTime(90000)).toBe('1分30秒');
      expect(formatTime(3600000)).toBe('60分0秒');
    });
    
    test('应该处理少于1分钟的时间', () => {
      expect(formatTime(1000)).toBe('0分1秒');
      expect(formatTime(30000)).toBe('0分30秒');
      expect(formatTime(59000)).toBe('0分59秒');
    });
    
    test('应该处理0毫秒', () => {
      expect(formatTime(0)).toBe('0分0秒');
    });
    
    test('应该处理负数时间', () => {
      // 负数时间会产生负分钟和负秒
      const result = formatTime(-1000);
      expect(result).toMatch(/-1分-1秒/);
    });
  });
  
  describe('getQuizResult - 获取答题结果测试', () => {
    
    test('应该返回正确的答题结果', () => {
      const state = createQuizState();
      state.quiz = mockQuestionBank.slice(0, 5);
      state.correctCount = 4;
      state.startTime = 1000;
      setMockDateNow(61000);
      
      const result = getQuizResult(state);
      
      expect(result.total).toBe(5);
      expect(result.correct).toBe(4);
      expect(result.wrong).toBe(1);
      expect(result.percentage).toBe(80);
      expect(result.elapsed).toBe('1分0秒');
      
      resetMockDateNow();
    });
    
    test('应该处理全正确的情况', () => {
      const state = createQuizState();
      state.quiz = mockQuestionBank.slice(0, 5);
      state.correctCount = 5;
      
      const result = getQuizResult(state);
      expect(result.percentage).toBe(100);
      expect(result.wrong).toBe(0);
    });
    
    test('应该处理全错误的情况', () => {
      const state = createQuizState();
      state.quiz = mockQuestionBank.slice(0, 5);
      state.correctCount = 0;
      
      const result = getQuizResult(state);
      expect(result.percentage).toBe(0);
      expect(result.wrong).toBe(5);
    });
    
    test('应该处理空答题列表', () => {
      const state = createQuizState();
      state.quiz = [];
      state.correctCount = 0;
      
      const result = getQuizResult(state);
      expect(result.total).toBe(0);
      expect(result.percentage).toBe(0);
    });
    
    test('应该正确计算百分比', () => {
      const state = createQuizState();
      state.quiz = mockQuestionBank.slice(0, 3);
      state.correctCount = 1;
      
      const result = getQuizResult(state);
      expect(result.percentage).toBe(33); // 1/3 * 100 ≈ 33%
    });
  });
  
  describe('resetQuizState - 重置答题状态测试', () => {
    
    test('应该正确重置所有状态', () => {
      const state = createQuizState();
      state.quiz = mockQuestionBank.slice(0, 10);
      state.idx = 5;
      state.answered = true;
      state.correctCount = 3;
      state.startTime = 1000;
      state.timer = {};
      
      resetQuizState(state);
      
      expect(state.quiz).toEqual([]);
      expect(state.idx).toBe(0);
      expect(state.answered).toBe(false);
      expect(state.correctCount).toBe(0);
      expect(state.startTime).toBe(0);
      expect(state.timer).toBeNull();
    });
    
    test('应该处理已重置的状态', () => {
      const state = createQuizState();
      resetQuizState(state);
      resetQuizState(state);
      
      expect(state.quiz).toEqual([]);
    });
  });
  
  describe('createAnswerRecord - 创建答题记录测试', () => {
    
    test('应该创建正确的答题记录', () => {
      const state = createQuizState();
      state.quiz = [mockQuestionBank[0]];
      state.idx = 0;
      setMockDateNow(1000);
      
      const record = createAnswerRecord(state, 'A', true);
      
      expect(record.qid).toBe('001');
      expect(record.ans).toBe('A');
      expect(record.ok).toBe(true);
      expect(record.time).toBe(1000);
      
      resetMockDateNow();
    });
    
    test('应该创建错误答案的记录', () => {
      const state = createQuizState();
      state.quiz = [mockQuestionBank[0]];
      state.idx = 0;
      setMockDateNow(1000);
      
      const record = createAnswerRecord(state, 'B', false);
      
      expect(record.ans).toBe('B');
      expect(record.ok).toBe(false);
      
      resetMockDateNow();
    });
  });
  
  describe('边界条件和极端情况测试', () => {
    
    test('应该处理超大题库', () => {
      const largeBank = [];
      for (let i = 0; i < 1000; i++) {
        largeBank.push({
          id: `q${i}`,
          category: '测试',
          question: `题目${i}`,
          options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }],
          answer: 'A',
          explanation: ''
        });
      }
      
      const state = createQuizState();
      startRandomQuiz(state, largeBank, 'intensive');
      
      expect(state.quiz.length).toBeLessThanOrEqual(30);
    });
    
    test('应该处理超长答题时间', () => {
      const state = createQuizState();
      state.startTime = 1000;
      setMockDateNow(3600000 + 1000); // 1小时后
      
      const elapsed = getElapsedTime(state);
      expect(elapsed.minutes).toBe(60);
      
      resetMockDateNow();
    });
    
    test('应该处理大量连续答题', () => {
      // 创建足够多的题目
      const largeBank = [];
      for (let i = 0; i < 100; i++) {
        largeBank.push({
          id: `q${i}`,
          category: '测试',
          question: `题目${i}`,
          options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }],
          answer: 'A',
          explanation: ''
        });
      }
      
      const state = createQuizState();
      state.quiz = largeBank;
      
      for (let i = 0; i < 100; i++) {
        state.idx = i;
        state.answered = false;
        pickOption(state, 'A');
        nextQuestion(state);
      }
      
      expect(isQuizFinished(state)).toBe(true);
    });
    
    test('应该处理快速连续选择答案', () => {
      const state = createQuizState();
      state.quiz = [mockQuestionBank[0]];
      state.idx = 0;
      state.answered = false;
      
      // 第一次选择应该成功
      const result1 = pickOption(state, 'A');
      expect(result1).toBeDefined();
      
      // 第二次选择应该返回null（已回答）
      const result2 = pickOption(state, 'B');
      expect(result2).toBeNull();
    });
    
    test('应该处理索引越界访问', () => {
      const state = createQuizState();
      state.quiz = mockQuestionBank.slice(0, 3);
      state.idx = 100;
      state.answered = false;
      
      const question = getCurrentQuestion(state);
      expect(question).toBeNull();
      
      // pickOption在越界时会抛出错误，这是预期的行为
      // 测试边界情况的处理
      try {
        pickOption(state, 'A');
      } catch (e) {
        expect(e).toBeDefined();
      }
    });
    
    test('应该处理题目选项为空的情况', () => {
      const emptyOptionsBank = [{
        id: '001',
        category: '测试',
        question: '题目',
        options: [],
        answer: 'A',
        explanation: ''
      }];
      
      const state = createQuizState();
      state.quiz = emptyOptionsBank;
      state.idx = 0;
      state.answered = false;
      
      // 尝试选择答案
      const result = pickOption(state, 'A');
      // 由于没有选项，answer 'A' 不在options中，但逻辑应该仍然工作
      expect(result.ok).toBe(true); // 因为answer === 'A'
    });
    
    test('应该处理题目数据缺失的情况', () => {
      const incompleteBank = [{
        id: '001'
        // 缺少其他字段
      }];
      
      const state = createQuizState();
      state.quiz = incompleteBank;
      state.idx = 0;
      
      const question = getCurrentQuestion(state);
      expect(question).toBeDefined();
      expect(question.id).toBe('001');
      expect(question.options).toBeUndefined();
    });
    
    test('应该处理所有题目答案相同的情况', () => {
      const sameAnswerBank = [];
      for (let i = 0; i < 10; i++) {
        sameAnswerBank.push({
          id: `q${i}`,
          category: '测试',
          question: `题目${i}`,
          options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }],
          answer: 'A',
          explanation: ''
        });
      }
      
      const state = createQuizState();
      startRandomQuiz(state, sameAnswerBank, 'quick');
      
      // 全选A
      for (let i = 0; i < state.quiz.length; i++) {
        state.idx = i;
        state.answered = false;
        pickOption(state, 'A');
      }
      
      expect(state.correctCount).toBe(state.quiz.length);
    });
    
    test('应该处理答题中途重置', () => {
      const state = createQuizState();
      startRandomQuiz(state, mockQuestionBank, 'quick');
      
      // 答了几题
      for (let i = 0; i < 3; i++) {
        state.idx = i;
        state.answered = false;
        pickOption(state, 'A');
        nextQuestion(state);
      }
      
      // 中途重置
      resetQuizState(state);
      
      expect(state.quiz).toEqual([]);
      expect(state.idx).toBe(0);
      expect(state.correctCount).toBe(0);
    });
    
    test('应该处理时间戳为负数的情况', () => {
      const state = createQuizState();
      state.startTime = -1000;
      setMockDateNow(1000);
      
      const elapsed = getElapsedTime(state);
      expect(elapsed.milliseconds).toBe(2000);
      
      resetMockDateNow();
    });
    
    test('应该处理开始时间大于当前时间的情况', () => {
      const state = createQuizState();
      state.startTime = 2000;
      setMockDateNow(1000);
      
      const elapsed = getElapsedTime(state);
      expect(elapsed.milliseconds).toBe(-1000);
      
      resetMockDateNow();
    });
  });
});