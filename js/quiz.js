// ============================================================
// quiz.js - 答题引擎
// 优化点：中断恢复、间隔重复逻辑、XSS转义、键盘快捷键
// ============================================================

var state = {
    quiz: [],
    idx: 0,
    answered: false,
    mode: 'quick',
    correctCount: 0,
    startTime: 0,
    timer: null,
    isWrongBookQuiz: false  // 标记是否为错题本复习模式
};

var VIEW_NAMES = { home: '首页', practice: '练习', wrongbook: '错题本', stats: '统计', admin: '管理' };

// --- 模式选择 ---
function selectMode(m) {
    state.mode = m;
    var btns = document.querySelectorAll('.mode-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
    var t = document.querySelector('.mode-btn[data-mode="' + m + '"]');
    if (t) t.classList.add('active');
    // 模式切换后清除待恢复的会话
    Session.clear();
}

function getCount() {
    var m = { quick: 10, standard: 20, intensive: 30 };
    return m[state.mode] || 10;
}

// --- 计时器 ---
function startTimer() {
    state.startTime = Date.now();
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(tickTimer, 1000);
}

function stopTimer() {
    if (state.timer) {
        clearInterval(state.timer);
        state.timer = null;
    }
}

function tickTimer() {
    var sec = Math.floor((Date.now() - state.startTime) / 1000);
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    var el = document.getElementById('timerVal');
    if (el) el.textContent = m + ':' + (s < 10 ? '0' : '') + s;
}

function fmtTime(ms) {
    var sec = Math.floor(ms / 1000);
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + '分' + s + '秒';
}

// --- 随机打乱 ---
function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
}

// --- 开始答题 ---
function startRandomQuiz() {
    state.quiz = shuffle(QUESTION_BANK).slice(0, getCount());
    state.idx = 0;
    state.correctCount = 0;
    state.isWrongBookQuiz = false;
    Session.clear();
    switchView('practice');
    startTimer();
    renderQ();
}

function showCategoryView() {
    var cats = {};
    for (var i = 0; i < QUESTION_BANK.length; i++) {
        var c = QUESTION_BANK[i].category;
        cats[c] = (cats[c] || 0) + 1;
    }
    var html = '';
    for (var name in cats) {
        html += '<div class="category-item" onclick="startCatQuiz(\'' + esc(name) + '\')">' +
                '<span class="category-name">' + esc(name) + '</span>' +
                '<span class="category-count">' + cats[name] + '题</span></div>';
    }
    document.getElementById('categoryList').innerHTML = html;
    switchView('category');
}

function startCatQuiz(cat) {
    var f = [];
    for (var i = 0; i < QUESTION_BANK.length; i++) {
        if (QUESTION_BANK[i].category === cat) f.push(QUESTION_BANK[i]);
    }
    var count = getCount();
    if (f.length < count) {
        // 题目不足时提示
        state.quiz = shuffle(f);
    } else {
        state.quiz = shuffle(f).slice(0, count);
    }
    state.idx = 0;
    state.correctCount = 0;
    state.isWrongBookQuiz = false;
    Session.clear();
    switchView('practice');
    startTimer();
    renderQ();
}

// --- 错题本复习（间隔重复） ---
function startWrongBookQuiz() {
    // 优先获取到期错题
    var dueWrong = DB.getDueWrong();
    var wrongList = dueWrong.length > 0 ? dueWrong : DB.getWrong();
    var qs = [];
    for (var i = 0; i < wrongList.length; i++) {
        var q = DB.findQ(wrongList[i].qid);
        if (q) qs.push(q);
    }
    if (qs.length === 0) return;
    state.quiz = shuffle(qs);
    state.idx = 0;
    state.correctCount = 0;
    state.isWrongBookQuiz = true;
    Session.clear();
    switchView('practice');
    startTimer();
    renderQ();
}

// --- 渲染题目 ---
function renderQ() {
    if (state.idx >= state.quiz.length) {
        finishQuiz();
        return;
    }
    // 保存会话（中断恢复）
    Session.save(state);

    var q = state.quiz[state.idx];
    var pct = Math.round(state.idx / state.quiz.length * 100);
    var sec = Math.floor((Date.now() - state.startTime) / 1000);
    var tm = Math.floor(sec / 60);
    var ts = sec % 60;

    var html = '<div class="progress-wrap"><div class="progress-header">' +
               '<span class="progress-text">' + (state.idx + 1) + ' / ' + state.quiz.length + '</span>' +
               '<span class="timer-badge">⏱ <span id="timerVal">' + tm + ':' + (ts < 10 ? '0' : '') + ts + '</span></span>' +
               '</div><div class="progress-bar-bg"><div class="progress-bar" style="width:' + pct + '%"></div></div></div>';

    html += '<div class="question-card"><div class="question-text">' + esc(q.question) + '</div>';
    for (var i = 0; i < q.options.length; i++) {
        var o = q.options[i];
        html += '<div class="option-item" onclick="pickOption(\'' + esc(o.key) + '\')" id="opt-' + esc(o.key) + '">' +
                '<span class="option-key">' + esc(o.key) + '</span><span>' + esc(o.text) + '</span></div>';
    }
    html += '<div class="feedback" id="fb"><div class="feedback-title" id="fbTitle"></div><div class="feedback-desc" id="fbDesc"></div></div></div>';
    html += '<div class="bottom-bar"><button class="btn" id="nextBtn" onclick="nextQ()" style="display:none;">下一题</button><button class="btn btn-outline" onclick="quitQuiz()">返回首页</button></div>';
    document.getElementById('quizArea').innerHTML = html;
    state.answered = false;
}

