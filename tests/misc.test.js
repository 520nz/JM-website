// ============================================================
// tests/misc.test.js - 错题导入合并逻辑 + quiz.js 纯函数
// admin.js importData 中的错题合并算法是关键数据一致性保证
// ============================================================
const { test } = require('node:test');
const assert = require('node:assert/strict');

// 从 admin.js importData 中提取的错题合并核心逻辑（原封不动拷贝）
function mergeWrongList(existingWrong, importedWrong) {
    var wrongMap = {};
    for (var w = 0; w < existingWrong.length; w++) {
        wrongMap[existingWrong[w].qid] = existingWrong[w];
    }
    for (var x = 0; x < importedWrong.length; x++) {
        var wrongItem = importedWrong[x];
        if (wrongMap[wrongItem.qid]) {
            wrongMap[wrongItem.qid].cnt = Math.max(wrongMap[wrongItem.qid].cnt, wrongItem.cnt || 1);
            if (wrongItem.level != null) {
                wrongMap[wrongItem.qid].level = Math.min(wrongMap[wrongItem.qid].level || 0, wrongItem.level);
            }
        } else {
            if (!wrongItem.level) wrongItem.level = 0;
            if (!wrongItem.nextReview) wrongItem.nextReview = Date.now();
            if (!wrongItem.lastReview) wrongItem.lastReview = 0;
            if (!wrongItem.time) wrongItem.time = Date.now();
            existingWrong.push(wrongItem);
        }
    }
    return existingWrong;
}

// ============================================================
// 错题导入合并逻辑
// 这是 admin.js 中 importData 的核心，确保双端数据同步后错题状态正确
// ============================================================
test('错题合并：qid 冲突时 cnt 取较大值', () => {
    const existing = [{ qid: '001', cnt: 3, level: 2, time: 1000, lastReview: 500, nextReview: 2000 }];
    const imported = [{ qid: '001', cnt: 5, level: 1, time: 3000, lastReview: 2500, nextReview: 4000 }];
    const result = mergeWrongList(existing, imported);
    assert.equal(result.length, 1);
    assert.equal(result[0].qid, '001');
    assert.equal(result[0].cnt, 5, '应取较大的 cnt');
});

test('错题合并：cnt 较小的一方不会覆盖已有较大值', () => {
    const existing = [{ qid: '001', cnt: 5, level: 2, time: 1000, lastReview: 500, nextReview: 2000 }];
    const imported = [{ qid: '001', cnt: 1, level: 0, time: 3000, lastReview: 2500, nextReview: 4000 }];
    const result = mergeWrongList(existing, imported);
    assert.equal(result[0].cnt, 5, '已有更大 cnt 应被保留');
});

test('错题合并：level 取较小值（更保守），防止导入数据"作弊"提升等级', () => {
    // 已有 level=0（刚开始），导入 level=4（快掌握）
    // 取较小的 0，防止导入的"高等级"数据覆盖真实学习状态
    const existing = [{ qid: '001', cnt: 3, level: 0, time: 1000, lastReview: 500, nextReview: 2000 }];
    const imported = [{ qid: '001', cnt: 5, level: 4, time: 3000, lastReview: 2500, nextReview: 4000 }];
    const result = mergeWrongList(existing, imported);
    assert.equal(result[0].level, 0, '应取较小的 level 保证保守策略');
});

test('错题合并：导入数据 level 比已有小，保留较小值', () => {
    const existing = [{ qid: '001', cnt: 3, level: 3, time: 1000, lastReview: 500, nextReview: 2000 }];
    const imported = [{ qid: '001', cnt: 5, level: 1, time: 3000, lastReview: 2500, nextReview: 4000 }];
    const result = mergeWrongList(existing, imported);
    assert.equal(result[0].level, 1, '导入的 level 更小，应取 1');
});

test('错题合并：新题目（qid 不冲突）应直接追加，并补齐间隔重复字段', () => {
    const existing = [{ qid: '001', cnt: 3, level: 2, time: 1000, lastReview: 500, nextReview: 2000 }];
    // 模拟一份老版本数据：只有 qid 和 cnt，没有间隔重复字段
    const imported = [{ qid: '002', cnt: 2 }];
    const now = Date.now();
    const result = mergeWrongList(existing, imported);

    assert.equal(result.length, 2);
    const newItem = result.find(w => w.qid === '002');
    assert.ok(newItem, '新题应被加入');
    assert.equal(newItem.level, 0, '缺失 level 应补为 0');
    assert.equal(newItem.lastReview, 0, '缺失 lastReview 应补为 0');
    assert.ok(newItem.nextReview >= now - 100, '缺失 nextReview 应补为当前时间');
    assert.ok(newItem.time >= now - 100, '缺失 time 应补为当前时间');
});

