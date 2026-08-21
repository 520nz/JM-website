import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadScript, resetAppState } from './helper.js';

// quiz.js 依赖 data.js 与 storage.js
describe('quiz.js - 答题引擎', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="view-practice" class="view active"></div>
      <div id="quizArea"></div>
    `;
    loadScript('js/data.js');
    loadScript('js/storage.js');
    loadScript('js/quiz.js');
    resetAppState();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetAppState();
  });

  describe('App.shuffle - 随机打乱', () => {
    it('应保持元素数量与内容不变', () => {
      const arr = [1, 2, 3, 4, 5];
      const shuffled = window.App.shuffle(arr);
      expect(shuffled).toHaveLength(arr.length);
      expect(shuffled.sort()).toEqual(arr.sort());
      expect(arr).toEqual([1, 2, 3, 4, 5]); // 原数组不被修改
    });

    it('空数组应返回空数组', () => {
      expect(window.App.shuffle([])).toEqual([]);
    });
  });

  describe('App.getCount - 模式题量', () => {
    it('快速模式应返回 10 题', () => {
      window.App.state.mode = 'quick';
      expect(window.App.getCount()).toBe(10);
    });

    it('标准模式应返回 20 题', () => {
      window.App.state.mode = 'standard';
      expect(window.App.getCount()).toBe(20);
    });

    it('强化模式应返回 30 题', () => {
      window.App.state.mode = 'intensive';
      expect(window.App.getCount()).toBe(30);
    });

    it('未知模式应回退为 10 题', () => {
      window.App.state.mode = 'unknown';
      expect(window.App.getCount()).toBe(10);
    });
  });

  describe('App.fmtTime - 用时格式化', () => {
    it('应正确格式化毫秒为分秒', () => {
      expect(window.App.fmtTime(65000)).toBe('1分5秒');
      expect(window.App.fmtTime(0)).toBe('0分0秒');
      expect(window.App.fmtTime(125000)).toBe('2分5秒');
    });
  });

  describe('App.startTimer / stopTimer - 计时器', () => {
    it('启动计时器后应每秒更新 DOM', () => {
      vi.useFakeTimers();
      window.App.state.startTime = Date.now();
      document.getElementById('quizArea').innerHTML = '<span id="timerVal">0:00</span>';
      window.App.startTimer();
      vi.advanceTimersByTime(2500);
      const val = document.getElementById('timerVal').textContent;
      expect(val).toMatch(/^\d+:\d{2}$/);
      expect(parseInt(val.split(':')[0], 10)).toBeGreaterThanOrEqual(0);
      window.App.stopTimer();
    });

    it('停止计时器后不应再更新', () => {
      vi.useFakeTimers();
      window.App.state.startTime = Date.now();
      document.getElementById('quizArea').innerHTML = '<span id="timerVal">0:00</span>';
      window.App.startTimer();
      window.App.stopTimer();
      const before = document.getElementById('timerVal').textContent;
      vi.advanceTimersByTime(2000);
      expect(document.getElementById('timerVal').textContent).toBe(before);
    });
  });

  describe('App.pickOption - 核心答题逻辑', () => {
    beforeEach(() => {
      const q = {
        id: '001',
        category: '专辑',
        question: '林俊杰首张专辑？',
        options: [
          { key: 'A', text: '2003年4月1日' },
          { key: 'B', text: '2003年4月10日' },
          { key: 'C', text: '2003年5月1日' },
          { key: 'D', text: '2003年5月10日' }
        ],
        answer: 'B',
        explanation: '《乐行者》于2003年4月10日发行。'
      };
      window.App.state.quiz = [q];
      window.App.state.idx = 0;
      window.App.state.correctCount = 0;
      window.App.state.answered = false;
      window.App.state.isWrongBookQuiz = false;
      window.App.state.startTime = Date.now();

      // 渲染题目 DOM
      document.getElementById('quizArea').innerHTML =
        '<div id="opt-A" class="option-item"></div>' +
        '<div id="opt-B" class="option-item"></div>' +
        '<div id="opt-C" class="option-item"></div>' +
        '<div id="opt-D" class="option-item"></div>' +
        '<div id="fb" class="feedback"><div id="fbTitle"></div><div id="fbDesc"></div></div>' +
        '<button id="nextBtn" style="display:none;"></button>';
    });

    it('选择正确答案应增加 correctCount 并记录历史', () => {
      window.App.pickOption('B');
      expect(window.App.state.correctCount).toBe(1);
      expect(window.App.state.answered).toBe(true);
      const d = window.App.db.get();
      expect(d.history.length).toBe(1);
      expect(d.history[0].ok).toBe(true);
    });

    it('选择错误答案应加入错题本', () => {
      window.App.pickOption('A');
      expect(window.App.state.correctCount).toBe(0);
      const d = window.App.db.get();
      expect(d.history[0].ok).toBe(false);
      expect(d.wrong.length).toBe(1);
      expect(d.wrong[0].qid).toBe('001');
    });

    it('错题复习模式下答对应提升掌握等级', () => {
      window.App.db.addWrong('001');
      window.App.state.isWrongBookQuiz = true;
      window.App.pickOption('B');
      const w = window.App.db.getWrong()[0];
      expect(w.level).toBe(1);
    });

    it('错题复习模式下答错应重置等级', () => {
      window.App.db.addWrong('001');
      window.App.db.reviewCorrect('001'); // level 1
      window.App.state.isWrongBookQuiz = true;
      window.App.pickOption('A');
      const w = window.App.db.getWrong()[0];
      expect(w.level).toBe(0);
    });

    it('重复选择应被忽略', () => {
      window.App.pickOption('B');
      const firstCount = window.App.state.correctCount;
      window.App.pickOption('B');
      expect(window.App.state.correctCount).toBe(firstCount);
      expect(window.App.db.get().history.length).toBe(1);
    });
  });

  describe('App.tryResumeSession - 中断恢复', () => {
    it('应能根据保存的会话 ID 重建答题列表', () => {
      window.App.session.save({
        quiz: [{ id: '001' }, { id: '002' }],
        idx: 1,
        correctCount: 1,
        startTime: Date.now() - 5000,
        mode: 'quick',
        isWrongBookQuiz: false
      });
      const ok = window.App.tryResumeSession();
      expect(ok).toBe(true);
      expect(window.App.state.quiz.length).toBe(2);
      expect(window.App.state.idx).toBe(1);
    });

    it('已完成的会话不应恢复', () => {
      window.App.session.save({
        quiz: [{ id: '001' }],
        idx: 1,
        correctCount: 1,
        startTime: Date.now(),
        mode: 'quick'
      });
      const ok = window.App.tryResumeSession();
      expect(ok).toBe(false);
    });

    it('无会话时应返回 false', () => {
      window.App.session.clear();
      expect(window.App.tryResumeSession()).toBe(false);
    });
  });
});
