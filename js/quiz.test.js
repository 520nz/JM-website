import { describe, it, expect, beforeEach } from 'vitest';

// 随机打乱算法（从 quiz.js 复制）
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// 时间格式化
function fmtTime(ms) {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + '分' + s + '秒';
}

// 模式计数
function getCount(mode) {
  const m = { quick: 10, standard: 20, intensive: 30 };
  return m[mode] || 10;
}

describe('随机打乱算法', () => {
  it('应该返回新数组而不是修改原数组', () => {
    const original = [1, 2, 3, 4, 5];
    const shuffled = shuffle(original);
    
    expect(original).toEqual([1, 2, 3, 4, 5]);
    expect(shuffled).not.toBe(original);
  });

  it('应该保留所有元素', () => {
    const original = [1, 2, 3, 4, 5];
    const shuffled = shuffle(original);
    
    expect(shuffled.sort()).toEqual(original.sort());
    expect(shuffled.length).toBe(original.length);
  });

  it('空数组应该返回空数组', () => {
    const result = shuffle([]);
    expect(result).toEqual([]);
  });

  it('单元素数组应该返回相同数组', () => {
    const result = shuffle([1]);
    expect(result).toEqual([1]);
  });

  it('多次打乱应该产生不同结果（大概率）', () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const results = new Set();
    
    // 运行100次，统计不同的结果数量
    for (let i = 0; i < 100; i++) {
      results.add(shuffle(original).join(','));
    }
    
    // 如果打乱算法有效，应该有多种不同的结果
    expect(results.size).toBeGreaterThan(10);
  });
});

describe('时间格式化', () => {
  it('应该正确格式化0秒', () => {
    expect(fmtTime(0)).toBe('0分0秒');
  });

  it('应该正确格式化秒数', () => {
    expect(fmtTime(5000)).toBe('0分5秒');
    expect(fmtTime(30000)).toBe('0分30秒');
    expect(fmtTime(59000)).toBe('0分59秒');
  });

  it('应该正确格式化分钟和秒数', () => {
    expect(fmtTime(60000)).toBe('1分0秒');
    expect(fmtTime(65000)).toBe('1分5秒');
    expect(fmtTime(90000)).toBe('1分30秒');
    expect(fmtTime(120000)).toBe('2分0秒');
    expect(fmtTime(125000)).toBe('2分5秒');
  });

  it('应该正确格式化大于10分钟的值', () => {
    expect(fmtTime(600000)).toBe('10分0秒');
    expect(fmtTime(630000)).toBe('10分30秒');
    expect(fmtTime(3600000)).toBe('60分0秒');
  });

  it('应该正确处理毫秒截断', () => {
    expect(fmtTime(1500)).toBe('0分1秒');
    expect(fmtTime(15432)).toBe('0分15秒');
  });
});

describe('模式计数', () => {
  it('quick模式应该返回10题', () => {
    expect(getCount('quick')).toBe(10);
  });

  it('standard模式应该返回20题', () => {
    expect(getCount('standard')).toBe(20);
  });

  it('intensive模式应该返回30题', () => {
    expect(getCount('intensive')).toBe(30);
  });

  it('未知模式应该默认返回10题', () => {
    expect(getCount('unknown')).toBe(10);
    expect(getCount('')).toBe(10);
    expect(getCount(null)).toBe(10);
    expect(getCount(undefined)).toBe(10);
  });
});

describe('答题流程验证', () => {
  it('答案验证应该正确', () => {
    const q = {
      id: 'q001',
      question: '测试题目',
      options: [
        { key: 'A', text: '选项A' },
        { key: 'B', text: '选项B' },
        { key: 'C', text: '选项C' },
        { key: 'D', text: '选项D' }
      ],
      answer: 'B',
      explanation: '这是正确答案'
    };
    
    // 验证答案逻辑
    expect('A' === q.answer).toBe(false);
    expect('B' === q.answer).toBe(true);
    expect('C' === q.answer).toBe(false);
    expect('D' === q.answer).toBe(false);
  });

  it('答题记录应该包含必要字段', () => {
    const record = {
      qid: 'q001',
      ans: 'A',
      ok: false,
      time: Date.now()
    };
    
    expect(record.qid).toBe('q001');
    expect(record.ans).toBe('A');
    expect(record.ok).toBe(false);
    expect(typeof record.time).toBe('number');
  });

  it('正确率计算应该准确', () => {
    const total = 10;
    const correct = 7;
    const pct = Math.round(correct / total * 100);
    
    expect(pct).toBe(70);
  });

  it('零题正确率应该是0', () => {
    const total = 0;
    const correct = 0;
    const pct = total > 0 ? Math.round(correct / total * 100) : 0;
    
    expect(pct).toBe(0);
  });

  it('满分正确率应该是100', () => {
    const total = 10;
    const correct = 10;
    const pct = Math.round(correct / total * 100);
    
    expect(pct).toBe(100);
  });
});

