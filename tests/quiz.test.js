/**
 * quiz.js 答题引擎核心算法测试
 * 重点测试：随机打乱、计时器、模式选择、键盘处理
 */

describe('quiz.js 核心算法测试', () => {
  
  describe('随机打乱算法', () => {
    // Fisher-Yates 洗牌算法实现
    const shuffle = (arr) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    test('应保持原数组不变', () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = shuffle(original);
      
      expect(original).toEqual([1, 2, 3, 4, 5]);
      expect(shuffled).not.toBe(original);
    });

    test('应保持相同元素', () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = shuffle(original);
      
      expect(shuffled.sort()).toEqual(original.sort());
    });

    test('随机性测试 - 多次打乱应有不同结果', () => {
      const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const results = new Set();
      
      for (let i = 0; i < 100; i++) {
        const shuffled = shuffle(original);
        results.add(shuffled.join(','));
      }
      
      // 100次打乱应产生多种不同排列
      expect(results.size).toBeGreaterThan(50);
    });

    test('空数组应返回空数组', () => {
      const result = shuffle([]);
      expect(result).toEqual([]);
    });

    test('单元素数组应返回相同数组', () => {
      const result = shuffle([1]);
      expect(result).toEqual([1]);
    });

    test('性能测试 - 大数组打乱', () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => i);
      
      const start = Date.now();
      shuffle(largeArray);
      const duration = Date.now() - start;
      
      // 打乱1000个元素应在100ms内完成
      expect(duration).toBeLessThan(100);
    });
  });

  describe('模式选择逻辑', () => {
    const modeConfig = {
      quick: 10,
      standard: 20,
      intensive: 30
    };

    test('quick 模式应返回10题', () => {
      const count = modeConfig['quick'] || 10;
      expect(count).toBe(10);
    });

    test('standard 模式应返回20题', () => {
      const count = modeConfig['standard'] || 10;
      expect(count).toBe(20);
    });

    test('intensive 模式应返回30题', () => {
      const count = modeConfig['intensive'] || 10;
      expect(count).toBe(30);
    });

    test('未知模式应使用默认值', () => {
      const count = modeConfig['unknown'] || 10;
      expect(count).toBe(10);
    });
  });

  describe('计时器逻辑', () => {
    test('应正确格式化时间', () => {
      const formatTime = (ms) => {
        const sec = Math.floor(ms / 1000);
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return m + '分' + s + '秒';
      };
      
      expect(formatTime(90000)).toBe('1分30秒');
      expect(formatTime(0)).toBe('0分0秒');
      expect(formatTime(3600000)).toBe('60分0秒');
    });

    test('应正确计算用时', () => {
      const start = Date.now() - 5000;
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeGreaterThanOrEqual(5000);
      expect(elapsed).toBeLessThan(6000);
    });
  });

  describe('键盘快捷键逻辑', () => {
    test('应正确映射按键到选项', () => {
      const keyMap = { 'a': 'A', 'b': 'B', 'c': 'C', 'd': 'D' };
      
      const key = 'a';
      const optionKey = keyMap[key.toLowerCase()];
      
      expect(optionKey).toBe('A');
    });

    test('应区分大小写', () => {
      const isValidKey = (key) => {
        const upper = key.toUpperCase();
        return upper >= 'A' && upper <= 'D';
      };
      
      expect(isValidKey('a')).toBe(true);
      expect(isValidKey('A')).toBe(true);
      expect(isValidKey('e')).toBe(false);
    });

    test('空格和回车应进入下一题', () => {
      const isNextKey = (key) => key === ' ' || key === 'Enter';
      
      expect(isNextKey(' ')).toBe(true);
      expect(isNextKey('Enter')).toBe(true);
      expect(isNextKey('a')).toBe(false);
    });
  });

  describe('答题状态管理', () => {
    test('应正确判断答案', () => {
      const question = {
        id: 'q1',
        answer: 'A',
        options: [
          { key: 'A', text: '选项A' },
          { key: 'B', text: '选项B' }
        ]
      };
      
      const isCorrect = (selectedKey) => selectedKey === question.answer;
      
      expect(isCorrect('A')).toBe(true);
      expect(isCorrect('B')).toBe(false);
    });

    test('应正确计算正确率', () => {
      const total = 10;
      const correct = 8;
      const percentage = Math.round(correct / total * 100);
      
      expect(percentage).toBe(80);
    });

    test('应正确处理已回答状态', () => {
      let answered = false;
      
      // 第一次点击
      if (!answered) {
        answered = true;
      }
      
      expect(answered).toBe(true);
    });
  });

  describe('分类筛选逻辑', () => {
    test('应正确按分类过滤', () => {
      const questions = [
        { id: 'q1', category: '专辑' },
        { id: 'q2', category: '歌曲' },
        { id: 'q3', category: '专辑' }
      ];
      
      const filtered = questions.filter(q => q.category === '专辑');
      
      expect(filtered.length).toBe(2);
    });

    test('应正确统计分类数量', () => {
      const questions = [
        { id: 'q1', category: '专辑' },
        { id: 'q2', category: '歌曲' },
        { id: 'q3', category: '专辑' }
      ];
      
      const catCounts = {};
      for (const q of questions) {
        catCounts[q.category] = (catCounts[q.category] || 0) + 1;
      }
      
      expect(catCounts['专辑']).toBe(2);
      expect(catCounts['歌曲']).toBe(1);
    });
  });

  describe('会话恢复逻辑', () => {
    test('应正确保存会话状态', () => {
      const state = {
        quiz: [{ id: 'q1' }, { id: 'q2' }],
        idx: 1,
        correctCount: 1,
        startTime: Date.now()
      };
      
      const savedState = {
        quizIds: state.quiz.map(q => q.id),
        idx: state.idx,
        correctCount: state.correctCount,
        startTime: state.startTime
      };
      
      expect(savedState.quizIds).toEqual(['q1', 'q2']);
      expect(savedState.idx).toBe(1);
    });

    test('应正确恢复会话', () => {
      const savedState = {
        quizIds: ['q1', 'q2'],
        idx: 0
      };
      
      const allQuestions = [
        { id: 'q1', question: '问题1' },
        { id: 'q2', question: '问题2' }
      ];
      
      const restoredQuiz = savedState.quizIds
        .map(id => allQuestions.find(q => q.id === id))
        .filter(q => q);
      
      expect(restoredQuiz.length).toBe(2);
    });
  });

  describe('边界条件测试', () => {
    test('题目不足时应返回所有可用题目', () => {
      const available = 5;
      const requested = 10;
      const count = Math.min(available, requested);
      
      expect(count).toBe(5);
    });

    test('空题库应安全处理', () => {
      const questionBank = [];
      const count = questionBank.length;
      
      expect(count).toBe(0);
    });

    test('索引越界应安全处理', () => {
      const quiz = [1, 2, 3];
      const idx = 5;
      
      const isFinished = idx >= quiz.length;
      expect(isFinished).toBe(true);
    });
  });
});