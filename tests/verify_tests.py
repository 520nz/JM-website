from playwright.sync_api import sync_playwright
import os

def test_html_test_pages():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        test_files = [
            ('test_runner.html', '基础测试套件'),
            ('test_import_export.html', '导入导出测试'),
            ('test_core_functions.html', '核心功能测试'),
            ('index.html', '测试缺口分析首页')
        ]

        results = []

        for filename, description in test_files:
            filepath = os.path.join('/workspace/tests', filename)
            if not os.path.exists(filepath):
                results.append({
                    'file': filename,
                    'status': 'FILE_NOT_FOUND',
                    'description': description
                })
                continue

            try:
                page.goto(f'file://{filepath}')
                page.wait_for_load_state('domcontentloaded')

                errors = []
                page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)

                page.wait_for_timeout(500)

                results.append({
                    'file': filename,
                    'status': 'SUCCESS',
                    'description': description,
                    'title': page.title(),
                    'console_errors': len([e for e in errors if 'error' in e.lower()])
                })

                page.evaluate('() => {}')

            except Exception as e:
                results.append({
                    'file': filename,
                    'status': 'ERROR',
                    'description': description,
                    'error': str(e)
                })

        browser.close()

        print("=" * 60)
        print("测试页面验证结果")
        print("=" * 60)

        for result in results:
            print(f"\n文件: {result['file']}")
            print(f"描述: {result['description']}")
            print(f"状态: {result['status']}")

            if result['status'] == 'SUCCESS':
                print(f"标题: {result.get('title', 'N/A')}")
                print(f"控制台错误数: {result.get('console_errors', 0)}")
            elif result['status'] == 'ERROR':
                print(f"错误: {result.get('error', 'Unknown error')}")

        print("\n" + "=" * 60)

        success_count = sum(1 for r in results if r['status'] == 'SUCCESS')
        print(f"成功: {success_count}/{len(results)}")

if __name__ == '__main__':
    test_html_test_pages()