test('错题合并：导入数据没有 level 字段(null 或 undefined)时，不覆盖已有 level', () => {
    // 老版本备份文件可能没有 level 字段
    const existing = [{ qid: '001', cnt: 3, level: 2, time: 1000, lastReview: 500, nextReview: 2000 }];
    const imported = [{ qid: '001', cnt: 10 }];  // 没有 level 字段
    const result = mergeWrongList(existing, imported);
    assert.equal(result[0].cnt, 10, 'cnt 应被更新');
    assert.equal(result[0].level, 2, '已有 level 不应被 undefined 覆盖');
});

test('错题合并：空 existing 合并空 imported 返回空', () => {
    const result = mergeWrongList([], []);
    assert.equal(result.length, 0);
});

test('错题合并：单边为空时返回另一边', () => {
    const a = [{ qid: '001', cnt: 1, level: 0, time: 1, lastReview: 0, nextReview: 1 }];
    const b = [];
    assert.equal(mergeWrongList(a.slice(), b).length, 1);
    assert.equal(mergeWrongList(b, a.slice()).length, 1);
});

test('错题合并：复杂场景 - 3 个 qid，1 个冲突 + 2 个新增', () => {
    const existing = [
        { qid: 'A', cnt: 2, level: 1, time: 1000, lastReview: 500, nextReview: 2000 },
        { qid: 'B', cnt: 1, level: 0, time: 1000, lastReview: 0, nextReview: 1000 }
    ];
    const imported = [
        { qid: 'A', cnt: 5, level: 3, time: 3000, lastReview: 2500, nextReview: 4000 },
        { qid: 'C', cnt: 2 },  // 新增，无完整字段
        { qid: 'D', cnt: 7, level: 4, time: 5000, lastReview: 4500, nextReview: 6000 } // 新增
    ];

    const result = mergeWrongList(existing, imported);
    assert.equal(result.length, 4);

    const a = result.find(w => w.qid === 'A');
    assert.equal(a.cnt, 5, '冲突题 A：取较大 cnt');
    assert.equal(a.level, 1, '冲突题 A：取较小 level');

    const b = result.find(w => w.qid === 'B');
    assert.equal(b.cnt, 1, '未冲突题 B 保持不变');
    assert.equal(b.level, 0);

    const c = result.find(w => w.qid === 'C');
    assert.equal(c.cnt, 2, '新增题 C 保留 cnt');
    assert.equal(c.level, 0, '新增题 C 补默认 level');
    assert.ok(c.nextReview != null, '新增题 C 补 nextReview');

    const d = result.find(w => w.qid === 'D');
    assert.equal(d.cnt, 7, '新增题 D 完整保留');
    assert.equal(d.level, 4);
});

// ============================================================
// quiz.js 中的 shuffle 纯函数
// Fisher–Yates 洗牌算法
// ============================================================
function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
}

test('shuffle() 返回数组长度不变且元素集合相同', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    for (let i = 0; i < 50; i++) {
        const result = shuffle(input);
        assert.equal(result.length, input.length);
        const sortedGot = result.slice().sort((a, b) => a - b);
        assert.deepEqual(sortedGot, input, '元素集合应保持一致');
    }
});

test('shuffle() 不修改原数组', () => {
    const input = [1, 2, 3, 4, 5];
    const copy = input.slice();
    shuffle(input);
    assert.deepEqual(input, copy, '原数组不应被修改');
});

test('shuffle() 空数组和单元素数组正常工作', () => {
    assert.deepEqual(shuffle([]), []);
    assert.deepEqual(shuffle([42]), [42]);
});

test('shuffle() 多次调用产生不同排列（概率性，50 次全相同几乎不可能）', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const first = shuffle(input).join(',');
    let allSame = true;
    for (let i = 0; i < 10; i++) {
        if (shuffle(input).join(',') !== first) { allSame = false; break; }
    }
    assert.ok(!allSame, '多次 shuffle 应产生不同排列');
});

