// chart.js 单元测试：覆盖趋势图数据聚合与渲染稳定性

function loadApp() {
  window.App = {};
  require('../data.js');
  require('../chart.js');
}

describe('chart.js trend chart', () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = '<div style="width:400px;"><canvas id="trendChart"></canvas></div>';
    loadApp();
  });

  test('renderTrendChart 对空历史记录不报错', () => {
    expect(() => window.App.renderTrendChart('trendChart', [])).not.toThrow();
  });

  test('renderTrendChart 对包含今日记录的历史不报错', () => {
    const history = [
      { qid: '001', ok: true, time: Date.now() },
      { qid: '002', ok: false, time: Date.now() }
    ];
    expect(() => window.App.renderTrendChart('trendChart', history)).not.toThrow();
  });

  test('renderTrendChart 对 14 天前记录不报错', () => {
    const history = [
      { qid: '001', ok: true, time: Date.now() - 13 * 86400000 },
      { qid: '002', ok: true, time: Date.now() - 15 * 86400000 }
    ];
    expect(() => window.App.renderTrendChart('trendChart', history)).not.toThrow();
  });

  test('renderTrendChart 在 canvas 不存在时静默返回', () => {
    document.body.innerHTML = '<div></div>';
    expect(() => window.App.renderTrendChart('missingCanvas', [])).not.toThrow();
  });
});