// --- 选择答案 ---
function pickOption(key) {
    if (state.answered) return;
    state.answered = true;
    var q = state.quiz[state.idx];
    var ok = (key === q.answer);
    if (ok) state.correctCount++;

    // 记录答题
    DB.addRecord({ qid: q.id, ans: key, ok: ok, time: Date.now() });

    // 间隔重复：错题本复习模式下更新复习状态
    if (state.isWrongBookQuiz) {
        if (ok) {
            DB.reviewCorrect(q.id);
        } else {
            DB.reviewWrong(q.id);
        }
    } else {
        // 普通模式：答错加入错题本
        if (!ok) DB.addWrong(q.id);
    }

    // 更新选项样式
    for (var i = 0; i < q.options.length; i++) {
        var el = document.getElementById('opt-' + q.options[i].key);
        el.classList.add('disabled');
        if (q.options[i].key === q.answer) el.classList.add('correct');
        else if (q.options[i].key === key && !ok) el.classList.add('wrong');
    }

    // 显示反馈
    var fb = document.getElementById('fb');
    fb.className = 'feedback show ' + (ok ? 'correct' : 'wrong');
    document.getElementById('fbTitle').textContent = ok ? '✓ 回答正确！' : '✗ 回答错误';
    document.getElementById('fbDesc').textContent = q.explanation;
    document.getElementById('nextBtn').style.display = 'inline-block';
}

// --- 下一题 / 退出 / 完成 ---
function nextQ() {
    state.idx++;
    renderQ();
}

function quitQuiz() {
    stopTimer();
    Session.clear();
    switchView('home');
}

function finishQuiz() {
    stopTimer();
    Session.clear();
    var elapsed = Date.now() - state.startTime;
    var total = state.quiz.length;
    var correct = state.correctCount;
    var wrong = total - correct;
    var pct = total > 0 ? Math.round(correct / total * 100) : 0;

    var html = '<div class="card finish-card"><div class="finish-icon">🎉</div><h2>答题完成！</h2>' +
               '<div class="finish-stats">' +
               '<div class="finish-stat"><div class="val green">' + correct + '</div><div class="lbl">正确</div></div>' +
               '<div class="finish-stat"><div class="val red">' + wrong + '</div><div class="lbl">错误</div></div>' +
               '<div class="finish-stat"><div class="val">' + pct + '%</div><div class="lbl">正确率</div></div>' +
               '<div class="finish-stat"><div class="val">' + fmtTime(elapsed) + '</div><div class="lbl">用时</div></div>' +
               '</div><button class="btn" onclick="switchView(\'home\')">返回首页</button></div>';
    document.getElementById('quizArea').innerHTML = html;
}

// --- 答题中断恢复 ---
function tryResumeSession() {
    var saved = Session.load();
    if (!saved || !saved.quizIds || saved.quizIds.length === 0) return false;

    // 根据 ID 重建题目列表
    var qs = [];
    for (var i = 0; i < saved.quizIds.length; i++) {
        var q = DB.findQ(saved.quizIds[i]);
        if (q) qs.push(q);
    }
    if (qs.length === 0) return false;

    state.quiz = qs;
    state.idx = saved.idx || 0;
    state.correctCount = saved.correctCount || 0;
    state.mode = saved.mode || 'quick';
    state.isWrongBookQuiz = false;

    // 如果已经答完，不恢复
    if (state.idx >= state.quiz.length) {
        Session.clear();
        return false;
    }

    // 恢复计时器（从中断时间点继续）
    var elapsed = Date.now() - saved.startTime;
    state.startTime = Date.now() - elapsed;

    return true;
}

function showResumePrompt() {
    var html = '<div class="card" style="text-align:center;padding:40px 20px;">' +
               '<div style="font-size:48px;margin-bottom:16px;">⏳</div>' +
               '<h3 style="margin-bottom:12px;">发现未完成的答题</h3>' +
               '<p style="color:var(--text2);margin-bottom:20px;">上次答题中断了，是否继续？</p>' +
               '<button class="btn" style="max-width:200px;margin:0 auto 12px;" onclick="resumeSession()">继续答题</button>' +
               '<button class="btn btn-outline" style="max-width:200px;margin:0 auto;" onclick="discardSession()">重新开始</button>' +
               '</div>';
    document.getElementById('quizArea').innerHTML = html;
}

function resumeSession() {
    if (tryResumeSession()) {
        switchView('practice');
        startTimer();
        renderQ();
    } else {
        Session.clear();
        switchView('home');
    }
}

function discardSession() {
    Session.clear();
    state.quiz = [];
    state.idx = 0;
    switchView('home');
}

// --- 键盘快捷键 ---
function handleQuizKeydown(e) {
    var practiceView = document.getElementById('view-practice');
    if (!practiceView || !practiceView.classList.contains('active')) return;

    if (!state.quiz || state.quiz.length === 0) return;

    if (state.answered) {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            if (state.idx < state.quiz.length - 1) nextQ();
        }
        return;
    }

    if (state.idx >= state.quiz.length) return;

    var key = e.key.toUpperCase();
    if (key >= 'A' && key <= 'D') {
        var q = state.quiz[state.idx];
        if (q && q.options) {
            for (var i = 0; i < q.options.length; i++) {
                if (q.options[i].key === key) {
                    pickOption(key);
                    e.preventDefault();
                    return;
                }
            }
        }
    }
}
