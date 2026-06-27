// 林俊杰答题应用核心逻辑模块

// 默认题库数据（冻结以防止修改）
var DEFAULT_QUESTION_BANK = Object.freeze([
  // 专辑类题目
  Object.freeze({id:"001",category:"专辑",question:"林俊杰首张专辑《乐行者》发行于哪一天？",options:Object.freeze([{key:"A",text:"2003年4月1日"},{key:"B",text:"2003年4月10日"},{key:"C",text:"2003年5月1日"},{key:"D",text:"2003年5月10日"}]),answer:"B",explanation:"《乐行者》于2003年4月10日正式发行，这也是林俊杰的出道专辑。"}),
  Object.freeze({id:"005",category:"专辑",question:"《第二天堂》（俗称《江南》专辑）发行于哪一年？",options:Object.freeze([{key:"A",text:"2003年"},{key:"B",text:"2004年"},{key:"C",text:"2005年"},{key:"D",text:"2006年"}]),answer:"B",explanation:"《第二天堂》于2004年6月4日发行，包含热门歌曲《江南》。"}),
  Object.freeze({id:"009",category:"专辑",question:"《编号89757》专辑的灵感来源于？",options:Object.freeze([{key:"A",text:"电话号码"},{key:"B",text:"机器人编号"},{key:"C",text:"房间号"},{key:"D",text:"日期"}]),answer:"B",explanation:"89757是机器人编号，专辑以此概念为主题，讲述机器人爱上人类的故事。"}),
  Object.freeze({id:"013",category:"专辑",question:"林俊杰2006年发行的专辑名称是？",options:Object.freeze([{key:"A",text:"第二天堂"},{key:"B",text:"编号89757"},{key:"C",text:"曹操"},{key:"D",text:"西界"}]),answer:"C",explanation:"《曹操》于2006年2月17日发行，是林俊杰的第四张专辑。"}),
  Object.freeze({id:"017",category:"专辑",question:"《西界》专辑发行于哪一年？",options:Object.freeze([{key:"A",text:"2005年"},{key:"B",text:"2006年"},{key:"C",text:"2007年"},{key:"D",text:"2008年"}]),answer:"C",explanation:"《西界》于2007年6月29日发行，是林俊杰的第五张专辑。"}),
  Object.freeze({id:"021",category:"专辑",question:"《JJ陆》的英文名是？",options:Object.freeze([{key:"A",text:"One Shot"},{key:"B",text:"Sixology"},{key:"C",text:"Born to Dream"},{key:"D",text:"The One"}]),answer:"B",explanation:"Sixology代表第六张专辑，是林俊杰的第六张专辑。"}),
  Object.freeze({id:"025",category:"专辑",question:"《100天》专辑发行于哪一年？",options:Object.freeze([{key:"A",text:"2008年"},{key:"B",text:"2009年"},{key:"C",text:"2010年"},{key:"D",text:"2011年"}]),answer:"B",explanation:"《100天》于2009年12月18日发行。"}),
  Object.freeze({id:"029",category:"专辑",question:"《她说》专辑的发行年份是？",options:Object.freeze([{key:"A",text:"2009年"},{key:"B",text:"2010年"},{key:"C",text:"2011年"},{key:"D",text:"2012年"}]),answer:"B",explanation:"《她说》于2010年12月8日发行。"}),
  Object.freeze({id:"033",category:"专辑",question:"《学不会》专辑发行于？",options:Object.freeze([{key:"A",text:"2010年"},{key:"B",text:"2011年"},{key:"C",text:"2012年"},{key:"D",text:"2013年"}]),answer:"B",explanation:"《学不会》于2011年12月31日发行，是林俊杰的第九张专辑。"}),
  Object.freeze({id:"037",category:"专辑",question:"《因你而在》专辑发行于哪一年？",options:Object.freeze([{key:"A",text:"2012年"},{key:"B",text:"2013年"},{key:"C",text:"2014年"},{key:"D",text:"2015年"}]),answer:"B",explanation:"《因你而在》于2013年3月13日发行。"}),
  Object.freeze({id:"041",category:"专辑",question:"《新地球》专辑发行于哪一年？",options:Object.freeze([{key:"A",text:"2013年"},{key:"B",text:"2014年"},{key:"C",text:"2015年"},{key:"D",text:"2016年"}]),answer:"B",explanation:"《新地球》于2014年12月27日发行。"}),
  Object.freeze({id:"045",category:"专辑",question:"《和自己对话》专辑发行于？",options:Object.freeze([{key:"A",text:"2014年"},{key:"B",text:"2015年"},{key:"C",text:"2016年"},{key:"D",text:"2017年"}]),answer:"B",explanation:"《和自己对话》于2015年12月25日发行，是林俊杰的首张实验专辑。"}),
  Object.freeze({id:"049",category:"专辑",question:"《伟大的渺小》专辑发行于哪一年？",options:Object.freeze([{key:"A",text:"2016年"},{key:"B",text:"2017年"},{key:"C",text:"2018年"},{key:"D",text:"2019年"}]),answer:"B",explanation:"《伟大的渺小》于2017年12月28日发行。"}),
  Object.freeze({id:"053",category:"专辑",question:"《幸存者·如你》专辑发行于？",options:Object.freeze([{key:"A",text:"2017年"},{key:"B",text:"2018年"},{key:"C",text:"2019年"},{key:"D",text:"2020年"}]),answer:"B",explanation:"《幸存者·如你》于2018年10月5日发行。"}),
  Object.freeze({id:"057",category:"专辑",question:"《重拾_快乐》专辑发行于？",options:Object.freeze([{key:"A",text:"2022年"},{key:"B",text:"2023年"},{key:"C",text:"2024年"},{key:"D",text:"2025年"}]),answer:"B",explanation:"《重拾_快乐》于2023年4月21日发行，是林俊杰的最新专辑。"})
]);

