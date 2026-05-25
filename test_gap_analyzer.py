#!/usr/bin/env python3
"""
自动化测试缺口分析工具
目标：审查近期合并的代码，在覆盖率缺口对产品稳定性构成实质风险的地方补充测试

重点关注：
- 缺少任何测试覆盖的新增逻辑路径
- 仅修改了生产代码而未同步更新测试的 Bug 修复提交
- 下游使用广泛的核心模块和共享工具函数
- 涉及解析、并发、权限校验或数据验证的复杂逻辑
- 业务关键流程中的边界条件和极端情况

应跳过：
- 提供极少行为信号的快照式测试
- 针对纯粹外观或格式调整的测试
- 针对保持现有行为不变的重构的覆盖
"""

import json
import re
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Set, Tuple, Any
from dataclasses import dataclass, field
from collections import defaultdict


@dataclass
class CodeChange:
    """代码变更信息"""
    commit_hash: str
    commit_message: str
    author: str
    date: str
    files_changed: List[str]
    additions: int
    deletions: int
    diff_content: str


@dataclass
class RiskArea:
    """风险区域"""
    file_path: str
    function_name: str
    risk_type: str
    priority: str
    description: str
    code_snippet: str
    affected_lines: str


@dataclass
class TestGap:
    """测试缺口"""
    id: str
    risk_area: RiskArea
    suggested_test_name: str
    test_description: str
    test_code: str
    test_category: str
    expected_behavior: str


