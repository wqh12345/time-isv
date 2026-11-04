import JSSDK from '../../jssdk-adapter'
import React, { useState, useEffect, useRef } from "react";
import { useOutletContext } from 'react-router-dom'
import {
  DatePicker,
  Table,
  Button,
  Cascader,
  Modal,
  Space,
  message,
  Avatar,
  Dropdown,
  Checkbox,
  Tooltip,
  Form,
  Input,
  Select,
} from "antd";
import {
  UserOutlined,
  CloseOutlined,
  ExclamationCircleFilled,
  DownOutlined,
  RightCircleOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  getWeekStartAndEnd,
  getQuarterStartAndEnd,
  getFirstDayOfNaturalMonth,
  getLastDayOfNaturalMonth,
  urlDownload,
  isNumber,
  handleModifyType,
  goWorkItemHref,
  getApproveStatusTag,
} from '../../util/util';
import {
  getWorkItemOption,
  getEntityNodeOption,
  getStatConditionDetail,
  postQueryNodeWorkHour,
  postLogQueryNodeWorkHour,
  postDeleteNodeWorkHour,
  postIsvAdminDelLog,
  postLogDeleteNodeWorkHourBatch,
  postExportNodeWorkHour,
  getExportNodeWorkHourResult,
  getApprovalSettings,
  getApproveDetailList,
  querySeatUserPermission,
  queryNeedShowTeamConfig,
  getRegisterableLevelMap
} from '../../api/api';
import "./index.less";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import RegBtn from "../../components/reg-btn/RegBtn";
import MemberSelectModal from "../../components/member-select-modal/MemberSelectModal";
import RegWorkHour from "../../components/reg-workHour/RegWorkHour";
import WorkNodeCascader from "../../components/workNode-cascader/WorkNodeSelect";
import SpaceCascader from '../../components/space-cascader/SpaceCascader';
import { SeatPermissionsModal } from '../../components/seat-permissions-modal/SeatPermissionsModal';
import {
  formatCustomFieldValue,
  useTenantCustomFieldConfig,
} from '../../hooks/useTenantCustomFieldConfig';
dayjs.extend(customParseFormat);
const { RangePicker } = DatePicker;
const rangePresets = [
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

const Log = (props) => {
  const [beginTime, setBeginTime] = useState(
    localStorage.getItem("logBeginTime") || getFirstDayOfNaturalMonth()
  );
  const [endTime, setEndTime] = useState(
    localStorage.getItem("logEndTime") || getLastDayOfNaturalMonth
  );
  const [workItem, setWorkItem] = useState([]);
  const [workItemId, setWorkItemId] = useState("");
  const [workItemEntityId, setWorkItemEntityId] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [configApproval, setConfigApproval] = useState({});
  const [logLoading, setLogLoading] = useState(false);
  const [isApprovalInfoOpen, setIsApprovalInfoOpen] = useState(false);
  const dropdownItems = [
    {
      key: 0,
      onClick: () => onDropdownChange(0),
      label: "团队统计",
    },
    {
      key: 1,
      onClick: () => onDropdownChange(1),
      label: "个人统计",
    },
  ];
  const [currDropdownIndex, setCurrDropdownIndex] = useState(0);
  const [isSelectedUserOpen, setIsSelectedUserOpen] = useState(false);
  const [memberSelectInitial, setMemberSelectInitial] = useState(null);
  const [selected, setSelected] = useState({
    selectedDeparts: [],
    selectedUsers: [],
    selectedDepartIds: [],
    selectedUserIds: [],
    checkedKeys: [],
  });
  const [newSelected, setNewSelected] = useState({
    selectedDeparts: [],
    selectedUsers: [],
    selectedDepartIds: [],
    selectedUserIds: [],
    checkedKeys: [],
  });
  const [isSynchronous, setIsSynchronous] = useState(Boolean);
  const [isSelectedTeamAdmin, setIsSelectedTeamAdmin] = useState(false);
  const [logList, setLogList] = useState({
    nodeWorkHours: [],
    pageNo: 1,
    pageSize: 10,
    total: 0,
  });
  const [logPagination, setLogPagination] = useState({
    current: 1,
    pageSize: 10,
  });
  const [currItem, setCurrItem] = useState({});
  const [exportLoading, setExportLoading] = useState(false);
  // 批量删除：已选行与请求 loading
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [batchDeleteLoading, setBatchDeleteLoading] = useState(false);
  const [isApprove, setIsApprove] = useState(false);
  const [approvalNo, setApprovalNo] = useState("");
  const [registrationObject, setRegistrationObject] = useState("");
  const [debounceTimer, setDebounceTimer] = useState(null);
  const [showSeatModal, setShowSeatModal] = useState(false);
  const [chatUrl, setChatUrl] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCode, setModalCode] = useState();
  const [modalResponseData, setModalResponseData] = useState(undefined);
  const [showTeamConfig, setShowTeamConfig] = useState(false);
  const [teamConfigLoaded, setTeamConfigLoaded] = useState(false);
  const [removeTeamIds, setRemoveTeamIds] = useState([]);
  const [removeUserIds, setRemoveUserIds] = useState([]);
  const [isAllUser, setIsAllUser] = useState(false);
  const [isAllTeam, setIsAllTeam] = useState(false);
  const isPersonal = useRef(1)
  const passParam = useRef(0)
  const skipFetchRef = useRef(false)
  const lastAutoFetchSignatureRef = useRef("");
  const [spaceIds, setSpaceIds] = useState([]);
  // 级联选择器状态：[spaceId, workItemId, workItemEntityId, nodeId, taskId]
  const [cascaderValue, setCascaderValue] = useState([]);
  const [projectKey, setProjectKey] = useState("");
  const {
    fieldName: customFieldName,
    showCustomField,
    loading: customFieldConfigLoading,
  } = useTenantCustomFieldConfig();

  const onDelLogClick = async (item) => {
    const res2 = await querySeatUserPermission();
    // 如果接口返回true，显示SeatPermissionsModal
    if (res2?.result && res2?.data?.msgCode) {
      setModalCode(res2?.data?.msgCode);
      setModalResponseData(res2?.data);
      setModalOpen(true); // 显示模态框
      setChatUrl(res2?.data?.chatUrl);
      return;
    }
    Modal.confirm({
      title: "确定删除？",
      icon: <ExclamationCircleFilled />,
      content: item?.tag === 0 ? "此登记对象已删除，删除可能影响数据准确性，此操作不可恢复。" : "您即将删除该条记录，此操作不可撤销。",
      closeIcon: <CloseOutlined />,
      okText: item?.isApprove ? "提交审批" : "确定",
      cancelText: "取消",
      async onOk() {
        // 新接口 /isv/admin/delLog 入参仅需 id
        const data = { id: item.id, projectKey:item.projectKey};
        const res = await postIsvAdminDelLog(data);
        if (res?.result) {
          fetchData(registrationObject);
          JSSDK.toast.success("删除成功");
        }
      },
      onCancel() {
        // JSSDK.toast.success('操作成功');
      },
    });
  };

  /** 复选框禁用判断：与操作列删除按钮的禁用逻辑一致（无删除权限 / 审批中 / 已删除对象且角色受限） */
  const isRowDeleteDisabled = (record) => {
    if (!record?.operationList?.includes("DELETE")) return true;
    if (record?.isApproving) return true;
    if (
      record?.tag === 0 &&
      (localStorage.getItem("meegoTeamworkUserRole") === "member" ||
        (localStorage.getItem("meegoTeamworkUserRole") === "space_admin" && !record?.isProjectAdmin))
    ) {
      return true;
    }
    return false;
  };

  /** 批量删除 */
  const onBatchDelete = async () => {
    if (!selectedRows.length) return;
    // 席位权限校验（与单条删除一致）
    const res2 = await querySeatUserPermission();
    if (res2?.result && res2?.data?.msgCode) {
      setModalCode(res2?.data?.msgCode);
      setModalResponseData(res2?.data);
      setModalOpen(true);
      setChatUrl(res2?.data?.chatUrl);
      return;
    }
    const count = selectedRows.length;
    Modal.confirm({
      title: "确认删除所选工时？",
      icon: <ExclamationCircleFilled />,
      content: `您即将删除所选的 ${count} 条工时日志，此操作不可撤销。`,
      closeIcon: <CloseOutlined />,
      okText: "确认删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      async onOk() {
        // 按 projectKey 聚合选中 id → items
        const groupMap = {};
        selectedRows.forEach((row) => {
          const pk = row.projectKey;
          if (!groupMap[pk]) groupMap[pk] = [];
          groupMap[pk].push(row.id);
        });
        const items = Object.keys(groupMap).map((projectKey) => ({
          projectKey,
          ids: groupMap[projectKey],
        }));
        setBatchDeleteLoading(true);
        try {
          const res = await postLogDeleteNodeWorkHourBatch({ items });
          if (res?.result) {
            JSSDK.toast.success("删除成功");
            setSelectedRowKeys([]);
            setSelectedRows([]);
            fetchData(registrationObject);
          }
        } finally {
          setBatchDeleteLoading(false);
        }
      },
      onCancel() {},
    });
  };
  const filterApprovalRecords = (data, logItem) => {
    const dataKeys = Object.keys(data);
    // 获取第一个key的值
    const firstKeyValues = data[dataKeys[0]] || [];
    //logItem.
    // 过滤逻辑
    const { workItemId, type } = logItem;
    // 情况1：workItemId在data的key中
    if (data[workItemId]) {
      // 检查type是否存在于对应的数组中
      if (data[workItemId].includes(type)) {
      } else {
        logItem.canRegisterLevel = false
        logItem.canRegisterLevelName = data[workItemId]
      }
      return logItem
    } else {
      if (firstKeyValues.includes(type)) {
      } else {
        logItem.canRegisterLevel = false
        logItem.canRegisterLevelName = firstKeyValues
      }
      return logItem
    }
  };
  // 编辑工时日志详情弹窗
  const showEditLogModal = async (item) => {
   const data = {
      projectKey: item?.projectKey,
    }
    const res = await getRegisterableLevelMap(data);
    if (res?.result && res?.data) {
      let logItem = JSON.parse(JSON.stringify(item));
      const result = filterApprovalRecords(res?.data, logItem);
      let noCanRegisterWorkItem = false
      if (res?.data?.canRegister) {
        let noCanRegisterWorkItem = res?.data?.canRegister.some(item => item.canRegistWorkItemId === '0')
        if (noCanRegisterWorkItem) {
        } else {
          noCanRegisterWorkItem = res?.data?.canRegister.some(item => item.canRegistWorkItemId === logItem.workItemId)
          result.noCanRegisterWorkItem = !noCanRegisterWorkItem
        }
      }
      item = result
    }
    setCurrItem(item);
    const loginUser = { id: item?.userKey, name: item?.userName, avatar: item?.avatarUrl }
    const modal = await JSSDK.modal.open({
      entry: "RegModal",
      width: 745,
      maskClosable: false,
      context: {
        title: "编辑工时日志",
        loginUser: loginUser,
        registrationType: "single",
        setRegistrationValue: item,
        currItem: item,
      }, // context 为任意值，仅可传递静态数据(不支持 ReactNode | Function)
      onSubmit: (confirm) => {
        modal.close(); // 关闭弹窗
        if (confirm.confirm) {
          onRegistrationOk(confirm.confirm);
        }
      },
    });
  }
  const onEditLogClick = async (item) => {
    const res2 = await querySeatUserPermission();
    // 如果接口返回true，显示SeatPermissionsModal
    if (res2?.result && res2?.data?.msgCode) {
      setModalCode(res2?.data?.msgCode);
      setModalResponseData(res2?.data);
      setModalOpen(true); // 显示模态框
      setChatUrl(res2?.data?.chatUrl);
      return;
    }
    if (item?.tag === 0) {
      Modal.confirm({
        title: "提示？",
        icon: <ExclamationCircleFilled />,
        content: "此登记对象已删除，编辑可能影响数据准确性，是否继续?",
        closeIcon: <CloseOutlined />,
        okText: "确定",
        cancelText: "取消",
        onOk() {
          showEditLogModal(item)
        },
        onCancel() {
        }
      })
    } else {
      showEditLogModal(item)
    }
  };
  const logColumns = [
    {
      title: "空间",
      dataIndex: "projectName",
      key: "projectName",
      width: 120,
      ellipsis: true,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: "工作项",
      dataIndex: "workItemName",
      key: "workItemName",
      width: 120,
      ellipsis: true,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: "工作项实例",
      dataIndex: "workItemEntityName",
      key: "workItemEntityName",
      width: 180,
      ellipsis: true,
      render: (_) => (_ ? _ : "--"),
    },
    ...(showCustomField ? [{
      title: customFieldName,
      dataIndex: "customFieldValue",
      key: "customFieldValue",
      width: 180,
      ellipsis: true,
      render: (value) => {
        const displayValue = formatCustomFieldValue(value);
        return <span title={String(displayValue)}>{displayValue}</span>;
      },
    }] : []),
    {
      title: "节点",
      dataIndex: "nodeName",
      key: "nodeName",
      width: 100,
      ellipsis: true,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: "任务",
      dataIndex: "taskName",
      key: "taskName",
      width: 100,
      ellipsis: true,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: "成员",
      dataIndex: "userName",
      key: "userName",
      width: 120,
      render: (_, record) => (
        <div className="table-columns-item">
          <Avatar src={record.avatarUrl} size={18} icon={<UserOutlined />} />
          <div className="table-columns-item-right">
            <div className="right-name">
              {record.userName ? record.userName : "--"}
              {record?.status === "resigned" ? "(已离职)" : ""}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "成员排期",
      dataIndex: "scheduleDate",
      key: "scheduleDate",
      width: 200,
      render: (_, record) => {
        if (record.scheduleDate_start && record.scheduleDate_end) {
          return (
            <div>
              {dayjs(record.scheduleDate_start).format("YYYY-MM-DD")}~
              {dayjs(record.scheduleDate_end).format("YYYY-MM-DD")}
            </div>
          );
        } else {
          return "--";
        }
      },
    },
    {
      title: "预估工时",
      dataIndex: "eval",
      key: "eval",
      width: 180,
      render: (_, record) => {
        if (record.eval_day_str !== null && record.eval_hour_str !== null) {
          return `${record.eval_hour_str}小时（${record.eval_day_str}人天）`;
        } else {
          return "--";
        }
      },
    },
    {
      title: "登记工时",
      dataIndex: "act",
      key: "act",
      width: 180,
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
      title: "工作描述",
      dataIndex: "workDesc",
      key: "workDesc",
      ellipsis: true,
      width: 180,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: "工作日期",
      dataIndex: "workDate",
      key: "workDate",
      width: 120,
      render: (_) => (_ ? dayjs(_).format("YYYY-MM-DD") : "--"),
    },
    {
      title: "登记人",
      dataIndex: "registrantStaffName",
      key: "registrantStaffName",
      width: 120,
      render: (_, record) => (
        <div className="table-columns-item">
          <Avatar
            src={record.registrantStaffAvatarUrl}
            size={18}
            icon={<UserOutlined />}
          />
          <div className="table-columns-item-right">
            <div className="right-name">
              {record.registrantStaffName ? record.registrantStaffName : "--"}
              {record?.registrantStaffStatus === "resigned" ? "(已离职)" : ""}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "登记时间",
      dataIndex: "registrationTime",
      key: "registrationTime",
      width: 180,
      render: (_) => (_ ? dayjs(_).format("YYYY-MM-DD HH:mm:ss") : "--"),
    },
    {
      title: "更新人",
      dataIndex: "updateStaffName",
      key: "updateStaffName",
      width: 120,
      render: (_, record) => (
        <div className="table-columns-item">
          <Avatar
            src={record.updateStaffAvatarUrl}
            size={18}
            icon={<UserOutlined />}
          />
          <div className="table-columns-item-right">
            <div className="right-name">
              {record.updateStaffName ? record.updateStaffName : "--"}
              {record?.updateStaffStatus === "resigned" ? "(已离职)" : ""}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "更新时间",
      dataIndex: "updateDate",
      key: "updateDate",
      width: 180,
      render: (_) => (_ ? dayjs(_).format("YYYY-MM-DD HH:mm:ss") : "--"),
    },
    {
      title: "是否为审批",
      dataIndex: "isApprove",
      key: "isApprove",
      width: 100,
      ellipsis: true,
      render: (_) => (_ === 1 ? "是" : "否"),
    },
    {
      title: "操作",
      key: "operate",
      dataIndex: "relatedEntityDeleted",
      width: 165,
      fixed: "right",
      align: "right",
      render: (_, record) => (
        <Space size="middle"  className="table-columns-h36">
          {record?.operationList?.includes("APPROVALINFO") ? (
            <Button
              className="opt-btn"
              type="link"
              onClick={() => {
                setCurrItem(record);
                setIsApprovalInfoOpen(true);
              }}
            >
              审批详情
            </Button>
          ) : null}
          {record?.operationList?.includes("EDIT") ? (
            record?.isApproving ? (
              <Tooltip title="当前工时日志存在待审批的工时变更">
                <Button
                  disabled={record?.isApproving}
                  className="opt-btn"
                  type="link"
                >
                  编辑
                </Button>
              </Tooltip>
            ) : (record?.tag === 0 && (localStorage.getItem("meegoTeamworkUserRole") === "member" || (localStorage.getItem("meegoTeamworkUserRole") === "space_admin") && !record?.isProjectAdmin)) ? (
              <Tooltip title={"此登记对象已删除，无法进行编辑，请联系插件管理员或应用管理员进行操作"}>
                <Button
                  disabled={true}
                  className="opt-btn"
                  type="link"
                >
                  编辑
                </Button>
              </Tooltip>
            ) : (
              <Button
                className="opt-btn"
                type="link"
                onClick={() => onEditLogClick(record)}
              >
                编辑
              </Button>
            )
          ) : null}
          {record?.operationList?.includes("DELETE") ? (
            record?.isApproving ? (
              <Tooltip title="当前工时日志存在待审批的工时变更">
                <Button
                  disabled={record?.isApproving}
                  className="opt-btn"
                  type="link"
                >
                  删除
                </Button>
              </Tooltip>
            ) : (record?.tag === 0 && (localStorage.getItem("meegoTeamworkUserRole") === "member" || (localStorage.getItem("meegoTeamworkUserRole") === "space_admin") && !record?.isProjectAdmin)) ? (
              <Tooltip title={"此登记对象已删除，无法进行删除，请联系管理员操作"}>
                <Button
                  disabled={true}
                  className="opt-btn"
                  type="link"
                >
                  删除
                </Button>
              </Tooltip>
            ) : (
              <Button
                className="opt-btn"
                type="link"
                onClick={() => onDelLogClick(record)}
              >
                删除
              </Button>
            )
          ) : null}
        </Space>
      ),
    },
  ];
  /** 是否显示团队设置 */
  const queryNeedShowTeamConfigData = async () => {
    try {
      const res = await queryNeedShowTeamConfig();
      if (res?.result) {
        if (res.data) {
          isPersonal.current = 0;
        } else {
          isPersonal.current = 1;
        }
        setShowTeamConfig(res.data || false);
      }
    } catch (e) {
      console.error('查询团队设置配置失败:', e);
    } finally {
      setTeamConfigLoaded(true);
    }
  };
  /** 获取审批配置 */
  const getApprovalSettingsData = async () => {
    const projectKey = sessionStorage.getItem('jwtMeegoTeamworkProjectKey');
    const res = await getApprovalSettings({ projectKey });
    if (res?.result) {
      setConfigApproval(res.data);
    }
  }
  useEffect(() => {
    getApprovalSettingsData();
    queryNeedShowTeamConfigData();
  }, []);

  /** 获取以往查询条件（统一接口，locationType=2 工时日志） */
  const getHistoryState = async () => {
    const res = await getStatConditionDetail({ locationType: 2 });
    if (res?.code === 200 && res?.data) {
      const d = res.data || {};
      setMemberSelectInitial({
        selectUserList: d.selectUserList || [],
        selectOrgList: d.selectOrgList || [],
        selectTeamList: d.selectTeamList || [],
        isSynchronous: d.isSynchronous || false,
        isSelectedTeamAdmin: d.isSelectedTeamAdmin,
        isAllUser: d.isAllUser || false,
        isAllTeam: d.isAllTeam || false,
      });
      setIsSynchronous(!!d.isSynchronous);
      setIsSelectedTeamAdmin(!!d.isSelectedTeamAdmin);
      setIsAllUser(!!d.isAllUser);
      setIsAllTeam(!!d.isAllTeam);
      (d?.selectUserList || []).forEach((u) => { if (u) u.avatar = u.avatarUrl })
      const userIds = (d.selectUserList || []).map((u) => u.unionId || u.userKey).filter(Boolean);
      const departIds = [
        ...(d.selectOrgList || []).map((o) => o.departmentId || o.openDepartmentId).filter(Boolean),
        ...(d.selectTeamList || []).map((t) => t.teamId).filter(Boolean),
      ];
      const next = {
        ...selected,
        selectedUserIds: userIds,
        selectedDepartIds: departIds,
      };
      setSelected(next);
      setNewSelected(next);
    }
  };

  /** 获取工时日志列表 */
  const fetchData = async (content = "") => {
    if (customFieldConfigLoading) return;
    // 列表重新加载（翻页 / 改筛选 / 刷新）时清空已选，避免跨页误删
    setSelectedRowKeys([]);
    setSelectedRows([]);
    setLogLoading(true);
    // 新接口：/log/queryNodeWorkHour，入参以接口文档为准（pageNum代替pageNo）
    const data = {
      projectKey,
      workItemId: workItem[0] || "",
      workItemEntityId: workItem[1] || "",
      nodeId: workItem[2] || "",
      taskId: workItem[3] || "",
      startDate: beginTime
        ? beginTime + " 00:00:00"
        : getFirstDayOfNaturalMonth() + " 00:00:00",
      endDate: endTime
        ? endTime + " 23:59:59"
        : getLastDayOfNaturalMonth() + " 23:59:59",
      pageNum: logPagination.current,
      pageSize: logPagination.pageSize,
      approvalNo,
      // 以下字段为工时日志页原有业务过滤项，后端如不识别会忽略
      // isSynchronous: isSynchronous || false,
      statisticType: currDropdownIndex,
      userIdList: newSelected.selectedUserIds,
      teamIds: newSelected.selectedDepartIds,
      registrationObject: content,
    };
    if (passParam.current === 1) {
      data.isAllUser = newSelected.isAllUser || false
      data.isAllTeam = newSelected.isAllTeam || false
      data.isSelectedTeamAdmin = isSelectedTeamAdmin
    }
    if (isPersonal.current) {
      data.statisticType = 1
    }
    if (isApprove) data.isApprove = isApprove;
    if (!data.userIdList.length && !data.teamIds.length) delete data.isSynchronous;
    const res = await postLogQueryNodeWorkHour(data);
    if (res?.result) {
      if (!res?.data?.nodeWorkHours?.length && logPagination.current > 1) {
        setLogPagination({
          ...logPagination,
          current: logPagination.current - 1,
        });
        return;
      }
      setLogList(res.data);
    }
    setLogLoading(false);
  };

  useEffect(() => {
    if (!teamConfigLoaded || customFieldConfigLoading) return;

    const fetchSignature = JSON.stringify({
      beginTime,
      endTime,
      workItem,
      projectKey,
      currDropdownIndex,
      logPagination,
      isApprove,
      approvalNo,
    });
    if (skipFetchRef.current) {
      skipFetchRef.current = false;
      lastAutoFetchSignatureRef.current = fetchSignature;
      return;
    }
    if (lastAutoFetchSignatureRef.current === fetchSignature) return;
    lastAutoFetchSignatureRef.current = fetchSignature;
    fetchData(registrationObject);
  }, [
    teamConfigLoaded,
    customFieldConfigLoading,
    JSON.stringify([beginTime, endTime]),
    workItem,
    projectKey,
    currDropdownIndex,
    logPagination,
    isApprove,
    approvalNo,
  ]);

  /** 时间改变 */
  const onTimeChange = (date, dateString) => {
    passParam.current = 0;
    localStorage.setItem("logBeginTime", dateString[0]);
    localStorage.setItem("logEndTime", dateString[1]);
    setLogPagination({ ...logPagination, current: 1 });
    setBeginTime(dateString[0] ? dateString[0] : getFirstDayOfNaturalMonth());
    setEndTime(dateString[1] ? dateString[1] : getLastDayOfNaturalMonth());
  };

  /** 统计纬度切换 */
  const onDropdownChange = (e) => {
    passParam.current = 0;
    setLogPagination({ ...logPagination, current: 1 });
    setCurrDropdownIndex(e);
    setLogPagination({ ...logPagination, current: 1 });
  };

  /** 打开人员选择器 */
  const onSelectedUserOpen = () => {
    getHistoryState().then(() => {
      setIsSelectedUserOpen(true);
    });
  };

  const handleSelectedUserCancel = () => {
    setIsSelectedUserOpen(false);
    const selectData = {
      selectedDeparts: [],
      selectedUsers: [],
      selectedDepartIds: [],
      selectedUserIds: [],
      checkedKeys: [],
    }
    setSelected({ ...selectData });
    setNewSelected({ ...selectData });
  };

  const handleSelectedUserOk = async (data) => {
    // 将 MemberSelectModal 返回的数据格式转换为原有的格式
    const selectedUserIds = data.selectedMembers.map(m => m.id);
    const selectedDepartIds = [
      ...data.selectedTeams.map(t => t.id),
      ...data.selectedDepartments.map(d => d.id)
    ];

    if (!selectedUserIds.length && !selectedDepartIds.length) {
      JSSDK.toast.warning("团队成员不能为空");
      return;
    }

    // 按 /log/queryNodeWorkHour 新接口入参构造 payload
    const selectUserList = (data.selectedMembers || []).map(m => ({
      unionId: m.unionId || m.id,
      userKey: m.userKey,
    }));
    const selectOrgList = (data.selectedDepartments || []).map(d => ({
      departmentId: d.departmentId || d.openDepartmentId || d.id,
      unionId: d.unionId,
      userKey: d.userKey,
    }));
    const selectTeamList = (data.selectedTeams || []).map(t => ({
      teamId: t.teamId || t.id,
    }));

    const payload = {
      startDate: beginTime
        ? beginTime + " 00:00:00"
        : getFirstDayOfNaturalMonth() + " 00:00:00",
      endDate: endTime
        ? endTime + " 23:59:59"
        : getLastDayOfNaturalMonth() + " 23:59:59",
      pageNo: 1,
      pageSize: logPagination.pageSize,
      isSynchronous: !!data.isSynchronous,
      statisticType: isPersonal.current ? 1 : currDropdownIndex,
      registrationObject: registrationObject || "",
      approvalNo: approvalNo || "",
      isAllUser: data.isAllUser || false,
      isAllTeam: data.isAllTeam || false,
      isAllDepartment: data.isAllDepartment || false,
      isSelectedTeamAdmin: !!data.selectTeamAdmin,
      selectUserList,
      selectOrgList,
      selectTeamList,
    };

    setIsSelectedUserOpen(false);
    // 团队成员筛选变更：清空批量删除已选
    setSelectedRowKeys([]);
    setSelectedRows([]);
    setNewSelected({
      ...selected,
      selectedUserIds,
      selectedDepartIds,
    });
    setIsSelectedTeamAdmin(!!data.selectTeamAdmin);
    setIsSynchronous(!!data.isSynchronous);
    setLogPagination({ ...logPagination, current: 1 });
    passParam.current = 1;
    skipFetchRef.current = true;

    setLogLoading(true);
    try {
      const res = await postLogQueryNodeWorkHour(payload);
      if (res?.result) {
        setLogList(res.data);
      }
    } finally {
      setLogLoading(false);
    }
  };

  const getSelectedUser = (e) => {
    setSelected({ ...e });
  };

  /** 分页 */
  const onLogChange = (page, e) => {
     logPagination.current = page;
    setLogPagination(logPagination);
  };

  /** 切换数据量 */
  const onLogTableChange = (pagination, filters, sorter) => {
    if (pagination.pageSize !== logPagination.pageSize) {
      if (pagination.current !== 1) pagination.current = 1;
      logList.nodeWorkHours = [];
      setLogList({ ...logList });
    }
    setLogPagination(pagination);
  };

  /** 变更数据（提交+修改） */
  const onRegistrationOk = async (result) => {
    if (result) {
      fetchData(registrationObject);
    }
    setIsRegistrationOpen(false);
  };

  /** 工时日志导出 */
  const onExport = async () => {
    const res2 = await querySeatUserPermission();
        // 如果接口返回true，显示SeatPermissionsModal
        if (res2?.result && res2?.data?.msgCode) {
          setModalCode(res2?.data?.msgCode);
          setModalResponseData(res2?.data);
          setModalOpen(true); // 显示模态框
          setChatUrl(res2?.data?.chatUrl);
          return;
        }
    setExportLoading(true);
    const data = {
      statisticType: isPersonal.current ? 1 : currDropdownIndex,
      projectKey,
      workItemId: workItem[0] || "",
      workItemEntityId: workItem[1] || "",
      nodeId: workItem[2] || "",
      taskId: workItem[3] || "",
      startDate: beginTime
        ? beginTime + " 00:00:00"
        : getFirstDayOfNaturalMonth() + " 00:00:00",
      endDate: endTime
        ? endTime + " 23:59:59"
        : getLastDayOfNaturalMonth() + " 23:59:59",
      approvalNo,
    };
    if (isApprove) data.isApprove = isApprove;
    const res = await postExportNodeWorkHour(data);
    if (res?.result) {
      message.loading({
        key: "exportNodeWorkHour",
        content: "数据准备中，请稍后",
        duration: 0,
      });

      let timer = setInterval(async () => {
        if (!res?.data) return;
        const getUrl = await getExportNodeWorkHourResult({
          uuid: res?.data,
        });
        if (getUrl?.result) {
          switch (getUrl?.data?.code) {
            case 1:
              clearInterval(timer);
              message.destroy("exportNodeWorkHour");
              JSSDK.toast.success("导出完成");
              urlDownload(getUrl?.data?.url, "工时日志");
              break;
            case 0:
              clearInterval(timer);
              message.destroy("exportNodeWorkHour");
              JSSDK.toast.error(getUrl?.data?.msg);
              break;
            case -1:
              clearInterval(timer);
              onExport();
              break;
            default:
              break;
          }
        }
      }, 1000);
    } else {
      message.destroy("exportNodeWorkHour");
      if (![10024, 10025].includes(res.data.code)) {
        JSSDK.toast.error("导出失败，请重新操作");
      }
    }
    setExportLoading(false);
  };

  const getWorkItem = (workItem) => {
    setLogPagination({ ...logPagination, current: 1 });
    if (!workItem) setWorkItem([]);
    if (workItem?.length > 2) {
      setWorkItem(workItem);
      if (workItem[0]) setWorkItemId(workItem[0]);
      if (workItem[1]) setWorkItemEntityId(workItem[1]);
      if (workItem[2]) setNodeId(workItem[2]);
      if (workItem[3]) setTaskId(workItem[3]);
    }
  };
  const handleSearchChange = (e) => {
    passParam.current = 0;
    const value = e.target.value;
    setRegistrationObject(value);
    // 清除之前的定时器
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // 设置新的定时器
    const timer = setTimeout(() => {
      fetchData(value);
    }, 300); // 300毫秒防抖延迟

    setDebounceTimer(timer);
  };

  useEffect(() => {
    return () => {
      // 组件卸载时清除定时器
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);
  return (
    <div className="log-warp">
      <div className="log-top">
        <div className="top-left">
          <Input
            allowClear
            placeholder="请输入审批单号"
            size="small"
            value={approvalNo}
            style={{ width: "180px" }}
            className="top-item"
            onChange={(e) => {
              passParam.current = 0;
              setApprovalNo(e.target.value);
            }}
            suffix={<SearchOutlined style={{ color: "#BBBBBB" }} />}
          />
          <RangePicker
            size="small"
            allowClear={false}
            className="top-item time-picker"
            presets={rangePresets}
            value={
              beginTime && endTime ? [dayjs(beginTime), dayjs(endTime)] : []
            }
            onChange={onTimeChange}
          />
          <Select
            mode="multiple"
            value={spaceIds}
            style={{ width: 250, display: 'none' }}
            allowClear
            onChange={(val) => {
              setSpaceIds(val)
            }}
            placeholder="全部空间"
            size="small"
          />
          {/* 五级级联：空间 / 工作项 / 实例 / 节点 / 任务，替换原有 全部空间 + 登记对象 + 输入工作项实例 */}
          <SpaceCascader
            size="small"
            style={{ width: 360 }}
            className="top-item"
            value={cascaderValue}
            placeholder="空间 / 工作项 / 实例 / 节点 / 任务"
            onChange={(ids, names, selectedOptions) => {
              passParam.current = 0;
              setLogPagination({ ...logPagination, current: 1 });
              setCascaderValue(selectedOptions ? selectedOptions.map(o => o.value) : []);
              const arr = Array.isArray(ids) ? ids : [];
              setProjectKey(arr[0] || "");
              // fetchData 取 workItem[0~3] 对应 workItemId/entityId/nodeId/taskId
              setWorkItem([arr[1] || "", arr[2] || "", arr[3] || "", arr[4] || ""]);
              setWorkItemId(arr[1] || "");
              setWorkItemEntityId(arr[2] || "");
              setNodeId(arr[3] || "");
              setTaskId(arr[4] || "");
            }}
          />
          <Checkbox
            checked={isApprove}
            onChange={(e) => {
              passParam.current = 0;
              // 切换筛选条件时重置到第 1 页，避免在非第 1 页触发"空数据自动回退页码"导致连续多次请求
              setLogPagination((prev) => ({ ...prev, current: 1 }));
              setIsApprove(e.target.checked);
            }}
          >
            仅展示工时审批的数据
          </Checkbox>
        </div>
        <div className="top-right">
          {showTeamConfig && currDropdownIndex === 0 ? (
            <Button
              icon={<RightCircleOutlined />}
              iconPosition="end"
              type="link"
              onClick={onSelectedUserOpen}
            >
              团队设置
            </Button>
          ) : null}
          {showTeamConfig ? (
            <Dropdown
              className="top-item"
              menu={{
                items: dropdownItems,
              }}
            >
              <a onClick={(e) => e.preventDefault()}>
                <Space>
                  {dropdownItems[currDropdownIndex].label}
                  <DownOutlined />
                </Space>
              </a>
            </Dropdown>
          ) : null}
          <Space>
            <Button
              type="primary"
              danger
              size="small"
              disabled={selectedRowKeys.length === 0}
              loading={batchDeleteLoading}
              onClick={onBatchDelete}
            >
              批量删除
            </Button>
            <Button
              color="primary"
              variant="outlined"
              size="small"
              disabled={exportLoading}
              onClick={onExport}
            >
              导出
            </Button>
            <RegBtn
              loginUser={props?.loginUser}
              type="web"
              getRegStatus={onRegistrationOk}
              getRegistrationValue={onRegistrationOk}
              setRegistrationValue={false}
            />
          </Space>
        </div>
      </div>
      <div className="log-content">
        <Table
          size="small"
          loading={logLoading}
          columns={logColumns}
          dataSource={logList?.nodeWorkHours}
          rowKey={(record, index) => `${record.projectKey ?? ''}_${record.id ?? ''}_${index}`}
          rowSelection={{
            selectedRowKeys,
            preserveSelectedRowKeys: false,
            onChange: (keys, rows) => {
              setSelectedRowKeys(keys);
              setSelectedRows(rows);
            },
            getCheckboxProps: (record) => ({ disabled: isRowDeleteDisabled(record) }),
          }}
          pagination={{
            current: logPagination.current, //当前页码
            pageSize: logPagination.pageSize, // 每页数据条数
            total: logList?.total, // 总条数
            onChange: (page) => onLogChange(page), //改变页码的函数
            showSizeChanger: logList?.total > 10 ? true : false,
            showQuickJumper: true,
            pageSizeOptions: [10, 20, 50, 100],
            // hideOnSinglePage:
            //   logList?.total > 10 && logList?.total < 20 ? false : true,
          }}
          onChange={onLogTableChange}
          scroll={{
            // x: 1300,
            y: "calc(100vh - 300px)",
          }}
        />
      </div>
      <MemberSelectModal
        open={isSelectedUserOpen}
        initialValue={memberSelectInitial}
        onCancel={handleSelectedUserCancel}
        onConfirm={handleSelectedUserOk}
        queryType={2}
      />
      <Modal
        destroyOnHidden
        title={currItem.id ? "编辑工时日志" : "登记工时"}
        open={isRegistrationOpen}
        onCancel={() => setIsRegistrationOpen(false)}
        width={745}
        footer={null}
        styles={{ body: { paddingBottom: 16, overflowX: 'hidden' } }}
      >
        <RegWorkHour
          loginUser={props?.loginUser}
          type="web"
          getRegistrationValue={onRegistrationOk}
          setRegistrationValue={currItem}
        />
      </Modal>
      <Modal
        title="审批详情"
        open={isApprovalInfoOpen}
        onCancel={() => setIsApprovalInfoOpen(false)}
        width={"745px"}
        footer={null}
        style={{ top: 200 }}
      >
        <Form className="approval-detail-form">
          <Form.Item style={{ marginBottom: 0 }} label="登记对象：">
            {currItem?.workItemEntityName ? (
              <span
                className="link"
                onClick={(e) => {
                  e.stopPropagation();
                  goWorkItemHref(currItem);
                }}
              >
                {currItem?.workItemName}/{currItem?.workItemEntityName}
                {currItem?.nodeName ? `/${currItem?.nodeName}` : ""}
                {currItem?.taskName ? `/${currItem?.taskName}` : ""}
              </span>
            ) : (
              "--"
            )}
          </Form.Item>
          <Form.Item style={{ marginBottom: 10 }} label="成员" name="act">
            <div className="table-columns-item">
              <Avatar
                src={currItem?.avatarUrl}
                size={20}
                icon={<UserOutlined />}
              />
              <div className="table-columns-item-right">
                <div className="right-name">
                  {currItem?.userName ? currItem?.userName : "--"}
                </div>
              </div>
              {/* { currItem?.userKey?<Tag userId={currItem?.userKey} />: ""} */}
            </div>
          </Form.Item>
          <Form.Item style={{ marginBottom: 10 }} label="审批记录"></Form.Item>
          <ApprovalInfoTable id={currItem?.id} />
        </Form>
      </Modal>
      <SeatPermissionsModal
        open={modalOpen}
        code={modalCode}
        responseData={modalResponseData}
        chatUrl={chatUrl} // 可以从父组件传递，也可以在子组件固定
        onClose={() => {
          setModalOpen(false);
          // 重置状态，避免下次打开时显示旧内容
          setModalCode(undefined);
          setModalResponseData(undefined);
        }}
      />
    </div>
  );
};

export default Log;

const ApprovalInfoTable = (props) => {
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState([]);
  const columns = [
    {
      title: "序号",
      dataIndex: "index",
      key: "index",
      width: 60,
      ellipsis: true,
      render: (_, record, index) => index + 1,
    },
    {
      title: "审批单",
      dataIndex: "approvalNo",
      key: "approvalNo",
      width: 150,
      ellipsis: true,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: "变更类型",
      dataIndex: "modifyType",
      key: "modifyType",
      width: 75,
      ellipsis: true,
      render: (_) => handleModifyType(_),
    },
    {
      title: "审批状态",
      dataIndex: "approvalStatus",
      key: "approvalStatus",
      width: 80,
      ellipsis: true,
      render: (_) => getApproveStatusTag(_),
    },
    {
      title: "登记工时",
      dataIndex: "actWorkHour",
      key: "actWorkHour",
      width: 100,
      ellipsis: true,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: "工作日期",
      dataIndex: "workDate",
      key: "workDate",
      width: 120,
      ellipsis: true,
      render: (_) => (_ ? dayjs(_).format("YYYY-MM-DD") : "--"),
    },
    {
      title: "工作描述",
      dataIndex: "workDesc",
      key: "workDesc",
      width: 180,
      ellipsis: true,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: "审批人",
      dataIndex: "approvalUserName",
      key: "approvalUserName",
      width: 120,
      ellipsis: true,
      render: (_, record) => {
        return record.status === 1 && record.waitApprovalList && record.waitApprovalList.length > 0 ? (
          <div className="table-columns-item">
            <Avatar
              src={record.waitApprovalList[0].avatarUrl}
              size={18}
              icon={<UserOutlined />}
            />
            <div className="table-columns-item-right">
              <div className="right-name">
                {record.waitApprovalList[0].nameCn
                  ? record.waitApprovalList[0].nameCn
                  : "--"}
              </div>
            </div>
            {record.waitApprovalList.length > 1 && (
              <Tooltip
                className="custom-tooltip"
                placement="top"
                title={
                  <div>
                    {record.waitApprovalList.slice(1).map((item, index) => (
                      <div key={item.userKey || index} style={{ marginBottom: 4 }}>
                        <Avatar
                          src={item.avatarUrl}
                          size={18}
                          icon={<UserOutlined />}
                        />
                        <div className="table-columns-item-right">
                          <div className="right-name">
                            {item.nameCn
                              ? item.nameCn
                              : "--"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                }
              >
                <span className="wait-approval-count">+{record.waitApprovalList.length - 1}</span>
              </Tooltip>
            )}
          </div>
        ) : record.approvalUserAvatarUrl || record.approvalUserName ? (
          <div className="table-columns-item">
            <Avatar
              src={record.approvalUserAvatarUrl}
              size={18}
              icon={<UserOutlined />}
            />
            <div className="table-columns-item-right">
              <div className="right-name">
                {record.approvalUserName
                  ? record.approvalUserName
                  : "--"}
              </div>
            </div>
          </div>
        ) : (
          "--"
        )
      },
    },
    {
      title: "审批意见",
      dataIndex: "approvalReason",
      key: "approvalReason",
      width: 180,
      ellipsis: true,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: "审批时间",
      dataIndex: "approvalTime",
      key: "approvalTime",
      width: 180,
      ellipsis: true,
      render: (_) => (_ ? dayjs(_).format("YYYY-MM-DD HH:mm:ss") : "--"),
    },
  ];

  /** 获取数据 */
  const getDataSource = async () => {
    setDataSource([]);
    setLoading(true);
    const res = await getApproveDetailList({
      id: props?.id,
    });
    if (res?.result) {
      setDataSource(res?.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (props?.id) getDataSource();
  }, [props?.id]);

  return (
    <Table
      size="small"
      rowKey="id"
      loading={loading}
      columns={columns}
      dataSource={dataSource}
      pagination={false}
      scroll={{
        y: "100%",
      }}
    />
  );
};
