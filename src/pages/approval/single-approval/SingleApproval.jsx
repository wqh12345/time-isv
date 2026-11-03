import JSSDK from '../../../jssdk-adapter'
import React, { useState, useEffect, useRef } from "react";
import {
  Table,
  Button,
  Modal,
  Space,
  message,
  Avatar,
  Tooltip,
  Drawer,
  Input,
  Form,
  Tabs,
  DatePicker,
  Select,
  Menu,
  Checkbox,
  Tag,
} from "antd";
import {
  UserOutlined,
  CloseOutlined,
  ExclamationCircleFilled,
  InfoCircleFilled,
  SearchOutlined,
} from "@ant-design/icons";
import {
  postApproveAllList,
  postApproveSelfInitiatedList,
  postApproveSelfTodoList,
  postApproveSelfDoneList,
  postApproveHandle,
  getApprovalLog,
  postBatchApproveHandle,
  getApproveInfo,
  querySeatUserPermission,
} from '../../../api/api';
import {
  handleModifyType,
  getApproveStatusTag,
  goWorkItemHref,
} from '../../../util/util';
import {
  MENU_KEY,
  buildStatusMenuItems,
  getEffectiveStatus,
  isSelfApproveTodo,
  isSelfApproveDone,
} from "../approvalMenuConfig";
import ApprovalDrawerExtra, {
  APPROVAL_TYPE_FEISHU,
} from "../components/ApprovalDrawerExtra";
import "./SingleApproval.less";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import RegWorkHour from "../../../components/reg-workHour/RegWorkHour";
import UserPicker from "../../../components/user-picker/UserPicker";
import WorkNodeCascader from "../../../components/workNode-cascader/WorkNodeSelect";
import SpaceCascader from "../../../components/space-cascader/SpaceCascader";
import { SeatPermissionsModal } from '../../../components/seat-permissions-modal/SeatPermissionsModal';
import {
  formatCustomFieldValue,
  useTenantCustomFieldConfig,
} from '../../../hooks/useTenantCustomFieldConfig';
dayjs.extend(customParseFormat);
const { RangePicker } = DatePicker;
const dateFormat = "YYYY-MM-DD";
const { TextArea } = Input;

