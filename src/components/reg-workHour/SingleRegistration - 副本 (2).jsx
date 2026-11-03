/**
 * @file RegWorkHour.jsx
 * @description 工时登记组件，用于单个或批量工时登记、审批及管理
 * @author TeamMeego
 * @date 2024
 */
import JSSDK from '../../jssdk-adapter'
import React, { useState, useEffect, useRef, useMemo } from "react";

// Ant Design 组件导入
import {
  DatePicker,
  InputNumber,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Space,
  message,
  Avatar,
  Spin,
  Radio,
  Typography,
  Alert,
  Tooltip,
} from "antd";

// 图标导入
import { UserOutlined, InfoCircleFilled } from "@ant-design/icons";

// 工具函数导入
import {
  getWeekStartAndEnd,
  getQuarterStartAndEnd,
  timeStamp2Text,
  getFirstDayOfNaturalMonth,
  getLastDayOfNaturalMonth,
  isNumber,
  validateNumber,
} from "../../util/util";

// API 接口导入
import {
  postQueryNodeWorkHourSumByUser,
  postInsertNodeWorkHour,
  postUpdateNodeWorkHour,
  getStandWorkHour,
  getWorkInstance,
  getProjectConfig,
  getApprovalSettings,
  postApproveHandle,
  postUserActive,
  getDisplayLogic,
  getRegistrationSettings,
  // getItemEntityOptionNew,
  getEntityNodeOptionNew,
  getItemEntityOptions,
  getUserStandWorkHour,
  getRegisterProjectKeyOption,
  getRegisterWorkItemOption,
  getRegisterItemEntityOption,
  getRegisterEntityNodeOption,
  getNodePersonStatistics,
  getRegisterPersonSaturation,
  getUserRoleInfo,
  getAttendanceConfig,
  getUserAttendanceConfig,
  syncAttendanceConfig,
} from "../../api/api";

// 样式导入
import "./RegWorkHour.less";

// 第三方库导入
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import Decimal from "decimal.js";

// 自定义组件导入
import RegWorkHourBatchNew from "../reg-workHour-batch-new/RegWorkHourBatchNew";
import WorkNodeSelect from "../workNode-cascader/WorkNodeSelect";
import UserPicker from "../user-picker/UserPicker";
import TaskDetail from "../task-detail/TaskDetail";
import WorkNodeCascaderControl from "../workNode-cascader/WorkNodeSelectControl";
import SpaceCascader from "../space-cascader/SpaceCascader";

// 扩展 dayjs 插件
dayjs.extend(customParseFormat);

// 组件别名
const { TextArea } = Input;
const { Text } = Typography;

/**
 * 工时登记主组件
 * @param {Object} props - 组件属性
 * @param {string} props.registrationType - 登记类型 (single/batch)
 * @param {Object} props.setRegistrationValue - 预设登记值
 * @param {Function} props.getRegistrationValue - 获取登记值回调
 * @param {string} props.type - 类型 (normal/approval)
 * @param {Object} props.workItem - 工作项信息
 * @param {string} props.flowMode - 流程模式
 * @param {Object} props.loginUser - 当前登录用户信息
 * @param {string} props.point - 入口点 (normal/control)
 */
const RegWorkHour = (props) => {
  // 表单实例
  const [registrationForm] = Form.useForm();
  const workItemValue = Form.useWatch('workItem', registrationForm);
  
  // 状态管理
  const [isAllowRegister, setIsAllowRegister] = useState(false); // 是否允许代填工时
  // 根据 api/user/info 返回的角色判断：普通用户(member)时禁用成员选择框
  const [isMemberRole, setIsMemberRole] = useState(false);
  // 普通用户展示自己的信息，数据来源于缓存 feishuUserInfo
  const [feishuUserInfo, setFeishuUserInfo] = useState(null);
  const [submitBtnTxt, setSubmitBtnTxt] = useState("提交"); // 提交按钮文本
  const workNodeSelectRef = useRef(null);
  const spaceCascaderRef = useRef(null);
  const [submitDisabled, setSubmitBtnDisabled] = useState(false); // 提交按钮是否禁用
  const [canSubmitByLevel, setCanSubmitByLevel] = useState(true); // 根据层级判断是否可以提交(新增)
  const [submitLoadings, setSubmitLoadings] = useState(false); // 提交按钮加载状态
  const [saveHourLoadings, setSaveHourLoadings] = useState(false); // 暂存按钮加载状态
  const [id, setId] = useState(""); // 当前操作ID
  const [registrationType, setRegistrationType] = useState(
    props?.registrationType || "single" // 登记类型：single-单个 / batch-批量
  );
  const [spinning, setSpinning] = useState(false); // 加载状态
  const [workDate, setWorkDate] = useState(""); // 工作日期
  const [curFlowType, setCurFlowType] = useState(""); // 当前流程类型
  const [workItem, setWorkItem] = useState([]); // 选中的工作项
  const [workItemName, setWorkItemName] = useState(""); // 工作项名称
  const [workItemId, setWorkItemId] = useState(""); // 工作项ID
  const [workItemEntityId, setWorkItemEntityId] = useState(""); // 工作项实体ID
  const [selectedCustomFieldValue, setSelectedCustomFieldValue] = useState(
    props?.setRegistrationValue?.customFieldValue ?? null
  );
  const [nodeId, setNodeId] = useState(""); // 节点ID
  const [taskId, setTaskId] = useState(""); // 任务ID
  // 当前级联选择器选中的空间 key（SpaceCascader 第一层 projectKey），仅在单项登记弹窗中使用
  const [currentProjectKey, setCurrentProjectKey] = useState("");
  // 当前级联选择器选中的空间名称（projectName）
  const [currentProjectName, setCurrentProjectName] = useState("");
  const [registeredName, setRegisteredName] = useState({}); // 登记名称信息
  const [standWorkHour, setStandWorkHour] = useState(0); // 标准工时
  const [capacitySet, setCapacitySet] = useState({}); // 容量设置
  const [actDay, setActDay] = useState(0); // 实际天数
  const [isShowDetailBtnOpen, setIsShowDetailBtnOpen] = useState(false); // 是否显示详情按钮
  const [isDetailOpen, setIsDetailOpen] = useState(false); // 详情弹窗是否打开
  const [registrantUserKey, setRegistrantUserKey] = useState(
    (props?.type === "web" || props?.type === "approval")
      ? (props?.setRegistrationValue?.userKey || '')
      : (props?.loginUser?.id || (() => {
          try { return JSON.parse(localStorage.getItem('feishuUserInfo'))?.userKey; } catch (_) { return ''; }
        })())
  );
  // 用于监听登记人变化，刷新空间列表
  const prevRegistrantRef = useRef(registrantUserKey);
  const [alertDetail, setAlertDetail] = useState({}); // 提示详情
  const [alertDetailOld, setAlertDetailOld] = useState({}); // 原始提示详情
  const [workItemInfo, setWorkItemInfo] = useState({}); // 工作项详情
  const [isEditChangeAlert, setIsEditChangeAlert] = useState(false); // 编辑时是否更改提示
  const [regDisplayLogic, setRegDisplayLogic] = useState({}); // 登记展示逻辑
  const [regWorkingHours, setRegWorkingHours] = useState(null); // 已登记工时
  const [windowHeight, setWindowHeight] = useState(570); // 默认高度为570px
  const [ingsConfig, setingsConfig] = useState(1);
  const [canSubmitByLevelInfo, setCanSubmitByLevelInfo] = useState("");
  // 级联选择器下拉面板是否打开：打开期间隐藏层级校验提示，避免切换层级时提示频繁显隐导致样式抖动
  const [cascaderDropdownOpen, setCascaderDropdownOpen] = useState(false);
  // 面板关闭后延迟展示校验提示，避免关闭瞬间抖动
  const [showLevelHint, setShowLevelHint] = useState(false);
  const levelHintTimerRef = useRef(null);
  const [registrationSettings, setRegistrationSettings] = useState({}); // 登记设置数据
  const ingsConfigRef = useRef(1);
  // 保存接口返回的"饱和度/剩余工时"原始快照（date/user 维度），供 validator 使用，
  // 避免读取被 onValuesChange 增量计算后污染的 alertDetail.remainingWork。
  const capacitySnapshotRef = useRef({
    workDate: null,
    userKey: null,
    remainingWork: null,
    registeredWorkingHours: null,
    approvalingWork: null,
  });
  const [isComposing, setIsComposing] = React.useState(false);
  const [workDescRequired, setWorkDescRequired] = useState(0);
  const [mode, setMode] = useState(""); // 当前模式：tenant（租户模式）/ space（空间模式）
  const [attendanceEnabled, setAttendanceEnabled] = useState(0);
  const [upperLimitSource, setUpperLimitSource] = useState(1); // 1-班内工作时长(scheduled) 2-实际出勤时长(actual)
  const [missPunchPolicy, setMissPunchPolicy] = useState(0); // 1-不允许提交(block) 2-允许提交-自定义提交上限(custom_limit)
  const [missPunchCustomLimit, setMissPunchCustomLimit] = useState(null); // 缺卡自定义提交上限（小时）
  const [attendanceHours, setAttendanceHours] = useState(null); // 考勤工时（小时）
  //实时监听高度
  const getIframeHeight = async () => {
  try {
    // 方法1: 检查是否在iframe中，并获取iframe元素
    const isInIframe = window.self !== window.top;
    let iframeHeight = 0;
    
    if (isInIframe) {
      try {
        // 尝试通过JSSDK获取上下文信息
        const context = await JSSDK.Context.load();
        // 立即获取当前高度
        if (context?.containerInfo?.height) {
          //console.log('Iframe height from JSSDK:', context.containerInfo.height);
          iframeHeight = context.containerInfo.height;
        }
        // 监听上下文变化
        context.watch((ctx) => {
          if (ctx?.containerInfo?.height) {
            //console.log('Iframe height updated:', ctx.containerInfo.height);
            setWindowHeight(ctx.containerInfo.height - 70);
          }
        });
      } catch (error) {
        //console.warn('JSSDK获取失败，尝试其他方式:', error);
      }
      
      // 如果JSSDK获取失败或没有返回高度，使用文档高度作为备选
      if (!iframeHeight) {
        // 方法2: 通过offsetHeight获取当前文档高度
        iframeHeight = document.documentElement.offsetHeight;
        //console.log('Document height:', iframeHeight);
      }
      
      const height = iframeHeight - 70;
      //console.log('计算后的高度:', height);
      setWindowHeight(height); // 更新状态
    } else {
      //console.log('不在iframe环境中，使用窗口高度');
      // 不在iframe中时使用窗口高度
      const height = window.innerHeight - 70;
      setWindowHeight(height);
    }
    
    return iframeHeight;
  } catch (error) {
    console.error('获取iframe高度时出错:', error);
    // 出错时使用默认高度
    setWindowHeight(570);
    return 0;
  }
};

// 优化防抖函数，确保正确处理异步操作
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    return new Promise((resolve) => {
      timeoutId = setTimeout(async () => {
        try {
          const result = await func.apply(null, args);
          resolve(result);
        } catch (error) {
          console.error('防抖函数执行出错:', error);
          resolve(null);
        }
      }, delay);
    });
  };
};
/**
 * 构建三级索引 + 公共字段缓存，只调用一次
 */
const buildAttendanceIndex = (list) => {
  var dataMap = new Map();   // key: projectKey|userKey|date
  var configMap = new Map(); // key: projectKey, value: 项目公共配置

  for (var i = 0; i < list.length; i++) {
    var item = list[i] || {};
    var pk = item.projectKey;

    // 公共字段只存一份
    if (!configMap.has(pk)) {
      configMap.set(pk, {
        projectKey: pk,
        isEnable: item.isEnable,
        upperLimitSource: item.upperLimitSource,
        missPunchPolicy: item.missPunchPolicy,
        missPunchCustomLimit: item.missPunchCustomLimit
      });
    }

    var userKeys = item.userKeys || {};
    var userKeyArr = Object.keys(userKeys);
    for (var j = 0; j < userKeyArr.length; j++) {
      var uk = userKeyArr[j];
      var dates = userKeys[uk] || {};
      var dateArr = Object.keys(dates);
      for (var k = 0; k < dateArr.length; k++) {
        var date = dateArr[k];
        dataMap.set(pk + '|' + uk + '|' + date, dates[date]);
      }
    }
  }
  return { dataMap: dataMap, configMap: configMap };
}

