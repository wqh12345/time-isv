import JSSDK from '../../jssdk-adapter';
import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  Alert, DatePicker, InputNumber, Table, Input, Space, Tooltip, Modal,
  message, Radio, Select, Popover, Form, Button, Spin, Cascader,
} from "antd";
import {
  InfoCircleFilled, CloseOutlined, ExclamationCircleFilled,
  PlusOutlined, SettingOutlined, DeleteOutlined,
} from "@ant-design/icons";
import {
  getWeekStartAndEnd, getLastWeekRange, getLastMonthRange,
  getFirstDayOfNaturalMonth, getLastDayOfNaturalMonth,
  getDatesInRange,
  buildAttendanceIndex,
  getAttendance,
} from '../../util/util';
import {
  getStandWorkHour, getUserRole, getProjectConfig,
  getWorkSaturationTips, postBatchInsertNodeWorkHourNew,
  postUserActive, getWorkItemOptionNew, postQueryBatch,
  postItemEntityOptionNew, postEntityNodeTaskSchedule,
  postEntityNodeTask, getDisplayLogic,
  getBatchRegTableSortConfig, postBatchRegTableSortConfig,
  postBatchApprovalAgain, getWorkItemOptionForRegister,
  // saveRegisterCache, getRegisterCache, clearRegisterCache,  // [注释] 缓存功能
  getRegistrationSettings,
  getRegistrationSettingsByProjectKeys,
  getBatchStandWorkHourUser,
  // queryExpandLevelNode,  // [注释] 展开层级功能
  queryWorkHoursTotalDetail, getUserStandWorkHour,
  getProjectList,
  getLevelItemEntityOption,
  postBatchRegisterGetItemEntityOption,
  getRegisterProjectKeyOption,
  getBatchRegisterWorkItemOption,
  getBatchRegisterItemEntityOption,
  getBatchRegisterDate,
  getBatchRegisterMemory,
  getBatchMemorySetting,
  postBatchRegisterSaveData,
  getBatchRegisterSaturationPersonBatch,
  getBatchWorkSaturationTips,
  postBatchAddGetItemEntityOptionForBatch,
  postBatchGetEntityNodeOption,
  getBatchRegisterProjectKeyAndWorkItemTypeInfo,
  getAttendanceConfig,
  getUserAttendanceConfig,
} from '../../api/api';
import "./RegWorkHourBatchNew.less";
import dayjs from "dayjs";
import SmartSelect, { buildEntityValue } from "./SmartSelect";
import SmartSelect2 from "./SmartSelect2";
import TableColumnsSet from "./TableColumnsSet";
import LevelSet from "./levelSet";
import customParseFormat from "dayjs/plugin/customParseFormat";
import UserPicker from "../user-picker/UserPicker";
import Decimal from "decimal.js";
import RegisterWorkItemTable from "./RegisterWorkItemTable";
dayjs.extend(customParseFormat);
import debounce from "lodash/debounce";
import taskIcon from '../../assets/images/task.png';
import nodeIcon from '../../assets/images/node.png';
import workItemEntityIcon from '../../assets/images/workItemEntity.png';
import zhankai from '../../assets/images/zhankai.png';
import VirtualTableBody from "./VirtualTableBody";
import RegWorkHourHeader from "./components/RegWorkHourHeader";
import DateColumnPopover from "./components/DateColumnPopover";
// import ExpandLevelPopover from "./components/ExpandLevelPopover";  // [注释] 展开层级功能
import AddWorkItemModal from "./components/AddWorkItemModal";
import TableSummaryFooter from "./components/TableSummaryFooter";
import { useTenantCustomFieldConfig } from "../../hooks/useTenantCustomFieldConfig";
import {
  rangePresets, transformWorkHourData, findMatchingItems,
  aggregateWorkHours, restoreOriginalStructure,
  traverseTreeRecursively, traverseTreeClearDate, traverseTreeRefresh,
  handleWorkItemEntityNodeAndTask, setWorkHourFlags, computeAlertDetail,
  clearAllWorkHours, isDateInSchedule, checkWorkInstanceDataSourceHasContent,
  generateId, addDateFields, copyDateFields,
  mergeWorkItemTrees, convertToArr1Format, checkAndUpdateTree,
  // handleExpandLevelChange,  // [注释] 展开层级功能
  deduplicateTreeArray, deduplicateById,
  filterSpaceOptionsByRole,
  normalizeAttendanceNumber, getAttendanceUpperLimit,
} from "./utils";
import { set } from 'lodash';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

const CustomFieldValueCell = ({ value }) => {
  const valueRef = useRef(null);
  const [isOverflowed, setIsOverflowed] = useState(false);
  const isEmpty = value === null
    || value === undefined
    || (typeof value === "string" && value.trim() === "");
  const displayValue = isEmpty ? "--" : String(value);

  const updateOverflow = useCallback(() => {
    const element = valueRef.current;
    setIsOverflowed(Boolean(element && element.scrollWidth > element.clientWidth));
  }, []);

  useEffect(() => {
    updateOverflow();
    const element = valueRef.current;
    if (!element || typeof ResizeObserver === "undefined") return undefined;

    const observer = new ResizeObserver(updateOverflow);
    observer.observe(element);
    return () => observer.disconnect();
  }, [displayValue, updateOverflow]);

  return (
    <Tooltip placement="topLeft" title={!isEmpty && isOverflowed ? displayValue : null}>
      <div
        ref={valueRef}
        className="custom-field-column-value"
        onMouseEnter={updateOverflow}
      >
        {displayValue}
      </div>
    </Tooltip>
  );
};

const isValidMemoryDate = value => (
  typeof value === 'string' && dayjs(value, 'YYYY-MM-DD', true).isValid()
);

const hasRestorableBatchMemory = memory => {
  if (!memory || typeof memory !== 'object' || Array.isArray(memory)) return false;
  return Boolean(
    memory.registerUserKey
    || isValidMemoryDate(memory.scheduleStart)
    || isValidMemoryDate(memory.scheduleEnd)
    || isValidMemoryDate(memory.beginWorkDate)
    || isValidMemoryDate(memory.endWorkDate)
    || memory.isPersonInCharge === 0
    || memory.isPersonInCharge === 1
    || (Array.isArray(memory.queryRegistrationReq) && memory.queryRegistrationReq.length > 0)
  );
};

const getRestorableSpaceKeys = (queries, availableSpaces, isSpaceMode) => {
  const availableSpaceMap = new Map(
    availableSpaces.map(option => [String(option.value), option.value])
  );
  const spaceKeys = [...new Set(
    queries
      .map(item => availableSpaceMap.get(String(item?.projectKey)))
      .filter(value => value !== undefined && value !== null && value !== '')
  )];
  return isSpaceMode ? spaceKeys.slice(0, 1) : spaceKeys.slice(0, 3);
};

const buildRestoredWorkItemSelections = (queries, spaceKeys, workItemOptions) => {
  const selectedSpaceMap = new Map(spaceKeys.map(value => [String(value), value]));
  const availableWorkItemSet = new Set(workItemOptions.map(item => String(item.value)));
  const selectedWorkItemSet = new Set();
  const selectedEntitySet = new Set();
  const workItemIds = [];
  const workItemIdsFilter = [];
  const workItemEntityIds = [];

  queries.forEach(query => {
    const projectKey = selectedSpaceMap.get(String(query?.projectKey));
    if (projectKey === undefined) return;

    (Array.isArray(query.workItemIds) ? query.workItemIds : []).forEach(item => {
      if (!item?.workItemId) return;
      const rawWorkItemId = String(item.workItemId);
      const workItemValue = rawWorkItemId.startsWith(`${projectKey}-`)
        ? rawWorkItemId
        : `${projectKey}-${rawWorkItemId}`;
      if (!availableWorkItemSet.has(workItemValue) || selectedWorkItemSet.has(workItemValue)) return;
      selectedWorkItemSet.add(workItemValue);
      workItemIds.push(workItemValue);
    });

    (Array.isArray(query.workItemIdsFilter) ? query.workItemIdsFilter : []).forEach(item => {
      if (!item?.workItemId || item?.workItemEntityId === undefined || item?.workItemEntityId === null) return;
      const rawWorkItemId = String(item.workItemId);
      const workItemValue = rawWorkItemId.startsWith(`${projectKey}-`)
        ? rawWorkItemId
        : `${projectKey}-${rawWorkItemId}`;
      if (!selectedWorkItemSet.has(workItemValue)) return;

      const rawEntityId = String(item.workItemEntityId);
      const entityValue = rawEntityId.startsWith(`${workItemValue}-`)
        ? rawEntityId
        : `${workItemValue}-${rawEntityId}`;
      if (selectedEntitySet.has(entityValue)) return;
      selectedEntitySet.add(entityValue);
      workItemIdsFilter.push({
        workItemId: workItemValue,
        workItemEntityId: entityValue,
        workItemEntityName: item.workItemEntityName,
        customFieldValue: item.customFieldValue,
      });
      workItemEntityIds.push(buildEntityValue({
        workItemId: workItemValue,
        label: item.workItemEntityName,
        value: entityValue,
        customFieldValue: item.customFieldValue,
      }));
    });
  });

  return { workItemIds, workItemIdsFilter, workItemEntityIds };
};

// ==================== 主组件 ====================
const RegWorkHourBatchNew = (props) => {
  // ---------- Form 实例 ----------
  const [regBatchForm] = Form.useForm();
  const [addWorkItemForm] = Form.useForm();
  const { isEnabled: isCustomFieldEnabled } = useTenantCustomFieldConfig();
  // ---------- Refs ----------
  const workHourInputNumRef = useRef(null);
  const tableRef = useRef(null);
  const summaryRef = useRef(null);
  const filterRegistrationRef = useRef([]);
  const workDescReq = useRef(0);
  const lastRequestIdRef = useRef(null);
  const capacityRequestIdRef = useRef(null);
  const attendanceRequestIdRef = useRef(0);
  const saturationRequestIdRef = useRef(0);
  const workHoursTotalRequestIdRef = useRef(0);
  const attendanceIndexRef = useRef({ dataMap: new Map(), configMap: new Map() });
  const attendanceContextRef = useRef(null);
  const attendanceContextKeyRef = useRef(null);
  const attendanceStatusConfigRef = useRef(null);
  const attendanceStatusConfigKeyRef = useRef(null);
  const attendanceSyncLoadingRef = useRef(false);
  const isMountedRef = useRef(true);
  const filterMemoryRequestRef = useRef(null);
  const lastOptionsRequestIdRef = useRef(null);
  // 记录每个空间的 hasMore 状态（key 为 projectKey）
  const spaceHasMoreRef = useRef({});
  const workItemEntityIdsRef = useRef([]);
  const workInstanceDataSourceRef = useRef(null);
  const tableAddDataSourceRef = useRef(null);
  const tableDataSourceRef = useRef(null);
  const editDataRef = useRef(null);
  const tableScrollPositionRef = useRef(0);
  // const cacheWorkInstanceDataSourceRef = useRef([]);  // [注释] 缓存功能
  const workItemListRef = useRef(null);
  // const hasCacheRef = useRef(false);  // [注释] 缓存功能
  const capacitySetRef = useRef({});
  const callCountRef = useRef(1);
  const againNum = useRef(1);
  const addExtraRef = useRef([]);
  const manualSelection = useRef(false);
  const dayUpFlag = useRef(false);
  const localHourCache = useRef([]);  // [注释] 缓存功能
  // const excludeWorkItemEntityIdListCacheRef = useRef([]);  // [注释] 缓存功能
  const beforeAddWorkItemIdsRef = useRef([]);
  const beforeWorkItemIdsFilterRef = useRef([]);
  const modalLockRef = useRef(false);
  const updateEditDataRef = useRef([]);
  const againLaunchInitializedRef = useRef(false);
  const againLaunchInitializingRef = useRef(false);
  const againLaunchEmptyFilterRef = useRef({ pending: false, signature: null });
  const batchMemoryRestoringRef = useRef(props?.openType !== "again_launch");
  const batchMemoryQueryRef = useRef({ pending: false, shouldQuery: false });

  // ---------- 日期状态 ----------
  const [beginWorkDate, setBeginWorkDate] = useState(getWeekStartAndEnd().Monday);
  const [endWorkDate, setEndWorkDate] = useState(getWeekStartAndEnd().Sunday);
  const [beginWorkDateCP, setBeginWorkDateCP] = useState(getWeekStartAndEnd().Monday);
  const [endWorkDateCP, setEndWorkDateCP] = useState(getWeekStartAndEnd().Sunday);
  // 工作日期快捷类型：0-自定义，1-今天，2-本周，3-上周，4-上个月（默认本周）
  const [workDateType, setWorkDateType] = useState(2);
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleEnd, setScheduleEnd] = useState("");
  const [minWorkDate, setMinWorkDate] = useState(null);
  const [maxWorkDate, setMaxWorkDate] = useState(null);
  const [workDate, setWorkDate] = useState("");

  useEffect(() => {
    if (
      !props.onFilterMemoryLoaded &&
      !props.onFilterMemoryConfigLoaded
    ) return undefined;

    let isActive = true;
    const configType = props.type === "tab"
      ? "TAB_REGISTER_FILTER_MEMORY"
      : "BATCH_REGISTER_FILTER_MEMORY";
    const buildDefaultMemoryConfig = () => ({ type: configType, value: 0 });

    if (!filterMemoryRequestRef.current) {
      filterMemoryRequestRef.current = getBatchMemorySetting({ type: configType })
        .then((res) => (res?.result && res?.data ? res.data : buildDefaultMemoryConfig()))
        .catch(() => buildDefaultMemoryConfig());
    }

    filterMemoryRequestRef.current.then((config) => {
      if (!isActive) return;
      props.onFilterMemoryLoaded?.(config?.value === 1);
      props.onFilterMemoryConfigLoaded?.(config);
    });

    return () => {
      isActive = false;
    };
  }, [props.onFilterMemoryLoaded, props.onFilterMemoryConfigLoaded]);

  // ---------- 工作项状态 ----------
  const [point, setPoint] = useState(props.type === 'tab' ? props?.workItemEntityId : '');
  const [workItemIds, setWorkItemIds] = useState([]);
  const [workItemEntityId, setWorkItemEntityId] = useState("");
  const [workItemIdsFilter, setWorkItemIdsFilter] = useState([]);
  // 保存最新的工作项及过滤条件，供 getSelectWorkInstanceTable 同步读取，避免闭包拿到旧值
  const workItemIdsRef = useRef([]);
  const workItemIdsFilterRef = useRef([]);
  const [workItemEntityIds, setWorkItemEntityIds] = useState([]);
  const [searchWorkItemIds, setSearchWorkItemIds] = useState([]);
  const [searchWorkItemEntityIds, setSearchWorkItemEntityIds] = useState([]);
  const [previousWorkItemIds, setPreviousWorkItemIds] = useState([]);
  const [previousWorkItemEntityIds, setPreviousWorkItemEntityIds] = useState([]);
  const [previousWorkItemIdsFilter, setPreviousWorkItemIdsFilter] = useState([]);

  // 同步最新的工作项及过滤条件到 ref，保证 getSelectWorkInstanceTable 读取到实时值
  useEffect(() => { workItemIdsRef.current = workItemIds; }, [workItemIds]);
  useEffect(() => { workItemIdsFilterRef.current = workItemIdsFilter; }, [workItemIdsFilter]);

  // ---------- 表格状态 ----------
  const [tableDataSource, setTableDataSource] = useState([]);
  const [tableAddDataSource, setTableAddDataSource] = useState([]);
  const [workInstanceDataSource, setWorkInstanceDataSource] = useState({});
  const [workInstancePagination, setWorkInstancePagination] = useState({ pageNum: 1, pageSize: 10 });
  // const [expandedRowKeys, setExpandedRowKeys] = useState([]);  // [注释] 展开层级功能
  const [hasMore, setHasMore] = useState(false);
  // const [cacheWorkInstanceDataSource, setCacheWorkInstanceDataSource] = useState([]);  // [注释] 缓存功能
  // const [excludeWorkItemEntityIdListCache, setExcludeWorkItemEntityIdListCache] = useState([]);  // [注释] 缓存功能

  // ---------- UI 状态 ----------
  const [loading, setLoading] = useState(false);
  // const [registerCacheLoading, setRegisterCacheLoading] = useState(true);  // [注释] 缓存功能
  const [tableLoading, setTableLoading] = useState(false);
  const [tableLoading2, setTableLoading2] = useState(false);
  const [filterMemoryLoading, setFilterMemoryLoading] = useState(false);
  const [attendanceSyncLoading, setAttendanceSyncLoading] = useState(false);
  const [saveHourLoadings, setSaveHourLoadings] = useState(false);
  const [isAddWorkItemLoading, setIsAddWorkItemLoading] = useState(false);
  const [isAddWorkItemOpen, setIsAddWorkItemOpen] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [invoke, setInvoke] = useState(false);
  const spaceMap = useRef(new Map());
  const projectKeysRef = useRef('');
  // const [expandPopoverVisible, setExpandPopoverVisible] = useState(false);  // [注释] 展开层级功能
  // const [expandOptions] = useState([  // [注释] 展开层级功能
  //   { levelName: "展开至第一级", level: 1 },
  //   { levelName: "展开至第二级", level: 2 },
  //   { levelName: "展开至第三级", level: 3 },
  // ]);

  // ---------- 权限/配置状态 ----------
  const getLocalUser = () => {
    try {
      const raw = localStorage.getItem('feishuUserInfo');
      if (!raw) return '';
      const info = JSON.parse(raw);
      return info
    } catch (_) {
    }
  };
  const  loginUser=getLocalUser()
  const [registrantUserKey, setRegistrantUserKey] = useState(loginUser?.userKey || '');
  // 用于强制 UserPicker 重新挂载以还原内部选中态（取消弹窗时使用）
  const [userPickerKey, setUserPickerKey] = useState(0);
  const unionId = useRef('');
  const [pickerUser, setPickerUser] = useState({
    userKey: loginUser?.userKey || '',
    nameCn: loginUser?.nameCn,
    avatarUrl: loginUser?.avatarUrl,
  });
  useEffect(() => {
   unionId.current = pickerUser.unionId
   if (!batchMemoryRestoringRef.current) getUserStandWorkHourData()
  }, [pickerUser]);

  const [isPersonInCharge, setIsPersonInCharge] = useState(0);
  const [isAllowRegister, setIsAllowRegister] = useState(false);
  const [showAllResponsibleOptions, setShowAllResponsibleOptions] = useState(0);
  const [showResponsibleFilter, setShowResponsibleFilter] = useState(true);

  // ---------- 数据状态 ----------
  const [workItemOptions, setWorkItemOptions] = useState([]);
  const [workItemOptionsLoading, setWorkItemOptionsLoading] = useState(false);
  const [regDisplayLogic, setRegDisplayLogic] = useState({});
  const [regTableColumns, setRegTableColumns] = useState([]);
  const [alertDetail, setAlertDetail] = useState({});
  const [alertDetailOld, setAlertDetailOld] = useState({});
  const [curRecord, setCurRecord] = useState({});
  const [nodeTaskOptions, setNodeTaskOptions] = useState([]);
  const [capacitySet, setCapacitySet] = useState({});
  const [editData, setEditData] = useState([]);
  const [updateEditData, setUpdateEditData] = useState([]);
  const [workHoursTotalDetail, setWorkHoursTotalDetail] = useState({});
  // const [expandLevel, setExpandLevel] = useState(props.type === 'tab' ? -1 : 1);  // [注释] 展开层级功能
  const [hasCache, setHasCache] = useState(false);  // [注释] 缓存功能
  const [num, setNum] = useState(0);
  const [isWorkItemChanged, setIsWorkItemChanged] = useState(false);
  const [isOnDeselect, setIsOnDeselect] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const isTenantMode = localStorage.getItem("meegoTeamworkAppMode") === "tenant";

  // ---------- 考勤配置状态 ----------
  const [attendanceEnabled, setAttendanceEnabled] = useState(0);
  const [upperLimitSource, setUpperLimitSource] = useState(1);
  const [missPunchPolicy, setMissPunchPolicy] = useState(0);
  const [missPunchCustomLimit, setMissPunchCustomLimit] = useState(null);
  const [attendanceHours, setAttendanceHours] = useState(null);
  const [attendanceSnapshotMap, setAttendanceSnapshotMap] = useState({});
  const attendanceConfigRef = useRef({
    enabled: 0,
    hours: null,
    syncHours: null,
    policy: 1,
    customLimit: null,
  });
  const attendanceSyncHoursRef = useRef(null);
  // 保存接口返回的"饱和度/剩余工时"原始快照（date/user 维度），供 validator 使用
  const capacitySnapshotRef = useRef(null);

  const baseColumns = [
    { label: "登记对象", value: "workItemEntityName", checked: true, disable: true },
    { label: "成员排期", value: "scheduleDate", checked: true, disable: false },
    { label: "预估工时", value: "estimatedScore", checked: true, disable: false },
    { label: "合计", value: "total", checked: true, disable: false },
    { label: "填报工作日期", value: "regDate", checked: true, disable: true },
  ];
  const [columnsSet, setColumnsSet] = useState(
    isTenantMode
      ? [
          { label: "登记对象", value: "workItemEntityName", checked: true, disable: true },
          { label: "所属空间", value: "projectName", checked: true, disable: false },
          ...baseColumns.slice(1),
        ]
      : baseColumns
  );

  // ---------- 空间选择状态 ----------
  const [selectedSpaceKeys, setSelectedSpaceKeys] = useState([]);
  const [spaceOptions, setSpaceOptions] = useState([]);
  const [spaceLoading, setSpaceLoading] = useState(false);
  const projectKeyWorkItemMapRef = useRef({});
  const [projectRegSettings, setProjectRegSettings] = useState({});  // 批量登记-空间配置（租户模式）

  // 根据当前登记成员、应用模式与用户角色过滤空间选项
  const filteredSpaceOptions = useMemo(() => {
    return filterSpaceOptionsByRole(spaceOptions, {
      registrantUserKey,
      loginUserKey: loginUser?.userKey || '',
      appMode: localStorage.getItem('meegoTeamworkAppMode') || '',
      userRole: localStorage.getItem('meegoTeamworkUserRole') || '',
    });
  }, [spaceOptions, registrantUserKey, loginUser?.userKey]);

  // ---------- 公共状态重置 ----------
  const resetTableStates = () => {
    // setExpandedRowKeys([]);  // [注释] 展开层级功能
    // setExcludeWorkItemEntityIdListCache([]);  // [注释] 缓存功能
    // excludeWorkItemEntityIdListCacheRef.current = [];  // [注释] 缓存功能
    // cacheWorkInstanceDataSourceRef.current = [];  // [注释] 缓存功能
  };

  const resetAllStates = () => {
    resetTableStates();
    localHourCache.current = [];  // [注释] 缓存功能
    addExtraRef.current = [];
    filterRegistrationRef.current = [];
    // setCacheWorkInstanceDataSource([]);  // [注释] 缓存功能
    setEditData([]);
    setTableDataSource([]);
    setWorkInstanceDataSource({});
  };
/**
 * 从原始数据中提取所有存在实际工时（realActWorkHour）的记录，按层级展平
 * @param {Array} data - 原始数据数组
 * @returns {Array} 展平后的工时记录数组
 */
