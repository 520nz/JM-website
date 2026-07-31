// fixtures - 测试用题库与用户数据
const QUESTION_BANK = [
  { id: 'q1', category: '专辑', question: 'Q1', options: [{key:'A',text:'a'},{key:'B',text:'b'}], answer: 'A', explanation: '' },
  { id: 'q2', category: '歌曲', question: 'Q2', options: [{key:'A',text:'a'},{key:'B',text:'b'}], answer: 'B', explanation: '' },
  { id: 'q3', category: '个人信息', question: 'Q3', options: [{key:'A',text:'a'},{key:'B',text:'b'}], answer: 'A', explanation: '' },
  { id: 'q4', category: '获奖记录', question: 'Q4', options: [{key:'A',text:'a'},{key:'B',text:'b'}], answer: 'A', explanation: '' }
];

// 在 N 天前的某个时刻
function daysAgo(n, hour = 12) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

module.exports = { QUESTION_BANK, daysAgo };