// 查询：O(1)，一次 get
const getAttendance = (index, projectKey, userKey, date) => {
  var key = projectKey + '|' + userKey + '|' + date;
  var data = index.dataMap.get(key);
  if (!data) return null;
  // 需要公共字段时再合并，不需要则直接返回 data
  return Object.assign({}, index.configMap.get(projectKey), data);
}

 const getAttendanceConfigInfo = async () => {
    try {
      const res = await getAttendanceConfig()
      if (res?.result && res?.data){
        const data = res.data;
        setAttendanceEnabled(data.enable ?? 0);
        setUpperLimitSource(data.upperLimitSource ?? 1);
        setMissPunchPolicy(data.missPunchPolicy ?? 1);
        setMissPunchCustomLimit(data.missPunchCustomLimit ?? null);
      }else{

      }

    } catch (error) {
    } finally {
      setAttendanceEnabled(0);
      // setUpperLimitSource(data.upperLimitSource ?? 1);
      // setMissPunchPolicy(data.missPunchPolicy ?? 1);
      // setMissPunchCustomLimit(data.missPunchCustomLimit ?? null);
      console.log('考勤配置状态:', 1);
    }
  }
  const getUserAttendanceConfigData = async () => {
    if(!attendanceEnabled) return
    const data = {
      "userKeys": [registrantUserKey],
      "startDate": workDate,
      "endDate": workDate
    }
    if(mode === 'space'){
      data.projectKeys = [currentProjectKey]
    }
    try {
      const res = await getUserAttendanceConfig(data)
      if (res?.result && res?.data){
        const data = res.data;
        setAttendanceEnabled(data.enable ?? 0);
        setUpperLimitSource(data.upperLimitSource ?? 1);
        setMissPunchPolicy(data.missPunchPolicy ?? 1);
        setMissPunchCustomLimit(data.missPunchCustomLimit ?? null);
      }else{

      }

    } catch (error) {
      console.error('获取用户考勤配置时出错88888:', error);
      setAttendanceHours(0)
      setMissPunchPolicy(1)

    } finally {
            var list = [
  {
    "projectKey": "671f7d5d69277dfb0b140306",
    "isEnable": 1,
    "upperLimitSource": 1,
    "missPunchPolicy": 1,
    "missPunchCustomLimit": 8,
    "userKeys": {
      "7654300649781267654": {
        "2026-08-24": {
          "attendanceHours": 8.0,
          "hasAttendance": true,
          "leaveFlag": false,
          "punchRecords": [
            { "time": "09:02:10", "type": "开后" },
            { "time": "18:30:55", "type": "关闭" }
          ]
        }
      },
       "76543006497812676549": {
        "2026-08-24": {
          "attendanceHours": 8.0,
          "hasAttendance": true,
          "leaveFlag": false,
          "punchRecords": [
            { "time": "09:02:10", "type": "开后" },
            { "time": "18:30:55", "type": "关闭" }
          ]
        },
        "2026-08-26": {
          "attendanceHours": 8.0,
          "hasAttendance": true,
          "leaveFlag": false,
          "punchRecords": [
            { "time": "09:02:10", "type": "开后" },
            { "time": "18:30:55", "type": "关闭" }
          ]
        }
      }
    }
  },
   {
    "projectKey": "671f7d5d69277dfb0b1403069",
    "isEnable": 1,
    "upperLimitSource": 1,
    "missPunchPolicy": 1,
    "missPunchCustomLimit": 8,
    "userKeys": {
      "7654300649781267654": {
        "2026-08-24": {
          "attendanceHours": 8.0,
          "hasAttendance": true,
          "leaveFlag": false,
          "punchRecords": [
            { "time": "09:02:10", "type": "开后" },
            { "time": "18:30:55", "type": "关闭" }
          ]
        }
      }
    }
  }
];
      var index = buildAttendanceIndex(list);
console.log('index:', index);
// 每次查询 O(1)
const attendance = getAttendance(index, '671f7d5d69277dfb0b140306', '7654300649781267654', workDate);
console.log('attendance:', attendance);
      setAttendanceHours(null)
      setMissPunchPolicy(1)
      console.log('考勤配置状态888888:', 1);
    }
  }
  const syncAttendanceConfigData = async () => {
    try {
      const res = await syncAttendanceConfig()
      if (res?.result && res?.data){
        const data = res.data;
        setAttendanceEnabled(data.enable ?? 0);
        setUpperLimitSource(data.upperLimitSource ?? 1);
        setMissPunchPolicy(data.missPunchPolicy ?? 1);
        setMissPunchCustomLimit(data.missPunchCustomLimit ?? null);
      }else{

      }

    } catch (error) {
    } finally {
      console.log('考勤配置状态:', attendanceEnabled);
    }
  }
 useEffect(() => {
    if (props?.windowHeight) setFromHeight(props?.windowHeight);
  }, [props?.windowHeight]);
/**
 * 根据可登记层级信息设置提示信息
 * @param {Object} registeredName - 登记名称信息
 */
const handleLevelValidation = (registeredName) => {
  const levelNames = registeredName?.canRegisterLevelName;
  if (levelNames?.length === 1) {
    if (levelNames[0] === 'work_item_entity' || levelNames[0] === 'workitem') {
      setCanSubmitByLevelInfo('根据管理员设置，请登记至工作项实例层级');
    } else if (levelNames[0] === 'node') {
      setCanSubmitByLevelInfo('根据管理员设置，请登记至节点层级');
    } else if (levelNames[0] === 'task') {
      setCanSubmitByLevelInfo('根据管理员设置，请登记至任务层级');
    }
  } else if (levelNames?.length === 2) {
    if ((levelNames.includes('work_item_entity') || levelNames.includes('workitem')) && levelNames.includes('node')) {
      setCanSubmitByLevelInfo('根据管理员设置，请登记至工作项实例或节点层级');
    } else if ((levelNames.includes('work_item_entity') || levelNames.includes('workitem')) && levelNames.includes('task')) {
      setCanSubmitByLevelInfo('根据管理员设置，请登记至工作项实例或任务层级');
    } else if (levelNames.includes('node') && levelNames.includes('task')) {
      setCanSubmitByLevelInfo('根据管理员设置，请登记至节点或任务层级');
    }
  }
};
useEffect(() => {
  // 使用新的状态变量canSubmitByLevel来控制层级验证,而不影响表单输入框的禁用状态
  if(registeredName && Object.keys(registeredName).length > 0){
    if(props?.currItem?.noCanRegisterWorkItem){
      setCanSubmitByLevel(false); // 不可提交,但不影响表单输入
      setCanSubmitByLevelInfo(`根据管理员设置，[${props?.currItem?.workItemName}]不可被[编辑]`);
    }else{
    if(registeredName?.canRegister===true){
      if(registeredName?.canRegisterLevel === false){
        setCanSubmitByLevel(false); // 不可提交,但不影响表单输入
        handleLevelValidation(registeredName);
      }else{
        setCanSubmitByLevel(true); // 可以提交
      }
    }else{
     if(registeredName?.canRegister===false){
        setCanSubmitByLevel(false); // 不可提交,但不影响表单输入
        setCanSubmitByLevelInfo('非当前登记用户的负责人，无法登记');
      }
    }
  }
  }else{
     if(props?.setRegistrationValue?.canRegisterLevel === false){
        setCanSubmitByLevel(false); // 不可提交,但不影响表单输入
        handleLevelValidation(props?.setRegistrationValue);
      }
    if(props?.currItem?.noCanRegisterWorkItem){
      setCanSubmitByLevel(false); // 不可提交,但不影响表单输入
      setCanSubmitByLevelInfo(`根据管理员设置，[${props?.currItem?.workItemName}]不可被[编辑]`);
    }
  }
}, [JSON.stringify(registeredName)]);

// 处理登记对象失焦事件
const handleWorkItemBlur = () => {
  if(tempRegisteredName && Object.keys(tempRegisteredName).length > 0){
    setRegisteredName({...tempRegisteredName});
  }
};
// 组件卸载时清理延迟提示定时器，避免内存泄漏
useEffect(() => {
  return () => {
    if (levelHintTimerRef.current) {
      clearTimeout(levelHintTimerRef.current);
      levelHintTimerRef.current = null;
    }
  };
}, []);

