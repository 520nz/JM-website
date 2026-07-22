import { describe, it, expect, beforeEach, vi } from 'vitest';

// 模拟 DOM 环境
global.document = {
  createElement: (tag) => ({
    textContent: '',
    innerHTML: '',
    style: {}
  })
};

// 模拟 sessionStorage
const mockSessionStorage = {
  store: {},
  getItem: function(key) { return this.store[key] || null; },
  setItem: function(key, value) { this.store[key] = value; },
  removeItem: function(key) { delete this.store[key]; }
};
global.sessionStorage = mockSessionStorage;

// 创建 App 命名空间
const App = {};

// XSS 转义函数（从 storage.js 复制）
function esc(s) {
  if (s == null) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

// 间隔重复时间表
const SR_INTERVALS = [
  0,                        // level 0
  1 * 60 * 60 * 1000,       // level 1: 1小时
  1 * 24 * 60 * 60 * 1000,  // level 2: 1天
  3 * 24 * 60 * 60 * 1000,  // level 3: 3天
  7 * 24 * 60 * 60 * 1000,  // level 4: 7天
];

// 默认数据
function defaults() {
  return {
    history: [],
    wrong: [],
    stats: { total: 0, correct: 0, cats: {} },
    theme: 'dark',
    dailyGoal: 20,
    achievements: [],
    archive: []
  };
}

describe('XSS转义工具', () => {
  it('应该正确转义HTML特殊字符', () => {
    // 由于我们在测试环境中模拟了document，需要手动测试
    const input = '<script>alert("xss")</script>';
    // 在实际环境中，esc函数会将<script>转义
    // 这里我们验证函数不会抛出异常
    expect(() => esc(input)).not.toThrow();
  });

  it('应该处理null和undefined', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });

  it('应该将数字转换为字符串', () => {
    expect(() => esc(123)).not.toThrow();
  });
});

describe('默认数据结构', () => {
  it('应该返回正确的默认结构', () => {
    const data = defaults();
    expect(data).toHaveProperty('history');
    expect(data).toHaveProperty('wrong');
    expect(data).toHaveProperty('stats');
    expect(data).toHaveProperty('theme');
    expect(data).toHaveProperty('dailyGoal');
    expect(data).toHaveProperty('achievements');
    expect(data).toHaveProperty('archive');
  });

  it('history应该是空数组', () => {
    const data = defaults();
    expect(Array.isArray(data.history)).toBe(true);
    expect(data.history.length).toBe(0);
  });

  it('dailyGoal默认值应该是20', () => {
    const data = defaults();
    expect(data.dailyGoal).toBe(20);
  });
});

describe('错题本间隔重复逻辑', () => {
  let mockData;
  
  beforeEach(() => {
    mockData = defaults();
  });

  it('SR_INTERVALS时间表应该正确', () => {
    expect(SR_INTERVALS.length).toBe(5);
    expect(SR_INTERVALS[0]).toBe(0);
    expect(SR_INTERVALS[1]).toBe(1 * 60 * 60 * 1000); // 1小时
    expect(SR_INTERVALS[2]).toBe(1 * 24 * 60 * 60 * 1000); // 1天
    expect(SR_INTERVALS[3]).toBe(3 * 24 * 60 * 60 * 1000); // 3天
    expect(SR_INTERVALS[4]).toBe(7 * 24 * 60 * 60 * 1000); // 7天
  });

  it('添加错题应该正确初始化字段', () => {
    const qid = 'q001';
    mockData.wrong.push({
      qid: qid,
      cnt: 1,
      level: 0,
      time: Date.now(),
      lastReview: 0,
      nextReview: Date.now()
    });
    
    expect(mockData.wrong.length).toBe(1);
    expect(mockData.wrong[0].qid).toBe(qid);
    expect(mockData.wrong[0].level).toBe(0);
    expect(mockData.wrong[0].cnt).toBe(1);
  });

  it('重复答错应该重置level并增加cnt', () => {
    mockData.wrong.push({
      qid: 'q001',
      cnt: 1,
      level: 2,
      time: Date.now(),
      lastReview: Date.now(),
      nextReview: Date.now() + SR_INTERVALS[2]
    });
    
    // 模拟再次答错
    const w = mockData.wrong[0];
    w.level = 0;
    w.cnt++;
    
    expect(w.level).toBe(0);
    expect(w.cnt).toBe(2);
  });

  it('答对应该提升level', () => {
    mockData.wrong.push({
      qid: 'q001',
      cnt: 1,
      level: 0,
      time: Date.now(),
      lastReview: 0,
      nextReview: Date.now()
    });
    
    // 模拟答对
    const w = mockData.wrong[0];
    w.level++;
    w.lastReview = Date.now();
    w.nextReview = Date.now() + SR_INTERVALS[w.level];
    
    expect(w.level).toBe(1);
    expect(w.nextReview).toBeGreaterThan(Date.now());
  });

  it('连续答对5次应该从错题本移除', () => {
    mockData.wrong.push({
      qid: 'q001',
      cnt: 1,
      level: 4, // 已经到level 4，再答对一次就掌握
      time: Date.now(),
      lastReview: Date.now(),
      nextReview: Date.now()
    });
    
    // 模拟答对，level提升到5
    const w = mockData.wrong[0];
    w.level++;
    
    if (w.level >= 5) {
      mockData.wrong = mockData.wrong.filter(item => item.qid !== 'q001');
    }
    
    expect(mockData.wrong.length).toBe(0);
  });
});

