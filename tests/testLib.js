const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '../js');

let _cache = null;

function defaults() {
  return {
    history: [],
    wrong: [],
    stats: { total: 0, correct: 0, cats: {} },
    theme: 'dark',
    dailyGoal: 20,
    achievements: [],
    archive: []
  };
}

function reset() {
  _cache = null;
}

function get() {
  if (!_cache) _cache = defaults();
  return _cache;
}

function setData(data) {
  _cache = data;
}

var _questionBank = [];

function setQuestionBank(bank) {
  _questionBank = bank || [];
}

function findQ(qid) {
  for (var i = 0; i < _questionBank.length; i++) {
    if (_questionBank[i].id === qid) return _questionBank[i];
  }
  return null;
}

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

var SR_INTERVALS = [
  0,
  1 * 60 * 60 * 1000,
  1 * 24 * 60 * 60 * 1000,
  3 * 24 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
];

function addRecord(rec) {
  var d = get();
  d.history.push(rec);
  d.stats.total++;
  if (rec.ok) d.stats.correct++;
  var q = findQ(rec.qid);
  if (q) {
    if (!d.stats.cats[q.category]) d.stats.cats[q.category] = { t: 0, c: 0 };
    d.stats.cats[q.category].t++;
    if (rec.ok) d.stats.cats[q.category].c++;
  }
  if (d.history.length > 1000) {
    if (!d.archive) d.archive = [];
    var cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    var oldRecs = [];
    var newRecs = [];
    for (var i = 0; i < d.history.length; i++) {
      if (d.history[i].time < cutoff) oldRecs.push(d.history[i]);
      else newRecs.push(d.history[i]);
    }
    var dayMap = {};
    for (var j = 0; j < oldRecs.length; j++) {
      var dt = new Date(oldRecs[j].time);
      var key = dt.getFullYear() + '-' + (dt.getMonth() + 1) + '-' + dt.getDate();
      if (!dayMap[key]) dayMap[key] = { date: key, total: 0, correct: 0 };
      dayMap[key].total++;
      if (oldRecs[j].ok) dayMap[key].correct++;
    }
    var existingArchiveKeys = {};
    for (var a = 0; a < d.archive.length; a++) {
      existingArchiveKeys[d.archive[a].date] = true;
    }
    for (var k in dayMap) {
      if (!existingArchiveKeys[k]) {
        d.archive.push(dayMap[k]);
      }
    }
    d.history = newRecs;
  }
}

function addWrong(qid) {
  var d = get();
  var found = null;
  for (var i = 0; i < d.wrong.length; i++) {
    if (d.wrong[i].qid === qid) { found = d.wrong[i]; break; }
  }
  if (found) {
    found.cnt++;
    found.level = 0;
    found.lastReview = Date.now();
    found.nextReview = Date.now();
    found.time = found.time || Date.now();
  } else {
    d.wrong.push({
      qid: qid,
      cnt: 1,
      level: 0,
      time: Date.now(),
      lastReview: 0,
      nextReview: Date.now()
    });
  }
}

function reviewCorrect(qid) {
  var d = get();
  for (var i = 0; i < d.wrong.length; i++) {
    if (d.wrong[i].qid === qid) {
      var w = d.wrong[i];
      w.level++;
      w.lastReview = Date.now();
      if (w.level >= 5) {
        d.wrong.splice(i, 1);
        return { mastered: true, qid: qid };
      } else {
        w.nextReview = Date.now() + SR_INTERVALS[w.level];
        return { mastered: false, level: w.level, qid: qid };
      }
    }
  }
  return { mastered: false, qid: qid };
}

function reviewWrong(qid) {
  var d = get();
  for (var i = 0; i < d.wrong.length; i++) {
    if (d.wrong[i].qid === qid) {
      var w = d.wrong[i];
      w.level = 0;
      w.cnt++;
      w.lastReview = Date.now();
      w.nextReview = Date.now();
      return;
    }
  }
  addWrong(qid);
}

function removeWrong(qid) {
  var d = get();
  d.wrong = d.wrong.filter(function(w) { return w.qid !== qid; });
}

function getWrong() {
  return get().wrong;
}

function getDueWrong() {
  var now = Date.now();
  var wl = getWrong();
  var due = [];
  for (var i = 0; i < wl.length; i++) {
    if (!wl[i].nextReview || wl[i].nextReview <= now) {
      due.push(wl[i]);
    }
  }
  return due;
}

function recalcStats() {
  var d = get();
  var stats = { total: 0, correct: 0, cats: {} };
  for (var i = 0; i < d.history.length; i++) {
    var rec = d.history[i];
    stats.total++;
    if (rec.ok) stats.correct++;
    var q = findQ(rec.qid);
    if (q) {
      if (!stats.cats[q.category]) stats.cats[q.category] = { t: 0, c: 0 };
      stats.cats[q.category].t++;
      if (rec.ok) stats.cats[q.category].c++;
    }
  }
  d.stats = stats;
}