// 添加窗口大小变化监听
useEffect(() => {
  // 计算高度函数
  const calculateHeight = async () => {
    //console.log('窗口大小变化，重新计算高度');
    await getIframeHeight();
  };
  
  // 创建防抖处理函数
  const debouncedCalculateHeight = debounce(calculateHeight, 300);
  
  // 组件挂载时立即计算一次
  calculateHeight();
  
  // 监听窗口大小变化
  window.addEventListener('resize', debouncedCalculateHeight);
  // 监听全屏变化
  window.addEventListener('fullscreenchange', debouncedCalculateHeight);
  // 监听方向变化（移动端）
  window.addEventListener('orientationchange', debouncedCalculateHeight);
  
  // 额外添加对可视区域变化的监听（针对现代浏览器）
  if (window.ResizeObserver) {
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.target === document.documentElement) {
          debouncedCalculateHeight();
          break;
        }
      }
    });
    resizeObserver.observe(document.documentElement);
    
    // 组件卸载时清理ResizeObserver
    return () => {
      window.removeEventListener('resize', debouncedCalculateHeight);
      window.removeEventListener('fullscreenchange', debouncedCalculateHeight);
      window.removeEventListener('orientationchange', debouncedCalculateHeight);
      resizeObserver.disconnect();
    };
  } else {
    // 组件卸载时移除监听
    return () => {
      window.removeEventListener('resize', debouncedCalculateHeight);
      window.removeEventListener('fullscreenchange', debouncedCalculateHeight);
      window.removeEventListener('orientationchange', debouncedCalculateHeight);
    };
  }
}, []);

  
  /**
   * 组件初始化时获取基础配置信息
   */
  useEffect(() => {
    //getWorkHour(); // 获取标准工时
    getRole(); // 获取用户角色与模式，驱动成员代填能力
  }, []);

  // mode 获取后，根据模式初始化按钮文案
  useEffect(() => {
    if (mode) {
      // 编辑态：用编辑记录的 projectKey 且强制调接口（isEdit=true），按实际 enableApproval 决定文案
      const isEdit = !!props?.setRegistrationValue;
      const editProjectKey = props?.setRegistrationValue?.projectKey;
      getApprovalSettingsData(editProjectKey, isEdit);
    }
  }, [mode]);

  // 仅在通过级联组件选择了空间后（currentProjectKey 有值）才查询登记设置
  useEffect(() => {
    if (currentProjectKey) {
      getCapacity();
    }
  }, [currentProjectKey]);
  /**
   * 监听登记类型变化
   */
  useEffect(() => {
    if (props?.registrationType) setRegistrationType(props?.registrationType);
  }, [props?.registrationType]);
  useEffect(() => {
    ingsConfigRef.current=ingsConfig
  }, [ingsConfig]);
  /**
   * 编辑态：解析工作描述必填标记（describe）与按钮文案（enableApproval）
   * 优先级：
   *   1. 详情接口数据（editData.describe / editData.enableApproval）
   *   2. 详情缺字段时，用 projectKey 匹配空间列表记录取值
   * @param {Object} editData - 编辑记录（props.setRegistrationValue）
   */
  const resolveEditConfig = async (editData) => {
    if (!editData) return;
    const editProjectKey = editData?.projectKey || '';
    let describe;
    let enableApproval;

    // 第一优先级：详情接口数据
    if ('describe' in editData) describe = editData.describe;
    if ('enableApproval' in editData) enableApproval = editData.enableApproval;

    // 第二优先级：详情缺字段时，用 projectKey 匹配空间记录
    if ((describe === undefined || enableApproval === undefined) && editProjectKey) {
      try {
        const res = await getRegisterProjectKeyOption({registerUserKey:registrantUserKey || ''});
        if (res?.result && Array.isArray(res.data)) {
          const matched = res.data.find(
            (item) => String(item?.value ?? item?.projectKey) === String(editProjectKey)
          );
          if (matched) {
            if (describe === undefined) describe = matched.describe;
            if (enableApproval === undefined) enableApproval = matched.enableApproval;
          }
        }
      } catch (e) {
        console.error('resolveEditConfig 匹配空间记录失败:', e);
      }
    }

    // 设置工作描述必填标记（describe === true 时必填）
    setWorkDescRequired(describe === true ? 1 : 0);
    // 设置按钮文案（enableApproval !== false 即需审批）
    setSubmitBtnTxt(enableApproval !== false ? "提交审批" : "提交");
  };

  /**
   * 监听预设登记值变化，初始化表单数据
   */
  useEffect(() => {
    if (props?.setRegistrationValue) {
      // 编辑模式下设置禁用状态
      setSubmitBtnDisabled(true);
      //console.log('props?.setRegistrationValue',props?.currItem?.workItemName);
      if(props?.setRegistrationValue?.canRegisterLevel === false){
        setCanSubmitByLevel(false); // 不可提交,但不影响表单输入
        handleLevelValidation(props?.setRegistrationValue);
      }
       if(props?.currItem?.noCanRegisterWorkItem){
       setCanSubmitByLevelInfo(`根据管理员设置，[${props?.currItem?.workItemName}]不可被[编辑]`);
        setCanSubmitByLevel(false); // 不可提交,但不影响表单输入
      }
      // 编辑态初始直接展示已有的层级校验提示（无需等待下拉面板关闭的延迟）
      setShowLevelHint(true);
      // 设置日期和登记人信息
      setWorkDate(
        dayjs(props?.setRegistrationValue?.workDate).format("YYYY-MM-DD")
      );
      setRegistrantUserKey(props?.setRegistrationValue?.registrantUserKey);
      
      // 设置工作项相关信息
      setWorkItemId(props.setRegistrationValue?.workItemId);
      setWorkItemEntityId(props.setRegistrationValue?.workItemEntityId);
      setSelectedCustomFieldValue(props.setRegistrationValue?.customFieldValue ?? null);
      setNodeId(props.setRegistrationValue?.nodeId);
      setTaskId(props.setRegistrationValue?.taskId);
      // 同步编辑记录所属空间 key，供单项登记统计接口（getNodePersonStatistics）使用，避免编辑时 projectKey 为空
      setCurrentProjectKey(props.setRegistrationValue?.projectKey || '');
      
      // 设置工作项数组（与 SpaceCascader 的 value 结构一致：含第 0 段空间 projectKey）
      setWorkItem([
        props.setRegistrationValue?.projectKey,
        props.setRegistrationValue?.workItemId,
        props.setRegistrationValue?.workItemEntityId,
        props.setRegistrationValue?.nodeId,
        props.setRegistrationValue?.taskId,
      ]);
      
      // 构建工作项名称路径
      setWorkItemName(
        `${props.setRegistrationValue?.workItemName}/${
          props.setRegistrationValue?.workItemEntityName
        }${
          props.setRegistrationValue?.nodeName
            ? `/${props.setRegistrationValue?.nodeName}`
            : ""
        }${
          props.setRegistrationValue?.taskName
            ? `/${props.setRegistrationValue?.taskName}`
            : ""
        }`
      );
      
      // 初始化表单字段
      registrationForm.setFieldsValue({
        workItem: [
          props.setRegistrationValue?.projectKey,
          props.setRegistrationValue?.workItemId,
          props.setRegistrationValue?.workItemEntityId,
          props.setRegistrationValue?.nodeId,
          props.setRegistrationValue?.taskId,
        ],
        scheduleDate: props.setRegistrationValue?.scheduleDate,
        workDate: dayjs(props.setRegistrationValue?.workDate),
        actWorkHour:
          props?.type === "approval"
            ? props.setRegistrationValue?.actWorkHour || 0
            : props.setRegistrationValue?.act_hour ||0,
        workDesc: props.setRegistrationValue?.workDesc,
        id: props.setRegistrationValue?.id,
        registrantUserKey: props.setRegistrationValue?.registrantUserKey,
      });

      // 编辑态：解析工作描述必填标记与按钮文案
      // 优先级：详情接口数据 -> 通过 projectKey 匹配空间列表记录
      resolveEditConfig(props.setRegistrationValue);
    } else {
      setSelectedCustomFieldValue(null);
      // 新增模式下记录用户行为
      if (props?.point === "control") {
        getUserActive("ControlOpenBatchRegistrationWorkingHours");
      } else {
        getUserActive("OpenRegistrationWorkingHours");
        // getRegDisplayLogic(); // 暂时注释掉的函数调用
      }
      
      // 设置当前登录用户为默认登记人
      registrationForm.setFieldValue("registrantUserKey", props?.loginUser?.id);
    }
  }, [props?.setRegistrationValue, props?.type]);

  /**
   * 监听工作项变化，根据不同入口点设置工作项信息
   */
  useEffect(() => {
    if (props?.workItem) {
      if (props?.point === "control") {
        // console.log(props?.point);
        // 控制面板入口，工作项为对象格式
        setRegisteredName({ ...props?.registeredName });
        setWorkItemId(props?.workItem?.workItemId);
        setWorkItemEntityId(props?.workItem?.workItemEntityId);
        setSelectedCustomFieldValue(
          props?.workItem?.customFieldValue
            ?? props?.registeredName?.customFieldValue
            ?? null
        );
        setNodeId(props?.workItem?.nodeId);
        setTaskId(props?.workItem?.taskId);
        setWorkItem([
          props?.workItem?.workItemId,
          props?.workItem?.workItemEntityId,
          props?.workItem?.nodeId,
          props?.workItem?.taskId,
        ]);
        registrationForm.setFieldValue("workItem", [
          props?.workItem?.workItemId,
          props?.workItem?.workItemEntityId,
          props?.workItem?.nodeId,
          props?.workItem?.taskId,
        ]);
       // 确保getCapacity()完成后再执行后续函数
        if(props?.workItem?.nodeId){
          getEntityNodeOption(props)
        }else{
          getItemEntityOptio(props)
        }
      } else {
        // 常规入口，工作项为数组格式
        setSelectedCustomFieldValue(props?.registeredName?.customFieldValue ?? null);
        setWorkItemId(props?.workItem[0]);
        setWorkItemEntityId(props?.workItem[1]);
        setNodeId(props?.workItem[2]);
        setTaskId(props?.workItem[3]);
        setWorkItem([
          props?.workItem[0],
          props?.workItem[1],
          props?.workItem[2],
          props?.workItem[3],
        ]);
        registrationForm.setFieldValue("workItem", [
          props?.workItem[0],
          props?.workItem[1],
          props?.workItem[2],
          props?.workItem[3],
        ]);
      }
    }
  }, [props?.workItem, props?.type,ingsConfig]);


  /**
   * 监听流程模式变化
   */
  useEffect(() => {
    setCurFlowType(props?.flowMode);
  }, [props?.flowMode]);

  /**
   * 监听登录用户变化，更新登记人信息
   */
  useEffect(() => {
    setRegistrantUserKey(props?.loginUser?.id);
    registrationForm.setFieldValue("registrantUserKey", props?.loginUser?.id);
  }, [props?.loginUser?.id]);
  /**
   * 获取登记工作项实例类型
   */
  const [canRegister, setCanRegister] = useState(true);
  const getItemEntityOptio = async (workItem) => {
      const myselfFlag = ingsConfigRef.current == 1 ? true : false;
    const res = await getItemEntityOptions({
      workItemId: workItem.workItem?.workItemId,
      workItemEntityId: workItem.workItem?.workItemEntityId,
      
      userKey: workItem.loginUser?.id,
      myselfFlag: myselfFlag,
    });
        if (res?.result && Array.isArray(res.data.data) && res.data.data.length > 0 && res.data.data[0]) {
        // 安全地获取myselfStatus，避免访问不存在的属性
        //console.log('res.data.data[0]',res.data.data[0])
        const myselfStatus = res.data.data[0].canRegister;
        if (myselfStatus === false) {
          setSubmitBtnDisabled(true);
        } else {
          if(!res.data.data[0].canRegisterLevel){
             setCanSubmitByLevel(false);
             handleLevelValidation(res.data.data[0]);
          }
          setSubmitBtnDisabled(false);
        }
        if (myselfStatus !== undefined) {
          setCanRegister(myselfStatus);
         
        } else {
          console.warn('登记设置中未找到myselfStatus属性');
        } 
      }else{
        setSubmitBtnDisabled(true);
        setCanRegister(false);
      }
  };


  const getEntityNodeOption = async (workItem) => {
      const myselfFlag = ingsConfig == 1 ? true : false;
    const res = await getEntityNodeOptionNew({
      workItemId: workItem.workItem?.workItemId,
      workItemEntityId: workItem.workItem?.workItemEntityId,
      pageNum:1,
     pageSize:10,
      userKey: workItem.loginUser?.id,
      myselfFlag: myselfFlag,
    });
      if (res?.result && Array.isArray(res.data) && res.data.length > 0 && res.data[0]) {
        try {
          //console.log('currentNodeData',res.data)
           // 安全地获取myselfStatus，避免访问不存在的属性
          let currentNodeData = res.data.find(item => item.value === props?.workItem?.nodeId);
          const myselfStatus = currentNodeData?.canRegister || false;  
          if (myselfStatus === false) {
            setSubmitBtnDisabled(true);
          } else {
            if(!res.data[0].canRegisterLevel){
              setCanSubmitByLevel(false);
              handleLevelValidation(res.data[0]);
            }
            setSubmitBtnDisabled(false);
          }
          if (myselfStatus !== undefined) {
            setCanRegister(myselfStatus);
          
          } else {
            console.warn('登记设置中未找到myselfStatus属性');
          } 
        } catch (error) {
          setSubmitBtnDisabled(true);
          setCanRegister(false);
        }

      }else{
        setSubmitBtnDisabled(true);
        setCanRegister(false);
      }
  }
  /**
   * 记录用户行为埋点
   * @param {string} data - 活动类型
   */
  const getUserActive = async (data) => {
    await postUserActive({
      activeType: data,
    });
  };

  /**
   * 获取登记展示逻辑配置
   * 设置默认展示类型（单个或批量）
   */
  const getRegDisplayLogic = async () => {
    const res = await getDisplayLogic();
    if (res?.result) {
      setRegDisplayLogic(res.data);
      // 根据配置设置默认登记类型
      if (res.data?.defaultShowRegistrationType === "batch") {
        setRegistrationType(1); // 批量
      } else if (res.data?.defaultShowRegistrationType === "single") {
        setRegistrationType(0); // 单个
      }
    }
  };
    /** 查询登记设置（仅通过级联组件选择空间后调用，传入 currentProjectKey） */
  const getCapacity = async () => {
    try {
      const res = await getRegistrationSettings({ projectKey: currentProjectKey });
      setWorkDescRequired(res?.data?.workDescReq || 0);
      if (res?.result && Array.isArray(res.data.list) && res.data.list.length > 0 && res.data.list[0]) {
        // 安全地获取myselfStatus，避免访问不存在的属性
        const myselfStatus = res.data.list[0].myselfStatus;
        ingsConfigRef.current = myselfStatus;
        if (myselfStatus !== undefined) {
          setingsConfig(myselfStatus);
        } else {
          console.warn('登记设置中未找到myselfStatus属性');
        }
        // 保存登记设置数据，用于字段必填判断
        setRegistrationSettings(res.data.list[0]);
      } else {
        console.warn('登记设置数据格式不正确或为空');
      }
    } catch (error) {
      console.error('获取登记设置失败:', error);
      // 可以在这里添加错误状态设置或用户提示
    }
  };
  /**
   * 获取当前用户角色与模式（GET api/user/info），并据此驱动成员代填能力
   * 规则：
   *  1. 应用管理员(app_admin) + 租户模式(tenant)：
   *     - 调用 getUserStandWorkHour 获取上限下限
   *     - 调用 getProjectConfig 判断是否允许代填
   *     - 开启代填切换人员列表
   *  2. 空间管理员(space_admin) + 空间模式(space)：
   *     - 调用 getRegisterProjectKeyOption 查询所有空间
   *     - 当仅有一个空间且 isFillInOnBehalf 为 true 时，自动开启代填
   *  3. 普通用户(member)：成员选择框置灰禁用
   */
  const getRole = async () => {
    try {
      const res = await getUserRoleInfo();
      if (!res?.result || !res?.data) return;
      const userRole = res.data.userRole || "";
      const currentMode = res.data.mode || "";
      setMode(currentMode);
      getAttendanceConfigInfo(currentMode)
      // 同步角色到 sessionStorage，保持与原有 disabled 逻辑兼容
      sessionStorage.setItem("jwtMeegoTeamworkUserRole", userRole);

      // 读取缓存中的飞书用户信息，用于默认选中自己 / 普通用户信息展示
      let cacheUserInfo = null;
      try {
        const raw = localStorage.getItem("feishuUserInfo");
        if (raw) cacheUserInfo = JSON.parse(raw);
      } catch (e) {
        console.error("解析缓存 feishuUserInfo 失败:", e);
      }
      setFeishuUserInfo(cacheUserInfo);
      // 默认登记人选中自己（非编辑态）
      if (cacheUserInfo?.userKey && !props?.setRegistrationValue) {
        setRegistrantUserKey(cacheUserInfo.userKey);
        registrationForm.setFieldValue("registrantUserKey", cacheUserInfo.userKey);
      }else{
        if(props?.type === "web" || props?.type === "approval"){
          setRegistrantUserKey(props?.setRegistrationValue?.userKey || "");
          registrationForm.setFieldValue("registrantUserKey", props?.setRegistrationValue?.userKey || "");
        }
        if(props?.type === "web" || props?.type === "approval"){
          setRegistrantUserKey(props?.setRegistrationValue?.staffUserKey || "");
          registrationForm.setFieldValue("registrantUserKey", props?.setRegistrationValue?.staffUserKey || "");
        }
      }

      // 3. 普通用户：禁用成员选择框，且不开启代填；展示个人信息（取缓存 feishuUserInfo）
      if (userRole === "member") {
        setIsMemberRole(true);
        setIsAllowRegister(false);
        return;
      }
      setIsMemberRole(false);

      // 1. 应用管理员 + 租户模式
      if (currentMode === "tenant") {
        await getWorkHour();
        await getConfig();
        return;
      }

      // 2. 空间管理员 + 空间模式
      if (currentMode === "space") {
        const spaceRes = await getRegisterProjectKeyOption({registerUserKey:registrantUserKey});
        if (spaceRes?.result && Array.isArray(spaceRes.data)) {
          // 只要有一个空间允许代填，人员不禁填
          const hasAllowed = spaceRes.data.some((item) => item?.isFillInOnBehalf);
          setIsAllowRegister(hasAllowed);
        }
        return;
      }

      // 其他组合：保底走原代填配置判断
      await getConfig();
    } catch (error) {
      console.error("获取用户角色信息失败:", error);
    }
  };
    /**
   * 获取审批设置配置
   * 根据配置设置提交按钮的文本（提交或提交审批）
   * 租户模式：无论 enableApproval 如何，按钮文案始终为"提交"
   * 空间模式：根据 enableApproval 决定"提交"或"提交审批"
   */
  const getApprovalSettingsData = async (projectKey, isEdit = false) => {
    // 租户模式且非编辑态：直接设为"提交"，不调接口
    // 编辑态：无论什么模式都调接口，按实际 enableApproval 决定文案
    if (mode === "tenant" && !isEdit) {
      setSubmitBtnTxt("提交");
      return;
    }
    const pk = projectKey || sessionStorage.getItem('jwtMeegoTeamworkProjectKey');
    const res = await getApprovalSettings({ projectKey: pk });
    if (res?.result) {
      res?.data?.enableApproval ? setSubmitBtnTxt("提交审批") : setSubmitBtnTxt("提交");
    }
  }
  const getRequestRegistrantUserKey = () =>
    props?.type === "web"
      ? registrationForm.getFieldValue("registrantUserKey")
      : registrantUserKey;

  /** 获取个人工作饱和度提示 */
  const [remainingWork, setRemainingWork] = useState(0);
  const getAlertDetail = async () => {
    // projectKey 优先取级联选择器选中时记录的 currentProjectKey，回退到 sessionStorage
    if(props?.setRegistrationValue?.projectKey){

    }
    let projectKey = '0'
    if(props?.setRegistrationValue?.projectKey){
        projectKey = props?.setRegistrationValue?.projectKey
    }else{
       projectKey = currentProjectKey
    }
    console.log('projectKey:', projectKey,workItemValue,mode);
    if(mode === "space"){
      //JSSDK.toast.error('请先选择登记对象');
      if(!projectKey){
        return;
      }
    }else{
      projectKey =''
    }
    const data = {
      workDate: workDate,
      registrantUseKey: getRequestRegistrantUserKey(),
      projectKey,
    };
    let modifyType=''
    if(props?.setRegistrationValue && props?.type === "approval") {
      modifyType = props?.setRegistrationValue?.modifyType || '';
      data.registerRecordId = props?.setRegistrationValue?.registerRecordId || '';
    }
    const actWorkHour = registrationForm.getFieldValue("actWorkHour");
    await getUserAttendanceConfigData();
    const res = await getRegisterPersonSaturation(data);
    if (res?.result) {
      setRegWorkingHours(res.data.registeredWorkingHours);
      const _attendanceHours = Number(res.data.attendanceHours) || null;
      //setAttendanceHours(_attendanceHours);
      setRemainingWork(res.data.remainingWork);
      // 记录接口原始快照（以 workDate+userKey 为键），validator 依赖此快照计算 effectiveMax，
      // 不能用 alertDetail / alertDetailOld，因为它们会被 onValuesChange 增量计算覆盖。
      capacitySnapshotRef.current = {
        workDate,
        userKey: registrantUserKey,
        remainingWork: Number(res.data.remainingWork),
        registeredWorkingHours: Number(res.data.registeredWorkingHours) || 0,
        approvalingWork: Number(res.data.approvalingWork) || 0,
        dayUp: Number(capacitySet?.dayUp) || 24,
        logActualHour: Number(res?.data?.logActualHour) || 0,
      };
      // 始终以接口原始值作为 onValuesChange 增量计算的基线（rawData），不能用叠加了 actWorkHour 后的值，否则后续 keystroke 会重复累加
      const rawData = JSON.parse(JSON.stringify(res.data));
      setAlertDetailOld(rawData);
      // 情况1：有实际工时值，且非编辑模式或允许编辑改变提示
      if (actWorkHour && (!props?.setRegistrationValue || isEditChangeAlert)) {
        // 创建数据副本进行计算，避免直接修改响应数据
        const alertDetail = JSON.parse(JSON.stringify(res.data));
        // 记录接口原始值（饱和度与剩余工时计算均基于原值）
        const _origRegistered = Number(res.data.registeredWorkingHours) || 0;
        const _origApprovaling = Number(res.data.approvalingWork) || 0;
        const _dayUp = Number(capacitySet?.dayUp) || 24;
        // 判断是否是在编辑模式下，且日期与原始编辑日期相同
        const isSameDate = workDate === dayjs(props?.setRegistrationValue?.workDate).format("YYYY-MM-DD");
        if (isSameDate) {
          // 编辑审批与编辑工时日志保持一致：以打开弹窗时的工时为基准计算本次变化量
          let oldActWorkHour = Number(
            props?.type === "approval"
              ? props.setRegistrationValue?.actWorkHour
              : props.setRegistrationValue?.act_hour
          ) || 0;
          if(props?.type === "approval" && props?.setRegistrationValue && props?.setRegistrationValue?.modifyType==='edit') {
            oldActWorkHour = capacitySnapshotRef.current?.logActualHour || 0
          }
          if(props?.type === "approval" && props?.setRegistrationValue && props?.setRegistrationValue?.modifyType==='create') {
            oldActWorkHour = 0
          }
          const deltaActWorkHour = actWorkHour - oldActWorkHour;
          alertDetail.displayActWorkHour = Number(deltaActWorkHour.toFixed(2));
          alertDetail.registeredWorkingHours = _origRegistered + deltaActWorkHour;
        } else {
          // 日期变更（含新增）：拟提交工时 = 当前输入值
          alertDetail.displayActWorkHour = Number(actWorkHour);
          alertDetail.registeredWorkingHours = _origRegistered + Number(actWorkHour);
        }
        // 数值格式化
        alertDetail.registeredWorkingHours = Number((alertDetail.registeredWorkingHours || 0).toFixed(2));
        // 剩余可登记工时 = 根据场景计算
        // 场景1(考勤关闭): dayUp; 场景2(有考勤记录): 考勤工时; 场景3(缺卡-允许提交): 缺卡自定义上限; 场景4(缺卡-不允许提交): 0
        let _remainingBase;
        if (attendanceEnabled === 0) {
          _remainingBase = _dayUp;
        } else if (_attendanceHours !== null) {
          _remainingBase = _attendanceHours;
        } else if (missPunchPolicy === 2 && missPunchCustomLimit !== null) {
          _remainingBase = missPunchCustomLimit;
        } else {
          _remainingBase = 0;
        }
        alertDetail.remainingWork = Number(
          (_remainingBase - _origRegistered - _origApprovaling - (Number(alertDetail.displayActWorkHour) || 0)).toFixed(2)
        );
        // 更新快照中的剩余可登记工时为场景计算值，供校验器使用
        capacitySnapshotRef.current.remainingWork = alertDetail.remainingWork;
        // 工作饱和度 =（已登记工时 + 待审批工时 + 当前拟提交工时）÷ 标准工时 × 100%
        alertDetail.saturation = Number(
          (((_origRegistered + _origApprovaling + (Number(alertDetail.displayActWorkHour) || 0)) /
            (capacitySet?.standWorkHour || 8)) *
            100).toFixed(2)
        );
        // 更新用于显示的工时统计数据
        setAlertDetail(alertDetail);
        // 注意：alertDetailOld 始终保持接口原始值（作为 onValuesChange 增量计算的基线），此处不要覆盖
      } else {
        // 情况2：无实际工时值，或在编辑模式且不允许改变提示
        const _origRegistered = Number(res.data.registeredWorkingHours) || 0;
        const _origApprovaling = Number(res.data.approvalingWork) || 0;
        const _dayUp = Number(capacitySet?.dayUp) || 24;
        // 剩余可登记工时 = dayUp -（已登记 + 待审批 + 当前拟提交）
        // 饱和度 =（已登记 + 待审批 + 当前拟提交）÷ 标准工时 × 100%
        // 编辑态首次加载统一按工时日志逻辑展示：尚未修改时，本次变化量为 0
        
        const actHour = props.setRegistrationValue?.actWorkHour ?? props.setRegistrationValue?.act_hour;
        if (actHour !== undefined && actHour !== null) {
          res.data.displayActWorkHour = 0;
        }
        if(props?.type === "approval" && props?.setRegistrationValue && props?.setRegistrationValue?.modifyType==='edit') {
           let approval_actWorkHour = new Decimal(props.setRegistrationValue?.actWorkHour);
           let approval_displayActWorkHour = approval_actWorkHour.minus(capacitySnapshotRef.current?.logActualHour || 0).toFixed(2);
          res.data.displayActWorkHour = Number(approval_displayActWorkHour);
        }
        if(props?.type === "approval" && props?.setRegistrationValue && props?.setRegistrationValue?.modifyType==='create') {
          res.data.displayActWorkHour = props.setRegistrationValue?.actWorkHour
        }
        res.data.registeredWorkingHours = _origRegistered;
        // 剩余可登记工时 = 根据场景计算
        // 场景1(考勤关闭): dayUp; 场景2(有考勤记录): 考勤工时; 场景3(缺卡-允许提交): 缺卡自定义上限; 场景4(缺卡-不允许提交): 0
        let _remainingBase2;
        if (attendanceEnabled === 0) {
          _remainingBase2 = _dayUp;
        } else if (_attendanceHours !== null) {
          _remainingBase2 = _attendanceHours;
        } else if (missPunchPolicy === 2 && missPunchCustomLimit !== null) {
          _remainingBase2 = missPunchCustomLimit;
        } else {
          _remainingBase2 = 0;
        }
        res.data.remainingWork = Number((_remainingBase2 - _origRegistered - _origApprovaling - (Number(res.data.displayActWorkHour) || 0)).toFixed(2));
        // 更新快照中的剩余可登记工时为场景计算值，供校验器使用
        capacitySnapshotRef.current.remainingWork = res.data.remainingWork;
        res.data.saturation = Number((((_origRegistered + _origApprovaling + (Number(res.data.displayActWorkHour) || 0)) / (capacitySet?.standWorkHour || 8)) * 100).toFixed(2));
        // 直接使用响应数据作为显示数据
        setAlertDetail(JSON.parse(JSON.stringify(res.data)));
        // alertDetailOld 保持接口原始值，作为 onValuesChange 增量计算的基线
        setAlertDetailOld(rawData);
      }
      // 接口返回后，快照已更新，主动触发一次 actWorkHour 重校验，
      // 清除切日期/切成员时同步 validateFields 因快照未就绪产生的陈旧错误提示。
      // 用 setTimeout 放到下一个 tick，确保本次 ref/state 更新已提交。
      setTimeout(() => {
        if (registrationForm.getFieldValue('actWorkHour') !== undefined
            && registrationForm.getFieldValue('actWorkHour') !== null
            && registrationForm.getFieldValue('actWorkHour') !== '') {
          registrationForm.validateFields(['actWorkHour']).catch(() => {});
        }
      }, 0);
    }
  };

  useEffect(() => {
    if (workDate && registrantUserKey && "standWorkHour" in capacitySet) {
      getAlertDetail();
      // 不要在这里同步 validateFields：getAlertDetail 是 async，快照尚未就绪会误报。
      // 统一由 getAlertDetail 接口返回后的 setTimeout 触发重校验。
    } else {
      setAlertDetail({});
      setAlertDetailOld({});
    }
  }, [workDate, registrantUserKey, capacitySet, currentProjectKey]);

  /** 查询是否开启代填工时功能 */
  const getConfig = async () => {
    const data = {
      type: "ALLOW_ADMINISTRATORS_TO_REGISTER_OTHERS_WORKING_HOURS",
    };
    const res = await getProjectConfig(data);
    if (res?.result) {
      setIsAllowRegister(res.data?.value ? true : false);
    }
  };

  useEffect(() => {
    if (workItem?.length && workItem?.length > 2) {
      fetchNodeWorkHourSumData();
    }
  }, [JSON.stringify(workItem), registrantUserKey, currentProjectKey]);
  useEffect(() => {
    if (registrantUserKey){
      getWorkHour()
    } else {
    }
  }, [registrantUserKey, currentProjectKey]);
  // 登记人切换时，刷新 SpaceCascader 空间列表；并清除登记对象字段可能残留的校验错误
  useEffect(() => {
    if (
      prevRegistrantRef.current !== undefined &&
      prevRegistrantRef.current !== null &&
      prevRegistrantRef.current !== registrantUserKey
    ) {
      spaceCascaderRef.current?.reloadSpace?.();
      // 清除登记对象字段在之前校验（如点击提交）产生的错误提示，成员切换后不应保留
      registrationForm.setFields([
        { name: 'workItem', errors: [], warnings: [] },
      ]);
    }
    prevRegistrantRef.current = registrantUserKey;
  }, [registrantUserKey]);
  /**
   * 查询组织标准工时配置
   * 设置标准工时和容量配置信息
   */
  const [dayUp ,setDayUp] = useState(0);
    const [onceDown ,setOnceDown] = useState(0);
  const getWorkHour = async () => {
    const data = {
      userKey: getRequestRegistrantUserKey(),
      projectKey: currentProjectKey,
    };
    if(props?.setRegistrationValue?.projectKey){
        data.projectKey = props?.setRegistrationValue?.projectKey || '0'
    }
    const res = await getUserStandWorkHour(data);
    if (res?.result) {
      setDayUp(res.data.dayUp);
      setOnceDown(res.data.onceDown);
      setStandWorkHour(res.data.standWorkHour);
      setCapacitySet(res.data);
    } else {
      console.warn('[getWorkHour] 请求失败，未写入 capacitySet');
    }
  };
