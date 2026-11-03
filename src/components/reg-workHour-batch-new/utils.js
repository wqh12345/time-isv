/**
 * RegWorkHourBatchNew 纯函数/常量/工具函数集合
 * 所有函数均为无副作用的纯函数，不依赖组件状态
 */
import dayjs from "dayjs";
import Decimal from "decimal.js";
import {
  getWeekStartAndEnd,
  getFirstDayOfNaturalMonth,
  getLastDayOfNaturalMonth,
  getQuarterStartAndEnd,
  getDatesInRange,
} from "../../util/util";

// ============ 常量 ============

/** 日期范围预设 */
export const rangePresets = [
  {
    label: "本周",
    value: [
      dayjs(getWeekStartAndEnd().Monday),
      dayjs(getWeekStartAndEnd().Sunday),
    ],
  },
  {
    label: "本月",
    value: [
      dayjs(getFirstDayOfNaturalMonth()),
      dayjs(getLastDayOfNaturalMonth()),
    ],
  },
  {
    label: "本季度",
    value: [
      dayjs(getQuarterStartAndEnd().start),
      dayjs(getQuarterStartAndEnd().end),
    ],
  },
];

/** 将考勤数值字段归一化为有限数字，空值和非法值统一按无值处理。 */
export const normalizeAttendanceNumber = (value) => {
  if (value === null || value === undefined
    || (typeof value === 'string' && value.trim() === '')) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

/** 按考勤场景计算有效的每日填报上限。 */
export const getAttendanceUpperLimit = ({
  enabled,
  hours,
  policy,
  customLimit,
  dayUp,
}) => {
  const normalizedEnabled = normalizeAttendanceNumber(enabled);
  const normalizedHours = normalizeAttendanceNumber(hours);
  const normalizedPolicy = normalizeAttendanceNumber(policy);
  const normalizedCustomLimit = normalizeAttendanceNumber(customLimit);
  const normalizedDayUp = normalizeAttendanceNumber(dayUp);
  const fallbackDayUp = normalizedDayUp || 24;

  if (normalizedEnabled === 0) return fallbackDayUp;
  if (normalizedHours !== null && normalizedHours > 0) return normalizedHours;
  if (normalizedPolicy === 2 && normalizedCustomLimit !== null) return normalizedCustomLimit;
  return 0;
};

// ============ 数据转换 ============

/** 转化缓存的数据结构 */
export const transformWorkHourData = (originalData) => {
  if (!originalData || !Array.isArray(originalData)) return [];
  return originalData.map(item => {
    const transformedItem = {
      workItemId: item.workItemId,
      workItemName: item.workItemName,
      workItemEntityId: item.workItemEntityId,
      workItemEntityName: item.workItemEntityName,
      pattern: item.pattern,
      newPattern: item.newPattern,
      scheduleStart: item.scheduleStart,
      scheduleEnd: item.scheduleEnd,
      estimatedWorkingHoursAll: item.estimatedWorkingHoursAll,
      estimatedWorkingHoursSelf: item.estimatedWorkingHoursSelf,
      children: item.workItemType === 'workflow' ? [] : null
    };
    if (item.children && Array.isArray(item.children)) {
      transformedItem.children = item.children.map(childNode => {
        const transformedNode = {
          nodeId: childNode.nodeId,
          nodeName: childNode.nodeName,
          scheduleStart: childNode.scheduleStart,
          scheduleEnd: childNode.scheduleEnd,
          estimatedWorkingHoursAll: childNode.estimatedWorkingHoursAll,
          estimatedWorkingHoursSelf: childNode.estimatedWorkingHoursSelf,
          children: childNode.children && Array.isArray(childNode.children) ? childNode.children : null
        };
        if (childNode.children && Array.isArray(childNode.children)) {
          transformedNode.children = childNode.children.map(task => ({
            taskId: task.taskId,
            taskName: task.taskName,
            scheduleStart: task.scheduleStart,
            scheduleEnd: task.scheduleEnd,
            estimatedWorkingHoursAll: task.estimatedWorkingHoursAll,
            estimatedWorkingHoursSelf: task.estimatedWorkingHoursSelf
          }));
        }
        return transformedNode;
      });
    }
    return transformedItem;
  });
};

/**
 * 查找匹配的项
 * @param {Array} data1 - 工作项实例数据
 * @param {Object} data2 - 右下角添加实例 {workItemIds, workItemEntityId, nodeIds}
 * @param {number} nodeTaskOptionsLength - 节点任务选项长度
 */
export const findMatchingItems = (data1, data2, nodeTaskOptionsLength) => {
  const results = [];
  const { workItemIds, workItemEntityId, nodeIds } = data2;
  let allNodeIds = [];
  data1.forEach(item1 => {
    if (workItemIds.includes(item1.workItemId) &&
      workItemEntityId === item1.workItemEntityId) {
      if (nodeIds.length > 0) {
        nodeIds.forEach(nodeInfo => {
          const { nodeId, taskIds } = nodeInfo;
          if (item1.children && item1.children.length > 0) {
            item1.children.forEach(child => {
              allNodeIds.push(child.nodeId);
              if (child.nodeId === nodeId) {
                if (taskIds && taskIds.length > 0) {
                  const filteredTasks = child.children?.filter(task => taskIds.includes(task.taskId)) || [];
                  child.children = filteredTasks;
                } else {
                  child.children = null;
                }
              }
            });
          }
        });
      } else {
        item1.children = null;
      }
    }
  });
  const allTaskIdsEmpty = nodeIds.every(nodeInfo =>
    nodeInfo.taskIds?.length === 0
  );
  if (allTaskIdsEmpty && nodeTaskOptionsLength === nodeIds.length) {
    if (data1.length > 0) {
      data1[0].children = null;
    }
  }
  return data1;
};

// ============ 工时聚合 ============

/** 处理「再次发起」的工时聚合 */
export const aggregateWorkHours = (data) => {
  try {
    const result = {};
    data.forEach((item) => {
      const date = dayjs(item.workDate).format("YYYY-MM-DD");
      if (!result[date]) {
        result[date] = {};
      }
      const workItemEntityKey = `${item.projectKey || "default"}_${item.workItemId}_${item.workItemEntityId || "default"}`;
      if (!result[date][workItemEntityKey]) {
        result[date][workItemEntityKey] = {
          projectKey: item.projectKey,
          projectName: item.projectName,
          workItemId: item.workItemId,
          workItemEntityId: item.workItemEntityId || "default",
          workItemName: item.workItemName,
          workDesc: item.workDesc,
          workItemEntityName: item.workItemEntityName,
          realActWorkHour: item.actWorkHour || 0,
          actWorkHour: 0,
          nodes: {},
        };
      }
      result[date][workItemEntityKey].realActWorkHour =
        !item.nodeId && !item.taskId ? item.actWorkHour || null : null;
      result[date][workItemEntityKey].workDesc =
        !item.nodeId && !item.taskId ? item.workDesc || "" : "";
      if (item.nodeId) {
        const nodeKey = item.nodeId;
        if (!result[date][workItemEntityKey].nodes[nodeKey]) {
          result[date][workItemEntityKey].nodes[nodeKey] = {
            nodeId: item.nodeId,
            nodeName: item.nodeName,
            workDesc: item.workDesc,
            realActWorkHour: item.actWorkHour || 0,
            actWorkHour: 0,
            tasks: {},
          };
        }
        result[date][workItemEntityKey].nodes[nodeKey].realActWorkHour =
          item.nodeId && !item.taskId ? item.actWorkHour || null : null;
        result[date][workItemEntityKey].nodes[nodeKey].workDesc = !item.taskId
          ? item.workDesc || ""
          : "";
        if (item.taskId) {
          const taskKey = item.taskId;
          if (!result[date][workItemEntityKey].nodes[nodeKey].tasks[taskKey]) {
            result[date][workItemEntityKey].nodes[nodeKey].tasks[taskKey] = {
              taskId: item.taskId,
              taskName: item.taskName,
              workDesc: item.workDesc,
              realActWorkHour: item.actWorkHour || 0,
              actWorkHour: 0,
            };
          }
          result[date][workItemEntityKey].nodes[nodeKey].tasks[taskKey].workDesc = item.workDesc || "";
          result[date][workItemEntityKey].nodes[nodeKey].tasks[taskKey].actWorkHour =
            new Decimal(result[date][workItemEntityKey].nodes[nodeKey].tasks[taskKey].actWorkHour)
              .plus(item.actWorkHour).toNumber();
        }
        result[date][workItemEntityKey].nodes[nodeKey].actWorkHour =
          new Decimal(result[date][workItemEntityKey].nodes[nodeKey].actWorkHour)
            .plus(item.actWorkHour).toNumber();
      }
      result[date][workItemEntityKey].actWorkHour =
        new Decimal(result[date][workItemEntityKey].actWorkHour).plus(item.actWorkHour).toNumber();
    });
    return restoreOriginalStructure(result);
  } catch (error) {
    console.error("聚合工时时出错:", error);
  }
};

/** 还原聚合后的数据结构 */
export const restoreOriginalStructure = (result) => {
  const restoredData = [];
  Object.entries(result).forEach(([date, entities]) => {
    Object.values(entities).forEach((entity) => {
      restoredData.push({
        projectKey: entity.projectKey,
        projectName: entity.projectName,
        workItemId: entity.workItemId,
        workItemEntityId: entity.workItemEntityId === "default" ? null : entity.workItemEntityId,
        workItemName: entity.workItemName,
        workItemEntityName: entity.workItemEntityName,
        realActWorkHour: entity.realActWorkHour,
        actWorkHour: entity.actWorkHour,
        workDate: date,
        workDesc: entity.workDesc,
        nodeId: null,
        taskId: null,
        type: "workitem",
      });
      Object.values(entity.nodes).forEach((node) => {
        restoredData.push({
          projectKey: entity.projectKey,
          projectName: entity.projectName,
          workItemId: entity.workItemId,
          workItemEntityId: entity.workItemEntityId === "default" ? null : entity.workItemEntityId,
          workItemName: entity.workItemName,
          workItemEntityName: entity.workItemEntityName,
          nodeId: node.nodeId,
          nodeName: node.nodeName,
          realActWorkHour: node.realActWorkHour,
          actWorkHour: node.actWorkHour,
          workDate: date,
          workDesc: node.workDesc,
          taskId: null,
          type: "node",
        });
        Object.values(node.tasks).forEach((task) => {
          restoredData.push({
            projectKey: entity.projectKey,
            projectName: entity.projectName,
            workItemId: entity.workItemId,
            workItemEntityId: entity.workItemEntityId === "default" ? null : entity.workItemEntityId,
            workItemName: entity.workItemName,
            workItemEntityName: entity.workItemEntityName,
            nodeId: node.nodeId,
            nodeName: node.nodeName,
            taskId: task.taskId,
            taskName: task.taskName,
            realActWorkHour: task.realActWorkHour,
            actWorkHour: task.actWorkHour,
            workDate: date,
            workDesc: task.workDesc,
            type: "task",
          });
        });
      });
    });
  });
  return restoredData;
};

// ============ 树遍历 ============

/** 遍历树节点（添加唯一标识id和日期数据） */
export const traverseTreeRecursively = (node, beginWorkDate, endWorkDate, options = {}) => {
  const {
    openType,
    hasCache = false,
    localHourCache = [],
    editData = [],
    capacitySet = {},
    type,
    aggregateWorkHoursFn,
  } = options;

  node.id = `${node.projectKey}-${node.workItemId}-${node.workItemEntityId}-${node?.nodeId || "null"}-${node?.taskId || "null"}`;

  const rangeDates = getDatesInRange(beginWorkDate, endWorkDate);
  rangeDates?.forEach(({ date }) => {
    node[date] = {
      realActWorkHour: null,
      actWorkHour: null,
      workDesc: null,
      isRegFormOpen: false,
    };
  });

  if (openType === "again_launch" || hasCache || localHourCache.length > 0) {
    let lastEditData = editData && editData.length > 0 ? editData : localHourCache;
    lastEditData?.forEach((approvalItem) => {
      const date = dayjs(approvalItem?.workDate).format("YYYY-MM-DD");
      if (
        `${approvalItem.projectKey}-${approvalItem.workItemId}-${approvalItem.workItemEntityId}-${approvalItem?.nodeId || "null"}-${approvalItem?.taskId || "null"}` === node.id &&
        date in node
      ) {
        node[date] = {
          realActWorkHour: approvalItem.realActWorkHour,
          actWorkHour: approvalItem.actWorkHour,
          workDesc: approvalItem.workDesc,
          isRegFormOpen: false,
        };
      }
    });
  }

  node.dayUp = capacitySet?.dayUp;
  node.onceDown = capacitySet?.onceDown;

  if (type === "tab" && !hasCache) {
    // Return expanded keys to be set by caller
    node._shouldExpand = true;
  }

  if (node?.children?.length > 0) {
    node.children.forEach((child) => {
      child.workItemId = child.workItemId || node.workItemId;
      child.workItemEntityId = child.workItemEntityId || node.workItemEntityId;
      child.nodeId = child.nodeId || node.nodeId;
      traverseTreeRecursively(child, beginWorkDate, endWorkDate, options);
    });
  }

  if (node.taskId) node.children = null;
};

/** 遍历树节点（清除日期字段） */
export const traverseTreeClearDate = (node) => {
  const keys = Object.keys(node);
  keys.forEach(key => {
    if (dayjs(key, "YYYY-MM-DD", true).isValid()) {
      delete node[key];
    }
  });
  if (node?.children && node?.children?.length > 0) {
    node.children.forEach((child) => {
      traverseTreeClearDate(child);
    });
  }
};

/** 刷新树节点（关闭所有Popover） */
export const traverseTreeRefresh = (node, beginWorkDate, endWorkDate) => {
  const rangeDates = getDatesInRange(beginWorkDate, endWorkDate);
  rangeDates?.forEach((date) => {
    const key = date.date;
    if (node[key]) node[key].isRegFormOpen = false;
  });
  if (node?.children && node?.children?.length > 0) {
    node.children.forEach((child) => {
      traverseTreeRefresh(child, beginWorkDate, endWorkDate);
    });
  }
};

// ============ 工时计算 ============

/** 处理工时累加关系（向上汇总） */
export const handleWorkItemEntityNodeAndTask = (dateKey, data) => {
  const processTreeNode = (node) => {
    if (!node[dateKey]) {
      node[dateKey] = {};
    }
    const nodeRealHour = node[dateKey]?.realActWorkHour || 0;
    if (node.children && node.children.length > 0) {
      let childrenTotalHour = new Decimal(0);
      for (const child of node.children) {
        processTreeNode(child);
        childrenTotalHour = childrenTotalHour.plus(new Decimal(child[dateKey]?.actWorkHour || 0));
      }
      const totalHour = new Decimal(nodeRealHour).plus(childrenTotalHour);
      node[dateKey].actWorkHour = totalHour.isZero() ? null : totalHour.toDecimalPlaces(2).toNumber();
    } else {
      const totalHour = new Decimal(nodeRealHour);
      node[dateKey].actWorkHour = totalHour.isZero() ? null : totalHour.toDecimalPlaces(2).toNumber();
    }
    if (nodeRealHour) {
      node[dateKey].realActWorkHour = nodeRealHour;
    }
  };
  data?.forEach((entity) => {
    processTreeNode(entity);
  });
  return data;
};

/** 为工时设置标记（超限flag=1） */
export const setWorkHourFlags = (workInstanceDataSource, workDate, alertDetailOld) => {
  if (!workInstanceDataSource || !workInstanceDataSource.entities ||
    !Array.isArray(workInstanceDataSource.entities) ||
    !workInstanceDataSource.entities.length) {
    return;
  }
  if (!workDate) return;
  if (!alertDetailOld || Object.keys(alertDetailOld).length === 0) return;

  let workHour = new Decimal(0);
  workInstanceDataSource.entities.forEach((item) => {
    if (item[workDate]?.actWorkHour) {
      workHour = workHour.plus(item[workDate].actWorkHour);
    }
  });
  const totalHours = workHour.toNumber();
  const remainingWork = alertDetailOld.remainingWork || 0;

  const setFlagRecursively = (node, flagValue) => {
    if (node[workDate]) {
      node[workDate].flag = node[workDate].actWorkHour !== null ? flagValue : 0;
    }
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(child => {
        setFlagRecursively(child, flagValue);
      });
    }
  };
  //console.log('totalHours', totalHours,remainingWork);
  const flagValue = remainingWork < totalHours ? 1 : 0;
  workInstanceDataSource.entities.forEach((item) => {
    setFlagRecursively(item, flagValue);
  });
  return workInstanceDataSource;
};

