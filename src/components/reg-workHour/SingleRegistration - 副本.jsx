import JSSDK from '../../jssdk-adapter'
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  DatePicker,
  InputNumber,
  Button,
  Form,
  Input,
  Space,
  Avatar,
  Alert,
  Tooltip,
} from "antd";
import { UserOutlined, InfoCircleFilled } from "@ant-design/icons";
import {
  getWeekStartAndEnd,
  getQuarterStartAndEnd,
  getFirstDayOfNaturalMonth,
  getLastDayOfNaturalMonth,
  isNumber,
  validateNumber,
} from '../../util/util';
import {
  postQueryNodeWorkHourSumByUser,
  postInsertNodeWorkHour,
  postUpdateNodeWorkHour,
  getStandWorkHour,
  getWorkInstance,
  getUserRole,
  getProjectConfig,
  getWorkSaturationTips,
  getApprovalSettings,
  postApproveHandle,
  postUserActive,
  getDisplayLogic,
  getRegistrationSettings,
  getEntityNodeOptionNew,
  getItemEntityOptions,
  getUserStandWorkHour
} from '../../api/api';
import "./RegWorkHour.less";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import Decimal from "decimal.js";
import WorkNodeSelect from "../workNode-cascader/WorkNodeSelect";
import UserPicker from "../user-picker/UserPicker";
import TaskDetail from "../task-detail/TaskDetail";
import WorkNodeCascaderControl from "../workNode-cascader/WorkNodeSelectControl";

dayjs.extend(customParseFormat);

const { TextArea } = Input;