// 当前题库（可被修改）
var QUESTION_BANK = [];

// 初始化题库函数
function initializeQuestionBank() {
  QUESTION_BANK = DEFAULT_QUESTION_BANK.map(function(q) {
    return {
      id: q.id,
      category: q.category,
      question: q.question,
      options: q.options.map(function(opt) {
        return { key: opt.key, text: opt.text };
      }),
      answer: q.answer,
      explanation: q.explanation
    };
  });
}

// 模块加载时初始化题库
initializeQuestionBank();

// DB 模块 - localStorage 操作
var DB = {
  KEY: 'jj_quiz_v2',
  QBANK_KEY: 'jj_question_bank',
  
  get: function() {
    var d = localStorage.getItem(DB.KEY);
    return d ? JSON.parse(d) : DB.defaults();
  },
  
  defaults: function() {
    return {
      history: [],
      wrong: [],
      stats: { total: 0, correct: 0, cats: {} }
    };
  },
  
  save: function(d) {
    localStorage.setItem(DB.KEY, JSON.stringify(d));
  },
  
  addRecord: function(rec) {
    var d = DB.get();
    d.history.push(rec);
    d.stats.total++;
    if (rec.ok) d.stats.correct++;
    var q = DB.findQ(rec.qid);
    if (q) {
      if (!d.stats.cats[q.category]) d.stats.cats[q.category] = { t: 0, c: 0 };
      d.stats.cats[q.category].t++;
      if (rec.ok) d.stats.cats[q.category].c++;
    }
    DB.save(d);
  },
  
  addWrong: function(qid) {
    var d = DB.get();
    var f = null;
    for (var i = 0; i < d.wrong.length; i++) {
      if (d.wrong[i].qid === qid) {
        f = d.wrong[i];
        break;
      }
    }
    if (f) {
      f.cnt++;
      f.time = Date.now();
    } else {
      d.wrong.push({ qid: qid, cnt: 1, time: Date.now() });
    }
    DB.save(d);
  },
  
  removeWrong: function(qid) {
    var d = DB.get();
    d.wrong = d.wrong.filter(function(w) { return w.qid !== qid; });
    DB.save(d);
  },
  
  getWrong: function() {
    return DB.get().wrong;
  },
  
  findQ: function(qid) {
    for (var i = 0; i < QUESTION_BANK.length; i++) {
      if (QUESTION_BANK[i].id === qid) return QUESTION_BANK[i];
    }
    return null;
  }
};

// 数据导出功能
function exportData() {
  var data = {
    questionBank: QUESTION_BANK,
    userData: DB.get(),
    exportTime: new Date().toISOString()
  };
  var json = JSON.stringify(data, null, 2);
  return json;
}

// 数据导入功能
function importData(jsonString) {
  var data;
  try {
    data = JSON.parse(jsonString);
  } catch (err) {
    throw new Error('文件格式不正确，请确保上传有效的JSON文件');
  }
  
  if (!data.questionBank && !data.userData) {
    throw new Error('文件中未找到有效数据（questionBank 或 userData）');
  }
  
  var result = { addedCount: 0, updatedCount: 0 };
  
  // 导入题库数据
  if (data.questionBank) {
    var existingIds = {};
    for (var i = 0; i < QUESTION_BANK.length; i++) {
      existingIds[QUESTION_BANK[i].id] = true;
    }
    
    for (var j = 0; j < data.questionBank.length; j++) {
      var q = data.questionBank[j];
      if (existingIds[q.id]) {
        // 更新现有题目
        for (var k = 0; k < QUESTION_BANK.length; k++) {
          if (QUESTION_BANK[k].id === q.id) {
            QUESTION_BANK[k] = q;
            result.updatedCount++;
            break;
          }
        }
      } else {
        // 新增题目
        QUESTION_BANK.push(q);
        result.addedCount++;
      }
    }
    saveQuestionBank();
  }
  
  // 导入用户数据
  if (data.userData) {
    var existingData = DB.get();
    
    // 合并答题历史
    if (data.userData.history) {
      existingData.history = existingData.history.concat(data.userData.history);
    }
    
    // 合并错题记录
    if (data.userData.wrong) {
      var wrongMap = {};
      for (var w = 0; w < existingData.wrong.length; w++) {
        wrongMap[existingData.wrong[w].qid] = existingData.wrong[w];
      }
      
      for (var x = 0; x < data.userData.wrong.length; x++) {
        var wrongItem = data.userData.wrong[x];
        if (wrongMap[wrongItem.qid]) {
          wrongMap[wrongItem.qid].cnt += wrongItem.cnt;
        } else {
          existingData.wrong.push(wrongItem);
        }
      }
    }
    
    // 合并统计数据
    if (data.userData.stats) {
      if (!existingData.stats) existingData.stats = { total: 0, correct: 0, cats: {} };
      existingData.stats.total += data.userData.stats.total || 0;
      existingData.stats.correct += data.userData.stats.correct || 0;
      
      if (data.userData.stats.cats) {
        for (var catName in data.userData.stats.cats) {
          if (!existingData.stats.cats[catName]) {
            existingData.stats.cats[catName] = { t: 0, c: 0 };
          }
          existingData.stats.cats[catName].t += data.userData.stats.cats[catName].t || 0;
          existingData.stats.cats[catName].c += data.userData.stats.cats[catName].c || 0;
        }
      }
    }
    
    DB.save(existingData);
  }
  
  return result;
}