/**
 * 计算个人工作饱和度（纯计算版本，返回结果对象）
 * @returns {{ alertDetail: Object, dayUpFlag: boolean } | null}
 */
export const computeAlertDetail = (workInstanceDataSource, workDate, alertDetailOld, capacitySet, currentAlertDetail, attendanceConfig) => {
  if (!workInstanceDataSource?.entities?.length || Object.keys(alertDetailOld).length === 0) {
    return null;
  }
  let workHour = new Decimal(0);
  workInstanceDataSource.entities.forEach((item) => {
    if (item[workDate]?.actWorkHour) {
      workHour = workHour.plus(item[workDate]?.actWorkHour);
    }
  });

  const setFlagForAllLevels = (node, flagValue) => {
    if (node[workDate]) {
      node[workDate].flag = node[workDate].actWorkHour !== null ? flagValue : 0;
    }
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(child => {
        setFlagForAllLevels(child, flagValue);
      });
    }
  };

  // 确定剩余工时基数（与单项登记逻辑一致）
  const _attEnabled = attendanceConfig?.enabled ?? 0;
  const _attHours = attendanceConfig?.hours;
  const _attPolicy = attendanceConfig?.policy ?? 1;
  const _attCustomLimit = attendanceConfig?.customLimit;
  const _dayUp = Number(capacitySet?.dayUp) || 24;
  const remainingBase = getAttendanceUpperLimit({
    enabled: _attEnabled,
    hours: _attHours,
    policy: _attPolicy,
    customLimit: _attCustomLimit,
    dayUp: _dayUp,
  });

  const flagValue = remainingBase - (alertDetailOld.registeredWorkingHours || 0) - (alertDetailOld.approvalingWork || 0) < workHour.toNumber() ? 1 : 0;
  const dayUpFlag = flagValue ? true : false;
  workInstanceDataSource.entities.forEach((item) => {
    setFlagForAllLevels(item, flagValue);
  });

  const alertDetail = { ...currentAlertDetail };
  alertDetail.submitHours = workHour.toNumber();
  alertDetail.registeredWorkingHours = new Decimal(alertDetailOld.registeredWorkingHours || 0).toNumber();
  alertDetail.remainingWork = new Decimal(remainingBase).minus(alertDetailOld.registeredWorkingHours || 0).toNumber();
  alertDetail.remainingWork = new Decimal(alertDetail.remainingWork).minus(alertDetail.approvalingWork || 0).toNumber();
  alertDetail.remainingWork = new Decimal(alertDetail.remainingWork).minus(alertDetail.submitHours || 0).toNumber();

  let mergeHours = new Decimal(alertDetail.registeredWorkingHours)
    .plus(alertDetail.approvalingWork || 0)
    .plus(alertDetail.submitHours || 0)
    .toNumber();
  alertDetail.saturation = (mergeHours / (capacitySet?.standWorkHour || 1)) * 100;
  alertDetail.saturation = Math.round(alertDetail.saturation * 100) / 100;

  return { alertDetail, dayUpFlag };
};

