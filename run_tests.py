#!/usr/bin/env python3
"""
运行测试套件并验证测试结果
"""
from playwright.sync_api import sync_playwright
import os
import time

def run_tests():
    test_file_path = os.path.abspath('/workspace/tests/index.test.html')
    file_url = f'file://{test_file_path}'

    print(f"Opening test file: {file_url}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1920, 'height': 1080})

        # 打开测试页面
        page.goto(file_url)

        # 等待 QUnit 测试完成
        # QUnit 在所有测试完成后会设置 window.QUnit.done
        print("Waiting for QUnit tests to complete...")

        # 最多等待60秒
        max_wait = 60
        start_time = time.time()

        while time.time() - start_time < max_wait:
            # 检查是否完成
            done = page.evaluate("""() => {
                if (typeof QUnit === 'undefined') return false;
                if (typeof QUnit.config === 'undefined') return false;
                return document.querySelector('.test-complete, .failed, .passed') !== null ||
                       (typeof window.QUnit !== 'undefined' && QUnit.config && QUnit.config.queue && QUnit.config.queue.length === 0);
            }""")

            if done:
                print("Tests appear to be complete, checking results...")
                break

            # 检查是否有结果输出
            failed_count = page.evaluate("""() => {
                var failed = document.querySelector('#qunit-testresult .failed');
                return failed ? parseInt(failed.textContent) : 0;
            }""")

            if failed_count > 0:
                print(f"Found {failed_count} failed tests")
                break

            time.sleep(0.5)

        # 等待额外时间确保渲染完成
        page.wait_for_timeout(2000)

        # 获取测试结果
        results = page.evaluate("""() => {
            var result = {
                total: 0,
                passed: 0,
                failed: 0,
                failedTests: []
            };

            // 获取统计信息
            var testResult = document.querySelector('#qunit-testresult');
            if (testResult) {
                var text = testResult.textContent;
                var match = text.match(/(\\d+) tests of (\\d+) passed, (\\d+) failed/);
                if (match) {
                    result.total = parseInt(match[2]);
                    result.passed = parseInt(match[2]) - parseInt(match[3]);
                    result.failed = parseInt(match[3]);
                }
            }

            // 如果上面的方法失败，尝试另一种方式
            if (result.total === 0) {
                var passed = document.querySelectorAll('.test-passed');
                var failed = document.querySelectorAll('.test-failed, .qunit-assert-list li.fail');
                result.total = passed.length + failed.length;
                result.passed = passed.length;
                result.failed = failed.length;
            }

            // 获取失败的测试详情
            var failedItems = document.querySelectorAll('.qunit-assert-list li.fail');
            failedItems.forEach(function(item) {
                var moduleName = item.closest('.qunit-module-section')?.querySelector('.qunit-module-name')?.textContent || 'Unknown';
                var testName = item.querySelector('.test-name')?.textContent || item.querySelector('.test-message')?.textContent || 'Unknown test';
                var message = item.querySelector('.test-message')?.textContent || '';
                result.failedTests.push({
                    module: moduleName,
                    test: testName,
                    message: message
                });
            });

            return result;
        }""")

        # 截图保存结果
        page.screenshot(path='/workspace/test_screenshots/test_results.png', full_page=True)
        print(f"Screenshot saved to /workspace/test_screenshots/test_results.png")

        browser.close()

        # 打印结果
        print("\n" + "=" * 60)
        print("测试结果汇总")
        print("=" * 60)
        print(f"总测试数: {results['total']}")
        print(f"通过: {results['passed']}")
        print(f"失败: {results['failed']}")

        if results['failedTests']:
            print("\n失败的测试:")
            for i, test in enumerate(results['failedTests'], 1):
                print(f"  {i}. [{test['module']}] {test['test']}")
                print(f"     错误: {test['message']}")

        print("=" * 60)

        if results['failed'] == 0 and results['total'] > 0:
            print("✓ 所有测试通过!")
            return True
        else:
            print("✗ 有测试失败")
            return False

if __name__ == '__main__':
    success = run_tests()
    exit(0 if success else 1)
