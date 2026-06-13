#!/usr/bin/env python3
"""运行林俊杰粉丝答题测试套件"""

from playwright.sync_api import sync_playwright
import sys

def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 监听控制台输出
        test_results = []
        page.on('console', lambda msg: test_results.append(msg.text))

        # 打开测试页面
        page.goto('file:///workspace/tests/index.test.html')
        page.wait_for_load_state('networkidle')

        # 等待测试完成
        page.wait_for_timeout(1000)

        # 获取测试结果
        passed = page.locator('.test-case.pass').count()
        failed = page.locator('.test-case.fail').count()
        total = passed + failed

        # 输出结果
        print(f"\n{'='*50}")
        print(f"测试结果: {passed}/{total} 通过")
        print(f"{'='*50}\n")

        # 获取失败的测试详情
        if failed > 0:
            print("失败的测试:")
            failed_tests = page.locator('.test-case.fail')
            for i in range(failed_tests.count()):
                test = failed_tests.nth(i)
                name = test.locator('.test-name').text_content()
                detail = test.locator('.test-detail').text_content()
                print(f"  ✗ {name}")
                if detail:
                    print(f"    {detail}")

        # 截图
        page.screenshot(path='/tmp/test_results.png', full_page=True)
        print(f"\n测试报告截图已保存到: /tmp/test_results.png")

        browser.close()

        return failed

if __name__ == '__main__':
    failed = run_tests()
    sys.exit(failed)
