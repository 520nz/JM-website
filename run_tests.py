#!/usr/bin/env python3
"""
运行林俊杰粉丝答题测试套件并验证结果
"""
from playwright.sync_api import sync_playwright
import sys

def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # 访问测试页面
        page.goto('file:///workspace/tests.html')
        page.wait_for_load_state('networkidle')
        
        # 等待页面加载完成
        page.wait_for_timeout(500)
        
        # 截图查看初始状态
        page.screenshot(path='/tmp/test_initial.png')
        print("✓ 测试页面加载完成")
        
        # 点击运行测试按钮
        run_button = page.locator('button#runTests')
        run_button.click()
        print("✓ 点击运行测试按钮")
        
        # 等待测试完成（等待结果显示）
        page.wait_for_selector('#testResults', timeout=30000)
        page.wait_for_timeout(2000)  # 等待渲染完成
        
        # 截图查看测试结果
        page.screenshot(path='/tmp/test_results.png', full_page=True)
        print("✓ 测试执行完成")
        
        # 提取测试结果数据
        total_tests = page.locator('#totalTests').text_content()
        passed_tests = page.locator('#passedTests').text_content()
        failed_tests = page.locator('#failedTests').text_content()
        summary_text = page.locator('#summaryText').text_content()
        
        print(f"\n📊 测试结果汇总:")
        print(f"   总测试数: {total_tests}")
        print(f"   通过: {passed_tests}")
        print(f"   失败: {failed_tests}")
        print(f"   {summary_text}")
        
        # 获取每个测试套件的详细结果
        suites = page.locator('.test-suite').all()
        print(f"\n📋 测试套件详情:")
        
        for suite in suites:
            suite_title = suite.locator('.suite-title').text_content()
            suite_stats = suite.locator('.suite-stats').text_content()
            print(f"\n   {suite_title}: {suite_stats}")
            
            # 获取该套件下的所有测试项
            test_items = suite.locator('.test-item').all()
            for item in test_items:
                test_name = item.locator('.test-name').text_content()
                test_status = item.locator('.test-status').text_content()
                
                # 如果测试失败，获取错误信息
                if '失败' in test_status:
                    try:
                        test_error = item.locator('.test-error').text_content()
                        print(f"      ✗ {test_name} - {test_error}")
                    except:
                        print(f"      ✗ {test_name}")
                else:
                    print(f"      ✓ {test_name}")
        
        # 获取console日志中的详细结果
        console_logs = []
        page.on("console", lambda msg: console_logs.append(msg.text))
        
        # 再次执行以捕获console
        page.reload()
        page.wait_for_load_state('networkidle')
        run_button.click()
        page.wait_for_selector('#testResults', timeout=30000)
        page.wait_for_timeout(2000)
        
        if console_logs:
            print(f"\n🔍 Console日志:")
            for log in console_logs:
                if '测试结果' in log:
                    print(log)
        
        browser.close()
        
        # 返回测试通过率
        try:
            passed = int(passed_tests)
            total = int(total_tests)
            success_rate = (passed / total * 100) if total > 0 else 0
            
            if success_rate >= 90:
                print(f"\n✅ 测试成功！通过率 {success_rate:.1f}%")
                return 0
            else:
                print(f"\n⚠️  测试通过率偏低：{success_rate:.1f}%")
                return 1
        except:
            print(f"\n❓ 无法解析测试结果")
            return 2

if __name__ == '__main__':
    try:
        sys.exit(run_tests())
    except Exception as e:
        print(f"❌ 测试执行失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(3)