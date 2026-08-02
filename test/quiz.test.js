/**
 * quiz.test.js - 答题引擎核心逻辑测试
 * 
 * 覆盖范围：
 * - shuffle() 随机打乱算法
 * - fmtTime() 时间格式化
 * - getCount() 答题数量计算
 * - pickOption() 选项选择逻辑（状态变更部分）
 * - 会话恢复逻辑（tryResumeSession 的核心数据重建）
 * - 键盘快捷键处理
 */

// ==================== shuffle() 随机打乱 ====================
describe('shuffle() - 随机打乱', () => {
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  test('空数组返回空数组', () => {
    expect(shuffle([])).toEqual([]);
  });

  test('单元素数组返回相同元素', () => {
    var result = shuffle([1]);
    expect(result).toHaveLength(1);
    expect(result).toContain(1);
  });

  test('数组长度保持不变', () => {
    var arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    var result = shuffle(arr);
    expect(result).toHaveLength(arr.length);
  });

  test('打乱后元素集合不变（未丢失未新增）', () => {
    var arr = [1, 2, 3, 4, 5];
    var result = shuffle(arr);
    expect(result.sort()).toEqual(arr);
  });

  test('多次调用可能产生不同顺序（不严格断言，但验证函数可运行）', () => {
    var arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    var r1 = shuffle(arr);
    var r2 = shuffle(arr);
    // 验证都包含相同元素（数字排序需指定比较函数）
    expect(r1.sort(function(a, b) { return a - b; })).toEqual(arr);
    expect(r2.sort(function(a, b) { return a - b; })).toEqual(arr);
  });

  test('不修改原数组', () => {
    var arr = [1, 2, 3, 4, 5];
    var copy = arr.slice();
    shuffle(arr);
    expect(arr).toEqual(copy);
  });

  test('大量元素打乱后仍包含所有元素', () => {
    var arr = [];
    for (var i = 0; i < 100; i++) arr.push(i);
    var result = shuffle(arr);
    expect(result).toHaveLength(100);
    expect(result.sort(function(a, b) { return a - b; })).toEqual(arr);
  });
});

// ==================== fmtTime() 时间格式化 ====================
describe('fmtTime() - 时间格式化', () => {
  function fmtTime(ms) {
    var sec = Math.floor(ms / 1000);
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + '分' + s + '秒';
  }

  test('零毫秒', () => {
    expect(fmtTime(0)).toBe('0分0秒');
  });

  test('仅秒数（不足1分钟）', () => {
    expect(fmtTime(5000)).toBe('0分5秒');
    expect(fmtTime(59000)).toBe('0分59秒');
  });

  test('包含分钟', () => {
    expect(fmtTime(60000)).toBe('1分0秒');
    expect(fmtTime(90000)).toBe('1分30秒');
  });

  test('超过1分钟的情况', () => {
    expect(fmtTime(125000)).toBe('2分5秒');
    expect(fmtTime(3661000)).toBe('61分1秒');
  });

  test('毫秒部分被忽略', () => {
    expect(fmtTime(5500)).toBe('0分5秒');  // 5.5秒 → 5秒
  });
});

// ==================== getCount() 答题数量计算 ====================
describe('getCount() - 答题数量计算', () => {
  function getCount(mode) {
    var m = { quick: 10, standard: 20, intensive: 30 };
    return m[mode] || 10;
  }

  test('快速模式返回 10', () => {
    expect(getCount('quick')).toBe(10);
  });

  test('标准模式返回 20', () => {
    expect(getCount('standard')).toBe(20);
  });

  test('强化模式返回 30', () => {
    expect(getCount('intensive')).toBe(30);
  });

  test('未知模式默认返回 10', () => {
    expect(getCount('unknown')).toBe(10);
    expect(getCount('')).toBe(10);
    expect(getCount(null)).toBe(10);
  });
});

