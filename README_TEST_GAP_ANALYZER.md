# 自动化测试缺口分析工具

## 📋 概述

本工具用于自动分析代码变更，识别测试缺口，并生成针对性的测试用例补充建议。

## 🚀 快速开始

### 1. 运行测试缺口分析

```bash
cd /workspace
python3 test_gap_analyzer.py
```

这将：
- 分析最近30天的代码变更
- 扫描代码库识别风险区域
- 生成测试缺口建议
- 输出详细报告到 `test_gap_analysis_report_*.txt`

### 2. 查看分析报告

```bash
# 查看文本报告
cat test_gap_analysis_report_*.txt

# 查看JSON数据
cat test_gap_analysis_report_*.json
```

### 3. 运行测试套件

#### Web界面方式
```bash
# 启动本地服务器
python3 -m http.server 8080

# 在浏览器中打开
# http://localhost:8080/tests/test_runner.html
```

#### Node.js方式
```bash
node tests/test_suite.js
```

## 📊 分析报告内容

报告包含以下部分：

1. **代码变更分析** - 最近代码提交记录
2. **代码库分析** - 函数数量、复杂度统计
3. **风险区域识别** - 按优先级排序的风险点
4. **测试缺口清单** - 建议补充的具体测试
5. **测试覆盖分析** - 当前覆盖情况评估
6. **建议与总结** - 实施建议和最佳实践

## 📁 生成的文件

- `test_gap_analyzer.py` - 分析工具主程序
- `test_gap_analysis_report_*.txt` - 详细文本报告
- `test_gap_analysis_report_*.json` - 结构化JSON数据
- `tests/test_suite.js` - 完整测试套件
- `tests/test_runner.html` - Web测试运行器
- `TEST_GAP_ANALYSIS_SUMMARY.md` - 总结报告

## 🎯 识别的风险类型

### 高优先级 (HIGH)
- JSON解析错误处理
- 本地存储操作
- 导入导出功能
- 核心业务逻辑

### 中优先级 (MEDIUM)
- 共享工具函数
- 数组操作
- 数据校验
- 状态管理

## 📖 使用流程

1. **日常开发**: 修改代码后运行分析工具
2. **代码审查**: 查看报告，评估风险
3. **测试补充**: 根据建议补充测试用例
4. **持续集成**: 将测试集成到CI流程

## 🔧 自定义配置

### 修改分析参数

编辑 `test_gap_analyzer.py`:

```python
# 修改分析的时间范围（默认30天）
analyzer = TestGapAnalyzer(repo_path='.')
changes = analyzer.get_recent_changes(days=7)  # 改为7天

# 修改风险评估阈值
# 在 _assess_function_risk 方法中调整 risk_score
```

### 添加新的风险模式

在 `analyze_html_codebase()` 方法中添加新的检测模式:

```python
# 例如：检测文件操作
(r'fs\.readFileSync|fs\.writeFileSync', '文件操作', 'high'),
```

## 📚 测试覆盖范围

测试套件覆盖以下领域：

✅ 核心业务逻辑
✅ 共享工具函数
✅ JSON解析
✅ 本地存储
✅ 数据校验
✅ 数组操作
✅ 导入导出
✅ 状态管理

## 🎓 最佳实践

1. **定期运行**: 每次主要代码变更后运行分析
2. **优先处理**: 先处理高优先级风险
3. **保持更新**: 随着代码演进更新测试
4. **覆盖率目标**: 核心业务80%+，工具函数90%+

## 📞 支持与反馈

如有问题或建议，请提交Issue。

---

**版本**: 1.0.0
**更新**: 2026-05-25