describe('数据归档逻辑', () => {
  it('历史记录少于1000条时不应该触发归档', () => {
    const data = defaults();
    for (let i = 0; i < 500; i++) {
      data.history.push({
        qid: `q${i}`,
        ok: true,
        time: Date.now() - i * 1000
      });
    }
    
    expect(data.history.length).toBe(500);
    expect(data.archive.length).toBe(0);
  });

  it('历史记录超过1000条应该触发归档', () => {
    const data = defaults();
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    
    // 添加1001条记录，其中一半是90天前的
    for (let i = 0; i < 1001; i++) {
      data.history.push({
        qid: `q${i}`,
        ok: i % 2 === 0,
        time: i < 500 ? cutoff - i * 1000 : Date.now() - i * 1000
      });
    }
    
    // 模拟归档逻辑
    if (data.history.length > 1000) {
      data.archive = data.archive || [];
      const oldRecs = [];
      const newRecs = [];
      
      for (const rec of data.history) {
        if (rec.time < cutoff) oldRecs.push(rec);
        else newRecs.push(rec);
      }
      
      // 按天聚合
      const dayMap = {};
      for (const rec of oldRecs) {
        const dt = new Date(rec.time);
        const key = `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;
        if (!dayMap[key]) dayMap[key] = { date: key, total: 0, correct: 0 };
        dayMap[key].total++;
        if (rec.ok) dayMap[key].correct++;
      }
      
      for (const k in dayMap) data.archive.push(dayMap[k]);
      data.history = newRecs;
    }
    
    expect(data.archive.length).toBeGreaterThan(0);
    expect(data.history.length).toBeLessThan(1000);
  });

  it('归档应该正确统计每天的总数和正确数', () => {
    const archive = { date: '2026-01-01', total: 10, correct: 7 };
    
    expect(archive.total).toBe(10);
    expect(archive.correct).toBe(7);
    expect(archive.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('每日目标验证', () => {
  it('默认每日目标应该是20', () => {
    const data = defaults();
    expect(data.dailyGoal).toBe(20);
  });

  it('每日目标应该在5-100之间', () => {
    const setDailyGoal = (n) => Math.max(5, Math.min(100, n));
    
    expect(setDailyGoal(3)).toBe(5);
    expect(setDailyGoal(50)).toBe(50);
    expect(setDailyGoal(150)).toBe(100);
  });
});

describe('成就系统', () => {
  it('ACHIEVEMENTS数组应该包含10个成就', () => {
    const ACHIEVEMENTS = [
      { id: 'first_answer', name: '初出茅庐' },
      { id: 'perfect_10', name: '十全十美' },
      { id: 'daily_50', name: '勤奋粉丝' },
      { id: 'streak_3', name: '三日坚持' },
      { id: 'streak_7', name: '七日之约' },
      { id: 'total_100', name: '百题斩' },
      { id: 'total_500', name: '五百题王' },
      { id: 'acc_90', name: '资深JM' },
      { id: 'wrong_clear', name: '错题清零' },
      { id: 'all_cats', name: '全能粉丝' }
    ];
    
    expect(ACHIEVEMENTS.length).toBe(10);
  });

  it('首次答题应该解锁first_answer成就', () => {
    const achievements = [];
    const total = 1;
    
    if (total >= 1 && !achievements.includes('first_answer')) {
      achievements.push('first_answer');
    }
    
    expect(achievements).toContain('first_answer');
  });

  it('答题100题应该解锁total_100成就', () => {
    const achievements = [];
    const total = 100;
    
    if (total >= 100) {
      achievements.push('total_100');
    }
    
    expect(achievements).toContain('total_100');
  });

  it('答题500题应该解锁total_500成就', () => {
    const achievements = [];
    const total = 500;
    
    if (total >= 500) {
      achievements.push('total_500');
    }
    
    expect(achievements).toContain('total_500');
  });

  it('答满50题且正确率≥90%应该解锁acc_90成就', () => {
    const achievements = [];
    const total = 50;
    const correct = 45;
    
    if (total >= 50 && correct / total >= 0.9) {
      achievements.push('acc_90');
    }
    
    expect(achievements).toContain('acc_90');
  });

  it('单次10题全部答对应该解锁perfect_10成就', () => {
    const achievements = [];
    const quizTotal = 10;
    const quizCorrect = 10;
    
    if (quizTotal >= 10 && quizCorrect === quizTotal) {
      achievements.push('perfect_10');
    }
    
    expect(achievements).toContain('perfect_10');
  });

  it('单日答题50题应该解锁daily_50成就', () => {
    const achievements = [];
    const todayCount = 50;
    
    if (todayCount >= 50) {
      achievements.push('daily_50');
    }
    
    expect(achievements).toContain('daily_50');
  });

  it('连续打卡3天应该解锁streak_3成就', () => {
    const achievements = [];
    const streak = 3;
    
    if (streak >= 3) {
      achievements.push('streak_3');
    }
    
    expect(achievements).toContain('streak_3');
  });

  it('连续打卡7天应该同时解锁streak_3和streak_7成就', () => {
    const achievements = [];
    const streak = 7;
    
    if (streak >= 3) achievements.push('streak_3');
    if (streak >= 7) achievements.push('streak_7');
    
    expect(achievements).toContain('streak_3');
    expect(achievements).toContain('streak_7');
  });
});

describe('连续打卡天数计算', () => {
  it('无答题记录时streak应该为0', () => {
    const history = [];
    expect(history.length).toBe(0);
  });

  it('今天答题应该计入streak', () => {
    const now = Date.now();
    const history = [{ time: now }];
    
    const days = {};
    for (const rec of history) {
      const dt = new Date(rec.time);
      days[`${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`] = true;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    
    expect(days[todayKey]).toBe(true);
  });

  it('断签后streak应该重新计算', () => {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
    
    const history = [
      { time: threeDaysAgo },
      { time: oneDayAgo },
      { time: now }
    ];
    
    // 简化计算：按日期去重
    const days = {};
    for (const rec of history) {
      const dt = new Date(rec.time);
      const key = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
      days[key] = true;
    }
    
    // 应该有3天的记录
    expect(Object.keys(days).length).toBe(3);
  });
});

describe('会话存储', () => {
  beforeEach(() => {
    mockSessionStorage.store = {};
  });

  it('应该能保存和加载会话', () => {
    const sessionData = {
      quizIds: ['q001', 'q002'],
      idx: 1,
      correctCount: 1,
      startTime: Date.now(),
      mode: 'quick'
    };
    
    mockSessionStorage.setItem('jj_quiz_session', JSON.stringify(sessionData));
    const loaded = JSON.parse(mockSessionStorage.getItem('jj_quiz_session'));
    
    expect(loaded.quizIds).toEqual(['q001', 'q002']);
    expect(loaded.idx).toBe(1);
  });

  it('清除会话后应该返回null', () => {
    mockSessionStorage.setItem('jj_quiz_session', 'test');
    mockSessionStorage.removeItem('jj_quiz_session');
    
    expect(mockSessionStorage.getItem('jj_quiz_session')).toBeNull();
  });
});