const SingleRegistration = (props) => {
  console.log('SingleRegistration props', props)
  const [registrationForm] = Form.useForm();
  const [isAllowRegister, setIsAllowRegister] = useState(false);
  const [submitBtnTxt, setSubmitBtnTxt] = useState("提交");
  const workNodeSelectRef = useRef(null);
  const [submitDisabled, setSubmitBtnDisabled] = useState(false);
  const [canSubmitByLevel, setCanSubmitByLevel] = useState(true);
  const [submitLoadings, setSubmitLoadings] = useState(false);
  const [saveHourLoadings, setSaveHourLoadings] = useState(false); // 暂存按钮加载状态
  const [id, setId] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [workDate, setWorkDate] = useState("");
  const [curFlowType, setCurFlowType] = useState("");
  const [workItem, setWorkItem] = useState([]);
  const [workItemName, setWorkItemName] = useState("");
  const [workItemId, setWorkItemId] = useState("");
  const [workItemEntityId, setWorkItemEntityId] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [registeredName, setRegisteredName] = useState({});
  const [standWorkHour, setStandWorkHour] = useState(0);
  const [capacitySet, setCapacitySet] = useState({});
  const [actDay, setActDay] = useState(0);
  const [isShowDetailBtnOpen, setIsShowDetailBtnOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [registrantUserKey, setRegistrantUserKey] = useState(props?.loginUser?.id);
  const [alertDetail, setAlertDetail] = useState({});
  const [alertDetailOld, setAlertDetailOld] = useState({});
  const [workItemInfo, setWorkItemInfo] = useState({});
  const [isEditChangeAlert, setIsEditChangeAlert] = useState(false);
  const [regDisplayLogic, setRegDisplayLogic] = useState({});
  const [regWorkingHours, setRegWorkingHours] = useState(null);
  const [windowHeight, setWindowHeight] = useState(570);
  const [ingsConfig, setingsConfig] = useState(1);
  const [canSubmitByLevelInfo, setCanSubmitByLevelInfo] = useState("");
  const [registrationSettings, setRegistrationSettings] = useState({});
  const [isComposing, setIsComposing] = useState(false);
  const [workDescRequired, setWorkDescRequired] = useState(0);
  const ingsConfigRef = useRef(1);
  const [remainingWork, setRemainingWork] = useState(0); // 剩余工时
  const [dayUp, setDayUp] = useState(0); // 单日上限
  const [onceDown, setOnceDown] = useState(0); // 单次下限

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

  useEffect(() => {
    if (props?.windowHeight) setWindowHeight(props?.windowHeight);
  }, [props?.windowHeight]);

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
      if (levelNames.includes('work_item_entity') && levelNames.includes('node')) {
        setCanSubmitByLevelInfo('根据管理员设置，请登记至工作项实例或节点层级');
      } else if (levelNames.includes('work_item_entity') && levelNames.includes('task')) {
        setCanSubmitByLevelInfo('根据管理员设置，请登记至工作项实例或任务层级');
      } else if (levelNames.includes('node') && levelNames.includes('task')) {
        setCanSubmitByLevelInfo('根据管理员设置，请登记至节点或任务层级');
      }
    }
  };

  useEffect(() => {
    if(registeredName && Object.keys(registeredName).length > 0){
      if(props?.currItem?.noCanRegisterWorkItem){
        setCanSubmitByLevel(false);
        setCanSubmitByLevelInfo(`根据管理员设置，[${props?.currItem?.workItemName}]不可被[编辑]`);
      } else {
        if(registeredName?.canRegister===true){
          if(registeredName?.canRegisterLevel === false){
            setCanSubmitByLevel(false);
            handleLevelValidation(registeredName);
          } else {
            setCanSubmitByLevel(true);
          }
        } else {
          if(registeredName?.canRegister===false){
            setCanSubmitByLevel(false);
            setCanSubmitByLevelInfo('非当前登记用户的负责人，无法登记');
          }
        }
      }
    } else {
      if(props?.currItem?.noCanRegisterWorkItem){
        setCanSubmitByLevel(false);
        setCanSubmitByLevelInfo(`根据管理员设置，[${props?.currItem?.workItemName}]不可被[编辑]`);
      }
    }
  }, [JSON.stringify(registeredName)]);

  useEffect(() => {
    const calculateHeight = async () => {
      const isInIframe = window.self !== window.top;
      let iframeHeight = 0;
      
      if (isInIframe) {
        try {
          const context = await JSSDK.Context.load();
          if (context?.containerInfo?.height) {
            iframeHeight = context.containerInfo.height;
          }
          context.watch((ctx) => {
            if (ctx?.containerInfo?.height) {
              setWindowHeight(ctx.containerInfo.height - 70);
            }
          });
        } catch (error) {}
        
        if (!iframeHeight) {
          iframeHeight = document.documentElement.offsetHeight;
        }
        
        const height = iframeHeight - 70;
        setWindowHeight(height);
      } else {
        const height = window.innerHeight - 70;
        setWindowHeight(height);
      }
    };

    const debouncedCalculateHeight = debounce(calculateHeight, 300);
    calculateHeight();
    
    window.addEventListener('resize', debouncedCalculateHeight);
    window.addEventListener('fullscreenchange', debouncedCalculateHeight);
    window.addEventListener('orientationchange', debouncedCalculateHeight);
    
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
      
      return () => {
        window.removeEventListener('resize', debouncedCalculateHeight);
        window.removeEventListener('fullscreenchange', debouncedCalculateHeight);
        window.removeEventListener('orientationchange', debouncedCalculateHeight);
        resizeObserver.disconnect();
      };
    } else {
      return () => {
        window.removeEventListener('resize', debouncedCalculateHeight);
        window.removeEventListener('fullscreenchange', debouncedCalculateHeight);
        window.removeEventListener('orientationchange', debouncedCalculateHeight);
      };
    }
  }, []);

  useEffect(() => {
    getApprovalSettingsData();
    getCapacity();
    getRole();
  }, []);

  useEffect(() => {
    ingsConfigRef.current = ingsConfig;
  }, [ingsConfig]);

  useEffect(() => {
    console.log('props?.setRegistrationValue', props?.setRegistrationValue)
    if (props?.setRegistrationValue) {
      setSubmitBtnDisabled(true);
      if(props?.setRegistrationValue?.canRegisterLevel === false){
        setCanSubmitByLevel(false);
        handleLevelValidation(props?.setRegistrationValue);
      }
      if(props?.currItem?.noCanRegisterWorkItem){
        setCanSubmitByLevelInfo(`根据管理员设置，[${props?.currItem?.workItemName}]不可被[编辑]`);
        setCanSubmitByLevel(false);
      }
      
      setWorkDate(dayjs(props?.setRegistrationValue?.workDate).format("YYYY-MM-DD"));
      setRegistrantUserKey(props?.setRegistrationValue?.registrantUserKey);
      setWorkItemId(props.setRegistrationValue?.workItemId);
      setWorkItemEntityId(props.setRegistrationValue?.workItemEntityId);
      setNodeId(props.setRegistrationValue?.nodeId);
      setTaskId(props.setRegistrationValue?.taskId);
      setWorkItem([
        props.setRegistrationValue?.workItemId,
        props.setRegistrationValue?.workItemEntityId,
        props.setRegistrationValue?.nodeId,
        props.setRegistrationValue?.taskId,
      ]);
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
    }
  }, [props?.setRegistrationValue]);

  const getApprovalSettingsData = async () => {
    const res = await getApprovalSettings();
    if (res?.result) {
      const data = res.data;
      if (data?.approvalType === 1) {
        setSubmitBtnTxt("提交审批");
      } else {
        setSubmitBtnTxt("提交");
      }
    }
  };

  const getCapacity = async () => {
    const res = await getProjectConfig();
    if (res?.result) {
      setCapacitySet(res.data);
      if (res.data?.dayUp) {
        setStandWorkHour(res.data.dayUp);
      }
    }
  };

  const getRole = async () => {
    const res = await getUserRole();
    if (res?.result) {
      setIsAllowRegister(res.data === "Admin");
    }
  };

  /**
   * 获取工作饱和度提示详情
   * 根据工作日期和登记人计算已登记工时、剩余工时和饱和度
   */
  const getAlertDetail = async () => {
    const data = {
      workDate: workDate,
      registrantUseKey: registrantUserKey,
    };
    const actWorkHour = registrationForm.getFieldValue("actWorkHour");
    const res = await getWorkSaturationTips(data);
    if (res?.result) {
      setRegWorkingHours(res.data.registeredWorkingHours);
      setRemainingWork(res.data.remainingWork);
      // 预存原始数据副本用于后续计算，避免直接修改原始数据
      setAlertDetailOld(JSON.parse(JSON.stringify(res.data)));
      // 情况1：有实际工时值，且非编辑模式或允许编辑改变提示
      if (actWorkHour && (!props?.setRegistrationValue || isEditChangeAlert)) {
        // 创建数据副本进行计算，避免直接修改响应数据
        const alertDetail = JSON.parse(JSON.stringify(res.data));
        
        // 判断是否是在编辑模式下，且日期与原始编辑日期相同
        if (
          workDate ===
          dayjs(props?.setRegistrationValue?.workDate).format("YYYY-MM-DD")
        ) {
          // 审批模式下的特殊处理逻辑
          if (props?.type === "approval" && props?.setRegistrationValue) {
            // 创建审批时的数据处理
            if (props?.setRegistrationValue?.modifyType === "create") {
              // 更新已登记工时（增加新提交的工时）
              alertDetail.registeredWorkingHours =
                alertDetail.registeredWorkingHours +
                props.setRegistrationValue?.actWorkHour;
              // 更新剩余工时（减去新提交的工时）
              alertDetail.remainingWork =
                alertDetail.remainingWork -
                props.setRegistrationValue?.actWorkHour;
                if (alertDetail.remainingWork){
                  alertDetail.remainingWork = Number(
                    alertDetail.remainingWork.toFixed(2)
                  );
                }
              // 重新计算工作饱和度
              alertDetail.saturation =
                (alertDetail.registeredWorkingHours /
                  capacitySet?.standWorkHour) *
                100;
              // 饱和度保留两位小数
              if (alertDetail.saturation)
                alertDetail.saturation = Number(
                  alertDetail.saturation.toFixed(2)
                );
              // 更新原始数据副本
              setAlertDetailOld(JSON.parse(JSON.stringify(alertDetail)));
            }
            // 编辑审批时的数据处理
            if (props?.setRegistrationValue?.modifyType === "edit") {
              // 更新已登记工时（原工时 + 新工时 - 旧工时）
              res.data.registeredWorkingHours =
                res.data.registeredWorkingHours +
                props.setRegistrationValue?.actWorkHour -
                props.setRegistrationValue?.originalActWorkHour;
              // 更新剩余工时（原剩余 + 旧工时 - 新工时）
              res.data.remainingWork =
                res.data.remainingWork -
                props.setRegistrationValue?.actWorkHour +
                props.setRegistrationValue?.originalActWorkHour;
                if (res.data.remainingWork){
                  res.data.remainingWork = Number(
                    res.data.remainingWork.toFixed(2)
                  );
                }
              // 重新计算工作饱和度
              res.data.saturation =
                (res.data.registeredWorkingHours / capacitySet?.standWorkHour) *
                100;
              // 饱和度保留两位小数
              if (res.data.saturation)
                res.data.saturation = Number(res.data.saturation.toFixed(2));
              // 更新原始数据副本
              setAlertDetailOld(JSON.parse(JSON.stringify(res.data)));
            }
          }
          
          // 核心工时计算：考虑当前输入的工时，并根据模式调整原值
          // 已登记工时 = 原值 + 当前输入 - 原有提交值
          alertDetail.registeredWorkingHours =
            alertDetail?.registeredWorkingHours +
            actWorkHour -
            (props?.type === "approval"
                ? props.setRegistrationValue?.actWorkHour || 0
                : props.setRegistrationValue?.act_hour || 0);
          // 数值格式化：保留两位小数
          if (alertDetail.registeredWorkingHours)
            alertDetail.registeredWorkingHours = Number(
              alertDetail.registeredWorkingHours.toFixed(2)
            );
            
          // 剩余工时计算：原值 - 当前输入 + 原有提交值
          alertDetail.remainingWork = alertDetail?.remainingWork - actWorkHour;
          // 数值格式化：保留两位小数
          if (alertDetail.remainingWork)
            alertDetail.remainingWork = Number(
              alertDetail.remainingWork.toFixed(2)
            );
        } else {
          // 日期变更情况：直接累加当前输入的工时
          alertDetail.registeredWorkingHours =
            alertDetail?.registeredWorkingHours + actWorkHour;
          if (alertDetail.registeredWorkingHours)
            alertDetail.registeredWorkingHours = Number(
              alertDetail.registeredWorkingHours.toFixed(2)
            );
          // 相应减少剩余工时
          alertDetail.remainingWork = alertDetail?.remainingWork - actWorkHour;
          if (alertDetail.remainingWork)
            alertDetail.remainingWork = Number(
              alertDetail.remainingWork.toFixed(2)
            );
        }
        
        // 计算并更新工作饱和度
        alertDetail.saturation =
          (alertDetail.registeredWorkingHours / capacitySet?.standWorkHour) *
          100;
        if (alertDetail.saturation)
          alertDetail.saturation = Number(alertDetail.saturation.toFixed(2));
        
        // 更新用于显示的工时统计数据
        setAlertDetail(alertDetail);
      } else {
        // 情况2：无实际工时值，或在编辑模式且不允许改变提示
        // 审批模式下的处理逻辑
        if (props?.type === "approval" && props?.setRegistrationValue) {
          // 创建审批时的数据处理
          if (props?.setRegistrationValue?.modifyType === "create") {
            res.data.registeredWorkingHours =
              res.data.registeredWorkingHours +
              props.setRegistrationValue?.actWorkHour;
            res.data.remainingWork =
              res.data.remainingWork - props.setRegistrationValue?.actWorkHour;

              if (res.data.remainingWork){
                res.data.remainingWork = Number(
                  res.data.remainingWork.toFixed(2)
                );
              }
            res.data.saturation =
              (res.data.registeredWorkingHours / capacitySet?.standWorkHour) *
              100;
            if (res.data.saturation)
              res.data.saturation = Number(res.data.saturation.toFixed(2));
            setAlertDetailOld(JSON.parse(JSON.stringify(res.data)));
          }
          // 编辑审批时的数据处理
          if (props?.setRegistrationValue?.modifyType === "edit") {
            res.data.registeredWorkingHours =
              res.data.registeredWorkingHours +
              props.setRegistrationValue?.actWorkHour -
              props.setRegistrationValue?.originalActWorkHour;
            res.data.remainingWork =
              res.data.remainingWork -
              props.setRegistrationValue?.actWorkHour +
              props.setRegistrationValue?.originalActWorkHour;
              if (res.data.remainingWork){
                res.data.remainingWork = Number(
                  res.data.remainingWork.toFixed(2)
                );
              }
            res.data.saturation =
              (res.data.registeredWorkingHours / capacitySet?.standWorkHour) *
              100;
            if (res.data.saturation)
              res.data.saturation = Number(res.data.saturation.toFixed(2));
            setAlertDetailOld(JSON.parse(JSON.stringify(res.data)));
          }
        } else {
          if(props.setRegistrationValue?.act_hour){
            res.data.remainingWork = res.data.remainingWork - props.setRegistrationValue?.act_hour;
            if (res.data.remainingWork){
              res.data.remainingWork = Number(
                res.data.remainingWork.toFixed(2)
              );
            }
          }
        }
        // 直接使用响应数据作为显示数据
        setAlertDetail(JSON.parse(JSON.stringify(res.data)));
      }
    }
  };

  // 监听工作日期、登记人和容量设置变化，实时更新工作饱和度提示
  useEffect(() => {
    if (workDate && registrantUserKey && "standWorkHour" in capacitySet) {
      getAlertDetail();
      // 切换成员时，重新验证登记工时
      if (registrationForm.getFieldValue('actWorkHour')) {
        registrationForm.validateFields(['actWorkHour']);
      } 
    } else {
      setAlertDetail({});
      setAlertDetailOld({});
    }
  }, [workDate, registrantUserKey, capacitySet]);

  const onWorkItemChange = (val) => {
    // 处理工作项变更，同时更新表单字段值
    console.log('onWorkItemChange val', val)
    registrationForm.setFieldsValue({ workItem: val })
  };

  const onSearchPersonChange = (val) => {
    console.log('onSearchPersonChange val', val)
    setRegistrantUserKey(val);
    // 同时更新表单字段值
    registrationForm.setFieldsValue({ registrantUserKey: val })
  };

  /**
   * 实际工时变化处理函数
   * 根据输入的工时实时计算并更新工作饱和度提示
   * @param {number} val - 输入的实际工时
   */
  const onActWorkHour = (val) => {
    if (!val && val !== 0) {
      // 清空工时，重置提示信息为原始数据
      if (alertDetailOld && Object.keys(alertDetailOld).length > 0) {
        setAlertDetail(JSON.parse(JSON.stringify(alertDetailOld)));
      }
      return;
    }
    
    // 创建数据副本进行计算
    const newAlertDetail = JSON.parse(JSON.stringify(alertDetailOld));
    if (newAlertDetail && Object.keys(newAlertDetail).length > 0) {
      // 计算新的已登记工时
      newAlertDetail.registeredWorkingHours = 
        (newAlertDetail.registeredWorkingHours || 0) + val;
      if (newAlertDetail.registeredWorkingHours) {
        newAlertDetail.registeredWorkingHours = Number(
          newAlertDetail.registeredWorkingHours.toFixed(2)
        );
      }
      
      // 计算新的剩余工时
      newAlertDetail.remainingWork = (newAlertDetail.remainingWork || 0) - val;
      if (newAlertDetail.remainingWork) {
        newAlertDetail.remainingWork = Number(
          newAlertDetail.remainingWork.toFixed(2)
        );
      }
      
      // 重新计算工作饱和度
      if (capacitySet?.standWorkHour) {
        newAlertDetail.saturation = 
          (newAlertDetail.registeredWorkingHours / capacitySet.standWorkHour) * 100;
        if (newAlertDetail.saturation) {
          newAlertDetail.saturation = Number(newAlertDetail.saturation.toFixed(2));
        }
      }
      
      setAlertDetail(newAlertDetail);
    }
  };

  // const onRegistrationOk = async (values) => {
  //   console.log('values', values)
  //   setSubmitLoadings(true);
  //   // 提交逻辑
  //   setTimeout(() => {
  //     setSubmitLoadings(false);
  //     props.getRegistrationValue && props.getRegistrationValue(2);
  //   }, 1000);
  // };
  /**
   * 工时登记提交处理函数
   * @param {Object} values - 表单提交的值
   */
  const onRegistrationOk = async (values) => {
    setSubmitLoadings(true);
    
    // 仅处理单个登记类型
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
  };
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
   * 处理审批模式下的编辑操作
   * @param {Object} values - 表单值
   */
  const handleApprovalEdit = async (values) => {
    const data = {
      id: registrationForm.getFieldValue("id"),
      type: "again_launch",
      actWorkHour: values?.actWorkHour,
      workDesc: values?.workDesc,
      workDate: values?.workDate,
      modifyType: values?.modifyType,
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
    setSubmitLoadings(false);
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
      taskHourId: props.setRegistrationValue?.taskHourId,
      registrantUserKey: values?.registrantUserKey,
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
    setSubmitLoadings(false);
  };

  const handleNewRegistration = async (values) => {
    const data = {
      workItemId,
      workItemEntityId,
      nodeId,
      taskId,
      actWorkHour: values.actWorkHour,
      workDesc: values.workDesc,
      workDate: values.workDate,
      staffUserKey: values?.registrantUserKey,
      registrantUserKey: values?.registrantUserKey,
      schedule: workItemInfo?.schedule,
      scheduleStart: workItemInfo?.schedule?.split("~")[0],
      scheduleEnd: workItemInfo?.schedule?.split("~")[1],
      estimatedWorkingHoursAll: Number(
        workItemInfo?.estimatedWorkingHours?.split("/")[0]
      ),
      estimatedWorkingHoursSelf: Number(
        workItemInfo?.estimatedWorkingHours?.split("/")[1]
      ),
      estimatedWorkingHours: workItemInfo?.estimatedWorkingHours,
      workItemName: registeredName?.workItemName,
      workItemEntityName: registeredName?.workItemEntityName,
      nodeName: registeredName?.nodeName,
      taskName: registeredName?.taskName,
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
    setSubmitLoadings(false);
  };

  const onRegistrationCancel = () => {
    props.onCancel && props.onCancel();
  };

  const onWorkDetailClick = () => {
    setIsDetailOpen(true);
  };

  const onValuesChange = (changedValues, allValues) => {
    console.log('changedValues', changedValues)
    console.log('allValues', allValues)
    // 表单值变更处理
  };

  // 计算是否可以登记
  const canRegisterComputed = registrantUserKey === props?.loginUser?.id || isAllowRegister;

  return (
    <div style={{ height: 670, overflowY: "auto", paddingRight: "5px" }}>
      <Form
        form={registrationForm}
        name="basic"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
        initialValues={{ remember: true }}
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
                该成员当前工作日期总登记工时
                <span className="num">
                  {typeof regWorkingHours === "number" ? regWorkingHours : "--"}小时
                </span>
                ，待审批工时
                <span className="num">
                  {typeof alertDetail?.approvalingWork === "number" ? alertDetail?.approvalingWork : "--"}小时
                </span>
                <Tooltip
                  placement="bottom"
                  title={
                    <>
                      <div>已登记工时：指该「成员」在当前「工作日期」成功登记的工时（已经在工时日志的工时）</div>
                      <div>待审批工时：指该「成员」在当前「工作日期」下处于待审批状态的工时</div>
                      <div>当前拟提交工时：指该「成员」在当前「工作日期」，正准备提交的工时</div>
                      <div>剩余可登记工时：「单天填报工时上限」减去该「成员」在当前「工作日期」的「已登记工时」「待审批工时」及「当前拟提交工时」之和</div>
                      <div>工作饱和度：（该「成员」在当前「工作日期」的「已登记工时」+「待审批工时」+「当前拟提交工时」）÷「单位人天标准工时」× 100%</div>
                    </>
                  }
                >
                  <InfoCircleFilled className="icon" />
                </Tooltip>
              </div>
              <div>
                当前拟提交工时
                <span className="num">
                  {typeof registrationForm.getFieldValue('actWorkHour') === "number"
                    ? registrationForm.getFieldValue('actWorkHour')
                    : "--"}小时
                </span>
                ，剩余可登记工时
                <span className="num">
                  {typeof alertDetail?.remainingWork === "number" ? alertDetail?.remainingWork : "--"}小时
                </span>
                ，工作饱和度
                <span className="num">
                  {typeof alertDetail?.saturation === "number" ? alertDetail?.saturation : "--"}%
                </span>
              </div>
            </>
          }
          type="info"
          showIcon
        />
        <Form.Item
          label="登记对象"
          name="workItem"
          rules={[{ required: true, message: "登记对象不能为空" }]}
        >
          {props.setRegistrationValue ? (
            workItem?.length ? (
              <WorkNodeSelect
                ref={workNodeSelectRef}
                workItemName={workItemName}
                disabled={props.setRegistrationValue || !canRegisterComputed}
                userKey={registrantUserKey}
                myselfFlag={ingsConfig}
                filterWorkItem={true}
                getWorkItem={onWorkItemChange}
                getFlowType={(val) => setCurFlowType(val)}
                getRegisteredName={(val) => setRegisteredName(val)}
              />
            ) : null
          ) : props?.point === "control" ? (
            <WorkNodeCascaderControl
              flowMode={props?.flowMode}
              point={props?.point}
              userKey={registrantUserKey}
              myselfFlag={ingsConfig}
              workItem={props?.workItem}
              getWorkItem={onWorkItemChange}
              getFlowType={(val) => setCurFlowType(val)}
              registeredName={registeredName}
              getRegisteredName={(val) => setRegisteredName(val)}
              disabled={!canRegisterComputed}
            />
          ) : (
            <WorkNodeSelect
              ref={workNodeSelectRef}
              point={props?.point}
              filterWorkItem={true}
              workItem={props?.workItem}
              userKey={registrantUserKey}
              myselfFlag={ingsConfig}
              getWorkItem={onWorkItemChange}
              getFlowType={(val) => setCurFlowType(val)}
              getRegisteredName={(val) => setRegisteredName(val)}
              disabled={!canRegisterComputed}
            />
          )}
        </Form.Item>
        {!canRegisterComputed && (
          <Form.Item wrapperCol={{ offset: 6, span: 18 }} style={{ marginTop: 8, marginBottom: 5 }}>
            <span style={{ color: '#df000e' }}>
              根据管理员设置,请登记至节点或任务层级
            </span>
          </Form.Item>
        )}
        {canRegisterComputed && !canSubmitByLevel && (
          <p style={{ color: '#df000e', margin: '8px 0 5px 174px' }}>
            {canSubmitByLevelInfo}
          </p>
        )}
        <Form.Item label="排期">
          {workItemInfo?.schedule ? workItemInfo?.schedule : "--"}
        </Form.Item>
        <Form.Item
          label={
            <div className="form-item-label">
              <span className="label-txt">预估工时</span>
              <Tooltip
                title={
                  <>
                    <div>前者：指个人的预估工时，即当前「成员」在当前「登记对象」的「估分」</div>
                    <div>后者：指当前工作项/节点/任务的总预估工时，即当前的「登记对象」的总「估分」</div>
                  </>
                }
              >
                <InfoCircleFilled className="label-icon" />
              </Tooltip>
            </div>
          }
        >
          {workItemInfo?.estimatedWorkingHours ? workItemInfo?.estimatedWorkingHours : "--/--"}
        </Form.Item>
        <Form.Item
          label={
            <div className="form-item-label">
              <span className="label-txt">已登记工时</span>
              <Tooltip
                title={
                  <>
                    <div>前者：指个人已登记的总实际工时，即当前「成员」在当前「登记对象」已登记的总「实际工时」</div>
                    <div>后者：指当前工作项/节点/任务已登记的总实际工时，即当前「登记对象」已登记的总「实际工时」</div>
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
          {workItemInfo?.remainingWork ? workItemInfo?.remainingWork : "--/--"}
        </Form.Item>
        <Form.Item
          label="工作日期"
          name="workDate"
          rules={[{ required: true, message: "工作日期不能为空" }]}
        >
          <DatePicker
            size="small"
            disabled={!canRegisterComputed || !canSubmitByLevel}
            onChange={(date, dateString) => {
              setWorkDate(dateString);
              if (registrationForm.getFieldValue('actWorkHour')) {
                registrationForm.validateFields(['actWorkHour']);
              }
            }}
          />
        </Form.Item>
        <Form.Item
          label="成员"
          name="registrantUserKey"
          rules={[{ required: true, message: "成员不能为空" }]}
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
          ) : (
            <UserPicker
              size="small"
              loginUser={props?.loginUser}
              disabled={
                !isAllowRegister ||
                sessionStorage.getItem("jwtMeegoTeamworkUserRole") !== "Admin"
              }
              registrantUserKey={registrantUserKey}
              getUserIds={onSearchPersonChange}
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
                { required: true, message: "工时不能为空" },
                {
                  validator: validateNumber(
                    capacitySet?.dayUp || 24,
                    capacitySet?.onceDown || 0,
                    alertDetailOld?.remainingWork || 24,
                    "工时",
                    "小时",
                    registrationForm.getFieldValue("workDate"),
                  ),
                },
              ]}
              noStyle
            >
              <InputNumber
                size="small"
                onChange={onActWorkHour}
                disabled={!canRegisterComputed || !canSubmitByLevel}
                precision={2}
                formatter={(value) => {
                  if (value === null || value === undefined) return value;
                  if (value && value.toString().includes('.')) {
                    const parts = value.toString().split('.');
                    if (parts[1] && parts[1].length > 2) {
                      return `${parts[0]}.${parts[1].slice(0, 2)}`;
                    }
                  }
                  return value;
                }}
                parser={(value) => {
                  if (value === null || value === undefined) return value;
                  if (typeof value === 'string') {
                    const normalizedValue = value.replace('。', '.');
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
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={(e) => {
                  setIsComposing(false);
                  if (e.target && e.target.value) {
                    const value = e.target.value;
                    const filteredValue = value.replace(/[^0-9.。]/g, '').replace('。', '.');
                    e.target.value = filteredValue;
                    if (onActWorkHour) {
                      onActWorkHour(filteredValue === '' ? null : parseFloat(filteredValue) || filteredValue);
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (!e || !e.target) return;
                  if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'ArrowLeft' ||
                    e.key === 'ArrowRight' || e.key === 'Tab' || e.key === 'Enter' ||
                    e.ctrlKey || e.metaKey) return;
                  if (isComposing) return;
                  if (!((e.key >= '0' && e.key <= '9') || e.key === '.' || e.key === '。')) {
                    e.preventDefault();
                    return;
                  }
                  const target = e.target;
                  let value = target.value || '';
                  if (e.key === '。') {
                    e.preventDefault();
                    if (value.includes('.') || value.includes('。')) return;
                    const normalizedValue = value.replace('。', '.');
                    const cursorPosition = target.selectionStart;
                    const newValue = normalizedValue.slice(0, cursorPosition) + '.' + normalizedValue.slice(cursorPosition);
                    target.value = newValue;
                    const newCursorPosition = cursorPosition + 1;
                    target.setSelectionRange(newCursorPosition, newCursorPosition);
                    if (onActWorkHour) {
                      onActWorkHour(parseFloat(newValue) || newValue);
                    }
                    return;
                  }
                  if (e.key === '.') {
                    if (value.includes('.') || value.includes('。')) {
                      e.preventDefault();
                      return;
                    }
                  }
                  const normalizedValue = value.replace('。', '.');
                  if (normalizedValue.includes('.')) {
                    const parts = normalizedValue.split('.');
                    const cursorPosition = target.selectionStart;
                    const decimalPosition = normalizedValue.indexOf('.') + 1;
                    if (parts[1] && parts[1].length >= 2 && cursorPosition > decimalPosition) {
                      e.preventDefault();
                      return;
                    }
                  }
                }}
                onInput={(e) => {
                  if (!isComposing && e.target && e.target.value) {
                    const value = e.target.value;
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
            <span>{actDay ? `（${actDay} 人天）` : ""}</span>
          </Space>
        </Form.Item>
        <Form.Item
          label={<span>工作描述</span>}
          name="workDesc"
          rules={[{ required: workDescRequired ? true : false, message: '请输入工作描述' }]}
        >
          <Input.TextArea
            style={{ resize: "none", margin: "5px 0" }}
            showCount
            maxLength={200}
            placeholder="请输入"
            rows={4}
            disabled={!canRegisterComputed || !canSubmitByLevel}
          />
        </Form.Item>
        <div
          style={{
            textAlign: "right",
            position: "absolute",
            right: "0",
            bottom: "0",
          }}
        >
          <Space>
            <Button htmlType="reset" onClick={onRegistrationCancel}>
              取消
            </Button>
            <Button
              disabled={submitDisabled || !canSubmitByLevel}
              loading={submitLoadings}
              type="primary"
              htmlType="submit"
            >
              {submitBtnTxt}
            </Button>
          </Space>
        </div>
      </Form>
      {isDetailOpen && (
        <TaskDetail
          visible={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          workItemInfo={workItemInfo}
        />
      )}
    </div>
  );
};

export default SingleRegistration;
