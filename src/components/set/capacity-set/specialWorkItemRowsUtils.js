/**
 * 「特殊节点流配置」表格的行与选项工具方法。
 * 纯函数、无外部依赖，便于用 node 直接跑断言，避免表格拆行逻辑回归。
 */

/**
 * 工作项下拉模糊搜索：中文名（label）与 key（value）均可命中，
 * 忽略大小写与空格差异（例：输入“项目 工时”可匹配“项目工时”）。
 */
export const filterWorkItemOption = (input, option) => {
  const keyword = String(input ?? '').trim().toLowerCase().replace(/\s+/g, '');
  if (!keyword) return true;
  const label = String(option?.label ?? '').toLowerCase().replace(/\s+/g, '');
  const value = String(option?.value ?? '').toLowerCase();
  return label.includes(keyword) || value.includes(keyword);
};

/** 构造一条「特殊节点流配置」行 */
export const buildSpecialWorkItemRow = (id, projectKey, overrides = {}) => ({
  id,
  "projectKey": projectKey,
  "configType": "special",
  "configDescribe": "特殊配置",
  "workItemId": "",
  "workItemName": "",
  "tag": null,
  "registerLevelVoList": [],
  "levelCodes": null,
  ...overrides,
});

/**
 * 工作项多选后的行拆分计算。
 * 当前行保留自身工作项；其余新选中的工作项各自拆成一条新行，紧随当前行插入，
 * 并继承当前行已配置的「可登记层级」。
 *
 * @param {Array} rows 表格数据
 * @param {string} rowId 触发操作的行 id
 * @param {Array<{label: string, value: string}>} selected 下拉多选结果
 * @param {string} projectKey
 * @param {Function} createId 新行 id 生成器
 * @returns {{ rows: Array, workItemErrorCleared: boolean } | null} null 表示无需变更
 */
export const applyWorkItemMultiSelect = (rows, rowId, selected, projectKey, createId) => {
  const values = (Array.isArray(selected) ? selected : selected ? [selected] : []).filter(Boolean);
  const index = rows.findIndex(item => item.id === rowId);
  if (index === -1) return null;

  const ownId = rows[index].workItemId;
  const ownKept = !!ownId && values.some(v => v.value === ownId);
  // 除当前行自身外，需要拆成新行的工作项
  const pending = values.filter(v => v.value !== ownId);

  // 当前行工作项：null = 保持不变；对象 = 改为该项；'' = 清空
  let nextOwn = null;
  if (!ownKept) nextOwn = pending.length > 0 ? pending.shift() : '';
  if (nextOwn === '' && !ownId) return null;                 // 空行未选中任何项，无需变更
  if (nextOwn === null && pending.length === 0) return null; // 选择结果无变化

  const next = rows.map(item => ({ ...item }));
  // 当前行工作项发生变化时，原有的层级配置失效，需重新选择
  if (nextOwn !== null) {
    next[index].workItemId = nextOwn ? nextOwn.value : '';
    next[index].workItemName = nextOwn ? nextOwn.label : '';
    next[index].registerLevelVoList = [];
  }

  // 其余新选中的工作项各自拆成一行，继承当前行已配置的层级
  const inheritLevels = (next[index].registerLevelVoList || []).map(l => ({ ...l }));
  const newRows = pending.map(v =>
    buildSpecialWorkItemRow(createId(), next[index].projectKey || projectKey, {
      workItemId: v.value,
      workItemName: v.label,
      registerLevelVoList: inheritLevels.map(l => ({ ...l })),
    })
  );

  return {
    // 新行紧随当前行插入，避免出现在表格末尾需要滚动查找
    rows: newRows.length > 0
      ? [...next.slice(0, index + 1), ...newRows, ...next.slice(index + 1)]
      : next,
    workItemErrorCleared: nextOwn === null || !!nextOwn,
  };
};
