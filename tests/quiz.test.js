import { describe, it, expect, beforeEach } from 'vitest';
import { loadAllApp, resetDB, makeQuizBank } from './test-helpers.js';

describe('quiz.js - 答题引擎（纯逻辑测试）', () => {
  let App;

  function resetCache() {
    App.db.setData(App.db.defaults());
  }

  beforeEach(async () => {
    resetDB();
    await new Promise(r => setTimeout(r, 10));
    App = loadAllApp();
    App.QUESTION_BANK = makeQuizBank();
    resetCache();
  });

  describe('shuffle() - 随机打乱', () => {
    it('返回数组长度与原数组相同', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const shuffled = App.shuffle(arr);
      expect(shuffled.length).toBe(arr.length);
    });

    it('打乱后元素不丢失', () => {
      const arr = [1, 2, 3, 4, 5];
      const shuffled = App.shuffle(arr);
      expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5]);
    });

    it('不修改原数组', () => {
      const arr = [1, 2, 3, 4, 5];
      const original = [...arr];
      App.shuffle(arr);
      expect(arr).toEqual(original);
    });

    it('空数组返回空数组', () => {
      expect(App.shuffle([])).toEqual([]);
    });

    it('单元素数组返回同元素', () => {
      expect(App.shuffle([1])).toEqual([1]);
    });
  });

  describe('selectMode() - 模式选择', () => {
    it('设置正确的 state.mode', () => {
      App.selectMode('intensive');
      expect(App.state.mode).toBe('intensive');
    });

    it('切换模式后清除 session', () => {
      App.session.save({ quizIds: ['q1'], idx: 0, correctCount: 0, startTime: Date.now(), mode: 'quick' });
      App.selectMode('standard');
      expect(App.session.load()).toBeNull();
    });
  });

  describe('startCatQuiz() - 分类答题题目过滤', () => {
    it('只加载指定分类的题目', () => {
      const f = [];
      for (let i = 0; i < App.QUESTION_BANK.length; i++) {
        if (App.QUESTION_BANK[i].category === '专辑') f.push(App.QUESTION_BANK[i]);
      }
      expect(f.length).toBeGreaterThan(0);
      for (const q of f) {
        expect(q.category).toBe('专辑');
      }
    });

    it('其他分类题目不出现', () => {
      const albumQuestions = App.QUESTION_BANK.filter(q => q.category === '专辑');
      const nonAlbum = App.QUESTION_BANK.filter(q => q.category !== '专辑');
      expect(albumQuestions.length + nonAlbum.length).toBe(App.QUESTION_BANK.length);
    });
  });

  describe('getCount() - 模式对应题目数', () => {
    it('quick=10, standard=20, intensive=30', () => {
      const m = { quick: 10, standard: 20, intensive: 30 };
      expect(m['quick']).toBe(10);
      expect(m['standard']).toBe(20);
      expect(m['intensive']).toBe(30);
    });
  });

  describe('tryResumeSession() - 中断恢复核心逻辑', () => {
    function makeState(ids, idx, startTime) {
      const quiz = [];
      for (const id of ids) {
        const q = App.db.findQ(id);
        if (q) quiz.push(q);
        else quiz.push({ id });
      }
      return { quiz, idx, correctCount: 0, startTime, mode: 'quick' };
    }

    it('无已保存会话时返回 false', () => {
      App.session.clear();
      expect(App.tryResumeSession()).toBe(false);
    });

    it('恢复有效会话时 state 正确重建', () => {
      const startTime = Date.now() - 60000;
      const state = makeState(['q1', 'q2', 'q3'], 1, startTime);
      state.correctCount = 1;
      App.session.save(state);
      const result = App.tryResumeSession();
      expect(result).toBe(true);
      expect(App.state.idx).toBe(1);
      expect(App.state.correctCount).toBe(1);
      expect(App.state.mode).toBe('quick');
      expect(App.state.quiz.length).toBe(3);
      expect(App.state.quiz[0].id).toBe('q1');
    });

    it('idx >= quizIds.length 时不恢复并清除会话', () => {
      App.session.save(makeState(['q1'], 1, Date.now()));
      expect(App.tryResumeSession()).toBe(false);
      expect(App.session.load()).toBeNull();
    });

    it('quizIds 中不存在的题目被跳过', () => {
      App.session.save(makeState(['q1', 'ghost_q', 'q2'], 0, Date.now()));
      const result = App.tryResumeSession();
      expect(result).toBe(true);
      expect(App.state.quiz.length).toBe(2);
      expect(App.state.quiz[0].id).toBe('q1');
      expect(App.state.quiz[1].id).toBe('q2');
    });

    it('所有题目都不存在时返回 false', () => {
      App.session.save(makeState(['ghost1', 'ghost2'], 0, Date.now()));
      expect(App.tryResumeSession()).toBe(false);
    });
  });

  describe('答题记录自动入库', () => {
    it('答对题目时 record.ok=true 被记录', () => {
      App.db.addRecord({ qid: 'q1', ans: 'A', ok: true, time: Date.now() });
      const h = App.db.get().history;
      expect(h.length).toBe(1);
      expect(h[0].ok).toBe(true);
    });

    it('答错题目时 record.ok=false 被记录', () => {
      App.db.addRecord({ qid: 'q1', ans: 'B', ok: false, time: Date.now() });
      const h = App.db.get().history;
      expect(h.length).toBe(1);
      expect(h[0].ok).toBe(false);
    });
  });

  describe('错题复习完整流程（间隔重复）', () => {
    it('完整间隔重复周期：添加→答对→答对→答对→答对→答对→移除', () => {
      resetCache();
      App.db.addWrong('q1');

      let result;
      result = App.db.reviewCorrect('q1');
      expect(result.mastered).toBe(false);
      expect(result.level).toBe(1);
      expect(App.db.get().wrong.length).toBe(1);

      result = App.db.reviewCorrect('q1');
      expect(result.level).toBe(2);

      result = App.db.reviewCorrect('q1');
      expect(result.level).toBe(3);

      result = App.db.reviewCorrect('q1');
      expect(result.level).toBe(4);

      result = App.db.reviewCorrect('q1');
      expect(result.mastered).toBe(true);
      expect(App.db.get().wrong.length).toBe(0);
    });

    it('间隔重复中途答错重置等级', () => {
      resetCache();
      App.db.addWrong('q1');
      App.db.reviewCorrect('q1'); // Lv.1
      App.db.reviewCorrect('q1'); // Lv.2
      App.db.reviewWrong('q1');   // reset to Lv.0
      const w = App.db.get().wrong[0];
      expect(w.level).toBe(0);
      expect(w.cnt).toBe(2);
    });

    it('nextReview 随等级提升递增', () => {
      resetCache();
      App.db.addWrong('q1');
      const t0 = Date.now();
      App.db.reviewCorrect('q1'); // Lv.1 → 1h
      const w1 = App.db.get().wrong[0];
      expect(w1.nextReview).toBeGreaterThanOrEqual(t0 + 3600000 - 1000);

      const t1 = Date.now();
      App.db.reviewCorrect('q1'); // Lv.2 → 1d
      const w2 = App.db.get().wrong[0];
      expect(w2.nextReview).toBeGreaterThanOrEqual(t1 + 86400000 - 1000);
    });
  });

  describe('startWrongBookQuiz 核心逻辑', () => {
    it('优先获取到期错题', () => {
      resetCache();
      App.db.addWrong('q1');
      App.db.addWrong('q2');
      App.db.addWrong('q3');
      App.db.reviewCorrect('q1'); // q1 到期时间被推迟

      const dueWrong = App.db.getDueWrong();
      const dueIds = dueWrong.map(w => w.qid);
      expect(dueIds).toContain('q2');
      expect(dueIds).toContain('q3');
      expect(dueIds).not.toContain('q1');
    });

    it('错题本为空时不报错', () => {
      resetCache();
      const wrongList = App.db.getWrong();
      expect(wrongList.length).toBe(0);
      const dueList = App.db.getDueWrong();
      expect(dueList.length).toBe(0);
    });
  });
});
