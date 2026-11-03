/**
 * 工时审批 - 菜单与状态页签配置
 *
 * 侧边栏一级 tab：
 *   all                全部审批
 *   self-initiated     我发起的
 *   self-approve-todo  待办（只查待审批，不展示状态页签）
 *   self-approve-done  已办（全部 / 待审批 / 已通过 / 已拒绝）
 */

/** 侧边栏一级 tab key */
export const MENU_KEY = {
  ALL: "all",
  SELF_INITIATED: "self-initiated",
  SELF_APPROVE_TODO: "self-approve-todo",
  SELF_APPROVE_DONE: "self-approve-done",
};

/** 页面数量接口（postSinglePageCount / postBatchPageCount）的 tabType 映射 */
export const TAB_TYPE_MAP = {
  [MENU_KEY.ALL]: 1,
  [MENU_KEY.SELF_INITIATED]: 2,
  [MENU_KEY.SELF_APPROVE_TODO]: 4,
  [MENU_KEY.SELF_APPROVE_DONE]: 5,
};

/** 待办固定查「待审批」状态 */
export const TODO_STATUS = "1";

export const isSelfApproveTodo = (curMenu) => curMenu === MENU_KEY.SELF_APPROVE_TODO;

export const isSelfApproveDone = (curMenu) => curMenu === MENU_KEY.SELF_APPROVE_DONE;

/**
 * 状态页签 key -> 请求字段取值
 *   "0" 全部      -> 不传状态字段
 *   "1" 待审批    -> 1
 *   "2" 已通过    -> 2
 *   "3" 已拒绝    -> 3
 *   "4" 已撤回    -> 4
 *   "5" 已撤销    -> 5
 */
export const STATUS_KEY_MAP = {
  "0": null,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
};

/**
 * 待办 tab 不展示状态页签，返回 null；
 * 已办 tab 展示 全部 / 待审批 / 已通过 / 已拒绝；
 * 其余 tab 保持原来的 6 个页签。
 *
 * @param {object} params
 * @param {string} params.curMenu 当前一级 tab key
 * @param {object} params.counts  计数，键：all/wait/pass/refuse/cancel/revoke/done
 * @returns {Array|null} Menu items
 */
export function buildStatusMenuItems({ curMenu, counts = {} }) {
  const withCount = (text, num) => `${text}（${num || 0}）`;

  if (isSelfApproveTodo(curMenu)) return null;

  if (isSelfApproveDone(curMenu)) {
    return [
      // 「全部」计数取列表接口同名字段：单条 approvalSignalNum / 汇总 approvalCollectNum（即 counts.all）
      { key: "0", label: withCount("全部", counts.all) },
      // 待审批：传参链与其他 tab 同一套（STATUS_KEY_MAP["1"] -> 1），计数用现有 waitApproveNum
      { key: "1", label: withCount("待审批", counts.wait) },
      { key: "2", label: withCount("已通过", counts.pass) },
      { key: "3", label: withCount("已拒绝", counts.refuse) },
    ];
  }

  return [
    { key: "0", label: withCount("全部", counts.all) },
    { key: "1", label: withCount("待审批", counts.wait) },
    { key: "2", label: withCount("已通过", counts.pass) },
    { key: "3", label: withCount("已拒绝", counts.refuse) },
    { key: "4", label: withCount("已撤回", counts.cancel) },
    { key: "5", label: withCount("已撤销", counts.revoke) },
  ];
}

/**
 * 计算列表请求需要下发的「状态」取值
 * 待办强制为 1（待审批），其余 tab 用当前选中的状态页签（"0" 表示不传）。
 */
export function getEffectiveStatus({ curMenu, curApprovalState }) {
  if (isSelfApproveTodo(curMenu)) return TODO_STATUS;
  return STATUS_KEY_MAP[curApprovalState] ?? null;
}
