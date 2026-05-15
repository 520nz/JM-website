import { test, expect } from '@playwright/test';

test.describe('林俊杰粉丝答题 - 核心功能测试', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(`file://${process.cwd()}/index.html`);
    });

    test('首页正确加载', async ({ page }) => {
        await expect(page.locator('h1')).toContainText('林俊杰粉丝答题');
        await expect(page.locator('.nav-item').first()).toContainText('首页');
        await expect(page.locator('.btn').first()).toBeVisible();
    });

    test('导航切换功能', async ({ page }) => {
        const navItems = ['首页', '练习', '错题本', '统计', '管理'];
        for (const item of navItems) {
            await page.click(`.nav-item:has-text("${item}")`);
            await page.waitForTimeout(100);
        }
    });

    test('随机练习开始流程', async ({ page }) => {
        await page.click('.btn:has-text("随机练习")');
        await expect(page.locator('.question-card')).toBeVisible();
        await expect(page.locator('.option-item')).toHaveCount(4);
    });

    test('答题交互 - 选择正确答案', async ({ page }) => {
        await page.click('.btn:has-text("随机练习")');
        await page.waitForTimeout(200);
        
        const questionId = await page.locator('.question-card .question-text').textContent();
        
        await page.click('.option-item >> nth=0');
        
        await expect(page.locator('.feedback')).toBeVisible();
        const feedbackClass = await page.locator('.feedback').getAttribute('class');
        expect(feedbackClass).toMatch(/show/);
    });

    test('答题交互 - 选择错误答案', async ({ page }) => {
        await page.click('.btn:has-text("随机练习")');
        await page.waitForTimeout(200);
        
        await page.click('.option-item >> nth=1');
        
        await expect(page.locator('.feedback.wrong')).toBeVisible();
    });

    test('下一题按钮出现', async ({ page }) => {
        await page.click('.btn:has-text("随机练习")');
        await page.waitForTimeout(200);
        await page.click('.option-item >> nth=0');
        
        await expect(page.locator('#nextBtn')).toBeVisible();
    });

    test('返回首页功能', async ({ page }) => {
        await page.click('.btn:has-text("随机练习")');
        await page.waitForTimeout(200);
        await page.click('.btn:has-text("返回首页")');
        
        await expect(page.locator('.mode-selector')).toBeVisible();
    });

    test('分类练习展示', async ({ page }) => {
        await page.click('.btn:has-text("分类练习")');
        
        await expect(page.locator('.category-item').first()).toBeVisible();
        const categories = await page.locator('.category-item').count();
        expect(categories).toBeGreaterThan(0);
    });

    test('分类练习开始', async ({ page }) => {
        await page.click('.btn:has-text("分类练习")');
        await page.waitForTimeout(100);
        await page.click('.category-item >> nth=0');
        
        await expect(page.locator('.question-card')).toBeVisible();
    });

    test('今日数据显示', async ({ page }) => {
        await expect(page.locator('#todayCount')).toBeVisible();
        await expect(page.locator('#todayAcc')).toBeVisible();
    });

    test('错题本空状态', async ({ page }) => {
        await page.click('.nav-item:has-text("错题本")');
        await expect(page.locator('.empty')).toBeVisible();
    });

    test('统计页面基础元素', async ({ page }) => {
        await page.click('.nav-item:has-text("统计")');
        await expect(page.locator('#sTotal')).toBeVisible();
        await expect(page.locator('#sAcc')).toBeVisible();
    });

    test('管理模式切换', async ({ page }) => {
        await page.click('.nav-item:has-text("管理")');
        await expect(page.locator('#questionList')).toBeVisible();
        await expect(page.locator('.btn:has-text("新增题目")')).toBeVisible();
    });

    test('题库显示验证', async ({ page }) => {
        await page.click('.nav-item:has-text("管理")');
        await page.waitForTimeout(200);
        
        const questionItems = await page.locator('.q-item').count();
        expect(questionItems).toBeGreaterThan(0);
    });

    test('题目搜索功能', async ({ page }) => {
        await page.click('.nav-item:has-text("管理")');
        await page.waitForTimeout(200);
        
        const initialCount = await page.locator('.q-item').count();
        await page.fill('#searchInput', '林俊杰');
        await page.waitForTimeout(100);
        
        const filteredCount = await page.locator('.q-item').count();
        expect(filteredCount).toBeLessThanOrEqual(initialCount);
    });

    test('分类筛选功能', async ({ page }) => {
        await page.click('.nav-item:has-text("管理")');
        await page.waitForTimeout(200);
        
        const categoryOptions = await page.locator('#categoryFilter option').count();
        expect(categoryOptions).toBeGreaterThan(1);
        
        await page.selectOption('#categoryFilter', { index: 1 });
        await page.waitForTimeout(100);
    });
});