function getDailyGoal() {
  return get().dailyGoal || 20;
}

function setDailyGoal(n) {
  var d = get();
  d.dailyGoal = Math.max(5, Math.min(100, n));
}

function getStreak() {
  var d = get();
  var days = {};
  for (var i = 0; i < (d.history || []).length; i++) {
    var dt = new Date(d.history[i].time);
    days[dt.getFullYear() + '-' + dt.getMonth() + '-' + dt.getDate()] = true;
  }
  for (var j = 0; j < (d.archive || []).length; j++) {
    days[d.archive[j].date] = true;
  }
  if (Object.keys(days).length === 0) return 0;
  var streak = 0;
  var check = new Date();
  check.setHours(0, 0, 0, 0);
  var todayKey = check.getFullYear() + '-' + check.getMonth() + '-' + check.getDate();
  if (!days[todayKey]) check.setTime(check.getTime() - 86400000);
  while (true) {
    var key = check.getFullYear() + '-' + check.getMonth() + '-' + check.getDate();
    if (days[key]) {
      streak++;
      check.setTime(check.getTime() - 86400000);
    } else {
      break;
    }
  }
  return streak;
}

var ACHIEVEMENTS = [
  { id: 'first_answer', name: '初出茅庐', icon: '🌱', desc: '完成第1次答题' },
  { id: 'perfect_10', name: '十全十美', icon: '💯', desc: '单次10题全部答对' },
  { id: 'daily_50', name: '勤奋粉丝', icon: '🔥', desc: '单日答题50题' },
  { id: 'streak_3', name: '三日坚持', icon: '📅', desc: '连续答题3天' },
  { id: 'streak_7', name: '七日之约', icon: '🗓️', desc: '连续答题7天' },
  { id: 'total_100', name: '百题斩', icon: '⚔️', desc: '累计答题100题' },
  { id: 'total_500', name: '五百题王', icon: '👑', desc: '累计答题500题' },
  { id: 'acc_90', name: '资深JM', icon: '🎓', desc: '答满50题且正确率≥90%' },
  { id: 'wrong_clear', name: '错题清零', icon: '✨', desc: '错题本全部掌握' },
  { id: 'all_cats', name: '全能粉丝', icon: '🌈', desc: '所有分类都有答题记录' }
];

function checkAchievements(context) {
  var d = get();
  if (!d.achievements) d.achievements = [];
  var newUnlocks = [];

  function has(id) { return d.achievements.indexOf(id) !== -1; }
  function unlock(id) {
    if (!has(id)) {
      d.achievements.push(id);
      var def = null;
      for (var i = 0; i < ACHIEVEMENTS.length; i++) {
        if (ACHIEVEMENTS[i].id === id) { def = ACHIEVEMENTS[i]; break; }
      }
      if (def) newUnlocks.push(def);
    }
  }

  var total = d.stats.total;
  var correct = d.stats.correct;

  if (total >= 1) unlock('first_answer');
  if (total >= 100) unlock('total_100');
  if (total >= 500) unlock('total_500');
  if (total >= 50 && correct / total >= 0.9) unlock('acc_90');

  if (context && context.quizTotal >= 10 && context.quizCorrect === context.quizTotal) unlock('perfect_10');

  var today = new Date().setHours(0, 0, 0, 0);
  var todayCount = 0;
  for (var i = 0; i < d.history.length; i++) {
    if (d.history[i].time >= today) todayCount++;
  }
  if (todayCount >= 50) unlock('daily_50');

  var streak = getStreak();
  if (streak >= 3) unlock('streak_3');
  if (streak >= 7) unlock('streak_7');

  if (d.wrong.length === 0 && total > 0 && has('first_answer')) unlock('wrong_clear');

  var cats = d.stats.cats || {};
  var allCats = ['专辑', '歌曲', '个人信息', '获奖记录'];
  var hasAll = true;
  for (var c = 0; c < allCats.length; c++) {
    if (!cats[allCats[c]] || !cats[allCats[c]].t) { hasAll = false; break; }
  }
  if (hasAll) unlock('all_cats');

  return newUnlocks;
}

function getAchievementDefs() {
  return ACHIEVEMENTS;
}

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function fmtTime(ms) {
  var sec = Math.floor(ms / 1000);
  var m = Math.floor(sec / 60);
  var s = sec % 60;
  return m + '分' + s + '秒';
}

function parseOptions(optsText) {
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
  return options;
}

module.exports = {
  reset,
  get,
  setData,
  defaults,
  setQuestionBank,
  findQ,
  esc,
  addRecord,
  addWrong,
  reviewCorrect,
  reviewWrong,
  removeWrong,
  getWrong,
  getDueWrong,
  recalcStats,
  getDailyGoal,
  setDailyGoal,
  getStreak,
  checkAchievements,
  getAchievementDefs,
  shuffle,
  fmtTime,
  parseOptions,
  SR_INTERVALS
};
