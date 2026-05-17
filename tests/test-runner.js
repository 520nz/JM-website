const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const TEST_HTML = path.join(__dirname, 'test_runner.html');
const OUT_FILE = path.join(__dirname, 'test-results.html');

async function runTests() {
    console.log('📋 初始化测试环境...\n');

    const htmlContent = fs.readFileSync(TEST_HTML, 'utf-8');

    const dom = new JSDOM(htmlContent, {
        url: 'http://localhost',
        runScripts: 'dangerously',
        resources: 'usable',
        pretendToBeVisual: true
    });

    const { window } = dom;

    await new Promise((resolve) => {
        if (window.QUnit) {
            window.QUnit.done((details) => {
                console.log('\n========================================');
                console.log('测试执行完成');
                console.log('========================================');
                console.log(`总测试数: ${details.total}`);
                console.log(`通过: ${details.total - details.failed}`);
                console.log(`失败: ${details.failed}`);
                console.log(`耗时: ${details.runtime}ms`);
                console.log('========================================\n');

                if (details.failed > 0) {
                    console.log('❌ 部分测试失败，请检查上述输出');
                } else {
                    console.log('✅ 所有测试通过！');
                }

                resolve();
            });
        } else {
            setTimeout(resolve, 2000);
        }
    });

    const resultsHtml = dom.serialize();
    fs.writeFileSync(OUT_FILE, resultsHtml);
    console.log(`\n📄 详细结果已保存至: ${OUT_FILE}`);

    dom.window.close();
}

runTests().catch(console.error);