const SingleApproval = (props) => {
  const {
    fieldName: customFieldName,
    showCustomField,
  } = useTenantCustomFieldConfig();
  const [workItem, setWorkItem] = useState([]);
  const [workItemId, setWorkItemId] = useState("");
  const [workItemEntityId, setWorkItemEntityId] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [projectKey, setProjectKey] = useState("");
  const [loading, setLoading] = useState();
  const [searchForm] = Form.useForm();
  const [curApprovalState, setCurApprovalState] = useState("0");
  const [searchCondition, setSearchCondition] = useState({});
  // SpaceCascader 受控值：[projectKey, workItemId, workItemEntityId, nodeId, taskId]
  const [cascaderValue, setCascaderValue] = useState([]);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [curItem, setCurItem] = useState({});
  // 抽屉对应的列表行：跳转 URL 的 instanceCode 只取列表行数据（不用详情接口的值）
  const [curListRecord, setCurListRecord] = useState(null);
  const [dataSource, setDataSource] = useState({});
  // 抽屉对应的列表行：跳转与审批明细显隐均以该列表行字段为准
  const drawerListRecord =
    curListRecord ?? dataSource?.data?.find((r) => r.id === curItem?.id);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tablePagination, setTablePagination] = useState({
    pageNum: 1,
    pageSize: 10,
  });
  const [isPageRefresh, setIsPageRefresh] = useState(false);
  const [batchPassBtnDisabled, setBatchPassBtnDisabled] = useState(true);
  const [batchPassBtnToolShow, setBatchPassBtnToolShow] = useState(false);
  const [batchRefuseBtnDisabled, setBatchRefuseBtnDisabled] = useState(true);
  const [batchRefuseBtnToolShow, setBatchRefuseBtnToolShow] = useState(false);
  const [batchCancelBtnDisabled, setBatchCancelBtnDisabled] = useState(true);
  const [batchCancelBtnToolShow, setBatchCancelBtnToolShow] = useState(false);
  const [batchAgainBtnDisabled, setBatchAgainBtnDisabled] = useState(true);
  const [batchAgainBtnToolShow, setBatchAgainBtnToolShow] = useState(false);
  const [curOperateBtn, setCurOperateBtn] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const approvalIdsArray = useRef(new Map());
  /** 记录上一次的一级 tab，用于切换 tab 时重置状态页签 */
  const prevMenuRef = useRef(props?.curMenu);
  const [spaceIds, setSpaceIds] = useState([]);
  const [spaceOptions, setSpaceOptions] = useState([
    { label: '空间 A', value: 'space_a' },
    { label: '空间 B', value: 'space_b' },
    { label: '空间 C', value: 'space_c' },
    { label: '空间 D', value: 'space_d' },
    { label: '空间 E', value: 'space_e' },
  ]);
  /** 「全部审批」「已办」两个 tab 不展示操作列（批量区/勾选列现状本就仅待办） */
  const hideOperateColumn =
    props?.curMenu === MENU_KEY.ALL || isSelfApproveDone(props?.curMenu);
  const columns = [
    {
      title: "审批单",
      dataIndex: "approvalNo",
      key: "approvalNo",
      width: 130,
      ellipsis: true,
      render: (_, record) => {
        // 检查当前记录的审批ID是否存在于指定数组中
        const shouldShowTooltip = approvalIdsArray.current.has(record.id);
        let shouldShowTooltipText = approvalIdsArray.current.get(record.id)
        shouldShowTooltipText = shouldShowTooltipText ? shouldShowTooltipText.join('；') : ''
        return _ ? (
          <div
            onClick={(e) => {
              e.stopPropagation();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {_}
            {shouldShowTooltip && record.approvalStatus === 1 && (
              <Tooltip title={shouldShowTooltipText}>
                <InfoCircleFilled style={{ color: 'red', fontSize: '12px' }} />
              </Tooltip>
            )}
          </div>
        ) : (
          "--"
        );
      }
    },
    {
      title: "成员",
      dataIndex: "userName",
      key: "userName",
      width: 120,
      ellipsis: true,
      render: (_, record) => (
        <div className="table-columns-item">
          <Avatar
            src={record.staffAvatarUrl}
            size={18}
            icon={<UserOutlined />}
          />
          <div className="table-columns-item-right">
            <div className="right-name">
              {record.staffName ? record.staffName : "--"}
              {/* {record?.status === "resigned" ? "(已离职)" : ""} */}
            </div>
          </div>
        </div>
      ),
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
      title: "登记工时",
      dataIndex: "actWorkHour",
      key: "actWorkHour",
      width: 100,
      align: "center",
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
      ellipsis: true,
      width: 180,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: "状态",
      dataIndex: "approvalStatus",
      key: "approvalStatus",
      ellipsis: true,
      width: 80,
      render: (_) => {
        if (getApproveStatusTag(_)) return getApproveStatusTag(_);
        return "--";
      },
    },
    {
      title: "所属空间",
      dataIndex: "projectName",
      key: "projectName",
      ellipsis: true,
      width: 100,
      render: (_, record) =>
        record.projectName ? record.projectName : "--",
    },
    {
      title: "所属工作项",
      dataIndex: "workItemId",
      key: "workItemId",
      ellipsis: true,
      width: 100,
      render: (_, record) => (record.workItemName ? record.workItemName : "--"),
    },
    ...(showCustomField ? [{
      title: customFieldName,
      dataIndex: "customFieldValue",
      key: "customFieldValue",
      width: 182,
      ellipsis: true,
      render: (value) => {
        const displayValue = formatCustomFieldValue(value);
        return <span title={String(displayValue)}>{displayValue}</span>;
      },
    }] : []),
    {
      title: "登记对象",
      dataIndex: "workItemEntityId",
      key: "workItemEntityId",
      width: 180,
      ellipsis: true,
      render: (_, record) =>
        record.workItemEntityName ? (
          <Tooltip
            title={`${record.workItemEntityName}
          ${record.nodeName ? `/${record.nodeName}` : ""}
          ${record.taskName ? `/${record.taskName}` : ""}`}
          >
            <div
              className="link"
              onClick={(e) => {
                e.stopPropagation();
                goWorkItemHref(record);
              }}
              style={{
                width: 180,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {record.workItemEntityName}
              {record.nodeName ? `/${record.nodeName}` : ""}
              {record.taskName ? `/${record.taskName}` : ""}
            </div>
          </Tooltip>
        ) : (
          "--"
        ),
    },
    {
      title: (
        <div className="table-columns-item-title">
          <span>已登记工时</span>
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
            <InfoCircleFilled />
          </Tooltip>
        </div>
      ),
      dataIndex: "registeredWorkTime",
      key: "registeredWorkTime",
      ellipsis: true,
      width: 200,
      render: (_) => (_ ? _ : "--/--"),
    },
    {
      title: "更新人",
      dataIndex: "updateName",
      key: "updateName",
      width: 120,
      ellipsis: true,
      render: (_, record) => (
        <div className="table-columns-item">
          <Avatar
            src={record.updateAvatarUrl}
            size={18}
            icon={<UserOutlined />}
          />
          <div className="table-columns-item-right">
            <div className="right-name">
              {record.updateName ? record.updateName : "--"}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "更新时间",
      dataIndex: "updateTime",
      key: "updateTime",
      width: 180,
      ellipsis: true,
      render: (_) => (_ ? dayjs(_).format("YYYY-MM-DD HH:mm:ss") : "--"),
    },
    {
      title: "审批人",
      dataIndex: "approvalName",
      key: "approvalName",
      width: 120,
      ellipsis: true,
      render: (_, record) => {
        return record.approvalStatus === 1 && record.waitApprovalList && record.waitApprovalList.length > 0 ? (
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
                        {item.nameCn ? item.nameCn : "--"}
                      </div>
                    ))}
                  </div>
                }
              >
                <span className="wait-approval-count">+{record.waitApprovalList.length - 1}</span>
              </Tooltip>
            )}
          </div>
        ) : record.approvalName || record.approvalAvatarUrl ? (
          <div className="table-columns-item">
            <Avatar
              src={record.approvalAvatarUrl}
              size={18}
              icon={<UserOutlined />}
            />
            <div className="table-columns-item-right">
              <div className="right-name">
                {record.approvalName
                  ? record.approvalName
                  : "--"}
              </div>
            </div>
          </div>
        ) : (
          "--"
        )
      }
    },
    {
      title: "审批时间",
      dataIndex: "approvalTime",
      key: "approvalTime",
      width: 180,
      ellipsis: true,
      render: (_) => (_ ? dayjs(_).format("YYYY-MM-DD HH:mm:ss") : "--"),
    },
    // 操作列：「全部审批」「已办」tab 整列不渲染
    ...(hideOperateColumn ? [] : [{
      title: "操作",
      key: "operate",
      dataIndex: "operate",
      fixed: "right",
      width: 120,
      render: (_, record) => (
        <Space size="small">
          {/* 「我发起的」tab 不显示审批按钮，其他 tab 照常按 operationList 控制 */}
          {props?.curMenu !== MENU_KEY.SELF_INITIATED &&
            record?.operationList?.includes("audit") ? (
            <Button
              className="opt-btn"
              type="link"
              onClick={(e) => onOperateClick(e, record, "audit")}
            >
              审批
            </Button>
          ) : null}
          {/* 「待办」tab 操作列不显示撤回按钮 */}
          {props?.curMenu !== MENU_KEY.SELF_APPROVE_TODO &&
          record?.operationList?.includes("cancel") ? (
            <Button
              className="opt-btn"
              type="link"
              onClick={(e) => onOperateClick(e, record, "cancel")}
            >
              撤回
            </Button>
          ) : null}
          {record?.operationList?.includes("again_launch") ? (
            (record?.tag === 0 && (localStorage.getItem("meegoTeamworkUserRole") === "member" || (localStorage.getItem("meegoTeamworkUserRole") === "space_admin") && !record?.isProjectAdmin)) ? (
              <Tooltip title={"此登记对象已删除，无法进行操作"}>
                <Button
                  disabled={true}
                  className="opt-btn"
                  type="link"
                >
                  再次发起
                </Button>
              </Tooltip>
            ) : (
              <Button
                className="opt-btn"
                type="link"
                onClick={(e) => onOperateClick(e, record, "again_launch")}
              >
                再次发起
              </Button>
            )
          ) : null}
         
          {record?.operationList?.includes("delete") ? (
            <Button
              className="opt-btn"
              type="link"
              onClick={(e) => onOperateClick(e, record, "delete")}
            >
              撤销
            </Button>
          ) : null}
          {record?.operationList?.includes("revoke") ? (
            <Button
              className="opt-btn"
              type="link"
              onClick={(e) => onOperateClick(e, record, "revoke")}
            >
              撤销
            </Button>
          ) : null}
          <div style={{ width: "1px", height: "36px" }}></div>
        </Space>
      ),
    }]),
  ];
  const [showSeatModal, setShowSeatModal] = useState(false);
  const [chatUrl, setChatUrl] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCode, setModalCode] = useState();
  const [modalResponseData, setModalResponseData] = useState(undefined);
  useEffect(() => {
    if (props?.hasApprove) searchForm.setFieldValue("approvalStatus", 1);
  }, []);
  /** 获取表格数据 */
  const getTableDataSource = async () => {
    setLoading(true);
    setIsPageRefresh(false);
    setSelectedRowKeys([]);
    setSelectedRows([]);
    const searchData = searchForm.getFieldsValue();
    if (searchData?.timeDays) {
      searchData.startTime = searchData.timeDays[0].format("YYYY-MM-DD");
      searchData.endTime = searchData.timeDays[1].format("YYYY-MM-DD");
      delete searchData.timeDays;
    }
    if (searchData?.workItem) {
      searchData.projectKey = searchData?.workItem[0];
      searchData.workItemId = searchData?.workItem[1];
      searchData.workItemEntityId = searchData?.workItem[2];
      searchData.nodeId = searchData?.workItem[3];
      searchData.taskId = searchData?.workItem[4];
      delete searchData.workItem;
    }
    const data = {
      ...searchData,
      ...tablePagination,
    };
    // 待办固定查「待审批」，其余 tab 用当前选中的状态页签
    const effectiveStatus = getEffectiveStatus({
      curMenu: props?.curMenu,
      curApprovalState,
    });
    if (Number(effectiveStatus))
      data.approvalStatus = Number(effectiveStatus);
    let res = {};
    switch (props?.curMenu) {
      case MENU_KEY.ALL:
        res = await postApproveAllList(data);
        break;
      case MENU_KEY.SELF_INITIATED:
        res = await postApproveSelfInitiatedList(data);
        break;
      case MENU_KEY.SELF_APPROVE_TODO:
        res = await postApproveSelfTodoList(data);
        break;
      case MENU_KEY.SELF_APPROVE_DONE:
        res = await postApproveSelfDoneList(data);
        break;
      default:
        break;
    }
    if (res?.result) {
      let sortedData = []
      res?.data?.data.forEach((item) => {
        if (approvalIdsArray.current.has(item.id)) {
          sortedData.push(item)
        }
      });
      res?.data?.data.forEach((item) => {
        if (!approvalIdsArray.current.has(item.id)) {
          sortedData.push(item)
        }
      });
      res.data.data = sortedData
      setDataSource(res.data);
    }
    setLoading(false);
  };

  /** 获取审批详情信息 */
  const getApprovalInfo = async (record) => {
    const data = {
      id: record?.id,
    };
    const res = await getApproveInfo(data);
    // 后端详情可能不返回 projectKey，从列表记录中补全
    setCurItem({ ...res?.data, projectKey: record?.projectKey });
  };

  useEffect(() => {
    if (isPageRefresh) getTableDataSource();
  }, [isPageRefresh]);
  const checkApprovalInfo = async () => {
    if (sessionStorage.getItem("approvalInfo")) {
      const approvalInfo = JSON.parse(sessionStorage.getItem("approvalInfo"));
      if (approvalInfo?.curApprovalType === "single") {
        const data = {
          id: approvalInfo?.id,
        };
        const res = await getApproveInfo(data);
        setCurItem(res.data);
        setDrawerOpen(true);
      }
    }
  };
  useEffect(() => {
    checkApprovalInfo()
  }, []);
  useEffect(() => {
    approvalIdsArray.current.clear()
    if (!sessionStorage.getItem("approvalInfo")) {
      setCurItem({});
    }
    // 切换一级 tab（待办 / 已办 / 全部审批 / 我发起的）时，状态页签回到「全部」
    if (prevMenuRef.current !== props?.curMenu) {
      prevMenuRef.current = props?.curMenu;
      if (curApprovalState !== "0") {
        setCurApprovalState("0");
        return;
      }
    }
    if (tablePagination.pageNum !== 1) {
      setTablePagination({
        ...tablePagination,
        pageNum: 1,
      });
    } else {
      setSelectedRowKeys([]);
      setSelectedRows([]);
      setIsPageRefresh(true);
    }
  }, [props?.curMenu, curApprovalState, searchCondition]);

  useEffect(() => {
    setSelectedRowKeys([]);
    setSelectedRows([]);
    getTableDataSource();
  }, [tablePagination]);

  /** 点击操作按钮 */
  const onOperateClick = async (e, record, operate) => {
    setCurOperateBtn("");
    e && e.stopPropagation();
    let reason = "";
    const res2 = await querySeatUserPermission();
    // 如果接口返回true，显示SeatPermissionsModal
    if (res2?.result && res2?.data?.msgCode) {
      setModalCode(res2?.data?.msgCode);
      setModalResponseData(res2?.data);
      setModalOpen(true); // 显示模态框
      setChatUrl(res2?.data?.chatUrl);
      return;
    }
    switch (operate) {
      // 审批
      case "audit":
        onDrawerOpen(record);
        break;
      // 撤回
      case "cancel":
        reason = "";
        Modal.confirm({
          title: "确认撤回工时审批？",
          content: (
            <>
              <div>
                确认
                <span style={{ color: "#faad14" }}> 撤回 </span>
                当前成员登记的工时？撤回后当前审批人将无法继续审批。
              </div>
              <TextArea
                showCount
                maxLength={200}
                style={{ width: "100%", marginTop: "10px" }}
                onChange={(e) => {
                  reason = e.target.value;
                }}
                placeholder="请输入撤回原因（非必填）"
                autoSize={{ minRows: 3, maxRows: 5 }}
              />
            </>
          ),
          closeIcon: <CloseOutlined />,
          okText: "确定",
          cancelText: "取消",
          async onOk() {
            const data = {
              projectKey: record.projectKey,
              id: record.id,
              type: "cancel",
              reason,
            };
            const res = await postApproveHandle(data);
            if (res?.result) {
              approvalIdsArray.current.delete(record.id)
              JSSDK.toast.success("撤回成功");
              getTableDataSource();
              props?.getOperate();
            }
          },
          onCancel() {
            // JSSDK.toast.success('操作成功');
          },
        });
        break;
      // 再次发起
      case "again_launch":
        if (record.modifyType === "create" || record.modifyType === "edit") {
          record.registrantUserKey = record.userKey;
          record.avatarUrl = record.staffAvatarUrl;
          record.userName = record.staffName;
          setCurItem(record);
          // setIsRegistrationOpen(true);
          const modal = await JSSDK.modal.open({
            entry: "RegModal",
            width: 745,
            // height: 710,
            maskClosable: false,
            context: {
              title: "编辑审批工时",
              type: "approval",
              loginUser: props?.loginUser,
              registrationType: "single",
              setRegistrationValue: record,
              currItem: record,
            }, // context 为任意值，仅可传递静态数据(不支持 ReactNode | Function)
            onSubmit: (confirm) => {
              modal.close(); // 关闭弹窗
              if (confirm.confirm) {
                getTableDataSource();
                props?.getOperate();
              }
            },
          });
          return;
        }
        if (record.modifyType === "delete") {
          Modal.confirm({
            title: "确认再次发起审批？",
            icon: <ExclamationCircleFilled />,
            content:
              "当前工时审批变更类型为 [ 删除 ] ，审批通过后对应的工时日志将成功删除，不可恢复。",
            closeIcon: <CloseOutlined />,
            okText: "确定",
            cancelText: "取消",
            async onOk() {
              const data = {
                id: record.id,
                type: "again_launch",
                reason,
                actWorkHour: record?.actWorkHour,
                workDesc: record?.workDesc,
                workDate: record?.workDate,
                modifyType: record?.modifyType,
              };
              const res = await postApproveHandle(data);
              if (res?.result) {
                JSSDK.toast.success("再次发起审批成功");
                getTableDataSource();
                props?.getOperate();
              }
            },
            onCancel() {
              // JSSDK.toast.success('操作成功');
            },
          });
          return;
        }
        break;
      // 撤销
      case "revoke":
        Modal.confirm({
          title: "确认撤销工时审批？",
          icon: <ExclamationCircleFilled />,
          content: "您即将撤销该条工时审批记录，撤销后不可恢复。",
          closeIcon: <CloseOutlined />,
          okText: "确定",
          cancelText: "取消",
          async onOk() {
            const data = {
              projectKey: record.projectKey,
              id: record.id,
              type: "revoke",
              reason,
            };
            const res = await postApproveHandle(data);
            if (res?.result) {
              JSSDK.toast.success("撤销成功");
              getTableDataSource();
              props?.getOperate();
            }
          },
          onCancel() {
            // JSSDK.toast.success('操作成功');
          },
        });
        break;
      // 删除
      case "delete":
        Modal.confirm({
          title: "确认撤销工时审批？",
          icon: <ExclamationCircleFilled />,
          content: "您即将撤销该条工时审批记录，撤销后审批单关闭不可操作。",
          closeIcon: <CloseOutlined />,
          okText: "确定",
          cancelText: "取消",
          async onOk() {
            const data = {
              projectKey: record.projectKey,
              id: record.id,
              type: "delete",
              reason,
            };
            const res = await postApproveHandle(data);
            if (res?.result) {
              JSSDK.toast.success("撤销成功");
              getTableDataSource();
              props?.getOperate();
            }
          },
          onCancel() {
            // JSSDK.toast.success('操作成功');
          },
        });
        break;
      // 单个通过
      case "pass":
        reason = "";
        Modal.confirm({
          title: "工时审批通过确认",
          content: (
            <>
              <div>
                确认
                <span style={{ color: "#4247f6" }}> 通过 </span>
                工时审批？确认后当前工时变更立即生效。
              </div>
              <TextArea
                showCount
                maxLength={200}
                style={{ width: "100%", marginTop: "10px" }}
                onChange={(e) => {
                  reason = e.target.value;
                }}
                placeholder="请输入审批意见（非必填）"
                autoSize={{ minRows: 3, maxRows: 5 }}
              />
            </>
          ),
          closeIcon: <CloseOutlined />,
          okText: "确定",
          cancelText: "取消",
          async onOk() {
            const data = {
              projectKey: record.projectKey,
              id: record.id,
              type: "pass",
              reason,
            };
            const res = await postApproveHandle(data);
            if (res?.result) {
              let approvalTipText = '操作成功'
              if (res?.data) {
                let approvalIdsArrayData = new Map(approvalIdsArray.current)
                res?.data?.results?.forEach(item => {
                  if (approvalIdsArrayData.has(item.id)) {
                    let errMsgArr = approvalIdsArrayData.get(item.id)
                    if (!errMsgArr.includes(item.result)) {
                      errMsgArr.push(item.result)
                      approvalIdsArrayData.set(item.id, errMsgArr)
                    }
                  } else {
                    approvalIdsArrayData.set(item.id, [item.result])
                  }
                })
                approvalIdsArray.current = approvalIdsArrayData
                approvalTipText = res?.data?.passCount ? `操作成功` : '操作失败'
              }
              if (approvalTipText == '操作成功') {
                JSSDK.toast.success(approvalTipText);
              } else {
                JSSDK.toast.error(approvalTipText);
              }
              //JSSDK.toast.success("操作成功");
              setDrawerOpen(false);
              props?.getOperate();
              setCurItem({});
            } else {
              getApprovalInfo(curItem);
            }
            getTableDataSource();
          },
          onCancel() {
            // JSSDK.toast.success('操作成功');
          },
        });
        break;
      // 单个拒绝
      case "refuse":
        reason = "";
        Modal.confirm({
          title: "工时审批拒绝确认",
          content: (
            <>
              <div>
                确认
                <span style={{ color: "#df000e" }}> 拒绝 </span>
                工时审批？确认后当前工时变更不生效。
              </div>
              <TextArea
                showCount
                maxLength={200}
                style={{ width: "100%", marginTop: "10px" }}
                onChange={(e) => {
                  reason = e.target.value;
                }}
                placeholder="请输入审批意见（非必填）"
                autoSize={{ minRows: 3, maxRows: 5 }}
              />
            </>
          ),
          closeIcon: <CloseOutlined />,
          okText: "确定",
          cancelText: "取消",
          async onOk() {
            const data = {
              projectKey: record.projectKey,
              id: record.id,
              type: "refuse",
              reason,
            };
            const res = await postApproveHandle(data);
            if (res?.result) {
              JSSDK.toast.success("操作成功");
              setDrawerOpen(false);
              props?.getOperate();
            } else {
              getApprovalInfo(curItem);
            }
            getTableDataSource();
          },
          onCancel() {
            // JSSDK.toast.success('操作成功');
          },
        });
        break;
      // 批量通过
      case "batchPass":
        Modal.confirm({
          title: "工时审批通过确认",
          content: (
            <>
              <div>
                确认
                <span style={{ color: "#4247f6" }}> 批量通过 </span>
                工时审批？确认后当前工时变更立即生效。
              </div>
              <TextArea
                showCount
                maxLength={200}
                style={{ width: "100%", marginTop: "10px" }}
                onChange={(e) => {
                  reason = e.target.value;
                }}
                placeholder="请输入审批意见（非必填）"
                autoSize={{ minRows: 3, maxRows: 5 }}
              />
            </>
          ),
          closeIcon: <CloseOutlined />,
          okText: "确定",
          cancelText: "取消",
          async onOk() {
            const data = {
              ids: selectedRowKeys,
              type: "pass",
              reason,
            };
            const res = await postBatchApproveHandle(data);
            if (res?.result) {
              let approvalTipText = '操作成功'
              if (res?.data) {
                let approvalIdsArrayData = new Map(approvalIdsArray.current)
                res?.data?.results?.forEach(item => {
                  if (approvalIdsArrayData.has(item.id)) {
                    let errMsgArr = approvalIdsArrayData.get(item.id)
                    if (!errMsgArr.includes(item.result)) {
                      errMsgArr.push(item.result)
                      approvalIdsArrayData.set(item.id, errMsgArr)
                    }
                  } else {
                    approvalIdsArrayData.set(item.id, [item.result])
                  }
                })
                approvalIdsArray.current = approvalIdsArrayData
                approvalTipText = `批量审批完成，成功通过：${res?.data?.passCount}条，审批失败：${res?.data?.errorCount}条`
                if (res?.data?.hasApprovalCount && res?.data?.hasApprovalCount != 0) {
                  approvalTipText += `。其中${res?.data?.hasApprovalCount}条因审批单状态已变更，无法进行审批`
                }
              }
              if(res?.data?.errorCount || res?.data?.hasApprovalCount>0){
                JSSDK.toast.warning(approvalTipText);
              }else{
                JSSDK.toast.success(approvalTipText);
              }
              props?.getOperate();
            }
            setCurItem({});
            getTableDataSource();
          },
          onCancel() {
            // JSSDK.toast.success('操作成功');
          },
        });
        props?.getOperate("batchPassErr");
        break;
      // 批量拒绝
      case "batchRefuse":
        Modal.confirm({
          title: "工时审批拒绝确认",
          content: (
            <>
              <div>
                确认
                <span style={{ color: "#df000e" }}> 批量拒绝 </span>
                工时审批？确认后当前工时变更不生效。
              </div>
              <TextArea
                showCount
                maxLength={200}
                style={{ width: "100%", marginTop: "10px" }}
                onChange={(e) => {
                  reason = e.target.value;
                }}
                placeholder="请输入审批意见（非必填）"
                autoSize={{ minRows: 3, maxRows: 5 }}
              />
            </>
          ),
          closeIcon: <CloseOutlined />,
          okText: "确定",
          cancelText: "取消",
          async onOk() {
            const data = {
              ids: selectedRowKeys,
              type: "refuse",
              reason,
            };
            const res = await postBatchApproveHandle(data);
            if (res?.result) {
              let approvalTipText = '操作成功'
              if (res?.data) {
                approvalTipText = `批量拒绝：批量操作完成。成功拒绝：${res?.data?.passCount}条，操作失败：${res?.data?.errorCount}条。`
                if (res?.data?.hasApprovalCount && res?.data?.hasApprovalCount != 0) {
                  approvalTipText += `其中${res?.data?.hasApprovalCount}条因审批单状态已变更，无法进行审批操作`
                }
              }
              if (res?.data?.errorCount > 0 || res?.data?.hasApprovalCount > 0) {
                JSSDK.toast.warning(approvalTipText);
              }else{
                JSSDK.toast.success(approvalTipText);
              }
              props?.getOperate();
            }
            getTableDataSource();
          },
          onCancel() {
            // JSSDK.toast.success('操作成功');
          },
        });
        props?.getOperate("batchRefuseErr");
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    if (curOperateBtn) onOperateClick("", selectedRowKeys, curOperateBtn);
  }, [curOperateBtn]);
  useEffect(() => {
  }, [approvalIdsArray])
  /** 打开侧拉弹窗 */
  const onDrawerOpen = (item) => {
    setCurItem(item);
    setCurListRecord(item);
    setDrawerOpen(true);
  };

  /** 控制批量按钮显示规则 */
  const handleSelectedRows = async () => {
    if (!selectedRowKeys.length) {
      setBatchPassBtnDisabled(true);
      setBatchPassBtnToolShow(false);
      setBatchRefuseBtnDisabled(true);
      setBatchRefuseBtnToolShow(false);
      return;
    }
    let isBatchApproval = true;
    let isBatchCancel = true;
    let isBatchAgain = true;
    selectedRows?.forEach((element) => {
      if (!element.operationList.includes("audit")) {
        isBatchApproval = false;
      }
      if (!element.operationList.includes("cancel")) {
        isBatchCancel = false;
      }
      if (!element.operationList.includes("again_launch")) {
        isBatchAgain = false;
      }
    });
    if (isBatchApproval) {
      setBatchPassBtnDisabled(false);
      setBatchPassBtnToolShow(false);
      setBatchRefuseBtnDisabled(false);
      setBatchRefuseBtnToolShow(false);
    } else {
      setBatchPassBtnDisabled(true);
      setBatchPassBtnToolShow(true);
      setBatchRefuseBtnDisabled(true);
      setBatchRefuseBtnToolShow(true);
    }
    if (isBatchCancel) {
      setBatchCancelBtnDisabled(false);
      setBatchCancelBtnToolShow(false);
    } else {
      setBatchCancelBtnDisabled(true);
      setBatchCancelBtnToolShow(true);
    }
    if (isBatchAgain) {
      setBatchAgainBtnDisabled(false);
      setBatchAgainBtnToolShow(false);
    } else {
      setBatchAgainBtnDisabled(true);
      setBatchAgainBtnToolShow(true);
    }
  };

  useEffect(() => {
    handleSelectedRows();
  }, [selectedRows]);

  /** 关闭侧拉弹窗 */
  const onDrawerClose = () => {
    if (sessionStorage.getItem("approvalInfo")) {
      sessionStorage.removeItem("approvalInfo");
    }
    setDrawerOpen(false);
    setCurItem({});
    setCurListRecord(null);
  };

  /** 分页 */
  const onPageChange = (page, e) => {
    tablePagination.pageNum = page;
    setTablePagination(tablePagination);
  };

  /** 切换数据量 */
  const onSizeChange = (pagination) => {
    approvalIdsArray.current = new Map()
    if (pagination.pageSize !== tablePagination.pageSize) {
      if (pagination.current !== 1) pagination.current = 1;
      dataSource.data = [];
      setDataSource(dataSource);
    }
    pagination.pageNum = pagination.current;
    setTablePagination(pagination);
  };

  /** 变更工时审批 */
  const onRegistrationOk = async (result) => {
    if (result) {
      getTableDataSource();
      props?.getOperate();
    }
    setIsRegistrationOpen(false);
  };

  /** 筛选改变 */
  const onSearchValuesChange = (changedValues, allValues) => {
    setSearchCondition(allValues);
  };

  /** 筛选成员 */
  const onSearchPersonChange = (value) => {
    searchForm.setFieldValue("staffUserKeys", value);
    approvalIdsArray.current = new Map()
    setSearchCondition({ ...searchCondition, staffUserKeys: value });
  };

  /** 筛选登记对象 */
  const getWorkItem = (workItem) => {
    approvalIdsArray.current = new Map()
    if (!workItem) {
      searchForm.setFieldValue("workItem", []);
      setSearchCondition({ ...searchCondition, workItem: [] });
    }
    if (workItem?.length > 2) {
      searchForm.setFieldValue("workItem", workItem);
      setSearchCondition({ ...searchCondition, workItem });
    }
  };

  /** 状态页签：待办不展示；已办只展示 全部/已通过/已拒绝；其余保持 6 项 */
  const statusMenuItems = buildStatusMenuItems({
    curMenu: props?.curMenu,
    counts: {
      all: props?.singleNum?.approvalSignalNum,
      wait: props?.singleNum?.waitApproveNum,
      pass: props?.singleNum?.passApproveNum,
      refuse: props?.singleNum?.refuseApproveNum,
      cancel: props?.singleNum?.cancelApproveNum,
      revoke: props?.singleNum?.revokeApproveNum,
      done: props?.singleNum?.doneApproveNum,
    },
  });

  return (
    <>
      {statusMenuItems ? (
        <Menu
          className="approval-content-menu"
          size="small"
          onClick={(e) => {
            searchForm.resetFields();
            setCascaderValue([]);
            setCurApprovalState(e.key);
            approvalIdsArray.current = new Map()
          }}
          selectedKeys={[curApprovalState]}
          mode="horizontal"
          items={statusMenuItems}
        />
      ) : null}
      <Form
        layout="inline"
        form={searchForm}
        autoComplete="off"
        onValuesChange={onSearchValuesChange}
      >
        <Form.Item name="approvalNo">
          <Input
            size="small"
            placeholder="搜索审批单"
            id={`approvalNo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`}
            autoComplete="off"
            onChange={() => {
              approvalIdsArray.current = new Map()
            }}
            suffix={<SearchOutlined style={{ color: "#BBBBBB" }} />}
          />
        </Form.Item>
        <Form.Item name="timeDays">
          <RangePicker
            className="time-picker"
            style={{ alignItems: "center" }}
            size="small"
            format={dateFormat}
            placeholder={["工作日期", "工作日期"]}
            onChange={() => {
              approvalIdsArray.current = new Map()
            }}
          />
        </Form.Item>
        {props?.curMenu === "self-initiated" ? null : (
          <Form.Item name="staffUserKeys">
            <UserPicker
              type="approval"
              size="small"
              mode="multiple"
              placeholder="成员"
              getUserIds={onSearchPersonChange}
            />
          </Form.Item>
        )}
        <Form.Item name="workItem">
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
        </Form.Item>
        <Form.Item>
          <Button
            size="small"
            onClick={() => {
              searchForm.resetFields();
              setSearchCondition({});
              setCascaderValue([]);
              approvalIdsArray.current = new Map()
            }}
          >
            重置
          </Button>
        </Form.Item>
      </Form>
      {isSelfApproveTodo(props?.curMenu) ? (
        <div className="approval-content-btns">
          <Space>
            <div className="des">已选中{selectedRowKeys?.length}条数据</div>
            {props?.curMenu === "all" || isSelfApproveTodo(props?.curMenu) ? (
              batchPassBtnToolShow ? (
                <Tooltip title="当前选中数据中存在无法审批的数据">
                  <Button
                    size="small"
                    type="primary"
                    disabled={batchPassBtnDisabled}
                  >
                    批量通过
                  </Button>
                </Tooltip>
              ) : (
                <Button
                  size="small"
                  type="primary"
                  disabled={batchPassBtnDisabled}
                  onClick={() => setCurOperateBtn("batchPass")}
                >
                  批量通过
                </Button>
              )
            ) : null}
            {/* {props?.curMenu === "all" || props?.curMenu === "self-initiated" ? (
              batchCancelBtnToolShow ? (
                <Tooltip title="当前选中数据中存在无法撤回的数据">
                  <Button
                    size="small"
                    type="primary"
                    disabled={batchCancelBtnDisabled}
                  >
                    批量撤回
                  </Button>
                </Tooltip>
              ) : (
                <Button
                  size="small"
                  type="primary"
                  disabled={batchCancelBtnDisabled}
                  onClick={() => setCurOperateBtn("batchCancel")}
                >
                  批量撤回
                </Button>
              )
            ) : null} */}
            {/* {props?.curMenu === "all" || props?.curMenu === "self-initiated" ? (
                        batchAgainBtnToolShow ? (
                          <Tooltip title="当前选中数据中存在无法再次发起的数据">
                            <Button
                              size="small"
                              type="primary"
                              disabled={batchAgainBtnDisabled}
                            >
                              再次发起
                            </Button>
                          </Tooltip>
                        ) : (
                          <Button
                            size="small"
                            type="primary"
                            disabled={batchAgainBtnDisabled}
                            onClick={() => setCurOperateBtn("batchAgain")}
                          >
                            再次发起
                          </Button>
                        )
                      ) : null} */}
            {props?.curMenu === "all" || isSelfApproveTodo(props?.curMenu) ? (
              batchRefuseBtnToolShow ? (
                <Tooltip title="当前选中数据中存在无法审批的数据">
                  <Button
                    size="small"
                    type="primary"
                    danger
                    disabled={batchRefuseBtnDisabled}
                  >
                    批量拒绝
                  </Button>
                </Tooltip>
              ) : (
                <Button
                  size="small"
                  type="primary"
                  danger
                  disabled={batchRefuseBtnDisabled}
                  onClick={() => setCurOperateBtn("batchRefuse")}
                >
                  批量拒绝
                </Button>
              )
            ) : null}
          </Space>
        </div>
      ) : null}
      <Table
        size="small"
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={dataSource?.data}
        rowSelection={
          isSelfApproveTodo(props?.curMenu)
            ? {
              selectedRowKeys: selectedRowKeys,
              onChange: (selectedRowKeys, selectedRows) => {
                setSelectedRowKeys(selectedRowKeys);
                setSelectedRows(selectedRows);
              },
            }
            : null
        }
        pagination={{
          current: tablePagination.pageNum, //当前页码
          pageSize: tablePagination.pageSize, // 每页数据条数
          total: dataSource.total, // 总条数
          onChange: (page) => onPageChange(page), //改变页码的函数
          showSizeChanger: dataSource.total > 10 ? true : false,
          showQuickJumper: true,
          pageSizeOptions: [10, 20, 50, 100],
          // hideOnSinglePage:
          //   dataSource.total > 10 && dataSource.total < 20 ? false : true,
        }}
        onChange={onSizeChange}
        rowClassName={(record) => {
          // 检查记录是否有 id 字段
          if (record && record.id !== undefined) {
            if (approvalIdsArray.current.has(record.id) && record?.approvalStatus === 1) {
              return 'red-row';
            }
          } else {
            console.log('记录没有 id 字段或记录为空');
          }

          return '';
        }}
        onRow={(record) => ({
          onClick: () => {
            onDrawerOpen(record);
          },
        })}
        scroll={{
          x: "100%",
          y: "calc(100vh - 270px)",
        }}
      />
      <Drawer
        destroyOnHidden
        title={
          <>
            <div className="drawer-approval-header">
              <div className="approval-title">
                {curItem?.approvalNo}
                {getApproveStatusTag(curItem?.approvalStatus)}
              </div>
              <div className="approval-title-des">
                {curItem?.staffName}&nbsp;&nbsp;于&nbsp;&nbsp;
                {dayjs(curItem?.createTime).format("YYYY-MM-DD HH:mm:ss")}
                &nbsp;&nbsp;创建
              </div>
            </div>
          </>
        }
        placement="right"
        width={750}
        className="drawer-approval"
        closeIcon={null}
        onClose={onDrawerClose}
        open={drawerOpen}
        extra={
          <ApprovalDrawerExtra
            curItem={curItem}
            curMenu={props?.curMenu}
            // 跳转只取列表行数据（approvalType / instanceCode）；sessionStorage 跨页进入无行对象时按 id 回查列表
            listRecord={drawerListRecord}
            onOperateClick={onOperateClick}
          />
        }
      >
        <div className="drawer-approval-content">
          <div className="approval-content-box">
            <div className="box-title">登记工时</div>
            <div className="box-content">
              <div className="box-content-item" style={{ width: "23%" }}>
                <div className="item-title">成员</div>
                <div className="item-content">
                  <Avatar
                    className="item-content-avatar"
                    src={curItem?.staffAvatarUrl}
                    size={20}
                    icon={<UserOutlined />}
                  />
                  <div className="item-content-txt">
                    {curItem?.staffName ? curItem?.staffName : "--"}
                  </div>
                </div>
              </div>
              <div className="box-content-item" style={{ width: "23%" }}>
                <div className="item-title">变更类型</div>
                <div className="item-content">
                  <div className="item-content-txt">
                    {handleModifyType(curItem?.modifyType)
                      ? handleModifyType(curItem?.modifyType)
                      : "--"}
                  </div>
                </div>
              </div>
              <div className="box-content-item" style={{ width: "23%" }}>
                <div className="item-title">登记工时</div>
                <div className="item-content">
                  <div className="item-content-txt">
                    {typeof curItem?.actWorkHour === "number"
                      ? `${curItem?.actWorkHour} 小时`
                      : "--"}
                  </div>
                </div>
              </div>
              <div className="box-content-item" style={{ width: "23%" }}>
                <div className="item-title">工作日期</div>
                <div className="item-content">
                  <div className="item-content-txt">
                    {curItem?.workDate
                      ? dayjs(curItem?.workDate).format("YYYY-MM-DD")
                      : "--"}
                  </div>
                </div>
              </div>
              <div className="box-content-item" style={{ width: "100%" }}>
                <div className="item-title">工作描述</div>
                <div className="item-content">
                  <div>{curItem?.workDesc ? curItem?.workDesc : "--"}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="approval-content-box">
            <div className="box-title">登记对象</div>
            <div className="box-content">
              <div className="box-content-item">
                <div className="item-title">所属空间</div>
                <div className="item-content">
                  <div className="item-content-txt">
                    {curItem?.projectName ? curItem?.projectName : "--"}
                  </div>
                </div>
              </div>
              <div className="box-content-item">
                <div className="item-title">所属工作项</div>
                <div className="item-content">
                  <div className="item-content-txt">
                    {curItem?.workItemName ? curItem?.workItemName : "--"}
                  </div>
                </div>
              </div>
              {showCustomField && (
                <div className="box-content-item">
                  <div className="item-title">{customFieldName}</div>
                  <div className="item-content">
                    <div className="item-content-txt" title={curItem?.customFieldValue}>
                      {formatCustomFieldValue(curItem?.customFieldValue)}
                    </div>
                  </div>
                </div>
              )}
              <div className="box-content-item">
                <div className="item-title">工作项实例</div>
                <div className="item-content">
                  <div className="item-content-txt">
                    {curItem?.workItemEntityName ? (
                      <span
                        className="link"
                        onClick={(e) => {
                          e.stopPropagation();
                          goWorkItemHref({
                            workItemId: curItem?.workItemId,
                            workItemEntityId: curItem?.workItemEntityId,
                          });
                        }}
                      >
                        {curItem?.workItemEntityName}
                      </span>
                    ) : (
                      "--"
                    )}
                  </div>
                </div>
              </div>
              <div className="box-content-item">
                <div className="item-title">节点</div>
                <div className="item-content">
                  <div className="item-content-txt">
                    {curItem?.nodeName ? (
                      <span
                        className="link"
                        onClick={(e) => {
                          e.stopPropagation();
                          goWorkItemHref(curItem);
                        }}
                      >
                        {curItem?.nodeName}
                      </span>
                    ) : (
                      "--"
                    )}
                  </div>
                </div>
              </div>
              <div className="box-content-item">
                <div className="item-title">任务</div>
                <div className="item-content">
                  <div className="item-content-txt">
                    {curItem?.taskName ? curItem?.taskName : "--"}
                  </div>
                </div>
              </div>
              <div className="box-content-item">
                <div className="item-title">
                  <span>已登记工时</span>
                  <Tooltip
                    placement="bottom"
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
                    <InfoCircleFilled className="icon" />
                  </Tooltip>
                </div>
                <div className="item-content">
                  <div className="item-content-txt">
                    {curItem?.registeredWorkTime
                      ? curItem?.registeredWorkTime
                      : "--/--"}
                  </div>
                </div>
              </div>
            </div>
            
          </div>
          {/* 飞书审批（列表行 approvalType=2）：审批明细整块隐藏；1 或 null 正常显示 */}
          {Number(drawerListRecord?.approvalType) === APPROVAL_TYPE_FEISHU ? null : (
          <div className="approval-content-box">
            <div className="box-title">审批明细</div>
            <div className="box-content">
              <ApprovalDetailsTable
                status={curItem?.approvalStatus}
                id={curItem?.id}
                dataSource={curItem?.approvalLogVoList}
              />
            </div>
          </div>
          )}
        </div>
      </Drawer>
      <Modal
        destroyOnHidden
        title={curItem?.id ? "编辑审批工时" : "登记工时"}
        open={isRegistrationOpen}
        onCancel={() => setIsRegistrationOpen(false)}
        width={"745px"}
        footer={null}
      >
        <RegWorkHour
          loginUser={props?.loginUser}
          type="approval"
          getRegistrationValue={onRegistrationOk}
          setRegistrationValue={curItem}
        />
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
    </>
  );
};
export default SingleApproval;

