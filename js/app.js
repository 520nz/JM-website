// ============================================================
// app.js - 主应用逻辑
// 命名空间封装 + IndexedDB 异步初始化 + 统计趋势图
// ============================================================
var App = window.App || {};
(function(A) {
    var VIEW_NAMES = { home: '首页', practice: '练习', wrongbook: '错题本', stats: '统计', admin: '管理' };

    // --- 视图切换 ---
    function switchView(v) {
        var views = document.querySelectorAll('.view');
        for (var i = 0; i < views.length; i++) views[i].classList.remove('active');
        var el = document.getElementById('view-' + v);
        if (el) {
            el.classList.add('active');
            // 触发过渡动画：先渲染一帧 display:block + opacity:0，再设置目标状态
            el.style.opacity = '0';
            el.style.transform = 'translateY(8px)';
            void el.offsetHeight; // 强制 reflow
            el.style.opacity = '';
            el.style.transform = '';
        }

        var navs = document.querySelectorAll('.nav-item');
        for (var j = 0; j < navs.length; j++) {
            navs[j].classList.remove('active');
            if (navs[j].getAttribute('data-view') === v) navs[j].classList.add('active');
        }

        if (v === 'home') updateHome();
        if (v === 'wrongbook') renderWrongBook();
        if (v === 'stats') renderStats();
        if (v === 'admin') A.renderAdmin();

        if (v === 'practice') {
            if (!A.state || A.state.quiz.length === 0 || A.state.idx >= A.state.quiz.length) {
                A.state.quiz = [];
                A.state.idx = 0;
                A.stopTimer();
                var savedSession = A.session.load();
                if (savedSession && savedSession.quizIds && savedSession.quizIds.length > 0) {
                    A.showResumePrompt();
                } else {
                    document.getElementById('quizArea').innerHTML =
                        '<div class="card" style="text-align:center;padding:60px 20px;">' +
                        '<div style="font-size:48px;margin-bottom:16px;">📝</div>' +
                        '<h3 style="margin-bottom:12px;">请先开始答题</h3>' +
                        '<p style="color:var(--text2);margin-bottom:20px;">点击下方按钮开始练习</p>' +
                        '<button class="btn" style="max-width:200px;margin:0 auto;" onclick="App.switchView(\'home\')">去首页开始</button>' +
                        '</div>';
                }
            }
        }
    }

    // --- 首页数据更新 ---
    function updateHome() {
        var d = A.db.get();
        var today = new Date().setHours(0, 0, 0, 0);
        var th = d.history.filter(function(h) { return h.time >= today; });
        document.getElementById('todayCount').textContent = th.length;
        var acc = th.length > 0 ? Math.round(th.filter(function(h) { return h.ok; }).length / th.length * 100) : 0;
        document.getElementById('todayAcc').textContent = acc + '%';

        // 连续打卡
        var streak = A.db.getStreak();
        var badge = document.getElementById('streakBadge');
        if (badge) {
            badge.textContent = streak > 0 ? '🔥 ' + streak + ' 天' : '暂无连续记录';
            badge.classList.toggle('active', streak > 0);
        }

        // 每日目标进度
        var goal = A.db.getDailyGoal();
        var todayDone = th.length;
        var goalPct = Math.min(100, Math.round(todayDone / goal * 100));
        var gp = document.getElementById('goalProgress');
        var gt = document.getElementById('goalTarget');
        var gb = document.getElementById('goalBar');
        if (gp) gp.textContent = todayDone;
        if (gt) gt.textContent = goal;
        if (gb) {
            gb.style.width = goalPct + '%';
            if (goalPct >= 100) {
                gb.style.background = 'linear-gradient(90deg, var(--success), #34d399)';
            }
        }
    }

    // --- 修改每日目标 ---
    function editDailyGoal() {
        var cur = A.db.getDailyGoal();
        var input = prompt('设置每日答题目标（5-100题）：', cur);
        if (input === null) return;
        var n = parseInt(input, 10);
        if (isNaN(n) || n < 5 || n > 100) {
            alert('请输入 5-100 之间的数字');
            return;
        }
        A.db.setDailyGoal(n);
        updateHome();
    }

    // --- 错题本渲染（含间隔重复信息） ---
    // 错题本排序状态
    var _wrongSort = 'recent';

    function renderWrongBook() {
        var wl = A.db.getWrong();
        var el = document.getElementById('wrongBookList');
        var btn = document.getElementById('wrongBookBtn');

        if (wl.length === 0) {
            el.innerHTML = '<div class="empty"><p>暂无错题记录</p><p style="font-size:13px;margin-top:8px;">答错的题目会自动加入这里</p></div>';
            btn.style.display = 'none';
            return;
        }

        // 排序
        var sorted = wl.slice();
        if (_wrongSort === 'count') {
            sorted.sort(function(a, b) { return b.cnt - a.cnt; });
        } else if (_wrongSort === 'due') {
            sorted.sort(function(a, b) { return (a.nextReview || 0) - (b.nextReview || 0); });
        } else {
            sorted.sort(function(a, b) { return (b.time || 0) - (a.time || 0); });
        }

        var dueCount = A.db.getDueWrong().length;
        var now = Date.now();

        // 排序选择器
        var html = '<div style="margin-bottom:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
                   '<span style="font-size:13px;color:var(--text2);">排序：</span>' +
                   '<select id="wrongSortSel" style="padding:6px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);" onchange="App.setWrongSort(this.value)">' +
                   '<option value="recent"' + (_wrongSort === 'recent' ? ' selected' : '') + '>最近添加</option>' +
                   '<option value="count"' + (_wrongSort === 'count' ? ' selected' : '') + '>错误次数</option>' +
                   '<option value="due"' + (_wrongSort === 'due' ? ' selected' : '') + '>到期时间</option>' +
                   '</select></div>';

        html += '<div class="error-list">';
        for (var i = 0; i < sorted.length; i++) {
            var q = A.db.findQ(sorted[i].qid);
            if (!q) continue;
            var level = sorted[i].level || 0;
            var isDue = !sorted[i].nextReview || sorted[i].nextReview <= now;
            var dueText = '';
            if (isDue) {
                dueText = '<span class="due-badge ready">可复习</span>';
            } else {
                var remain = sorted[i].nextReview - now;
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
                    '<div class="q">' + A.esc(q.question) + '</div>' +
                    '<div class="info">' +
                        '<span><span class="level-badge">Lv.' + level + '</span>错误' + sorted[i].cnt + '次 ' + dueText + '</span>' +
                        '<button class="btn btn-sm btn-error btn-outline" data-qid="' + A.esc(q.id) + '" onclick="App.removeWrong(this.getAttribute(\'data-qid\'))">移除</button>' +
                    '</div></div>';
        }
        html += '</div>';

        el.innerHTML = html;
        btn.style.display = 'block';
        btn.textContent = '开始复习 (' + wl.length + '题' + (dueCount > 0 ? '，' + dueCount + '题到期' : '') + ')';
    }

    function setWrongSort(s) {
        _wrongSort = s;
        renderWrongBook();
    }

    function removeWrong(qid) {
        // 斩题动效：先播放庆祝动画，再移除元素
        var items = document.querySelectorAll('.error-item');
        var targetEl = null;
        for (var i = 0; i < items.length; i++) {
            var btn = items[i].querySelector('button[data-qid]');
            if (btn && btn.getAttribute('data-qid') === qid) { targetEl = items[i]; break; }
        }

        function doRemove() {
            A.db.removeWrong(qid);
            renderWrongBook();
            // 错题清零成就检查
            var unlocks = A.db.checkAchievements();
            if (unlocks && unlocks.length > 0) {
                unlocks.forEach(function(a, i) {
                    setTimeout(function() { showAchievementToast(a); }, 600 * (i + 1));
                });
            }
        }

        if (targetEl) {
            targetEl.classList.add('mastery-out');
            // 生成粒子
            for (var p = 0; p < 6; p++) {
                var particle = document.createElement('span');
                particle.style.cssText = 'position:absolute;width:6px;height:6px;border-radius:50%;background:var(--success);pointer-events:none;';
                var angle = (Math.PI * 2 * p) / 6;
                particle.style.setProperty('--px', Math.cos(angle) * 40 + 'px');
                particle.style.setProperty('--py', Math.sin(angle) * 40 + 'px');
                particle.style.animation = 'particle-fly 0.6s ease forwards';
                targetEl.style.position = 'relative';
                targetEl.appendChild(particle);
            }
            setTimeout(function() {
                targetEl.classList.add('removing');
                setTimeout(doRemove, 700);
            }, 300);
        } else {
            doRemove();
        }
    }

    // --- 统计页渲染（含趋势图） ---
    function renderStats() {
        var d = A.db.get();
        document.getElementById('sTotal').textContent = d.stats.total;
        document.getElementById('sCorrect').textContent = d.stats.correct;
        var acc = d.stats.total > 0 ? Math.round(d.stats.correct / d.stats.total * 100) : 0;
        document.getElementById('sAcc').textContent = acc + '%';
        document.getElementById('sWrong').textContent = d.wrong.length;

        // 分类正确率
        var catEl = document.getElementById('catStats');
        var cats = d.stats.cats;
        var keys = Object.keys(cats);
        if (keys.length === 0) {
            catEl.innerHTML = '<div class="empty"><p>暂无数据</p></div>';
        } else {
            var html = '';
            for (var i = 0; i < keys.length; i++) {
                var name = keys[i];
                var s = cats[name];
                var pct = s.t > 0 ? Math.round(s.c / s.t * 100) : 0;
                html += '<div class="cat-stat-row">' +
                        '<span class="cat-stat-name">' + A.esc(name) + '</span>' +
                        '<div class="cat-stat-bar-wrap"><div class="cat-stat-bar-bg"><div class="cat-stat-bar" style="width:' + pct + '%"></div></div></div>' +
                        '<span class="cat-stat-pct">' + pct + '%</span>' +
                        '</div>';
            }
            catEl.innerHTML = html;
        }

        // 趋势图（含归档数据）
        A.renderTrendChart('trendChart', d.history, d.archive);

        // 徽章墙
        renderAchievements();
    }

    // --- 成就徽章墙渲染 ---
    function renderAchievements() {
        var grid = document.getElementById('achvGrid');
        if (!grid) return;
        var defs = A.db.getAchievementDefs();
        var unlocked = A.db.getAchievements();
        var cntEl = document.getElementById('achvCount');
        if (cntEl) cntEl.textContent = unlocked.length + ' / ' + defs.length;

        var html = '';
        for (var i = 0; i < defs.length; i++) {
            var a = defs[i];
            var has = unlocked.indexOf(a.id) !== -1;
            html += '<div class="achv-item' + (has ? ' unlocked' : '') + '" title="' + A.esc(a.desc) + '">' +
                    '<div class="achv-icon">' + (has ? a.icon : '🔒') + '</div>' +
                    '<div class="achv-name">' + A.esc(a.name) + '</div>' +
                    '</div>';
        }
        grid.innerHTML = html;
    }

    // --- 成就解锁 Toast ---
    function showAchievementToast(achv) {
        var toast = document.createElement('div');
        toast.className = 'achv-toast';
        toast.innerHTML = '<span style="font-size:24px;">' + achv.icon + '</span>' +
                          '<div><div style="font-weight:600;font-size:14px;">解锁成就</div>' +
                          '<div style="font-size:13px;color:var(--text2);">' + A.esc(achv.name) + ' — ' + A.esc(achv.desc) + '</div></div>';
        document.body.appendChild(toast);
        setTimeout(function() { toast.classList.add('show'); }, 10);
        setTimeout(function() {
            toast.classList.remove('show');
            setTimeout(function() { toast.remove(); }, 400);
        }, 3000);
    }

    // --- 异步初始化 ---
    function init() {
        // 显示加载状态
        var loadingHtml = '<div class="card" style="text-align:center;padding:60px 20px;">' +
                          '<div style="font-size:40px;margin-bottom:16px;animation:spin 1s linear infinite;display:inline-block;">🎵</div>' +
                          '<p style="color:var(--text2);">加载中...</p></div>';
        var container = document.querySelector('.container');
        if (container) {
            var loadingDiv = document.createElement('div');
            loadingDiv.id = 'loadingOverlay';
            loadingDiv.innerHTML = loadingHtml;
            loadingDiv.style.position = 'fixed';
            loadingDiv.style.top = '0';
            loadingDiv.style.left = '0';
            loadingDiv.style.right = '0';
            loadingDiv.style.bottom = '0';
            loadingDiv.style.background = 'var(--bg)';
            loadingDiv.style.zIndex = '9999';
            loadingDiv.style.display = 'flex';
            loadingDiv.style.alignItems = 'center';
            loadingDiv.style.justifyContent = 'center';
            container.appendChild(loadingDiv);
        }

        // 异步初始化 IndexedDB
        Promise.all([
            A.db.init(),
            A.store.init()
        ]).then(function() {
            // 移除加载状态
            var overlay = document.getElementById('loadingOverlay');
            if (overlay) overlay.remove();

            // 应用主题
            applyTheme();

            // 更新首页
            updateHome();

            // 注册键盘快捷键
            document.addEventListener('keydown', A.handleQuizKeydown);

            // 检查是否有可恢复的答题会话
            var savedSession = A.session.load();
            if (savedSession && savedSession.quizIds && savedSession.quizIds.length > 0) {
                var homeView = document.getElementById('view-home');
                if (homeView) {
                    var resumeBanner = document.createElement('div');
                    resumeBanner.className = 'card';
                    resumeBanner.style.borderColor = 'var(--primary)';
                    resumeBanner.style.background = 'var(--primary-light)';
                    resumeBanner.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">' +
                        '<div><strong>⏳ 发现已保存的答题进度</strong><br><span style="font-size:13px;color:var(--text2);">上次答题中断了，点击继续</span></div>' +
                        '<button class="btn btn-sm" style="flex-shrink:0;" onclick="App.resumeSession()">继续答题</button>' +
                        '</div>';
                    homeView.insertBefore(resumeBanner, homeView.firstChild);
                }
            }
        }).catch(function(err) {
            console.error('初始化失败:', err);
            var overlay = document.getElementById('loadingOverlay');
            if (overlay) overlay.remove();
            // 回退：使用默认数据
            updateHome();
            document.addEventListener('keydown', A.handleQuizKeydown);
        });
    }

    // 暴露到 App
    A.switchView = switchView;
    A.updateHome = updateHome;
    A.renderWrongBook = renderWrongBook;
    A.removeWrong = removeWrong;
    A.renderStats = renderStats;
    A.renderAchievements = renderAchievements;
    A.showAchievementToast = showAchievementToast;
    A.editDailyGoal = editDailyGoal;
    A.setWrongSort = setWrongSort;
    A.init = init;

    // --- 主题切换 ---
    function switchTheme() {
        var d = A.db.get();
        var current = d.theme || 'dark';
        var next = current === 'dark' ? 'light' : 'dark';
        d.theme = next;
        A.db.setData(d);
        document.documentElement.setAttribute('data-theme', next);
        var btn = document.querySelector('.theme-toggle');
        if (btn) btn.textContent = next === 'dark' ? '🌙' : '☀️';
    }

    function applyTheme() {
        var d = A.db.get();
        var theme = d.theme || 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        var btn = document.querySelector('.theme-toggle');
        if (btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
    }

    A.switchTheme = switchTheme;
    A.applyTheme = applyTheme;

    // DOM 就绪后初始化
    window.addEventListener('DOMContentLoaded', init);
})(App);