const extractAllWorkHours = (data) => {
    const result = [];

    // 判断是否为日期键（格式：YYYY-MM-DD）
    const isDateKey = (key) => /^\d{4}-\d{2}-\d{2}$/.test(key);

    data.forEach(workItem => {
        // 1. 工作项自身的工时记录
        const workItemDateKeys = Object.keys(workItem).filter(isDateKey);
        workItemDateKeys.forEach(dateKey => {
            const dayData = workItem[dateKey];
            if (dayData && dayData.realActWorkHour != null) {
                result.push({
                    projectKey: workItem.projectKey,
                    workItemId: workItem.workItemId,
                    workItemEntityId: workItem.workItemEntityId,
                    workItemName: workItem.workItemName,
                    workItemEntityName: workItem.workItemEntityName,
                    realActWorkHour: dayData.realActWorkHour,
                    actWorkHour: dayData.actWorkHour,
                    workDate: dateKey,
                    workDesc: dayData.workDesc || '',
                    nodeId: null,
                    taskId: null,
                    type: 'workitem'
                });
            }
        });

        // 2. 遍历子节点（children）
        if (workItem.children && workItem.children.length) {
            workItem.children.forEach(node => {
                // 节点自身的工时记录
                const nodeDateKeys = Object.keys(node).filter(isDateKey);
                nodeDateKeys.forEach(dateKey => {
                    const dayData = node[dateKey];
                    if (dayData && dayData.realActWorkHour != null) {
                        result.push({
                            projectKey: workItem.projectKey,
                            workItemId: node.workItemId || workItem.workItemId,
                            workItemEntityId: node.workItemEntityId || workItem.workItemEntityId,
                            workItemName: workItem.workItemName,
                            workItemEntityName: workItem.workItemEntityName,
                            nodeId: node.nodeId,
                            nodeName: node.nodeName,
                            realActWorkHour: dayData.realActWorkHour,
                            actWorkHour: dayData.actWorkHour,
                            workDate: dateKey,
                            workDesc: dayData.workDesc || '',
                            taskId: null,
                            type: 'node'
                        });
                    }
                });

                // 3. 遍历节点下的任务（children 中的任务）
                if (node.children && node.children.length) {
                    node.children.forEach(task => {
                        const taskDateKeys = Object.keys(task).filter(isDateKey);
                        taskDateKeys.forEach(dateKey => {
                            const dayData = task[dateKey];
                            if (dayData && dayData.realActWorkHour != null) {
                                result.push({
                                    projectKey: workItem.projectKey,
                                    workItemId: task.workItemId || workItem.workItemId,
                                    workItemEntityId: task.workItemEntityId || workItem.workItemEntityId,
                                    workItemName: workItem.workItemName,
                                    workItemEntityName: workItem.workItemEntityName,
                                    nodeId: task.nodeId || node.nodeId,
                                    nodeName: node.nodeName,
                                    taskId: task.taskId,
                                    taskName: task.taskName,
                                    realActWorkHour: dayData.realActWorkHour,
                                    actWorkHour: dayData.actWorkHour,
                                    workDate: dateKey,
                                    workDesc: dayData.workDesc || '',
                                    type: 'task'
                                });
                            }
                        });
                    });
                }
            });
        }
    });
    return result;
}

  // ---------- 树遍历辅助 (需要状态) ----------
  const traverseTree = (node, beginWorkDateInfo, endWorkDateInfo) => {
    traverseTreeRecursively(node, beginWorkDateInfo || beginWorkDate, endWorkDateInfo || endWorkDate, {
      openType: props?.openType,
      // hasCache: hasCacheRef.current,  // [注释] 缓存功能
      hasCache: false,
      localHourCache: localHourCache.current,  // [注释] 缓存功能
      //localHourCache: [],
      editData: editDataRef.current,
      capacitySet: capacitySetRef.current,
      type: props.type,
      aggregateWorkHoursFn: aggregateWorkHours,
    });
    // [注释] 展开层级功能 - 收集需要展开的key
    // if (props.type === "tab" && !hasCacheRef.current && node._shouldExpand) {
    //   delete node._shouldExpand;
    //   return node.id;
    // }
    delete node._shouldExpand;
    return null;
  };

  const traverseTreeBatch = (nodes, beginWorkDateInfo, endWorkDateInfo) => {
    // const expandKeys = [];  // [注释] 展开层级功能
    const processNode = (node) => {
      traverseTreeRecursively(node, beginWorkDateInfo || beginWorkDate, endWorkDateInfo || endWorkDate, {
        openType: props?.openType,
        // hasCache: hasCacheRef.current,  // [注释] 缓存功能
        hasCache: false,
        localHourCache: localHourCache.current,  // [注释] 缓存功能
        //localHourCache: [],
        editData: editDataRef.current,
        capacitySet: capacitySetRef.current,
        type: props.type,
        aggregateWorkHoursFn: aggregateWorkHours,
      });
      // [注释] 展开层级功能
      // if (props.type === "tab" && !hasCacheRef.current && node._shouldExpand) {
      //   expandKeys.push(node.id);
      // }
      delete node._shouldExpand;
    };
    nodes.forEach(processNode);
    // [注释] 展开层级功能
    // if (expandKeys.length > 0) {
    //   setExpandedRowKeys(prev => [...new Set([...prev, ...expandKeys])]);
    // }
  };

  // ---------- 展开层级处理 ---------- [注释] 展开层级功能
  // const doExpandLevelChange = (level, list, expandCache, holdState, beginWorkDateInfo, endWorkDateInfo) => {
  //   handleExpandLevelChange(
  //     level, list, expandCache, holdState,
  //     beginWorkDateInfo || beginWorkDate, endWorkDateInfo || endWorkDate,
  //     expandLevel, setExpandedRowKeys
  //   );
  // };

  // ---------- 计算工作饱和度 ----------
  const countAlertDetail = () => {
    const currentDate = workDate || beginWorkDate;
    const currentAttendance = getAttendanceSnapshot(currentDate) || attendanceConfigRef.current;
    const result = computeAlertDetail(workInstanceDataSource, currentDate, alertDetailOld, capacitySet, alertDetail, {
      ...currentAttendance,
      enabled: currentAttendance.attendanceEnabled ?? currentAttendance.enabled,
      hours: currentAttendance.attendanceHours ?? currentAttendance.hours,
      policy: currentAttendance.missPunchPolicy ?? currentAttendance.policy,
      customLimit: currentAttendance.missPunchCustomLimit ?? currentAttendance.customLimit,
    });
    if (result) {
      //console.log('result888888',result)
      dayUpFlag.current = result.dayUpFlag;
      setAlertDetail({ ...result.alertDetail });
    }
  };

  // ================================================================
  // API 调用
  // ================================================================

  /** 查询区间日期的登记工时情况 */
  const queryWorkHoursTotalDetailData = async (beginDate, endDate) => {
    if (!beginDate || !endDate || !registrantUserKey) return;
    const requestId = ++workHoursTotalRequestIdRef.current;
    const requestUserKey = registrantUserKey;
    const requestSpaceKey = selectedSpaceKeys?.[0] || null;
    try {
      const rangeDates = getDatesInRange(beginDate, endDate);
      const params = { workDateStart: rangeDates[0]?.date, workDateEnd: rangeDates[rangeDates.length - 1]?.date, registrantUserKey };
      // 空间模式下传递当前选中的空间 projectKey；租户模式或未选中空间时不传
      if (localStorage.getItem("meegoTeamworkAppMode") === "space" && selectedSpaceKeys?.length > 0) {
        params.projectKey = selectedSpaceKeys[0];
      }
      const res = await getBatchRegisterSaturationPersonBatch(params);

      if (res?.result && res?.data && requestId === workHoursTotalRequestIdRef.current
        && requestUserKey === registrantUserKey
        && requestSpaceKey === (selectedSpaceKeys?.[0] || null)
        && beginDate === beginWorkDate && endDate === endWorkDate) {
        setWorkHoursTotalDetail({ ...res?.data || {} });
      }
    } catch (error) {
      console.error('查询工时详情失败:', error);
    }
  };

  /** 校验指定成员在当前日期范围内是否存在已登记工时 */
  const checkUserHasRegisteredWorkHour = async (userKey) => {
    if (!userKey || !beginWorkDate || !endWorkDate) return false;
    try {
      const rangeDates = getDatesInRange(beginWorkDate, endWorkDate);
      const params = { workDateStart: rangeDates[0]?.date, workDateEnd: rangeDates[rangeDates.length - 1]?.date, registrantUserKey: userKey };
      // 空间模式下传递当前选中的空间 projectKey；租户模式或未选中空间时不传
      if (localStorage.getItem("meegoTeamworkAppMode") === "space" && selectedSpaceKeys?.length > 0) {
        params.projectKey = selectedSpaceKeys[0];
      }
      const res = await getBatchRegisterSaturationPersonBatch(params);
      if (res?.result && res?.data) {
        return Object.values(res.data).some(
          (detail) => Number(detail?.registeredWorkingHours) > 0
        );
      }
    } catch (error) {
      console.error('查询成员已登记工时失败:', error);
    }
    return false;
  };
  /** 批量登记-获取空间配置（租户模式） */
  const fetchRegistrationSettingsByProjectKeys = async (keys) => {
    try {
      const res = await getRegistrationSettingsByProjectKeys();
      if (res?.result && Array.isArray(res.data)) {
        const map = {};
        res.data.forEach(item => {
          if (item.projectKey) map[item.projectKey] = item;
        });
        // console.log('map', map);
        setProjectRegSettings(map);
      }
    } catch (e) {
      console.error('fetchRegistrationSettingsByProjectKeys error:', e);
    }
  };

  /** 负责人筛选变更处理（带二次确认） */
  const onResponsibleFilterChange = async (e) => {
    const newValue = e.target.value;
    //if (newValue === isPersonInCharge) return;
    const isHasContent = checkWorkInstanceDataSource();
    if (isHasContent) {
      //if (document.querySelector('.ant-modal-confirm')) return;
      modalLockRef.current = true;
      setIsModalVisible(true);
      Modal.confirm({
        title: "确认修改",
        icon: <ExclamationCircleFilled />,
        content: "修改后，之前填写的工时及工作描述会保留到匹配到的登记对象中；若刷新后没有对应的登记对象，相关数据将被删除。",
        closeIcon: <CloseOutlined />,
        okText: "确定",
        cancelText: "取消",
        async onOk() {
          const retainedWorkHours = extractAllWorkHours(workInstanceDataSourceRef.current?.entities || []);
          localHourCache.current = retainedWorkHours;
          editDataRef.current = retainedWorkHours;
          setEditData(retainedWorkHours);
          modalLockRef.current = false;
          setIsModalVisible(false);
          setIsPersonInCharge(newValue);
          // 刷新登记对象表格 - 由 useEffect 监听 isPersonInCharge 和 invoke 变化后统一调用
          setTableDataSource([]);
          setWorkInstanceDataSource({});
          setInvoke(true);
          if (workInstancePagination.pageNum !== 1) {
            setWorkInstancePagination(prev => ({ ...prev, pageNum: 1 }));
          }
        },
        onCancel() {
          modalLockRef.current = false;
          setIsModalVisible(false);
        },
        afterClose: () => {
          modalLockRef.current = false;
          setIsModalVisible(false);
        },
      });
    } else {
      setIsPersonInCharge(newValue);
      // 刷新登记对象表格 - 由 useEffect 监听 isPersonInCharge 和 invoke 变化后统一调用
      setTableDataSource([]);
      setWorkInstanceDataSource({});
      setInvoke(true);
      if (workInstancePagination.pageNum !== 1) {
        setWorkInstancePagination(prev => ({ ...prev, pageNum: 1 }));
      }
    }
  };
  /** 查询登记设置 */
  const getCapacity = async (projectKeyOverride) => {
    try {
      const projectKey = projectKeyOverride || sessionStorage.getItem('adminCurrentProjectKey') || '';
      const res = await getRegistrationSettings({ projectKey });
      let authData = null;
      if (res?.result && res?.data) {
        setShowAllResponsibleOptions(res.data.myselfStatus);
        if (res.data.myselfStatus === 0 && props?.openType === "again_launch") {
          setIsPersonInCharge(1);
        }
        workDescReq.current = res.data.workDescReq || 0;
        authData = { isPersonInCharge: res.data.myselfStatus == 0 ? 1 : 0 || 0 };
      }
      return authData;
    } catch (error) { return null; }
  };

  /** 获取当前用户角色 */
  const getRole = async () => {
    const mode = localStorage.getItem("meegoTeamworkAppMode");
    if (mode === "tenant") {
      getConfig();
      getUserStandWorkHourData();
    } else {
      getUserStandWorkHourData();
    }
  };

  /** 查询是否开启代填工时功能 */
  const getConfig = async () => {
    const res = await getProjectConfig({
      type: "ALLOW_ADMINISTRATORS_TO_REGISTER_OTHERS_WORKING_HOURS",
    });
    if (res?.result) {
      //console.log('res',res)
      setIsAllowRegister(res.data?.value ? true : false);
    }
  };
  /** 查询用户标准工时 */
  const getUserStandWorkHourData = async (
    projectKey,
    userKeyOverride,
    isRequestActive = () => true
  ) => {
    const requestId = Symbol('capacity-request');
    capacityRequestIdRef.current = requestId;
    try {
      const  loginUser=getLocalUser()
      const data={
        userKey: userKeyOverride || registrantUserKey,
        outId: unionId.current || loginUser.outId,
        projectKey: projectKey || ""
      }
      const res = await getBatchStandWorkHourUser(data);
      if (!isRequestActive() || capacityRequestIdRef.current !== requestId) return null;
      let nextCapacitySet;
      if (res?.result && res?.data) {
        nextCapacitySet = {
          dayUp: res.data.dayUp || 24.0,
          onceDown: res.data.onceDown || 0.1,
          standWorkHour: res.data.standWorkHour || 8.0,
        };
      } else {
        console.warn('[getUserStandWorkHourData] 未命中数据，使用默认值', { dayUp: 24, onceDown: 1, standWorkHour: 8 });
        nextCapacitySet = { dayUp: 24, onceDown: 1, standWorkHour: 8 };
      }
      capacitySetRef.current = nextCapacitySet;
      setCapacitySet(nextCapacitySet);
      return nextCapacitySet;
    } catch (e) {
      if (isRequestActive() && capacityRequestIdRef.current === requestId) {
        console.error('[getUserStandWorkHourData] 异常:', e);
      }
      return null;
    }
  };

  /** 查询当前成员、空间和填报日期范围的考勤配置及数据。 */
  const getAttendanceContext = (dateBegin = beginWorkDate, dateEnd = endWorkDate, userKey = registrantUserKey, spaceKeys = selectedSpaceKeys) => {
    const isSpaceMode = localStorage.getItem("meegoTeamworkAppMode") === "space";
    const projectKey = isSpaceMode ? (spaceKeys?.[0] || null) : null;
    return { isSpaceMode, projectKey, userKey, beginWorkDate: dateBegin, endWorkDate: dateEnd };
  };

  const getAttendanceDimension = (context) => (
    `${context?.userKey || ''}|${context?.isSpaceMode ? context.projectKey || '' : 'tenant'}`
  );

  const getAttendanceRequestKey = (context) => (
    `${getAttendanceDimension(context)}|${context?.beginWorkDate || ''}|${context?.endWorkDate || ''}`
  );

  const getAttendanceSnapshot = (date, context = attendanceContextRef.current) => {
    if (!date || !context?.userKey) return null;
    const projectKey = context.isSpaceMode ? (context.projectKey || '') : 'tenant';
    const index = attendanceIndexRef.current;
    const attendance = getAttendance(index, projectKey, context.userKey, date);
    const config = index.configMap.get(projectKey) || {};
    if (!attendance && !Object.keys(config).length) return null;
    const attendanceEnabled = normalizeAttendanceNumber(
      attendance?.isEnable ?? config.isEnable,
    ) ?? 0;
    const attendanceHours = attendance
      ? normalizeAttendanceNumber(attendance.attendanceHours)
      : index.attendanceDataStatus === 'success' || index.attendanceDataStatus === 'error'
        ? 0
        : null;
    const missPunchPolicy = normalizeAttendanceNumber(
      attendance?.missPunchPolicy ?? config.missPunchPolicy,
    ) ?? 1;
    const missPunchCustomLimit = normalizeAttendanceNumber(
      attendance?.missPunchCustomLimit ?? config.missPunchCustomLimit,
    );
    return {
      ...config, ...(attendance || {}),
      attendanceEnabled,
      attendanceHours,
      missPunchPolicy,
      missPunchCustomLimit,
      attendanceRecordStatus: attendance
        ? 'record'
        : index.attendanceDataStatus === 'error' ? 'error' : 'missing',
      projectKey, userKey: context.userKey, workDate: date,
    };
  };

  const getDateCapacitySnapshot = (date) => {
    const attendance = attendanceSnapshotMap[date] || getAttendanceSnapshot(date);
    const saturationSnapshot = capacitySnapshotRef.current?.workDate === date
      && capacitySnapshotRef.current?.userKey === registrantUserKey
      ? capacitySnapshotRef.current
      : null;
    const registered = saturationSnapshot || workHoursTotalDetail?.[date] || {};
    if (!attendance && !Object.keys(registered).length) return null;
    const enabled = attendance?.attendanceEnabled ?? 0;
    const attendanceHours = attendance?.attendanceHours ?? null;
    const policy = attendance?.missPunchPolicy ?? 1;
    const customLimit = attendance?.missPunchCustomLimit ?? null;
    const dayUp = Number(capacitySet?.dayUp) || 24;
    const upperLimit = getAttendanceUpperLimit({
      enabled,
      hours: attendanceHours,
      policy,
      customLimit,
      dayUp,
    });
    // 区间统计接口返回 approvalingWorkHours，当前日期饱和度接口返回 approvalingWork。
    // 统一字段后再计算每个日期的剩余工时，避免切换日期时旧日期漏扣待审批工时。
    const registeredHours = normalizeAttendanceNumber(registered.registeredWorkingHours) || 0;
    const approvalingWork = normalizeAttendanceNumber(
      registered.approvalingWork ?? registered.approvalingWorkHours,
    ) || 0;
    return {
      ...attendance,
      ...registered,
      registeredWorkingHours: registeredHours,
      approvalingWork,
      attendanceEnabled: enabled,
      attendanceHours,
      missPunchPolicy: policy,
      missPunchCustomLimit: customLimit,
      dayUp,
      remainingWork: upperLimit - registeredHours - approvalingWork,
    };
  };

  const applyAttendanceSnapshot = (date) => {
    const snapshot = getAttendanceSnapshot(date);
    const next = {
      ...attendanceConfigRef.current,
      enabled: snapshot?.attendanceEnabled ?? 0,
      hours: snapshot?.attendanceHours ?? null,
      policy: snapshot?.missPunchPolicy ?? 1,
      customLimit: snapshot?.missPunchCustomLimit ?? null,
    };
    next.syncHours = next.hours !== null && next.hours > 0
      ? next.hours : next.policy === 2 ? next.customLimit : null;
    attendanceConfigRef.current = next;
    setAttendanceEnabled(next.enabled);
    setAttendanceHours(next.hours);
    setMissPunchPolicy(next.policy);
    setMissPunchCustomLimit(next.customLimit);
    setUpperLimitSource(snapshot?.upperLimitSource ?? 1);
    attendanceSyncHoursRef.current = next.syncHours;
    return next;
  };

  const loadAttendanceData = async (context, requestId, statusConfig) => {
    const rangeDates = getDatesInRange(beginWorkDate, endWorkDate);
    const startDate = rangeDates[0]?.date;
    const endDate = rangeDates[rangeDates.length - 1]?.date;
    const params = {
      items: [{
        projectKey: context.isSpaceMode ? context.projectKey : null,
        userKey: context.userKey,
      }],
      startDate: startDate,
      endDate: endDate,
    };
    let res = null;
    let attendanceDataStatus = 'success';
    try {
      res = await getUserAttendanceConfig(params);
      if (!res?.result || !res?.data || !Array.isArray(res.data.projects)) {
        attendanceDataStatus = 'error';
      }
    } catch (error) {
      attendanceDataStatus = 'error';
      if (requestId === attendanceRequestIdRef.current) {
        console.error('获取考勤数据失败:', error);
      }
    }
    if (!isMountedRef.current || requestId !== attendanceRequestIdRef.current) return false;
    const projects = attendanceDataStatus === 'success' ? res.data.projects : [];
    const index = buildAttendanceIndex(projects);
    index.attendanceDataStatus = attendanceDataStatus;
    const fallbackConfig = statusConfig
      || (attendanceStatusConfigKeyRef.current === getAttendanceDimension(context)
        ? attendanceStatusConfigRef.current
        : null);
    if (fallbackConfig) {
      const projectKey = context.isSpaceMode ? (context.projectKey || '') : 'tenant';
      index.configMap.set(projectKey, { ...fallbackConfig, projectKey });
    }
    attendanceIndexRef.current = index;
    attendanceContextRef.current = context;
    const nextSnapshots = {};
    getDatesInRange(context.beginWorkDate, context.endWorkDate).forEach(({ date }) => {
      const snapshot = getAttendanceSnapshot(date, context);
      if (snapshot) nextSnapshots[date] = snapshot;
    });
    setAttendanceSnapshotMap(nextSnapshots);
    applyAttendanceSnapshot(nextSnapshots[workDate] ? workDate : context.beginWorkDate);
    return true;
  };

  const getCurrentAlertDate = (context) => {
    if (!workDate || !context?.beginWorkDate || !context?.endWorkDate) return null;
    return getDatesInRange(context.beginWorkDate, context.endWorkDate)
      .some(({ date }) => date === workDate) ? workDate : null;
  };

  const getAttendanceConfigInfo = async (
    context = getAttendanceContext(),
    { refreshAlert = false } = {},
  ) => {
    if (!context.userKey || !context.beginWorkDate || !context.endWorkDate
      || (context.isSpaceMode && !context.projectKey)) return false;
    const requestId = ++attendanceRequestIdRef.current;
    saturationRequestIdRef.current += 1;
    const contextKey = getAttendanceRequestKey(context);
    const isContextChanged = attendanceContextKeyRef.current !== contextKey;
    attendanceContextKeyRef.current = contextKey;
    attendanceIndexRef.current = { dataMap: new Map(), configMap: new Map() };
    attendanceContextRef.current = null;
    setAttendanceSnapshotMap({});
    if (isContextChanged) {
      attendanceStatusConfigRef.current = null;
      attendanceStatusConfigKeyRef.current = null;
      capacitySnapshotRef.current = null;
      setWorkDate("");
      setAlertDetail({});
      setAlertDetailOld({});
    }
    try {
      const res = await getAttendanceConfig([{ projectKey: context.isSpaceMode ? context.projectKey : null, userKey: context.userKey }]);
      if (!isMountedRef.current || requestId !== attendanceRequestIdRef.current) return;
      const config = res?.result && Array.isArray(res?.data) ? res.data[0] : null;
      if (!config) {
        console.error('获取考勤配置失败，跳过考勤数据请求');
        return false;
      }
      attendanceStatusConfigRef.current = config;
      attendanceStatusConfigKeyRef.current = getAttendanceDimension(context);
      attendanceConfigRef.current = { ...attendanceConfigRef.current, enabled: config.isEnable ?? 0, policy: config.missPunchPolicy ?? 1, customLimit: config.missPunchCustomLimit ?? null };
      setAttendanceEnabled(config.isEnable ?? 0);
      setUpperLimitSource(config.upperLimitSource ?? 1);
      setMissPunchPolicy(config.missPunchPolicy ?? 1);
      setMissPunchCustomLimit(config.missPunchCustomLimit ?? null);
      const loaded = await loadAttendanceData(context, requestId, config);
      if (!loaded) return false;
      handleRegTableColumns("changeColumns");
      if (refreshAlert) {
        const alertDate = getCurrentAlertDate(context);
        if (alertDate) await getAlertDetail(alertDate, context);
      }
      return true;
    } catch (error) {
      if (requestId === attendanceRequestIdRef.current) console.error('获取考勤数据失败:', error);
      return false;
    }finally{
      // setAttendanceEnabled(1);
      // await getUserAttendanceConfigData(1);
    }
  };

  /** 获取个人工作饱和度提示 */
  const getAlertDetail = async (date = workDate || beginWorkDate, contextOverride = null) => {
    if (!date || !registrantUserKey) return;
    const requestId = ++saturationRequestIdRef.current;
    const requestContext = contextOverride || getAttendanceContext(beginWorkDate, endWorkDate, registrantUserKey, selectedSpaceKeys);
    setWorkDate(date);
    const params = { workDate: date, registrantUseKey: requestContext.userKey };
    // 空间模式下传递当前选中的空间 projectKey；租户模式或未选中空间时不传
    if (requestContext.isSpaceMode) {
      params.projectKey = requestContext.projectKey || curRecord?.projectKey || selectedSpaceKeys[0] || '';
    }

    // 考勤结果已经按成员、空间、日期范围缓存，此处只读取当前编辑日期。
    const _attConfig = applyAttendanceSnapshot(date);
    const _attendanceHours = _attConfig.hours; // 实际考勤工时（缺卡时为 null）
    const _attSyncHours = _attConfig.syncHours; // 用于计算剩余工时的基数

    const res = await getBatchWorkSaturationTips(params);
    const currentContext = getAttendanceContext();
    if (res?.result && requestId === saturationRequestIdRef.current
      && getAttendanceRequestKey(requestContext) === getAttendanceRequestKey(currentContext)) {
      const rawData = JSON.parse(JSON.stringify(res.data));
      setAlertDetailOld(rawData);
      // 记录接口原始快照（供 validator 使用）
      capacitySnapshotRef.current = {
        workDate: date,
        userKey: requestContext.userKey,
        remainingWork: Number(res.data.remainingWork),
        registeredWorkingHours: Number(res.data.registeredWorkingHours) || 0,
        approvalingWork: Number(res.data.approvalingWork) || 0,
        dayUp: Number(capacitySet?.dayUp) || 24,
        attendanceEnabled: _attConfig.enabled,
        attendanceHours: _attendanceHours,
        missPunchPolicy: _attConfig.policy,
        missPunchCustomLimit: _attConfig.customLimit,
      };

      // 计算剩余可登记工时（根据考勤场景）
      const _origRegistered = Number(res.data.registeredWorkingHours) || 0;
      const _origApprovaling = Number(res.data.approvalingWork) || 0;
      const _dayUp = Number(capacitySet?.dayUp) || 24;

      // 确定剩余工时基数
      let _remainingBase;
      if (_attConfig.enabled === 0) {
        _remainingBase = _dayUp; // 场景1：考勤关闭
      } else {
        _remainingBase = getAttendanceUpperLimit({
          enabled: _attConfig.enabled,
          hours: _attendanceHours,
          policy: _attConfig.policy,
          customLimit: _attConfig.customLimit,
          dayUp: _dayUp,
        });
      }

      // 计算剩余可登记工时
      const alertDetail = JSON.parse(JSON.stringify(res.data));
      alertDetail.remainingWork = Number(
        (_remainingBase - _origRegistered - _origApprovaling).toFixed(2)
      );

      // 计算工作饱和度
      alertDetail.saturation = Number(
        (((_origRegistered + _origApprovaling) / _dayUp) * 100).toFixed(2)
      );

      setAlertDetail(alertDetail);
    }
  };

  /** 点击「同步考勤」：重新查询考勤配置 → 刷新Alert区域 → 强制重渲染表格背景色 */
  const handleSyncAttendance = async () => {
    if (attendanceSyncLoadingRef.current) return;
    attendanceSyncLoadingRef.current = true;
    setAttendanceSyncLoading(true);
    try {
      const context = getAttendanceContext();
      const synced = await getAttendanceConfigInfo(context, { refreshAlert: true });
      if (synced) {
        message.success("同步考勤成功");
      } else {
        message.error("同步考勤失败，请稍后重试");
      }
    } catch (error) {
      console.error("同步考勤失败:", error);
      message.error("同步考勤失败，请稍后重试");
    } finally {
      attendanceSyncLoadingRef.current = false;
      if (isMountedRef.current) setAttendanceSyncLoading(false);
    }
  };

  /** 获取节点任务选项 */
  const getEntityNodeOption = async (data) => {
    data.registerUserKey = registrantUserKey;
    const res = await postBatchGetEntityNodeOption(data);
    if (res.result && res?.data?.registrationLevelVoList?.length > 0) {
      // 保留 canRegister=false 的节点/任务显示，但标记 disabled 且不挂 children，禁止下钻与选中
      const processNodes = (nodes) => {
        return (nodes || []).map(item => {
          const canRegister = item.canRegister !== false;
          const node = { ...item };
          if (!canRegister) {
            node.disabled = true;
            node.children = undefined;
          } else if (item.children && Array.isArray(item.children)) {
            node.children = processNodes(item.children);
          }
          return node;
        });
      };
      res.data = processNodes(res?.data?.registrationLevelVoList || []);
      res.data.forEach(item => {
        item.label = item.level || '';
        if(item.children){
          item.children.forEach(child => {
            child.label = child.level || '';
          })
        }
      })
      setNodeTaskOptions(res.data);
    }
  };

  /** 弹窗登记展示逻辑 */
  const getRegDisplayLogic = async () => {
    const res = await getDisplayLogic();
    if (res?.result) {
      setRegDisplayLogic(res.data);
      if ("standardProduct" in res.data && !res.data?.standardProduct) {
        setScheduleStart(beginWorkDate);
        setScheduleEnd(endWorkDate);
        if (res?.data?.defaultBatchRegisWorkItemType?.length == 0) setTableLoading2(false);
      } else {
        setTableLoading2(false);
      }
    }
  };

  /** 埋点 */
  const getUserActive = async (data) => {
    await postUserActive({ activeType: data });
  };

  /** 获取表格排序配置 */
  const getTableSortConfig = async () => {
    const params = {};
    if (localStorage.getItem('meegoTeamworkAppMode') === 'space') {
      params.projectKey = 0;
    }
    const res = await getBatchRegTableSortConfig(params);
    if (res?.result) {
      setColumnsSet(res.data);
    }
  };

  /** 保存表格排序配置 */
  const saveTableSortConfig = async (value) => {
    const params = { registrationHead: value };
    if(localStorage.getItem('meegoTeamworkAppMode') === 'space'){
      params.projectKey = 0;
    }
    await postBatchRegTableSortConfig(params);
  };

  /** 获取空间列表 */
  const fetchSpaceOptionsList = async (userKeyOverride, isRequestActive = () => true) => {
    if (isRequestActive()) setSpaceLoading(true);
    try {
      const res = await getRegisterProjectKeyOption({registerUserKey: userKeyOverride || registrantUserKey});
      if (!isRequestActive()) return [];
      if (res?.result && Array.isArray(res.data)) {
        const options = res.data.map(item => ({
          label: item.level || item.label || item.spaceName,
          value: item.projectKey || item.value || item.id || item.spaceId,
          isFillInOnBehalf: item.isFillInOnBehalf || false,//代填
          isAllManager: item.isAllManager || false,//全部责任人
          describe: item.describe || false, //描述是否必填
          enableApproval: item.enableApproval || false,//是否开启审批
          isEnableGranularity: item.isEnableGranularity ?? 0, //工时颗粒度是否开启
          granularityHour: item.granularityHour ?? null, //工时颗粒度值
        }));
        options.forEach(opt => {
          spaceMap.current.set(opt.value, opt);
        });
        let isFillInOnBehalf = false
        // 空间模式下判断是否启用代填
        if (localStorage.getItem('meegoTeamworkAppMode') === 'space') {
            isFillInOnBehalf = options.some(opt => opt.isFillInOnBehalf === true);
            setIsAllowRegister(isFillInOnBehalf);
        }else{
          //  if(localStorage.getItem('meegoTeamworkUserRole') === 'space_admin'){
          //   isFillInOnBehalf = options.some(opt => opt.isFillInOnBehalf === true);
          //   setIsAllowRegister(isFillInOnBehalf);
          //  }
        }
        setSpaceOptions(options);
        return options;
      }
    } catch (error) {
      if (isRequestActive()) console.error('获取空间列表失败:', error);
    } finally {
      if (isRequestActive()) setSpaceLoading(false);
    }
    return [];
  };

  /** 根据多个空间获取工作项选项（合并去重） */
  const fetchWorkItemOptionsBySpaces = async (spaceKeys, isRequestActive = () => true) => {
    if (!spaceKeys?.length) return [];
    let allOptions = [];
    let newMap = {};
     const params = { projectKeys:spaceKeys};
      if (props?.openType === "again_launch") params.needDisable = true;
      const res = await getBatchRegisterWorkItemOption(params);
      if (!isRequestActive()) return [];
      if (res?.result && res.data) {
        res.data.forEach(item => {
          item.label = item.level || item.name
          item.id = item.value
          item.value=`${item.projectKey}-${item.value}`
          item.workItemId = item.value
          item.projectKey = item.projectKey
          if (props?.openType === "again_launch") delete item.disabled
          if(!newMap[item.projectKey]){
            newMap[item.projectKey] = [];
            newMap[item.projectKey].push(item);
          }else{
            newMap[item.projectKey].push(item);
          }
        });
        allOptions = [...allOptions, ...res.data];
      }
    const seenValues = new Set();
    const uniqueOptions = allOptions.filter(item => {
      if (seenValues.has(item.value)) return false;
      seenValues.add(item.value);
      return true;
    });
    projectKeyWorkItemMapRef.current = newMap;
    return uniqueOptions;
  };

  const initializeBatchFilterMemory = async (isRequestActive) => {
    batchMemoryRestoringRef.current = true;
    const restoreState = batchMemoryQueryRef.current;
    setFilterMemoryLoading(true);

    try {
      const res = await getBatchRegisterMemory({ point: 'batch' });
      if (!isRequestActive()) return;

      const memory = res?.result && hasRestorableBatchMemory(res.data) ? res.data : null;
      if (!memory) {
        setFilterMemoryLoading(false);
        await fetchSpaceOptionsList(undefined, isRequestActive);
        return;
      }

      const targetUserKey = memory.staffUserKey || registrantUserKey;
      const queries = Array.isArray(memory.queryRegistrationReq)
        ? memory.queryRegistrationReq
        : [];
      const availableSpaces = await fetchSpaceOptionsList(targetUserKey, isRequestActive);
      if (!isRequestActive()) return;

      if (queries.length > 0 && availableSpaces.length === 0) {
        if (targetUserKey !== registrantUserKey) {
          await fetchSpaceOptionsList(undefined, isRequestActive);
        }
        return;
      }

      const isSpaceMode = localStorage.getItem('meegoTeamworkAppMode') === 'space';
      const nextSpaceKeys = getRestorableSpaceKeys(queries, availableSpaces, isSpaceMode);
      const nextWorkItemOptions = await fetchWorkItemOptionsBySpaces(
        nextSpaceKeys,
        isRequestActive
      );
      if (!isRequestActive()) return;

      const hasRememberedWorkItems = queries.some(query => (
        Array.isArray(query?.workItemIds) && query.workItemIds.length > 0
      ));
      if (hasRememberedWorkItems && nextWorkItemOptions.length === 0) {
        if (targetUserKey !== registrantUserKey) {
          await fetchSpaceOptionsList(undefined, isRequestActive);
        }
        return;
      }

      const restoredSelections = buildRestoredWorkItemSelections(
        queries,
        nextSpaceKeys,
        nextWorkItemOptions
      );
      const capacityProjectKey = isSpaceMode ? nextSpaceKeys[0] : '';
      await getUserStandWorkHourData(
        capacityProjectKey,
        targetUserKey,
        isRequestActive
      );
      if (!isRequestActive()) return;

      const shouldForceCurrentUser = nextSpaceKeys.length > 0 && nextSpaceKeys.every(spaceKey => (
        spaceMap.current.get(spaceKey)?.isAllManager === false
      ));
      const rememberedPersonInCharge = memory.isPersonInCharge === 0 || memory.isPersonInCharge === 1
        ? memory.isPersonInCharge
        : isPersonInCharge;
      const nextPersonInCharge = shouldForceCurrentUser ? 0 : rememberedPersonInCharge;
      const nextBeginWorkDate = isValidMemoryDate(memory.beginWorkDate)
        ? memory.beginWorkDate
        : beginWorkDate;
      const nextEndWorkDate = isValidMemoryDate(memory.endWorkDate)
        ? memory.endWorkDate
        : endWorkDate;

      if (targetUserKey !== registrantUserKey) {
        setRegistrantUserKey(targetUserKey);
        setPickerUser({ userKey: targetUserKey });
        props.getRegistrantUserKey?.(targetUserKey);
      }
      if (Object.prototype.hasOwnProperty.call(memory, 'point')) setPoint(memory.point);
      setSelectedSpaceKeys(nextSpaceKeys);
      setWorkItemOptions(nextWorkItemOptions);
      workItemIdsRef.current = restoredSelections.workItemIds;
      workItemIdsFilterRef.current = restoredSelections.workItemIdsFilter;
      workItemEntityIdsRef.current = restoredSelections.workItemEntityIds;
      beforeAddWorkItemIdsRef.current = restoredSelections.workItemIds;
      beforeWorkItemIdsFilterRef.current = restoredSelections.workItemIdsFilter;
      setWorkItemIds(restoredSelections.workItemIds);
      setSearchWorkItemIds(restoredSelections.workItemIds);
      setWorkItemIdsFilter(restoredSelections.workItemIdsFilter);
      setWorkItemEntityIds(restoredSelections.workItemEntityIds);
      setSearchWorkItemEntityIds(restoredSelections.workItemEntityIds);
      setBeginWorkDate(nextBeginWorkDate);
      setEndWorkDate(nextEndWorkDate);
      setBeginWorkDateCP(nextBeginWorkDate);
      setEndWorkDateCP(nextEndWorkDate);
      setWorkDateType(resolveWorkDateType(nextBeginWorkDate, nextEndWorkDate));
      setScheduleStart(isValidMemoryDate(memory.scheduleStart) ? memory.scheduleStart : scheduleStart);
      setScheduleEnd(isValidMemoryDate(memory.scheduleEnd) ? memory.scheduleEnd : scheduleEnd);
      setIsPersonInCharge(nextPersonInCharge);

      restoreState.pending = true;
      restoreState.shouldQuery = restoredSelections.workItemIds.length > 0;
      setInvoke(restoreState.shouldQuery);
      setIsInitialized(true);
    } catch (error) {
      if (isRequestActive()) {
        console.error('恢复批量登记筛选记忆失败:', error);
        setFilterMemoryLoading(false);
        await fetchSpaceOptionsList(undefined, isRequestActive);
      }
    } finally {
      if (isRequestActive() && !restoreState.pending) {
        batchMemoryRestoringRef.current = false;
        setFilterMemoryLoading(false);
      }
    }
  };

  /** 再次发起：按当前多空间数据结构恢复原审批内容 */
  const initializeAgainLaunch = async () => {
    if (props?.openType !== "again_launch") return;
    againLaunchInitializingRef.current = true;
    againLaunchEmptyFilterRef.current = { pending: false, signature: null };

    const batchRegVal = props?.batchRegVal || {};
    const approvalRecords = Array.isArray(batchRegVal.approvalRecordInfoVoList)
      ? batchRegVal.approvalRecordInfoVoList
      : [];
    const targetUserKey = batchRegVal.registrantUserKey || batchRegVal.staffUserKey || registrantUserKey;
    const targetUser = {
      userKey: targetUserKey,
      nameCn: batchRegVal.userName || batchRegVal.staffName || pickerUser.nameCn,
      avatarUrl: batchRegVal.avatarUrl || batchRegVal.staffAvatarUrl || pickerUser.avatarUrl,
    };

    setTableLoading2(true);
    callCountRef.current = 1;
    setRegistrantUserKey(targetUserKey);
    setPickerUser(targetUser);
    props.getRegistrantUserKey?.(targetUserKey);

    const recordDates = approvalRecords
      .map(item => item?.workDate && dayjs(item.workDate).format("YYYY-MM-DD"))
      .filter(Boolean)
      .sort();
    const startDate = batchRegVal.registrationStartDate || recordDates[0] || beginWorkDate;
    const endDate = batchRegVal.registrationEndDate || recordDates[recordDates.length - 1] || endWorkDate;
    setBeginWorkDate(startDate);
    setEndWorkDate(endDate);
    setBeginWorkDateCP(startDate);
    setEndWorkDateCP(endDate);

    //const activeRecords = approvalRecords.filter(item => item?.tag !== 0);
    const activeRecords = approvalRecords
    const originalProjectKeys = [...new Set(
      activeRecords
        .map(item => item.projectKey || batchRegVal.projectKey)
        .filter(Boolean)
    )];
    const validationResults = await Promise.all(originalProjectKeys.map(async projectKey => {
      const projectRecords = activeRecords.filter(item =>
        String(item.projectKey || batchRegVal.projectKey || '') === String(projectKey)
      );
      const workItemIds = [...new Set(projectRecords.map(item => item.workItemId).filter(Boolean))];
      const fallbackAllowedWorkItemIds = new Set(workItemIds.map(String));
      try {
        const res = await getBatchRegisterProjectKeyAndWorkItemTypeInfo({ projectKey, workItemIds });
        if (!res?.result || !res.data) {
          return { projectKey, projectRecords, canRegister: true, allowedWorkItemIds: fallbackAllowedWorkItemIds };
        }

        const workItemPermissions = res.data.canRegisterLaunchAgainWorkItemVoList;
        const allowedWorkItemIds = Array.isArray(workItemPermissions)
          ? new Set(
              workItemPermissions
                .filter(item => item?.canRegister === true && item?.workItemId)
                .map(item => String(item.workItemId))
            )
          : fallbackAllowedWorkItemIds;

        return {
          projectKey,
          projectRecords,
          canRegister: res.data.canRegister !== false,
          allowedWorkItemIds,
        };
      } catch (error) {
        console.error(`再次发起校验空间 ${projectKey} 及工作项失败:`, error);
        return { projectKey, projectRecords, canRegister: true, allowedWorkItemIds: fallbackAllowedWorkItemIds };
      }
    }));

    const validProjectKeySet = new Set();
    const allowedWorkItemIdsByProject = new Map();
    const unavailableWorkItemIdsByProject = new Map();
    const unavailableSpaceNames = [];
    const unavailableWorkItemNames = [];

    validationResults.forEach(({ projectKey, projectRecords, canRegister, allowedWorkItemIds }) => {
      const projectKeyValue = String(projectKey);
      if (!canRegister) {
        const projectName = projectRecords[0]?.projectName || projectKey;
        if (!unavailableSpaceNames.includes(projectName)) unavailableSpaceNames.push(projectName);
        return;
      }

      validProjectKeySet.add(projectKeyValue);
      allowedWorkItemIdsByProject.set(projectKeyValue, allowedWorkItemIds);
      unavailableWorkItemIdsByProject.set(
        projectKeyValue,
        new Set(
          projectRecords
            .map(item => item.workItemId)
            .filter(Boolean)
            .map(String)
            .filter(workItemId => !allowedWorkItemIds.has(workItemId))
        )
      );
      projectRecords.forEach(item => {
        if (!item.workItemId || allowedWorkItemIds.has(String(item.workItemId))) return;
        const workItemName = item.workItemName || item.workItemId;
        //const displayName = item.projectName ? `${item.projectName}/${workItemName}` : workItemName;
        const displayName = item.projectName ? `${workItemName}` : workItemName;
        if (!unavailableWorkItemNames.includes(displayName)) unavailableWorkItemNames.push(displayName);
      });
    });

    const projectKeys = originalProjectKeys.filter(projectKey => validProjectKeySet.has(String(projectKey)));
    const availableSpaces = await fetchSpaceOptionsList(targetUserKey);
    const originalProjectKeySet = new Set(originalProjectKeys.map(String));
    const mergedSpaces = availableSpaces.filter(option => {
      const optionKey = String(option.value);
      return !originalProjectKeySet.has(optionKey) || validProjectKeySet.has(optionKey);
    });
    projectKeys.forEach(projectKey => {
      if (mergedSpaces.some(item => String(item.value) === String(projectKey))) return;
      const projectRecord = activeRecords.find(item =>
        String(item.projectKey || batchRegVal.projectKey || '') === String(projectKey)
      );
      mergedSpaces.push({
        label: projectRecord?.projectName || projectKey,
        value: projectKey,
      });
    });
    spaceMap.current.clear();
    mergedSpaces.forEach(option => spaceMap.current.set(option.value, option));
    setSpaceOptions(mergedSpaces);
    setSelectedSpaceKeys(projectKeys);
    if (projectKeys.length) await getCapacity(projectKeys[0]);

    let fetchedWorkItemOptions = [];
    try {
      fetchedWorkItemOptions = await fetchWorkItemOptionsBySpaces(projectKeys);
    } catch (error) {
      console.error('再次发起获取工作项选项失败:', error);
    }
    const validFetchedWorkItemOptions = fetchedWorkItemOptions.filter(item => {
      const projectKey = String(item.projectKey);
      if (!validProjectKeySet.has(projectKey)) return false;
      return !unavailableWorkItemIdsByProject.get(projectKey)?.has(String(item.id));
    });
    const validWorkItemOptionsByProject = {};
    validFetchedWorkItemOptions.forEach(item => {
      if (!validWorkItemOptionsByProject[item.projectKey]) validWorkItemOptionsByProject[item.projectKey] = [];
      validWorkItemOptionsByProject[item.projectKey].push(item);
    });
    projectKeyWorkItemMapRef.current = validWorkItemOptionsByProject;
    const workItemOptionMap = new Map(validFetchedWorkItemOptions.map(item => [item.value, item]));
    const restorableRecords = activeRecords.filter(item => {
      const projectKey = item.projectKey || batchRegVal.projectKey || '';
      if (!validProjectKeySet.has(String(projectKey)) || !item.workItemId) return false;
      return allowedWorkItemIdsByProject.get(String(projectKey))?.has(String(item.workItemId));
    });
    restorableRecords.forEach(item => {
      const projectKey = item.projectKey || batchRegVal.projectKey || '';
      const workItemValue = `${projectKey}-${item.workItemId}`;
      if (workItemOptionMap.has(workItemValue)) return;
      const option = {
        label: item.workItemName || item.workItemId,
        value: workItemValue,
        workItemId: workItemValue,
        projectKey,
      };
      workItemOptionMap.set(workItemValue, option);
      if (!projectKeyWorkItemMapRef.current[projectKey]) projectKeyWorkItemMapRef.current[projectKey] = [];
      projectKeyWorkItemMapRef.current[projectKey].push(option);
    });
    const aggregatedEditData = aggregateWorkHours(restorableRecords) || [];
    editDataRef.current = aggregatedEditData;
    updateEditDataRef.current = restorableRecords;
    setEditData(aggregatedEditData);
    setUpdateEditData(restorableRecords);

    const nextWorkItemIds = [];
    const nextWorkItemEntityIds = [];
    const nextWorkItemIdsFilter = [];
    const deletedObjects = approvalRecords
      .filter(item => item?.tag === 0)
      .map(item => [item.workItemEntityName, item.nodeName, item.taskName]
        .filter(Boolean)
        .map(name => String(name).replace('【已删除】', ''))
        .join('/'))
      .filter((path, index, paths) => path && paths.indexOf(path) === index);
    restorableRecords.forEach(item => {
      const projectKey = item.projectKey || batchRegVal.projectKey || '';
      if (!projectKey || !item.workItemId) return;
          const workItemValue = `${projectKey}-${item.workItemId}`;
          if (!nextWorkItemIds.includes(workItemValue)) nextWorkItemIds.push(workItemValue);

          if (!item.workItemEntityId) return;
          if(item.tag ===1) {
            const entityValue = `${projectKey}-${item.workItemId}-${item.workItemEntityId}`;
            const entityOption = JSON.stringify({
              workItemId: workItemValue,
              label: item.workItemEntityName,
              value: entityValue,
              projectKey,
              customFieldValue: item.customFieldValue,
            });
            if (!nextWorkItemEntityIds.some(value => JSON.parse(value).value === entityValue)) {
              nextWorkItemEntityIds.push(entityOption);
              nextWorkItemIdsFilter.push({
                workItemId: workItemValue,
                workItemEntityId: entityValue,
                workItemEntityName: item.workItemEntityName,
                customFieldValue: item.customFieldValue,
              });
            }
          }
    });
    setWorkItemOptions(Array.from(workItemOptionMap.values()));
    workItemIdsRef.current = nextWorkItemIds;
    workItemIdsFilterRef.current = nextWorkItemIdsFilter;
    workItemEntityIdsRef.current = nextWorkItemEntityIds;
    beforeWorkItemIdsFilterRef.current = nextWorkItemIdsFilter;
    setWorkItemIds(nextWorkItemIds);
    setSearchWorkItemIds(nextWorkItemIds);
    setWorkItemEntityIds(nextWorkItemEntityIds);
    setSearchWorkItemEntityIds(nextWorkItemEntityIds);
    setWorkItemIdsFilter(nextWorkItemIdsFilter);
    if (unavailableSpaceNames.length) {
      JSSDK.toast.error(`[${unavailableSpaceNames.join('、')}]已删除或无权限，无法登记工时，相关登记内容已经移除`);
    }else{
      if (unavailableWorkItemNames.length) {
        JSSDK.toast.error(`${unavailableWorkItemNames.map(item => `[${item}]`).join('、')}已删除或无权限，无法登记工时，相关工作项实例及登记内容已经移除`);
      }
      if (deletedObjects.length) {
        JSSDK.toast.error(`${deletedObjects.map(item => `[${item}]`).join(',')}已删除,无法登记工时,相关内容已移除`);
      }
      if (batchRegVal.showClearleLevel) {
        JSSDK.toast.error('根据最新登记规则，部分暂存工时因登记层级不符已被清除。建议先检查数据后，重新提交。');
      }
    }
    if (nextWorkItemEntityIds.length) {
      againLaunchEmptyFilterRef.current = { pending: false, signature: null };
      setInvoke(true);
    } else {
      againLaunchEmptyFilterRef.current = { pending: true, signature: null };
      setInvoke(false);
      setTableLoading2(false);
    }
    againLaunchInitializingRef.current = false;
    setIsInitialized(true);
  };
  /** 空间工作项类型拉取——500ms 防抖，连续操作仅保留最后一次调用 */
  /** 入参必须显式传入 spaceKeys，避免防抖延迟期间闭包读取到旧的 selectedSpaceKeys */
  const debouncedFetchWorkItemOptions = useCallback(
    debounce(async (spaceKeys) => {
      if (!spaceKeys?.length) {
        projectKeyWorkItemMapRef.current = {};
        setWorkItemOptions([]);
        return;
      }
      setWorkItemOptionsLoading(true);
      try {
        const newWorkItemOptions = await fetchWorkItemOptionsBySpaces(spaceKeys);
        setWorkItemOptions(newWorkItemOptions);
      } finally {
        setWorkItemOptionsLoading(false);
      }
    }, 500),
    []
  );
    const handleSpaceBlur = useCallback(
    debounce(async () => {
      // 失焦时根据选择的空间获取工作项类型列表（与新增空间共用防抖函数，天然去重）
      debouncedFetchWorkItemOptions(selectedSpaceKeys);
    }, 300),
    [selectedSpaceKeys]
  );
  const debouncedSpaceDeselect = useCallback(
    debounce((delVal) => {
      if (modalLockRef.current || isModalVisible) return;
      //console.log('delVal', delVal);
      // setPreviousWorkItemIds([...workItemIds]);
      // setPreviousWorkItemEntityIds([...workItemEntityIds]);
      // setPreviousWorkItemIdsFilter([...workItemIdsFilter]);
      // setSearchWorkItemIds((prevIds) => prevIds.includes(delVal) ? prevIds : [...prevIds, delVal]);
      // setWorkItemIds((prev) => prev.filter((id) => id !== delVal));
      // setWorkItemIdsFilter((prevFilter) => prevFilter.filter((item) => item.workItemId !== delVal));
      // setIsOnDeselect(true);
      // setIsWorkItemChanged(true);
    }, 800),
    [selectedSpaceKeys]
  );
  /** 空间选择变更处理 */
  const onSpaceChange = async (newSpaceKeys) => {
    if (newSpaceKeys.length > 3) return;
    if (modalLockRef.current || isModalVisible) return;
    const isSpaceMode = localStorage.getItem('meegoTeamworkAppMode') === 'space';
    const removedSpaceKeys = selectedSpaceKeys.filter(k => !newSpaceKeys.includes(k));
    // 计算本次新增的空间
    const addedSpaceKeys = newSpaceKeys.filter(k => !selectedSpaceKeys.includes(k));
    // 租户模式沿用原逻辑：新增空间时拉取工作项类型，删除空间时不调用接口
    if (!isSpaceMode && addedSpaceKeys.length > 0) {
      debouncedFetchWorkItemOptions(newSpaceKeys);
    }

    const clearSpaceModeWorkItemSelection = (spaceKeys) => {
      debouncedFetchWorkItemOptions.cancel();
      lastRequestIdRef.current = null;
      projectKeyWorkItemMapRef.current = {};
      workItemIdsRef.current = [];
      workItemIdsFilterRef.current = [];
      workItemEntityIdsRef.current = [];
      beforeAddWorkItemIdsRef.current = [];
      beforeWorkItemIdsFilterRef.current = [];

      setInvoke(false);
      setLoading(false);
      setTableLoading(false);
      setHasMore(false);
      setWorkItemOptions([]);
      setWorkItemIds([]);
      setSearchWorkItemIds([]);
      setWorkItemEntityId("");
      setWorkItemEntityIds([]);
      setSearchWorkItemEntityIds([]);
      setWorkItemIdsFilter([]);
      setPreviousWorkItemIds([]);
      setPreviousWorkItemEntityIds([]);
      setPreviousWorkItemIdsFilter([]);
      setIsWorkItemChanged(false);
      setIsOnDeselect(false);

      if (spaceKeys?.length) {
        debouncedFetchWorkItemOptions(spaceKeys);
      }
    };
    // 仅删除用户选中的空间，同时删除该空间所属的工作项数据、选中的工作项及工作项实例
    const removeSpaceWorkItems = () => {
      if (removedSpaceKeys.length === 0) return;

      // 第一步：收集被删除空间中独有的工作项标识（若其他保留空间也包含该工作项，则保留）
      const workItemIdsToRemove = new Set();
      removedSpaceKeys.forEach(spaceKey => {
        const spaceWorkItems = projectKeyWorkItemMapRef.current[spaceKey] || [];
        spaceWorkItems.forEach(wItem => {
          const wId = wItem.value;
          const usedInOtherSpace = newSpaceKeys.some(otherKey =>
            (projectKeyWorkItemMapRef.current[otherKey] || []).some(item => item.value === wId)
          );
          // 仅当该工作项不被任何保留空间使用时，才标记为待删除
          if (!usedInOtherSpace) workItemIdsToRemove.add(wId);
        });
      });
      // 第二步：从用户选中的工作项中移除被删除空间独有的工作项
      const newWorkItemIds = workItemIds.filter(id => !workItemIdsToRemove.has(id));
      const newWorkItemIdsFilter = workItemIdsFilter.filter(item => {
        // 取 workItemEntityId 最后一个 "-" 之前的字符串作为 workItemId 进行比较
        const entityWorkItemId = item.workItemEntityId?.lastIndexOf('-') > 0
          ? item.workItemEntityId.substring(0, item.workItemEntityId.lastIndexOf('-'))
          : item.workItemEntityId;
        return !workItemIdsToRemove.has(entityWorkItemId);
      });

      // 第三步：从用户选中的工作项实例中移除关联实例
      const removedWorkItemIdSet = new Set(workItemIds.filter(id => !newWorkItemIds.includes(id)));
      let newWorkItemEntityIds = workItemEntityIds;
      if (removedWorkItemIdSet.size > 0) {
        newWorkItemEntityIds = workItemEntityIds.filter(entityIdStr => {
          try {
            const parsed = JSON.parse(entityIdStr);
            const entityWorkItemId2 = parsed.value?.lastIndexOf('-') > 0
          ? parsed.value.substring(0, parsed.value.lastIndexOf('-'))
          : parsed.value;
        return !workItemIdsToRemove.has(entityWorkItemId2);
          } catch (e) { return true; }
        });
      }
      // 第四步：更新选中的工作项状态
      // 同步更新 ref，保证后续同步调用 getSelectWorkInstanceTable 时读取到最新值
      workItemIdsRef.current = newWorkItemIds;
      workItemIdsFilterRef.current = newWorkItemIdsFilter;
      setWorkItemIds(newWorkItemIds);
      setWorkItemIdsFilter(newWorkItemIdsFilter);
      setWorkItemEntityIds(newWorkItemEntityIds);
      setSearchWorkItemIds(newWorkItemIds);
      setSearchWorkItemEntityIds(newWorkItemEntityIds);

      // 第五步：从工作项列表选项中仅移除被删除空间独有的选项，保留其他空间选项
      const removedSpaceWorkItemValues = new Set();
      removedSpaceKeys.forEach(spaceKey => {
        const spaceWorkItems = projectKeyWorkItemMapRef.current[spaceKey] || [];
        spaceWorkItems.forEach(wItem => {
          const usedInOtherSpace = newSpaceKeys.some(otherKey =>
            (projectKeyWorkItemMapRef.current[otherKey] || []).some(item => item.value === wItem.value)
          );
          if (!usedInOtherSpace) removedSpaceWorkItemValues.add(wItem.value);
        });
      });
      setWorkItemOptions(prev => prev.filter(opt => !removedSpaceWorkItemValues.has(opt.value)));

      // 第六步：从空间与工作项的映射中移除被删除的空间数据
      removedSpaceKeys.forEach(spaceKey => {
        delete projectKeyWorkItemMapRef.current[spaceKey];
      });
    };

    const applySpaceChange = async (targetSpaceKeys) => {
      addExtraRef.current = [];
      filterRegistrationRef.current = [];
      setEditData([]);
      setUpdateEditData([]);
      setTableDataSource([]);
      setWorkInstanceDataSource({});
      // 无选中空间时：仅清空数据，不触发查询
      const effectiveKeys = targetSpaceKeys !== undefined ? targetSpaceKeys : selectedSpaceKeys;
      if (isSpaceMode) {
        setTableAddDataSource([]);
        clearSpaceModeWorkItemSelection(effectiveKeys);
        setWorkInstancePagination(prev => ({ ...prev, pageNum: 1 }));
        return;
      }
      if (!effectiveKeys?.length) {
        setInvoke(false);
        setWorkInstancePagination(prev => ({ ...prev, pageNum: 1 }));
        return;
      }
      setInvoke(true);
      if (workInstancePagination.pageNum !== 1) {
        setWorkInstancePagination(prev => ({ ...prev, pageNum: 1 }));
      } else {
        getSelectWorkInstanceTable();
      }
    };

    const isHasContent = checkWorkInstanceDataSource();
    if (removedSpaceKeys.length > 0) {
      // 删除空间
      if (isHasContent) {
        // 有登记工时：弹出二次确认框
        //if (document.querySelector('.ant-modal-confirm')) return;
        modalLockRef.current = true;
        setIsModalVisible(true);
        Modal.confirm({
          title: localStorage.getItem('meegoTeamworkAppMode') === 'space'
            ? "确认切换空间"
            : "确认修改",
          icon: <ExclamationCircleFilled />,
          content: localStorage.getItem('meegoTeamworkAppMode') === 'space'
            ? "切换空间后，当前已登记的工时和工作描述等所有数据将被删除，且无法保留。请确认是否继续切换空间。"
            : "修改后，之前填写的工时及工作描述会保留到匹配到的登记对象中；若刷新后没有对应的登记对象，相关数据将被删除。",
          closeIcon: <CloseOutlined />,
          okText: "确定",
          cancelText: "取消",
          async onOk() {
            localHourCache.current = [];
            localHourCache.current = extractAllWorkHours(workInstanceDataSource?.entities || []);

            removeSpaceWorkItems();
            setSelectedSpaceKeys(newSpaceKeys);
            if (newSpaceKeys.length > 0) {
              sessionStorage.setItem('adminCurrentProjectKey', newSpaceKeys[0]);
            }
            modalLockRef.current = false;
            setIsModalVisible(false);
            await applySpaceChange(newSpaceKeys);
          },
          onCancel() {
            // 取消：保持不变
            modalLockRef.current = false;
            setIsModalVisible(false);
          },
          afterClose: () => {
            modalLockRef.current = false;
            setIsModalVisible(false);
          },
        });
        return;
      }
      // 无登记工时：直接删除
      removeSpaceWorkItems();
      setSelectedSpaceKeys(newSpaceKeys);
      if (newSpaceKeys.length > 0) {
        sessionStorage.setItem('adminCurrentProjectKey', newSpaceKeys[0]);
      }
      await applySpaceChange(newSpaceKeys);
      return;
    }

    // 添加空间（非删除）
    if (isHasContent) {
      //if (document.querySelector('.ant-modal-confirm')) return;
      modalLockRef.current = true;
      setIsModalVisible(true);
      // 记录弹窗前的选中空间，用于取消时还原
      const prevSpaceKeys = [...selectedSpaceKeys];
      // 先更新选中空间，弹窗期间即可看到新增的空间
      setSelectedSpaceKeys(newSpaceKeys);
      // if (newSpaceKeys.length > 0) {
      //   sessionStorage.setItem('adminCurrentProjectKey', newSpaceKeys[0]);
      // }
      Modal.confirm({
        title: "确认修改",
        icon: <ExclamationCircleFilled />,
        content: "修改后，之前填写的工时及工作描述会保留到匹配到的登记对象中；若刷新后没有对应的登记对象，相关数据将被删除。",
        closeIcon: <CloseOutlined />,
        okText: "确定",
        cancelText: "取消",
        async onOk() {
          localHourCache.current = [];
          localHourCache.current = extractAllWorkHours(workInstanceDataSource?.entities || []);
          //await querySaveWorkHour(-1);
          modalLockRef.current = false;
          setIsModalVisible(false);
          await applySpaceChange(newSpaceKeys);
        },
        onCancel() {
          // 取消：还原弹窗前的选中空间状态
          modalLockRef.current = false;
          setIsModalVisible(false);
          setSelectedSpaceKeys(prevSpaceKeys);
          // if (prevSpaceKeys.length > 0) {
          //   sessionStorage.setItem('adminCurrentProjectKey', prevSpaceKeys[0]);
          // }
        },
        afterClose: () => {
          modalLockRef.current = false;
          setIsModalVisible(false);
        },
      });
      // 弹窗分支提前返回，避免下方同步更新选中空间导致取消无法还原
      return;
    }
    await applySpaceChange(newSpaceKeys);
    setSelectedSpaceKeys(newSpaceKeys);
    // if (newSpaceKeys.length > 0) {
    //   sessionStorage.setItem('adminCurrentProjectKey', newSpaceKeys[0]);
    // }
  };

  /** 获取工作项类型 */
  const getWorkItemOptions = async (searchKey) => {
    const projectKeys = selectedSpaceKeys?.length > 0
      ? selectedSpaceKeys
      : [sessionStorage.getItem('adminCurrentProjectKey') || ''];
    const allOptions = [];
    const newMap = {};
    for (const projectKey of projectKeys) {
      const params = { workItemName: searchKey, projectKey };
      if (props?.openType === "again_launch") params.needDisable = true;
      const res = await getWorkItemOptionForRegister(params);
      if (res?.result && res.data) {
        newMap[projectKey] = res.data.map(item => item.value);
        if (regDisplayLogic?.defaultBatchRegisWorkItemType?.length && regDisplayLogic?.standardProduct === false) {
          const filtered = res.data.filter(item =>
            regDisplayLogic.defaultBatchRegisWorkItemType.includes(item.value)
          );
          allOptions.push(...filtered);
        } else {
          allOptions.push(...res.data);
        }
      }
    }
    const seenValues = new Set();
    const uniqueOptions = allOptions.filter(item => {
      if (seenValues.has(item.value)) return false;
      seenValues.add(item.value);
      return true;
    });
    projectKeyWorkItemMapRef.current = newMap;
    if (regDisplayLogic?.defaultBatchRegisWorkItemType?.length && regDisplayLogic?.standardProduct === false) {
      setWorkItemOptions(uniqueOptions);
      setWorkItemIds(regDisplayLogic.defaultBatchRegisWorkItemType);
      setInvoke(true);
    } else {
      setWorkItemOptions(uniqueOptions);
    }
  };

  // [注释] 缓存功能 - queryCache 函数整体注释
  /** 获取暂存内容 */
  // const queryCache = async () => {
  //   setRegisterCacheLoading(true);
  //   setTableLoading2(true);
  //   try {
  //     const res = await getRegisterCache({ type: point });
  //     let latestWorkItemIds = [];
  //     if (res?.result) {
  //       if (res?.data) {
  //         if (props?.type !== "tab") setHasMore(true);
  //         setHasCache(true);
  //         hasCacheRef.current = true;
  //         const aggregated = aggregateWorkHours(res?.data?.addWorkHours);
  //         setEditData(aggregated);
  //         editDataRef.current = aggregated;
  //         setUpdateEditData(res?.data?.addWorkHours);
  //         localHourCache.current = res?.data?.addWorkHours;
  //         if (res?.data?.queryRegistrationReq?.workItemIdsFilter?.length > 0) {
  //           const workItemEntityIdsList = res.data.queryRegistrationReq.workItemIdsFilter.map(item =>
  //             JSON.stringify({ workItemId: item.workItemId, label: item.workItemEntityName, value: item.workItemEntityId })
  //           );
  //           setWorkItemEntityIds(workItemEntityIdsList);
  //         } else {
  //           setWorkItemEntityIds([]);
  //         }
  //         setExpandLevel(res?.data?.queryRegistrationReq?.level || 1);
  //         setWorkItemIds(res?.data?.queryRegistrationReq?.workItemIds || []);
  //         beforeAddWorkItemIdsRef.current = res?.data?.queryRegistrationReq?.workItemIds || [];
  //         latestWorkItemIds = res?.data?.queryRegistrationReq?.workItemIds || [];
  //         setWorkItemIdsFilter(res?.data?.queryRegistrationReq?.workItemIdsFilter || []);
  //         beforeWorkItemIdsFilterRef.current = res?.data?.queryRegistrationReq?.workItemIdsFilter || [];
  //         const cacheEntities = JSON.parse(JSON.stringify(res?.data?.registrationObjectResponse?.entities || []));
  //         cacheEntities.forEach(item => { item.cache = true; item.refresh = 0; });
  //         setCacheWorkInstanceDataSource(cacheEntities);
  //         cacheWorkInstanceDataSourceRef.current = cacheEntities;
  //         if (cacheWorkInstanceDataSourceRef.current?.length) {
  //           setExcludeWorkItemEntityIdListCache(cacheWorkInstanceDataSourceRef.current.map(item => item.workItemEntityId));
  //         }
  //         let beginWorkDateInfo = res?.data?.queryRegistrationReq?.beginWorkDate || getWeekStartAndEnd().Monday;
  //         let endWorkDateInfo = res?.data?.queryRegistrationReq?.endWorkDate || getWeekStartAndEnd().Sunday;
  //         let dataAll = [];
  //         if (hasCacheRef.current && cacheWorkInstanceDataSourceRef.current?.length) {
  //           const cacheTableSource = JSON.parse(JSON.stringify(cacheWorkInstanceDataSourceRef.current));
  //           cacheTableSource?.forEach(item => { traverseTreeClearDate(item); traverseTreeBatch(item.children ? [item] : [item], beginWorkDateInfo, endWorkDateInfo); });
  //           dataAll.push(...cacheTableSource);
  //         }
  //         dataAll = deduplicateById(dataAll);
  //         setWorkInstanceDataSource({ ...workInstanceDataSource, entities: dataAll });
  //         doExpandLevelChange(res?.data?.queryRegistrationReq?.level || 1, dataAll, 1, 1, beginWorkDateInfo, endWorkDateInfo);
  //         setWorkInstancePagination({ pageNum: 1, pageSize: 10 });
  //         if (res?.data?.canNotRegisterLevelPromptStr) JSSDK.toast.error(`${res?.data?.canNotRegisterLevelPromptStr}`);
  //         if (res?.data?.removePromptStr) JSSDK.toast.error(`${res?.data?.removePromptStr}`);
  //         if (res?.data?.queryRegistrationReq) {
  //           setRegistrantUserKey(res.data.queryRegistrationReq.registerUserKey || '');
  //           props.getRegistrantUserKey(res.data.queryRegistrationReq.registerUserKey || '');
  //           setIsPersonInCharge(res.data.queryRegistrationReq.isPersonInCharge);
  //           setBeginWorkDate(res.data.queryRegistrationReq.beginWorkDate || getWeekStartAndEnd().Monday);
  //           setEndWorkDate(res.data.queryRegistrationReq.endWorkDate || getWeekStartAndEnd().Sunday);
  //           setBeginWorkDateCP(res.data.queryRegistrationReq.beginWorkDate || getWeekStartAndEnd().Monday);
  //           setEndWorkDateCP(res.data.queryRegistrationReq.endWorkDate || getWeekStartAndEnd().Sunday);
  //           setScheduleEnd(res.data.queryRegistrationReq.scheduleEnd || null);
  //           setScheduleStart(res.data.queryRegistrationReq.scheduleStart || null);
  //           addExtraRef.current = res.data.queryRegistrationReq.addExtra || [];
  //           filterRegistrationRef.current = res.data.queryRegistrationReq.addExtraEntities?.entities || [];
  //         }
  //         if (cacheEntities?.length > 0) { setTableLoading2(false); }
  //         else { if (workItemIds.length == 0) setTableLoading2(false); }
  //       } else {
  //         setExcludeWorkItemEntityIdListCache([]);
  //         excludeWorkItemEntityIdListCacheRef.current = [];
  //         setCacheWorkInstanceDataSource([]);
  //         cacheWorkInstanceDataSourceRef.current = [];
  //         getRegDisplayLogic();
  //         if (props?.type === "tab") { setWorkItemIds([props?.workItemId]); latestWorkItemIds = [props?.workItemId]; setWorkItemEntityId(props?.workItemEntityId); }
  //         manualSelection.current = true;
  //       }
  //       setLoading(false);
  //     } else {
  //       setExcludeWorkItemEntityIdListCache([]);
  //       excludeWorkItemEntityIdListCacheRef.current = [];
  //       setCacheWorkInstanceDataSource([]);
  //       cacheWorkInstanceDataSourceRef.current = [];
  //       getRegDisplayLogic();
  //       if (props?.type === "tab") { setWorkItemIds([props?.workItemId]); latestWorkItemIds = [props?.workItemId]; setWorkItemEntityId(props?.workItemEntityId); }
  //       manualSelection.current = true;
  //       setTableLoading2(false);
  //     }
  //     setIsInitialized(true);
  //     setLoading(false);
  //     return latestWorkItemIds;
  //   } catch (error) {
  //     setLoading(false);
  //     setTableLoading2(false);
  //     setIsModalVisible(false);
  //     setExcludeWorkItemEntityIdListCache([]);
  //     excludeWorkItemEntityIdListCacheRef.current = [];
  //     setCacheWorkInstanceDataSource([]);
  //     cacheWorkInstanceDataSourceRef.current = [];
  //     return [];
  //   } finally {
  //     setIsInitialized(true);
  //     setRegisterCacheLoading(false);
  //   }
  // };

  /** 获取暂存(保存后) */ // [注释] 缓存功能
  // const getQueryCache = async (num) => {
  //   try {
  //     const res = await getRegisterCache({ type: num });
  //     if (res?.result && res?.data) {
  //       localHourCache.current = res?.data?.addWorkHours;
  //     }
  //   } catch (error) { /* ignore */ }
  // };

  const querySaveWorkHour = async (temporary) => {
    await saveWorkHour(temporary);
    // await getQueryCache(temporary);  // [注释] 缓存功能
  };


  // ================================================================
  // 表格数据获取
  // ================================================================

  const getAgainLaunchFilterSignature = () => JSON.stringify({
    registrantUserKey,
    selectedSpaceKeys,
    workItemIds: workItemIdsRef.current,
    workItemEntityIds: workItemEntityIdsRef.current,
    workItemIdsFilter: workItemIdsFilterRef.current,
    beginWorkDate,
    endWorkDate,
    scheduleStart,
    scheduleEnd,
    isPersonInCharge,
  });

  const shouldSkipAgainLaunchInitialQuery = () => {
    if (batchMemoryRestoringRef.current) return true;
    if (props?.openType !== "again_launch" || props?.type === "tab") return false;
    if (againLaunchInitializingRef.current) return true;
    const initialSignature = againLaunchEmptyFilterRef.current.signature;
    return Boolean(initialSignature && initialSignature === getAgainLaunchFilterSignature());
  };

  const getSelectWorkInstanceTable = async (workItemEntityId) => {
    if (shouldSkipAgainLaunchInitialQuery()) return;
    if (againLaunchEmptyFilterRef.current.signature) {
      againLaunchEmptyFilterRef.current.signature = null;
    }
    const capacitySetInfo = capacitySetRef.current;
    if (typeof capacitySetInfo?.onceDown !== "number") return;
    const requestId = Date.now();
    lastRequestIdRef.current = requestId;
    setWorkDate("");
    // 从 ref 读取最新的工作项及过滤条件，避免闭包拿到旧值（如删除空间后的实时值）
    const workItemIds = workItemIdsRef.current;
    const workItemIdsFilter = workItemIdsFilterRef.current;
    if (props?.type === "tab") {
      getUserActive("TabOpenBatchRegistrationWorkingHours");
    } else if (!workItemIds?.length) {
      setTableLoading(false);
      setTableDataSource([]);
      if (tableAddDataSource?.length) {
        const workDataSource = { ...workInstanceDataSource, entities: [...tableAddDataSource] };
        workDataSource?.entities?.forEach(item => traverseTree(item));
        setWorkInstanceDataSource({ ...workDataSource });
      } else {
        setWorkInstanceDataSource({});
      }
      setHasMore(false);
      return;
    }
    beforeAddWorkItemIdsRef.current = workItemIds;
    beforeWorkItemIdsFilterRef.current = workItemIdsFilter;
    const baseData = {
      level: -1,
      pageNum: workInstancePagination.pageNum,
      pageSize: workInstancePagination.pageSize,
      scheduleStart, scheduleEnd,
      workItemIds: props.type === "tab" ? [props?.workItemId] : workItemIds,
      workItemEntityId: props.type === "tab" ? props?.workItemEntityId : workItemEntityId,
      registerUserKey: registrantUserKey,
      workItemIdsFilter,
      excludeWorkItemEntityIdList: props.type === "tab" ? [] : [], // excludeWorkItemEntityIdListCacheRef.current  // [注释] 缓存功能
    };
    if (isPersonInCharge === 0) baseData.personInCharge = registrantUserKey;
    if (props?.openType === 'again_launch') baseData.isLaunchAgain = true;

    const isSpaceMode = localStorage.getItem('meegoTeamworkAppMode') === 'space';
    let data;
    // 租户模式：数组，每个空间一个对象
    const spaceKeys = selectedSpaceKeys?.length > 0 ? selectedSpaceKeys : [''];
    data = spaceKeys.map(projectKey => {
      // 获取当前空间支持的工作项类型列表
      const spaceWorkItemIds = projectKeyWorkItemMapRef.current[projectKey] || [];
      // 过滤出当前空间支持的 workItemIds
      const filteredWorkItemIds = workItemIds
        .filter(id => id.includes(projectKey))
        .map(id => id.split('-')[1] || id);
      // 过滤出当前空间支持的 workItemIdsFilter，并转换字段值
      const filteredWorkItemIdsFilter = workItemIdsFilter
        .filter(item => item.workItemEntityId.includes(projectKey))
        .map(item => {
          // workItemEntityId 可能为 projectKey-entityId（2段）或 projectKey-workItemId-entityId（3段），取最后一段为真实实体ID
          const entityParts = item.workItemEntityId?.split('-') || [];
          // workItemId 可能为 projectKey-workItemType（2段）或纯 workItemType，取最后一段
          const workItemParts = item.workItemId?.split('-') || [];
          return {
            ...item,
            workItemEntityId: entityParts.pop() || '',
            workItemId: workItemParts.pop() || item.workItemId,
          };
        });
      // 过滤出当前空间支持的 workItemEntityId，并转换为只取下划线后部分
      let filteredWorkItemEntityId = workItemEntityId;
      //console.log("workItemEntityId", workItemEntityId,workItemIdsFilter);
      if (workItemEntityId) {
        try {
          const parsed = JSON.parse(workItemEntityId);
          if (!spaceWorkItemIds.includes(parsed.workItemId)) {
            filteredWorkItemEntityId = '';
          } else {
            // 只取下划线后面的部分
            filteredWorkItemEntityId = parsed.value?.split('-')[1] || parsed.value || '';
          }
        } catch (e) {
          filteredWorkItemEntityId = '';
        }
      }

      return {
        ...baseData,
        projectKey,
        projectName: spaceMap.current.get(projectKey)?.label || '',
        workItemIds: filteredWorkItemIds,
        workItemIdsFilter: filteredWorkItemIdsFilter,
        workItemEntityId: filteredWorkItemEntityId,
      };
    }).filter(item => item.workItemIds.length > 0);
    // 若存在 workItemIdsFilter 不为空的空间，则仅提交这些空间的数据；否则提交全部
    const hasNonEmptyFilter = data.some(item => item.workItemIdsFilter?.length > 0);
    if (hasNonEmptyFilter) {
      data = data.filter(item => item.workItemIdsFilter?.length > 0);
    }
    if(data.length === 0) return;
       const isFirstPage = workInstancePagination.pageNum === 1;
    if (isFirstPage) {
      if (!tableLoading2) setTableLoading(true);
      const tableBody = tableRef.current?.querySelector(".ant-table-body");
      tableBody?.scrollTop && setTimeout(() => { tableBody.scrollTop = 0; }, 0);
    } else {
      setLoading(true);
    }
    try {
      //const res = dataJson;
      const res = await getBatchRegisterDate(data);
      if (lastRequestIdRef.current !== requestId) return;
      if (res?.code === 200) {
        setHasMore(workItemIdsFilter?.length ? false : res.data.hasNext);
        if (props?.openType === "again_launch" && res.data.entities.length > 0 && callCountRef.current === 1) {
          callCountRef.current = 2;
          const workItemEntityIdsList = [];
          updateEditDataRef.current?.forEach(item => {
            if (item.tag !== 0) {
              const projectKey = item.projectKey || props?.batchRegVal?.projectKey || '';
              const workItemValue = `${projectKey}-${item.workItemId}`;
              const entityValue = `${projectKey}-${item.workItemId}-${item.workItemEntityId}`;
              const existsInResponse = res.data.entities.find(entity =>
                entity.workItemEntityId === item.workItemEntityId &&
                (!projectKey || entity.projectKey === projectKey)
              );
              const existsInList = workItemEntityIdsList.some(entry => JSON.parse(entry).value === entityValue);
              if (existsInResponse && !existsInList) {
                workItemEntityIdsList.push(JSON.stringify({
                  workItemId: workItemValue,
                  label: `${existsInResponse.workItemEntityName}`,
                  value: entityValue,
                  projectKey,
                  customFieldValue: existsInResponse.customFieldValue,
                }));
              } else if (!existsInResponse && !existsInList) {
                workItemEntityIdsList.push(JSON.stringify({
                  workItemId: workItemValue,
                  label: item.workItemEntityName,
                  value: entityValue,
                  projectKey,
                  customFieldValue: item.customFieldValue,
                }));
              }
            }
          });
          try {
            const transformedData = workItemEntityIdsList.map(item => {
              const parsed = JSON.parse(item);
              return {
                workItemEntityId: parsed.value,
                workItemEntityName: parsed.label,
                workItemId: parsed.workItemId,
                customFieldValue: parsed.customFieldValue,
              };
            });
            beforeWorkItemIdsFilterRef.current = transformedData;
            workItemIdsFilterRef.current = transformedData;
            setWorkItemEntityIds(workItemEntityIdsList);
            setSearchWorkItemEntityIds(workItemEntityIdsList);
            setWorkItemIdsFilter(transformedData);
          } catch (error) { /* console.log("error====", error); */ }
        }
        const trdata = JSON.parse(JSON.stringify(res.data.entities));
        let updatedTree = trdata;
        updatedTree.forEach(item => {
          item.id = item.workItemEntityId;
          if (item?.pattern === "State") item.children = null;
          //if (item?.pattern === "Node") item.children = [];
        });
        // 构建登记对象标识集合
        const dengjiMap = new Map();
        const buildDengjiMap = (nodes) => {
          if (!nodes || nodes.length === 0) return;
          nodes.forEach(item => {
            const workItemKey = `${item.workItemId}-${item.workItemEntityId}`;
            dengjiMap.set(`WORKITEM-${workItemKey}`, true);
            if (item.children && item.children.length > 0) {
              item.children.forEach(child => {
                const nodeKey = `${workItemKey}-${child.nodeId}`;
                dengjiMap.set(`NODE-${nodeKey}`, true);
                if (child.children && child.children.length > 0) {
                  child.children.forEach(child2 => {
                    dengjiMap.set(`TASK-${nodeKey}-${child2.taskId}`, true);
                  });
                }
              });
            }
          });
        };
        buildDengjiMap(updatedTree);
        // [注释] 缓存功能 - 过滤缓存的工时数据
        // if (localHourCache.current?.length && updatedTree?.length) {
        //   localHourCache.current = localHourCache.current.filter(item => {
        //     const { recordType, workItemId, workItemEntityId, nodeId, taskId } = item;
        //     let key;
        //     if (recordType === 'WORKITEM') key = `WORKITEM-${workItemId}-${workItemEntityId}`;
        //     else if (recordType === 'NODE') key = `NODE-${workItemId}-${workItemEntityId}-${nodeId}`;
        //     else if (recordType === 'TASK') key = `TASK-${workItemId}-${workItemEntityId}-${nodeId}-${taskId}`;
        //     return key && dengjiMap.has(key);
        //   });
        // }
        if (workInstancePagination.pageNum === 1) {
          setTableDataSource([...JSON.parse(JSON.stringify(updatedTree))]);
          // const cacheArr = cacheWorkInstanceDataSourceRef.current;  // [注释] 缓存功能
          const cacheArr = [];
          let workDataSource = {};
          if (props?.type === "tab") {
            workDataSource = { ...res.data, entities: [...tableAddDataSource, ...updatedTree] };
          } else {
            // [注释] 缓存功能 - cacheArr始终为空，走非缓存分支
            // if (cacheArr?.length) {
            //   const dataSource = JSON.parse(JSON.stringify(res.data));
            //   dataSource?.entities?.forEach(item => traverseTree(item));
            //   workDataSource = {
            //     ...res.data,
            //     entities: [
            //       ...(Array.isArray(workInstanceDataSource?.entities) ? workInstanceDataSource.entities : []),
            //       ...(Array.isArray(dataSource?.entities) ? dataSource.entities : []),
            //     ],
            //   };
            //   setTableDataSource([
            //     ...(tableDataSource || []),
            //     ...(JSON.parse(JSON.stringify(res.data.entities)) || []),
            //   ]);
            // } else {
            workDataSource = { ...res.data, entities: [...tableAddDataSource, ...updatedTree] };
            // }
          }
          // if (cacheArr?.length === 0) {  // [注释] 缓存功能 - cacheArr始终为空，直接执行
            workDataSource?.entities?.forEach(item => traverseTree(item));
          // }
          workDataSource.entities = deduplicateById(workDataSource.entities);
          if (props?.openType === "again_launch" && editData?.length) {
            editData?.forEach(item => {
              workDataSource.entities = handleWorkItemEntityNodeAndTask(
                dayjs(item?.workDate).format("YYYY-MM-DD"), workDataSource.entities
              );
            });
            setEditData([]);
          }
          if (props.type != 'tab') {
            // [注释] 展开层级功能
            // if (props.openType === "again_launch" && againNum.current === 1) {
            //   doExpandLevelChange(expandLevel, workDataSource.entities, 1);
            //   againNum.current++;
            // } else if (hasCacheRef.current) {
            //   doExpandLevelChange(expandLevel, workDataSource.entities, 1, 1);
            // } else {
            //   doExpandLevelChange(expandLevel, workDataSource.entities);
            // }
          }
          setWorkInstanceDataSource({ ...workDataSource });
        } else {
          setTableDataSource([...tableDataSource, ...JSON.parse(JSON.stringify(res.data.entities))]);
          const dataSource = JSON.parse(JSON.stringify(res.data));
          dataSource?.entities?.forEach(item => traverseTree(item));
          const workDataSource = {
            ...res.data,
            entities: [...workInstanceDataSource?.entities, ...dataSource.entities],
          };
          workDataSource.entities = deduplicateById(workDataSource.entities);
          if (res.data.entities?.length) {
            // doExpandLevelChange(expandLevel, workDataSource.entities, '', 1);  // [注释] 展开层级功能
          }
          setWorkInstanceDataSource({ ...workDataSource });
        }
        setWorkInstancePagination({ ...workInstancePagination, pageNum: res.data.pageNum });
      }
    } finally {
      setTableLoading2(false);
      if (lastRequestIdRef.current === requestId) {
        setLoading(false);
        setTableLoading(false);
      }
    }
  };

  /** 获取实例下的节点和任务 */
  const getEntityNodeTaskTable = async (data, record) => {
    setTableLoading(true);
    //data = { ...data, scheduleStart, scheduleEnd };
    if (props?.openType === "again_launch") data.isLaunchAgain = true;
    // if (addExtraRef.current?.length > 0) data.addExtra = addExtraRef.current;
    // if (filterRegistrationRef.current?.length > 0) data.addExtraEntities = { entities: filterRegistrationRef.current };
    // let registerTaskIds = [], registerNodeIds = [];
    // if (isPersonInCharge === 0) data.personInCharge = registrantUserKey;
    // [注释] 缓存功能 - record?.cache 始终为 false
    // if (record?.cache) {
    //   data.workItemId = record.workItemId;
    //   data.workItemEntityId = record.workItemEntityId;
    //   data.isCache = true;
    //   const addWorkHoursData = editDataRef.current;
    //   if (addWorkHoursData?.length > 0) {
    //     addWorkHoursData.forEach(item => {
    //       if (item.workItemEntityId == record.workItemEntityId) {
    //         if (item.nodeId && !registerNodeIds.includes(item.nodeId)) registerNodeIds.push(item.nodeId);
    //         if (item.taskId && !registerTaskIds.includes(item.taskId)) registerTaskIds.push(item.taskId);
    //       }
    //     });
    //   }
    //   data.registerTaskIds = registerTaskIds;
    //   data.registerNodeIds = registerNodeIds;
    // }
    const res = await postBatchGetEntityNodeOption(data);
    if (res?.result) {
      // 保留 canRegister=false 的节点/任务显示，但标记 disabled 且清空 children，禁止展开与登记
      const processNodesForTable = (nodes) => {
        return (nodes || []).map(item => {
          const node = { ...item };
          if (node.canRegister === false) {
            node.disabled = true;
            node.children = null;
          } else if (Array.isArray(node.children)) {
            node.children = processNodesForTable(node.children);
          }
          return node;
        });
      };
      const nodeList = processNodesForTable(Array.isArray(res.data) ? res.data : (res?.data?.registrationLevelVoList || []));
      workInstanceDataSource?.entities?.forEach(entity => {
        if (entity.workItemEntityId === data.workItemEntityId && entity.workItemId === data.workItemId) {
          nodeList.forEach(node => {
            node.workItemEntityId = data.workItemEntityId;
            node.workItemId = data.workItemId;
            traverseTree(node);
          });
          entity.children = nodeList;
        }
      });
      setWorkInstanceDataSource({ ...JSON.parse(JSON.stringify(workInstanceDataSource)) });
    }
    setTableLoading(false);
  };

  /** 获取节点下的任务 */
  const getNodeTaskTable = async (data) => {
    const res = await postEntityNodeTaskSchedule(data);
    if (res?.result) {
      workInstanceDataSource?.entities?.forEach(entity => {
        if (entity.workItemEntityId === data.workItemEntityId && entity.workItemId === data.workItemId) {
          entity.children?.forEach(node => {
            if (node.nodeId === data.nodeId) {
              if (res?.data?.length) {
                res.data.forEach(task => {
                  task = { ...task, ...data };
                  traverseTree(task);
                  task.children = null;
                  node.children = [...node.children, task];
                });
              } else {
                node.children = null;
              }
            }
          });
        }
      });
      setWorkInstanceDataSource({ ...workInstanceDataSource });
    }
  };

  // ================================================================
  // 保存工时
  // ================================================================

  const saveWorkHour = async (temporary) => {
    setSaveHourLoadings(true);
    try {
      let pointVal = '';
      if (temporary) { pointVal = -1; }
      else if (props.type === "tab") { pointVal = props?.workItemEntityId; }
      const data = {
        point: pointVal,
        queryRegistrationReq: {
          level: -1, // expandLevel,  // [注释] 展开层级功能
          isLaunchAgain: false,
          pageNum: workInstancePagination.pageNum, pageSize: workInstancePagination.pageSize,
          scheduleStart, scheduleEnd,
          beginWorkDate: beginWorkDateCP, endWorkDate: endWorkDateCP,
          isPersonInCharge, personInCharge: isPersonInCharge == 0 ? registrantUserKey : null,
          workItemIds, registerUserKey: registrantUserKey, workItemIdsFilter,
        },
      };
      if (tableAddDataSourceRef.current?.length > 0 || addExtraRef.current?.length > 0) {
        let addExtra = [];
        tableAddDataSourceRef.current.forEach(item => addExtra.push(item.workItemEntityId));
        const mergedAddExtra = [...new Set([...addExtra, ...addExtraRef.current])];
        data.queryRegistrationReq.addExtra = mergedAddExtra;
        data.queryRegistrationReq.addExtraEntities = { entities: filterRegistrationRef.current };
      }
      const rangeDates = getDatesInRange(beginWorkDate, endWorkDate);
      const addWorkHourRequests = [];
      rangeDates?.forEach((date, dateIndex) => {
        addWorkHourRequests[dateIndex] = { workDate: date.date, staffUserKey: registrantUserKey, addEntities: [] };
        workInstanceDataSource?.entities?.forEach(item => {
          if (item[date.date]?.actWorkHour) {
            const entity = {
              workItemId: item.workItemId, workItemEntityId: item.workItemEntityId,
              actWorkHour: item[date.date].actWorkHour, workDesc: item[date.date].workDesc,
              workItemName: item.workItemName, workItemEntityName: item.workItemEntityName,
              scheduleStart: item.scheduleStart, scheduleEnd: item.scheduleEnd,
              estimatedWorkingHoursAll: item.estimatedWorkingHoursAll, estimatedWorkingHoursSelf: item.estimatedWorkingHoursSelf,
            };
            if (item.workItemEntityName.includes("[已删除]")) {
              entity.workItemEntityName = item.workItemEntityName.replace('[已删除]', '');
              entity.tag = 0;
            }
            const addNodes = [];
            item?.children?.forEach(node => {
              if (node[date.date]?.actWorkHour) {
                const nodeItem = {
                  nodeId: node.nodeId, nodeName: node.nodeName,
                  actWorkHour: node[date.date]?.actWorkHour, workDesc: node[date.date]?.workDesc,
                  scheduleStart: node.scheduleStart, scheduleEnd: node.scheduleEnd,
                  estimatedWorkingHoursAll: node.estimatedWorkingHoursAll, estimatedWorkingHoursSelf: node.estimatedWorkingHoursSelf,
                };
                if (item.workItemEntityName.includes("[已删除]")) nodeItem.tag = 0;
                if (node.nodeName.includes("[已删除]")) nodeItem.tag = 0;
                nodeItem.nodeName = node.nodeName.replace('[已删除]', '');
                const addTasks = [];
                node?.children?.forEach(task => {
                  if (task[date.date]?.actWorkHour) {
                    const taskItem = {
                      taskId: task.taskId, taskName: task.taskName,
                      actWorkHour: task[date.date]?.actWorkHour, workDesc: task[date.date]?.workDesc,
                      scheduleStart: task.scheduleStart, scheduleEnd: task.scheduleEnd,
                      estimatedWorkingHoursAll: task.estimatedWorkingHoursAll, estimatedWorkingHoursSelf: task.estimatedWorkingHoursSelf,
                    };
                    if (node.nodeName.includes("[已删除]")) taskItem.tag = 0;
                    if (task.taskName.includes("[已删除]")) taskItem.tag = 0;
                    taskItem.taskName = task.taskName.replace('[已删除]', '');
                    addTasks.push(taskItem);
                  }
                });
                nodeItem.addTasks = addTasks;
                addNodes.push(nodeItem);
              }
            });
            entity.addNodes = addNodes;
            addWorkHourRequests[dateIndex].addEntities.push(entity);
          }
        });
      });
      data.registrationData = addWorkHourRequests.filter(item => item.addEntities.length > 0);
      data.registrationObjects = {
        pageNum: 1, pageSize: 10, total: 1, hasNext: true,
        entities: transformWorkHourData(workInstanceDataSource.entities),
      };
      // [注释] 缓存功能 - saveRegisterCache 已注释
      // const res = await saveRegisterCache(data);
      // if (!res?.result) {
      //   if (res?.data?.code && ![10024, 10025, 10026].includes(res.data.code)) {
      //     JSSDK.toast.error(res?.msg || '保存失败');
      //   }
      // }
      if (props?.openType === 'tab') {
        props.setSubmitLoadings(false);
      } else {
        props.setSaveHourLoadings(false);
        setSaveHourLoadings(false);
        // if (!res?.data?.code || ![10024, 10025, 10026].includes(res.data.code)) {  // [注释] 缓存功能
          if (pointVal !== -1) props.submitResult(1);
        // }
      }
    } catch (e) { /* console.log('e', e); */ }
  };

  // ================================================================
  // 批量提交
  // ================================================================

  const buildFilterMemory = () => {
    const queryRegistrationReq = (selectedSpaceKeys || []).map((projectKey) => {
      const workItemIdsForProject = workItemIds
        .filter((value) => String(value).includes(projectKey))
        .map((value) => {
          const normalizedWorkItemId = String(value).split('-')[1] || value;
          const option = workItemOptions.find((item) => item.value === value);

          return {
            projectKey,
            workItemId: normalizedWorkItemId,
            workItemName: option?.label || normalizedWorkItemId,
          };
        });
      const workItemIdsFilterForProject = workItemIdsFilter
        .filter((item) => String(item.workItemEntityId || '').includes(projectKey))
        .map((item) => {
          const workItemEntityIdParts = String(item.workItemEntityId).split('-');
          const workItemIdParts = String(item.workItemId).split('-');

          return {
            projectKey,
            workItemId: workItemIdParts[1] || item.workItemId,
            workItemEntityId: workItemEntityIdParts[workItemEntityIdParts.length - 1],
            workItemEntityName: item.workItemEntityName,
          };
        });

      return {
        projectKey,
        projectKeyName: spaceMap.current.get(projectKey)?.label || projectKey,
        workItemIds: workItemIdsForProject,
        workItemIdsFilter: workItemIdsFilterForProject,
      };
    });

    return {
      scheduleStart,
      scheduleEnd,
      beginWorkDate: beginWorkDateCP,
      endWorkDate: endWorkDateCP,
      isPersonInCharge,
      point:'batch',
      workDateType,    // 0-自定义，1-今天，2-本周，3-上周，4-上个月
      staffUserKey: registrantUserKey,
      queryRegistrationReq,
    };
  };

  const validateAttendanceSubmission = (rangeDates) => {
    for (const { date } of rangeDates || []) {
      const submitHours = (workInstanceDataSource?.entities || []).reduce(
        (total, item) => total.plus(item?.[date]?.actWorkHour || 0),
        new Decimal(0),
      );
      if (submitHours.isZero()) continue;

      const capacitySnapshot = getDateCapacitySnapshot(date) || getAttendanceSnapshot(date);
      if (normalizeAttendanceNumber(capacitySnapshot?.attendanceEnabled) !== 1) continue;

      const attendanceHours = normalizeAttendanceNumber(capacitySnapshot?.attendanceHours);
      const missPunchPolicy = normalizeAttendanceNumber(capacitySnapshot?.missPunchPolicy) ?? 1;
      if ((attendanceHours === null || attendanceHours <= 0) && missPunchPolicy === 1) {
        JSSDK.toast.error(`${date}当天无考勤记录，不可登记工时`);
        return false;
      }

      const upperLimit = getAttendanceUpperLimit({
        enabled: capacitySnapshot.attendanceEnabled,
        hours: attendanceHours,
        policy: missPunchPolicy,
        customLimit: capacitySnapshot.missPunchCustomLimit,
        dayUp: capacitySnapshot.dayUp || capacitySet?.dayUp,
      });
      const remainingWork = normalizeAttendanceNumber(capacitySnapshot?.remainingWork);
      if (submitHours.greaterThan(upperLimit)
        || (remainingWork !== null && submitHours.greaterThan(remainingWork))) {
        JSSDK.toast.error(`${date}当天登记工时超过可登记工时上限`);
        return false;
      }
    }
    return true;
  };

  const onBatchSubmit = async () => {
    if (!workInstanceDataSource?.entities?.length) {
      JSSDK.toast.warning("登记内容不能为空");
      props.setSubmitLoadings(false);
      return;
    }
    const rangeDates = getDatesInRange(beginWorkDate, endWorkDate);
    if (!validateAttendanceSubmission(rangeDates)) {
      props.setSubmitLoadings(false);
      return;
    }
    // 获取所有不重复的 projectKey，按空间维度分组

    const projectKeys = [...new Set(
      (workInstanceDataSource?.entities || []).map(item => item.projectKey).filter(Boolean)
    )];
    // 多空间数据格式：每个空间一个数组，每个数组包含该空间所有日期的数据
    const submitData = [];
    projectKeys.forEach(projectKey => {
      const spaceEntities = workInstanceDataSource.entities.filter(e => e.projectKey === projectKey);
      const spaceName = spaceEntities[0]?.projectName || spaceMap.current.get(projectKey)?.label || '';
      const spaceData = [];
      rangeDates?.forEach(date => {
        const dayData = {
          workDate: date.date,
          staffUserKey: registrantUserKey,
          addEntities: [],
          projectName: spaceName,
          projectKey
        };
        spaceEntities.forEach(item => {
          if (item[date.date]?.actWorkHour) {
            const entity = {
              customFieldValue: item.customFieldValue,
              projectName: item.projectName,
              projectKey: item.projectKey,
              workItemId: item.workItemId, workItemEntityId: item.workItemEntityId,
              actWorkHour: item[date.date].actWorkHour, workDesc: item[date.date].workDesc,
              workItemName: item.workItemName, workItemEntityName: item.workItemEntityName,
              scheduleStart: item.scheduleStart, scheduleEnd: item.scheduleEnd,
              estimatedWorkingHoursAll: item.estimatedWorkingHoursAll, estimatedWorkingHoursSelf: item.estimatedWorkingHoursSelf,
              workItemType: item.workItemType,
            };
            if (item.workItemEntityName.includes("[已删除]")) {
              entity.workItemEntityName = item.workItemEntityName.replace('[已删除]', '');
              entity.tag = 0;
            }
            const addNodes = [];
            item?.children?.forEach(node => {
              if (node[date.date]?.actWorkHour) {
                const nodeItem = {
                  nodeId: node.nodeId, nodeName: node.nodeName,
                  actWorkHour: node[date.date]?.actWorkHour, workDesc: node[date.date]?.workDesc,
                  scheduleStart: node.scheduleStart, scheduleEnd: node.scheduleEnd,
                  estimatedWorkingHoursAll: node.estimatedWorkingHoursAll, estimatedWorkingHoursSelf: node.estimatedWorkingHoursSelf,
                };
                if (item.workItemEntityName.includes("[已删除]")) nodeItem.tag = 0;
                if (node.nodeName.includes("[已删除]")) nodeItem.tag = 0;
                nodeItem.nodeName = node.nodeName.replace('[已删除]', '');
                const addTasks = [];
                node?.children?.forEach(task => {
                  if (task[date.date]?.actWorkHour) {
                    const taskItem = {
                      taskId: task.taskId, taskName: task.taskName,
                      actWorkHour: task[date.date]?.actWorkHour, workDesc: task[date.date]?.workDesc,
                      scheduleStart: task.scheduleStart, scheduleEnd: task.scheduleEnd,
                      estimatedWorkingHoursAll: task.estimatedWorkingHoursAll, estimatedWorkingHoursSelf: task.estimatedWorkingHoursSelf,
                    };
                    if (node.nodeName.includes("[已删除]")) taskItem.tag = 0;
                    if (task.taskName.includes("[已删除]")) taskItem.tag = 0;
                    taskItem.taskName = task.taskName.replace('[已删除]', '');
                    addTasks.push(taskItem);
                  }
                });
                nodeItem.addTasks = addTasks;
                addNodes.push(nodeItem);
              }
            });
            entity.addNodes = addNodes;
            dayData.addEntities.push(entity);
          }
        });
        if (dayData.addEntities.length > 0) {
          spaceData.push(dayData);
        }
      });
      if (spaceData.length > 0) {
        submitData.push(spaceData);
      }
    });
    if (!submitData?.length || submitData.every(arr => arr.length === 0)) {
      JSSDK.toast.warning("登记内容不能为空");
      props.setSubmitLoadings(false);
      return;
    }
    let res = {};
    if (props?.openType === "again_launch") {
          let againLaunchData = [];
          submitData.forEach(spaceData => {
            againLaunchData.push({
              collectId: props?.batchRegVal?.id,
              addWorkHourBatchReqs:spaceData,
            });
          });
      res = await postBatchApprovalAgain(againLaunchData);
    } else {
      const registrationData = { registerData: submitData };
      if (props.filterMemoryEnabled === true) {
        registrationData.momery = buildFilterMemory();
      }
      res = await postBatchRegisterSaveData(registrationData);
    }
    if (res?.result) {
      // localHourCache.current = [];  // [注释] 缓存功能
      // clearRegisterCache({ point: point });  // [注释] 缓存功能
      setWorkDate(""); setTableDataSource([]); setWorkInstanceDataSource({});
      setAlertDetail({}); setAlertDetailOld({});
      props.submitResult(2);
      // cacheWorkInstanceDataSourceRef.current = [];  // [注释] 缓存功能
      // setCacheWorkInstanceDataSource([]);  // [注释] 缓存功能
      // setExcludeWorkItemEntityIdListCache([]);  // [注释] 缓存功能
      // excludeWorkItemEntityIdListCacheRef.current = [];  // [注释] 缓存功能
      // setHasCache(false);  // [注释] 缓存功能
      if (props?.type === "tab") {
        getUserActive("TabActBatchRegistrationWorkingHours");
        getSelectWorkInstanceTable(props?.workItemEntityId);
      } else {
        getUserActive("PageActBatchRegistrationWorkingHours");
      }
    }
    props.setSubmitLoadings(false);
  };

  // ================================================================
  // 事件处理器
  // ================================================================

  const goTableTop = () => {
    const tableContainer = document.querySelector('.ant-table-body');
    if (tableContainer) tableContainer.scrollTop = 0;
  };

  /** 查看是否有填报内容 */
  const checkWorkInstanceDataSource = () => {
    let isHasContent = false;
    const latestDataSource = workInstanceDataSourceRef.current;
    // console.log('latestDataSource8888', latestDataSource);
    if (latestDataSource?.entities?.length) {
      const rangeDates = getDatesInRange(beginWorkDate, endWorkDate);
      for (const date of rangeDates) {
        for (const item of latestDataSource.entities) {
          if (item[date.date]?.actWorkHour) {
            isHasContent = true;
            break;
          }
        }
        if (isHasContent) break;
      }
    }
    if (props?.setSubmitDisabled) props?.setSubmitDisabled(!isHasContent);
    return isHasContent;
  };

  /** 根据起止日期推导工作日期快捷类型：0-自定义，1-今天，2-本周，3-上周，4-上个月 */
  const resolveWorkDateType = (begin, end) => {
    if (!begin || !end) return 0;
    const today = dayjs(new Date()).format("YYYY-MM-DD");
    if (begin === today && end === today) return 1;
    const week = getWeekStartAndEnd();
    if (begin === week.Monday && end === week.Sunday) return 2;
    const lastWeek = getLastWeekRange();
    if (begin === lastWeek.Monday && end === lastWeek.Sunday) return 3;
    const lastMonth = getLastMonthRange();
    if (begin === lastMonth.start && end === lastMonth.end) return 4;
    return 0;
  };

  const isWorkDateRangeWithinThreeMonths = (begin, end) => {
    if (!begin || !end) return false;
    const beginDay = dayjs(begin, "YYYY-MM-DD", true);
    const endDay = dayjs(end, "YYYY-MM-DD", true);
    if (!beginDay.isValid() || !endDay.isValid()) return false;
    return !endDay.isAfter(beginDay.add(3, "month"), "day");
  };

  const disabledWorkDate = (current, info) => {
    if (!current) return false;
    const minDate = minWorkDate ? dayjs(minWorkDate) : null;
    const maxDate = maxWorkDate ? dayjs(maxWorkDate) : null;
    if (minDate && current.isBefore(minDate, "day")) return true;
    if (maxDate && current.isAfter(maxDate, "day")) return true;

    const fromDate = info?.from;
    if (fromDate) {
      const rangeLimit = fromDate.add(3, "month");
      if (current.isBefore(fromDate, "day")) return true;
      if (current.isAfter(rangeLimit, "day")) return true;
    }

    return false;
  };

  /** 工作日期变更 */
  const onWorkDateChange = (dates, dateStrings) => {
    manualSelection.current = true;
    const nextBeginDate = dateStrings?.[0];
    const nextEndDate = dateStrings?.[1];
    if (nextBeginDate && nextEndDate && !isWorkDateRangeWithinThreeMonths(nextBeginDate, nextEndDate)) {
      JSSDK.toast.warning("填报工作日期范围不能超过3个月");
      return;
    }
    const isHasContent = checkWorkInstanceDataSource();
    // setHasCache(false);  // [注释] 缓存功能
    if (modalLockRef.current || isModalVisible) return;
    // if (isHasContent && document.querySelector('.ant-modal-confirm')) return;
    if (isHasContent) {
      modalLockRef.current = true;
      setIsModalVisible(true);
      Modal.confirm({
        title: "确认修改",
        icon: <ExclamationCircleFilled />,
        content: "修改后，之前填写的工时及工作描述会保留到匹配到的登记对象中；若刷新后没有对应的登记对象，相关数据将被删除。",
        closeIcon: <CloseOutlined />,
        okText: "确定",
        cancelText: "取消",
        async onOk() {
          localHourCache.current = [];
          localHourCache.current = extractAllWorkHours(workInstanceDataSource?.entities || []);
          //await querySaveWorkHour(-1);
          setInvoke(true);
          goTableTop();
          // setExcludeWorkItemEntityIdListCache([]);  // [注释] 缓存功能
          // excludeWorkItemEntityIdListCacheRef.current = [];  // [注释] 缓存功能
          // cacheWorkInstanceDataSourceRef.current = [];  // [注释] 缓存功能
          if (!workItemIds.length) {
            if (workInstanceDataSource?.entities?.length) {
              const registerData2 = transformWorkHourData(workInstanceDataSource.entities);
              setTableDataSource([...JSON.parse(JSON.stringify(registerData2))]);
            }
          }
          setEditData([]);
          setWorkInstanceDataSource({});
          // setExpandedRowKeys([]);  // [注释] 展开层级功能
          setBeginWorkDate(nextBeginDate ? nextBeginDate : null);
          setEndWorkDate(nextEndDate ? nextEndDate : null);
          setBeginWorkDateCP(nextBeginDate ? nextBeginDate : null);
          setEndWorkDateCP(nextEndDate ? nextEndDate : null);
          setWorkDateType(resolveWorkDateType(nextBeginDate, nextEndDate));
          setWorkInstancePagination((prev) => ({ ...prev, pageNum: 1 }));
          modalLockRef.current = false;
          setIsModalVisible(false);
        },
        onCancel() {},
        afterClose: () => {
          modalLockRef.current = false;
          setIsModalVisible(false);
        },
      });
      return;
    }
    setInvoke(true);
    localHourCache.current = [];  // [注释] 缓存功能
    goTableTop();
    // setExpandedRowKeys([]);  // [注释] 展开层级功能
    // setExcludeWorkItemEntityIdListCache([]);  // [注释] 缓存功能
    // excludeWorkItemEntityIdListCacheRef.current = [];  // [注释] 缓存功能
    // cacheWorkInstanceDataSourceRef.current = [];  // [注释] 缓存功能
    setBeginWorkDate(nextBeginDate ? nextBeginDate : null);
    setEndWorkDate(nextEndDate ? nextEndDate : null);
    setBeginWorkDateCP(nextBeginDate ? nextBeginDate : null);
    setEndWorkDateCP(nextEndDate ? nextEndDate : null);
    setWorkDateType(resolveWorkDateType(nextBeginDate, nextEndDate));
    if (!workItemIds.length) {
      if (workInstanceDataSource?.entities?.length) {
        const registerData = transformWorkHourData(workInstanceDataSource.entities);
        setTableDataSource([...JSON.parse(JSON.stringify(registerData))]);
      }
    }
    setWorkInstancePagination((prev) => ({ ...prev, pageNum: 1 }));
  };

  /** 时间工作日筛选按钮处理 */
  const onWorkDateBtnChange = (e) => {
    manualSelection.current = true;
    const isHasContent = checkWorkInstanceDataSource();
    // setHasCache(false);  // [注释] 缓存功能
    if (isHasContent) {
      Modal.confirm({
        title: "确认修改",
        icon: <ExclamationCircleFilled />,
        content: "修改后，之前填写的工时及工作描述会保留到匹配到的登记对象中；若刷新后没有对应的登记对象，相关数据将被删除。",
        closeIcon: <CloseOutlined />,
        okText: "确定",
        cancelText: "取消",
        async onOk() {
          localHourCache.current = [];
          localHourCache.current = extractAllWorkHours(workInstanceDataSource?.entities || []);
          //await querySaveWorkHour(-1);
          setInvoke(true);
          goTableTop();
          if (!workItemIds.length) {
            if (workInstanceDataSource?.entities?.length) {
              const registerData2 = transformWorkHourData(workInstanceDataSource.entities);
              setTableDataSource([...JSON.parse(JSON.stringify(registerData2))]);
            }
          }
          // setExcludeWorkItemEntityIdListCache([]);  // [注释] 缓存功能
          // excludeWorkItemEntityIdListCacheRef.current = [];  // [注释] 缓存功能
          // cacheWorkInstanceDataSourceRef.current = [];  // [注释] 缓存功能
          setEditData([]);
          // setExpandedRowKeys([]);  // [注释] 展开层级功能
          setWorkInstanceDataSource({});
          const workDateArr = e.target.value?.split("~");
          setBeginWorkDate(workDateArr[0]);
          setEndWorkDate(workDateArr[1]);
          setBeginWorkDateCP(workDateArr[0]);
          setEndWorkDateCP(workDateArr[1]);
          setWorkDateType(resolveWorkDateType(workDateArr[0], workDateArr[1]));
          setWorkInstancePagination((prev) => ({ ...prev, pageNum: 1 }));
        },
        onCancel() {},
      });
      return;
    }
    setInvoke(true);
    editDataRef.current = [];
    localHourCache.current = [];  // [注释] 缓存功能
    goTableTop();
    // setExpandedRowKeys([]);  // [注释] 展开层级功能
    // setExcludeWorkItemEntityIdListCache([]);  // [注释] 缓存功能
    // excludeWorkItemEntityIdListCacheRef.current = [];  // [注释] 缓存功能
    // cacheWorkInstanceDataSourceRef.current = [];  // [注释] 缓存功能
    const workDateArr = e.target.value?.split("~");
    setBeginWorkDate(workDateArr[0]);
    setEndWorkDate(workDateArr[1]);
    setBeginWorkDateCP(workDateArr[0]);
    setEndWorkDateCP(workDateArr[1]);
    setWorkDateType(resolveWorkDateType(workDateArr[0], workDateArr[1]));
    if (!workItemIds.length) {
      if (workInstanceDataSource?.entities?.length) {
        const registerData = transformWorkHourData(workInstanceDataSource.entities);
        setTableDataSource([...JSON.parse(JSON.stringify(registerData))]);
      }
    }
    setWorkInstancePagination((prev) => ({ ...prev, pageNum: 1 }));
  };

  // ================================================================
  // 工作项变更处理
  // ================================================================

  const onWorkItemChange = useCallback(
    debounce(() => {
      // console.log("onWorkItemChange",isWorkItemChanged);
      // console.log(workItemIds);
      if (!isWorkItemChanged) return;
      setIsWorkItemChanged(false);
      // console.log('workItemIds', modalLockRef.current, isModalVisible);
      if (modalLockRef.current || isModalVisible) return;
      const isHasContent = checkWorkInstanceDataSource();
      // console.log('isHasContent888', isHasContent);
      setPreviousWorkItemIds([...workItemIds]);
      setPreviousWorkItemEntityIds([...workItemEntityIds]);
      setPreviousWorkItemIdsFilter([...workItemIdsFilter]);
      if (isHasContent) {
        // console.log('workInstanceDataSourceRef.current', workInstanceDataSourceRef.current);
        // console.log('isHasContent', document.querySelector('.ant-modal-confirm'));
        // if (document.querySelector('.ant-modal-confirm')) return;
        modalLockRef.current = true;
        setIsModalVisible(true);
        Modal.confirm({
          title: "确认修改",
          icon: <ExclamationCircleFilled />,
          content: "修改后，之前填写的工时及工作描述会保留到匹配到的登记对象中；若刷新后没有对应的登记对象，相关数据将被删除。",
          closeIcon: <CloseOutlined />,
          okText: "确定",
          cancelText: "取消",
          async onOk() {
            localHourCache.current = [];
            localHourCache.current = extractAllWorkHours(workInstanceDataSource?.entities || []);
            //await querySaveWorkHour(-1);
            setInvoke(true);
            modalLockRef.current = false;
            setIsModalVisible(false);
            addExtraRef.current = [];
            filterRegistrationRef.current = [];
            // setCacheWorkInstanceDataSource([]);  // [注释] 缓存功能
            // setExcludeWorkItemEntityIdListCache([]);  // [注释] 缓存功能
            // excludeWorkItemEntityIdListCacheRef.current = [];  // [注释] 缓存功能
            setEditData([]);
            setUpdateEditData([]);
            if (props?.openType === "again_launch") {
              let filteredUpdateEditData = updateEditDataRef.current.filter(record => workItemIds.includes(record.workItemId));
              const validEntityIds = new Set();
              workItemEntityIdsRef.current.forEach(item => {
                try {
                  const parsed = typeof item === 'string' ? JSON.parse(item) : item;
                  validEntityIds.add(parsed.value);
                } catch (error) { console.error("解析 workItemEntityIds 失败:", error); }
              });
              filteredUpdateEditData = filteredUpdateEditData.filter(item => validEntityIds.has(item.workItemEntityId));
              setUpdateEditData(filteredUpdateEditData);
            }
            setSearchWorkItemIds(workItemIds);
            setSearchWorkItemEntityIds(workItemEntityIds);
            // setExpandedRowKeys([]);  // [注释] 展开层级功能
            setTableDataSource([]);
            setWorkInstanceDataSource({});
            if (workInstancePagination.pageNum !== 1) {
              setWorkInstancePagination((prev) => ({ ...prev, pageNum: 1 }));
            } else {
              getSelectWorkInstanceTable();
            }
            beforeAddWorkItemIdsRef.current = [];
          },
          onCancel() {
            modalLockRef.current = false;
            setIsModalVisible(false);
            if (beforeAddWorkItemIdsRef.current.length > 0) {
              setWorkItemIds(beforeAddWorkItemIdsRef.current);
              setSearchWorkItemIds(beforeAddWorkItemIdsRef.current);
              const originalData = beforeWorkItemIdsFilterRef.current;
              const transformedData = originalData.map(item =>
                JSON.stringify({
                  workItemId: item.workItemId,
                  label: item.workItemEntityName,
                  value: item.workItemEntityId,
                  customFieldValue: item.customFieldValue,
                })
              );
              setWorkItemEntityIds(transformedData);
            } else {
              const originalData = beforeWorkItemIdsFilterRef.current;
              const transformedData = originalData.map(item =>
                JSON.stringify({
                  workItemId: item.workItemId,
                  label: item.workItemEntityName,
                  value: item.workItemEntityId,
                  customFieldValue: item.customFieldValue,
                })
              );
              setWorkItemEntityIds(transformedData);
              setWorkItemIds(previousWorkItemIds);
              setWorkItemEntityIds(previousWorkItemEntityIds);
              setWorkItemIdsFilter(previousWorkItemIdsFilter);
              setSearchWorkItemIds(previousWorkItemIds);
              setSearchWorkItemEntityIds(previousWorkItemEntityIds);
            }
          },
          afterClose: () => {
            modalLockRef.current = false;
            setIsModalVisible(false);
          },
        });
        return;
      }
      setInvoke(true);
      editDataRef.current = [];
      localHourCache.current = [];  // [注释] 缓存功能
      addExtraRef.current = [];
      filterRegistrationRef.current = [];
      // setExpandedRowKeys([]);  // [注释] 展开层级功能
      setTableDataSource([]);
      setWorkInstanceDataSource({});
      setSearchWorkItemIds(workItemIds);
      setSearchWorkItemEntityIds(workItemEntityIds);
      if (workInstancePagination.pageNum !== 1) {
        setWorkInstancePagination((prev) => ({ ...prev, pageNum: 1 }));
      } else {
        getSelectWorkInstanceTable();
      }
    }, 300),
    [workItemIds, workItemEntityIds, workItemIdsFilter, workInstancePagination.pageNum,
      getSelectWorkInstanceTable, isWorkItemChanged, previousWorkItemIds,
      previousWorkItemEntityIds, previousWorkItemIdsFilter, isModalVisible]
  );
  /** 手动删除工作项类型 */
  const debouncedWorkItemDeselect = useCallback(
    debounce((delVal) => {
      if (modalLockRef.current || isModalVisible) return;
      setPreviousWorkItemIds([...workItemIds]);
      setPreviousWorkItemEntityIds([...workItemEntityIds]);
      setPreviousWorkItemIdsFilter([...workItemIdsFilter]);
      setSearchWorkItemIds((prevIds) => prevIds.includes(delVal) ? prevIds : [...prevIds, delVal]);
      setWorkItemIds((prev) => prev.filter((id) => id !== delVal));
      setWorkItemIdsFilter((prevFilter) => prevFilter.filter((item) => item.workItemId !== delVal));
      setIsOnDeselect(true);
      setIsWorkItemChanged(true);
    }, 800),
    [workItemIds, workItemEntityIds, workItemIdsFilter, isModalVisible]
  );

  /** 手动删除工作项实例 */
  const debouncedWorkItemEntityDeselect = useCallback(
    debounce((delVal) => {
      if (modalLockRef.current || isModalVisible) return;
      setPreviousWorkItemIds([...workItemIds]);
      setPreviousWorkItemEntityIds([...workItemEntityIds]);
      setPreviousWorkItemIdsFilter([...workItemIdsFilter]);
      setSearchWorkItemEntityIds((prev) => prev.includes(delVal) ? prev : [...prev, delVal]);
      try {
        const parsedDelVal = JSON.parse(delVal);
        setWorkItemIdsFilter((prevFilter) =>
          prevFilter.filter((item) => item.workItemEntityId + item.workItemId !== parsedDelVal.value + parsedDelVal.workItemId)
        );
      } catch (error) { console.error("解析 delVal 失败:", error); }
      // console.log('IsWorkItemChanged',isWorkItemChanged);
      setIsOnDeselect(true);
      setIsWorkItemChanged(true);
    }, 800),
    [workItemIds, workItemEntityIds, workItemIdsFilter]
  );

  /** 点击图标清空填报内容 */
  const clearRegisterWorkingHours = () => {
    const isHasContent = checkWorkInstanceDataSource();
    if (isHasContent) {
      Modal.confirm({
        title: "确认重置",
        icon: <ExclamationCircleFilled />,
        content: "重置将清除所有已填写内容，是否继续?",
        closeIcon: <CloseOutlined />,
        okText: "确定",
        cancelText: "取消",
        async onOk() {
          const clearedData = clearAllWorkHours(workInstanceDataSourceRef.current?.entities);
          setWorkInstanceDataSource({ ...workInstanceDataSource, entities: clearedData });
          // setExcludeWorkItemEntityIdListCache([]);  // [注释] 缓存功能
          // excludeWorkItemEntityIdListCacheRef.current = [];  // [注释] 缓存功能
        },
        onCancel() {},
      });
    } else {
      Modal.confirm({
        title: "提示",
        content: "无工时数据，无法执行重置操作",
        closeIcon: <CloseOutlined />,
        cancelButtonProps: { style: { display: 'none' } },
        async onOk() {},
        onCancel() {},
      });
    }
  };

  /** 项目排期筛选变更 */
  const onScheduleChange = debounce((date, dateString) => {
    const isHasContent = checkWorkInstanceDataSource();
    if (isHasContent) {
      Modal.confirm({
        title: "确认修改",
        icon: <ExclamationCircleFilled />,
        content: "修改后，之前填写的工时及工作描述会保留到匹配到的登记对象中；若刷新后没有对应的登记对象，相关数据将被删除。",
        closeIcon: <CloseOutlined />,
        okText: "确定",
        cancelText: "取消",
        async onOk() {
          localHourCache.current = [];
          localHourCache.current = extractAllWorkHours(workInstanceDataSource?.entities || []);
          //await querySaveWorkHour(-1);
          setInvoke(true);
          addExtraRef.current = [];
          filterRegistrationRef.current = [];
          // cacheWorkInstanceDataSourceRef.current = [];  // [注释] 缓存功能
          // setCacheWorkInstanceDataSource([]);  // [注释] 缓存功能
          // setExcludeWorkItemEntityIdListCache([]);  // [注释] 缓存功能
          // excludeWorkItemEntityIdListCacheRef.current = [];  // [注释] 缓存功能
          setEditData([]);
          // setExpandedRowKeys([]);  // [注释] 展开层级功能
          setScheduleStart(dateString[0] ? dateString[0] : null);
          setScheduleEnd(dateString[1] ? dateString[1] : null);
          setTableDataSource([]);
          setWorkInstanceDataSource({});
        },
        onCancel() {},
      });
      return;
    }
    setInvoke(true);
    localHourCache.current = [];  // [注释] 缓存功能
    addExtraRef.current = [];
    filterRegistrationRef.current = [];
    // cacheWorkInstanceDataSourceRef.current = [];  // [注释] 缓存功能
    // setCacheWorkInstanceDataSource([]);  // [注释] 缓存功能
    // setExcludeWorkItemEntityIdListCache([]);  // [注释] 缓存功能
    // excludeWorkItemEntityIdListCacheRef.current = [];  // [注释] 缓存功能
    // setExpandedRowKeys([]);  // [注释] 展开层级功能
    setScheduleStart(dateString[0] ? dateString[0] : null);
    setScheduleEnd(dateString[1] ? dateString[1] : null);
    setTableDataSource([]);
    setWorkInstanceDataSource({});
  }, 800);

  /** 选择被登记人 */
  const onSearchPersonChange = async (val) => {
    const isHasContent = checkWorkInstanceDataSource();
    if (isHasContent) {
      Modal.confirm({
        title: "确认修改",
        icon: <ExclamationCircleFilled />,
        content: "修改后，已登记的工时及其工作描述将被清空。",
        closeIcon: <CloseOutlined />,
        okText: "确定",
        cancelText: "取消",
        async onOk() {
          await doSwitchPerson(val);
        },
        onCancel() {
          // 取消：强制 UserPicker 重新挂载以还原到弹窗前的成员状态
          setUserPickerKey((k) => k + 1);
        },
      });
      return;
    }
    await doSwitchPerson(val);
  };

  /** 执行被登记人切换（含已登记工时校验分支） */
  const doSwitchPerson = async (val) => {
    setInvoke(true);
    // setHasCache(false);  // [注释] 缓存功能
    localHourCache.current = [];  // [注释] 缓存功能
    addExtraRef.current = [];
    filterRegistrationRef.current = [];
    // setCacheWorkInstanceDataSource([]);  // [注释] 缓存功能
    // setExcludeWorkItemEntityIdListCache([]);  // [注释] 缓存功能
    // cacheWorkInstanceDataSourceRef.current = [];  // [注释] 缓存功能
    // excludeWorkItemEntityIdListCacheRef.current = [];  // [注释] 缓存功能
    setEditData([]);
    // setExpandedRowKeys([]);  // [注释] 展开层级功能
    setTableDataSource([]);
    setWorkInstanceDataSource({});
    const targetUserKey = val || loginUser?.userKey;
    if (val) {
      setRegistrantUserKey(val);
      props.getRegistrantUserKey(val);
    } else {
      setRegistrantUserKey(loginUser?.userKey);
      props.getRegistrantUserKey(loginUser?.userKey);
      setPickerUser({ userKey: loginUser?.userKey, nameCn: loginUser?.nameCn, avatarUrl: loginUser?.avatarUrl });
    }
    // 新增分支：校验切换后的成员是否存在已登记工时
    // const hasRegistered = await checkUserHasRegisteredWorkHour(targetUserKey);
    // // 无任何已登记工时时，清空空间、工作项、工作项实例及表格数据
    // if (!hasRegistered) clearRegisterSelections();
    // 切换成员后重新拉取该成员对应的空间列表
    clearRegisterSelections()
    fetchSpaceOptionsList(targetUserKey);

  };

  /** 清空空间、工作项、工作项实例及表格数据 */
  const clearRegisterSelections = () => {
    setWorkDate("");
    setSelectedSpaceKeys([]);
    setWorkItemOptions([]);
    projectKeyWorkItemMapRef.current = {};
    setWorkItemIds([]);
    setWorkItemIdsFilter([]);
    setWorkItemEntityIds([]);
    setSearchWorkItemIds([]);
    setSearchWorkItemEntityIds([]);
    setTableDataSource([]);
    setWorkInstanceDataSource({});
  };

  /** 填报处理 */
  const onRefreshTableClick = (record, _workInstanceDataSource) => {
    try {
      setCurRecord({});
      const preservedFlags = {};
      const collectFlags = (node) => {
        if (node?.id) {
          preservedFlags[node.id] = {};
          getDatesInRange(beginWorkDate, endWorkDate).forEach(({ date }) => {
            if (node[date]?.flag !== undefined) preservedFlags[node.id][date] = node[date].flag;
          });
        }
        node?.children?.forEach(collectFlags);
      };
      _workInstanceDataSource?.entities?.forEach(collectFlags);
      const traverseLocal = (node) => {
        if (node.id === record?.id) {
          for (const key in node) {
            if (key === record?.date) {
              node[key] = record[key];
              if (record[key]?.actWorkHour === null) node[key].flag = 0;
            } else {
              if (node[key]?.isRegFormOpen) node[key] = { ...node[key], isRegFormOpen: false };
            }
          }
        } else {
          for (const key in node) {
            if (node[key]?.isRegFormOpen) node[key].isRegFormOpen = false;
          }
        }
        if (node?.children?.length > 0) node.children.forEach((child) => traverseLocal(child));
      };
      _workInstanceDataSource?.entities?.forEach((item) => traverseLocal(item));
      _workInstanceDataSource.entities = handleWorkItemEntityNodeAndTask(record?.date, _workInstanceDataSource.entities);
      const restoreFlags = (node) => {
        const nodeFlags = preservedFlags[node?.id];
        if (nodeFlags) {
          Object.entries(nodeFlags).forEach(([date, flag]) => {
            if (date !== record?.date && node[date]) node[date].flag = flag;
          });
        }
        node?.children?.forEach(restoreFlags);
      };
      _workInstanceDataSource.entities.forEach(restoreFlags);
      setWorkInstanceDataSource(_workInstanceDataSource);
    } catch (error) {
      // console.log("error", error);
    }
  };

  /** 展开 */
  const onExpand = (expanded, record) => {
    // [注释] 展开层级功能 - expandedRowKeys
    // if (expanded) {
    //   expandedRowKeys.push(record?.id);
    // } else {
    //   const index = expandedRowKeys.indexOf(record?.id);
    //   if (index > -1) expandedRowKeys.splice(index, 1);
    // }
    // setExpandedRowKeys([...expandedRowKeys]);
    // [注释] 缓存功能 - record?.cache 始终为 false
    // if (record?.cache && expanded && record?.refresh === 0) {
    //   record.refresh = 1;
    //   getEntityNodeTaskTable({
    //     nodeId: record.nodeId, workItemEntityId: record.workItemEntityId,
    //     workItemId: record.workItemId, registerUserKey: registrantUserKey,
    //   }, record);
    //   return;
    // }
    if (!record?.nodeId && !record?.taskId && expanded && !record?.isAdd && !record?.children?.length) {
      //postBatchGetEntityNodeOption
      getEntityNodeTaskTable({
        projectKey: record.projectKey,
        workItemEntityId: record.workItemEntityId,
        workItemId: record.workItemId
      });
    }
  };

  /** 新增实例联动节点/任务 */
  const onAddWorkItemValuesChange = (values) => {
    if (values?.workItemEntityId) {
      const data = JSON.parse(values.workItemEntityId);
      const workItemEntityId = data.value?.split('-').pop() || data.value;
      getEntityNodeOption({ workItemId: data.workItemId, workItemEntityId, projectKey: data.projectKey});
    }
  };

  /** 新增实例 */
  const onAddWorkItemFinish = async (values) => {
    setIsAddWorkItemLoading(true);
    const workItem = JSON.parse(values.workItemEntityId);
    const nodeIds = [];
    let submitData = []
    values?.workItemInstanceIds?.forEach((item) => {
      if (item.length === 1) {
        if (!JSON.stringify(nodeIds).includes(item[0])) nodeIds.push({ nodeId: item[0], taskIds: [] });
      } else if (item.length === 2) {
        if (!JSON.stringify(nodeIds).includes(item[0])) {
          nodeIds.push({ nodeId: item[0], taskIds: [item[1]] });
        } else {
          nodeIds.forEach((i) => { if (i.nodeId === item[0]) i.taskIds.push(item[1]); });
        }
      }
    });
    setTableLoading(true);
    const data = {
      workItemIds: [workItem.workItemId],
      workItemEntityId: workItem.value?.split('-').pop() || workItem.value,
      nodeIds, registerUserKey: registrantUserKey,
      projectKey: workItem.projectKey
    };
    submitData.push(data);
    if (props?.openType === 'again_launch') data.isLaunchAgain = true;
    const res = await getBatchRegisterDate(submitData);
    if (res?.result) {
      const selectedProjectKey = workItem.projectKey || data.projectKey || '';
      const getSpaceName = (projectKey) => (
        spaceMap.current.get(projectKey)?.label
        || spaceOptions.find((option) => String(option.value) === String(projectKey))?.label
        || ''
      );
      if (Array.isArray(res?.data?.entities)) {
        res.data.entities = res.data.entities.map((item) => {
          const projectKey = item.projectKey || selectedProjectKey;
          return {
            ...item,
            projectKey,
            projectName: item.projectName || getSpaceName(projectKey),
          };
        });
      }
      const leftBottomAddworkItemIds = { workItemIds: workItem.workItemId, workItemEntityId: workItem.value, nodeIds };
      if (addExtraRef.current.length > 0) {
        if (!addExtraRef.current.includes(data.workItemEntityId)) addExtraRef.current.push(data.workItemEntityId);
      } else {
        addExtraRef.current.push(data.workItemEntityId);
      }
      if (res?.data?.entities?.length) {
        const isExists = filterRegistrationRef.current.some(
          item => item.workItemEntityId === leftBottomAddworkItemIds.workItemEntityId && item.workItemId === leftBottomAddworkItemIds.workItemIds
        );
        if (!isExists) {
          const entitiesData = JSON.parse(JSON.stringify(res.data.entities));
          const matchedItems = findMatchingItems(entitiesData, leftBottomAddworkItemIds);
          filterRegistrationRef.current.push(...matchedItems);
        }
      }
      res.data.entities.forEach((item) => { item.isAdd = true; });
      setTableAddDataSource([...(tableAddDataSource || []), ...res.data.entities]);
      const dataSource = JSON.parse(JSON.stringify(res.data));
      dataSource.entities.forEach((item) => traverseTree(item));
      const entities = [...(workInstanceDataSource?.entities || []), ...dataSource.entities];
      const seen = new Map();
      const uniqueEntities = entities.filter((item) => !seen.has(item.id) && seen.set(item.id, true));
      // handleExpandLevelChange(expandLevel, uniqueEntities, '', 1);  // [注释] 展开层级功能
      setWorkInstanceDataSource({ ...workInstanceDataSource, entities: uniqueEntities });
      setIsAddWorkItemOpen(false);
      setNodeTaskOptions([]);
    }
    setIsAddWorkItemLoading(false);
    setTableLoading(false);
  };

  /** 处理层级选择 */ // [注释] 展开层级功能 - 整个函数注释
  // const handleExpandLevelSelect = async (level) => {
  //   if (level == expandLevel) { setExpandPopoverVisible(false); return; }
  //   if (level == 1) { setExpandedRowKeys([]); setExpandPopoverVisible(false); setExpandLevel(level); return; }
  //   let registerList = workInstanceDataSourceRef.current?.entities || [];
  //   if (registerList?.length) {
  //     const hasTaskData = false;
  //     if (!hasTaskData) {
  //       let workItemsList = [];
  //       registerList.forEach((i) => {
  //         if (props.type == 'tab') {
  //           workItemsList.push({ workItemId: i.workItemId, workItemEntityId: i.workItemEntityId, workItemEntityName: i.workItemEntityName, workItemType: i.newPattern });
  //         } else {
  //           if (i.pattern == 'Node' || i.newPattern == 'Node') {
  //             workItemsList.push({ workItemId: i.workItemId, workItemEntityId: i.workItemEntityId, workItemEntityName: i.workItemEntityName, workItemType: i.pattern || i.newPattern });
  //           }
  //         }
  //       });
  //       if (workItemsList.length == 0) { setTableLoading(false); setExpandPopoverVisible(false); setExpandLevel(level); return; }
  //       const data = {
  //         registerUserKey: registrantUserKey, scheduleEnd, scheduleStart, workItems: workItemsList,
  //       };
  //       if (isPersonInCharge === 0) data.personInCharge = registrantUserKey;
  //       if (addExtraRef.current?.length) data.addExtra = addExtraRef.current;
  //       if (filterRegistrationRef.current?.length) data.addExtraEntities = { entities: filterRegistrationRef.current };
  //       setTableLoading(true);
  //       const res = await queryExpandLevelNode(data);
  //       if (res?.result) {
  //         const registerDataSource = JSON.parse(JSON.stringify(workInstanceDataSource?.entities));
  //         let mergedArr = mergeWorkItemTrees(registerDataSource, res.data);
  //         mergedArr = deduplicateTreeArray(mergedArr);
  //         setWorkInstanceDataSource({ ...workInstanceDataSource, entities: mergedArr });
  //         handleExpandLevelChange(level, mergedArr);
  //       }
  //       setTableLoading(false);
  //     } else {
  //       handleExpandLevelChange(level, registerList);
  //     }
  //   }
  //   setExpandPopoverVisible(false);
  //   setExpandLevel(level);
  // };

  const fetchOptions = (params) => {
    const requestId = Date.now();
    lastOptionsRequestIdRef.current = requestId;

    if (!params?.workItemEntityName || lastOptionsRequestIdRef.current !== requestId) {
      return { data: { data: [], total: 0 } };
    }

    // 按空间维度分组 workItemIds，构建多空间数组格式
    const spaceKeys = selectedSpaceKeys?.length > 0
      ? selectedSpaceKeys
      : [sessionStorage.getItem('adminCurrentProjectKey') || ''];
    const dataArray = [];
    const isFirstPage = (params.pageNum || 1) === 1;
    // 首页请求时重置各空间 hasMore 状态
    if (isFirstPage) spaceHasMoreRef.current = {};
    spaceKeys.forEach(projectKey => {
      // 获取当前空间支持的工作项类型列表
      const spaceWorkItemIds = projectKeyWorkItemMapRef.current[projectKey] || [];
      // 过滤出当前空间支持的 workItemIds，并去掉 projectKey 前缀（如 68f72d1e2fb0c70c95d311e3-story → story）
      const filteredWorkItemIds = (params.workItemIds || [])
        .filter(id => id.startsWith(`${projectKey}-`) || spaceWorkItemIds.includes(id.split('-')[1] || id))
        .map(id => id.split('-')[1] || id);
      // 翻页时跳过已无更多数据的空间（hasMore 明确为 false）
      if (!isFirstPage && spaceHasMoreRef.current[projectKey] === false) return;
      if (filteredWorkItemIds.length > 0) {
        dataArray.push({
          pageNum: params.pageNum || 1,
          pageSize: params.pageSize || 20,
          workItemEntityName: params.workItemEntityName || '',
          workItemIds: filteredWorkItemIds,
          registerUserKey: registrantUserKey,
          projectKey,
        });
      }
    });
    return getBatchRegisterItemEntityOption(dataArray).then((res) => {
      // res.data 是数组，每个对象含 registrationLevelVoList，合并为单一数组
      if (Array.isArray(res?.data) && res.data.length > 0) {
        const merged = [];
        res.data.forEach((spaceResult, index) => {
          const list = spaceResult?.registrationLevelVoList;
          // 更新当前空间的 hasMore 状态（兼容 hasNext / hasMore 字段，projectKey 缺失时用请求顺序兜底）
          const resultProjectKey = spaceResult?.projectKey || dataArray[index]?.projectKey;
          const spaceHasMore = spaceResult?.hasNext ?? spaceResult?.hasMore ?? false;
          if (resultProjectKey) {
            spaceHasMoreRef.current[resultProjectKey] = spaceHasMore;
          }
          if (Array.isArray(list)) {
            list.forEach(item => {
              item.label = item.level || item.name;
              const itemProjectKey = item.projectKey || resultProjectKey || spaceKeys[0] || '';
              item.value = item.workItemId
                ? `${itemProjectKey}-${item.workItemId}-${item.value}`
                : `${itemProjectKey}-${item.value}`;
              item.workItemId=`${itemProjectKey}-${item.workItemId}`
              merged.push(item);
            });
          }
        });
        //const filtered = merged
        const filtered = merged.filter(item => item?.canRegister !== false);
        // 聚合判断：存在任一空间还有更多数据则可继续加载
        const hasMore = Object.values(spaceHasMoreRef.current).some(v => v === true);
        res.data = { data: filtered, total: filtered.length, hasMore };
      } else {
        // 无数据返回时，禁用加载更多
        res.data = { data: [], total: 0, hasMore: false };
      }
      return res;
    });
  };

  const fetchOptions2 = (params) => {
    const requestId = Date.now();
    lastOptionsRequestIdRef.current = requestId;
    params.registerUserKey= registrantUserKey;
    if (!params?.workItemEntityName || lastOptionsRequestIdRef.current !== requestId) return { data: { data: [], total: 0 } };
    return postBatchAddGetItemEntityOptionForBatch(params).then((res) => {
      // res.data 是数组，每个对象含 registrationLevelVoList，合并为单一数组
      if (Array.isArray(res?.data) && res.data.length > 0) {
        const merged = [];
        res.data.forEach((spaceResult, index) => {
          const list = spaceResult?.registrationLevelVoList;
          const resultProjectKey = spaceResult?.projectKey || params.projectKeys?.[index] || '';
          if (Array.isArray(list)) {
            list.forEach(item => {
              item.label = item.level || item.name;
              const itemProjectKey = item.projectKey || resultProjectKey;
              item.projectKey = itemProjectKey;
              item.value = item.workItemId
                ? `${itemProjectKey}-${item.workItemId}-${item.value}`
                : `${itemProjectKey}-${item.value}`;
              merged.push(item);
            });
          }
        });
        const filtered = merged
        //const filtered = merged.filter(item => item?.canRegister !== false);
        // 聚合判断：存在任一空间还有更多数据则可继续加载
        const hasMore = Object.values(spaceHasMoreRef.current).some(v => v === true);
        res.data = { data: filtered, total: filtered.length, hasMore };
      } else {
        // 无数据返回时，禁用加载更多
        res.data = { data: [], total: 0, hasMore: false };
      }
      return res;
    });
  };

  const handleRefreshScroll = debounce((e) => {
    const { scrollTop } = e.target;
    if (scrollTop && props?.type !== "tab" && !tableLoading) {
      workInstanceDataSource?.entities?.forEach((item) => traverseTreeRefresh(item));
      if (workInstanceDataSource?.entities) setWorkInstanceDataSource({ ...workInstanceDataSource });
    }
  }, 300);

  const handleScroll = debounce((e) => {
    const { scrollTop, clientHeight, scrollHeight } = e.target;
    if (scrollTop === 0) return;
    if (scrollHeight - scrollTop <= clientHeight + 5 && hasMore && !loading) {
      setInvoke(true);
      setWorkInstancePagination((prev) => ({ ...prev, pageNum: prev.pageNum + 1 }));
    }
  }, 300);

  // ================================================================
  // 表头处理
  // ================================================================

  /** 处理表头展示 */
  const handleRegTableColumns = (type, isExpand) => {
    const latestTableAddDataSource = tableAddDataSourceRef.current;
    const latestTableDataSource = tableDataSourceRef.current;
    setTableLoading(true);
    if (type !== "changeColumns") setWorkInstanceDataSource({});
    if (type !== "changeColumns") setWorkDate("");
    const rangeDates = getDatesInRange(beginWorkDate, endWorkDate);
    const regCols = [
      {
        title: (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 'bold' }}>登记对象</div>
            <div>
              <DeleteOutlined title="清空" style={{ cursor: "pointer", marginRight: 10, color: '#757579' }} onClick={() => clearRegisterWorkingHours()} />
              <Popover placement="bottom" trigger="click" content={
                <TableColumnsSet columnsSet={columnsSet} setColumnsSet={(value) => { saveTableSortConfig(value); setColumnsSet(value); }} />
              }>
                <SettingOutlined style={{ color: '#757579' }} />
              </Popover>
            </div>
          </div>
        ),
        dataIndex: "workItemEntityName", key: "workItemEntityName",
        width: 180, ellipsis: true, fixed: "left",
        render: (_, record) => {
          let name = "--"; let icon = null;
          if (record?.workItemEntityName) { name = record.workItemEntityName; icon = <img src={workItemEntityIcon} className="custom-levelIcon" />; }
          else if (record?.nodeName) { name = record.nodeName; icon = <img src={nodeIcon} className="custom-levelIcon" />; }
          else if (record?.taskName) { name = record.taskName; icon = <img src={taskIcon} className="custom-levelIcon" />; }
          name = icon ? <>{icon}{name}</> : name;
          return (
            <Tooltip placement="topLeft" title={<><div>{name}</div></>}>
              <div style={{ width: "170px", overflow: "hidden", textOverflow: "ellipsis", wordBreak: "break-all", verticalAlign: "middle", cursor: "pointer" }}>{name}</div>
            </Tooltip>
          );
        },
      },
    ];
    columnsSet.forEach((colItem) => {
      switch (colItem.value) {
        case "projectName":
          regCols.push({
            title: <span style={{ fontWeight: 'bold' }}>{colItem.label}</span>,
            dataIndex: "projectName", key: "projectName",
            hidden: !columnsSet.find((c) => c.value === "projectName")?.checked,
            width: 160, ellipsis: true,
            render: (_, record) => {
              let name = "--";
              if (record?.projectName) { name = record.projectName; }
              return (
                <Tooltip placement="topLeft" title={<><div>{name}</div></>}>
                  <div style={{ width: "170px", overflow: "hidden", textOverflow: "ellipsis", wordBreak: "break-all", verticalAlign: "middle", cursor: "pointer" }}>{name}</div>
                </Tooltip>
              );
            },
        }); break;
        case "customFieldValue":
          regCols.push({
            title: <span className="custom-field-column-title" title={colItem.label}>{colItem.label}</span>,
            dataIndex: "customFieldValue",
            key: "customFieldValue",
            hidden: !columnsSet.find((item) => item.value === "customFieldValue")
              ?.checked,
            width: 120,
            ellipsis: true,
            render: (_, record) => (
              <CustomFieldValueCell value={record?.customFieldValue} />
            ),
          });
          break;
        case "scheduleDate":
          regCols.push({
            title: <span style={{ fontWeight: 'bold' }}>{colItem.label}</span>,
            dataIndex: "scheduleDate", key: "scheduleDate",
            hidden: !columnsSet.find((c) => c.value === "scheduleDate")?.checked,
            width: 220, ellipsis: true,
            render: (_, record) => {
              let sd = "--";
              if (record?.scheduleStart && record?.scheduleEnd) sd = `${record.scheduleStart}~${record.scheduleEnd}`;
              else if (record?.scheduleStart) sd = `${record.scheduleStart}~--`;
              else if (record?.scheduleEnd) sd = `--~${record.scheduleEnd}`;
              return `${sd}`;
            },
          }); break;
        case "estimatedScore":
          regCols.push({
            title: <span style={{ fontWeight: 'bold' }}>{colItem.label}</span>,
            dataIndex: "estimatedScore", key: "estimatedScore",
            hidden: !columnsSet.find((c) => c.value === "estimatedScore")?.checked,
            width: 80, ellipsis: true,
            render: (_, record) =>
              `${record?.estimatedWorkingHoursSelf ? `${record.estimatedWorkingHoursSelf}h` : "--"} / ${record?.estimatedWorkingHoursAll ? `${record.estimatedWorkingHoursAll}h` : "--"}`,
          }); break;
        case "total":
          regCols.push({
            title: <span style={{ fontWeight: 'bold' }}>{colItem.label}</span>,
            dataIndex: "total", key: "total",
            hidden: !columnsSet.find((c) => c.value === "total")?.checked,
            width: 70, ellipsis: true,
            render: (_, record) => {
              let total = new Decimal(0);
              for (const key in record) { if (typeof record[key] === "object" && record[key]?.actWorkHour) total = total.plus(record[key].actWorkHour); }
              return total.toNumber() ? total.toNumber() : null;
            },
          }); break;
        case "regDate":
          rangeDates?.map((dateItem) =>
            regCols.push({
              title: (<div style={{ textAlign: "center" }}><div>{dateItem.dayOfWeek}</div><div>{dateItem.date}</div></div>),
              dataIndex: `${dateItem.date}`, key: `${dateItem.date}`, width: 120,
              render: (_, record, index) => (
                <DateColumnPopover
                  key={`${dateItem.date}-${record.id}`}
                  record={record} item={dateItem} index={index}
                  regBatchForm={regBatchForm} curRecord={curRecord}
                  setCurRecord={setCurRecord} setWorkDate={setWorkDate}
                  dayUpFlag={dayUpFlag} workHourInputNumRef={workHourInputNumRef}
                  workDescReq={spaceMap.current.get(record.projectKey)?.describe ?? 0}
                  granularity={{
                    enabled: spaceMap.current.get(record.projectKey)?.isEnableGranularity ?? 0,
                    hour: spaceMap.current.get(record.projectKey)?.granularityHour ?? null,
                  }}
                  projectKey={record.projectKey}
                  attendanceConfig={attendanceConfigRef.current}
                  capacitySnapshot={getDateCapacitySnapshot(dateItem.date)}
                  onOpenDate={() => getAlertDetail(dateItem.date)}
                />
              ),
            })
          ); break;
        default: break;
      }
    });
    setRegTableColumns(regCols);
    if (type === "changeColumns") { setTableLoading(false); return; }
    let dataAll = [];
    // [注释] 缓存功能 - hasCacheRef.current 始终为 false，走非缓存分支
    // if (hasCacheRef.current) {
    //   if (cacheWorkInstanceDataSourceRef.current?.length) {
    //     const cacheTableSource = JSON.parse(JSON.stringify(cacheWorkInstanceDataSourceRef.current));
    //     cacheTableSource.forEach((item) => { traverseTreeClearDate(item); traverseTree(item); });
    //     dataAll.push(...cacheTableSource);
    //   }
    // } else {
      if (latestTableAddDataSource?.length) {
        const dataAddSource = JSON.parse(JSON.stringify(latestTableAddDataSource));
        dataAddSource.forEach((item) => { traverseTreeClearDate(item); traverseTree(item); });
        dataAll.push(...dataAddSource);
      }
      if (latestTableDataSource?.length) {
        const dataSource = JSON.parse(JSON.stringify(latestTableDataSource));
        dataSource.forEach((item) => { traverseTreeClearDate(item); traverseTree(item); });
        dataAll.push(...dataSource);
      }
    // }
    dataAll = deduplicateById(dataAll);
    // if (isExpand && dataAll?.length && manualSelection.current) handleExpandLevelChange(expandLevel, dataAll);  // [注释] 展开层级功能
    setWorkInstanceDataSource({ ...workInstanceDataSource, entities: dataAll });
    setTableLoading(false);
  };

  // ================================================================
  // useEffect Hooks
  // ================================================================
  useEffect(() => {
    editDataRef.current = editData;
    //console.log('editData',editData)
  }, [JSON.stringify(editData)]);
  useEffect(() => {
    countAlertDetail();
  }, [alertDetailOld, JSON.stringify(workInstanceDataSource), attendanceSnapshotMap, workDate]);
 useEffect(() => {
   // console.log('workInstanceDataSource', workInstanceDataSource);
    workInstanceDataSourceRef.current = workInstanceDataSource;
    const newWorkInstanceDataSource = JSON.parse(JSON.stringify(workInstanceDataSource));
    const rangeDates = getDatesInRange(beginWorkDate, endWorkDate);
    // 遍历日期范围，为每个日期调用setWorkHourFlags函数
    rangeDates?.forEach((date) => {
      //console.log('date', alertDetailOld);
      const currentDateDetail = getDateCapacitySnapshot(date?.date)
        || (date?.date === workDate && Object.keys(alertDetailOld || {}).length > 0 ? alertDetailOld : null);
      setWorkHourFlags(newWorkInstanceDataSource, date?.date, currentDateDetail);
    });
    // 设置状态
    setWorkInstanceDataSource(newWorkInstanceDataSource);
    //console.log('newWorkInstanceDataSource',newWorkInstanceDataSource)
    //console.log('最新newWorkInstanceDataSource',workInstanceDataSourceRef.current)
  }, [JSON.stringify(workInstanceDataSource), workHoursTotalDetail, workDate, alertDetailOld]);
  useEffect(() => {
    getRole();
    getTableSortConfig()
  }, []);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      lastRequestIdRef.current = null;
      attendanceRequestIdRef.current += 1;
      saturationRequestIdRef.current += 1;
      workHoursTotalRequestIdRef.current += 1;
    };
  }, []);
  useEffect(() => {
    if (props?.openType === "again_launch") {
      if (againLaunchInitializedRef.current) return;
      againLaunchInitializedRef.current = true;
      initializeAgainLaunch().catch(error => {
        console.error('初始化再次发起数据失败:', error);
        againLaunchInitializingRef.current = false;
        againLaunchEmptyFilterRef.current = { pending: false, signature: null };
        setTableLoading2(false);
        setIsInitialized(true);
      });
      return;
    }
    let isActive = true;
    initializeBatchFilterMemory(() => isActive);
    return () => {
      isActive = false;
    };
  }, []);
  useEffect(() => { /* console.log('showAllResponsibleOptions', showAllResponsibleOptions); */ }, [showAllResponsibleOptions]);
  // 空间模式下选中空间后拉取该空间的标准工时配置
  useEffect(() => {
    if (
      localStorage.getItem('meegoTeamworkAppMode') === 'space' &&
      selectedSpaceKeys?.length > 0 &&
      !batchMemoryRestoringRef.current
    ) {
      getUserStandWorkHourData(selectedSpaceKeys[0]);
    }
    if (selectedSpaceKeys?.length > 0) {
      const selectSpace = [];
      selectedSpaceKeys.forEach(spaceKey => {
        if (spaceMap.current.has(spaceKey)) selectSpace.push(spaceMap.current.get(spaceKey).isAllManager);
      });
      // 全部空间 isAllManager 均为 false 时禁用"全部责任人"，否则启用
      setShowAllResponsibleOptions(selectSpace.every(space => space === false) ? 1 : 0);
    } else {
      setShowAllResponsibleOptions(0);
    }
    // 通知父组件当前选中的空间数据对象
    const selectedSpaceObj = spaceOptions.find(opt => opt.value === selectedSpaceKeys?.[0]);
    props.onSpaceKeyChange?.(selectedSpaceObj || null);
  }, [JSON.stringify(selectedSpaceKeys)]);
  useEffect(() => { if (showAllResponsibleOptions == 1) setIsPersonInCharge(0); }, [showAllResponsibleOptions, isPersonInCharge]);
  // useEffect(() => { if (selectedSpaceKeys.length > 0) getWorkItemOptions(); }, [regDisplayLogic, selectedSpaceKeys]);
  useEffect(() => {
    if (!registrantUserKey || !beginWorkDate || !endWorkDate) return;
    const context = getAttendanceContext(beginWorkDate, endWorkDate, registrantUserKey, selectedSpaceKeys);
    if (context.isSpaceMode && !context.projectKey) return;
    getAttendanceConfigInfo(context);
  }, [registrantUserKey, JSON.stringify(selectedSpaceKeys), beginWorkDate, endWorkDate]);

  useEffect(() => {
    if (workDate) {
      applyAttendanceSnapshot(workDate);
      setAlertDetail({});
      setAlertDetailOld({});
    }
  }, [workDate, attendanceSnapshotMap]);

  useEffect(() => {
    if (!workDate || !workHoursTotalDetail?.[workDate]) return;
    setAlertDetailOld({ ...workHoursTotalDetail[workDate] });
  }, [workDate, workHoursTotalDetail]);

  useEffect(() => {
    if (attendanceContextRef.current) handleRegTableColumns("changeColumns");
  }, [attendanceSnapshotMap]);

  useEffect(() => {
    const emptyFilterState = againLaunchEmptyFilterRef.current;
    if (
      props?.openType === "again_launch" &&
      isInitialized &&
      emptyFilterState.pending
    ) {
      emptyFilterState.signature = getAgainLaunchFilterSignature();
      emptyFilterState.pending = false;
    }
  }, [isInitialized]);

  useEffect(() => {
    if (typeof capacitySet?.onceDown !== "number") return;
    if (!invoke || shouldSkipAgainLaunchInitialQuery()) return;
    switch (props.type) {
      case "tab": getSelectWorkInstanceTable(props?.workItemEntityId); break;
      default: getSelectWorkInstanceTable(); break;
    }
  }, [isPersonInCharge, capacitySet, workInstancePagination.pageNum, workInstancePagination.pageSize, isInitialized, invoke]);

  useEffect(() => {
    // console.log("capacitySet=======", capacitySet);
    if (typeof capacitySet?.onceDown !== "number") return;
    capacitySetRef.current = capacitySet;
    handleRegTableColumns();
  }, [capacitySet]);

  useEffect(() => {
    if (!invoke || shouldSkipAgainLaunchInitialQuery()) return;
    const timer = setTimeout(() => {
      if (workInstancePagination.pageNum === 1) getSelectWorkInstanceTable();
      else setWorkInstancePagination((prev) => ({ ...prev, pageNum: 1 }));
    }, 50);
    return () => clearTimeout(timer);
  }, [scheduleStart, scheduleEnd, isInitialized]);

  // useEffect(() => {
  //   if (!invoke) return;
  //   const timer = setTimeout(() => {
  //     if (workInstancePagination.pageNum === 1) getSelectWorkInstanceTable();
  //     else setWorkInstancePagination((prev) => ({ ...prev, pageNum: 1 }));
  //   }, 50);
  //   return () => clearTimeout(timer);
  // }, [registrantUserKey, isInitialized]);

  useEffect(() => {
    if (!workInstanceDataSource?.entities) return;
    if (props?.type === "tab") checkWorkInstanceDataSource();
    if (props?.type !== "tab" && !workItemIds?.length && !tableAddDataSource?.length) {
      setTableLoading(false); setTableDataSource([]); setHasMore(false);
    } else {
      const tableBody = tableRef.current?.querySelector(".ant-table-body");
      if (tableBody && !hasCache) {  // hasCache 已注释，始终为 falsy
        tableBody.addEventListener("scroll", handleRefreshScroll);
        return () => { if (tableBody) tableBody.removeEventListener("scroll", handleRefreshScroll); };
      }
    }
  }, [JSON.stringify(workInstanceDataSource)]);

  useEffect(() => { handleRegTableColumns("changeColumns"); }, [columnsSet]);

  useEffect(() => {
    if (beginWorkDate && endWorkDate) {
      setWorkDate(null);
      if (workInstancePagination.pageNum === 1) {
        // [注释] 缓存功能 - hasCacheRef.current 始终为 false，直接执行非缓存分支
        // if (!hasCacheRef.current) {
          (async () => {
            if (!shouldSkipAgainLaunchInitialQuery()) await getSelectWorkInstanceTable();
            handleRegTableColumns("changeColumns", 'expandFlag');
          })();
        // } else { handleRegTableColumns("changeColumns", 'expandFlag'); }
      }
      if (workInstancePagination.pageNum === 0) handleRegTableColumns("changeColumns");
      if ("standardProduct" in regDisplayLogic && !regDisplayLogic?.standardProduct) {
        setScheduleStart(beginWorkDate); setScheduleEnd(endWorkDate);
        setTableDataSource([]); setWorkInstanceDataSource({}); return;
      }
    }
  }, [beginWorkDate, endWorkDate]);

  useEffect(() => {
    const restoreState = batchMemoryQueryRef.current;
    if (
      props?.openType === "again_launch"
      || !isInitialized
      || !restoreState.pending
    ) return;

    let isActive = true;
    restoreState.pending = false;
    batchMemoryRestoringRef.current = false;

    (async () => {
      try {
        if (restoreState.shouldQuery) await getSelectWorkInstanceTable();
      } catch (error) {
        console.error('记忆恢复后的批量登记列表查询失败:', error);
      } finally {
        if (isActive) setFilterMemoryLoading(false);
      }
    })();

    return () => {
      isActive = false;
    };
  }, [isInitialized]);

  useEffect(() => {
    if (Object.keys(curRecord).length && workInstanceDataSource?.entities?.length) {
      onRefreshTableClick(curRecord, workInstanceDataSource);
    }
  }, [curRecord]);

  useEffect(() => { if (props?.submitLoadings) onBatchSubmit(); }, [props?.submitLoadings]);
  useEffect(() => { if (props?.saveHourLoadings) saveWorkHour(); }, [props?.saveHourLoadings]);
  useEffect(() => { if (isOnDeselect) { onWorkItemChange(); setIsOnDeselect(false); } }, [isOnDeselect, onWorkItemChange]);

  useEffect(() => {
    const tableBody = tableRef.current?.querySelector(".ant-table-body");
    if (tableBody) {
      tableBody.addEventListener("scroll", handleScroll);
      // 同步表格主体水平滚动位置到底部汇总栏
      const syncFooterScroll = () => {
        const summaryContent = summaryRef.current?.querySelector('.summary-content');
        if (summaryContent) {
          summaryContent.style.transform = `translateX(-${tableBody.scrollLeft}px)`;
        }
      };
      tableBody.addEventListener("scroll", syncFooterScroll);
      return () => {
        tableBody.removeEventListener("scroll", handleScroll);
        tableBody.removeEventListener("scroll", syncFooterScroll);
      };
    }
  }, [hasMore, loading]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const tableBody = tableRef.current?.querySelector(".ant-table-body");
      if (tableBody) {
        tableBody.scrollLeft = 0;
        // 列变化时重置汇总栏滚动位置
        const summaryContent = summaryRef.current?.querySelector('.summary-content');
        if (summaryContent) summaryContent.style.transform = 'translateX(0px)';
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [regTableColumns]);

  useEffect(() => { updateEditDataRef.current = updateEditData; }, [updateEditData]);
  useEffect(() => { workItemEntityIdsRef.current = workItemEntityIds; }, [JSON.stringify(workItemEntityIds)]);
  // 记录上一次的填报工作日期，用于判断租户模式下是否为日期变更触发
  const prevWorkDateRef = useRef({ beginWorkDate, endWorkDate });
  // 记录上一次的 registrantUserKey 和 selectedSpaceKeys，用于判断租户模式切换成员/空间时是否需重新请求
  const prevRegistrantRef = useRef({ registrantUserKey, selectedSpaceKeys: JSON.stringify(selectedSpaceKeys) });
  // 标记是否为组件初始化后的首次执行
  const isWorkHoursTotalFirstRunRef = useRef(true);
  // useEffect(() => {
  //   if (beginWorkDate && endWorkDate) {
  //     const isSpaceMode = localStorage.getItem('meegoTeamworkAppMode') === 'space';
  //     // 租户模式：仅当填报工作日期发生变化时才调用接口
  //     const isWorkDateChanged =
  //       prevWorkDateRef.current.beginWorkDate !== beginWorkDate ||
  //       prevWorkDateRef.current.endWorkDate !== endWorkDate;
  //     const isRegistrantChanged =
  //       prevRegistrantRef.current.registrantUserKey !== registrantUserKey ||
  //       prevRegistrantRef.current.selectedSpaceKeys !== JSON.stringify(selectedSpaceKeys);
  //     // 空间模式：依赖项变化均触发；租户模式：初始化后首次调用一次，之后仅日期变更或切换成员/空间时调用
  //     if (isSpaceMode || isWorkHoursTotalFirstRunRef.current || isWorkDateChanged || isRegistrantChanged) {
  //       queryWorkHoursTotalDetailData(beginWorkDate, endWorkDate);
  //     }
  //     isWorkHoursTotalFirstRunRef.current = false;
  //   }
  //   prevWorkDateRef.current = { beginWorkDate, endWorkDate };
  //   prevRegistrantRef.current = { registrantUserKey, selectedSpaceKeys: JSON.stringify(selectedSpaceKeys) };
  // }, [beginWorkDate, endWorkDate, registrantUserKey, selectedSpaceKeys]);
  useEffect(() => {
    const nowMode = localStorage.getItem('meegoTeamworkAppMode') === 'tenant';
    if (beginWorkDate && endWorkDate && (nowMode || selectedSpaceKeys.length > 0)) {
      queryWorkHoursTotalDetailData(beginWorkDate, endWorkDate);
    }
  }, [registrantUserKey, selectedSpaceKeys, beginWorkDate, endWorkDate]);
  // ================================================================
  // JSX Render
  // ================================================================

  return (
    <Spin spinning={tableLoading2 || filterMemoryLoading || attendanceSyncLoading}>
      <div className={`regWorkHourBatchNew-warp ${props.type === "tab" ? "" : "regWorkHourBatchNew-warp-no-tab"}`}>
        <RegWorkHourHeader
          props={props}
          loading={loading} tableLoading={tableLoading} // registerCacheLoading={registerCacheLoading}  // [注释] 缓存功能
          isAllowRegister={isAllowRegister} isPersonInCharge={isPersonInCharge}
          registrantUserKey={registrantUserKey} pickerUser={pickerUser} setPickerUser={setPickerUser}
          userPickerKey={userPickerKey}
          onSearchPersonChange={onSearchPersonChange}
          workItemIds={workItemIds} setWorkItemIds={setWorkItemIds}
          workItemOptions={workItemOptions} workItemOptionsLoading={workItemOptionsLoading} workItemEntityIds={workItemEntityIds}
          isModalVisible={isModalVisible} modalLockRef={modalLockRef}
          checkWorkInstanceDataSource={checkWorkInstanceDataSource}
          setIsWorkItemChanged={setIsWorkItemChanged}
          setSearchWorkItemIds={setSearchWorkItemIds} setSearchWorkItemEntityIds={setSearchWorkItemEntityIds}
          // setExcludeWorkItemEntityIdListCache={setExcludeWorkItemEntityIdListCache}  // [注释] 缓存功能
          // excludeWorkItemEntityIdListCacheRef={excludeWorkItemEntityIdListCacheRef}  // [注释] 缓存功能
          // cacheWorkInstanceDataSourceRef={cacheWorkInstanceDataSourceRef}  // [注释] 缓存功能
          // setHasCache={setHasCache}  // [注释] 缓存功能
          onWorkItemChange={onWorkItemChange} debouncedWorkItemDeselect={debouncedWorkItemDeselect}
          debouncedWorkItemEntityDeselect={debouncedWorkItemEntityDeselect}
          fetchOptions={fetchOptions} setUpdateEditData={setUpdateEditData}
          setWorkItemEntityIds={setWorkItemEntityIds} setWorkItemIdsFilter={setWorkItemIdsFilter}
          beginWorkDate={beginWorkDate} endWorkDate={endWorkDate}
          beginWorkDateCP={beginWorkDateCP} endWorkDateCP={endWorkDateCP}
          minWorkDate={minWorkDate} maxWorkDate={maxWorkDate}
          disabledWorkDate={disabledWorkDate}
          setMinWorkDate={setMinWorkDate} setMaxWorkDate={setMaxWorkDate}
          onWorkDateChange={onWorkDateChange} onWorkDateBtnChange={onWorkDateBtnChange}
          scheduleStart={scheduleStart} scheduleEnd={scheduleEnd}
          onScheduleChange={onScheduleChange} rangePresets={rangePresets}
          showResponsibleFilter={showResponsibleFilter} showAllResponsibleOptions={showAllResponsibleOptions}
          setHasMore={setHasMore} setWorkInstancePagination={setWorkInstancePagination}
          workInstancePagination={workInstancePagination}
          setInvoke={setInvoke} setEditData={setEditData}
          // setExpandedRowKeys={setExpandedRowKeys}  // [注释] 展开层级功能
          setTableDataSource={setTableDataSource}
          setWorkInstanceDataSource={setWorkInstanceDataSource}
          // setCacheWorkInstanceDataSource={setCacheWorkInstanceDataSource}  // [注释] 缓存功能
          setIsPersonInCharge={setIsPersonInCharge}
          querySaveWorkHour={querySaveWorkHour}
          workDate={workDate} alertDetail={alertDetail}
          attendanceEnabled={attendanceEnabled} attendanceHours={attendanceHours} missPunchPolicy={missPunchPolicy}
          onSyncAttendance={handleSyncAttendance}
          type={props.type} loginUser={loginUser}
          selectedSpaceKeys={selectedSpaceKeys}
          spaceOptions={filteredSpaceOptions}
          spaceLoading={spaceLoading}
          onSpaceChange={onSpaceChange}
          getUserStandWorkHourData={getUserStandWorkHourData}
          onResponsibleFilterChange={onResponsibleFilterChange}
          debouncedSpaceDeselect={debouncedSpaceDeselect}
          isCustomFieldEnabled={isCustomFieldEnabled}
        />
        <div className="regWorkHourBatchNew-body" ref={tableRef}>
          {/* <ExpandLevelPopover
            expandPopoverVisible={expandPopoverVisible}
            setExpandPopoverVisible={setExpandPopoverVisible}
            expandLevel={expandLevel} expandOptions={expandOptions}
            handleExpandLevelSelect={handleExpandLevelSelect} zhankai={zhankai}
          /> */}
          <Table
            loading={tableLoading && !filterMemoryLoading} className="table-warp" size="small" bordered
            rowKey="id" columns={regTableColumns}
            dataSource={workInstanceDataSource?.entities} pagination={false}
            expandable={{ indentSize: 20, defaultExpandAllRows: true, onExpand }}  // expandedRowKeys removed [注释] 展开层级功能
            scroll={{ x: "max-content", y: props.type === "tab" ? 210 : 295 }}
            components={{ body: { wrapper: VirtualTableBody } }}
            footer={() => (
              <TableSummaryFooter
                workInstanceDataSource={workInstanceDataSource}
                beginWorkDate={beginWorkDate} endWorkDate={endWorkDate}
                regTableColumns={regTableColumns} workHoursTotalDetail={workHoursTotalDetail}
                summaryRef={summaryRef} loading={loading} hasMore={hasMore}
              />
            )}
          />
          <Button icon={<PlusOutlined />} type="link" style={{ paddingLeft: 0 }}
            onClick={() => { addWorkItemForm.resetFields(); setIsAddWorkItemOpen(true); }}>
            添加已有工作实例/节点/任务
          </Button>
        </div>
        <AddWorkItemModal
          isAddWorkItemOpen={isAddWorkItemOpen} setIsAddWorkItemOpen={setIsAddWorkItemOpen}
          addWorkItemForm={addWorkItemForm} fetchOptions2={fetchOptions2}
          nodeTaskOptions={nodeTaskOptions}
          isAddWorkItemLoading={isAddWorkItemLoading}
          spaceOptions={spaceOptions}
          spaceLoading={spaceLoading}
          isCustomFieldEnabled={isCustomFieldEnabled}
          clearNodeTaskOptions={() => setNodeTaskOptions([])}
          onAddWorkItemValuesChange={onAddWorkItemValuesChange}
          onAddWorkItemFinish={onAddWorkItemFinish}
        />
      </div>
    </Spin>
  );
};

export default RegWorkHourBatchNew;
