// 测试入口
require('./browser-shim');
require('./storage.test');
require('./quiz.test');
require('./admin.test');
require('./chart.test');
// 后续模块会在此追加 require
require('./test-runner').run();
