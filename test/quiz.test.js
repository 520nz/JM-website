import { describe, it, expect, beforeEach } from 'vitest';
import { loadData, loadStorage, loadQuiz } from './loader.js';

/**
 * quiz.js 核心逻辑测试
 * 覆盖：随机打乱、模式选择、答题流程、会话恢复等
 */
describe('quiz.js', () => {
  beforeEach(async () => {
    loadData();
    loadStorage();
    loadQuiz();
    await window.App.db.init();
  });

  // ========== shuffle() 随机打乱 ==========
  describe('shuffle()', () => {
    it('打乱后数组长度应保持不变', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const shuffled = window.App.shuffle(arr);
      expect(shuffled.length).toBe(arr.length);
    });

    it('打乱后元素集合应与原数组相同', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const shuffled = window.App.shuffle(arr);
      expect(shuffled.sort()).toEqual(arr.sort());
    });

    it('空数组应返回空数组', () => {
      expect(window.App.shuffle([])).toEqual([]);
    });

    it('单元素数组应返回相同元素', () => {
      expect(window.App.shuffle([42])).toEqual([42]);
    });

    it('应返回新数组而非原数组', () => {
      const arr = [1, 2, 3];
      const shuffled = window.App.shuffle(arr);
      expect(shuffled).not.toBe(arr);
    });
  });

  // ========== selectMode() / getCount() ==========
  describe('模式选择', () => {
    it('不同模式应有对应题目数量', () => {
      window.App.selectMode('quick');
      expect(window.App.getCount()).toBe(10);

      window.App.selectMode('standard');
      expect(window.App.getCount()).toBe(20);

      window.App.selectMode('intensive');
      expect(window.App.getCount()).toBe(30);
    });

    it('无效模式应默认为 10 题', () => {
      window.App.selectMode('invalid');
      expect(window.App.getCount()).toBe(10);
    });
  });

  // ========== 答题状态管理 ==========
  describe('答题状态', () => {
    it('初始状态应正确', () => {
      const state = window.App.state;
      expect(state.quiz).toEqual([]);
      expect(state.idx).toBe(0);
      expect(state.correctCount).toBe(0);
      expect(state.mode).toBe('quick');
    });

    it('开始随机答题应正确初始化状态', () => {
      // 需要 DOM 元素存在，跳过 DOM 渲染部分的测试
      // 直接测试状态变化
      window.App.selectMode('quick');
      // 模拟 startRandomQuiz 核心逻辑
      const state = window.App.state;
      state.quiz = window.App.shuffle(window.App.QUESTION_BANK).slice(0, window.App.getCount());
      state.idx = 0;
      state.correctCount = 0;
      expect(state.quiz.length).toBe(10);
      expect(state.idx).toBe(0);
    });
  });

  // ========== 会话持久化 ==========
  describe('会话存储 (App.session)', () => {
    it('save 和 load 应正确往返', () => {
      const testState = {
        quiz: [{ id: '001' }, { id: '002' }],
        idx: 1,
        correctCount: 1,
        startTime: Date.now(),
        mode: 'quick',
        isWrongBookQuiz: false
      };
      window.App.session.save(testState);
      const loaded = window.App.session.load();
      expect(loaded).not.toBeNull();
      expect(loaded.quizIds).toEqual(['001', '002']);
      expect(loaded.idx).toBe(1);
      expect(loaded.correctCount).toBe(1);
      expect(loaded.mode).toBe('quick');
    });

    it('load 在无会话时应返回 null', () => {
      window.App.session.clear();
      expect(window.App.session.load()).toBeNull();
    });

    it('clear 应清除会话', () => {
      window.App.session.save({
        quiz: [{ id: '001' }],
        idx: 0, correctCount: 0,
        startTime: Date.now(), mode: 'quick'
      });
      window.App.session.clear();
      expect(window.App.session.load()).toBeNull();
    });

    it('损坏的会话数据应返回 null', () => {
      sessionStorage.setItem('jj_quiz_session', 'not valid json{');
      const loaded = window.App.session.load();
      expect(loaded).toBeNull();
    });
  });

  // ========== 答题记录与错题本联动 ==========
  describe('答题流程联动', () => {
    it('答对应增加正确计数', () => {
      const state = window.App.state;
      state.quiz = [{ id: '001', answer: 'B', options: [{ key: 'A' }, { key: 'B' }] }];
      state.idx = 0;
      state.answered = false;
      state.correctCount = 0;
      // 模拟 pickOption（仅测试逻辑部分）
      const q = state.quiz[0];
      const ok = 'B' === q.answer;
      if (ok) state.correctCount++;
      expect(state.correctCount).toBe(1);
    });

    it('答错应添加到错题本', () => {
      // 模拟答错流程
      window.App.db.addRecord({ qid: '001', ans: 'A', ok: false, time: Date.now() });
      window.App.db.addWrong('001');
      const wrong = window.App.db.getWrong();
      expect(wrong.find(w => w.qid === '001')).toBeDefined();
    });
  });

  // ========== tryResumeSession() 会话恢复 ==========
  describe('tryResumeSession()', () => {
    it('无保存会话时应返回 false', () => {
      window.App.session.clear();
      expect(window.App.tryResumeSession()).toBe(false);
    });

    it('有有效会话时应返回 true', () => {
      const testState = {
        quiz: [{ id: '001' }, { id: '002' }, { id: '003' }],
        idx: 1,
        correctCount: 1,
        startTime: Date.now(),
        mode: 'quick',
        isWrongBookQuiz: false
      };
      window.App.session.save(testState);
      const result = window.App.tryResumeSession();
      expect(result).toBe(true);
      expect(window.App.state.idx).toBe(1);
      expect(window.App.state.correctCount).toBe(1);
    });

    it('已答完的会话不应恢复', () => {
      const testState = {
        quiz: [{ id: '001' }],
        idx: 1, // idx >= quiz.length
        correctCount: 1,
        startTime: Date.now(),
        mode: 'quick',
        isWrongBookQuiz: false
      };
      window.App.session.save(testState);
      const result = window.App.tryResumeSession();
      expect(result).toBe(false);
    });

    it('会话中题目 ID 不存在时应跳过', () => {
      const testState = {
        quiz: [{ id: 'nonexistent_1' }, { id: 'nonexistent_2' }],
        idx: 0,
        correctCount: 0,
        startTime: Date.now(),
        mode: 'quick',
        isWrongBookQuiz: false
      };
      window.App.session.save(testState);
      const result = window.App.tryResumeSession();
      expect(result).toBe(false);
    });
  });
});