// ==================== pickOption() 选项选择状态变更 ====================
describe('pickOption() - 选项选择逻辑', () => {
  // 简化版：仅测试状态变更逻辑（不含 DOM 操作）
  function createState() {
    return {
      quiz: [
        { id: '001', answer: 'B' },
        { id: '002', answer: 'C' }
      ],
      idx: 0,
      answered: false,
      correctCount: 0,
      mode: 'quick',
      isWrongBookQuiz: false
    };
  }

  function pickOption(state, key, addRecordFn, addWrongFn, reviewCorrectFn, reviewWrongFn) {
    if (state.answered) return { alreadyAnswered: true };
    state.answered = true;
    var q = state.quiz[state.idx];
    var ok = (key === q.answer);
    if (ok) state.correctCount++;

    // 记录答题
    addRecordFn({ qid: q.id, ans: key, ok: ok, time: Date.now() });

    // 错题本复习模式
    var reviewResult = null;
    if (state.isWrongBookQuiz) {
      if (ok) {
        reviewResult = reviewCorrectFn(q.id);
      } else {
        reviewWrongFn(q.id);
      }
    } else {
      if (!ok) addWrongFn(q.id);
    }

    return { ok: ok, reviewResult: reviewResult };
  }

  test('首次回答正确', () => {
    var state = createState();
    var records = [];
    var wrong = [];
    var result = pickOption(state, 'B',
      function(r) { records.push(r); },
      function(qid) { wrong.push(qid); },
      function() { return null; },
      function() {}
    );
    expect(result.ok).toBe(true);
    expect(state.correctCount).toBe(1);
    expect(state.answered).toBe(true);
    expect(records).toHaveLength(1);
    expect(wrong).toHaveLength(0);
  });

  test('首次回答错误，加入错题本', () => {
    var state = createState();
    var records = [];
    var wrong = [];
    var result = pickOption(state, 'A',
      function(r) { records.push(r); },
      function(qid) { wrong.push(qid); },
      function() { return null; },
      function() {}
    );
    expect(result.ok).toBe(false);
    expect(state.correctCount).toBe(0);
    expect(wrong).toHaveLength(1);
    expect(wrong[0]).toBe('001');
  });

  test('已回答后不能再次选择', () => {
    var state = createState();
    pickOption(state, 'B', function() {}, function() {}, function() { return null; }, function() {});
    var result = pickOption(state, 'C', function() {}, function() {}, function() { return null; }, function() {});
    expect(result.alreadyAnswered).toBe(true);
    expect(state.correctCount).toBe(1); // 不变
  });

  test('错题本复习模式 - 答对', () => {
    var state = createState();
    state.isWrongBookQuiz = true;
    var records = [];
    var wrong = [];
    var reviewCalls = [];
    var result = pickOption(state, 'B',
      function(r) { records.push(r); },
      function(qid) { wrong.push(qid); },
      function(qid) { reviewCalls.push({ action: 'correct', qid: qid }); return { mastered: false, level: 1 }; },
      function(qid) { reviewCalls.push({ action: 'wrong', qid: qid }); }
    );
    expect(result.ok).toBe(true);
    expect(reviewCalls).toHaveLength(1);
    expect(reviewCalls[0].action).toBe('correct');
    expect(wrong).toHaveLength(0); // 错题本模式答错不会加入错题
  });

  test('错题本复习模式 - 答错', () => {
    var state = createState();
    state.isWrongBookQuiz = true;
    var reviewCalls = [];
    var result = pickOption(state, 'A',
      function() {},
      function() {},
      function(qid) { reviewCalls.push({ action: 'correct', qid: qid }); return null; },
      function(qid) { reviewCalls.push({ action: 'wrong', qid: qid }); }
    );
    expect(result.ok).toBe(false);
    expect(reviewCalls).toHaveLength(1);
    expect(reviewCalls[0].action).toBe('wrong');
  });

  test('答对并掌握（错题本复习模式 level≥5）', () => {
    var state = createState();
    state.isWrongBookQuiz = true;
    var result = pickOption(state, 'B',
      function() {},
      function() {},
      function(qid) { return { mastered: true, qid: qid }; },
      function() {}
    );
    expect(result.reviewResult.mastered).toBe(true);
  });
});