// ============================================================
// quiz.js 中的 fmtTime 纯函数
// ============================================================
function fmtTime(ms) {
    var sec = Math.floor(ms / 1000);
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + '分' + s + '秒';
}

test('fmtTime() 正确格式化毫秒为可读字符串', () => {
    assert.equal(fmtTime(0), '0分0秒');
    assert.equal(fmtTime(500), '0分0秒');  // 不足 1 秒截断
    assert.equal(fmtTime(1000), '0分1秒');
    assert.equal(fmtTime(59000), '0分59秒');
    assert.equal(fmtTime(60000), '1分0秒');
    assert.equal(fmtTime(61000), '1分1秒');
    assert.equal(fmtTime(90000), '1分30秒');
    assert.equal(fmtTime(3661000), '61分1秒');
});

// ============================================================
// 答题引擎答题流程：pickOption 逻辑（脱离 DOM 的纯逻辑提取）
// 在普通模式下，答错时应调用 addWrong；在错题本模式下，应调用 reviewCorrect/reviewWrong
// 这段逻辑完全依赖 DOM，但其分支条件可以被独立验证
// ============================================================
test('答题流程分支逻辑验证：普通模式答错 → addWrong，错题本模式答错 → reviewWrong', () => {
    // 这是 quiz.js pickOption 的核心分支条件
    function decideFlow(isWrongBookQuiz, ok) {
        if (isWrongBookQuiz) {
            return ok ? 'reviewCorrect' : 'reviewWrong';
        } else {
            return ok ? 'none' : 'addWrong';
        }
    }

    assert.equal(decideFlow(false, true), 'none', '普通模式答对不做额外操作');
    assert.equal(decideFlow(false, false), 'addWrong', '普通模式答错加入错题本');
    assert.equal(decideFlow(true, true), 'reviewCorrect', '错题本模式答对推进等级');
    assert.equal(decideFlow(true, false), 'reviewWrong', '错题本模式答错重置等级');
});

// ============================================================
// session 恢复逻辑
// quiz.js tryResumeSession 的核心条件
// ============================================================
test('tryResumeSession 条件判断：空 quizIds 不恢复', () => {
    function shouldResume(saved, qsLen, idx, qsAfterFindQ) {
        if (!saved || !saved.quizIds || saved.quizIds.length === 0) return false;
        if (qsAfterFindQ.length === 0) return false;
        if (idx >= qsAfterFindQ.length) return false;
        return true;
    }

    assert.equal(shouldResume(null, 0, 0, []), false);
    assert.equal(shouldResume({}, 0, 0, []), false);  // 无 quizIds
    assert.equal(shouldResume({ quizIds: [] }, 0, 0, []), false);  // quizIds 空
    assert.equal(shouldResume({ quizIds: ['001'] }, 0, 0, []), false);  // findQ 全找不到
    assert.equal(shouldResume({ quizIds: ['001', '002'] }, 2, 2, ['a', 'b']), false);  // idx 越界
    assert.equal(shouldResume({ quizIds: ['001'] }, 1, 0, ['a']), true);
    assert.equal(shouldResume({ quizIds: ['001', '002'] }, 2, 1, ['a', 'b']), true);
});

// ============================================================
// 每日目标数值边界 - 数据级验证
// 与 storage.js 中 setDailyGoal 的 Math.max(5, Math.min(100, n)) 保持一致
// ============================================================
test('每日目标夹紧逻辑：正常数值边界工作正常', () => {
    function clampDailyGoal(n) {
        return Math.max(5, Math.min(100, n));
    }
    assert.equal(clampDailyGoal(-100), 5);
    assert.equal(clampDailyGoal(0), 5);
    assert.equal(clampDailyGoal(1), 5);
    assert.equal(clampDailyGoal(4), 5);
    assert.equal(clampDailyGoal(5), 5);
    assert.equal(clampDailyGoal(50), 50);
    assert.equal(clampDailyGoal(99), 99);
    assert.equal(clampDailyGoal(100), 100);
    assert.equal(clampDailyGoal(101), 100);
    assert.equal(clampDailyGoal(99999), 100);
});

// 注：NaN 输入会穿透 Math.max/min 得到 NaN，由调用方（app.js editDailyGoal）
// 在 parseInt 后用 isNaN 检查拦截。setDailyGoal 本身无防护，若未来从其他
// 路径调用需注意这个边界。此处标记为已知行为，不作为当前测试范围。
