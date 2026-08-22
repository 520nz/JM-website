// ============================================================
// admin.js - 题库管理 + 数据导入导出
// 优化点：XSS转义、导入stats重算（不再累加）、间隔重复数据兼容
// ============================================================

var App = window.App || {};

(function(A) {
    // --- 管理页面渲染 ---
    function renderAdmin() {
        updateCategoryFilter();
        updateEditCategoryOptions();
        renderQuestionList();
    }

    function updateCategoryFilter() {
        var cats = {};
        for (var i = 0; i < A.QUESTION_BANK.length; i++) {
            cats[A.QUESTION_BANK[i].category] = true;
        }
        var sel = document.getElementById('categoryFilter');
        var cur = sel.value;
        var opts = '<option value="">全部类别</option>';
        var keys = Object.keys(cats).sort();
        for (var j = 0; j < keys.length; j++) {
            opts += '<option value="' + A.esc(keys[j]) + '"' + (keys[j] === cur ? ' selected' : '') + '>' + A.esc(keys[j]) + '</option>';
        }
        sel.innerHTML = opts;
    }

    function updateEditCategoryOptions() {
        var cats = {};
        for (var i = 0; i < A.QUESTION_BANK.length; i++) {
            cats[A.QUESTION_BANK[i].category] = true;
        }
        var sel = document.getElementById('editCategory');
        var keys = Object.keys(cats).sort();
        var opts = '';
        for (var j = 0; j < keys.length; j++) {
            opts += '<option value="' + A.esc(keys[j]) + '">' + A.esc(keys[j]) + '</option>';
        }
        sel.innerHTML = opts;
    }

    var _adminPage = 1;
    var _adminPageSize = 30;

    function renderQuestionList() {
        var search = document.getElementById('searchInput').value.toLowerCase();
        var catFilter = document.getElementById('categoryFilter').value;
        // 先过滤
        var filtered = [];
        for (var i = 0; i < A.QUESTION_BANK.length; i++) {
            var q = A.QUESTION_BANK[i];
            if (catFilter && q.category !== catFilter) continue;
            if (search && q.question.toLowerCase().indexOf(search) === -1) continue;
            filtered.push(q);
        }
        // 分页
        var totalPages = Math.max(1, Math.ceil(filtered.length / _adminPageSize));
        if (_adminPage > totalPages) _adminPage = totalPages;
        var start = (_adminPage - 1) * _adminPageSize;
        var end = Math.min(start + _adminPageSize, filtered.length);
        var html = '';
        for (var j = start; j < end; j++) {
            var q = filtered[j];
            html += '<div class="q-item">';
            html += '<div class="q-item-header">';
            html += '<span class="q-item-cat">' + A.esc(q.category) + '</span>';
            html += '<div class="q-item-actions">';
            html += '<button class="btn btn-outline btn-sm" onclick="App.showEditForm(\'' + A.esc(q.id) + '\')">编辑</button>';
            html += '<button class="btn btn-outline btn-sm" style="border-color:var(--error);color:var(--error);" onclick="App.deleteQuestion(\'' + A.esc(q.id) + '\')">删除</button>';
            html += '</div></div>';
            html += '<div class="q-item-text">' + A.esc(q.question) + '</div>';
            html += '<div class="q-item-answer">答案: ' + A.esc(q.answer) + '</div>';
            html += '</div>';
        }
        // 分页控件
        if (totalPages > 1) {
            html += '<div style="display:flex;justify-content:center;align-items:center;gap:8px;margin-top:12px;">';
            html += '<button class="btn btn-sm btn-outline" onclick="App.adminPrevPage()" ' + (_adminPage <= 1 ? 'disabled style="opacity:0.4;"' : '') + '>上一页</button>';
            html += '<span style="font-size:13px;color:var(--text2);">' + _adminPage + ' / ' + totalPages + ' 页（共' + filtered.length + '题）</span>';
            html += '<button class="btn btn-sm btn-outline" onclick="App.adminNextPage()" ' + (_adminPage >= totalPages ? 'disabled style="opacity:0.4;"' : '') + '>下一页</button>';
            html += '</div>';
        }
        document.getElementById('questionList').innerHTML = html || '<div class="empty"><p>暂无题目</p></div>';
    }

    function adminPrevPage() { if (_adminPage > 1) { _adminPage--; renderQuestionList(); } }
    function adminNextPage() { _adminPage++; renderQuestionList(); }

    function filterQuestions() {
        _adminPage = 1;
        renderQuestionList();
    }

    // --- 题目 CRUD ---
    function showAddForm() {
        document.getElementById('modalTitle').textContent = '新增题目';
        document.getElementById('editId').value = '';
        document.getElementById('editCategory').value = '专辑';
        document.getElementById('editQuestion').value = '';
        document.getElementById('editOptions').value = 'A.\nB.\nC.\nD.';
        document.getElementById('editAnswer').value = 'A';
        document.getElementById('editExplanation').value = '';
        document.getElementById('editModal').style.display = 'block';
    }

    function showEditForm(qid) {
        var q = null;
        for (var i = 0; i < A.QUESTION_BANK.length; i++) {
            if (A.QUESTION_BANK[i].id === qid) { q = A.QUESTION_BANK[i]; break; }
        }
        if (!q) return;
        document.getElementById('modalTitle').textContent = '编辑题目';
        document.getElementById('editId').value = q.id;
        document.getElementById('editCategory').value = q.category;
        document.getElementById('editQuestion').value = q.question;
        var opts = '';
        for (var j = 0; j < q.options.length; j++) {
            opts += q.options[j].key + '.' + q.options[j].text + '\n';
        }
        document.getElementById('editOptions').value = opts.trim();
        document.getElementById('editAnswer').value = q.answer;
        document.getElementById('editExplanation').value = q.explanation;
        document.getElementById('editModal').style.display = 'block';
    }

    function closeModal() {
        document.getElementById('editModal').style.display = 'none';
    }

    function saveQuestion() {
        var id = document.getElementById('editId').value;
        var category = document.getElementById('editCategory').value;
        var question = document.getElementById('editQuestion').value.trim();
        var optsText = document.getElementById('editOptions').value.trim();
        var answer = document.getElementById('editAnswer').value;
        var explanation = document.getElementById('editExplanation').value.trim();

        if (!question || !optsText) {
            alert('请填写题目和选项');
            return;
        }

        // 解析选项
        var lines = optsText.split('\n');
        var options = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            var match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
            if (match) {
                options.push({ key: match[1], text: match[2] });
            }
        }

        if (options.length < 2) {
            alert('请至少输入两个选项，格式：A.选项内容');
            return;
        }

        if (!id) {
            // 新增
            var newId = 'q' + Date.now();
            A.QUESTION_BANK.push({
                id: newId,
                category: category,
                question: question,
                options: options,
                answer: answer,
                explanation: explanation
            });
        } else {
            // 编辑
            for (var j = 0; j < A.QUESTION_BANK.length; j++) {
                if (A.QUESTION_BANK[j].id === id) {
                    A.QUESTION_BANK[j].category = category;
                    A.QUESTION_BANK[j].question = question;
                    A.QUESTION_BANK[j].options = options;
                    A.QUESTION_BANK[j].answer = answer;
                    A.QUESTION_BANK[j].explanation = explanation;
                    break;
                }
            }
        }

        A.store.save();
        closeModal();
        renderQuestionList();
    }

    function deleteQuestion(qid) {
        if (!confirm('确定删除此题目？')) return;
        A.QUESTION_BANK = A.QUESTION_BANK.filter(function(q) { return q.id !== qid; });
        A.store.save();
        renderQuestionList();
    }

    // --- 数据导出 ---
    function exportData() {
        var data = {
            questionBank: A.QUESTION_BANK,
            userData: A.db.get(),
            exportTime: new Date().toISOString()
        };
        var json = JSON.stringify(data, null, 2);
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'jj_quiz_backup_' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        URL.revokeObjectURL(url);
        alert('数据已导出！');
    }

    // --- 数据导入（修复 stats 累加问题） ---
    function importData(event) {
        var file = event.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(e) {
            var data;
            try {
                data = JSON.parse(e.target.result);
            } catch (err) {
                alert('导入失败：文件格式不正确，请确保上传有效的JSON文件');
                return;
            }
            if (!data.questionBank && !data.userData) {
                alert('导入失败：文件中未找到有效数据（questionBank 或 userData）');
                return;
            }

            var addedCount = 0;
            var updatedCount = 0;

            // 导入题库
            if (data.questionBank) {
                var existingIds = {};
                for (var i = 0; i < A.QUESTION_BANK.length; i++) {
                    existingIds[A.QUESTION_BANK[i].id] = true;
                }
                for (var j = 0; j < data.questionBank.length; j++) {
                    var q = data.questionBank[j];
                    if (existingIds[q.id]) {
                        for (var k = 0; k < A.QUESTION_BANK.length; k++) {
                            if (A.QUESTION_BANK[k].id === q.id) {
                                A.QUESTION_BANK[k] = q;
                                updatedCount++;
                                break;
                            }
                        }
                    } else {
                        A.QUESTION_BANK.push(q);
                        addedCount++;
                    }
                }
                A.store.save();
            }

            // 导入用户数据（合并 history/wrong/achievements/archive/设置）
            if (data.userData) {
                var existingData = A.db.get();

                // 1. 合并答题历史（按 qid+time 去重，避免多次导入产生重复）
                if (data.userData.history && data.userData.history.length > 0) {
                    var histKeySet = {};
                    for (var h = 0; h < existingData.history.length; h++) {
                        var r = existingData.history[h];
                        histKeySet[r.qid + '_' + r.time] = true;
                    }
                    for (var nh = 0; nh < data.userData.history.length; nh++) {
                        var nr = data.userData.history[nh];
                        var nkey = nr.qid + '_' + nr.time;
                        if (!histKeySet[nkey]) {
                            existingData.history.push(nr);
                            histKeySet[nkey] = true;
                        }
                    }
                }

                // 2. 合并错题本（含间隔重复数据）
                if (data.userData.wrong) {
                    var wrongMap = {};
                    for (var w = 0; w < existingData.wrong.length; w++) {
                        wrongMap[existingData.wrong[w].qid] = existingData.wrong[w];
                    }
                    for (var x = 0; x < data.userData.wrong.length; x++) {
                        var wrongItem = data.userData.wrong[x];
                        if (wrongMap[wrongItem.qid]) {
                            // 合并：取较高的错误次数，保留较低复习等级（更保守）
                            wrongMap[wrongItem.qid].cnt = Math.max(wrongMap[wrongItem.qid].cnt, wrongItem.cnt || 1);
                            if (wrongItem.level != null) {
                                wrongMap[wrongItem.qid].level = Math.min(wrongMap[wrongItem.qid].level || 0, wrongItem.level);
                            }
                            // 取更早的添加时间、更晚的复习时间
                            if (wrongItem.time && wrongItem.time < (wrongMap[wrongItem.qid].time || Infinity)) {
                                wrongMap[wrongItem.qid].time = wrongItem.time;
                            }
                            if (wrongItem.lastReview && wrongItem.lastReview > (wrongMap[wrongItem.qid].lastReview || 0)) {
                                wrongMap[wrongItem.qid].lastReview = wrongItem.lastReview;
                            }
                            if (wrongItem.nextReview && wrongItem.nextReview < (wrongMap[wrongItem.qid].nextReview || Infinity)) {
                                wrongMap[wrongItem.qid].nextReview = wrongItem.nextReview;
                            }
                        } else {
                            // 新错题，确保有间隔重复字段
                            if (!wrongItem.level) wrongItem.level = 0;
                            if (!wrongItem.nextReview) wrongItem.nextReview = Date.now();
                            if (!wrongItem.lastReview) wrongItem.lastReview = 0;
                            if (!wrongItem.time) wrongItem.time = Date.now();
                            existingData.wrong.push(wrongItem);
                        }
                    }
                }

                // 3. 合并归档数据（按日期累加）
                if (data.userData.archive && data.userData.archive.length > 0) {
                    if (!existingData.archive) existingData.archive = [];
                    var archMap = {};
                    for (var ae = 0; ae < existingData.archive.length; ae++) {
                        archMap[existingData.archive[ae].date] = existingData.archive[ae];
                    }
                    for (var ai = 0; ai < data.userData.archive.length; ai++) {
                        var ia = data.userData.archive[ai];
                        if (archMap[ia.date]) {
                            archMap[ia.date].total += ia.total || 0;
                            archMap[ia.date].correct += ia.correct || 0;
                        } else {
                            var newArch = { date: ia.date, total: ia.total || 0, correct: ia.correct || 0 };
                            existingData.archive.push(newArch);
                            archMap[ia.date] = newArch;
                        }
                    }
                }

                // 4. 合并成就徽章（取并集，保留已解锁的）
                if (data.userData.achievements && data.userData.achievements.length > 0) {
                    if (!existingData.achievements) existingData.achievements = [];
                    var achSet = {};
                    for (var aae = 0; aae < existingData.achievements.length; aae++) {
                        achSet[existingData.achievements[aae]] = true;
                    }
                    for (var aai = 0; aai < data.userData.achievements.length; aai++) {
                        if (!achSet[data.userData.achievements[aai]]) {
                            existingData.achievements.push(data.userData.achievements[aai]);
                            achSet[data.userData.achievements[aai]] = true;
                        }
                    }
                }

                // 5. 合并偏好设置（仅当导入值更完善时覆盖）
                if (data.userData.theme && !existingData.theme) {
                    existingData.theme = data.userData.theme;
                }
                if (data.userData.dailyGoal && (!existingData.dailyGoal || existingData.dailyGoal === 20)) {
                    existingData.dailyGoal = data.userData.dailyGoal;
                }

                // 从合并后的 history 重新计算 stats（不再累加）
                A.db.recalcStats();
            }

            var msg = '数据导入成功！';
            if (addedCount > 0 || updatedCount > 0) {
                msg += '\n题目：新增 ' + addedCount + ' 道，更新 ' + updatedCount + ' 道';
            }
            alert(msg);
            try { A.updateHome(); } catch (e) {}
            try { renderQuestionList(); } catch (e) {}
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    // --- 恢复默认题库 ---
    function showResetConfirm() {
        var modal = document.getElementById('resetModal');
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        document.getElementById('resetConfirmInput').value = '';
        checkResetInput();
    }

    function closeResetModal() {
        document.getElementById('resetModal').style.display = 'none';
    }

    function checkResetInput() {
        var input = document.getElementById('resetConfirmInput').value;
        var btn = document.getElementById('resetConfirmBtn');
        if (input === '恢复默认') {
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
        } else {
            btn.style.opacity = '0.5';
            btn.style.pointerEvents = 'none';
        }
    }

    function resetQuestionBank() {
        A.store.reset();
        closeResetModal();
        alert('已恢复为默认题库，共 ' + A.QUESTION_BANK.length + ' 道题目');
        try { renderQuestionList(); } catch (e) {}
        try { updateCategoryFilter(); } catch (e) {}
    }

    // --- 暴露到 App ---
    A.renderAdmin = renderAdmin;
    A.filterQuestions = filterQuestions;
    A.adminPrevPage = adminPrevPage;
    A.adminNextPage = adminNextPage;
    A.showAddForm = showAddForm;
    A.showEditForm = showEditForm;
    A.closeModal = closeModal;
    A.saveQuestion = saveQuestion;
    A.deleteQuestion = deleteQuestion;
    A.exportData = exportData;
    A.importData = importData;
    A.showResetConfirm = showResetConfirm;
    A.closeResetModal = closeResetModal;
    A.checkResetInput = checkResetInput;
    A.resetQuestionBank = resetQuestionBank;
    A.updateCategoryFilter = updateCategoryFilter;
    A.updateEditCategoryOptions = updateEditCategoryOptions;
    A.renderQuestionList = renderQuestionList;
})(App);
