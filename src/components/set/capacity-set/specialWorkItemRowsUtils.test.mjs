/**
 * specialWorkItemRowsUtils 的断言脚本（无测试框架，直接用 node 运行）：
 *   node src/components/set/capacity-set/specialWorkItemRowsUtils.test.mjs
 */
import {
  filterWorkItemOption,
  buildSpecialWorkItemRow,
  applyWorkItemMultiSelect,
} from './specialWorkItemRowsUtils.js';

let pass = 0;
const failures = [];
const check = (name, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass++; } else { failures.push(`${name}\n  expected: ${e}\n  actual:   ${a}`); }
};

/* ---------- 1. 模糊搜索 ---------- */
const opt = (label, value) => ({ label, value });
check('空输入全部命中', filterWorkItemOption('', opt('项目工时', 'work_item')), true);
check('undefined 输入全部命中', filterWorkItemOption(undefined, opt('项目工时', 'work_item')), true);
check('中文名模糊命中', filterWorkItemOption('项目', opt('项目工时', 'work_item')), true);
check('中文名多字模糊命中', filterWorkItemOption('工时', opt('项目工时', 'work_item')), true);
check('中文名不命中', filterWorkItemOption('需求', opt('项目工时', 'work_item')), false);
check('按 key 命中', filterWorkItemOption('work_item', opt('项目工时', 'work_item')), true);
check('忽略大小写', filterWorkItemOption('WORK_ITEM', opt('项目工时', 'work_item')), true);
check('忽略输入空格', filterWorkItemOption('项目 工时', opt('项目工时', 'work_item')), true);
check('label 缺省不抛错', filterWorkItemOption('a', { value: 'abc' }), true);
check('option 为空不抛错', filterWorkItemOption('a', null), false);

/* ---------- 2. 行构造 ---------- */
check('基础行结构', buildSpecialWorkItemRow('id-1', 'pk'), {
  id: 'id-1', projectKey: 'pk', configType: 'special', configDescribe: '特殊配置',
  workItemId: '', workItemName: '', tag: null, registerLevelVoList: [], levelCodes: null,
});
check('覆盖字段', buildSpecialWorkItemRow('id-2', 'pk', { workItemId: 'w1', workItemName: 'A' }).workItemId, 'w1');

/* ---------- 3. 多选拆行 ---------- */
const levels = [{ type: 'node', typeDescribe: '节点' }];
const row = (id, workItemId, name, lv = []) => ({
  id, projectKey: 'pk', configType: 'special', configDescribe: '特殊配置',
  workItemId, workItemName: name, tag: null, registerLevelVoList: lv, levelCodes: null,
});
let seq = 0;
const createId = () => `new-${++seq}`;
const sel = (...names) => names.map(n => ({ label: n.toUpperCase(), value: n }));

seq = 0;
const empty = [row('r1', '', '')];
const case1 = applyWorkItemMultiSelect(empty, 'r1', sel('w1'), 'pk', createId);
check('空行选 1 项：填充当前行', case1.rows.map(r => [r.id, r.workItemId, r.workItemName]), [['r1', 'w1', 'W1']]);
check('空行选 1 项：不新增行', case1.rows.length, 1);
check('空行选 1 项：清除错误标记', case1.workItemErrorCleared, true);

seq = 0;
const case2 = applyWorkItemMultiSelect(empty, 'r1', sel('w1', 'w2', 'w3'), 'pk', createId);
check('空行选 3 项：行序', case2.rows.map(r => r.workItemId), ['w1', 'w2', 'w3']);
check('空行选 3 项：id 唯一', new Set(case2.rows.map(r => r.id)).size, 3);

seq = 0;
const existing = [row('r1', 'w0', 'W0', levels), row('r2', 'w9', 'W9')];
const case3 = applyWorkItemMultiSelect(existing, 'r1', [...sel('w0'), ...sel('w1')], 'pk', createId);
check('已有行多选 1 项：当前行不变', [case3.rows[0].workItemId, case3.rows[0].workItemName], ['w0', 'W0']);
check('已有行多选 1 项：新行紧随其后', case3.rows.map(r => r.workItemId), ['w0', 'w1', 'w9']);
check('已有行多选 1 项：层级被继承', case3.rows[1].registerLevelVoList, levels);
check('已有行多选 1 项：当前行层级保留', case3.rows[0].registerLevelVoList, levels);
check('新行继承层级为深拷贝', case3.rows[1].registerLevelVoList !== case3.rows[0].registerLevelVoList, true);
check('原数组未被修改', existing.length, 2);

seq = 0;
const stale = [row('r1', 'w0', 'W0', levels)];
const firstClick = applyWorkItemMultiSelect(stale, 'r1', [...sel('w0'), ...sel('w1')], 'pk', createId);
const secondClick = applyWorkItemMultiSelect(firstClick.rows, 'r1', [...sel('w0'), ...sel('w2')], 'pk', createId);
check('连续多选：两次新增的行都保留', secondClick.rows.map(r => r.workItemId), ['w0', 'w2', 'w1']);
check('连续多选：行数正确', secondClick.rows.length, 3);
check('连续多选：新行继承层级', secondClick.rows[1].registerLevelVoList, levels);
check('连续多选：不修改入参', firstClick.rows.length, 2);

seq = 0;
const case5 = applyWorkItemMultiSelect([row('r1', 'w0', 'W0', levels)], 'r1', [], 'pk', createId);
check('取消自身：清空当前行', [case5.rows[0].workItemId, case5.rows[0].workItemName], ['', '']);
check('取消自身：层级被清空', case5.rows[0].registerLevelVoList, []);
check('取消自身：无新增行', case5.rows.length, 1);
check('取消自身：不清除错误标记', case5.workItemErrorCleared, false);

seq = 0;
const case6 = applyWorkItemMultiSelect([row('r1', 'w0', 'W0', levels)], 'r1', sel('w1', 'w2'), 'pk', createId);
check('取消自身并另选 2 项：当前行改为第一项', [case6.rows[0].workItemId, case6.rows[0].registerLevelVoList], ['w1', []]);
check('取消自身并另选 2 项：第二项拆行', case6.rows.map(r => r.workItemId), ['w1', 'w2']);

seq = 0;
check('无变化返回 null', applyWorkItemMultiSelect([row('r1', 'w0', 'W0')], 'r1', sel('w0'), 'pk', createId), null);
check('空行未选中返回 null', applyWorkItemMultiSelect([row('r1', '', '')], 'r1', [], 'pk', createId), null);
check('行不存在返回 null', applyWorkItemMultiSelect([row('r1', '', '')], 'unknown', sel('w1'), 'pk', createId), null);

seq = 0;
const inheritedPk = applyWorkItemMultiSelect([row('r1', '', '')], 'r1', sel('w1', 'w2'), 'pk', createId);
check('新行 projectKey 取当前行', inheritedPk.rows[1].projectKey, 'pk');
check('新行 configType', inheritedPk.rows[1].configType, 'special');

console.log(`passed: ${pass}`);
console.log(`failed: ${failures.length}`);
failures.forEach(f => console.log('---\n' + f));
process.exitCode = failures.length ? 1 : 0;
