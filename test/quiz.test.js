(function() {
    TestRunner.suite('App.selectMode (模式选择)');
    
    App.selectMode('quick');
    TestRunner.assertEqual(App.state.mode, 'quick', '选择quick模式');
    
    App.selectMode('standard');
    TestRunner.assertEqual(App.state.mode, 'standard', '选择standard模式');
    
    App.selectMode('intensive');
    TestRunner.assertEqual(App.state.mode, 'intensive', '选择intensive模式');
    
    TestRunner.suite('getCount (获取题目数量)');
    
    App.selectMode('quick');
    var quickCount = App.state.mode === 'quick' ? 10 : (App.state.mode === 'standard' ? 20 : 30);
    TestRunner.assertEqual(quickCount, 10, 'quick模式获取10题');
    
    App.selectMode('standard');
    var standardCount = App.state.mode === 'quick' ? 10 : (App.state.mode === 'standard' ? 20 : 30);
    TestRunner.assertEqual(standardCount, 20, 'standard模式获取20题');
    
    App.selectMode('intensive');
    var intensiveCount = App.state.mode === 'quick' ? 10 : (App.state.mode === 'standard' ? 20 : 30);
    TestRunner.assertEqual(intensiveCount, 30, 'intensive模式获取30题');
    
    TestRunner.suite('App.shuffle (随机打乱)');
    
    var arr = [1, 2, 3, 4, 5];
    var shuffled = App.shuffle(arr);
    
    TestRunner.assertEqual(shuffled.length, 5, 'shuffle后长度不变');
    TestRunner.assertType(shuffled, 'object', 'shuffle返回数组');
    
    var containsAll = [1, 2, 3, 4, 5].every(function(val) {
        return shuffled.indexOf(val) !== -1;
    });
    TestRunner.assert(containsAll, 'shuffle后包含所有原始元素');
    
    TestRunner.suite('App.startTimer / App.stopTimer (计时器)');
    
    App.startTimer();
    TestRunner.assertNotNull(App.state.timer, '启动计时器后timer非null');
    
    App.stopTimer();
    TestRunner.assertNull(App.state.timer, '停止计时器后timer为null');
    
    TestRunner.suite('答题状态切换');
    
    App.state.idx = 0;
    App.state.idx++;
    TestRunner.assertEqual(App.state.idx, 1, '索引增加');
    
    App.state.answered = false;
    TestRunner.assertEqual(App.state.answered, false, '答题状态重置');
    
    TestRunner.suite('App.tryResumeSession (中断恢复)');
    
    App.session.clear();
    var noSession = App.tryResumeSession();
    TestRunner.assertEqual(noSession, false, '无会话时返回false');
    
    var mockState = {
        quiz: [{ id: '001', question: 'test', options: [{ key: 'A', text: 'a' }], answer: 'A', explanation: '' }],
        idx: 0,
        correctCount: 0,
        startTime: Date.now(),
        mode: 'quick'
    };
    App.session.save(mockState);
    
    var hasSession = App.tryResumeSession();
    TestRunner.assertEqual(hasSession, true, '有会话时返回true');
    
    App.session.clear();
    
    TestRunner.suite('会话清理');
    
    App.session.save({ quizIds: ['q1'], idx: 0 });
    App.session.clear();
    
    var loaded = App.session.load();
    TestRunner.assertNull(loaded, 'session.clear后session为空');
    
    App.state.quiz = [];
    App.state.idx = 0;
    TestRunner.assertEqual(App.state.quiz.length, 0, 'quiz为空');
    TestRunner.assertEqual(App.state.idx, 0, 'idx重置为0');
    
    TestRunner.suite('答题状态管理');
    
    App.state.quiz = [];
    App.state.idx = 0;
    App.state.correctCount = 0;
    App.state.answered = false;
    
    TestRunner.assertEqual(App.state.quiz.length, 0, '初始quiz为空');
    TestRunner.assertEqual(App.state.idx, 0, '初始idx为0');
    TestRunner.assertEqual(App.state.correctCount, 0, '初始correctCount为0');
    TestRunner.assertEqual(App.state.answered, false, '初始answered为false');
    
})();