// ============ 清空/检查 ============

/** 清空所有工时数据并设置flag=0 */
export const clearAllWorkHours = (data) => {
  if (!data) return data;
  if (Array.isArray(data)) {
    return data.map(item => clearAllWorkHours(item));
  }
  if (typeof data === 'object' && data !== null) {
    const newData = { ...data };
    Object.keys(newData).forEach(key => {
      if (dayjs(key, 'YYYY-MM-DD', true).isValid() &&
        typeof newData[key] === 'object' &&
        newData[key] !== null) {
        newData[key] = {
          ...newData[key],
          realActWorkHour: null,
          actWorkHour: null,
          workDesc: null,
          flag: 0,
          isRegFormOpen: false
        };
      } else if (key === 'children' && Array.isArray(newData[key])) {
        newData[key] = clearAllWorkHours(newData[key]);
      }
    });
    return newData;
  }
  return data;
};

/** 检查日期是否在排期内 */
export const isDateInSchedule = (date, row) => {
  if (!row.scheduleStart || !row.scheduleEnd) return false;
  try {
    const dateObj = new Date(date);
    const startDate = new Date(row.scheduleStart);
    const endDate = new Date(row.scheduleEnd);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    dateObj.setHours(0, 0, 0, 0);
    return dateObj >= startDate && dateObj <= endDate;
  } catch (error) {
    return false;
  }
};