// ==================== 会话恢复逻辑 ====================
describe('tryResumeSession() - 会话数据重建', () => {
  function tryResumeSession(saved, findQFn) {
    if (!saved || !saved.quizIds || saved.quizIds.length === 0) return null;

    var qs = [];
    for (var i = 0; i < saved.quizIds.length; i++) {
      var q = findQFn(saved.quizIds[i]);
      if (q) qs.push(q);
    }
    if (qs.length === 0) return null;

    var result = {
      quiz: qs,
      idx: saved.idx || 0,
      correctCount: saved.correctCount || 0,
      mode: saved.mode || 'quick',
      isWrongBookQuiz: false
    };

    if (result.idx >= result.quiz.length) {
      return null; // 已完成
    }

    return result;
  }

  test('无保存数据返回 null', () => {
    expect(tryResumeSession(null, function() {})).toBeNull();
    expect(tryResumeSession(undefined, function() {})).toBeNull();
  });

  test('空 quizIds 返回 null', () => {
    expect(tryResumeSession({ quizIds: [] }, function() {})).toBeNull();
  });

  test('quizIds 都找不到对应题目返回 null', () => {
    var result = tryResumeSession(
      { quizIds: ['999', '998'], idx: 0, correctCount: 0 },
      function() { return null; }
    );
    expect(result).toBeNull();
  });

  test('重建会话成功', () => {
    var saved = { quizIds: ['001', '002'], idx: 1, correctCount: 0, mode: 'standard', startTime: Date.now() };
    var result = tryResumeSession(saved, function(qid) {
      return { id: qid, question: 'Q' + qid, answer: 'A' };
    });
    expect(result).not.toBeNull();
    expect(result.quiz).toHaveLength(2);
    expect(result.idx).toBe(1);
    expect(result.mode).toBe('standard');
  });

  test('已完成的会话返回 null', () => {
    var saved = { quizIds: ['001'], idx: 1, correctCount: 1, mode: 'quick' };
    var result = tryResumeSession(saved, function(qid) {
      return { id: qid };
    });
    expect(result).toBeNull();
  });

  test('idx 未定义时默认为 0', () => {
    var saved = { quizIds: ['001'], correctCount: 0, mode: 'quick' };
    var result = tryResumeSession(saved, function(qid) { return { id: qid }; });
    expect(result.idx).toBe(0);
  });

  test('部分题目找不到时仍可恢复', () => {
    var saved = { quizIds: ['001', '999'], idx: 0, correctCount: 0, mode: 'quick' };
    var result = tryResumeSession(saved, function(qid) {
      return qid === '001' ? { id: qid } : null;
    });
    expect(result.quiz).toHaveLength(1);
    expect(result.quiz[0].id).toBe('001');
  });
});