// getBatchStandWorkHourUser
  /** 查询工时登记节点总和（单项登记弹窗专用） */
  const fetchNodeWorkHourSumData = async () => {
    // projectKey 优先取级联选择器选中时记录的 currentProjectKey，回退到 sessionStorage
    const projectKey = currentProjectKey
      || sessionStorage.getItem('adminCurrentProjectKey')
      || sessionStorage.getItem('jwtMeegoTeamworkProjectKey')
      || '';

    // registrantUseKey 优先取当前登记人，回退到缓存 feishuUserInfo 的用户 key
    let cacheUserKey = '';
    try {
      const raw = localStorage.getItem('feishuUserInfo');
      if (raw) cacheUserKey = JSON.parse(raw)?.userKey || '';
    } catch (e) { /* ignore */ }

    // 新接口 /api/register/statistics/node/person 仅接收以下字段
    // 直接使用独立的 state 变量，避免不同入口下 workItem 数组结构（4段/5段）不一致导致的索引错位
    const data = {
      workItemId,
      workItemEntityId,
      nodeId,
      taskId,
      registrantUseKey: registrantUserKey || cacheUserKey,
      projectKey,
      // workDate,
    };
    const res = await getNodePersonStatistics(data);
    if (res?.code === 200 || res?.result) {
      setWorkItemInfo(res.data);
      setWorkItemName(
        `${res.data.workItemName}${
          res.data.workItemEntityName ? `/${res.data.workItemEntityName}` : ""
        }${res.data.nodeName ? `/${res.data.nodeName}` : ""}${
          res.data?.taskName ? `/${res.data.taskName}` : ""
        }`
      );
    }
    setSpinning(false);
  };

  const traverseTree = (node) => {
    let tree = [];
    const getStr = function (list) {
      list.forEach(function (row) {
        row.key = JSON.stringify(row);
        row.workDesc = "";
        row.taskDesc = "";
        if ("children" in row && row.children?.length) {
          getStr(row.children);
        }
      });
    };
    getStr(node);
    return node;
  };

  /**
   * 查看已登记工时明细
   * 检查是否已选择工作项，然后打开详情弹窗
   */
  const onWorkDetailClick = () => {
    const workItem = registrationForm.getFieldValue("workItem");
    if (!workItem) {
      JSSDK.toast.warning("请先选择登记对象");
      return;
    }
    setIsDetailOpen(true);
  };

  /** 工作项改变 */
  const onWorkItemChange = (value) => {
    //console.log('value',value);
    // 空值/reset 触发：直接清空返回
    if (!value || value.length === 0) {
      registrationForm.setFieldValue("workItem", []);
      setWorkItemInfo({});
      setIsShowDetailBtnOpen(false);
      setWorkItemId("");
      setWorkItemEntityId("");
      setNodeId("");
      setTaskId("");
      setCanSubmitByLevel(true);
      setCanSubmitByLevelInfo("");
      setWorkItem([]);
      return;
    }

    // value 结构（来自 SpaceCascader）：[projectKey, workItemId, workItemEntityId, nodeId, taskId]
    // 第 0 段是空间 projectKey，需跳过；真正的工作项相关字段从下标 1 开始

    // 层级验证：至少需要选到第 3 层（实例层，value[2]）
    if (!value[2]) {
      // 只选了前两层（空间+工作项）：保留级联选中态用于展示，但禁止提交
      setWorkItem(value);
      registrationForm.setFieldValue("workItem", value);
      setWorkItemId(value[1] || "");
      setWorkItemEntityId("");
      setNodeId("");
      setTaskId("");
      setWorkItemInfo({});
      setIsShowDetailBtnOpen(false);
      setCanSubmitByLevel(false);
      setCanSubmitByLevelInfo('');
      return;
    }

    // 选到了实例层及以上：正常保存
    setWorkItemId(value[1]);
    setWorkItemEntityId(value[2]);
    setNodeId(value[3]);
    setTaskId(value[4]);
    setWorkItem(value);
    registrationForm.setFieldValue("workItem", value);
    setCanSubmitByLevel(true);
    setCanSubmitByLevelInfo("");
  };

  /** 分页点击 */
  /**
   * 分页变化处理函数
   * @param {number} page - 当前页码
   * @param {number} pageSize - 每页显示条数
   */
  const onPaginationChange = (page, pageSize) => {
    if (workInstancePagination.pageSize !== pageSize) {
      // 更改页大小时重置为第一页
      setWorkInstancePagination({ ...{ pageSize, pageNum: 1 } });
    } else {
      // 仅更改页码
      setWorkInstancePagination({ ...{ pageSize, pageNum: page } });
    }
  };

  /**
   * 实际工时变化处理函数
   * 根据标准工时计算人天数
   * @param {number} e - 输入的实际工时
   */
  const onActWorkHour = (e) => {
    if (!standWorkHour) return;
    if (e === null || e === undefined || e === '') {
      setActDay('');
    } else {
      setActDay((e / standWorkHour).toFixed(2));
    }
  };

  /** 时间改变 */
  /**
   * 时间范围变化处理函数
   * @param {Array} date - 日期对象数组
   * @param {Array} dateString - 日期字符串数组
   */
  const onTimeChange = (date, dateString) => {
    setBeginTime(dateString[0]);
    setEndTime(dateString[1]);
  };

  /**
   * 工作日期变化处理函数
   * @param {Object} date - 日期对象
   * @param {string} dateString - 日期字符串
   */
  const onWorkDateChange = (date, dateString) => {
    if (!date) return;
    setWorkDate(date.$d);
  };

  /**
   * 工时登记提交处理函数
   * @param {Object} values - 表单提交的值
   */
  const onRegistrationOk = async (values) => {
    setSubmitLoadings(true);
    // 仅处理单个登记类型
    if (registrationType === "single") {
      // 判断是否为编辑模式
      if (registrationForm.getFieldValue("id")) {
        // 审批模式下的编辑处理
        if (props?.type === "approval") {
          await handleApprovalEdit(values);
        } else {
          // 普通模式下的编辑处理
          await handleNormalEdit(values);
        }
      } else {
        // 新增工时登记
        await handleNewRegistration(values);
      }
    }
    
    setSubmitLoadings(false);
  };

  /**
   * 处理审批模式下的编辑操作
   * @param {Object} values - 表单值
   */
  const handleApprovalEdit = async (values) => {
    const data = {
      projectKey: props?.setRegistrationValue?.projectKey || '',
      id: registrationForm.getFieldValue("id"),
      type: "again_launch",
      actWorkHour: values?.actWorkHour,
      workDesc: values?.workDesc,
      workDate: values?.workDate,
      modifyType: values?.modifyType,
      customFieldValue: props?.setRegistrationValue?.customFieldValue ?? null,
    };
    
    const res = await postApproveHandle(data);
    if (res?.result) {
      JSSDK.toast.success("编辑成功");
      props.getRegistrationValue(true);
      registrationForm.resetFields();
    } else {
      // 处理特定错误码，避免重复提示
      if(res?.data?.code){
        if (![10024, 10025, 30068, 30073, 30074, 30075].includes(res?.data?.code)) {
          JSSDK.toast.warning("编辑失败，请重试");
        }
      }
    }
  };

  /**
   * 处理普通模式下的编辑操作
   * @param {Object} values - 表单值
   */
  const handleNormalEdit = async (values) => {
    const data = {
      id: registrationForm.getFieldValue("id"),
      workItemId,
      workItemEntityId,
      nodeId,
      taskId,
      actWorkHour: values.actWorkHour,
      workDesc: values.workDesc,
      workDate: values.workDate,
      taskHourId: props.setRegistrationValue.taskHourId,
      registrantUserKey: values?.registrantUserKey,
      customFieldValue: props?.setRegistrationValue?.customFieldValue ?? null,
    };
    
    const res = await postUpdateNodeWorkHour(data);
    if (res?.result) {
      JSSDK.toast.success("编辑成功");
      props.getRegistrationValue(true);
      registrationForm.resetFields();
    } else {
      // 处理特定错误码，避免重复提示
      if(res?.data?.code){
        if (![10024, 10025, 30068, 30073, 30074, 30075].includes(res?.data?.code)) {
          JSSDK.toast.warning("编辑失败，请重试");
        }
      }
    }
  };

  /**
   * 处理新增工时登记
   * @param {Object} values - 表单值
   */
  const handleNewRegistration = async (values) => {
    // 新增时校验：级联选择器不能只选到实例层级，必须至少选到节点或任务层级
    // if (!nodeId && !taskId) {
    //   JSSDK.toast.warning('请继续选择至节点或任务层级，不能只停留在实例层级');
    //   setSubmitLoadings(false);
    //   return;
    // }
    // 将值转成数字；无法转换（如占位符 "--"）时返回 null，避免提交 NaN
    const toNumberOrNull = (v) => {
      const n = Number(v);
      return Number.isNaN(n) ? null : n;
    };
    // projectKey 优先取级联选择器选中的空间，回退到当前空间缓存
    const projectKey = currentProjectKey
      || sessionStorage.getItem('adminCurrentProjectKey')
      || sessionStorage.getItem('jwtMeegoTeamworkProjectKey')
      || '';
    const data = {
      projectKey,
      projectName: currentProjectName,
      workItemId,
      workItemEntityId,
      nodeId,
      taskId,
      actWorkHour: values.actWorkHour,
      workDesc: values.workDesc,
      // workDate 统一转成 ISO 格式（如 2026-06-09T16:00:00.000Z），避免序列化成 GMT 字符串
      workDate: values.workDate ? dayjs(values.workDate).toISOString() : values.workDate,
      staffUserKey: values?.registrantUserKey,
      registrantUserKey: values?.registrantUserKey,
      // 排期：无有效排期或 1970-01-01 占位值时统一传 null
      schedule: workItemInfo?.schedule && !workItemInfo.schedule.includes('1970-01-01')
        ? workItemInfo.schedule
        : null,
      // 预估工时为 "--/--" 等占位时 Number() 会得到 NaN，统一兜底为 null
      estimatedWorkingHoursAll: toNumberOrNull(
        workItemInfo?.estimatedWorkingHours?.split("/")[0]
      ),
      estimatedWorkingHoursSelf: toNumberOrNull(
        workItemInfo?.estimatedWorkingHours?.split("/")[1]
      ),
      estimatedWorkingHours: workItemInfo?.estimatedWorkingHours,
      workItemName: registeredName?.workItemName,
      workItemEntityName: registeredName?.workItemEntityName,
      nodeName: registeredName?.nodeName,
      taskName: registeredName?.taskName,
      customFieldValue: selectedCustomFieldValue ?? null,
    };
    
    const res = await postInsertNodeWorkHour(data);
    if (res?.result) {
      JSSDK.toast.success(`${submitBtnTxt}成功`);
      registrationForm.resetFields();
      props.getRegistrationValue(true);
      
      // 记录用户操作行为
      if (props?.point === "control") {
        getUserActive("ControlActBatchRegistrationWorkingHours");
      } else {
        getUserActive("PageActOnceRegistrationWorkingHours");
      }
    } else {
      // 处理特定错误码，避免重复提示
      if(res?.data?.code){
        if (![10024, 10025, 30068, 30073, 30074, 30075].includes(res?.data?.code)) {
          JSSDK.toast.warning(`${submitBtnTxt}失败，请重试`);
        }
      }
    }
  };

  /**
   * 取消工时登记
   * 重置表单并通知父组件关闭
   */
  const onRegistrationCancel = () => {
    registrationForm.resetFields();
    props.getRegistrationValue(false);
  };

  /**
   * 选择被登记人处理函数
   * @param {string} val - 选择的用户ID
   */
  const onSearchPersonChange = (val) => {
    if (val) {
      // 先设置用户
      setRegistrantUserKey(val);
      registrationForm.setFieldValue("registrantUserKey", val);
    
      if(props?.point === "control"){
        const { workItem, registeredName, loginUser } = props;
        const queryData = {
          workItem: {
            workItemEntityId: workItem.workItemEntityId,
            workItemId: workItem.workItemId,
          },
          loginUser: {
            id:val ,
          }
        };
        // 调用API获取工作项实例选项数据
      
          if(workItem?.nodeId){
          return getEntityNodeOption(queryData);
          }else{
         return  getItemEntityOptio(queryData);
          }
       

        // getEntityNodeOptionNew(queryData);
      }

      // 切换人员时清空登记对象及相关数据
      if (workNodeSelectRef.current && typeof workNodeSelectRef.current.resetSelection === 'function') {
        workNodeSelectRef.current.resetSelection();
      }
      // 清空 SpaceCascader 选择及缓存
      if (spaceCascaderRef.current && typeof spaceCascaderRef.current.reset === 'function') {
        spaceCascaderRef.current.reset();
      }

      // 全面清空本地状态和表单
      setWorkItem([]); // 清空本地状态
      registrationForm.setFieldValue("workItem", []); // 清空表单
      setCurFlowType(null); // 清空流程类型
      setRegisteredName(''); // 清空已登记名称
      setWorkItemInfo({}); // 清空工作项信息
      setWorkItemId(""); // 清空工作项ID
      setWorkItemEntityId(""); // 清空工作项实体ID
      setNodeId(""); // 清空节点ID
      setTaskId(""); // 清空任务ID
      onWorkItemChange([]); // 通知父组件
      setIsShowDetailBtnOpen(false); // 隐藏详情按钮
    } else {
      // 未选择用户时默认设置为当前登录用户（props.loginUser.id 缺失时回退到 localStorage feishuUserInfo）
      const fallbackId = props?.loginUser?.id || (() => {
        try { return JSON.parse(localStorage.getItem('feishuUserInfo'))?.userKey; } catch (_) { return ''; }
      })();
      setRegistrantUserKey(fallbackId);
      registrationForm.setFieldValue("registrantUserKey", fallbackId);
    }
  };

  const onValuesChange = (values, allValues) => {
    //  成员判断，如果没成员为空自动变更为当前填报人
    if (!allValues.registrantUserKey) {
      const fallbackId = props?.loginUser?.id || (() => {
        try { return JSON.parse(localStorage.getItem('feishuUserInfo'))?.userKey; } catch (_) { return ''; }
      })();
      setRegistrantUserKey(fallbackId);
      registrationForm.setFieldValue("registrantUserKey", fallbackId);
    } else {
      setRegistrantUserKey(allValues.registrantUserKey);
    }
    if (values?.actWorkHour) {
      values.actWorkHour = Number(values?.actWorkHour.toFixed(2));
      registrationForm.setFieldValue(
        "actWorkHour",
        Number(values?.actWorkHour.toFixed(2))
      );
    }
    // 计算人员饱和度咯...
    if ("actWorkHour" in values && allValues?.workDate) {
      // 标记输入框是否被清空（null/undefined/空字符串）
      const isInputEmpty = values.actWorkHour === null || values.actWorkHour === undefined || values.actWorkHour === '';
      // 计算用工时值：清空时按 0 参与运算
      const calcActWorkHour = isInputEmpty ? 0 : (values.actWorkHour || 0);
      let actWorkHour = new Decimal(calcActWorkHour);
      let registeredWorkingHours = new Decimal(
        alertDetailOld?.registeredWorkingHours ?? 0
      );
      let remainingWork = new Decimal(
        alertDetailOld?.remainingWork ?? 0
      );
      let displayActWorkHour;
      let deltaActWorkHour;
      const isEdit = !!props?.setRegistrationValue;
      const editWorkDate = isEdit
        ? dayjs(props?.setRegistrationValue?.workDate).format("YYYY-MM-DD")
        : null;
      const currentWorkDate = dayjs(allValues?.workDate).format("YYYY-MM-DD");
      const isSameDate = isEdit && currentWorkDate === editWorkDate;
      // 先判断是否是编辑状态
      if (!isEdit) {
        // 非编辑状态：拟提交工时 = 当前输入值；清空时显示 null（--），计算用 0
        displayActWorkHour = isInputEmpty ? null : actWorkHour;
        deltaActWorkHour = actWorkHour;
      } else {
        if (isSameDate) {
          // 日期一致：拟提交工时 = 当前输入 - 上一次登记（保留符号，负数表示减少）；清空时按 0 - oldHour 计算，但显示 null（--）
          let oldActWorkHour = new Decimal(
            (props?.type === "approval"
              ? props.setRegistrationValue?.actWorkHour
              : props.setRegistrationValue?.act_hour) ?? 0
          );
           if(props?.type === "approval" && props?.setRegistrationValue && props?.setRegistrationValue?.modifyType==='edit') {
              oldActWorkHour = capacitySnapshotRef.current?.logActualHour || 0;
          }
          if(props?.type === "approval" && props?.setRegistrationValue && props?.setRegistrationValue?.modifyType==='create') {
              deltaActWorkHour = actWorkHour;
          }else{
              deltaActWorkHour = actWorkHour.minus(oldActWorkHour);
          }
          displayActWorkHour = isInputEmpty ? null : deltaActWorkHour;
        } else {
          // 日期不一致：按新增逻辑；清空时显示 null（--）
          displayActWorkHour = isInputEmpty ? null : actWorkHour;
          deltaActWorkHour = actWorkHour;
        }
      }
      // 拟提交工时：清空时为 null（页面显示 --），否则为数值
      alertDetail.displayActWorkHour = displayActWorkHour === null ? null : displayActWorkHour.toNumber();
      // 剩余可登记工时 = 根据场景计算
      // 场景1(考勤关闭): dayUp; 场景2(有考勤记录): 考勤工时; 场景3(缺卡-允许提交): 缺卡自定义上限; 场景4(缺卡-不允许提交): 0
      // 饱和度 =（已登记工时 + 待审批工时 + 当前拟提交工时）÷ 标准工时 × 100%
      // 其中已登记工时与待审批工时均取接口返回的原始值（alertDetailOld），不做增量
      const originRegistered = Number(alertDetailOld?.registeredWorkingHours) || 0;
      const approvalingWork = Number(alertDetailOld?.approvalingWork) || 0;
      // 计算用 pendingWork：清空时按 0 算，否则用 displayActWorkHour
      const pendingWork = displayActWorkHour === null ? 0 : (Number(displayActWorkHour.toNumber ? displayActWorkHour.toNumber() : displayActWorkHour) || 0);
      const _dayUp = Number(capacitySet?.dayUp) || 24;
      // 确定剩余可登记工时基数
      let _remainingBase;
      if (attendanceEnabled === 0) {
        _remainingBase = _dayUp;
      } else if (attendanceHours !== null) {
        _remainingBase = attendanceHours;
      } else if (missPunchPolicy === 2 && missPunchCustomLimit !== null) {
        _remainingBase = missPunchCustomLimit;
      } else {
        _remainingBase = 0;
      }
      alertDetail.registeredWorkingHours = Number(
        (originRegistered + (isSameDate ? deltaActWorkHour.toNumber() : actWorkHour.toNumber())).toFixed(2)
      );
      alertDetail.remainingWork = Number(
        (_remainingBase - originRegistered - approvalingWork - pendingWork).toFixed(2)
      );
      alertDetail.saturation = Number(
        (((originRegistered + approvalingWork + pendingWork) / (capacitySet?.standWorkHour || 8)) * 100).toFixed(2)
      );
      setAlertDetail({ ...alertDetail });
    }
    if (values?.workDate) {
      if (props?.setRegistrationValue) setIsEditChangeAlert(true);
      setWorkDate(dayjs(values?.workDate).format("YYYY-MM-DD"));
    }
    if (!allValues?.workDate) {
      setWorkDate("");
    }
    // 编辑态：根据是否有字段变化控制提交按钮可用性
    // 统一对字段做归一化比较，避免因 undefined/null/'' 与类型不一致导致判断失误
    if (props?.setRegistrationValue) {
      const orig = props.setRegistrationValue;
      const curActNum = Number(allValues.actWorkHour);
      const origActNum = Number(
        props?.type === "approval"
          ? (orig.actWorkHour ?? 0)
          : (orig.act_hour ?? 0)
      );
      const curDateStr = allValues.workDate ? dayjs(allValues.workDate).format("YYYY-MM-DD") : '';
      const origDateStr = orig.workDate ? dayjs(orig.workDate).format("YYYY-MM-DD") : '';
      const curDesc = allValues.workDesc ?? '';
      const origDesc = orig.workDesc ?? '';
      const isChanged =
        curActNum !== origActNum ||
        curDateStr !== origDateStr ||
        curDesc !== origDesc;
      setSubmitBtnDisabled(!isChanged);
    }
  };

  return (
    <div className="registration-warp" style={{overflowY:"hidden"}}>
      <Spin spinning={spinning} style={{ height: "100%" }}>
        {/* {props.setRegistrationValue || props?.point === "control" ? null : (
          <Radio.Group
            value={registrationType}
            onChange={(e) => setRegistrationType(e.target.value)}
            className="registration-top"
          >
            {regDisplayLogic?.showSingleRegistration ? (
              <Radio value="single">单项工作登记</Radio>
            ) : null}
            {regDisplayLogic?.showBatchRegistration ? (
              <Radio value="batch">批量登记工时</Radio>
            ) : null}
          </Radio.Group>
        ) : null} */}
        {registrationType === "batch" ? (
          <div
            className="registration-content"
            style={{
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
              <RegWorkHourBatchNew
                {...props}
                loginUser={props?.loginUser}
                type="regWorkHour"
                getRegistrantUserKey={(val) => setRegistrantUserKey(val)}
                setSubmitLoadings={(val) => setSubmitLoadings(val)}
                setSaveHourLoadings={(val) => setSaveHourLoadings(val)}
                submitLoadings={submitLoadings}
                saveHourLoadings={saveHourLoadings}
                submitResult={(val) => {
                  if (val==2 && props?.openType !== "again_launch") {JSSDK.toast.success(`${submitBtnTxt}成功`)};
                  if (val==1) {props?.openType === "tab"? JSSDK.toast.success(`已暂存`):JSSDK.toast.success(`已暂存，下次打开将自动恢复`)};
                  props.getRegistrationValue(val);
                }}
              />
            </div>
            <div
              className="content-footer"
              style={{ marginTop: 12, textAlign: "right" }}
            >
              <Space>
                <Button onClick={onRegistrationCancel}>取消</Button>
                {props?.openType === "again_launch" ? null : (
                  <Button
                  loading={saveHourLoadings}
                  onClick={() => setSaveHourLoadings(true)}
                >
                  暂存
                </Button>
                )}
                <Button
                  loading={submitLoadings}
                  type="primary"
                  onClick={() => setSubmitLoadings(true)}
                >
                  {submitBtnTxt}
                </Button>
              </Space>
            </div>
          </div>
        ) : (
	   <div style={{ height:'100%',overflowY:'auto',paddingRight:'5px'}}>
          <Form
            form={registrationForm}
            name="basic"
            labelCol={{
              span: 6,
            }}
            wrapperCol={{
              span: 18,
            }}
            initialValues={{
              remember: true,
            }}
            onFinish={onRegistrationOk}
            autoComplete="off"
            labelAlign="left"
            className="reg-form"
            onValuesChange={onValuesChange}
          >
            <Alert
              className="registration-alert"
              message={
                <>
                   <div>
                  该成员当前工作日期
                  {/* tenant模式 + 考勤开启 + 未选日期 + 无考勤数据 → 显示"考勤工时 -- 小时" */}
                  {attendanceEnabled === 1 && mode !== 'space' && !workDate && attendanceHours === null && (
                    <span>考勤工时<span className="num">--小时</span>，</span>
                  )}
                  {/* 考勤开启 + 已选日期 + 有考勤记录；space模式额外要求登记对象有值 */}
                  {attendanceEnabled === 1 && workDate && attendanceHours !== null && (mode !== 'space' || (
                    workItemValue !== undefined && workItemValue !== null
                    && Array.isArray(workItemValue) && workItemValue.length > 0
                    && !workItemValue.every(v => v === undefined || v === null || v === '')
                  )) && (
                    <span>考勤工时<span className="num">{typeof attendanceHours === "number" ? attendanceHours : "--"}小时</span>，</span>
                  )}
                  {/* 考勤开启 + 已选日期 + 缺卡(允许提交)；space模式额外要求登记对象有值 */}
                  {attendanceEnabled === 1 && workDate && attendanceHours === null && missPunchPolicy === 2 && (mode !== 'space' || (
                    workItemValue !== undefined && workItemValue !== null
                    && Array.isArray(workItemValue) && workItemValue.length > 0
                    && !workItemValue.every(v => v === undefined || v === null || v === '')
                  )) && (
                    <span>无考勤记录，</span>
                  )}
                  {/* 考勤开启 + 已选日期 + 缺卡(不允许提交)；space模式额外要求登记对象有值 */}
                  {attendanceEnabled === 1 && workDate && attendanceHours === null && missPunchPolicy === 1 && (mode !== 'space' || (
                    workItemValue !== undefined && workItemValue !== null
                    && Array.isArray(workItemValue) && workItemValue.length > 0
                    && !workItemValue.every(v => v === undefined || v === null || v === '')
                  )) && (
                    <span>无考勤记录，暂不可登记工时，</span>
                  )}
                  已登记工时
                  <span className="num">
                    {typeof regWorkingHours === "number"
                      ? regWorkingHours
                      : "--"}
                    小时
                  </span>
                  ，待审批工时  <span className="num">
                    {typeof alertDetail?.approvalingWork === "number"
                      ? alertDetail?.approvalingWork
                      : "--"}
                    小时
                  </span>
                   
                  <Tooltip
                    placement="bottom"
                    title={
                      <>
                        <div>
                         已登记工时：指该「成员」在当前「工作日期」成功登记的工时（已经在工时日志的工时）
                        </div>
                        <div>
                         待审批工时：指该「成员」在当前「工作日期」下处于待审批状态的工时
                        </div>
                        <div>
                         当前拟提交工时：指该「成员」在当前「工作日期」，正准备提交的工时
                        </div>
                         <div>
                         剩余可登记工时：「单天填报工时上限」减去该「成员」在当前「工作日期」的「已登记工时」「待审批工时」及「当前拟提交工时」之和
                        </div>
                         <div>
                        工作饱和度：（该「成员」在当前「工作日期」的「已登记工时」+「待审批工时」+「当前拟提交工时」）÷「单位人天标准工时」× 100%
                        </div>
                      </>
                    }
                  >
                    <InfoCircleFilled className="icon" />
                  </Tooltip>
                  
                </div>
                <div>
                当前拟提交工时  <span className="num">
                    {typeof alertDetail?.displayActWorkHour === "number"
                      ? alertDetail.displayActWorkHour
                      : "--"}
                    小时
                  </span> 
                  ，剩余可登记工时
                  <span className="num">
                    {typeof alertDetail?.remainingWork === "number"
                      ? alertDetail?.remainingWork
                      : "--"}
                    小时
                  </span>
                  ，工作饱和度
                  <span className="num">
                    {typeof alertDetail?.saturation === "number"
                      ? alertDetail?.saturation
                      : "--"}
                    %
                  </span>
                 {attendanceEnabled === 1 && workDate && (mode !== 'space' || (
                    workItemValue !== undefined && workItemValue !== null
                    && Array.isArray(workItemValue) && workItemValue.length > 0
                    && !workItemValue.every(v => v === undefined || v === null || v === '')
                  )) && <span className="attattendance-sync-btn">同步考勤</span>}

                </div>
                </>
                
                
              }
              type="info"
              showIcon
            />
            <Form.Item
              label="登记对象"
              name="workItem"
              // 不在字段变更/级联选择过程中触发校验（避免选中中间层级时错误提示短暂出现导致输入框下移抖动），
              // 提交时 antd Form 会自动对所有字段做校验，无需依赖 validateTrigger
              validateTrigger={props?.disableWorkItemValidate ? [] : []}
              rules={
                props?.disableWorkItemValidate
                  ? []
                  : [{
                      required: true,
                      validator: (_, value) => {
                        // 1. 空值判断：undefined/null/非数组/空数组/全空都视为未选择
                        const isEmpty = value === undefined || value === null
                          || !Array.isArray(value)
                          || value.length === 0
                          || value.every(v => v === undefined || v === null || v === '');
                        if (isEmpty) {
                          return Promise.reject(new Error('登记对象不能为空'));
                        }
                        // 2. 深度判断：至少选到实例层（第3层，value[2] 为 workItemEntityId）
                        //    仅选到空间(value.length=1) 或 工作项(value.length=2) 视为不完整
                        if (value.length < 3 || !value[2]) {
                          return Promise.reject(new Error('请继续选择至工作项实例、节点或任务层级'));
                        }
                        return Promise.resolve();
                      },
                    }]
              }
            >
              <SpaceCascader
                ref={spaceCascaderRef}
                placeholder="请输入登记对象"
                minDisplayValidLen={3}
                disabled={!canRegister || !!props?.setRegistrationValue}
                onDropdownVisibleChange={(open) => {
                  setCascaderDropdownOpen(open);
                  if (open) {
                    // 面板打开：立即隐藏提示，并清除待执行的延迟定时器
                    if (levelHintTimerRef.current) {
                      clearTimeout(levelHintTimerRef.current);
                      levelHintTimerRef.current = null;
                    }
                    setShowLevelHint(false);
                  } else {
                    // 面板关闭：延迟1秒后再展示校验提示，给用户留出操作后的视觉缓冲
                    levelHintTimerRef.current = setTimeout(() => {
                      setShowLevelHint(true);
                      levelHintTimerRef.current = null;
                    }, 1000);
                  }
                }}
                displayNames={[
                  props?.setRegistrationValue?.projectName,
                  props?.setRegistrationValue?.workItemName,
                  props?.setRegistrationValue?.workItemEntityName,
                  props?.setRegistrationValue?.nodeName,
                  props?.setRegistrationValue?.taskName,
                ]}
                fetchSpaceOptions={async () => {
                  const res = await getRegisterProjectKeyOption({registerUserKey:registrantUserKey});
                  if (res?.result && Array.isArray(res.data)) {
                    const currentUserId = String(props?.loginUser?.id || feishuUserInfo?.userKey);
                    const isSelf = String(registrantUserKey) === currentUserId;
                    // 非自己时，过滤掉不允许代填的空间
                    if (!isSelf) {
                      if (localStorage.getItem('meegoTeamworkAppMode') === 'space') {
                        const filtered = res.data.filter((item) => item?.isFillInOnBehalf);
                        return { ...res, data: filtered };
                      }
                    }
                  }
                  return res;
                }}
                fetchWorkItemOptions={async (projectKey) => {
                  return await getRegisterWorkItemOption({ projectKey, registerUserKey: registrantUserKey });
                }}
                fetchEntityOptions={async (projectKey, workItemId, pageNum) => {
                  return await getRegisterItemEntityOption({ projectKey, workItemId, pageNum, pageSize: 20, registerUserKey: registrantUserKey });
                }}
                fetchNodeOptions={async (projectKey, workItemId, workItemEntityId) => {
                  return await getRegisterEntityNodeOption({ projectKey, workItemId, workItemEntityId, registerUserKey: registrantUserKey });
                }}
                onChange={(ids, names, selectedOptions) => {
                  // 同步本地 workItem state（其他逻辑依赖该 state，如 useEffect 监听 JSON.stringify(workItem)）
                  setWorkItem(ids || []);
                  // ids: [projectKey, workItemId, workItemEntityId, nodeId, taskId]
                  // 单独保存空间 key，给单项登记的统计接口（getNodePersonStatistics）用
                  setCurrentProjectKey(ids?.[0] || '');
                  setCurrentProjectName(names?.spaceName || '');
                  const selectedEntity = selectedOptions?.[2];
                  setSelectedCustomFieldValue(
                    selectedEntity?.raw?.customFieldValue
                      ?? selectedEntity?.customFieldValue
                      ?? null
                  );
                  onWorkItemChange(ids);
                  // 第一层空间选中时，根据 describe 控制工作描述必填，enableApproval 控制按钮文案
                  const spaceRaw = selectedOptions?.[0]?.raw;
                  // describe 控制工作描述 * 号展示
                  if (spaceRaw && 'describe' in spaceRaw) {
                    const describeRequired = spaceRaw.describe === true;
                    setWorkDescRequired(describeRequired ? 1 : 0);
                  } else {
                    setWorkDescRequired(0);
                  }
                  // enableApproval 控制按钮文案，不区分模式
                  if (spaceRaw && 'enableApproval' in spaceRaw) {
                    const enableApproval = spaceRaw.enableApproval !== false;
                    setSubmitBtnTxt(enableApproval ? "提交审批" : "提交");
                  } else {
                    setSubmitBtnTxt("提交");
                  }
                  // 需要获取最后一层的 registeredName 信息用于权限验证
                  if (selectedOptions && selectedOptions.length > 0) {
                    const lastSelected = selectedOptions[selectedOptions.length - 1];
                    if (lastSelected?.raw) {
                      setRegisteredName({
                        ...lastSelected.raw,
                        canRegister: lastSelected.raw.canRegister !== false,
                        canRegisterLevel: lastSelected.raw.canRegisterLevel !== false,
                        workItemName: names.workItemName || '',
                        workItemEntityName: names.workItemEntityName,
                        nodeName: names.nodeName,
                        taskName: names.taskName,
                      });
                    }
                  } else {
                    setRegisteredName({});
                  }
                }}
              />
               {!canRegister && showLevelHint && (
                  <p style={{color: '#df000e', margin: '5px 0'}}>
                 非当前登记用户的负责人，无法登记
                  </p>
               )}
              {/* JSSDK.toast.success(`已暂存，下次打开将自动恢复`) */}
            </Form.Item>
            {/* 级联面板打开期间及关闭后2.5秒内隐藏层级校验提示，避免切换/关闭时提示显隐导致下方表单元素抖动 */}
            {canRegister && !canSubmitByLevel && showLevelHint && canSubmitByLevelInfo && (
               <p style={{color: '#df000e', margin: '8px 0 5px 174px'}}>
                  {canSubmitByLevelInfo}
                  </p>
            )}
            <Form.Item label="排期">
              {workItemInfo?.schedule && !workItemInfo.schedule.includes('1970-01-01')
                ? workItemInfo.schedule
                : "--"}
            </Form.Item>
            <Form.Item
              label={
                <div className="form-item-label">
                  <span className="label-txt">预估工时</span>
                  <Tooltip
                    title={
                      <>
                        <div>
                          前者：指个人的预估工时，即当前「成员」在当前「登记对象」的「估分」
                        </div>
                        <div>
                          后者：指当前工作项/节点/任务的总预估工时，即当前的「登记对象」的总「估分」
                        </div>
                      </>
                    }
                  >
                    <InfoCircleFilled className="label-icon" />
                  </Tooltip>
                </div>
              }
            >
              {workItemInfo?.estimatedWorkingHours
                ? workItemInfo?.estimatedWorkingHours
                : "--/--"}
            </Form.Item>
            <Form.Item
              label={
                <div className="form-item-label">
                  <span className="label-txt">已登记工时</span>
                  <Tooltip
                    title={
                      <>
                        <div>
                          前者：指个人已登记的总实际工时，即当前「成员」在当前「登记对象」已登记的总「实际工时」
                        </div>
                        <div>
                          后者：指当前工作项/节点/任务已登记的总实际工时，即当前「登记对象」已登记的总「实际工时」
                        </div>
                      </>
                    }
                  >
                    <InfoCircleFilled className="label-icon" />
                  </Tooltip>
                </div>
              }
            >
              {workItemInfo?.registeredWorkingHours ? (
                <>
                  {workItemInfo?.registeredWorkingHours}
                  {workItemInfo?.registered ? (
                    <Button type="link" onClick={onWorkDetailClick}>
                      查看明细
                    </Button>
                  ) : null}
                </>
              ) : (
                "--/--"
              )}
            </Form.Item>
            <Form.Item
              label={
                <div className="form-item-label">
                  <span className="label-txt">剩余工时</span>
                  <Tooltip title="计算方式：「剩余工时」 = 「预估工时」 - 「已登记工时」">
                    <InfoCircleFilled className="label-icon" />
                  </Tooltip>
                </div>
              }
            >
              {workItemInfo?.remainingWork
                ? workItemInfo?.remainingWork
                : "--/--"}
            </Form.Item>
            <Form.Item
              label="工作日期"
              name="workDate"
              rules={[
                {
                  required: true,
                  message: "工作日期不能为空",
                },
              ]}
            >
            <DatePicker size="small" disabled={!canRegister || (!canSubmitByLevel && !props?.setRegistrationValue) || props?.setRegistrationValue?.canRegisterLevel === false || props?.currItem?.noCanRegisterWorkItem} onChange={() => {
              // 不要在这里同步 validateFields：此时 workDate state 尚未更新、新日期的饱和度接口未返回，
              // capacitySnapshotRef 仍是旧日期数据，会误报"超过上限"。
              // 改为：useEffect 在 workDate 变更后调用 getAlertDetail，接口返回并写入快照后，
              // 由 getAlertDetail 结尾的 setTimeout 统一触发重校验。
            }}/>
            </Form.Item>
            <Form.Item
              label="成员"
              name="registrantUserKey"
              rules={[
                {
                  required: true,
                  message: "成员不能为空",
                },
              ]}
            >
              {props.setRegistrationValue ? (
                <div
                  style={{
                    width: "inherit",
                    padding: "0 7px",
                    background: "rgba(0, 0, 0, 0.04)",
                    color: "#BBBBBB",
                    border: "1px solid #EDEDED",
                    borderRadius: "6px",
                    lineHeight: "25px",
                  }}
                >
                  <div className="selected-item">
                    <Avatar
                      className="selected-item-icon"
                      size={20}
                      src={props.setRegistrationValue?.avatarUrl}
                      icon={<img alt="" src={UserOutlined} />}
                    />
                    <span className="selected-item-name">
                      {props.setRegistrationValue?.userName}
                    </span>
                  </div>
                </div>
              ) : isMemberRole ? (
                // 普通用户：成员选择框置灰禁用，展示本人信息（取缓存 feishuUserInfo）
                <div
                  style={{
                    width: "inherit",
                    padding: "0 7px",
                    background: "rgba(0, 0, 0, 0.04)",
                    color: "#BBBBBB",
                    border: "1px solid #EDEDED",
                    borderRadius: "6px",
                    lineHeight: "25px",
                  }}
                >
                  <div className="selected-item">
                    <Avatar
                      className="selected-item-icon"
                      size={20}
                      src={feishuUserInfo?.avatarUrl}
                      icon={<UserOutlined />}
                    />
                    <span className="selected-item-name">
                      {feishuUserInfo?.nameCn ||
                        feishuUserInfo?.nameEn ||
                        feishuUserInfo?.username ||
                        "--"}
                    </span>
                  </div>
                </div>
              ) : (
                <UserPicker
                  size="small"
                  loginUser={props?.loginUser}
                  disabled={
                    !isAllowRegister // 未开启代填时禁用
                    // !canRegister
                  }
                  registrantUserKey={registrantUserKey}
                  getUserIds={onSearchPersonChange}
                   allowClear={!!props?.setRegistrationValue || String(registrantUserKey) !== String(props?.loginUser?.id || feishuUserInfo?.userKey)}
                />
              )}
            </Form.Item>
            <Form.Item
              label={
                <div>
                  <span style={{ color: "#df000e", fontSize: 14 }}>* </span>
                  登记工时
                </div>
              }
            >
              <Space>
                <Form.Item
                  shouldUpdate
                  name="actWorkHour"
                  rules={[
                    {
                      required: true,
                      message: "工时不能为空",
                    },
                    {
                      validator: (_, value) => {
                        // 场景4: 缺卡-不允许提交，提示不可登记工时
                        const workDateVal = registrationForm.getFieldValue("workDate");
                        const workDateStr = workDateVal ? dayjs(workDateVal).format("YYYY-MM-DD") : '';
                        if (!workDateStr) return Promise.resolve();
                        // space模式下未选择登记对象时，不做考勤相关校验
                        if (mode === 'space') {
                          const _workItemVal = registrationForm.getFieldValue("workItem");
                          const _hasWorkItem = _workItemVal !== undefined && _workItemVal !== null
                            && Array.isArray(_workItemVal) && _workItemVal.length > 0
                            && !_workItemVal.every(v => v === undefined || v === null || v === '');
                          if (!_hasWorkItem) return Promise.resolve();
                        }
                        const snap = capacitySnapshotRef.current;
                        const snapMatches = snap && snap.workDate === workDateStr && snap.userKey === registrantUserKey;
                        if (!snapMatches) return Promise.resolve();
                        if (attendanceEnabled === 1 && attendanceHours === null && missPunchPolicy === 1) {
                          return Promise.reject(new Error('当天无考勤记录，不可登记工时'));
                        }
                        return Promise.resolve();
                      },
                    },
                    // {
                    //   validator: validateNumber(
                    //     capacitySet?.onceDown,
                    //     24,
                    //     "单次填报工时下限",
                    //     "小时"
                    //   ),
                      
                    // },
                    {
                      validator: (_, value) => {
                        // 校验规则：
                        //  1. 必填已由上一条 rule 保证；空值时此 validator 直接通过。
                        //  2. 下限（capacitySet.onceDown）：必须 >= minimum。
                        //  3. 上限：计算"提交后剩余工时"，剩余 >= 0 不校验（不报超限）；剩余 < 0 才报"超过上限"。
                        //     覆盖以下全部场景：
                        //       - 新增：提交后剩余 = snapRemaining - value
                        //       - 编辑同日期：接口已扣除 oldHour，可用余量 = snapRemaining + oldHour，提交后剩余 = snapRemaining + oldHour - value
                        //       - 编辑切到新日期：新日期上本条尚未登记，提交后剩余 = snapRemaining - value
                        //       - 切换日期/成员后快照尚未就绪：先放行不报错，getAlertDetail 返回后 setTimeout 会重校验。
                        if (value === undefined || value === null || value === '') {
                          return Promise.resolve();
                        }
                        const numVal = Number(value);
                        if (!Number.isFinite(numVal)) {
                          return Promise.reject(new Error('请输入有效数字'));
                        }
                        // 下限校验
                        const min = Number(capacitySet?.onceDown) || 0;
                        if (numVal < min) {
                          return Promise.reject(new Error(`低于单次填报工时下限${min}小时`));
                        }
                        const workDateVal = registrationForm.getFieldValue("workDate");
                        const workDateStr = workDateVal ? dayjs(workDateVal).format("YYYY-MM-DD") : '';
                        const snap = capacitySnapshotRef.current;
                        const snapMatches = snap && snap.workDate === workDateStr && snap.userKey === registrantUserKey;
                        // 快照未就绪：暂不做上限校验，避免误报；setTimeout 在 getAlertDetail 返回后会重校验。
                        if (!snapMatches) {
                          return Promise.resolve();
                        }
                        // space模式下未选择登记对象时，不做考勤上限校验
                        if (mode === 'space') {
                          const _workItemVal2 = registrationForm.getFieldValue("workItem");
                          const _hasWorkItem2 = _workItemVal2 !== undefined && _workItemVal2 !== null
                            && Array.isArray(_workItemVal2) && _workItemVal2.length > 0
                            && !_workItemVal2.every(v => v === undefined || v === null || v === '');
                          if (!_hasWorkItem2) return Promise.resolve();
                        }
                        const snapRemaining = Number(snap.remainingWork);
                        // 根据场景确定单天填报上限（用于错误提示）
                        let upperLimit;
                        if (attendanceEnabled === 0) {
                          upperLimit = Number(snap.dayUp) || Number(capacitySet?.dayUp) || 24; // 场景1: dayUp
                        } else if (attendanceHours !== null) {
                          upperLimit = attendanceHours; // 场景2: 考勤工时
                        } else if (missPunchPolicy === 2 && missPunchCustomLimit !== null) {
                          upperLimit = missPunchCustomLimit; // 场景3: 缺卡自定义提交上限
                        } else {
                          upperLimit = 0; // 场景4: 不应到达这里
                        }
                        const isEditSameDate = !!props?.setRegistrationValue && workDateStr &&
                          workDateStr === dayjs(props.setRegistrationValue?.workDate).format("YYYY-MM-DD");
                        const editOldHour = isEditSameDate
                          ? (Number(props?.type === "approval"
                              ? props.setRegistrationValue?.actWorkHour
                              : props.setRegistrationValue?.act_hour) || 0)
                          : 0;
                        // 提交后剩余工时
                        const remainingAfterSubmit = Number(
                          ((isEditSameDate ? snapRemaining + editOldHour : snapRemaining) - numVal).toFixed(2)
                        );
                        // 剩余工时 >= 0：不报错；< 0：报"当天填报工时超过上限"
                        console.log('remainingAfterSubmit', remainingAfterSubmit,missPunchPolicy,alertDetail?.remainingWork);
                        // 剩余工时 >= 0：不报错；< 0：报"当天填报工时超过上限"
                        if (remainingAfterSubmit < 0) {
                          return Promise.reject(new Error(`当天填报工时超过上限工时 ${dayUp} 小时`));
                        }
                        return Promise.resolve();

                        //  if (attendanceEnabled === 0) {
                        //   if(alertDetail?.remainingWork<0){
                        //     return Promise.reject(new Error(`当天填报工时超过上限工时 ${upperLimit} 小时`));
                        //   }
                        //  }else{
                        //   if (attendanceHours !== null){
                        //     return Promise.reject(new Error(`当天填报工时超过上限工时 ${upperLimit} 小时`));
                        //   }
                        //  }
                        //return Promise.resolve();
                      },
                    },
                  ]}
                  noStyle
                >
                  <InputNumber 
                    size="small" 
                    max={24}
                    onChange={onActWorkHour} 
                    disabled={!canRegister || (!canSubmitByLevel && !props?.setRegistrationValue) || props?.setRegistrationValue?.canRegisterLevel === false || props?.currItem?.noCanRegisterWorkItem}
                    precision={2}
                    placeholder='请输入工时'
                    formatter={(value) => {
                      if (value === null || value === undefined) {
                        return value;
                      }
                      if (value && value.toString().includes('.')) {
                        const parts = value.toString().split('.');
                        if (parts[1] && parts[1].length > 2) {
                          return `${parts[0]}.${parts[1].slice(0, 2)}`;
                        }
                      }
                      return value;
                    }}
                    parser={(value) => {
                      if (value === null || value === undefined) {
                        return value;
                      }
                      if (typeof value === 'string') {
                        // 将全角小数点转换为半角
                        const normalizedValue = value.replace('。', '.');
                        // 只保留数字和小数点
                        const filteredValue = normalizedValue.replace(/[^0-9.]/g, '');
                        if (filteredValue.includes('.')) {
                          const parts = filteredValue.split('.');
                          if (parts[1] && parts[1].length > 2) {
                            return parseFloat(`${parts[0]}.${parts[1].slice(0, 2)}`);
                          }
                        }
                        return filteredValue === '' ? null : parseFloat(filteredValue) || filteredValue;
                      }
                      return value === '' ? null : parseFloat(value) || value;
                    }}
                    // 处理中文输入法开始组合输入
                    onCompositionStart={() => {
                      setIsComposing(true);
                    }}
                    // 处理中文输入法结束组合输入
                    onCompositionEnd={(e) => {
                      setIsComposing(false);
                      // 组合输入结束后，清理输入内容
                      if (e.target && e.target.value) {
                        const value = e.target.value;
                        // 只保留数字、半角小数点和全角小数点
                        const filteredValue = value.replace(/[^0-9.。]/g, '')
                          .replace('。', '.'); // 转换全角为半角
                        
                        // 更新输入框值
                        e.target.value = filteredValue;
                        
                        // 触发onChange事件
                        if (onActWorkHour) {
                          onActWorkHour(filteredValue === '' ? null : parseFloat(filteredValue) || filteredValue);
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      // 阻止输入超过两位小数
                      if (!e || !e.target) {
                        return;
                      }
                      
                      // 允许控制键
                      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'ArrowLeft' || 
                          e.key === 'ArrowRight' || e.key === 'Tab' || e.key === 'Enter' || 
                          e.ctrlKey || e.metaKey) {
                        return;
                      }
                      
                      // 在中文输入法组合输入期间，不处理字符限制
                      if (isComposing) {
                        return;
                      }
                      
                      // 只允许数字 0-9、半角小数点和全角小数点
                      if (!((e.key >= '0' && e.key <= '9') || e.key === '.' || e.key === '。')) {
                        e.preventDefault();
                        return;
                      }
                      
                      const target = e.target;
                      let value = target.value || '';
                      
                      // 处理全角小数点
                      if (e.key === '。') {
                        // 立即阻止默认行为
                        e.preventDefault();
                        
                        // 检查是否已经存在小数点
                        if (value.includes('.') || value.includes('。')) {
                          return;
                        }
                        
                        // 将全角小数点转换为半角并插入到输入框
                        const normalizedValue = value.replace('。', '.');
                        const cursorPosition = target.selectionStart;
                        const newValue = normalizedValue.slice(0, cursorPosition) + '.' + normalizedValue.slice(cursorPosition);
                        
                        // 更新输入框值
                        target.value = newValue;
                        
                        // 设置光标位置到小数点后
                        const newCursorPosition = cursorPosition + 1;
                        target.setSelectionRange(newCursorPosition, newCursorPosition);
                        
                        // 触发onChange事件
                        if (onActWorkHour) {
                          onActWorkHour(parseFloat(newValue) || newValue);
                        }
                        
                        return;
                      }
                      
                      // 处理半角小数点
                      if (e.key === '.') {
                        // 检查是否已经存在小数点
                        if (value.includes('.') || value.includes('。')) {
                          e.preventDefault();
                          return;
                        }
                      }
                        
                      // 如果已经有小数点，检查小数位数
                      const normalizedValue = value.replace('。', '.');
                      if (normalizedValue.includes('.')) {
                        const parts = normalizedValue.split('.');
                        // 只有当光标在小数点之后才检查小数位数
                        const cursorPosition = target.selectionStart;
                        const decimalPosition = normalizedValue.indexOf('.') + 1;
                            
                        if (parts[1] && parts[1].length >= 2 && cursorPosition > decimalPosition) {
                          e.preventDefault();
                          return;
                        }
                      }
                    }}
                    // 添加 onInput 事件进行最后的验证
                    onInput={(e) => {
                      if (!isComposing && e.target && e.target.value) {
                        const value = e.target.value;
                        // 只保留数字和小数点
                        const filteredValue = value.replace(/[^0-9.]/g, '');
                        
                        if (value !== filteredValue) {
                          e.target.value = filteredValue;
                          
                          if (onActWorkHour) {
                            onActWorkHour(filteredValue === '' ? null : parseFloat(filteredValue) || filteredValue);
                          }
                        }
                      }
                    }}
                  />
                </Form.Item>
                <Form.Item shouldUpdate noStyle>
                  {({ getFieldValue }) => {
                    const val = getFieldValue('actWorkHour');
                    return props?.setRegistrationValue?.id || (!val && val !== 0)
                      ? <span>小时</span>
                      : null;
                  }}
                </Form.Item>
                <span>{actDay ? `（${actDay} 人天）` : ""}</span>
              </Space>
            </Form.Item>
            <Form.Item
              label="工作描述"
              name="workDesc"
              rules={[
                {
                  required: workDescRequired === 1,
                  message: '请输入工作描述'
                }
              ]}
            >
              <Input.TextArea
                style={{ resize: "none" }}
                showCount
                maxLength={200}
                placeholder="请输入"
                rows={4}
                disabled={!canRegister || (!canSubmitByLevel && !props?.setRegistrationValue) || props?.setRegistrationValue?.canRegisterLevel === false || props?.currItem?.noCanRegisterWorkItem}
              />
            </Form.Item>
            {props.type === "mob" ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-around",
                  lineHeight: 3,
                }}
              >
                <Button
                  style={{ width: "40%" }}
                  htmlType="reset"
                  onClick={onRegistrationCancel}
                >
                  取消
                </Button>
                <Button
                  style={{ width: "40%" }}
                  type="primary"
                  htmlType="submit"
                  loading={submitLoadings}
                >
                  {submitBtnTxt}
                </Button>
              </div>
            ) : (
              <div className="form-footer">
                <Space>
                  <Button htmlType="reset" onClick={onRegistrationCancel}>
                    取消
                  </Button>
                  <Button
                    disabled={submitDisabled || (!canSubmitByLevel && !props?.setRegistrationValue) || props?.setRegistrationValue?.canRegisterLevel === false || props?.currItem?.noCanRegisterWorkItem}
                    loading={submitLoadings}
                    type="primary"
                    htmlType="submit"
                  >
                    {submitBtnTxt}
                  </Button>
                </Space>
              </div>
            )}
          </Form>
	   </div>
        )}
      </Spin>
      <Modal
        // title="已登记工时明细"
        open={isDetailOpen}
        onCancel={() => setIsDetailOpen(false)}
        width={"700px"}
        footer={null}
        centered
        destroyOnHidden
      >
        <TaskDetail
          logId={props?.type === "approval" ? props?.setRegistrationValue?.registrationId : props?.setRegistrationValue?.id}
          type={props?.type}
          flowMode={curFlowType}
          workItem={{
            workItemId,
            workItemEntityId,
            nodeId,
            taskId,
          }}
          projectKey={currentProjectKey}
          workItemName={workItemName}
        />
      </Modal>
    </div>
  );
};

export default RegWorkHour;