/** 检查是否有填报内容 */
export const checkWorkInstanceDataSourceHasContent = (workInstanceDataSource, beginWorkDate, endWorkDate) => {
  let isHasContent = false;
  if (workInstanceDataSource?.entities?.length) {
    const rangeDates = getDatesInRange(beginWorkDate, endWorkDate);
    for (const date of rangeDates) {
      for (const item of workInstanceDataSource.entities) {
        if (item[date.date]?.actWorkHour) {
          isHasContent = true;
          break;
        }
      }
      if (isHasContent) break;
    }
  }
  return isHasContent;
};

// ============ ID与字段工具 ============

/** 生成节点唯一ID */
export const generateId = (item) => {
  if (item.id) return item.id;
  if (item.taskId) {
    return `${item.workItemId || ''}-${item.workItemEntityId || ''}-${item.nodeId || ''}-${item.taskId}`;
  } else if (item.nodeId) {
    return `${item.workItemId || ''}-${item.workItemEntityId || ''}-${item.nodeId}-null`;
  } else if (item.workItemEntityId) {
    return `${item.workItemId || ''}-${item.workItemEntityId}-null-null`;
  }
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/** 为节点添加日期字段 */
export const addDateFields = (item, beginWorkDate, endWorkDate) => {
  const rangeDates = getDatesInRange(beginWorkDate, endWorkDate);
  rangeDates?.forEach(({ date }) => {
    if (!item[date]) {
      item[date] = {
        realActWorkHour: null,
        actWorkHour: null,
        workDesc: null,
        isRegFormOpen: false,
      };
    }
  });
};

/** 复制日期字段从源对象到目标对象 */
export const copyDateFields = (source, target) => {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  Object.keys(source).forEach(key => {
    if (datePattern.test(key) && source[key] && typeof source[key] === 'object') {
      target[key] = { ...source[key] };
    }
  });
  if (source.date) target.date = source.date;
  if (source.dayOfWeek) target.dayOfWeek = source.dayOfWeek;
  if (source.index !== undefined) target.index = source.index;
};

// ============ 展开层级 ============

/** 处理展开层级变更 */
export const handleExpandLevelChange = (level, list, expandCache, holdState, beginWorkDate, endWorkDate, expandLevel, setExpandedRowKeys) => {
  level = level ? level : expandLevel;
  let registerList = list || [];
  let targetIds = new Set();
  let beginWorkDateData = beginWorkDate;
  let endWorkDateData = endWorkDate;
  const rangeDates = getDatesInRange(beginWorkDateData, endWorkDateData);

  if (level == 1) {
    if (expandCache) {
      rangeDates?.forEach((date) => {
        registerList.forEach(item => {
          item?.children?.forEach(child => {
            if (child[date.date]?.actWorkHour) {
              targetIds.add(item.id);
            }
            child?.children?.forEach(grandchild => {
              if (grandchild[date.date]?.actWorkHour) {
                targetIds.add(child.id);
              }
            });
          });
        });
      });
    }
    const expandedRowKeysData = Array.from(targetIds);
    if (holdState) {
      setExpandedRowKeys(prev => [...new Set([...prev, ...expandedRowKeysData])]);
    } else {
      setExpandedRowKeys(expandedRowKeysData);
    }
  } else {
    if (level == 2) {
      registerList.forEach(i => { targetIds.add(i.id); });
    }
    if (level == 3 || level == -1) {
      registerList.forEach(i => {
        targetIds.add(i.id);
        i?.children?.forEach(j => { targetIds.add(j.id); });
      });
    }
    if (expandCache) {
      rangeDates?.forEach((date) => {
        registerList.forEach(item => {
          item?.children?.forEach(child => {
            if (child[date.date]?.actWorkHour) {
              targetIds.add(item.id);
            }
            child?.children?.forEach(grandchild => {
              if (grandchild[date.date]?.actWorkHour) {
                targetIds.add(child.id);
              }
            });
          });
        });
      });
    }
    const expandedRowKeysData = Array.from(targetIds);
    if (holdState) {
      setExpandedRowKeys(prev => [...new Set([...prev, ...expandedRowKeysData])]);
    } else {
      setExpandedRowKeys(expandedRowKeysData);
    }
  }
};

// ============ 树合并 ============

/** 检查并更新树结构（添加缺失的工作项/节点/任务） */
export const checkAndUpdateTree = (trea, objList) => {
  try {
    const treaEntityIds = trea.map(item => item.workItemEntityId);
    objList.forEach(objItem => {
      const targetEntityId = objItem.workItemEntityId;
      if (!treaEntityIds.includes(targetEntityId)) {
        let newWorklishi = {
          workItemId: objItem.workItemId,
          workItemName: objItem.workItemName,
          workItemEntityId: objItem.workItemEntityId,
          workItemEntityName: objItem.workItemEntityName.includes('[已删除]')
            ? objItem.workItemEntityName
            : `${objItem.workItemEntityName}[已删除]`,
          pattern: null,
          scheduleStart: null,
          scheduleEnd: null,
          estimatedWorkingHoursAll: 0.00,
          estimatedWorkingHoursSelf: 0.00,
          children: !objItem.nodeId && !objItem.taskId ? null : []
        };
        trea.push(newWorklishi);
      }
      if (objItem.tag && objItem.tag === 1) return;
      const treaNode = trea.find(item => item.workItemEntityId === targetEntityId);
      if (!treaNode || !treaNode.children) return;
      const existingNodeIds = treaNode.children.map(child => child.nodeId);
      const targetNodeId = objItem.nodeId;
      const targetTaskId = objItem.taskId;
      if (!existingNodeIds.includes(targetNodeId) && targetNodeId) {
        treaNode.children.push({
          nodeId: targetNodeId,
          nodeName: objItem.nodeName || targetNodeId,
          scheduleStart: null,
          scheduleEnd: null,
          estimatedWorkingHoursAll: null,
          estimatedWorkingHoursSelf: null,
          children: null
        });
        if (targetTaskId) {
          const treaNodeList = treaNode.children.find(item => item.nodeId === targetNodeId);
          if (!treaNodeList.children) { treaNodeList.children = []; }
          const existingTaskId = treaNodeList.children.map(child => child.taskId);
          if (!existingTaskId.includes(targetTaskId) && targetTaskId) {
            treaNodeList.children.push({
              taskId: targetTaskId,
              taskName: objItem.taskName || targetTaskId,
              scheduleStart: null,
              scheduleEnd: null,
              estimatedWorkingHoursAll: null,
              estimatedWorkingHoursSelf: null
            });
          }
        }
      } else {
        if (targetTaskId) {
          const treaNodeList = treaNode.children.find(item => item.nodeId === targetNodeId);
          if (!treaNodeList.children) { treaNodeList.children = []; }
          const existingTaskId = treaNodeList.children.map(child => child.taskId);
          if (!existingTaskId.includes(targetTaskId) && targetTaskId) {
            treaNodeList.children.push({
              taskId: targetTaskId,
              taskName: objItem.taskName || targetTaskId,
              scheduleStart: null,
              scheduleEnd: null,
              estimatedWorkingHoursAll: null,
              estimatedWorkingHoursSelf: null
            });
          }
        }
      }
    });
    return trea;
  } catch (error) {
    console.error("处理树结构时出错:", error);
    return trea;
  }
};

/** 合并工作项树（深度合并） */
export const mergeWorkItemTrees = (arr1, arr2, capacitySet, beginWorkDate, endWorkDate) => {
  const arr1WorkItemMap = new Map();

  const collectAllNodes = (items, map, isArr1 = true) => {
    if (!Array.isArray(items)) return;
    items.forEach(item => {
      if (item.workItemEntityId) {
        const key = `workItem_${item.workItemEntityId}`;
        if (isArr1) map.set(key, item);
      }
      if (item.children && Array.isArray(item.children)) {
        collectAllNodes(item.children, map, isArr1);
      }
    });
  };

  collectAllNodes(arr1, arr1WorkItemMap, true);
  const arr2AllNodes = [];
  collectAllNodes(arr2, new Map(), false);

  const deepMerge = (target, source) => {
    const result = { ...target };
    Object.keys(source).forEach(key => {
      if (key !== 'children' && key !== 'workItemEntityId' && key !== 'nodeId' && key !== 'taskId') {
        if (source[key] !== undefined && source[key] !== null) {
          if (!result[key] || result[key] === null) {
            result[key] = source[key];
          }
        }
      }
    });
    if (source.children && Array.isArray(source.children)) {
      if (!result.children) result.children = [];
      source.children.forEach(sourceChild => {
        let targetIndex = -1;
        if (sourceChild.taskId) {
          targetIndex = result.children.findIndex(child => child.taskId === sourceChild.taskId);
        } else if (sourceChild.nodeId) {
          targetIndex = result.children.findIndex(child => child.nodeId === sourceChild.nodeId);
        } else if (sourceChild.workItemEntityId) {
          targetIndex = result.children.findIndex(child => child.workItemEntityId === sourceChild.workItemEntityId);
        }
        if (targetIndex >= 0) {
          result.children[targetIndex] = deepMerge(result.children[targetIndex], sourceChild);
        } else {
          const newChild = convertToArr1Format(sourceChild, capacitySet, beginWorkDate, endWorkDate);
          if (result.workItemId && !newChild.workItemId) newChild.workItemId = result.workItemId;
          if (result.workItemEntityId && !newChild.workItemEntityId) newChild.workItemEntityId = result.workItemEntityId;
          if (result.nodeId && !newChild.nodeId) newChild.nodeId = result.nodeId;
          result.children.push(newChild);
        }
      });
    }
    return result;
  };

  arr2.forEach(item2 => {
    const workItemEntityId = item2.workItemEntityId;
    const existingItemIndex = arr1.findIndex(item => item.workItemEntityId === workItemEntityId);
    if (existingItemIndex >= 0) {
      arr1[existingItemIndex] = deepMerge(arr1[existingItemIndex], item2);
    } else {
      const newItem = convertToArr1Format(item2, capacitySet, beginWorkDate, endWorkDate);
      arr1.push(newItem);
    }
  });

  return arr1;
};

/** 转换为目标数组格式 */
export const convertToArr1Format = (item, capacitySet, beginWorkDate, endWorkDate) => {
  const newItem = {
    ...item,
    id: generateId(item),
    dayUp: capacitySet?.dayUp || 24,
    onceDown: capacitySet?.onceDown || 0.1,
    pattern: item.pattern || null,
    newPattern: item.newPattern || null,
    canRegister: item.canRegister !== undefined ? item.canRegister : true,
    canNotRegisterReason: item.canNotRegisterReason || null,
    status: item.status || null,
    workItemType: item.workItemType || 'workflow'
  };
  addDateFields(newItem, beginWorkDate, endWorkDate);
  if (!newItem.id) newItem.id = generateId(newItem);
  if (item.children && Array.isArray(item.children)) {
    newItem.children = item.children.map(child => {
      const convertedChild = convertToArr1Format({
        ...child,
        projectKey: child.projectKey || item.projectKey || newItem.projectKey,
        workItemId: child.workItemId || item.workItemId || newItem.workItemId,
        workItemEntityId: child.workItemEntityId || item.workItemEntityId || newItem.workItemEntityId,
        nodeId: child.nodeId || item.nodeId || newItem.nodeId
      }, capacitySet, beginWorkDate, endWorkDate);
      convertedChild.id = generateId(convertedChild);
      return convertedChild;
    });
    if (newItem.children.length === 0) newItem.children = [];
  } else {
    newItem.children = item.children;
  }
  return newItem;
};

// ============ 数据去重 ============

/** 对树数组进行去重（递归处理children） */
export const deduplicateTreeArray = (items) => {
  if (!Array.isArray(items)) return items;
  const processedItems = [];
  const uniqueKeys = new Set();
  const processItem = (item) => {
    if (!item || typeof item !== 'object') return item;
    const objectKey = item.id || Object.keys(item).sort().map(key => `${key}:${JSON.stringify(item[key])}`).join('|');
    if (uniqueKeys.has(objectKey)) return null;
    uniqueKeys.add(objectKey);
    const newItem = { ...item };
    if (Array.isArray(item.children)) {
      newItem.children = [];
      item.children.forEach(child => {
        const processedChild = processItem(child);
        if (processedChild) newItem.children.push(processedChild);
      });
      if (newItem.children.length === 0) newItem.children = [];
    }
    return newItem;
  };
  items.forEach(item => {
    const processedItem = processItem(item);
    if (processedItem) processedItems.push(processedItem);
  });
  return processedItems;
};

/** 数组按id去重 */
export const deduplicateById = (arr) => {
  if (!arr || !Array.isArray(arr)) return arr;
  return [...new Set(arr.map(item => item.id))].map(id => arr.find(item => item.id === id));
};

// ============ 空间选项过滤 ============

/**
 * 根据当前登记成员、应用模式与用户角色过滤空间选项
 * @param {Array} spaceOptions 原始空间选项列表
 * @param {Object} params
 * @param {string} params.registrantUserKey 当前登记工时的成员 userKey
 * @param {string} params.loginUserKey 当前登录用户 userKey（localStorage feishuUserInfo.userKey）
 * @param {string} params.appMode 应用模式（meegoTeamworkAppMode）：'space' | 'tenant'
 * @param {string} params.userRole 当前用户角色（meegoTeamworkUserRole）：'app_admin' | 'space_admin' | 'member'
 * @returns {Array} 过滤后的空间选项列表
 */
export const filterSpaceOptionsByRole = (spaceOptions, params = {}) => {
  if (!Array.isArray(spaceOptions)) return [];
  const { registrantUserKey, loginUserKey, appMode, userRole } = params;
  // 给自己登记工时：不做任何过滤，保留全部可选空间
  if (registrantUserKey && loginUserKey && registrantUserKey === loginUserKey) {
    return spaceOptions;
  }
  // 切换到其他成员登记工时
  const onlyFillInOnBehalf = () =>spaceOptions.filter(opt => opt?.isFillInOnBehalf === true);
  // 租户模式：app_admin 不过滤，space_admin 仅保留可代填的空间
  if (appMode === 'tenant') return spaceOptions;
  if (appMode === 'space') return onlyFillInOnBehalf();
  console.log('过滤空间数据', spaceOptions);
  return spaceOptions;
};
