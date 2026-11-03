import JSSDK from '../../jssdk-adapter'
import "./Gantt.less";
import "dhtmlx-gantt/codebase/skins/dhtmlxgantt_material.css";
import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import dayjs from "dayjs";
import { gantt } from "dhtmlx-gantt";

import {
  Avatar,
  Button,
  Modal,
  Form,
  Input,
  message,
  Menu,
  Dropdown,
  Divider,
  Table,
  Space,
  Spin,
  Tooltip,
  Tag
} from "antd";
import {
  UserOutlined,
  ExclamationCircleFilled,
  CloseOutlined,
  InfoCircleFilled,
} from "@ant-design/icons";
import { getOriginColumns, zoomLevels, zoomMap, operationMenu } from './config';
import {
  queryWorkItemAndWorkItemEntity,
  postWorkingHoursDetails,
  getStandWorkHour,
  postDeleteNodeWorkHour,
  getUserNumeralConfig,
  queryWorkItemEntityNodeAndTask,
  postWorkHoursTotalDetail
} from '../../api/api';
import RegWorkHour from "../reg-workHour/RegWorkHour";
import {
  formatDateTime,
  timeStamp2Text,
  getFirstDayOfNaturalMonth,
  getLastDayOfNaturalMonth,
  isNumber,
  goWorkItemHref,
} from '../../util/util';
import "./Gantt.less";
import {
  formatCustomFieldValue,
  useTenantCustomFieldConfig,
} from '../../hooks/useTenantCustomFieldConfig';
const formItemLayout = {
  labelCol: {
    span: 4,
  },
  wrapperCol: {
    span: 20,
  },
};

