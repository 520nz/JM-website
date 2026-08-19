// ============================================================
// quiz.js - 答题引擎
// 优化点：中断恢复、间隔重复逻辑、XSS转义、键盘快捷键
// ============================================================

var App = window.App || {};
(function(A) {
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

    // --- Web Audio 音效 ---
    var _audioCtx = null;
    var _soundEnabled = true;

    function getAudioCtx() {
        if (!_audioCtx) {
            try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { return null; }
        }
        return _audioCtx;
    }

    function playTone(freq, startTime, duration, type, volume) {
        var ctx = getAudioCtx();
        if (!ctx || !_soundEnabled) return;
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
        gain.gain.setValueAtTime(volume || 0.15, ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + duration);
    }

    function playCorrectSound() {
        // C5 -> E5 -> G5 上行琶音，清脆悦耳
        playTone(523.25, 0, 0.12, 'sine', 0.12);
        playTone(659.25, 0.06, 0.12, 'sine', 0.12);
        playTone(783.99, 0.12, 0.2, 'sine', 0.15);
    }

    function playWrongSound() {
        // E4 -> C4 下行低音，温和提示
        playTone(329.63, 0, 0.15, 'sine', 0.1);
        playTone(261.63, 0.08, 0.25, 'sine', 0.12);
    }

    function toggleSound() {
        _soundEnabled = !_soundEnabled;
        return _soundEnabled;
    }

    // --- 模式选择 ---
    function selectMode(m) {
        state.mode = m;
        var btns = document.querySelectorAll('.mode-btn');
        for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
        var t = document.querySelector('.mode-btn[data-mode="' + m + '"]');
        if (t) t.classList.add('active');
        // 模式切换后清除待恢复的会话
        A.session.clear();
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
        state.quiz = shuffle(A.QUESTION_BANK).slice(0, getCount());
        state.idx = 0;
        state.correctCount = 0;
        state.isWrongBookQuiz = false;
        A.session.clear();
        A.switchView('practice');
        startTimer();
        renderQ();
    }

    function showCategoryView() {
        var cats = {};
        for (var i = 0; i < A.QUESTION_BANK.length; i++) {
            var c = A.QUESTION_BANK[i].category;
            cats[c] = (cats[c] || 0) + 1;
        }
        var html = '';
        for (var name in cats) {
            html += '<div class="category-item" onclick="App.startCatQuiz(\'' + A.escJsStr(name) + '\')">' +
                    '<span class="category-name">' + A.esc(name) + '</span>' +
                    '<span class="category-count">' + cats[name] + '题</span></div>';
        }
        document.getElementById('categoryList').innerHTML = html;
        A.switchView('category');
    }

    function startCatQuiz(cat) {
        var f = [];
        for (var i = 0; i < A.QUESTION_BANK.length; i++) {
            if (A.QUESTION_BANK[i].category === cat) f.push(A.QUESTION_BANK[i]);
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
        A.session.clear();
        A.switchView('practice');
        startTimer();
        renderQ();
    }

    // --- 错题本复习（间隔重复） ---
    function startWrongBookQuiz() {
        // 优先获取到期错题
        var dueWrong = A.db.getDueWrong();
        var wrongList = dueWrong.length > 0 ? dueWrong : A.db.getWrong();
        var qs = [];
        for (var i = 0; i < wrongList.length; i++) {
            var q = A.db.findQ(wrongList[i].qid);
            if (q) qs.push(q);
        }
        if (qs.length === 0) return;
        state.quiz = shuffle(qs);
        state.idx = 0;
        state.correctCount = 0;
        state.isWrongBookQuiz = true;
        A.session.clear();
        A.switchView('practice');
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
        A.session.save(state);

        var q = state.quiz[state.idx];
        var pct = Math.round(state.idx / state.quiz.length * 100);
        var sec = Math.floor((Date.now() - state.startTime) / 1000);
        var tm = Math.floor(sec / 60);
        var ts = sec % 60;

        var html = '<div class="progress-wrap"><div class="progress-header">' +
                   '<span class="progress-text">' + (state.idx + 1) + ' / ' + state.quiz.length + '</span>' +
                   '<span class="timer-badge">⏱ <span id="timerVal">' + tm + ':' + (ts < 10 ? '0' : '') + ts + '</span></span>' +
                   '</div><div class="progress-bar-bg"><div class="progress-bar" style="width:' + pct + '%"></div></div></div>';

        html += '<div class="question-card"><div class="question-text">' + A.esc(q.question) + '</div>';
        for (var i = 0; i < q.options.length; i++) {
            var o = q.options[i];
            html += '<div class="option-item" onclick="App.pickOption(\'' + A.escJsStr(o.key) + '\')" id="opt-' + A.esc(o.key) + '">' +
                    '<span class="option-key">' + A.esc(o.key) + '</span><span>' + A.esc(o.text) + '</span></div>';
        }
        html += '<div class="feedback" id="fb"><div class="feedback-title" id="fbTitle"></div><div class="feedback-desc" id="fbDesc"></div></div></div>';
        html += '<div class="bottom-bar"><button class="btn" id="nextBtn" onclick="App.nextQ()" style="display:none;">下一题</button><button class="btn btn-outline" onclick="App.quitQuiz()">返回首页</button></div>';
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

        // 播放音效
        if (ok) { playCorrectSound(); } else { playWrongSound(); }

        // 记录答题
        A.db.addRecord({ qid: q.id, ans: key, ok: ok, time: Date.now() });

        // 间隔重复：错题本复习模式下更新复习状态
        var reviewResult = null;
        if (state.isWrongBookQuiz) {
            if (ok) {
                reviewResult = A.db.reviewCorrect(q.id);
            } else {
                A.db.reviewWrong(q.id);
            }
        } else {
            // 普通模式：答错加入错题本
            if (!ok) A.db.addWrong(q.id);
        }

        // 更新选项样式 + 微动效
        for (var i = 0; i < q.options.length; i++) {
            var el = document.getElementById('opt-' + q.options[i].key);
            el.classList.add('disabled');
            if (q.options[i].key === q.answer) {
                el.classList.add('correct');
                // 答对脉冲动画
                el.style.animation = 'pulse-correct 0.3s cubic-bezier(0.34,1.56,0.64,1)';
                setTimeout(function(e) { e.style.animation = ''; }.bind(null, el), 350);
            }
            else if (q.options[i].key === key && !ok) {
                el.classList.add('wrong');
                // 答错抖动动画
                el.style.animation = 'shake-wrong 0.25s ease';
                setTimeout(function(e) { e.style.animation = ''; }.bind(null, el), 300);
                // 移动端震动
                if (navigator.vibrate) navigator.vibrate(80);
            }
        }

        // 显示反馈
        var fb = document.getElementById('fb');
        fb.className = 'feedback show ' + (ok ? 'correct' : 'wrong');
        document.getElementById('fbTitle').textContent = ok ? '✓ 回答正确！' : '✗ 回答错误';
        // 斩题提示：掌握时显示特殊信息
        if (reviewResult && reviewResult.mastered) {
            document.getElementById('fbDesc').textContent = q.explanation + ' 🎉 已掌握此题，从错题本移除！';
        } else if (reviewResult && !reviewResult.mastered && state.isWrongBookQuiz) {
            document.getElementById('fbDesc').textContent = q.explanation + ' （复习等级提升至 Lv.' + reviewResult.level + '）';
        } else {
            document.getElementById('fbDesc').textContent = q.explanation;
        }
        document.getElementById('nextBtn').style.display = 'inline-block';
    }

    // --- 下一题 / 退出 / 完成 ---
    function nextQ() {
        state.idx++;
        renderQ();
    }

    function quitQuiz() {
        stopTimer();
        A.session.clear();
        A.switchView('home');
    }

    function finishQuiz() {
        stopTimer();
        A.session.clear();
        var elapsed = Date.now() - state.startTime;
        var total = state.quiz.length;
        var correct = state.correctCount;
        var wrong = total - correct;
        var pct = total > 0 ? Math.round(correct / total * 100) : 0;

        // 保存成绩供分享使用
        state.lastResult = {
            total: total, correct: correct, wrong: wrong,
            pct: pct, elapsed: elapsed,
            mode: state.isWrongBookQuiz ? '错题复习' : ({quick:'快速',standard:'标准',intensive:'强化'})[state.mode] || '快速'
        };

        // 检查成就徽章
        var newUnlocks = A.db.checkAchievements({ quizTotal: total, quizCorrect: correct });
        if (newUnlocks && newUnlocks.length > 0) {
            newUnlocks.forEach(function(a, i) {
                setTimeout(function() { A.showAchievementToast(a); }, 600 * (i + 1));
            });
        }

        var html = '<div class="card finish-card"><div class="finish-icon">🎉</div><h2>答题完成！</h2>' +
                   '<div class="finish-stats">' +
                   '<div class="finish-stat"><div class="val green">' + correct + '</div><div class="lbl">正确</div></div>' +
                   '<div class="finish-stat"><div class="val red">' + wrong + '</div><div class="lbl">错误</div></div>' +
                   '<div class="finish-stat"><div class="val">' + pct + '%</div><div class="lbl">正确率</div></div>' +
                   '<div class="finish-stat"><div class="val">' + fmtTime(elapsed) + '</div><div class="lbl">用时</div></div>' +
                   '</div>' +
                   '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:12px;">' +
                   '<button class="btn btn-sm" onclick="App.shareResultCard()">📸 分享成绩卡片</button>' +
                   '<button class="btn btn-sm btn-outline" onclick="App.copyResultText()">📋 复制成绩文案</button>' +
                   '</div>' +
                   '<button class="btn" onclick="App.switchView(\'home\')">返回首页</button></div>';
        document.getElementById('quizArea').innerHTML = html;
    }

    // --- 成绩分享卡片（Canvas 绘制 + PNG 下载） ---
    function shareResultCard() {
        var r = state.lastResult;
        if (!r) return;

        var canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 340;
        var ctx = canvas.getContext('2d');

        // 背景渐变
        var grad = ctx.createLinearGradient(0, 0, 600, 340);
        grad.addColorStop(0, '#0F0A1A');
        grad.addColorStop(0.5, '#150D22');
        grad.addColorStop(1, '#1A0F2E');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 600, 340);

        // 顶部紫色装饰条
        var barGrad = ctx.createLinearGradient(0, 0, 600, 0);
        barGrad.addColorStop(0, '#8B5CF6');
        barGrad.addColorStop(1, '#F472B6');
        ctx.fillStyle = barGrad;
        ctx.fillRect(0, 0, 600, 6);

        // 标题
        ctx.fillStyle = '#F5F5F5';
        ctx.font = 'bold 26px -apple-system, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🎵 林俊杰粉丝答题', 300, 52);

        // 模式 + 日期
        ctx.fillStyle = '#B8B8C8';
        ctx.font = '15px -apple-system, "Segoe UI", sans-serif';
        var now = new Date();
        var dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
        ctx.fillText(r.mode + '模式 · ' + dateStr, 300, 82);

        // 大正确率数字
        var pctColor = r.pct >= 80 ? '#10B981' : (r.pct >= 60 ? '#F472B6' : '#EF4444');
        ctx.fillStyle = pctColor;
        ctx.font = 'bold 72px -apple-system, "Segoe UI", sans-serif';
        ctx.fillText(r.pct + '%', 300, 170);

        ctx.fillStyle = '#B8B8C8';
        ctx.font = '14px -apple-system, "Segoe UI", sans-serif';
        ctx.fillText('正确率', 300, 196);

        // 三项数据
        ctx.font = 'bold 22px -apple-system, "Segoe UI", sans-serif';
        ctx.fillStyle = '#10B981';
        ctx.fillText(String(r.correct), 170, 250);
        ctx.fillStyle = '#EF4444';
        ctx.fillText(String(r.wrong), 300, 250);
        ctx.fillStyle = '#F5F5F5';
        ctx.fillText(fmtTime(r.elapsed), 430, 250);

        ctx.font = '12px -apple-system, "Segoe UI", sans-serif';
        ctx.fillStyle = '#B8B8C8';
        ctx.fillText('正确', 170, 272);
        ctx.fillText('错误', 300, 272);
        ctx.fillText('用时', 430, 272);

        // 底部话题标签
        ctx.fillStyle = '#8B5CF6';
        ctx.font = '13px -apple-system, "Segoe UI", sans-serif';
        ctx.fillText('#林俊杰答题挑战#', 300, 315);

        // 下载 PNG
        canvas.toBlob(function(blob) {
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'JJ答题成绩_' + dateStr + '.png';
            a.click();
            URL.revokeObjectURL(url);
        }, 'image/png');
    }

    // --- 复制成绩文案 ---
    function copyResultText() {
        var r = state.lastResult;
        if (!r) return;
        var text = '【林俊杰粉丝答题】' + r.mode + '模式 ' + r.total + '题，正确率 ' + r.pct + '%（对' + r.correct + '错' + r.wrong + '），用时 ' + fmtTime(r.elapsed) + ' 来挑战 👉 https://cdn.jsdelivr.net/gh/520nz/JM-website@main/index.html #林俊杰答题挑战#';
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function() {
                showCopyToast();
            }).catch(function() {
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); showCopyToast(); } catch(e) {}
        document.body.removeChild(ta);
    }

    function showCopyToast() {
        var toast = document.createElement('div');
        toast.className = 'copy-toast';
        toast.textContent = '✓ 已复制到剪贴板';
        document.body.appendChild(toast);
        setTimeout(function() { toast.classList.add('show'); }, 10);
        setTimeout(function() {
            toast.classList.remove('show');
            setTimeout(function() { toast.remove(); }, 300);
        }, 2000);
    }

    // --- 答题中断恢复 ---
    function tryResumeSession() {
        var saved = A.session.load();
        if (!saved || !saved.quizIds || saved.quizIds.length === 0) return false;

        // 根据 ID 重建题目列表
        var qs = [];
        for (var i = 0; i < saved.quizIds.length; i++) {
            var q = A.db.findQ(saved.quizIds[i]);
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
            A.session.clear();
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
                   '<button class="btn" style="max-width:200px;margin:0 auto 12px;" onclick="App.resumeSession()">继续答题</button>' +
                   '<button class="btn btn-outline" style="max-width:200px;margin:0 auto;" onclick="App.discardSession()">重新开始</button>' +
                   '</div>';
        document.getElementById('quizArea').innerHTML = html;
    }

    function resumeSession() {
        if (tryResumeSession()) {
            A.switchView('practice');
            startTimer();
            renderQ();
        } else {
            A.session.clear();
            A.switchView('home');
        }
    }

    function discardSession() {
        A.session.clear();
        state.quiz = [];
        state.idx = 0;
        A.switchView('home');
    }

    // --- 键盘快捷键 ---
    function handleQuizKeydown(e) {
        // 只在答题视图且未回答时响应
        var practiceView = document.getElementById('view-practice');
        if (!practiceView || !practiceView.classList.contains('active')) return;

        if (state.answered) {
            // 已回答，按空格/回车进入下一题
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                if (state.idx < state.quiz.length) nextQ();
            }
            return;
        }

        // 未回答，按 A/B/C/D 选择
        var key = e.key.toUpperCase();
        if (key >= 'A' && key <= 'D') {
            var q = state.quiz[state.idx];
            if (q) {
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

    // --- 暴露到 App ---
    A.state = state;
    A.selectMode = selectMode;
    A.startRandomQuiz = startRandomQuiz;
    A.showCategoryView = showCategoryView;
    A.startCatQuiz = startCatQuiz;
    A.startWrongBookQuiz = startWrongBookQuiz;
    A.renderQ = renderQ;
    A.pickOption = pickOption;
    A.nextQ = nextQ;
    A.quitQuiz = quitQuiz;
    A.finishQuiz = finishQuiz;
    A.tryResumeSession = tryResumeSession;
    A.showResumePrompt = showResumePrompt;
    A.resumeSession = resumeSession;
    A.discardSession = discardSession;
    A.handleQuizKeydown = handleQuizKeydown;
    A.startTimer = startTimer;
    A.stopTimer = stopTimer;
    A.shuffle = shuffle;
    A.playCorrectSound = playCorrectSound;
    A.playWrongSound = playWrongSound;
    A.toggleSound = toggleSound;
    A.shareResultCard = shareResultCard;
    A.copyResultText = copyResultText;
})(App);
