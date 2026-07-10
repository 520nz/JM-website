// ============================================================
// app.js - 主应用逻辑
// 优化点：XSS转义、中断恢复提示、间隔重复错题本展示
// ============================================================

// --- 视图切换 ---
function switchView(v) {
    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) views[i].classList.remove('active');
    var el = document.getElementById('view-' + v);
    if (el) el.classList.add('active');

    var navs = document.querySelectorAll('.nav-item');
    for (var j = 0; j < navs.length; j++) {
        navs[j].classList.remove('active');
        if (navs[j].textContent === VIEW_NAMES[v]) navs[j].classList.add('active');
    }

    if (v === 'home') updateHome();
    if (v === 'wrongbook') renderWrongBook();
    if (v === 'stats') renderStats();
    if (v === 'admin') renderAdmin();

    // 练习视图处理
    if (v === 'practice') {
        if (state.quiz.length === 0 || state.idx >= state.quiz.length) {
            state.quiz = [];
            state.idx = 0;
            stopTimer();
            // 检查是否有可恢复的会话
            var savedSession = Session.load();
            if (savedSession && savedSession.quizIds && savedSession.quizIds.length > 0) {
                showResumePrompt();
            } else {
                document.getElementById('quizArea').innerHTML =
                    '<div class="card" style="text-align:center;padding:60px 20px;">' +
                    '<div style="font-size:48px;margin-bottom:16px;">📝</div>' +
                    '<h3 style="margin-bottom:12px;">请先开始答题</h3>' +
                    '<p style="color:var(--text2);margin-bottom:20px;">点击下方按钮开始练习</p>' +
                    '<button class="btn" style="max-width:200px;margin:0 auto;" onclick="switchView(\'home\')">去首页开始</button>' +
                    '</div>';
            }
        }
    }
}

// --- 首页数据更新 ---
function updateHome() {
    var d = DB.get();
    var today = new Date().setHours(0, 0, 0, 0);
    var th = d.history.filter(function(h) { return h.time >= today; });
    document.getElementById('todayCount').textContent = th.length;
    var acc = th.length > 0 ? Math.round(th.filter(function(h) { return h.ok; }).length / th.length * 100) : 0;
    document.getElementById('todayAcc').textContent = acc + '%';
}

// --- 错题本渲染（含间隔重复信息） ---
function renderWrongBook() {
    var wl = DB.getWrong();
    var el = document.getElementById('wrongBookList');
    var btn = document.getElementById('wrongBookBtn');

    if (wl.length === 0) {
        el.innerHTML = '<div class="empty"><p>暂无错题记录</p><p style="font-size:13px;margin-top:8px;">答错的题目会自动加入这里</p></div>';
        btn.style.display = 'none';
        return;
    }

    var dueCount = DB.getDueWrong().length;
    var now = Date.now();

    var html = '<div class="error-list">';
    for (var i = 0; i < wl.length; i++) {
        var q = DB.findQ(wl[i].qid);
        if (!q) continue;
        var level = wl[i].level || 0;
        var isDue = !wl[i].nextReview || wl[i].nextReview <= now;
        var dueText = '';
        if (isDue) {
            dueText = '<span class="due-badge ready">可复习</span>';
        } else {
            var remain = wl[i].nextReview - now;
            var remainText = '';
            if (remain < 60 * 60 * 1000) {
                remainText = Math.ceil(remain / (60 * 1000)) + '分钟后';
            } else if (remain < 24 * 60 * 60 * 1000) {
                remainText = Math.ceil(remain / (60 * 60 * 1000)) + '小时后';
            } else {
                remainText = Math.ceil(remain / (24 * 60 * 60 * 1000)) + '天后';
            }
            dueText = '<span class="due-badge">' + remainText + '</span>';
        }

        html += '<div class="error-item">' +
                '<div class="q">' + esc(q.question) + '</div>' +
                '<div class="info">' +
                    '<span><span class="level-badge">Lv.' + level + '</span>错误' + wl[i].cnt + '次 ' + dueText + '</span>' +
                    '<button class="btn btn-sm btn-error btn-outline" onclick="removeWrong(\'' + esc(q.id) + '\')">移除</button>' +
                '</div></div>';
    }
    html += '</div>';

    el.innerHTML = html;
    btn.style.display = 'block';
    btn.textContent = '开始复习 (' + wl.length + '题' + (dueCount > 0 ? '，' + dueCount + '题到期' : '') + ')';
}

function removeWrong(qid) {
    DB.removeWrong(qid);
    renderWrongBook();
}

// --- 统计页渲染 ---
function renderStats() {
    var d = DB.get();
    document.getElementById('sTotal').textContent = d.stats.total;
    document.getElementById('sCorrect').textContent = d.stats.correct;
    var acc = d.stats.total > 0 ? Math.round(d.stats.correct / d.stats.total * 100) : 0;
    document.getElementById('sAcc').textContent = acc + '%';
    document.getElementById('sWrong').textContent = d.wrong.length;

    var catEl = document.getElementById('catStats');
    var cats = d.stats.cats;
    var keys = Object.keys(cats);
    if (keys.length === 0) {
        catEl.innerHTML = '<div class="empty"><p>暂无数据</p></div>';
        return;
    }
    var html = '';
    for (var i = 0; i < keys.length; i++) {
        var name = keys[i];
        var s = cats[name];
        var pct = s.t > 0 ? Math.round(s.c / s.t * 100) : 0;
        html += '<div class="cat-stat-row">' +
                '<span class="cat-stat-name">' + esc(name) + '</span>' +
                '<div class="cat-stat-bar-wrap"><div class="cat-stat-bar-bg"><div class="cat-stat-bar" style="width:' + pct + '%"></div></div></div>' +
                '<span class="cat-stat-pct">' + pct + '%</span>' +
                '</div>';
    }
    catEl.innerHTML = html;
}

// --- 初始化 ---
function init() {
    // 加载自定义题库
    QuestionStore.load();

    // 更新首页
    updateHome();

    // 注册键盘快捷键
    document.addEventListener('keydown', handleQuizKeydown);

    // 检查是否有可恢复的答题会话
    var savedSession = Session.load();
    if (savedSession && savedSession.quizIds && savedSession.quizIds.length > 0) {
        // 在首页显示恢复提示
        var homeView = document.getElementById('view-home');
        if (homeView) {
            var resumeBanner = document.createElement('div');
            resumeBanner.className = 'card';
            resumeBanner.style.borderColor = 'var(--primary)';
            resumeBanner.style.background = 'var(--primary-light)';
            resumeBanner.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">' +
                '<div><strong>⏳ 发现已保存的答题进度</strong><br><span style="font-size:13px;color:var(--text2);">上次答题中断了，点击继续</span></div>' +
                '<button class="btn btn-sm" style="flex-shrink:0;" onclick="resumeSession()">继续答题</button>' +
                '</div>';
            homeView.insertBefore(resumeBanner, homeView.firstChild);
        }
    }
}

// DOM 就绪后初始化
window.addEventListener('DOMContentLoaded', init);