const ApprovalDetailsTable = (props) => {
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState([]);
  const columns = [
    {
      title: "序号",
      dataIndex: "index",
      key: "index",
      width: 80,
      ellipsis: true,
      render: (_, record, index) => index + 1,
    },
    {
      title: "审批阶段",
      dataIndex: "approvalStageName",
      key: "approvalStageName",
      width: 120,
      ellipsis: true,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: "处理人",
      dataIndex: "userName",
      key: "userName",
      width: 120,
      ellipsis: true,
      render: (_, record) => {
        return props.status === 1 && record?.waitApprovalList && record?.waitApprovalList?.length > 0 ? (
          <div className="table-columns-item">
            {record.waitApprovalList[0]?.userKey ? (
              <div className="user-flex">
                <Avatar
                  className="item-content-avatar"
                  src={record.waitApprovalList[0].avatarUrl}
                  size={20}
                  icon={<UserOutlined />}
                />
                {record.waitApprovalList[0].nameCn ? record.waitApprovalList[0].nameCn : "--"}
              </div>
            ) : (
              record.waitApprovalList[0]?.nameCn || "--"
            )}
            {record.waitApprovalList?.length > 1 && (
              <Tooltip
                className="custom-tooltip"
                placement="top"
                title={
                  <div>
                    {record.waitApprovalList.slice(1).map((item, index) => (
                      <div key={item.userKey || index} style={{ marginBottom: 4 }}>
                        {item.userKey ? (
                          <div className="user-flex">
                            <Avatar
                              className="item-content-avatar"
                              src={item.avatarUrl}
                              size={20}
                              icon={<UserOutlined />}
                            />
                            {item.nameCn ? item.nameCn : "--"}
                          </div>
                        ) : (
                          item.nameCn
                        )}
                      </div>
                    ))}
                  </div>
                }
              >
                <span className="wait-approval-count">+{record.waitApprovalList?.length - 1}</span>
              </Tooltip>
            )}
          </div>
        ) : (<div className="table-columns-item">
          {record?.processorUserKey ? (<div className="user-flex">
            <Avatar
              className="item-content-avatar"
              src={record.processorAvatarUrl}
              size={20}
              icon={<UserOutlined />}
            />
            {record.processorName ? record.processorName : "--"}
          </div>) : "--"}
        </div>)
      }
    },
    {
      title: "审批结果",
      dataIndex: "approvalResult",
      key: "approvalResult",
      width: 120,
      ellipsis: true,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: "审批意见",
      dataIndex: "approvalOpinion",
      key: "approvalOpinion",
      width: 180,
      ellipsis: true,
      render: (_) =>
        _ ? (
          <Tooltip placement="top" title={_}>
            {_}
          </Tooltip>
        ) : (
          "--"
        ),
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
    const res = await getApprovalLog({
      id: props.id,
    });
    if (res?.result) {
      setDataSource(res?.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (props?.id && !props?.dataSource) {
      getDataSource();
    }
  }, [props?.id]);

  useEffect(() => {
    if (props?.dataSource) {
      setDataSource(props?.dataSource);
    }
  }, [props?.dataSource]);

  return (
    <Table
      size="small"
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