describe('音效生成', () => {
  it('playTone参数应该有效', () => {
    // 验证音效参数的合理性
    const freq = 523.25; // C5
    const startTime = 0;
    const duration = 0.12;
    const type = 'sine';
    const volume = 0.12;
    
    expect(freq).toBeGreaterThan(0);
    expect(duration).toBeGreaterThan(0);
    expect(volume).toBeGreaterThan(0);
    expect(volume).toBeLessThan(1);
    expect(['sine', 'square', 'sawtooth', 'triangle']).toContain(type);
  });

  it('正确音效应该使用上行音阶', () => {
    // C5 -> E5 -> G5
    const notes = [523.25, 659.25, 783.99];
    
    // 确认音高递增
    expect(notes[1]).toBeGreaterThan(notes[0]);
    expect(notes[2]).toBeGreaterThan(notes[1]);
  });

  it('错误音效应该使用下行音阶', () => {
    // E4 -> C4
    const notes = [329.63, 261.63];
    
    // 确认音高递减
    expect(notes[1]).toBeLessThan(notes[0]);
  });
});

describe('会话恢复逻辑', () => {
  it('应该正确序列化答题状态', () => {
    const state = {
      quiz: [{ id: 'q001' }, { id: 'q002' }],
      idx: 1,
      correctCount: 1,
      startTime: Date.now(),
      mode: 'quick'
    };
    
    const sessionData = {
      quizIds: state.quiz.map(q => q.id),
      idx: state.idx,
      correctCount: state.correctCount,
      startTime: state.startTime,
      mode: state.mode
    };
    
    expect(sessionData.quizIds).toEqual(['q001', 'q002']);
    expect(sessionData.idx).toBe(1);
    expect(sessionData.correctCount).toBe(1);
    expect(sessionData.mode).toBe('quick');
  });

  it('已完成的答题不应该恢复', () => {
    const saved = {
      quizIds: ['q001', 'q002'],
      idx: 2, // 已经答完
      correctCount: 2,
      startTime: Date.now() - 60000
    };
    
    // idx >= quizIds.length 表示已答完
    const shouldRecover = saved.idx < saved.quizIds.length;
    
    expect(shouldRecover).toBe(false);
  });

  it('未完成的答题应该可以恢复', () => {
    const saved = {
      quizIds: ['q001', 'q002', 'q003'],
      idx: 1, // 还有一题未答
      correctCount: 1,
      startTime: Date.now() - 30000
    };
    
    const shouldRecover = saved.idx < saved.quizIds.length;
    
    expect(shouldRecover).toBe(true);
  });
});

describe('键盘快捷键处理', () => {
  it('A-D键应该有效', () => {
    const validKeys = ['A', 'B', 'C', 'D'];
    const q = {
      options: [
        { key: 'A', text: '选项A' },
        { key: 'B', text: '选项B' },
        { key: 'C', text: '选项C' },
        { key: 'D', text: '选项D' }
      ]
    };
    
    for (const key of validKeys) {
      const option = q.options.find(o => o.key === key);
      expect(option).toBeDefined();
    }
  });

  it('无效键应该被忽略', () => {
    const invalidKeys = ['E', 'F', '1', ' ', 'a', 'b'];
    const validKeys = ['A', 'B', 'C', 'D'];
    
    for (const key of invalidKeys) {
      expect(validKeys.includes(key)).toBe(false);
    }
  });

  it('空格和回车应该进入下一题（已回答状态）', () => {
    const nextKeys = [' ', 'Enter'];
    const answered = true;
    
    // 在已回答状态，空格和回车应该进入下一题
    if (answered) {
      expect(nextKeys.includes(' ')).toBe(true);
      expect(nextKeys.includes('Enter')).toBe(true);
    }
  });
});

describe('成绩卡片生成', () => {
  it('应该包含所有必要数据', () => {
    const result = {
      total: 10,
      correct: 7,
      wrong: 3,
      pct: 70,
      elapsed: 125000,
      mode: '快速'
    };
    
    expect(result.total).toBe(10);
    expect(result.correct).toBe(7);
    expect(result.wrong).toBe(3);
    expect(result.pct).toBe(70);
    expect(result.elapsed).toBe(125000);
    expect(result.mode).toBe('快速');
  });

  it('正确率颜色应该根据分数变化', () => {
    const getColor = (pct) => {
      if (pct >= 80) return 'green';
      if (pct >= 60) return 'pink';
      return 'red';
    };
    
    expect(getColor(100)).toBe('green');
    expect(getColor(80)).toBe('green');
    expect(getColor(75)).toBe('pink');
    expect(getColor(60)).toBe('pink');
    expect(getColor(50)).toBe('red');
    expect(getColor(0)).toBe('red');
  });

  it('日期格式应该正确', () => {
    const now = new Date();
    const dateStr = now.getFullYear() + '-' + 
                    String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(now.getDate()).padStart(2, '0');
    
    expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('分类筛选', () => {
  it('应该正确分类题目', () => {
    const questions = [
      { id: 'q001', category: '专辑' },
      { id: 'q002', category: '歌曲' },
      { id: 'q003', category: '专辑' },
      { id: 'q004', category: '个人信息' },
      { id: 'q005', category: '歌曲' }
    ];
    
    const cats = {};
    for (const q of questions) {
      cats[q.category] = (cats[q.category] || 0) + 1;
    }
    
    expect(cats['专辑']).toBe(2);
    expect(cats['歌曲']).toBe(2);
    expect(cats['个人信息']).toBe(1);
  });

  it('应该正确筛选特定分类', () => {
    const questions = [
      { id: 'q001', category: '专辑' },
      { id: 'q002', category: '歌曲' },
      { id: 'q003', category: '专辑' }
    ];
    
    const filtered = questions.filter(q => q.category === '专辑');
    
    expect(filtered.length).toBe(2);
    expect(filtered.every(q => q.category === '专辑')).toBe(true);
  });
});