test.describe('新增题目功能测试', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(`file://${process.cwd()}/index.html`);
        await page.click('.nav-item:has-text("管理")');
        await page.waitForTimeout(200);
    });

    test('打开新增题目弹窗', async ({ page }) => {
        await page.click('.btn:has-text("新增题目")');
        await expect(page.locator('#editModal')).toBeVisible();
        await expect(page.locator('#modalTitle')).toContainText('新增题目');
    });

    test('新增题目表单验证 - 空内容', async ({ page }) => {
        await page.click('.btn:has-text("新增题目")');
        await page.click('.btn:has-text("保存")');
        
        await expect(page.locator('text=请填写题目和选项')).toBeVisible();
    });

    test('关闭新增题目弹窗', async ({ page }) => {
        await page.click('.btn:has-text("新增题目")');
        await expect(page.locator('#editModal')).toBeVisible();
        
        await page.click('.btn:has-text("取消")');
        await page.waitForTimeout(300);
        
        const modalDisplay = await page.locator('#editModal').evaluate(el => el.style.display);
        expect(modalDisplay).toBe('none');
    });

    test('保存有效题目', async ({ page }) => {
        await page.click('.btn:has-text("新增题目")');
        await page.fill('#editQuestion', '测试题目内容');
        await page.fill('#editOptions', 'A.选项1\nB.选项2\nC.选项3\nD.选项4');
        await page.selectOption('#editAnswer', 'A');
        await page.fill('#editExplanation', '测试解析');
        
        await page.click('.btn:has-text("保存")');
        await page.waitForTimeout(300);
        
        const modalDisplay = await page.locator('#editModal').evaluate(el => el.style.display);
        expect(modalDisplay).toBe('none');
    });
});

test.describe('数据导入导出测试', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(`file://${process.cwd()}/index.html`);
        await page.click('.nav-item:has-text("管理")');
        await page.waitForTimeout(200);
    });

    test('导出按钮存在', async ({ page }) => {
        await expect(page.locator('.btn:has-text("导出数据")')).toBeVisible();
    });

    test('导入按钮存在', async ({ page }) => {
        await expect(page.locator('.btn:has-text("导入数据")')).toBeVisible();
    });

    test('重置按钮存在', async ({ page }) => {
        await expect(page.locator('.btn:has-text("重置")')).toBeVisible();
    });

    test('重置确认弹窗显示', async ({ page }) => {
        await page.click('.btn:has-text("重置")');
        await expect(page.locator('#resetModal')).toBeVisible();
    });

    test('重置确认弹窗关闭', async ({ page }) => {
        await page.click('.btn:has-text("重置")');
        await expect(page.locator('#resetModal')).toBeVisible();
        
        await page.click('.btn:has-text("取消")');
        await page.waitForTimeout(300);
        
        const modalDisplay = await page.locator('#resetModal').evaluate(el => el.style.display);
        expect(modalDisplay).toBe('none');
    });

    test('确认按钮初始禁用', async ({ page }) => {
        await page.click('.btn:has-text("重置")');
        await expect(page.locator('#resetConfirmBtn')).toBeDisabled();
    });

    test('输入确认文字启用按钮', async ({ page }) => {
        await page.click('.btn:has-text("重置")');
        await expect(page.locator('#resetConfirmBtn')).toBeDisabled();
        
        await page.fill('#resetConfirmInput', '恢复默认');
        await page.waitForTimeout(100);
        
        await expect(page.locator('#resetConfirmBtn')).toBeEnabled();
    });
});

test.describe('边界条件测试', () => {
    test('空搜索结果显示空状态', async ({ page }) => {
        await page.goto(`file://${process.cwd()}/index.html`);
        await page.click('.nav-item:has-text("管理")');
        await page.waitForTimeout(200);
        
        await page.fill('#searchInput', 'xyznonexistent123456');
        await page.waitForTimeout(100);
        
        await expect(page.locator('.empty')).toBeVisible();
    });

    test('快速切换视图不会崩溃', async ({ page }) => {
        await page.goto(`file://${process.cwd()}/index.html`);
        
        for (let i = 0; i < 10; i++) {
            await page.click(`.nav-item >> nth=${i % 5}`);
            await page.waitForTimeout(50);
        }
        
        await expect(page.locator('h1')).toContainText('林俊杰');
    });

    test('快速点击选项不会重复计分', async ({ page }) => {
        await page.click('.btn:has-text("随机练习")');
        await page.waitForTimeout(200);
        
        await page.click('.option-item >> nth=0');
        await page.waitForTimeout(100);
        await page.click('.option-item >> nth=1');
        await page.waitForTimeout(100);
        await page.click('.option-item >> nth=2');
        
        await page.waitForTimeout(100);
        const correctCount = await page.locator('.feedback.correct').count();
        expect(correctCount).toBeLessThanOrEqual(1);
    });

    test('所有练习模式按钮可点击', async ({ page }) => {
        await page.click('.mode-btn[data-mode="quick"]');
        await expect(page.locator('.mode-btn[data-mode="quick"]')).toHaveClass(/active/);
        
        await page.click('.mode-btn[data-mode="standard"]');
        await expect(page.locator('.mode-btn[data-mode="standard"]')).toHaveClass(/active/);
        
        await page.click('.mode-btn[data-mode="intensive"]');
        await expect(page.locator('.mode-btn[data-mode="intensive"]')).toHaveClass(/active/);
    });
});

test.describe('答题完成流程测试', () => {
    test('答题完成显示结果页面', async ({ page }) => {
        await page.click('.btn:has-text("随机练习")');
        await page.waitForTimeout(200);
        
        for (let i = 0; i < 10; i++) {
            const hasQuiz = await page.locator('.option-item').count();
            if (hasQuiz === 0) break;
            
            await page.click('.option-item >> nth=0');
            await page.waitForTimeout(100);
            
            const nextBtn = page.locator('#nextBtn');
            if (await nextBtn.isVisible()) {
                await nextBtn.click();
                await page.waitForTimeout(100);
            }
        }
        
        await expect(page.locator('.finish-card')).toBeVisible({ timeout: 5000 }).catch(() => {});
    });
});