// 解析选项文本
function parseOptions(optsText) {
  var lines = optsText.split('\n');
  var options = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    // 支持多种分隔符：点号、逗号、中文逗号、中文句号
    var match = line.match(/^([A-D])[.、．,，]\s*(.+)$/);
    if (match) {
      options.push({ key: match[1], text: match[2] });
    }
  }
  return options;
}

// 保存题目（新增或编辑）
function saveQuestion(questionData) {
  var id = questionData.id;
  var category = questionData.category;
  var question = questionData.question;
  var optsText = questionData.optionsText;
  var answer = questionData.answer;
  var explanation = questionData.explanation;
  
  if (!question || !optsText) {
    throw new Error('请填写题目和选项');
  }
  
  // 解析选项
  var options = parseOptions(optsText);
  
  if (options.length < 2) {
    throw new Error('请至少输入两个选项，格式：A.选项内容');
  }
  
  var questionObj = {
    category: category,
    question: question,
    options: options,
    answer: answer,
    explanation: explanation
  };
  
  if (!id) {
    // 新增题目
    questionObj.id = 'q' + Date.now();
    QUESTION_BANK.push(questionObj);
    return { action: 'added', question: questionObj };
  } else {
    // 编辑现有题目
    for (var j = 0; j < QUESTION_BANK.length; j++) {
      if (QUESTION_BANK[j].id === id) {
        QUESTION_BANK[j].category = category;
        QUESTION_BANK[j].question = question;
        QUESTION_BANK[j].options = options;
        QUESTION_BANK[j].answer = answer;
        QUESTION_BANK[j].explanation = explanation;
        break;
      }
    }
    questionObj.id = id;
    return { action: 'updated', question: questionObj };
  }
}

// 保存题库到 localStorage
function saveQuestionBank() {
  localStorage.setItem(DB.QBANK_KEY, JSON.stringify(QUESTION_BANK));
}

// 从 localStorage 加载题库
function loadQuestionBank() {
  var saved = localStorage.getItem(DB.QBANK_KEY);
  if (saved) {
    try {
      QUESTION_BANK = JSON.parse(saved);
    } catch (e) {
      console.error('加载题库失败:', e);
    }
  }
}

// 删除题目
function deleteQuestion(qid) {
  QUESTION_BANK = QUESTION_BANK.filter(function(q) { return q.id !== qid; });
  saveQuestionBank();
}

// 辅助函数：获取用户数据
function getUserData() {
  return DB.get();
}

// 辅助函数：添加答题记录（从测试中调用）
function addRecord(record) {
  DB.addRecord(record);
}

// 辅助函数：添加错题记录（从测试中调用）
function addWrong(qid) {
  DB.addWrong(qid);
}

// 辅助函数：获取错题列表（从测试中调用）
function getWrong() {
  return DB.getWrong();
}

// 辅助函数：重置题库（清理所有自定义题目）
function resetQuestionBank() {
  initializeQuestionBank();
  localStorage.removeItem(DB.QBANK_KEY);
  return QUESTION_BANK.length;
}

// 导出模块（用于测试）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    get QUESTION_BANK() { return QUESTION_BANK; },
    set QUESTION_BANK(val) { QUESTION_BANK = val; },
    DEFAULT_QUESTION_BANK: DEFAULT_QUESTION_BANK,
    DB: {
      get: DB.get,
      save: DB.save,
      addRecord: addRecord,
      addWrong: addWrong,
      removeWrong: DB.removeWrong,
      getWrong: getWrong,
      findQ: DB.findQ,
      defaults: DB.defaults
    },
    exportData: exportData,
    importData: importData,
    saveQuestion: saveQuestion,
    parseOptions: parseOptions,
    saveQuestionBank: saveQuestionBank,
    loadQuestionBank: loadQuestionBank,
    deleteQuestion: deleteQuestion,
    resetQuestionBank: resetQuestionBank,
    getUserData: getUserData,
    initializeQuestionBank: initializeQuestionBank
  };
}