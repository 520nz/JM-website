// 工具函数模块

/**
 * 数组洗牌函数（Fisher-Yates 算法）
 * @param {Array} arr - 要洗牌的数组
 * @returns {Array} 洗牌后的新数组
 */
function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

/**
 * 格式化时间
 * @param {number} ms - 毫秒数
 * @returns {string} 格式化后的时间字符串，如 "2分30秒"
 */
function fmtTime(ms) {
  var sec = Math.floor(ms / 1000);
  var m = Math.floor(sec / 60);
  var s = sec % 60;
  return m + '分' + s + '秒';
}

module.exports = {
  shuffle,
  fmtTime
};