// ==================== 键盘快捷键 ====================
describe('handleQuizKeydown() - 键盘快捷键处理', () => {
  function handleQuizKeydown(e, state, onPickOption, onNextQ) {
    // 未回答时，按 A/B/C/D 选择
    if (!state.answered) {
      var key = e.key.toUpperCase();
      if (key >= 'A' && key <= 'D') {
        onPickOption(key);
        return { handled: true, action: 'pick' };
      }
      return { handled: false };
    }

    // 已回答，空格/回车进入下一题
    if (e.key === ' ' || e.key === 'Enter') {
      onNextQ();
      return { handled: true, action: 'next' };
    }

    return { handled: false };
  }

  test('未回答时按 A 选择选项', () => {
    var state = { answered: false, quiz: [{ options: [{ key: 'A' }] }], idx: 0 };
    var picked = null;
    var result = handleQuizKeydown({ key: 'a', preventDefault: function() {} }, state,
      function(k) { picked = k; }, function() {});
    expect(result.handled).toBe(true);
    expect(result.action).toBe('pick');
    expect(picked).toBe('A');
  });

  test('未回答时按 B 选择选项', () => {
    var state = { answered: false };
    var picked = null;
    handleQuizKeydown({ key: 'b', preventDefault: function() {} }, state,
      function(k) { picked = k; }, function() {});
    expect(picked).toBe('B');
  });

  test('已回答后按空格进入下一题', () => {
    var state = { answered: true };
    var nextCalled = false;
    var result = handleQuizKeydown({ key: ' ', preventDefault: function() {} }, state,
      function() {}, function() { nextCalled = true; });
    expect(result.handled).toBe(true);
    expect(nextCalled).toBe(true);
  });

  test('已回答后按回车进入下一题', () => {
    var state = { answered: true };
    var nextCalled = false;
    var result = handleQuizKeydown({ key: 'Enter', preventDefault: function() {} }, state,
      function() {}, function() { nextCalled = true; });
    expect(result.handled).toBe(true);
    expect(nextCalled).toBe(true);
  });

  test('未回答时按其他键不响应', () => {
    var state = { answered: false };
    var picked = null;
    var result = handleQuizKeydown({ key: 'E', preventDefault: function() {} }, state,
      function(k) { picked = k; }, function() {});
    expect(result.handled).toBe(false);
    expect(picked).toBeNull();
  });

  test('已回答后按其他键不响应', () => {
    var state = { answered: true };
    var nextCalled = false;
    var result = handleQuizKeydown({ key: 'x', preventDefault: function() {} }, state,
      function() {}, function() { nextCalled = true; });
    expect(result.handled).toBe(false);
    expect(nextCalled).toBe(false);
  });
});

// ==================== 完成答题结果构造 ====================
describe('finishQuiz() - 答题完成结果构造', () => {
  function buildResult(state) {
    var total = state.quiz.length;
    var correct = state.correctCount;
    var wrong = total - correct;
    var pct = total > 0 ? Math.round(correct / total * 100) : 0;

    var modeLabel;
    if (state.isWrongBookQuiz) modeLabel = '错题复习';
    else {
      var m = { quick: '快速', standard: '标准', intensive: '强化' };
      modeLabel = m[state.mode] || '快速';
    }

    return {
      total: total,
      correct: correct,
      wrong: wrong,
      pct: pct,
      mode: modeLabel
    };
  }

  test('全对结果', () => {
    var state = { quiz: [1, 2, 3], correctCount: 3, isWrongBookQuiz: false, mode: 'quick' };
    var r = buildResult(state);
    expect(r.total).toBe(3);
    expect(r.correct).toBe(3);
    expect(r.wrong).toBe(0);
    expect(r.pct).toBe(100);
    expect(r.mode).toBe('快速');
  });

  test('全错结果', () => {
    var state = { quiz: [1, 2, 3], correctCount: 0, isWrongBookQuiz: false, mode: 'standard' };
    var r = buildResult(state);
    expect(r.wrong).toBe(3);
    expect(r.pct).toBe(0);
    expect(r.mode).toBe('标准');
  });

  test('部分正确', () => {
    var state = { quiz: [1, 2, 3, 4], correctCount: 2, isWrongBookQuiz: false, mode: 'intensive' };
    var r = buildResult(state);
    expect(r.correct).toBe(2);
    expect(r.wrong).toBe(2);
    expect(r.pct).toBe(50);
    expect(r.mode).toBe('强化');
  });

  test('错题复习模式标签', () => {
    var state = { quiz: [1], correctCount: 1, isWrongBookQuiz: true, mode: 'quick' };
    var r = buildResult(state);
    expect(r.mode).toBe('错题复习');
  });

  test('空题库（边界）', () => {
    var state = { quiz: [], correctCount: 0, isWrongBookQuiz: false, mode: 'quick' };
    var r = buildResult(state);
    expect(r.total).toBe(0);
    expect(r.pct).toBe(0);
  });

  test('正确率四舍五入', () => {
    var state = { quiz: [1, 2, 3], correctCount: 2, isWrongBookQuiz: false, mode: 'quick' };
    var r = buildResult(state);
    expect(r.pct).toBe(67); // 66.67 → 67
  });
});