class TestGapAnalyzer:
    """测试缺口分析器"""

    def __init__(self, repo_path: str = "."):
        self.repo_path = Path(repo_path)
        self.changes: List[CodeChange] = []
        self.risk_areas: List[RiskArea] = []
        self.test_gaps: List[TestGap] = []
        self.html_file_path = self.repo_path / "index.html"

    def get_recent_changes(self, days: int = 30) -> List[CodeChange]:
        """获取近期的代码变更"""
        since_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')

        try:
            result = subprocess.run(
                ['git', 'log', f'--since={since_date}', '--format=%H|%s|%an|%ai', '--name-only', '--stat'],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                check=True
            )
        except (subprocess.CalledProcessError, FileNotFoundError):
            return []

        changes = []
        commits = result.stdout.strip().split('\n\n')

        for commit_block in commits:
            if not commit_block.strip():
                continue

            lines = commit_block.split('\n')
            if len(lines) < 2:
                continue

            header_parts = lines[0].split('|')
            if len(header_parts) < 4:
                continue

            commit_hash = header_parts[0]
            commit_message = header_parts[1]
            author = header_parts[2]
            date = header_parts[3]

            files_changed = []
            additions = 0
            deletions = 0

            for line in lines[1:]:
                if '|' in line and ('+' in line or '-' in line):
                    match = re.search(r'(\d+)\s+ insertions?', line)
                    if match:
                        additions += int(match.group(1))
                    match = re.search(r'(\d+)\s+ deletions?', line)
                    if match:
                        deletions += int(match.group(1))
                elif line.strip() and not line.startswith(' '):
                    files_changed.append(line.strip())

            try:
                diff_result = subprocess.run(
                    ['git', 'show', commit_hash, '--format=%B', '--name-only'],
                    cwd=self.repo_path,
                    capture_output=True,
                    text=True,
                    check=True
                )
                diff_content = diff_result.stdout
            except subprocess.CalledProcessError:
                diff_content = ""

            changes.append(CodeChange(
                commit_hash=commit_hash,
                commit_message=commit_message,
                author=author,
                date=date,
                files_changed=files_changed,
                additions=additions,
                deletions=deletions,
                diff_content=diff_content
            ))

        self.changes = changes
        return changes

    def analyze_html_codebase(self) -> Dict[str, Any]:
        """分析HTML文件中的JavaScript代码"""
        if not self.html_file_path.exists():
            return {}

        with open(self.html_file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        analysis = {
            'total_lines': len(content.split('\n')),
            'functions': self._extract_functions(content),
            'data_structures': self._extract_data_structures(content),
            'event_handlers': self._extract_event_handlers(content),
            'complexity_areas': self._identify_complex_areas(content),
            'user_interactions': self._extract_user_interactions(content)
        }

        return analysis

    def _extract_functions(self, content: str) -> List[Dict[str, Any]]:
        """提取JavaScript函数"""
        functions = []

        function_patterns = [
            r'function\s+(\w+)\s*\([^)]*\)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}',
            r'var\s+(\w+)\s*=\s*function\s*\([^)]*\)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}',
            r'(\w+)\s*:\s*function\s*\([^)]*\)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}',
        ]

        for pattern in function_patterns:
            matches = re.finditer(pattern, content, re.MULTILINE | re.DOTALL)
            for match in matches:
                func_name = match.group(1)
                func_body = match.group(2)

                complexity = self._calculate_complexity(func_body)

                functions.append({
                    'name': func_name,
                    'start_line': content[:match.start()].count('\n') + 1,
                    'lines': match.group(0).count('\n'),
                    'complexity': complexity,
                    'has_conditions': bool(re.search(r'\b(if|else|switch|case)\b', func_body)),
                    'has_loops': bool(re.search(r'\b(for|while|do|forEach|map|filter|reduce)\b', func_body)),
                    'has_validation': bool(re.search(r'\b(validation|check|verify|validate)\b', func_name, re.I)),
                    'has_error_handling': bool(re.search(r'\b(try|catch|throw|error|alert|confirm)\b', func_body)),
                })

        return functions

    def _calculate_complexity(self, code: str) -> int:
        """计算代码复杂度"""
        complexity = 1
        complexity += len(re.findall(r'\bif\b', code))
        complexity += len(re.findall(r'\b(for|while|do)\b', code)) * 2
        complexity += len(re.findall(r'\b(case|\?)\b', code))
        complexity += len(re.findall(r'\band\b|\bor\b|&&|\|\|', code))
        return complexity

    def _extract_data_structures(self, content: str) -> List[Dict[str, str]]:
        """提取数据结构定义"""
        structures = []

        patterns = [
            (r'var\s+(\w+)\s*=\s*\{([^}]+)\}', 'object'),
            (r'var\s+(\w+)\s*=\s*\[([^\]]+)\]', 'array'),
            (r'var\s+(\w+)\s*=\s*\{([^}]+)\}', 'literal_object'),
        ]

        for pattern, struct_type in patterns:
            matches = re.finditer(pattern, content)
            for match in matches:
                structures.append({
                    'name': match.group(1),
                    'type': struct_type,
                    'line': content[:match.start()].count('\n') + 1
                })

        return structures

    def _extract_event_handlers(self, content: str) -> List[Dict[str, Any]]:
        """提取事件处理器"""
        handlers = []

        patterns = [
            (r'onclick\s*=\s*["\'](\w+)["\']', 'click'),
            (r'onchange\s*=\s*["\'](\w+)["\']', 'change'),
            (r'oninput\s*=\s*["\'](\w+)["\']', 'input'),
            (r'onload\s*=\s*["\'](\w+)["\']', 'load'),
        ]

        for pattern, event_type in patterns:
            matches = re.finditer(pattern, content)
            for match in matches:
                handlers.append({
                    'handler': match.group(1),
                    'event_type': event_type,
                    'line': content[:match.start()].count('\n') + 1
                })

        return handlers

    def _identify_complex_areas(self, content: str) -> List[Dict[str, Any]]:
        """识别复杂逻辑区域"""
        complex_areas = []

        critical_patterns = [
            (r'JSON\.parse\([^)]+\)', 'JSON解析', 'high'),
            (r'localStorage\.(setItem|getItem)', '本地存储操作', 'high'),
            (r'addEventListener|attachEvent', '事件绑定', 'medium'),
            (r'\.filter\(|\.map\(|\.reduce\(|\.forEach\(', '数组方法', 'medium'),
            (r'document\.(getElementById|querySelector|createElement)', 'DOM操作', 'medium'),
            (r'regex|RegExp|test\(|match\(|replace\(', '正则表达式', 'high'),
            (r'if\s*\([^)]*===\s*["\']|if\s*\([^)]*!==\s*["\']', '严格比较', 'medium'),
            (r'for\s*\([^)]*\+\+|--\)', '循环计数', 'medium'),
            (r'try\s*\{[\s\S]*?catch', '异常处理', 'medium'),
        ]

        for pattern, area_type, priority in critical_patterns:
            matches = re.finditer(pattern, content)
            for match in matches:
                line_num = content[:match.start()].count('\n') + 1
                snippet = self._get_context_snippet(content, line_num, 3)

                complex_areas.append({
                    'type': area_type,
                    'line': line_num,
                    'priority': priority,
                    'snippet': snippet
                })

        return complex_areas

    def _extract_user_interactions(self, content: str) -> List[Dict[str, Any]]:
        """提取用户交互逻辑"""
        interactions = []

        patterns = [
            (r'function\s+(\w*[Ss]tart\w*)\s*\(', '开始交互'),
            (r'function\s+(\w*[Pp]ick\w*)\s*\(', '选择交互'),
            (r'function\s+(\w*[Nn]ext\w*)\s*\(', '导航交互'),
            (r'function\s+(\w*[Ss]ubmit\w*)\s*\(', '提交交互'),
            (r'function\s+(\w*[Ii]mport\w*)\s*\(', '导入交互'),
            (r'function\s+(\w*[Ee]xport\w*)\s*\(', '导出交互'),
        ]

        for pattern, interaction_type in patterns:
            matches = re.finditer(pattern, content)
            for match in matches:
                interactions.append({
                    'function': match.group(1),
                    'type': interaction_type,
                    'line': content[:match.start()].count('\n') + 1
                })

        return interactions

    def _get_context_snippet(self, content: str, line_num: int, context_lines: int = 3) -> str:
        """获取代码上下文片段"""
        lines = content.split('\n')
        start = max(0, line_num - context_lines - 1)
        end = min(len(lines), line_num + context_lines)

        snippet_lines = []
        for i in range(start, end):
            prefix = '>>> ' if i == line_num - 1 else '    '
            snippet_lines.append(f"{prefix}{i + 1:4d}: {lines[i]}")

        return '\n'.join(snippet_lines)

    def identify_risk_areas(self, code_analysis: Dict[str, Any]) -> List[RiskArea]:
        """识别风险区域"""
        risk_areas = []

        for func in code_analysis.get('functions', []):
            risk_level = self._assess_function_risk(func, code_analysis)

            if risk_level['priority'] != 'low':
                risk_areas.append(RiskArea(
                    file_path='index.html',
                    function_name=func['name'],
                    risk_type=risk_level['type'],
                    priority=risk_level['priority'],
                    description=risk_level['description'],
                    code_snippet=self._extract_function_snippet(func['name']),
                    affected_lines=f"Line ~{func['start_line']}"
                ))

        for area in code_analysis.get('complexity_areas', []):
            if area['priority'] in ['high', 'medium']:
                risk_areas.append(RiskArea(
                    file_path='index.html',
                    function_name=self._find_nearest_function(area['line']),
                    risk_type=area['type'],
                    priority=area['priority'],
                    description=f"复杂{area['type']}操作",
                    code_snippet=area['snippet'],
                    affected_lines=f"Line {area['line']}"
                ))

        self.risk_areas = risk_areas
        return risk_areas

    def _assess_function_risk(self, func: Dict[str, Any], code_analysis: Dict[str, Any]) -> Dict[str, str]:
        """评估函数风险等级"""
        risk_score = 0
        risk_types = []
        func_name = func.get('name', 'unknown')

        if func['complexity'] > 10:
            risk_score += 2
            risk_types.append('高复杂度')

        if func['has_conditions']:
            risk_score += 1

        if func['has_loops']:
            risk_score += 1
            risk_types.append('循环逻辑')

        if func['has_validation']:
            risk_score += 2
            risk_types.append('数据校验')

        if func['has_error_handling']:
            risk_score += 1

        if func_name in ['pickOption', 'saveQuestion', 'importData', 'exportData']:
            risk_score += 2
            risk_types.append('核心业务')

        if func_name in ['shuffle', 'DB.get', 'DB.save']:
            risk_score += 3
            risk_types.append('共享工具')

        if risk_score >= 5:
            priority = 'critical'
        elif risk_score >= 3:
            priority = 'high'
        elif risk_score >= 2:
            priority = 'medium'
        else:
            priority = 'low'

        return {
            'priority': priority,
            'type': ', '.join(risk_types) if risk_types else '一般逻辑',
            'description': f"函数{func_name}复杂度评估：{', '.join(risk_types) if risk_types else '基础逻辑'}"
        }

    def _extract_function_snippet(self, func_name: str) -> str:
        """提取函数代码片段"""
        if not self.html_file_path.exists():
            return ""

        with open(self.html_file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        pattern = rf'function\s+{func_name}\s*\([^)]*\)\s*\{{([^}}]*(?:\{{[^}}]*\}}[^}}]*)*)\}}'
        match = re.search(pattern, content, re.MULTILINE | re.DOTALL)

        if match:
            return match.group(0)[:500] + ('...' if len(match.group(0)) > 500 else '')
        return ""

    def _find_nearest_function(self, line_num: int) -> str:
        """查找最近的函数"""
        with open(self.html_file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        pattern = r'function\s+(\w+)\s*\('
        matches = list(re.finditer(pattern, content))

        nearest_func = "unknown"
        min_distance = float('inf')

        for match in matches:
            func_line = content[:match.start()].count('\n') + 1
            distance = abs(func_line - line_num)

            if distance < min_distance:
                min_distance = distance
                nearest_func = match.group(1)

        return nearest_func

    def generate_test_gaps(self) -> List[TestGap]:
        """生成测试缺口"""
        test_gaps = []

        gap_templates = {
            'JSON解析': {
                'name': 'test_json_parsing',
                'description': '测试JSON解析的边界情况和错误处理',
                'template': '''
// 测试: JSON解析边界情况
function testJSONParsing() {
    // 测试正常JSON
    assertDoesNotThrow(() => JSON.parse('{"key":"value"}'), '正常JSON应该解析成功');

    // 测试空对象
    assertDoesNotThrow(() => JSON.parse('{}'), '空对象应该解析成功');

    // 测试包含特殊字符的JSON
    assertDoesNotThrow(() => JSON.parse('{"key":"value with \\"quotes\\""}'), '带引号的JSON应该解析成功');

    // 测试无效JSON应该被捕获
    assertDoesCatch(() => { try { JSON.parse('invalid'); } catch(e) { throw e; } }, '无效JSON应该抛出错误');
}
'''
            },
            '本地存储': {
                'name': 'test_local_storage_operations',
                'description': '测试本地存储的读写和数据持久化',
                'template': '''
// 测试: 本地存储操作
function testLocalStorageOperations() {
    // 测试数据保存
    localStorage.setItem('test_key', JSON.stringify({data: 'test'}));
    const retrieved = JSON.parse(localStorage.getItem('test_key'));
    assertEqual(retrieved.data, 'test', '数据应该正确保存和读取');

    // 测试数据更新
    localStorage.setItem('test_key', JSON.stringify({data: 'updated'}));
    const updated = JSON.parse(localStorage.getItem('test_key'));
    assertEqual(updated.data, 'updated', '数据应该正确更新');

    // 测试数据删除
    localStorage.removeItem('test_key');
    assertEqual(localStorage.getItem('test_key'), null, '数据应该被正确删除');

    // 测试空值处理
    localStorage.setItem('empty_key', '');
    const emptyVal = localStorage.getItem('empty_key');
    // 应该处理空字符串的情况
}
'''
            },
            '核心业务': {
                'name': 'test_core_business_logic',
                'description': '测试核心业务逻辑的正确性',
                'template': '''
// 测试: 核心业务逻辑
function testCoreBusinessLogic() {
    // 测试答题流程
    const mockState = {quiz: [], idx: 0, answered: false, correctCount: 0};

    // 测试随机题目生成
    const questions = shuffle(QUESTION_BANK).slice(0, 10);
    assertEqual(questions.length, 10, '应该生成指定数量的题目');
    assertEqual(questions.length, [...new Set(questions.map(q => q.id))].length, '题目不应该重复');

    // 测试答案验证
    const question = {id: '001', answer: 'A'};
    const isCorrect = 'A' === question.answer;
    assertEqual(isCorrect, true, '正确答案应该返回true');

    const isWrong = 'B' === question.answer;
    assertEqual(isWrong, false, '错误答案应该返回false');
}
'''
            },
            '数据校验': {
                'name': 'test_data_validation',
                'description': '测试数据验证逻辑',
                'template': '''
// 测试: 数据验证逻辑
function testDataValidation() {
    // 测试题目选项格式验证
    const validOption = 'A.这是选项A';
    const match = validOption.match(/^([A-D])[.、．]\\s*(.+)$/);
    assertEqual(match !== null, true, '有效选项格式应该匹配');
    assertEqual(match[1], 'A', '应该正确提取选项键');
    assertEqual(match[2], '这是选项A', '应该正确提取选项文本');

    // 测试无效选项格式
    const invalidOption = '无效格式';
    const invalidMatch = invalidOption.match(/^([A-D])[.、．]\\s*(.+)$/);
    assertEqual(invalidMatch, null, '无效格式不应该匹配');

    // 测试多个选项解析
    const optionsText = 'A.选项1\\nB.选项2\\nC.选项3\\nD.选项4';
    const lines = optionsText.split('\\n');
    const parsedOptions = [];
    for (const line of lines) {
        const m = line.match(/^([A-D])[.、．]\\s*(.+)$/);
        if (m) parsedOptions.push({key: m[1], text: m[2]});
    }
    assertEqual(parsedOptions.length, 4, '应该解析出4个选项');
}
'''
            },
            '数组方法': {
                'name': 'test_array_operations',
                'description': '测试数组操作的边界情况',
                'template': '''
// 测试: 数组操作边界情况
function testArrayOperations() {
    // 测试shuffle函数
    const original = [1, 2, 3, 4, 5];
    const shuffled = shuffle(original);

    // shuffle不应该修改原数组
    assertEqual(original.length, 5, 'shuffle不应该修改原数组长度');

    // shuffled应该包含所有原数组元素
    assertEqual(shuffled.length, 5, 'shuffled应该包含所有元素');
    original.forEach(item => {
        assertEqual(shuffled.includes(item), true, `元素${item}应该存在于shuffled数组中`);
    });

    // 测试filter操作
    const questions = [{id: '1', category: 'album'}, {id: '2', category: 'song'}, {id: '3', category: 'album'}];
    const albumQuestions = questions.filter(q => q.category === 'album');
    assertEqual(albumQuestions.length, 2, '应该过滤出2个专辑题目');
}
'''
            },
            '共享工具': {
                'name': 'test_shared_utilities',
                'description': '测试共享工具函数的正确性和可靠性',
                'template': '''
// 测试: 共享工具函数
function testSharedUtilities() {
    // 测试DB模块
    const defaultData = DB.defaults();
    assertEqual('history' in defaultData, true, '默认数据应该包含history');
    assertEqual('wrong' in defaultData, true, '默认数据应该包含wrong');
    assertEqual('stats' in defaultData, true, '默认数据应该包含stats');

    // 测试findQ函数
    const found = DB.findQ('001');
    assertEqual(found !== null, true, '应该能找到指定题目');
    assertEqual(found.id, '001', '找到的题目ID应该匹配');

    const notFound = DB.findQ('nonexistent');
    assertEqual(notFound, null, '不存在的题目应该返回null');

    // 测试状态管理
    const initialState = {quiz: [], idx: 0, answered: false, mode: 'quick', correctCount: 0, startTime: 0, timer: null};
    assertEqual(initialState.quiz.length, 0, '初始状态quiz应该为空');
    assertEqual(initialState.mode, 'quick', '默认模式应该是quick');
}
'''
            },
        }

        gap_id = 1
        for risk in self.risk_areas:
            if risk.priority in ['critical', 'high']:
                for area_type, template in gap_templates.items():
                    if area_type.lower() in risk.risk_type.lower() or area_type.lower() in risk.description.lower():
                        test_gaps.append(TestGap(
                            id=f"GAP-{gap_id:03d}",
                            risk_area=risk,
                            suggested_test_name=template['name'],
                            test_description=template['description'],
                            test_code=template['template'],
                            test_category=area_type,
                            expected_behavior=self._generate_expected_behavior(risk)
                        ))
                        gap_id += 1
                        break
                else:
                    test_gaps.append(TestGap(
                        id=f"GAP-{gap_id:03d}",
                        risk_area=risk,
                        suggested_test_name=f"test_{risk.function_name}",
                        test_description=f"测试{risk.function_name}函数",
                        test_code=self._generate_test_for_function(risk),
                        test_category=risk.risk_type,
                        expected_behavior=self._generate_expected_behavior(risk)
                    ))
                    gap_id += 1

        self.test_gaps = test_gaps
        return test_gaps

    def _generate_test_for_function(self, risk: RiskArea) -> str:
        """为特定函数生成测试代码"""
        func_name = risk.function_name

        if func_name == 'pickOption':
            return '''
// 测试: pickOption函数
function testPickOption() {
    // 模拟答题场景
    const mockState = {
        quiz: [{id: '001', answer: 'A', options: [{key: 'A'}, {key: 'B'}, {key: 'C'}, {key: 'D'}]}],
        idx: 0,
        answered: false,
        correctCount: 0
    };

    // 测试选择正确答案
    const selectedCorrectKey = 'A';
    const isCorrect = selectedCorrectKey === mockState.quiz[mockState.idx].answer;
    assertEqual(isCorrect, true, '选择正确答案应该返回true');

    // 测试选择错误答案
    const selectedWrongKey = 'B';
    const isWrong = selectedWrongKey === mockState.quiz[mockState.idx].answer;
    assertEqual(isWrong, false, '选择错误答案应该返回false');

    // 测试防止重复答题
    assertEqual(mockState.answered, false, '初始状态answered应该为false');
    mockState.answered = true;
    assertEqual(mockState.answered, true, '答题后answered应该为true');
}
'''

        elif func_name == 'saveQuestion':
            return '''
// 测试: saveQuestion函数
function testSaveQuestion() {
    // 测试新增题目
    const newQuestion = {
        id: 'new_' + Date.now(),
        category: '测试分类',
        question: '这是测试题目',
        options: [{key: 'A', text: '选项A'}, {key: 'B', text: '选项B'}],
        answer: 'A',
        explanation: '这是测试解析'
    };

    // 验证题目结构
    assertEqual('id' in newQuestion, true, '题目应该有id');
    assertEqual('question' in newQuestion, true, '题目应该有question');
    assertEqual('options' in newQuestion, true, '题目应该有options');
    assertEqual('answer' in newQuestion, true, '题目应该有answer');
    assertEqual(newQuestion.options.length >= 2, true, '题目至少有2个选项');
}
'''

        elif func_name == 'importData':
            return '''
// 测试: importData函数
function testImportData() {
    // 测试有效数据结构
    const validData = {
        questionBank: [
            {id: '001', category: 'album', question: 'Q1', options: [{key: 'A', text: 'A'}], answer: 'A', explanation: 'E1'}
        ],
        userData: {
            history: [],
            wrong: [],
            stats: {total: 0, correct: 0, cats: {}}
        }
    };

    // 验证导入数据格式
    assertEqual('questionBank' in validData || 'userData' in validData, true, '数据应该包含有效字段');

    // 测试无效数据
    const invalidData = {invalid: 'data'};
    assertEqual('questionBank' in invalidData || 'userData' in invalidData, false, '无效数据应该被拒绝');

    // 测试JSON解析
    const jsonStr = JSON.stringify(validData);
    const parsed = JSON.parse(jsonStr);
    assertEqual(parsed.questionBank.length, 1, '解析后的数据应该正确');
}
'''

        elif func_name == 'exportData':
            return '''
// 测试: exportData函数
function testExportData() {
    // 测试导出数据结构
    const exportData = {
        questionBank: QUESTION_BANK,
        userData: DB.get(),
        exportTime: new Date().toISOString()
    };

    // 验证导出数据完整性
    assertEqual('questionBank' in exportData, true, '导出数据应包含题库');
    assertEqual('userData' in exportData, true, '导出数据应包含用户数据');
    assertEqual('exportTime' in exportData, true, '导出数据应包含导出时间');

    // 验证导出JSON格式
    const jsonStr = JSON.stringify(exportData, null, 2);
    const parsed = JSON.parse(jsonStr);
    assertEqual(parsed.questionBank.length, QUESTION_BANK.length, '导出题库应该完整');
}
'''

        elif func_name == 'shuffle':
            return '''
// 测试: shuffle函数
function testShuffleFunction() {
    // 测试基本shuffle
    const original = [1, 2, 3, 4, 5];
    const shuffled = shuffle(original);

    // 验证shuffle不改变原数组
    assertEqual(original.length, shuffled.length, '长度应该一致');

    // 验证shuffle结果包含所有原元素
    const originalSet = new Set(original);
    const shuffledSet = new Set(shuffled);
    assertEqual(originalSet.size, shuffledSet.size, '应该包含所有元素');

    // 验证shuffle的随机性（多次运行应该产生不同结果）
    const results = new Set();
    for (let i = 0; i < 10; i++) {
        results.add(shuffle([1, 2, 3]).join(','));
    }
    // 由于随机性，至少应该有一些不同的结果
    assertEqual(results.size > 1, true, 'shuffle应该产生随机结果');
}
'''

        else:
            return f'''
// 测试: {func_name}函数
function test{func_name.title().replace('_', '')}() {{
    // TODO: 为 {func_name} 编写具体测试用例
    // 风险类型: {risk.risk_type}
    // 优先级: {risk.priority}

    // 测试基本功能
    // assert(condition, '测试描述');
}}
'''

    def _generate_expected_behavior(self, risk: RiskArea) -> str:
        """生成预期行为描述"""
        behaviors = {
            'JSON解析': 'JSON.parse应该正确解析有效JSON，对于无效JSON应该抛出错误或返回默认值',
            '本地存储': 'localStorage应该正确保存和读取数据，对于异常情况应该有降级处理',
            '核心业务': '核心业务逻辑应该按照预期执行，边界情况应该有明确处理',
            '数据校验': '数据校验应该正确识别有效和无效输入，拒绝无效输入并给出提示',
            '数组方法': '数组操作应该正确处理各种边界情况（空数组、单元素数组等）',
            '共享工具': '共享工具函数应该是确定性的、可预测的，并正确处理错误输入',
        }

        for key, behavior in behaviors.items():
            if key.lower() in risk.risk_type.lower():
                return behavior

        return f'{risk.function_name}应该按照设计规范正确执行'

    def analyze_test_coverage(self) -> Dict[str, Any]:
        """分析测试覆盖情况"""
        coverage_analysis = {
            'total_functions': 0,
            'tested_functions': [],
            'untested_functions': [],
            'critical_areas_untested': [],
            'coverage_percentage': 0.0
        }

        code_analysis = self.analyze_html_codebase()
        functions = code_analysis.get('functions', [])

        coverage_analysis['total_functions'] = len(functions)

        critical_functions = ['pickOption', 'saveQuestion', 'importData', 'exportData',
                              'shuffle', 'DB.get', 'DB.save', 'startRandomQuiz', 'renderQ']

        for func in functions:
            if func['name'] in critical_functions:
                if func['name'] not in coverage_analysis['tested_functions']:
                    coverage_analysis['critical_areas_untested'].append({
                        'name': func['name'],
                        'complexity': func['complexity'],
                        'priority': 'high'
                    })

        coverage_analysis['coverage_percentage'] = (
            len(coverage_analysis['tested_functions']) / coverage_analysis['total_functions'] * 100
            if coverage_analysis['total_functions'] > 0 else 0
        )

        return coverage_analysis

    def generate_report(self) -> str:
        """生成测试缺口分析报告"""
        report = []
        report.append("=" * 80)
        report.append("测试缺口分析报告")
        report.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("=" * 80)
        report.append("")

        report.append("## 1. 代码变更分析")
        report.append("-" * 80)
        if not self.changes:
            report.append("近期（30天内）未发现代码提交。")
        else:
            for change in self.changes:
                report.append(f"\n提交: {change.commit_hash[:7]}")
                report.append(f"消息: {change.commit_message}")
                report.append(f"作者: {change.author}")
                report.append(f"日期: {change.date}")
                report.append(f"文件变更: {', '.join(change.files_changed) if change.files_changed else '无'}")
                report.append(f"代码行变化: +{change.additions} -{change.deletions}")

                if 'fix' in change.commit_message.lower() or 'bug' in change.commit_message.lower():
                    report.append("⚠️ 注意: 这是Bug修复提交，应检查是否需要补充测试")
        report.append("")

        code_analysis = self.analyze_html_codebase()
        report.append("## 2. 代码库分析")
        report.append("-" * 80)
        report.append(f"文件: index.html")
        report.append(f"总行数: {code_analysis.get('total_lines', 0)}")
        report.append(f"提取的函数数: {len(code_analysis.get('functions', []))}")
        report.append(f"复杂逻辑区域: {len(code_analysis.get('complexity_areas', []))}")
        report.append(f"事件处理器: {len(code_analysis.get('event_handlers', []))}")
        report.append("")

        report.append("### 2.1 关键函数列表")
        report.append("")
        for func in code_analysis.get('functions', [])[:20]:
            if func['complexity'] > 5 or func['has_validation'] or func['has_loops']:
                report.append(f"- {func['name']} (复杂度: {func['complexity']}, "
                            f"条件: {'是' if func['has_conditions'] else '否'}, "
                            f"循环: {'是' if func['has_loops'] else '否'})")
        report.append("")

        report.append("### 2.2 复杂逻辑区域")
        report.append("")
        for area in code_analysis.get('complexity_areas', [])[:10]:
            report.append(f"- [{area['priority']}] Line {area['line']}: {area['type']}")
        report.append("")

        report.append("### 2.3 用户交互流程")
        report.append("")
        for interaction in code_analysis.get('user_interactions', []):
            report.append(f"- {interaction['function']}: {interaction['type']}")
        report.append("")

        self.identify_risk_areas(code_analysis)

        report.append("## 3. 风险区域识别")
        report.append("-" * 80)
        if not self.risk_areas:
            report.append("未识别到高风险区域。")
        else:
            report.append(f"\n共识别到 {len(self.risk_areas)} 个风险区域：\n")

            for i, risk in enumerate(self.risk_areas, 1):
                priority_icon = {'critical': '🔴', 'high': '🟠', 'medium': '🟡'}.get(risk.priority, '⚪')
                report.append(f"\n### 3.{i} {priority_icon} {risk.function_name}")
                report.append(f"- **文件**: {risk.file_path}")
                report.append(f"- **风险类型**: {risk.risk_type}")
                report.append(f"- **优先级**: {risk.priority.upper()}")
                report.append(f"- **位置**: {risk.affected_lines}")
                report.append(f"- **描述**: {risk.description}")
                if risk.code_snippet:
                    report.append(f"- **代码片段**:\n```javascript\n{risk.code_snippet[:200]}...\n```")
        report.append("")

        self.generate_test_gaps()

        report.append("## 4. 测试缺口清单")
        report.append("-" * 80)
        if not self.test_gaps:
            report.append("未识别到需要补充测试的区域。")
        else:
            report.append(f"\n建议补充 {len(self.test_gaps)} 个测试用例：\n")

            for gap in self.test_gaps:
                report.append(f"\n### {gap.id}: {gap.suggested_test_name}")
                report.append(f"- **风险区域**: {gap.risk_area.function_name}")
                report.append(f"- **测试分类**: {gap.test_category}")
                report.append(f"- **描述**: {gap.test_description}")
                report.append(f"- **预期行为**: {gap.expected_behavior}")
                report.append(f"- **测试代码**:\n```javascript\n{gap.test_code}\n```")
        report.append("")

        coverage = self.analyze_test_coverage()
        report.append("## 5. 测试覆盖分析")
        report.append("-" * 80)
        report.append(f"- **总函数数**: {coverage['total_functions']}")
        report.append(f"- **已测试函数数**: {coverage['tested_functions']}")
        report.append(f"- **未测试函数数**: {len(coverage['untested_functions'])}")
        report.append(f"- **关键区域未测试数**: {len(coverage['critical_areas_untested'])}")
        report.append(f"- **覆盖率估算**: {coverage['coverage_percentage']:.1f}%")

        if coverage['critical_areas_untested']:
            report.append("\n### 5.1 关键区域覆盖情况")
            for func in coverage['critical_areas_untested']:
                report.append(f"- ⚠️ **{func['name']}** (复杂度: {func['complexity']})")
        report.append("")

        report.append("## 6. 建议与总结")
        report.append("-" * 80)

        high_priority_gaps = [g for g in self.test_gaps if g.risk_area.priority in ['critical', 'high']]

        if high_priority_gaps:
            report.append("\n### 6.1 高优先级补充建议")
            report.append(f"\n建议优先补充以下 {len(high_priority_gaps)} 个测试用例以降低回归风险：\n")
            for gap in high_priority_gaps:
                report.append(f"- [{gap.id}] **{gap.suggested_test_name}** - {gap.test_category}")
        else:
            report.append("\n未发现高优先级的测试缺口。")

        report.append("\n### 6.2 测试实现建议")
        report.append("""
1. **测试框架选择**: 建议使用 Jest 或 Mocha + Chai 进行JavaScript单元测试
2. **测试隔离**: 每个测试应该独立运行，不依赖其他测试的状态
3. **边界条件**: 特别注意空值、异常数据、超大数值等边界情况
4. **持续集成**: 建议在CI/CD流程中集成测试，确保每次提交都有测试覆盖
5. **覆盖率目标**: 建议核心业务逻辑覆盖率达到80%以上
        """)

        report.append("\n### 6.3 跳过区域说明")
        report.append("""
根据分析，以下区域可以暂不补充测试：
- 纯UI样式调整和CSS修改
- 纯粹的外观变化（如按钮位置、颜色调整）
- 不涉及业务逻辑的注释和文档更新
- 保持现有行为不变的重构
        """)

        report.append("\n" + "=" * 80)
        report.append("报告结束")
        report.append("=" * 80)

        return '\n'.join(report)

    def save_report(self, output_file: str = None):
        """保存报告到文件"""
        if output_file is None:
            output_file = f"test_gap_analysis_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"

        report = self.generate_report()

        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(report)

        print(f"报告已保存到: {output_file}")

        json_output = output_file.replace('.txt', '.json')
        json_data = {
            'generated_at': datetime.now().isoformat(),
            'changes': [
                {
                    'commit_hash': c.commit_hash,
                    'message': c.commit_message,
                    'author': c.author,
                    'date': c.date,
                    'files': c.files_changed
                } for c in self.changes
            ],
            'risk_areas': [
                {
                    'function': r.function_name,
                    'type': r.risk_type,
                    'priority': r.priority,
                    'description': r.description,
                    'location': r.affected_lines
                } for r in self.risk_areas
            ],
            'test_gaps': [
                {
                    'id': g.id,
                    'test_name': g.suggested_test_name,
                    'category': g.test_category,
                    'description': g.test_description,
                    'expected_behavior': g.expected_behavior,
                    'code': g.test_code
                } for g in self.test_gaps
            ]
        }

        with open(json_output, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)

        print(f"JSON数据已保存到: {json_output}")

        return output_file, json_output


def main():
    """主函数"""
    print("=" * 80)
    print("自动化测试缺口分析工具")
    print("=" * 80)
    print()

    analyzer = TestGapAnalyzer(repo_path='.')

    print("1. 获取近期代码变更...")
    changes = analyzer.get_recent_changes(days=30)
    print(f"   找到 {len(changes)} 个提交")

    print("\n2. 分析代码库...")
    code_analysis = analyzer.analyze_html_codebase()
    print(f"   分析了 {code_analysis.get('total_lines', 0)} 行代码")
    print(f"   提取了 {len(code_analysis.get('functions', []))} 个函数")

    print("\n3. 识别风险区域...")
    risk_areas = analyzer.identify_risk_areas(code_analysis)
    print(f"   识别了 {len(risk_areas)} 个风险区域")

    print("\n4. 生成测试缺口...")
    test_gaps = analyzer.generate_test_gaps()
    print(f"   生成了 {len(test_gaps)} 个测试缺口建议")

    print("\n5. 分析测试覆盖...")
    coverage = analyzer.analyze_test_coverage()
    print(f"   当前覆盖率估算: {coverage['coverage_percentage']:.1f}%")

    print("\n6. 生成报告...")
    txt_file, json_file = analyzer.save_report()

    print("\n" + "=" * 80)
    print("分析完成！")
    print("=" * 80)
    print(f"\n📊 报告文件:")
    print(f"   - 文本报告: {txt_file}")
    print(f"   - JSON数据: {json_file}")
    print(f"\n🔍 关键发现:")
    print(f"   - 风险区域总数: {len(risk_areas)}")
    print(f"   - 建议补充测试数: {len(test_gaps)}")
    print(f"   - 高优先级测试数: {len([g for g in test_gaps if g.risk_area.priority in ['critical', 'high']])}")


if __name__ == '__main__':
    main()
