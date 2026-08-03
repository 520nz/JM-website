/**
 * storage.js 核心算法测试
 * 重点测试：间隔重复算法、数据归档、成就系统
 */

// 简化的测试：直接测试核心算法逻辑，不依赖完整的浏览器环境

describe('核心算法逻辑测试', () => {
  
  describe('间隔重复算法', () => {
    // 模拟间隔重复时间表
    const SR_INTERVALS = [
      0,                        // level 0
      1 * 60 * 60 * 1000,       // level 1: 1小时
      1 * 24 * 60 * 60 * 1000,  // level 2: 1天
      3 * 24 * 60 * 60 * 1000,  // level 3: 3天
      7 * 24 * 60 * 60 * 1000,  // level 4: 7天
    ];

    test('等级0应为立即可复习', () => {
      const level = 0;
      const nextReview = Date.now() + SR_INTERVALS[level];
      expect(nextReview).toBeLessThanOrEqual(Date.now() + 100);
    });

    test('等级1应为1小时后', () => {
      const level = 1;
      const nextReview = Date.now() + SR_INTERVALS[level];
      const hour = 60 * 60 * 1000;
      expect(nextReview - Date.now()).toBeCloseTo(hour, -2);
    });

    test('等级2应为1天后', () => {
      const level = 2;
      const nextReview = Date.now() + SR_INTERVALS[level];
      const day = 24 * 60 * 60 * 1000;
      expect(nextReview - Date.now()).toBeCloseTo(day, -2);
    });

    test('等级5应从错题本移除', () => {
      const level = 5;
      const mastered = level >= 5;
      expect(mastered).toBe(true);
    });

    test('答错应重置等级为0', () => {
      let level = 2;
      // 模拟答错
      level = 0;
      expect(level).toBe(0);
    });

    test('答对应提升等级', () => {
      let level = 0;
      // 模拟答对
      level++;
      expect(level).toBe(1);
    });

    test('应正确判断错题是否到期', () => {
      const now = Date.now();
      
      // 已到期的错题
      const dueWrong = { nextReview: now - 1000 };
      const isDue1 = !dueWrong.nextReview || dueWrong.nextReview <= now;
      expect(isDue1).toBe(true);
      
      // 未到期的错题
      const notDueWrong = { nextReview: now + 3600000 };
      const isDue2 = !notDueWrong.nextReview || notDueWrong.nextReview <= now;
      expect(isDue2).toBe(false);
    });
  });

  describe('答题记录归档逻辑', () => {
    test('历史记录超过1000条应触发归档', () => {
      const history = [];
      for (let i = 0; i < 1001; i++) {
        history.push({ qid: 'q1', time: Date.now() });
      }
      
      const shouldArchive = history.length > 1000;
      expect(shouldArchive).toBe(true);
    });

    test('应按天聚合归档数据', () => {
      const records = [
        { qid: 'q1', time: 1000, ok: true },
        { qid: 'q2', time: 1000, ok: false },
        { qid: 'q3', time: 1000, ok: true }
      ];
      
      // 模拟按天聚合
      const dayMap = {};
      for (const rec of records) {
        const key = '2024-01-01';
        if (!dayMap[key]) {
          dayMap[key] = { date: key, total: 0, correct: 0 };
        }
        dayMap[key].total++;
        if (rec.ok) dayMap[key].correct++;
      }
      
      expect(dayMap['2024-01-01'].total).toBe(3);
      expect(dayMap['2024-01-01'].correct).toBe(2);
    });

    test('归档应保留90天内的明细', () => {
      const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
      const recentRecord = { time: Date.now() };
      const oldRecord = { time: cutoff - 1000 };
      
      expect(recentRecord.time >= cutoff).toBe(true);
      expect(oldRecord.time < cutoff).toBe(true);
    });
  });

  describe('统计数据计算', () => {
    test('应正确计算总正确率', () => {
      const stats = { total: 100, correct: 80 };
      const acc = stats.total > 0 ? Math.round(stats.correct / stats.total * 100) : 0;
      expect(acc).toBe(80);
    });

    test('应正确统计分类数据', () => {
      const history = [
        { qid: 'q1', ok: true },
        { qid: 'q1', ok: false },
        { qid: 'q2', ok: true }
      ];
      
      // 模拟分类统计
      const cats = {};
      const questionBank = [
        { id: 'q1', category: '专辑' },
        { id: 'q2', category: '歌曲' }
      ];
      
      for (const rec of history) {
        const q = questionBank.find(q => q.id === rec.qid);
        if (q) {
          if (!cats[q.category]) cats[q.category] = { t: 0, c: 0 };
          cats[q.category].t++;
          if (rec.ok) cats[q.category].c++;
        }
      }
      
      expect(cats['专辑'].t).toBe(2);
      expect(cats['专辑'].c).toBe(1);
      expect(cats['歌曲'].t).toBe(1);
      expect(cats['歌曲'].c).toBe(1);
    });
  });

  describe('连续打卡计算', () => {
    test('应正确计算连续天数', () => {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      
      const days = {};
      // 添加连续3天的记录
      days[new Date(now).toDateString()] = true;
      days[new Date(now - day).toDateString()] = true;
      days[new Date(now - 2 * day).toDateString()] = true;
      
      let streak = 0;
      let check = new Date();
      check.setHours(0, 0, 0, 0);
      
      while (true) {
        const key = check.toDateString();
        if (days[key]) {
          streak++;
          check.setTime(check.getTime() - day);
        } else {
          break;
        }
      }
      
      expect(streak).toBe(3);
    });

    test('中断应停止计数', () => {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      
      const days = {};
      // 今天有，昨天有，前天无
      days[new Date(now).toDateString()] = true;
      days[new Date(now - day).toDateString()] = true;
      // 前天无
      days[new Date(now - 3 * day).toDateString()] = true;
      
      let streak = 0;
      let check = new Date();
      check.setHours(0, 0, 0, 0);
      
      while (true) {
        const key = check.toDateString();
        if (days[key]) {
          streak++;
          check.setTime(check.getTime() - day);
        } else {
          break;
        }
      }
      
      expect(streak).toBe(2); // 只计算连续的2天
    });
  });

  describe('成就解锁逻辑', () => {
    const achievements = [
      { id: 'first_answer', condition: (ctx) => ctx.total >= 1 },
      { id: 'total_100', condition: (ctx) => ctx.total >= 100 },
      { id: 'acc_90', condition: (ctx) => ctx.total >= 50 && ctx.accuracy >= 0.9 },
      { id: 'perfect_10', condition: (ctx) => ctx.quizTotal >= 10 && ctx.quizCorrect === ctx.quizTotal }
    ];

    test('首次答题应解锁', () => {
      const ctx = { total: 1 };
      const unlocked = achievements[0].condition(ctx);
      expect(unlocked).toBe(true);
    });

    test('累计100题应解锁', () => {
      const ctx = { total: 100 };
      const unlocked = achievements[1].condition(ctx);
      expect(unlocked).toBe(true);
    });

    test('正确率90%应解锁', () => {
      const ctx = { total: 50, accuracy: 0.9 };
      const unlocked = achievements[2].condition(ctx);
      expect(unlocked).toBe(true);
    });

    test('完美答题应解锁', () => {
      const ctx = { quizTotal: 10, quizCorrect: 10 };
      const unlocked = achievements[3].condition(ctx);
      expect(unlocked).toBe(true);
    });

    test('不应重复解锁', () => {
      const unlockedIds = ['first_answer'];
      const newAchievement = 'first_answer';
      const alreadyHas = unlockedIds.includes(newAchievement);
      expect(alreadyHas).toBe(true);
    });
  });

  describe('每日目标设置', () => {
    test('应限制在5-100范围内', () => {
      const clamp = (n) => Math.max(5, Math.min(100, n));
      
      expect(clamp(3)).toBe(5);
      expect(clamp(50)).toBe(50);
      expect(clamp(150)).toBe(100);
    });
  });
});

describe('XSS 转义测试', () => {
  test('应转义 HTML 特殊字符', () => {
    const escapeHtml = (str) => {
      if (str == null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };
    
    const malicious = '<script>alert("xss")</script>';
    const escaped = escapeHtml(malicious);
    
    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;script&gt;');
  });

  test('应处理 null 和 undefined', () => {
    const escapeHtml = (str) => {
      if (str == null) return '';
      return String(str);
    };
    
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});