export default function Gantt(props) {
  const [loading, setLoading] = useState(false);
  const loadingMsgRef = useRef(null);
  const showToggleLoading = () => {
    if (loadingMsgRef.current) return;
    loadingMsgRef.current = message.loading('加载中...', 0);
  };
  const hideToggleLoading = () => {
    if (loadingMsgRef.current) {
      loadingMsgRef.current();
      loadingMsgRef.current = null;
    }
  };
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [curTask, setCurTask] = useState({});
  const ganttContainer = useRef();
  const [standWorkHour, setStandWorkHour] = useState(false);
  const [currItem, setCurrItem] = useState({});
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [config, setConfig] = useState({});
  // 「登记工时」列头图标需随升/降序切换，列数组按排序方向重建
  const [headerColumns, setHeaderColumns] = useState(() =>
    getOriginColumns(props.registerWorkingHoursSort),
  );
  const [taskDetail, setTaskDetail] = useState({
    workNodeName: "",
    scheduleDate: "",
    estimatedScore: "",
    registeredWorkTime: "",
    userName: "",
    avatarUrl: "",
    nodeWorkHours: [],
  });
  const [detailList, setDetailList] = useState([]);
  const eventHandlers = useRef({
    onTaskOpened: null,
    onTaskClosed: null,
    onTaskDblClick: null,
    onTaskClick: null,
    onGanttRender: null,
  });
  // 使用 ref 保持对最新 props 的引用，避免 gantt 事件回调闭包捕获旧 props 导致 spaceIds 等 props 值失效
  const latestPropsRef = useRef(props);
  latestPropsRef.current = props;
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const clickState = useRef({
    lastClickId: null,
    lastClickTime: 0,
    timer: null,
  });
  const [someCondition, setSomeCondition] = useState(true);
  const [isWorkHoursTotalOpen, setIsWorkHoursTotalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [workHoursTotalDetail, setWorkHoursTotalDetail] = useState({
    userKey: "",
    estimatedWorkingHours: "",
    registeredWorkingHours: "",
    workHoursData: []
  });
  const {
    fieldName: customFieldName,
    showCustomField,
  } = useTenantCustomFieldConfig();

  useEffect(() => {
    registerLightBox();
    setGanttConfig();
    setDateMarker();
    setZooms();
    gantt.init(ganttContainer.current);
    getWorkHour();
    if (eventHandlers.current.onTaskClick) {
      gantt.detachEvent(eventHandlers.current.onTaskClick);
    }
    if (eventHandlers.current.onGanttRender) {
      gantt.detachEvent(eventHandlers.current.onGanttRender);
    }
    return () => {
      if (eventHandlers.current.onTaskClick) {
        gantt.detachEvent(eventHandlers.current.onTaskClick);
        eventHandlers.current.onTaskClick = null;
      }
      if (eventHandlers.current.onGanttRender) {
        gantt.detachEvent(eventHandlers.current.onGanttRender);
        eventHandlers.current.onGanttRender = null;
      }

      // 移除DOM事件监听器
      const dataArea = document.querySelector(".gantt_data_area");
      if (dataArea) {
        dataArea.removeEventListener("dblclick", handleDblClick);
      }
    };
  }, []);

  /** 查询组织标准工时 */
  async function getWorkHour() {
     setStandWorkHour({
        "dayUp": 24.0,
        "onceDown": 1.0,
        "standWorkHour": 8.0
    });
    // const res = await getStandWorkHour();
    // if (res?.result) {
    //   setStandWorkHour(res?.data?.standWorkHour);
    // }
  }

  /** 查询设置 */
  const getConfig = async () => {
    const data = {
      type: "ONLY_CALCULATE_WORKING_DAYS",
    };
    const res = await getUserNumeralConfig(data);
    if (res?.result) {
      setConfig(res.data);
    }
  };

  // 自定义函数获取任务层级
  function getTaskLevel(taskId) {
    let level = 0;
    let task = gantt.getTask(taskId);
    while (task && task.parent) {
      level++;
      task = gantt.getTask(task.parent);
    }

    return level;
  }

  // 查看展开树的层级
  function expandToLevel(targetLevel, parentId = null) {
    if (!parentId) return;
    const parentLevel = getTaskLevel(parentId);
    if (parentLevel + 1 >= targetLevel) return;
    // 仅遍历 parentId 的直接子节点，避免在新任务动态添加后遍历全树导致无限递归
    const children = gantt.getChildren(parentId);
    children.forEach((childId) => {
      const childLevel = parentLevel + 1;
      if (childLevel < targetLevel) {
        gantt.open(childId);
        // 递归展开子节点的子节点
        expandToLevel(targetLevel, childId);
      } else {
        gantt.close(childId);
      }
    });
  }

  useEffect(() => {
    if (typeof standWorkHour === "boolean") return;
    registerLightBox();
    setGanttConfig();
    setDateMarker();
    setZooms();
    gantt.init(ganttContainer.current);
    if (props.tasks.data.length) {
      setDateMarker();
      const formatData = formatTask();
      gantt.clearAll();
      if (formatData && Array.isArray(formatData.data)) {
        gantt.parse(formatData);
      }
    }
  }, [standWorkHour]);

  useEffect(() => {
    setSomeCondition(true);
  }, [JSON.stringify(props.ganttUser.data)]);

  useEffect(() => {
    if (typeof standWorkHour === "boolean") return;
    if (props.tasks.data.length) {
      if (someCondition) {
        //
        setDateMarker();
        const formatData = formatTask();
        gantt.clearAll();
        if (formatData && Array.isArray(formatData.data)) {
          gantt.parse(formatData);
        }
      }
    }
  }, [JSON.stringify(props.tasks.data), JSON.stringify(props.leaveByUserDate), someCondition]);

  useEffect(() => {
    setGanttConfig();
  }, [JSON.stringify(props.time)]);

  /**
   * 「登记工时」排序方向变化：重建列头（刷新图标状态）并重新解析已排序的数据后重绘。
   * 这里直接 parse 当前已排序的 props.tasks，绕过数据 effect 中的 someCondition 守卫，
   * 确保打开过工时详情弹窗后点击排序，成员行顺序依然会刷新；同时不触发任何接口请求。
   */
  useEffect(() => {
    if (typeof standWorkHour === "boolean") return;
    const nextColumns = getOriginColumns(props.registerWorkingHoursSort);
    setHeaderColumns(nextColumns);
    // gantt 尚未初始化完成时跳过，避免在实例就绪前调用渲染方法
    if (!ganttContainer.current || !gantt.$container) return;
    gantt.config.columns = nextColumns;
    if (props.tasks.data.length) {
      setDateMarker();
      const formatData = formatTask();
      gantt.clearAll();
      if (formatData && Array.isArray(formatData.data)) {
        gantt.parse(formatData);
      }
    }
    gantt.resetLayout();
    gantt.render();
  }, [props.registerWorkingHoursSort]);

  /** 获取任务详情 */
  const getTaskDetail = async (
    task,
    start_date,
    end_date,
    type = null,
    x,
    y
  ) => {
    setModalLoading(true)
    const workStartDate = start_date+' 00:00:00';
    const workEndDate = end_date+' 23:59:59';
    const data = {
      workItemId: task?.workItemId,
      workItemEntityId: task?.workItemEntityId,
      nodeId: task?.nodeId,
      startDate: workStartDate,
      endDate: workEndDate,
      userKey: task?.userKey,
      nodeDbId: task?.nodeDbId,
      taskId: task?.taskId,
      taskDbId: task?.taskDbId,
      type: type,
      tag: task?.tag,
    };
    data.projectKey=task?.projectKey ? task?.projectKey : ''
    const res = await postWorkingHoursDetails(data);
    if (res?.result) {
      setSomeCondition(false);
      res.data.workName = getObjectName(task);
      res.data = {
        ...res.data,
        ...data,
      };

      setTaskDetail(res.data);
      //  let timer = setTimeout(() => {
      //   clearTimeout(timer);
      //   gantt.scrollTo(x,y)
      // }, 50);
    }
    setModalLoading(false)
  };

  /** 拼接登记对象名称 */
  const getObjectName = (task) => {
    const result = [];
    result.unshift(task?.projectName);
    const visited = new Set([String(task?.id)]);
    const findObjectName = (parent) => {
      if (!parent || visited.has(String(parent))) return;
      visited.add(String(parent));
      const item = gantt.getTask(parent);
      if (item) {
        if (!item?.isUser) result.unshift(item.projectName);
        if (item?.parent) findObjectName(item.parent);
      }
    };
    if (task?.parent) findObjectName(task?.parent);
    const objectName = result.join("/");
    return objectName;
  };

  /**
   * 「登记工时」列头排序图标点击（由 config.js 中 label 的 onclick 调用）。
   * 通过 latestPropsRef 取最新回调，避免闭包捕获过期 props。
   */
  window.customToggleRegisterHoursSort = function () {
    const curProps = latestPropsRef.current;
    if (curProps?.onRegisterWorkingHoursSortChange) {
      curProps.onRegisterWorkingHoursSortChange();
    }
  };

  /** 甘特图左边-展开折叠事件 */
  window.customToggleTask = async function (id) {
    const task = gantt.getTask(id);
     const tenantModeInfo = localStorage.getItem('meegoTeamworkAppMode') || 'space';
    // 渲染甘特图并保留其他节点的展开状态，避免当前操作影响其他空间/节点的展开
    const renderPreservingOpen = (gantt, currentId, expandLevel) => {
      const openIds = [];
      gantt.eachTask((t) => {
        if (t.open && String(t.id) !== String(currentId)) {
          openIds.push(t.id);
        }
      });
      gantt.render();
      if (expandLevel) expandToLevel(expandLevel, currentId);
      gantt.open(currentId);
      // 安全恢复：仅打开仍存在且尚未被 expandToLevel 打开的节点，避免重复 open 导致循环引用
      openIds.forEach((oid) => {
        try {
          const t = gantt.getTask(oid);
          if (t && !t.open) {
            t.open = true;
            gantt.open(oid);
          }
        } catch (_) {
          // 忽略因节点状态异常导致的打开失败
        }
      });
    };

    if (task.open) {
      const children = gantt.getChildren(id);
      gantt.batchUpdate(() => {
        gantt.getTask(id).open = false;
        gantt.close(id);
        if ((task.isUser || task.isSpace) && children) {
          children.forEach((childId) => {
            gantt.deleteTask(childId);
          });
        }
      });
    } else {
      gantt.open(id);
      gantt.getTask(id).open = true;
      let level = 0;
      let currentTask = gantt.getTask(id);
      while (currentTask.parent) {
        level++;
        currentTask = gantt.getTask(currentTask.parent);
      }
      if (level === 0) {
        // 空间模式需要调用接口才显示 loading，租户模式使用本地数据跳过
        const isNeedApiLevel0 = (localStorage.getItem('meegoTeamworkAppMode') || 'space') !== 'tenant';
        if (isNeedApiLevel0) showToggleLoading();
        try {
          const sPos = gantt.getScrollState();
          const posX = sPos.x;
          const isTenantMode = tenantModeInfo === 'tenant';
          if (isTenantMode) {
            // 租户模式：使用 props.spaceData（本地数据）
            let spaceData = props.spaceData[task?.id];
            if (!spaceData || spaceData.length === 0) return;
            spaceData.forEach((i) => {
              i.projectNo = i.id;
              i.isSpace = true;
              i.open = false;
            });
            gantt.batchUpdate(() => {
              spaceData.forEach((child) => {
                gantt.addTask(child);
                const exists = props.tasks.data.some(
                  (item) => item.projectNo === child.projectNo
                );
                if (!exists) {
                  props.tasks.data.push(child);
                }
              });
              renderPreservingOpen(gantt, id);
              gantt.scrollTo(posX, null);
            });
          } else {
            // 空间模式：调用接口查询
            const workStartDate = props.time[0];
            const workEndDate = props.time[1];
            const data = {
              startDate: workStartDate + ' 00:00:00',
              endDate: workEndDate + ' 23:59:59',
              userKey: task?.userKey,
              projectKeys: props.spaceIds ? [props.spaceIds] : [],
            };
            const res = await queryWorkItemAndWorkItemEntity(data);
            if (res && res.data && res.data.length > 0) {
              res.data.forEach((i) => {
                i.projectNo = i.id;
                if (!i.type) {
                  i.open = true;
                } else {
                  i.open = false;
                }
              });
              gantt.batchUpdate(() => {
                res.data.forEach((child) => {
                  gantt.addTask(child);
                  const exists = props.tasks.data.some(
                    (item) => item.projectNo === child.projectNo
                  );
                  if (!exists) {
                    props.tasks.data.push(child);
                  }
                });
                renderPreservingOpen(gantt, id, 2);
                gantt.scrollTo(posX, null);
              });
            }
          }
        } catch (e) {
          console.error('展开工作项失败：', e);
        } finally {
          hideToggleLoading();
        }
      } else if (level === 1) {
        const isTenantMode = tenantModeInfo === 'tenant';
        // 仅租户模式需要调用接口，显示 loading
        if (isTenantMode) showToggleLoading();
        try {
          gantt.open(id);
          const sPos = gantt.getScrollState();
          const posX = sPos.x;
          const workStartDate = props.time[0];
          const workEndDate = props.time[1];

          if (isTenantMode) {
            // 租户模式：调用 queryWorkItemAndWorkItemEntity
            const data = {
              startDate: workStartDate + ' 00:00:00',
              endDate: workEndDate + ' 23:59:59',
              userKey: task?.userKey,
              projectKeys: task?.projectKey ? [task.projectKey] : [],
            };
            const res = await queryWorkItemAndWorkItemEntity(data);
            if (res && res.data && res.data.length > 0) {
              res.data.forEach((i) => {
                if (!i.type) {
                  i.parent = task?.id;
                }
                i.projectNo = i.id;
                if (!i.type) {
                  i.open = true;
                } else {
                  i.open = false;
                }
              });
              gantt.batchUpdate(() => {
                res.data.forEach((child) => {
                  gantt.addTask(child);
                  const exists = props.tasks.data.some(
                    (item) => item.projectNo === child.projectNo
                  );
                  if (!exists) {
                    props.tasks.data.push(child);
                  }
                });
                renderPreservingOpen(gantt, id, 3);
                gantt.scrollTo(posX, null);
              });
            } else {
              message.error('暂无数据');
            }
          } else {
            // 空间模式：从已加载数据中恢复子节点（无需调接口）
            const childTasks = props.tasks.data.filter(
              (item) => String(item.parent) === String(id)
            );
            gantt.batchUpdate(() => {
              if (childTasks.length > 0) {
                childTasks.forEach((child) => {
                  if (!gantt.getTask(child.id)) {
                    gantt.addTask({ ...child, parent: id });
                  }
                });
              }
              gantt.getTask(id).open = true;
              renderPreservingOpen(gantt, id);
              gantt.scrollTo(posX, null);
            });
          }
        } catch (error) {
          console.error('获取数据时出错:', error);
        } finally {
          hideToggleLoading();
        }
      } else if (level === 2) {
        showToggleLoading();
        try {
          const sPos = gantt.getScrollState();
          const posX = sPos.x;
          const workStartDate = props.time[0];
          const workEndDate = props.time[1];
          const isTenantMode = tenantModeInfo === 'tenant';
          if (!isTenantMode) {
            // 空间模式：调用 queryWorkItemEntityNodeAndTask 查询节点和任务
            const data = {
              projectKeys: props.spaceIds ? [props.spaceIds] : [],
              startDate: workStartDate + ' 00:00:00',
              endDate: workEndDate + ' 23:59:59',
              userKey: task?.userKey,
              workItemEntityId: task?.workItemEntityId,
              workItemId: task?.workItemId,
            };
            const res = await queryWorkItemEntityNodeAndTask(data);
            if (res && res.data && res.data.length > 0) {
              res.data.forEach((i) => {
                if (i.type === 'node') {
                  i.parent = task?.id;
                }
                i.projectNo = i.id;
                if (!i.type) {
                  i.open = true;
                } else {
                  i.open = false;
                }
              });
              gantt.batchUpdate(() => {
                res.data.forEach((child) => {
                  gantt.addTask(child);
                  const exists = props.tasks.data.some(
                    (item) => item.projectNo === child.projectNo
                  );
                  if (!exists) {
                    props.tasks.data.push(child);
                  }
                });
                renderPreservingOpen(gantt, id, 2);
                gantt.scrollTo(posX, null);
              });
            } else {
              message.error('暂无数据');
            }
          }
        } catch (error) {
          console.error('获取数据时出错:', error);
        } finally {
          hideToggleLoading();
        }
      } else if (level === 3) {
        showToggleLoading();
        try {
          const sPos = gantt.getScrollState();
          const posX = sPos.x;
          const workStartDate = props.time[0];
          const workEndDate = props.time[1];
          const data = {
            startDate: workStartDate + ' 00:00:00',
            endDate: workEndDate + ' 23:59:59',
            userKey: task?.userKey,
            workItemEntityId: task?.workItemEntityId,
            workItemId: task?.workItemId,
          };
          const isSpaceMode = localStorage.getItem('meegoTeamworkAppMode') === 'space';
          if (isSpaceMode) {
            gantt.open(id);
          } else {
            data.projectKeys = task?.projectKey ? [task.projectKey] : [];
            const res = await queryWorkItemEntityNodeAndTask(data);
            if (res && res.data && res.data.length > 0) {
              res.data.forEach((i) => {
                if (i.type === 'node') {
                  i.parent = task?.id;
                }
                i.projectNo = i.id;
                if (!i.type) {
                  i.open = true;
                } else {
                  i.open = false;
                }
              });
              gantt.batchUpdate(() => {
                res.data.forEach((child) => {
                  gantt.addTask(child);
                  const exists = props.tasks.data.some(
                    (item) => item.projectNo === child.projectNo
                  );
                  if (!exists) {
                    props.tasks.data.push(child);
                  }
                });
                renderPreservingOpen(gantt, id, 2);
                gantt.scrollTo(posX, null);
              });
            } else {
              message.error('暂无数据');
            }
          }
        } catch (error) {
          console.error('获取数据时出错:', error);
        } finally {
          hideToggleLoading();
        }
      } else {
        gantt.open(id);
      }
    }
  };
  // 将数据处理成我们需要的集合
  const formatTask = () => {
    gantt.resetLayout();
    const tempData = props.tasks;
    const taskTree = {};
    if (!tempData.data.length) return;
    tempData.data.forEach((item) => {
      //item.id = `${item.projectNo}`;
      // if (item.nodeId && item.workItemId && item.workItemEntityId) {
      //   item.id = `${item.projectNo}-${item.workItemEntityId}-${item.workItemId}`;
      // }
      if (!item.workStartDate && !item.workEndDate) {
        item.unscheduled = true;
      } else {
        item.start_date = new Date(
          `${dayjs(item.workStartDate).format("YYYY-MM-DD")} 00:00:00`
        );
        item.end_date = new Date(
          `${dayjs(item.workEndDate).format("YYYY-MM-DD")} 24:00:00`
        );
      }

      // 自定义内容进度上的文本
      gantt.templates.task_text = function (start, end, task) {
        return "";
        //return task.projectName;
      };

      gantt.templates.timeline_cell_content = function (task, date) {
        if (task.isUser) {
          const dateText = timeStamp2Text(new Date(date).getTime(), "yyyy-MM-dd");
          const leaveFlag = props.leaveByUserDate?.[task.userKey]?.[dateText] === true;
          let text = 1;
          let isWorkDay = false;
          let userWorkNumEveryDay = '';
          task.userEnterWorkTimes.forEach((item1) => {
            if (
              item1.everyDate ===
              timeStamp2Text(new Date(date).getTime(), "yyyy-MM-dd")
            ) {
              text = item1.saturability;
              isWorkDay=item1.isHoliday
              userWorkNumEveryDay=item1.userWorkNumEveryDay
            }
          });
          const hasWorkHours = userWorkNumEveryDay && userWorkNumEveryDay>0;
          const cellContent = `<div class="gantt-chat-cell-content">${hasWorkHours ? `<span class="gantt-chat-cell-hours">${userWorkNumEveryDay}</span>` : ''}${leaveFlag ? '<span class="gantt-chat-cell-leave">请假</span>' : ''}</div>`;
          if (isWorkDay) {
            let dayOffStatusHtml ='';
             dayOffStatusHtml = `<div class="gantt-chat-cell-date" style="background: #eee;">`;
             if (text === 0) {
                dayOffStatusHtml=dayOffStatusHtml+`${cellContent}<span class="work-item-saturation"></span></div>`;
                return dayOffStatusHtml
             } else if (text > 0 && text <= 50) {
               dayOffStatusHtml=dayOffStatusHtml+`${cellContent}<span class="work-item-saturation work-low-saturation"></span></div>`;
               return dayOffStatusHtml
             } else if (text > 50 && text <= 100) {
                dayOffStatusHtml=dayOffStatusHtml+`${cellContent}<span class="work-item-saturation work-saturation"></span></div>`;
                return dayOffStatusHtml
             } else{
                dayOffStatusHtml=dayOffStatusHtml+`${cellContent}<span class="work-item-saturation work-supersaturation"></span></div>`;
                return dayOffStatusHtml
             } 
          }
          if (text === 0) {
            return `<div class="gantt-chat-cell-date work-feel-status">${cellContent}</div>`;
          } else if (text > 0 && text <= 50) {
            return `<div class="gantt-chat-cell-date work-low-saturation">${cellContent}</div>`;
          } else if (text > 50 && text <= 100) {
            return `<div class="gantt-chat-cell-date work-saturation">${cellContent}</div>`;
          } else if (text) {
            return `<div class="gantt-chat-cell-date work-supersaturation">${cellContent}</div>`;
          } else if (leaveFlag) {
            return `<div class="gantt-chat-cell-date work-feel-status">${cellContent}</div>`;
          }
        } else if (task.isSpace) {
          if (task.open) {
            if (
              task.expandRegistrationDateArr &&
              task.expandRegistrationDateArr.length > 0
            ) {
              let objSpace = task.expandRegistrationDateArr.find((i) => {
                return (
                  timeStamp2Text(new Date(date).getTime(), "yyyy-MM-dd") ==
                  i.registrationDate
                );
              });
              if (objSpace) {
                return `<div class="gantt_task_pr" data-date="${objSpace.registrationDate}"><div style="display: flex;justify-content: center;align-items: center;background:#0047FF;color:#ffffff;border-radius:16px;height:30px;width: 90%;">${objSpace.serWorkNumEveryDay}</div></div>`;
              }
            }
          } else {
            if (
              task.foldRegistrationDateArr &&
              task.foldRegistrationDateArr.length > 0
            ) {
              let objSpaceFold = task.foldRegistrationDateArr.find((i) => {
                return (
                  timeStamp2Text(new Date(date).getTime(), "yyyy-MM-dd") ==
                  i.registrationDate
                );
              });
              if (objSpaceFold) {
                return `<div class="gantt_task_pr" data-date="${objSpaceFold.registrationDate}"><div style="display: flex;justify-content: center;align-items: center;background:#0047FF;color:#ffffff;border-radius:16px;height:30px;width: 90%;">${objSpaceFold.serWorkNumEveryDay}</div></div>`;
              }
            }
          }
        } else {
          if (task.open) {
            if (
              task.expandRegistrationDateArr &&
              task.expandRegistrationDateArr.length > 0
            ) {
              let obj2025 = task.expandRegistrationDateArr.find((i) => {
                return (
                  timeStamp2Text(new Date(date).getTime(), "yyyy-MM-dd") ==
                  i.registrationDate
                );
              });
              if (obj2025) {
                return `<div class="gantt_task_pr"  data-date="${obj2025.registrationDate}"><div style="display: flex;justify-content: center;align-items: center;background:#0047FF;color:#ffffff;border-radius:16px;height:30px;width: 90%;">${obj2025.serWorkNumEveryDay}</div></div>`;
              }
            }
          } else {
            if (
              task.foldRegistrationDateArr &&
              task.foldRegistrationDateArr.length > 0
            ) {
              let obj2026 = task.foldRegistrationDateArr.find((i) => {
                return (
                  timeStamp2Text(new Date(date).getTime(), "yyyy-MM-dd") ==
                  i.registrationDate
                );
              });
              if (obj2026) {
                return `<div class="gantt_task_pr" data-date="${obj2026.registrationDate}"><div style="display: flex;justify-content: center;align-items: center;background:#0047FF;color:#ffffff;border-radius:16px;height:30px;width: 90%;">${obj2026.serWorkNumEveryDay}</div></div>`;
              }
            }
          }
          // if (date.getDay() === 6 || date.getDay() === 0) {
          //   return `<div style="background:#eee;height: 100%;display: flex;justify-content: center;align-items: center;"></div>`;
          // }
        }
      };
    });
    // 在交给 dhtmlxGantt 前对 tasks 做安全清洗，避免出现：
    //   1) id 缺失/重复
    //   2) parent 为 'null' / 'undefined' / 空字符串
    //   3) parent === id 的自引用
    //   4) 父子互引或多级闭环（A→B→A）
    //   5) 父级 id 实际不在数据集合里
    // 任何不合法的 parent 一律改为 0，dhtmlxGantt 会把它当作根节点。
    const sanitizeTasks = (rawList) => {
      const list = Array.isArray(rawList) ? rawList : [];
      const seenIds = new Set();
      const cleaned = [];
      list.forEach((task, idx) => {
        if (!task) return;
        // id 缺失则补一个稳定 fallback，避免破坏占位/无业务 id 的渲染
        if (task.id === undefined || task.id === null || task.id === '') {
          task.id = `__auto_${idx}`;
        }
        // 去重：相同 id 只保留首次出现的
        if (seenIds.has(task.id)) return;
        seenIds.add(task.id);
        // 父引用归一化
        const p = task.parent;
        if (
          p === undefined ||
          p === null ||
          p === '' ||
          p === 'null' ||
          p === 'undefined' ||
          p === task.id
        ) {
          task.parent = 0;
        }
        cleaned.push(task);
      });
      // 校验父级 id 必须能在集合内找到；找不到 → 视作根
      const idSet = new Set(cleaned.map((t) => t.id));
      cleaned.forEach((task) => {
        if (task.parent && task.parent !== 0 && !idSet.has(task.parent)) {
          task.parent = 0;
        }
      });
      // 检测循环：从每个节点向上追溯，若回到自己即存在闭环
      const parentMap = new Map(cleaned.map((t) => [t.id, t.parent]));
      cleaned.forEach((task) => {
        const visited = new Set();
        let cur = task.parent;
        while (cur && cur !== 0) {
          if (visited.has(cur) || cur === task.id) {
            // 出现闭环，将当前任务的 parent 归零
            task.parent = 0;
            break;
          }
          visited.add(cur);
          cur = parentMap.get(cur);
        }
      });
      return cleaned;
    };
    tempData.data = sanitizeTasks(tempData.data);
    // 「登记工时」排序：使用父级传入的已排序结果，这里保持顺序交给 gantt.parse
    return tempData;
  };

  // 注册自定义 任务弹出框
  const registerLightBox = () => {
    // 打开 弹出框事件

    gantt.showLightbox = (id) => {
      const task = gantt.getTask(id);
      return;
      // if ("workItemId" in task && "workItemEntityId" in task) {
      //   const task = gantt.getTask(id);
      //   setCurTask(task);
      //   let timer = setTimeout(() => {
      //     clearTimeout(timer);
      //     getTaskDetail(task);
      //   }, 50);

      //   // 设置默认值
      //   setIsDetailOpen(true);
      //   gantt.resetLayout(); // 重置表格 布局，即新建任务的时候，可以看到新建的任务
      // } else {
      //   return;
      // }
    };

    // 关闭 弹出框事件
    // gantt.hideLightbox = () => {
    //   setIsDetailOpen(false);
    // };
  };

  const handleDblClick = (e) => {
    // 检查是否点击在任务单元格上
    const cell = e.target.closest(".gantt_task_cell");
    if (!cell) return;
    // 判断单元格是否存在子元素
    if (cell.children.length === 0) return;
    // 获取对应的任务行
    const row = cell.closest(".gantt_task_row");
    if (!row) return;
    // 获取任务ID
    const taskId = row.getAttribute("task_id");
    if (!taskId) return;
    // 获取任务数据
    const task = gantt.getTask(taskId);
    if (task.isUser) return;
    // 检查是否存在 class 名为 gantt_task_pr 的子元素
    const ganttTaskPr = cell.querySelector(".gantt_task_pr");
    if (!ganttTaskPr) return;

    // 获取 data-date 属性的值
    const dateValue = ganttTaskPr.getAttribute("data-date");
    if (!dateValue) return;
    let queryType = task.type;
    if (queryType) {
      queryType = task?.open ? task.type : null;
      const formattedDate = dayjs(dateValue).format("YYYY-MM-DD");
      setSomeCondition(false);
      setCurTask(task);
      getTaskDetail(task, formattedDate, formattedDate, queryType);
      setIsDetailOpen(true);
      // 使用batchUpdate保持操作原子性
      // gantt.batchUpdate(() => {
      //   setSomeCondition(false)
      //   setCurTask(task);
      //   getTaskDetail(task, formattedDate, formattedDate, queryType);
      //   setIsDetailOpen(true);
      // });
      // setCurTask(task);
      // let timer = setTimeout(() => {
      //   clearTimeout(timer);
      //   getTaskDetail(task,formattedDate,formattedDate,queryType);
      // }, 50);
      // // 设置默认值
      // setIsDetailOpen(true);
      //gantt.resetLayout(); // 重置表格 布局，即新建任务的时候，可以看到新建的任务
    } else {
      let content = "";
      if (task.workItemId) {
        content = "工作项不支持查看工时详情";
      } else {
        content = "空间不支持查看工时详情";
      }
      const textConfig = {
        title: "提示信息",
        content: content,
        okText: "确认",
        onOk: () => {
          setIsModalVisible(false);
        },
      };
      if (!isModalVisible) {
        Modal.info(textConfig);
        setIsModalVisible(true);
      }
    }
  };

  // 设置甘特图的 基础配置
  const setGanttConfig = () => {
    if (eventHandlers.current.onTaskClick) {
      gantt.detachEvent(eventHandlers.current.onTaskClick);
    }
    if (eventHandlers.current.onGanttRender) {
      gantt.detachEvent(eventHandlers.current.onGanttRender);
    }
    // 设置甘特图开始时间
    gantt.config.start_date = new Date(`${props.time[0]} 0:0:0`);

    // 设置甘特图结束时间
    gantt.config.end_date = new Date(`${props.time[1]} 23:59:59`);

    // 允许显示超过时间刻度任务
    gantt.config.show_tasks_outside_timescale = true;

    // const dayFormat = function (date) {
    //   const weeks = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    //   if (date.getDay() === 6 || date.getDay() === 0) {
    //     return `<div style="background: #eee;">${
    //       weeks[dayjs(date).day()]
    //     }</div>`;
    //   }
    //   return `<div>${weeks[dayjs(date).day()]}</div>`;
    // };
    // gantt.config.subscales = [
    //   {
    //     unit: "year",
    //     step: 1,
    //     date: "%Y",
    //   },
    //   {
    //     unit: "day",
    //     step: 1,
    //     template: dayFormat,
    //   },
    // ];

    // 设置甘特图行高
    gantt.config.row_height = 40;

    // 设置甘特图语言
    gantt.i18n.setLocale("cn");

    // 设置甘特图适应高
    gantt.config.autosize = "y";

    // 在同一树级别内垂直重新排序任务
    gantt.config.order_branch = false;
    // 允许对整个甘特图内的任务进行重新排序
    gantt.config.order_branch_free = false;

    // 是否显示依赖连线
    gantt.config.show_links = false;

    // 点击表头可排序
    gantt.config.sort = false;

    // 左侧项目拖拽
    gantt.config.drag_project = false;

    // 项目进度推拽
    gantt.config.drag_progress = false;

    // 界面初始化时展开图表树形结构
    gantt.config.open_tree_initially = true;

    // 设置进度条高度
    gantt.config.bar_height = 20;

    gantt.config.columns = headerColumns;

    // 禁止右侧时间工期 左右拖动
    gantt.config.drag_resize = false;

    // 配置不允许拖动列头
    gantt.config.drag_column_headers = false;
    gantt.plugins({
      marker: true,
    });
    // gantt.attachEvent("onGanttScroll", function (left, top){
    //   setScrollPosition(left)
    // });
    // gantt.attachEvent("onAfterTaskAdd", function(id, item) {
    //   gantt.scrollTo(scrollPosition, null);
    //   return true;
    // });
    // 初始化甘特图后添加双击事件监听
    const handleGanttRender = () => {
      const dataArea = document.querySelector(".gantt_data_area");
      // 先移除可能存在的旧监听器
      if (dataArea) {
        dataArea.removeEventListener("dblclick", handleDblClick);
        // 添加新监听器
        dataArea.addEventListener("dblclick", handleDblClick);
      }
    };
    gantt.attachEvent("onTaskRender", function (task, taskElement) {
      // 检查任务的开始时间和结束时间
      if (!task.start_date || !task.end_date) {
        // 如果任务没有设置开始或结束时间，不渲染任务轴
        taskElement.style.display = "none";
      }
    });

    // gantt.attachEvent("onBeforeTaskDrag", function (id, mode, e) {
    //   // 如果返回 false，则拖拽将被阻止
    //   return false; // 确保返回 true 以允许拖拽
    // });
    // 监听单击事件
    // const handleTaskClick = async (id, e) => {
    //   e.stopPropagation();
    //   const target = e.target;
    //   const task = gantt.getTask(id);
    //   if (task.isUser) {
    //     const now = Date.now();
    //     const state = clickState.current;

    //     // 双击检测（300ms内点击相同任务）
    //     if (
    //       state.lastClickId === task.id &&
    //       now - state.lastClickTime < 300
    //     ) {
    //       clearTimeout(state.timer);
    //       state.timer = null;
    //       setCurTask(task);
    //       let timer = setTimeout(() => {
    //         setSomeCondition(false);
    //         clearTimeout(timer);
    //         getWorkHoursTotalDetail(task, props.time[0], props.time[1]);
    //       }, 50);
    //       // 设置默认值
    //       setIsWorkHoursTotalOpen(true);
    //       return;
    //     }
    //     // 记录点击状态
    //     state.lastClickId = task.id;
    //     state.lastClickTime = now;
    //   } else {
    //     if (!target.classList.contains("gantt_tree_icon")) {
    //       //const taskId = gantt.getTask(id);
    //       const now = Date.now();
    //       const state = clickState.current;

    //       // 双击检测（300ms内点击相同任务）
    //       if (
    //         state.lastClickId === task.id &&
    //         now - state.lastClickTime < 300
    //       ) {
    //         if (task.isUser || !task.type) return;
    //         clearTimeout(state.timer);
    //         state.timer = null;
    //         setCurTask(task);
    //         let timer = setTimeout(() => {
    //           setSomeCondition(false);
    //           clearTimeout(timer);
    //           getTaskDetail(task, props.time[0], props.time[1]);
    //         }, 50);
    //         // 设置默认值
    //         setIsDetailOpen(true);
    //         //gantt.resetLayout(); // 重置表格 布局，即新建任务的时候，可以看到新建的任务
    //         return;
    //       }
    //       // 记录点击状态
    //       state.lastClickId = task.id;
    //       state.lastClickTime = now;
    //     } else {
    //       return;
    //     }
    //   }
    // };
    // 监听单击事件
    const handleTaskClick = async (id, e) => {
      e.stopPropagation();
      const target = e.target;
      const task = gantt.getTask(id);
      
      // 如果点击的是树图标，直接返回
      if (target.classList.contains("gantt_tree_icon")) return;

      const now = Date.now();
      const state = clickState.current;

      // 双击检测（300ms内点击相同任务）
      if (state.lastClickId === task.id && now - state.lastClickTime < 300) {
        clearTimeout(state.timer);
        state.timer = null;
        setCurTask(task);
        
        // 使用立即执行函数处理延迟逻辑
        (() => {
          const timer = setTimeout(() => {
            setSomeCondition(false);
            clearTimeout(timer);
            const curProps = latestPropsRef.current;
            if (task.isUser) {
              getWorkHoursTotalDetail(task, curProps.time[0], curProps.time[1],curProps.spaceIds);
              setIsWorkHoursTotalOpen(true);
            } else if (task.type) {
              getTaskDetail(task, curProps.time[0], curProps.time[1]);
              setIsDetailOpen(true);
            }
          }, 50);
        })();
        
        return;
      }

      // 记录点击状态
      state.lastClickId = task.id;
      state.lastClickTime = now;
    };
    /** 获取任务详情 */
    const getWorkHoursTotalDetail = async (
      task,
      start_date,
      end_date,
      spaceIds,
    ) => {
      console.log('props.spaceIds',spaceIds)
      try {
        setModalLoading(true)
        const isSpaceMode = localStorage.getItem('meegoTeamworkAppMode') === 'space';
        // 租户模式下：优先取当前任务所属空间的 projectKey；空间模式下：使用当前选中的 props.spaceIds
        let projectKey = '';
        if (isSpaceMode) {
          projectKey = spaceIds
        } else {
          // 沿父链向上找带 projectKey 的祖先（space 节点）
          let cur = task;
          while (cur) {
            if (cur.projectKey) { projectKey = cur.projectKey; break; }
            if (cur.parent) cur = gantt.getTask(cur.parent); else break;
          }
          if (!projectKey) projectKey = props.spaceIds || '';
        }
        const data = {
          startDate: start_date,
          endDate:  end_date,
          userKey: task?.userKey,
          projectKey,
        };
        const res = await postWorkHoursTotalDetail(data);
        if (res?.result) {
          setSomeCondition(false);
          // res.data.workName = getObjectName(task);
          res.data = {
            ...res.data,
            userKey:data.userKey,
            avatarUrl:task?.avatarUrl,
            userName:task?.userName,
          };
          setWorkHoursTotalDetail(res.data);
        }
        setModalLoading(false)
      } catch (error) {
        setModalLoading(false)
        console.error("获取数据时出错:", error);
      }
      
    };
    eventHandlers.current.onTaskClick = gantt.attachEvent(
      "onTaskClick",
      handleTaskClick
    );
    eventHandlers.current.onGanttRender = gantt.attachEvent(
      "onGanttRender",
      handleGanttRender
    );
  };

  // 设置 时间标识线
  const setDateMarker = () => {
    const dateToStr = gantt.date.date_to_str(gantt.config.task_date);
    const today = new Date(new Date().setHours(0, 0, 0, 0)); // 获取当天零点的时间
    gantt.addMarker({
      start_date: today,
      css: "today",
      text: "今日",
      title: `Today: ${dateToStr(today)}`,
    });
  };

  // 设置 时间刻度范围 以及 时间刻度具体数值 以及 初始时间刻度
  const setZooms = () => {
    const zoomConfig = {
      levels: zoomLevels,
      // useKey: "ctrlKey",
      // trigger: "wheel",
      element: () => {
        return gantt.$root.querySelector(".gantt_task");
      },
    };

    gantt.ext.zoom.init(zoomConfig);
    gantt.ext.zoom.setLevel("day");
  };

  /** 删除任务详情 */
  const onDelDetailClick = (item) => {
    Modal.confirm({
      title: "确定删除？",
      icon: <ExclamationCircleFilled />,
      content: "您即将删除该条记录，此操作不可撤销。",
      closeIcon: <CloseOutlined />,
      okText: "确定",
      cancelText: "取消",
      async onOk() {
        const data = {
          id: item.id,
          taskHourId: item.taskHourId,
        };
        const res = await postDeleteNodeWorkHour(data);
        if (res?.result) {
          item.userKey = curTask.userKey;
          getTaskDetail(item);
          props.getDataChange(true);
          JSSDK.toast.success("删除成功");
        }
      },
      onCancel() {
        // JSSDK.toast.success('操作成功');
      },
    });
  };

  /** 编辑任务详情 */
  const onEditDetailClick = (item) => {
    item.userKey = curTask.userKey;
    setCurrItem(item);
    setIsRegistrationOpen(true);
  };
  const workHoursTotalDetailColumns = [
    {
      title: "序号",
      dataIndex: "index",
      key: "index",
      width: 50,
      render: (_, record, index) => index + 1,
    },
    {
      title: "工作项实例",
      dataIndex: "workItemName",
      key: "workItemName",
      width: 250,
      render: (_, record) => (
        <span className="user-total-workItem" title={`${record.workItemName || '--'}/${record.workItemEntityName || '--'}`}>
                {`${record.workItemName}/${record.workItemEntityName}`}
        </span>
      ),
    },
    ...(showCustomField ? [{
      title: customFieldName,
      dataIndex: "customFieldValue",
      key: "customFieldValue",
      width: 180,
      ellipsis: true,
      render: (value) => {
        const displayValue = formatCustomFieldValue(value);
        return <span className="user-total-custom-field" title={String(displayValue)}>{displayValue}</span>;
      },
    }] : []),
    {
      title: "排期",
      dataIndex: "scheduleDate",
      key: "scheduleDate",
      width: 190,
      render: (_, record) => (
        <span style={{whiteSpace: 'nowrap'}}>
          {record.scheduleStart !== null && record.scheduleEnd !== null 
            ? `${record.scheduleStart}~${record.scheduleEnd}`
            : "--"}
        </span>
      ),  
    },
    {
      title: (
        <span>
          预估工时
          <Tooltip
            title={[
              "前者：指个人的预估工时，即当前「成员」在当前「登记对象」的「估分」",
              <br key="br1" />,
              "后者：指当前工作项/节点/任务的总预估工时，即当前的「登记对象」的总「估分」"
            ]}
          >
            <InfoCircleFilled style={{ marginLeft: 4, color: '#bbbbbb' }} />
          </Tooltip>
        </span>
      ),
      dataIndex: "estimatedWorkingHours",
      key: "estimatedWorkingHours",
      width: 300,
      ellipsis:true,
      render: (_, record) => {
        if (record?.estimatedWorkingHoursSelfHour == null && record?.estimatedWorkingHoursAllHour == null) {
            return "--";
        } else {
            const estimatedWorkingHoursSelfHour= record?.estimatedWorkingHoursSelfHour?`${record.estimatedWorkingHoursSelfHour.toFixed(2)}小时`:"-"
            const estimatedWorkingHoursSelfDay= record?.estimatedWorkingHoursSelfDay?`(${record.estimatedWorkingHoursSelfDay.toFixed(2)}人天)`:"-"
            const estimatedWorkingHoursAllHour= record?.estimatedWorkingHoursAllHour?`${record.estimatedWorkingHoursAllHour.toFixed(2)}小时`:"-"
            const estimatedWorkingHoursAllDay= record?.estimatedWorkingHoursAllDay?`(${record.estimatedWorkingHoursAllDay.toFixed(2)}人天)`:"-"
            return `${estimatedWorkingHoursSelfHour}${estimatedWorkingHoursSelfDay}/${estimatedWorkingHoursAllHour}${estimatedWorkingHoursAllDay}`
        }
      },  
    },
    {
      title: (
        <span>
          已登记工时
          <Tooltip
            title={[
              "前者：指个人已登记的总实际工时，即当前「成员」在当前「登记对象」已登记的总「实际工时」",
              <br key="br1" />,
              "后者：指当前工作项/节点/任务已登记的总实际工时，即当前「登记对象」已登记的总「实际工时」"
            ]}
          >
            <InfoCircleFilled style={{ marginLeft: 4, color: '#bbbbbb' }} />
          </Tooltip>
        </span>
      ),
      dataIndex: "registeredWorkingHours",
      key: "registeredWorkingHours",
      width: 300,
      ellipsis:true,
      render: (_, record) => {
        const registeredWorkingHoursSelf= record?.registeredWorkingHoursSelf || "--"
        const registeredWorkingHoursAll= record?.registeredWorkingHoursAll || "--"
        if (record?.registeredWorkingHoursSelfHour == null && record?.registeredWorkingHoursAllHour == null) {
          return "--";
        } else {
          const registeredWorkingHoursSelfHour= record?.registeredWorkingHoursSelfHour?`${record.registeredWorkingHoursSelfHour.toFixed(2)}小时`:"-"
          const registeredWorkingHoursSelfDay= record?.registeredWorkingHoursSelfDay?`(${record.registeredWorkingHoursSelfDay.toFixed(2)}人天)`:"-"
          const registeredWorkingHoursAllHour= record?.registeredWorkingHoursAllHour?`${record.registeredWorkingHoursAllHour.toFixed(2)}小时`:"-"
          const registeredWorkingHoursAllDay= record?.registeredWorkingHoursAllDay?`(${record.registeredWorkingHoursAllDay.toFixed(2)}人天)`:"-"
          return `${registeredWorkingHoursSelfHour}${registeredWorkingHoursSelfDay}/${registeredWorkingHoursAllHour}${registeredWorkingHoursAllDay}`
        }
      },  
    }
  ];
  const detailColumns = [
    {
      title: "序号",
      dataIndex: "index",
      key: "index",
      width: 60,
      render: (_, record, index) => index + 1,
    },
    {
      title: "实际工时",
      dataIndex: "scheduleDate",
      key: "scheduleDate",
      width: 120,
      render: (_, record) => {
        if (record.act_hour !== null && record.act_day !== null) {
          return `${record.act_hour}小时（${isNumber(record.act_day)
              ? record.act_day.toFixed(2)
              : record.act_day
            }人天）`;
        } else {
          return "--";
        }
      },
    },
    {
      title: "工作日期",
      dataIndex: "workDate",
      key: "workDate",
      width: 100,
      render: (_) =>
        _ ? new Date(_).toLocaleDateString().replace(/\//g, "-") : "--",
    },
    {
      title: "工作描述",
      dataIndex: "workDesc",
      key: "workDesc",
      ellipsis: true,
      width: 150,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: "更新时间",
      dataIndex: "updateDate",
      key: "updateDate",
      width: 170,
      render: (_) =>
        _ ? new Date(_).toLocaleString().replace(/\//g, "-") : "--",
    },
  ];

  const detailOwnerColumns = [
    {
      title: "序号",
      dataIndex: "index",
      key: "index",
      width: 50,
      render: (_, record, index) => index + 1,
    },
    {
      title: "实际工时",
      dataIndex: "scheduleDate",
      key: "scheduleDate",
      width: 120,
      render: (_, record) => {
        if (record.act_hour !== null && record.act_day !== null) {
          return `${record.act_hour}小时（${isNumber(record.act_day)
              ? record.act_day.toFixed(2)
              : record.act_day
            }人天）`;
        } else {
          return "--";
        }
      },
    },
    {
      title: "工作日期",
      dataIndex: "workDate",
      key: "workDate",
      width: 100,
      render: (_) =>
        _ ? new Date(_).toLocaleDateString().replace(/\//g, "-") : "--",
    },
    {
      title: "工作描述",
      dataIndex: "workDesc",
      key: "workDesc",
      ellipsis: true,
      width: 150,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: "更新时间",
      dataIndex: "updateDate",
      key: "updateDate",
      width: 170,
      render: (_) => (_ ? dayjs(_).format("YYYY-MM-DD HH:mm:ss") : "--"),
    },
  ];

  /** 变更数据（提交+修改） */
  const onRegistrationOk = async (result) => {
    if (result) {
      getTaskDetail(currItem);
      props.getDataChange(true);
    }
    setIsRegistrationOpen(false);
  };

  const closeDetailModal = () => {
    setIsDetailOpen(false);
  };
  const closeWorkHoursTotalModal = () => {
    setIsWorkHoursTotalOpen(false)
    setWorkHoursTotalDetail({
      userKey: "",
      estimatedWorkingHours: "",
      registeredWorkingHours: "",
      workHoursData: []
    })
  }
  // 渲染成员工时汇总预估工时的方法
  const rendeEstimatedWorkingHours = () => {
    const { estimatedWorkingHoursAllHour,estimatedWorkingHoursAllDay,estimatedWorkingHoursSelfHour,estimatedWorkingHoursSelfDay} = workHoursTotalDetail
    const estimatedWorkingHoursSelfHourRe= estimatedWorkingHoursSelfHour?`${estimatedWorkingHoursSelfHour.toFixed(2)}小时`:"-"
    const estimatedWorkingHoursSelfDayRe= estimatedWorkingHoursSelfDay?`(${estimatedWorkingHoursSelfDay.toFixed(2)}人天)`:"-"
    const estimatedWorkingHoursAllHourRe= estimatedWorkingHoursAllHour?`${estimatedWorkingHoursAllHour.toFixed(2)}小时`:"-"
    const estimatedWorkingHoursAllDayRe= estimatedWorkingHoursAllDay?`(${estimatedWorkingHoursAllDay.toFixed(2)}人天)`:"-"
    return `${estimatedWorkingHoursSelfHourRe}${estimatedWorkingHoursSelfDayRe}/${estimatedWorkingHoursAllHourRe}${estimatedWorkingHoursAllDayRe}`
  };
  // 渲染成员工时汇总已登记工时的方法
   const renderRegisteredWorkingHours = () => {
    const { registeredWorkingHoursAllHour,registeredWorkingHoursAllDay,registeredWorkingHoursSelfHour,registeredWorkingHoursSelfDay} = workHoursTotalDetail
    const registeredWorkingHoursSelfHourRe= registeredWorkingHoursSelfHour?`${registeredWorkingHoursSelfHour.toFixed(2)}小时`:"-"
    const registeredWorkingHoursSelfDayRe= registeredWorkingHoursSelfDay?`(${registeredWorkingHoursSelfDay.toFixed(2)}人天)`:"-"
    const registeredWorkingHoursAllHourRe= registeredWorkingHoursAllHour?`${registeredWorkingHoursAllHour.toFixed(2)}小时`:"-"
    const registeredWorkingHoursAllDayRe= registeredWorkingHoursAllDay?`(${registeredWorkingHoursAllDay.toFixed(2)}人天)`:"-"
    return `${registeredWorkingHoursSelfHourRe}${registeredWorkingHoursSelfDayRe}/${registeredWorkingHoursAllHourRe}${registeredWorkingHoursAllDayRe}`
  };
  return (
    <Spin spinning={loading}>
      <div className="gantt-warp">
        <div
          ref={(ref) => {
            ganttContainer.current = ref;
          }}
          style={{ width: "100%", height: "100%" }}
        />
        <div className="gantt-footer">
          <div className="footer-left">
            <div className="left-item" style={{ width: 240 }}>
              <span style={{ marginLeft: "25px" }}>合计（小时）：</span>
            </div>
            {headerColumns.map((item) => {
              if (item.originField === "registerWorkingHours")
                return (
                  <div
                    key={item.originField}
                    className="left-item foot-tj-num"
                    style={{ width: 90, textAlign: "center" }}
                  >
                    {props.tasks?.registerWorkingHoursTotal}
                  </div>
                );
              if (item.originField === "standardHumanDays")
                return (
                  <div
                    key={item.originField}
                    className="left-item foot-tj-num"
                    style={{ width: 80, textAlign: "center" }}
                  >
                    {props.tasks?.standardHumanDaysTotal}
                  </div>
                );
            })}
            <div className="left-item" style={{ width: 10 }}></div>
          </div>
          <div className="show-legend">
            <Space className="top-left">
              <span>
                工作饱和度
                <Tooltip
                  className="user-tooltip"
                  placement="bottom"
                  title={
                    <React.Fragment>
                      <div>饱和度说明： 饱和度（P） = 实际工时 / 个人标准工时</div>
                      <div>未填写： 未登记工时</div>
                      <div>低饱和： 0 &lt; P ≤ 50% </div>
                      <div>饱和： 50% &lt; P ≤ 100%</div>
                      <div>超饱和： P &gt; 100%</div>
                    </React.Fragment>
                  }
                >
                  <InfoCircleFilled className="saturation-tootip" />
                </Tooltip>
                ：
                </span>
                 <Space className="top-left-item">
                <span
                  className="color-icon"
                  style={{ background: "#ffffff" }}
                ></span>
                <span className="ml-fu-3">未填写</span>
              </Space>
              <Space className="top-left-item">
                <span
                  className="color-icon"
                  style={{ background: "#FFD2DC" }}
                ></span>
                <span className="ml-fu-3">低饱和</span>
              </Space>
              <Space className="top-left-item">
                <span
                  className="color-icon"
                  style={{ background: "#FF83A2" }}
                ></span>
                <span className="ml-fu-3">饱和</span>
              </Space>
              <Space className="top-left-item">
                <span
                  className="color-icon"
                  style={{ background: "#F0144A" }}
                ></span>
                <span className="ml-fu-3">超饱和</span>
              </Space>
              <Space className="top-left-item">
                <span
                  className="color-icon"
                  style={{ background: "#eee" }}
                ></span>
                <span className="ml-fu-3">休息日</span>
              </Space>
            </Space>
          </div>
        </div>

        <Modal
          title="工时详情"
          open={isDetailOpen}
          onCancel={closeDetailModal}
          width={"745px"}
          footer={null}
          style={{ top: 200 }}
        >
          <Spin spinning={modalLoading}>
            <Form className="gantt-detail-form">
              <Form.Item style={{ marginBottom: 0 }} label="登记对象：">
                {taskDetail?.workName ? (
                  <span
                    onClick={() => goWorkItemHref(taskDetail)}
                    style={{ cursor: "pointer", color: "#4247f6" }}
                  >
                    {taskDetail.workName}
                  </span>
                ) : (
                  "--"
                )}
              </Form.Item>
              {showCustomField && (
                <Form.Item
                  style={{ marginBottom: 0 }}
                  label={`${customFieldName}：`}
                >
                  {formatCustomFieldValue(taskDetail?.customFieldValue)}
                </Form.Item>
              )}
              <Form.Item style={{ marginBottom: 0 }} label="排期：">
                <Input
                  value={taskDetail.scheduleDate ? taskDetail.scheduleDate : "--"}
                  className="rel-input"
                  disabled
                />
              </Form.Item>
              <Form.Item
                style={{ marginBottom: 0 }}
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
                <Input
                  value={
                    taskDetail.estimatedWorkingHours
                      ? taskDetail.estimatedWorkingHours
                      : "--/--"
                  }
                  className="rel-input"
                  disabled
                />
              </Form.Item>
              <Form.Item
                style={{ marginBottom: 0 }}
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
                <Input
                  value={
                    taskDetail.registeredWorkingHours
                      ? taskDetail.registeredWorkingHours
                      : "--/--"
                  }
                  className="rel-input"
                  disabled
                />
              </Form.Item>
              <Form.Item style={{ marginBottom: 10 }} label="成员" name="act">
                <div className="table-columns-item">
                  <Avatar
                    src={taskDetail.avatarUrl}
                    size={20}
                    icon={<UserOutlined />}
                  />
                  <div className="table-columns-item-right">
                    <div className="right-name">
                      {taskDetail.userName ? taskDetail.userName : "--"}
                    </div>
                  </div>
                </div>
              </Form.Item>
            </Form>
            <Table
              size="small"
              scroll={{
                x: 650,
                y: 300,
              }}
              pagination={false}
              columns={props.type === 0 ? detailColumns : detailOwnerColumns}
              dataSource={taskDetail.nodeWorkHours}
            />
          </Spin>
        </Modal>
        <Modal
          title="成员工时汇总"
          open={isWorkHoursTotalOpen}
          onCancel={closeWorkHoursTotalModal}
          width={"900px"}
          footer={null}
          style={{ top: 200 }}
        >
          <Spin spinning={modalLoading}>
          <Form className="gantt-detail-form">
            <Form.Item style={{ marginBottom: 10 }} label="成员" name="act">
              <div className="table-columns-item">
                {workHoursTotalDetail.userName ? (<><Avatar src={workHoursTotalDetail.avatarUrl} size={20} icon={<UserOutlined />} />{workHoursTotalDetail.userName}</>) : null}
              </div>
            </Form.Item>
            <Form.Item
              style={{ marginBottom: 0 }}
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
              <Input
                value={
                  rendeEstimatedWorkingHours()
                }
                className="rel-input"
                disabled
              />
            </Form.Item>
            <Form.Item
              style={{ marginBottom: 10 }}
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
              <Input
                value={
                  renderRegisteredWorkingHours()
                }
                className="rel-input"
                disabled
              />
            </Form.Item>

          </Form>
          <Table
            size="small"
            scroll={{
              x: 'max-content',
              y: 300,
            }}
            pagination={false}
            columns={workHoursTotalDetailColumns}
            dataSource={workHoursTotalDetail.workHoursData}
          />
          </Spin>
        </Modal>
        <Modal
          destroyOnHidden
          title={currItem.id ? "编辑工时日志" : "实际工时登记"}
          open={isRegistrationOpen}
          onCancel={() => setIsRegistrationOpen(false)}
          width={"745px"}
          footer={null}
        >
          <RegWorkHour
            type="web"
            getRegistrationValue={onRegistrationOk}
            setRegistrationValue={currItem}
          />
        </Modal>
      </div>
    </Spin>
  );
}
