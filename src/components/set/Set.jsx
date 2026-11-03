import JSSDK from '../../jssdk-adapter'
import React, { Component, useEffect, useState, useRef } from "react";
import {
  Table,
  Button,
  Avatar,
  Modal,
  message,
  Space,
  Tooltip,
  Switch,
  Tag
} from "antd";
import {
  UserOutlined,
  EditOutlined,
  CloseOutlined,
  InfoCircleFilled,
  ExclamationCircleFilled,
  SyncOutlined,
  RightOutlined
} from "@ant-design/icons";
import {
  getStandWorkHour,
  getRegistrationSettings,
  getProjectAdminList,
  postSetProjectAdmin,
  postSetProjectMember,
  getProjectConfig,
  postProjectConfig,
  getMeasureProjectConfig,
  getApproveConfig,
  getRefreshTeam,
  getApprovalSettings,
  queryDataAuthConfigCount,
  getWorkHourReminderConfig,
  getStandardsConfig,
  getStandardsConfigDetail,
} from '../../api/api';
import SelectedUser from "../selected-user/SelectedUser";
import SyncTeamBtn from '../sync-team-btn/SyncTeamBtn';
import "./Set.less";
import MeasureSet from "./measure-set/MeasureSet";
import WorkHourSettings from "./capacity-set/WorkHourSettings";
import ApprovalSet from "./approval-set/ApprovalSet";
import NotificationSet from "./notification-set/notificationSet";
import PermissionsSet from "./permissions-set/permissionsSet";
import StandardsSet from "./standards-set/StandardsSet";
const Set = (props) => {
  const [capacityInitialValues, setCapacityInitialValues] = useState({});
  const [isCapacityFormOpen, setIsCapacityFormOpen] = useState(false);
  const [isMeasureSetOpen, setIsMeasureSetOpen] = useState(false);
  const [isApprovalSetOpen, setIsApprovalSetOpen] = useState(false);
  const [authorityLoading, setAuthorityLoading] = useState(false);
  const [config, setConfig] = useState({});
  const [configMeasure, setConfigMeasure] = useState({});
  const [configApproval, setConfigApproval] = useState({});
  const [isAdd, setIsAdd] = useState(1);
  const [standardsConfigList, setStandardsConfigList] = useState([]);
  const [standardsSetOpen, setStandardsSetOpen] = useState(false);
  const authorityColumns = [
    {
      title: "成员",
      dataIndex: "name",
      key: "name",
      width: 130,
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
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "添加人",
      dataIndex: "operateUser",
      key: "operateUser",
      width: 130,
      render: (_, record) => (
         <div className="table-columns-item">
          {record.operatorAvatarUrl ? (
            <Avatar
              src={record.operatorAvatarUrl}
              size={18}
              icon={<UserOutlined />}
            />
          ) : null}
          <div className="table-columns-item-right">
            <div className="right-name">
              {record.operatorName ? record.operatorName : "--"}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "添加时间",
      dataIndex: "operationTime",
      key: "operationTime",
      width: 130,
    },
    {
        title: "操作",
        key: "operate",
        width: 120,
        fixed: "right",
        render: (_, record) => {
          // 定义单独的处理函数
          const handleDelete = () => {
            onDelAuthorityClick(record);
          };
          
          return (
            <Space size="middle">
              {record.staffUserKey === props?.loginUser?.id ? (
                "当前账号"
              ) : (
                <Button
                  className="opt-btn"
                  type="link"
                  onClick={handleDelete} // 使用单独的处理函数
                >
                  删除
                </Button>
              )}
            </Space>
          );
        },
      },
  ];
  const [authorityList, setAuthorityList] = useState([]);
  const [authorityPagination, setAuthorityPagination] = useState({
    current: 1,
    pageSize: 10,
  });
  const [isSelectedUserOpen, setIsSelectedUserOpen] = useState(false);
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
  const [registrationSettingsConfig, setRegistrationSettingsConfig] = useState({});
  // 添加已选择的审批人状态
  const [selectedApprovalUsers, setSelectedApprovalUsers] = useState([
    {
      id: '1',
      name: '八九 八九'
    },
    {
      id: '2',
      name: '小林丹',
      isBlue: true
    },
    {
      id: '3',
      name: '小林丹',
      isBlue: true
    }
  ]);
  const [isDataPermissionsOpen, setIsDataPermissionsOpen] = useState(false);
  const [hasConfigCount, setHasConfigCount] = useState(0);
  const [registerRecordEnumList, setRegisterRecordEnumList] = useState([]);
  const [registerLevelConfigVos, setRegisterLevelConfigVos] = useState([]);
  const [workFlowObjectList, setWorkFlowObjectList] = useState([]); //过滤点飞书项目的状态流节点
  const [workItemKeyTypes, setWorkItemKeyTypes] = useState([]);
  const [isNotificationSetOpen, setIsNotificationSetOpen] = useState(false);
  const [remindCommonConfig, setRemindCommonConfig] = useState({});
  const [remindCommonConfigData, setRemindCommonConfigData] = useState({});
  const [remindAllUser, setRemindAllUser] = useState([]);
  const [standardConfigData, setStandardConfigData] = useState({});
  const hasInitializedRefSet = useRef(false);
  useEffect(() => {
    if (hasInitializedRefSet.current) {
      return
    }
    hasInitializedRefSet.current = true
    getCapacity();
    getAuthorityList();
    getConfig();
    getMeasureConfig();
    getStandardsConfigInfo()
    getRefreshTeamMember()
    getApprovalSettingsData()
    queryDataAuthConfigCountInfo()
    getWorkHourReminderConfigInfo(true)
  }, []);
  useEffect(() => {
    document.getElementById("set").style.height = "600px";
    isCapacityFormOpen
      ? (document.body.style.overflow = "hidden")
      : (document.body.style.overflow = "auto");
  }, [isCapacityFormOpen]);

  useEffect(() => {
    document.getElementById("set").style.height = "600px";
    isMeasureSetOpen
      ? (document.body.style.overflow = "hidden")
      : (document.body.style.overflow = "auto");
  }, [isMeasureSetOpen]);
  const allWorkObjectList=async()=>{
        try {
          const context = await JSSDK.Context.load();
          const space = await JSSDK.Space.load(context.mainSpace.id);
          let filterFlowMode=[]
          const getFilterFlowMode= async(workObjectId)=>{
            try {
              const data = await JSSDK.WorkObject.load({
                spaceId: context.mainSpace.id, // 请传入需查询的空间 id
                workObjectId: workObjectId, // 请传入需查询的工作项类型 id
              });
              if(data?.flowMode=='workflow'){
                  filterFlowMode.push(data.id)
              }
            } catch (error) {
              //console.error(`获取工作项类型${workObjectId}失败:`, error);
            }
          }
          // 使用Promise.all等待所有异步请求完成
          if (space.allWorkObjectList && Array.isArray(space.allWorkObjectList)) {
            //console.log('开始处理工作项类型，共', space.allWorkObjectList.length, '个');
            await Promise.all(
              space.allWorkObjectList.map(item => getFilterFlowMode(item.id))
            )
          } else {
            console.error('space.allWorkObjectList不是有效的数组:', space.allWorkObjectList);
          }
         setWorkFlowObjectList(filterFlowMode)
        } catch (error) {
          console.error('allWorkObjectList函数执行失败:', error);
        }
      }

  /** 查询登记设置 */
  const getCapacity = async () => {
    const projectKey = sessionStorage.getItem('adminCurrentProjectKey') || ''
    const res = await getRegistrationSettings({ projectKey });
    if (res?.result) {
      if(res?.data){
        const capacityInitialValuesData={
        "standWorkHour": res?.data?.standWorkHour || 0,//该空间标准工时
        "onceDown": res?.data?.onceDown || 0,//单次下线
        "dayUp": res?.data?.dayUp || 0,//单天上限
        }
        if(res?.data?.list && res?.data?.list.length==0){
          res?.data?.list?.push({
            "id": null,
            "projectKey": "68c954cd1a048327f3025e68",
            "canRegistWorkItemId": "0",
            "canRegistWorkItemName": "全部工作项",
            "entityStatus": [2],
            "nodeStatus": 0,
            "taskStatus": 0,
          })
        }else{
          res?.data?.list?.forEach((item)=>{
            if(item?.tag==0){
              item.canRegistWorkItemName=item.canRegistWorkItemName+'[已删除]'
            }
          })
        }
        res?.data?.registerRecordEnumList.forEach((item)=>{
          item.label=item.typeDescribe
          item.value=item.typeName
        })
        let registerLevelConfigVos=res?.data?.registerLevelConfigVos || []
        setRegisterLevelConfigVos(registerLevelConfigVos)
        let registerRecordEnumList=res?.data?.registerRecordEnumList || []
        setRegisterRecordEnumList(registerRecordEnumList)
        setCapacityInitialValues(capacityInitialValuesData);
        setRegistrationSettingsConfig(res.data);
        setWorkItemKeyTypes(res?.data?.workItemKeyTypes || [])
      }
    }else{
    }
  };

  const getStandardsConfigDetailInfo = async (item) => {
     const data = {
      id: item.id ? item.id : null,
      isDefault: item.isDefault,
    };
    const res = await getStandardsConfigDetail(data);
    if (res?.result) {
      setStandardConfigData(res.data);
      setStandardsSetOpen(true);
    } else {
      setStandardsSetOpen(true);
    }
  }
  /** 查询代填设置 */
  const getConfig = async () => {
    const data = {
      type: "ALLOW_ADMINISTRATORS_TO_REGISTER_OTHERS_WORKING_HOURS",
    };
    const res = await getProjectConfig(data);
    if (res?.result) {
      setConfig(res.data);
    }
  };

  /** 查询度量设置 */
  const getMeasureConfig = async () => {
    const data = {
      type: "ALLOW_MEASUREMENT",
    };
    const res = await getMeasureProjectConfig(data);
    if (res?.result) {
      setConfigMeasure(res.data);
    }
  };
   /** 获取配置 */
  const getApprovalSettingsData = async () => {
    const projectKey = sessionStorage.getItem('adminCurrentProjectKey') || ''
    const res = await getApprovalSettings({ projectKey });
    if (res?.result) {
      let approvalName="--"
      let approvalUser=[]
      if(res.data?.pattern==1){
        approvalName="指定成员"
        res.data?.userIds?.forEach(item=>{
          approvalUser.push(item.nameCn)
        })
      }
      if(res.data?.pattern==2){
        approvalName="团队审批"
        // res.data?.teamIds?.forEach(item=>{
        //   approvalUser.push(item.teamName)
        // })
        approvalUser.push('团队管理员')
      }
       if(res.data?.pattern==3){
        approvalName="角色审批"
         res.data?.roles?.forEach(item=>{
          approvalUser.push(item.roleName)
        })
      }
      const approvalInfo={
        value: res.data?.enableApproval,
        approvalName:approvalName,
        approvalUser:approvalUser.length>0?approvalUser.join(';'):'--'
      }
      setConfigApproval(approvalInfo)
    }
  }
  /** 获取权限设置列表 */
  const queryDataAuthConfigCountInfo = async () => {
    const projectKey = sessionStorage.getItem('adminCurrentProjectKey') || ''
    const res = await queryDataAuthConfigCount({ projectKey });
    if (res?.result) {
        if(res?.data && res.data){
          setHasConfigCount(res.data);
        }
    }
  };
    /** 记录规范设置 */
  const getStandardsConfigInfo = async () => {
    const projectKey = sessionStorage.getItem('adminCurrentProjectKey') || ''
    console.log("projectKey", projectKey)
    const res = await getStandardsConfig({ projectKey });
    if (res?.result) {
        if(res?.data && res.data){
          // 将isDefault为true的对象排在第一位
          const sortedData = [...res.data].sort((a, b) => {
            if (a.isDefault === true && b.isDefault !== true) {
              return -1; // a排在b前面
            } else if (a.isDefault !== true && b.isDefault === true) {
              return 1; // b排在a前面
            }
            return 0; // 保持原有顺序
          });
          setStandardsConfigList(sortedData);
        }
    }else{
    }
  };
    /** 获取消息通知配置 */
  const getWorkHourReminderConfigInfo= async (point) => {
    const data = {
     isInner:point
    };
    const res = await getWorkHourReminderConfig(data);
    if (res?.result) {
        if(res?.data){
          let time=res.data?.remindTime || ''
          if (time.includes(':')) {
              const parts = time.split(':');
              if (parts.length >= 2) {
                time = `${parts[0]}:${parts[1]}`;
              }
            }
          res.data.remindTime=time
          const selectUserListData = [].concat(
            res.data?.selectUserList || [],
            res.data?.selectTeamVos || []
          );
          if(res.data?.commonConfigVo?.value){
            setRemindAllUser(selectUserListData)
          }else{
            setRemindAllUser([])
          }
          //console.log("selectUserListData",selectUserListData)
          if(point){
            setRemindCommonConfigData(res.data)           
            setIsNotificationSetOpen(true);
          }else{
            setRemindCommonConfig(res.data)
          }
        }
    }
  };
  /** 获取管理员列表 */
  const getAuthorityList = async () => {
    const projectKey = sessionStorage.getItem('adminCurrentProjectKey') || ''
    const res = await getProjectAdminList({ projectKey });
    if (res?.result) {
      setAuthorityList(res.data);
    }
  };

  /** 刷新团队成员 */
  const getRefreshTeamMember = async () => {
    const projectKey = sessionStorage.getItem('adminCurrentProjectKey') || ''
    const res = await getRefreshTeam({ projectKey });
    if (res?.result) {
      //JSSDK.toast.success("刷新成功");
      //getApprovalConfig();
    }
  };

  /** 添加管理员 */
  const onAddAuthorityClick = async () => {
    const projectKey = sessionStorage.getItem('adminCurrentProjectKey') || ''
    const data = {
      userId: selected.selectedUserIds,
      projectKey,
    };
    const res = await postSetProjectAdmin(data);
    if (res?.result) {
      JSSDK.toast.success("添加成功");
      getAuthorityList();
      setSelected({
        selectedDeparts: [],
        selectedUsers: [],
        selectedDepartIds: [],
        selectedUserIds: [],
        checkedKeys: [],
      });
      setNewSelected({
        selectedDeparts: [],
        selectedUsers: [],
        selectedDepartIds: [],
        selectedUserIds: [],
        checkedKeys: [],
      });
    }
  };

  /** 删除管理员 */
  const onDelAuthorityClick = (item) => {
    Modal.confirm({
      title: "确定删除？",
      icon: <ExclamationCircleFilled />,
      content: "您即将删除该成员的插件管理权限，此操作不可撤销。",
      closeIcon: <CloseOutlined />,
      okText: "确定",
      cancelText: "取消",
      async onOk() {
        const projectKey = sessionStorage.getItem('adminCurrentProjectKey') || ''
        const data = {
          userId: [item.staffId],
          projectKey,
        };
        const res = await postSetProjectMember(data);
        if (res?.result) {
          getAuthorityList();
          JSSDK.toast.success("删除成功");
        }
      },
      onCancel() {
        // JSSDK.toast.success('操作成功');
      },
    });
  };

  /** 打开选择人员弹窗 */
  const onSelectedUserOpen = () => {
    setIsSelectedUserOpen(true);
    setNewSelected(selected);
  };

  /** 关闭选择人员弹窗 */
  const onSelectedUserCancel = () => {
    const person = newSelected.selectedUsers.concat(
      newSelected.selectedDeparts
    );
    setIsSelectedUserOpen(false);
    setSelected({
      selectedDeparts: [],
      selectedUsers: [],
      selectedDepartIds: [],
      selectedUserIds: [],
      checkedKeys: [],
    });
    setNewSelected({
      selectedDeparts: [],
      selectedUsers: [],
      selectedDepartIds: [],
      selectedUserIds: [],
      checkedKeys: [],
    });
  };

  /** 确定选择人员 */
  const onSelectedUserOk = () => {
    setIsSelectedUserOpen(false);
    setNewSelected(selected);
    onAddAuthorityClick();
  };

  /** 获取选择的人员 */
  const getSelectedUser = (e) => {
    setSelected(e);
  };

  /** 校验容量填报规则 */
  const validateTwoDecimalPlaces = (_, value) => {
    const reg = /^\d+(\.\d{1,2})?$/;
    if (value && !reg.test(value)) {
      return Promise.reject(new Error("请输入保留两位小数的数字"));
    }
    return Promise.resolve();
  };

  /** 管理员代填工时设置 */
  const onProjectConfigChange = async (val) => {
    const data = {
      type: "ALLOW_ADMINISTRATORS_TO_REGISTER_OTHERS_WORKING_HOURS",
      id: config?.id,
      value: val ? 1 : 0,
    };
    const res = await postProjectConfig(data);
    if (res?.result) {
      getConfig();
      JSSDK.toast.success("设置成功");
    }
  };
  // 添加审批人相关处理函数
  const handleAddApprovalUser = () => {
    // 最多只能添加10个审批人
    if (selectedApprovalUsers.length >= 10) {
      return;
    }
    // 这里应该弹出选择人员的对话框
    // 为了示例，这里直接添加一个模拟用户
    const newUser = {
      id: Date.now().toString(),
      name: '新用户',
      isBlue: true
    };
    setSelectedApprovalUsers([...selectedApprovalUsers, newUser]);
  };
  
  const handleRemoveApprovalUser = (userId) => {
    const newUsers = selectedApprovalUsers.filter(user => user.id !== userId);
    setSelectedApprovalUsers(newUsers);
  };
  return (
    <div id="set" className="set-warp">
      <div className="set-box">
        <div className="set-title">应用配置</div>
        <div className="set-content content-style">
          <div className="content-top">
            <div>
              <div className="title">登记设置</div>
              <div className="desc">设置后，基于此标准约束工时填报</div>
            </div>
            <div>
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => {
                  allWorkObjectList()
                  setIsCapacityFormOpen(true)
                }}
              />
            </div>
          </div>
          {/* <div className="content-bottom">
            <div className="content-bottom-box">
              <div className="box-title">
                <span>单位人天标准工时</span>
                <Tooltip title="设置后，成员登记的工时将按标准工作时长换算人天">
                  <InfoCircleFilled />
                </Tooltip>
              </div>
              <div className="box-value">
                {typeof capacityInitialValues?.standWorkHour === "number"
                  ? capacityInitialValues?.standWorkHour
                  : "--"}
                小时
              </div>
            </div>
            <div className="content-bottom-box">
              <div className="box-title">
                <span>单天填报工时上限</span>
                <Tooltip title="设置后，单个成员每自然天填报的工时数不可超过此数">
                  <InfoCircleFilled />
                </Tooltip>
              </div>
              <div className="box-value">
                {typeof capacityInitialValues?.dayUp === "number"
                  ? capacityInitialValues?.dayUp
                  : "--"}
                小时
              </div>
            </div>
            <div className="content-bottom-box">
              <div className="box-title">
                <span>单次填报工时下限</span>
                <Tooltip title="设置后，成员单次登记工时不得小于当前数量">
                  <InfoCircleFilled />
                </Tooltip>
              </div>
              <div className="box-value">
                {typeof capacityInitialValues?.onceDown === "number"
                  ? capacityInitialValues?.onceDown
                  : "--"}
                小时
              </div>
            </div>
          </div> */}
          <div className="content-bottom">
            <div className="content-bottom-box">
              <div className="box-title">
                <span>登记规则</span>
              </div>
              <div className="box-value box-h84">
                <div className="setting-item">
                  <span className="item-left">提前天数限制</span>
                  {registrationSettingsConfig?.enableAdvanceDay==1 && <span style={{color: '#4247f6'}}>{registrationSettingsConfig.inAdvanceDay !=null ?registrationSettingsConfig.inAdvanceDay:'--'}天</span>}
                  {!registrationSettingsConfig?.enableAdvanceDay && <span>未启用</span>}
                </div>
                 <div className="setting-item">
                  <span className="item-left">工作描述是否必填</span>
                  {registrationSettingsConfig?.enableFutureDay==1 && <span style={{color: '#4247f6'}}>{registrationSettingsConfig.futureDay !=null ?registrationSettingsConfig.futureDay:'--'}天</span>}
                  {!registrationSettingsConfig?.enableFutureDay && <span>未启用</span>}
                </div>
                <div className="setting-item">
                  <span className="item-left">未来日期限制</span>
                  <span
                  style={registrationSettingsConfig?.workDescReq
                    ? { color: '#1FC168', background: '#E9F9F0' }
                    : { color: '#646A73', background: '#EFF0F1' }}
                  className="reg-tag"
                >
                  {registrationSettingsConfig?.workDescReq ? '必填' : '非必填'}
                </span>
                </div>
                <div className="setting-item">
                  <span className="item-left">管理员填报设置</span>
                  <span style={{ color: registrationSettingsConfig?.adminImpact ? '#4247f6' : '' }}>{registrationSettingsConfig?.adminImpact ? '开启' : '关闭'}</span>
                </div>
              </div>
            </div>
            <div className="content-bottom-box">
              <div className="box-title">
                <span>禁填设置</span>
              </div>
              <div className="box-value box-h84">
                <div className="setting-item item-flex-end">
                  <span className="item-left">工作项实例</span>
                 {registrationSettingsConfig?.list && registrationSettingsConfig?.list[0]?.entityStatus?.length > 0 && (
                    <div>
                      {registrationSettingsConfig?.list[0]?.entityStatus?.map((status, index) => (
                        <span key={index} className="dj-status">
                          {status === 1 ? "已冻结" : 
                          status === 2 ? "已终止" : 
                          status === 3 ? "已完成" : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="setting-item item-flex-end">
                  <span className="item-left">节点</span>
                  {registrationSettingsConfig?.list && registrationSettingsConfig?.list[0]?.nodeStatus === 1 && (
                    <div><span className="dj-status">
                      已完成
                    </span></div>
                  )}
                </div>
                <div className="setting-item item-flex-end">
                  <span className="item-left">任务</span>
                  {registrationSettingsConfig?.list && registrationSettingsConfig?.list[0]?.taskStatus === 1 && (
                    <div><span className="dj-status">
                      已完成
                    </span></div>
                  )}
                </div>
              </div>
            </div>
            <div className="content-bottom-box">
              <div className="box-title">
                <span>可登记工作项</span>
              </div>
              {registrationSettingsConfig?.list?.length > 0 && (
                <div className="box-h84 ellipsis-3-lines" style={{ cursor: 'pointer' }}>
                  {registrationSettingsConfig?.list?.map((item, index) => {
                    // 当超过3个工作项时，显示前3个和省略号
                    if (registrationSettingsConfig.list.length > 10) {
                      if (index < 10) {
                        return (
                          <Tooltip key={index} title={item.canRegistWorkItemName} placement="top">
                            <span className="dj-status ellipsis-single-line" style={{ cursor: 'pointer' }}>
                              {item.canRegistWorkItemName}
                            </span>
                          </Tooltip>
                        );
                      } else if (index === 10) {
                        // 第4个位置显示省略号，并为省略号添加Tooltip显示全部工作项
                        return (
                          <Tooltip key="ellipsis" title={
                            <div style={{ maxWidth: '500px' }}>
                              {registrationSettingsConfig?.list?.map((item, idx) => (
                                <span key={idx} className="dj-status" style={{ marginBottom: '2px', display: 'inline-block' }}>
                                    {item.canRegistWorkItemName}{idx < registrationSettingsConfig.list.length - 1 ?';':''}
                                </span>
                              ))}
                            </div>
                          }>
                            <span className="dj-status" style={{ cursor: 'pointer' }}>
                              ...
                            </span>
                          </Tooltip>
                        );
                      } else {
                        return null;
                      }
                    } else {
                      // 不足3个时全部显示
                      return (
                        <Tooltip key={index} title={item.canRegistWorkItemName} placement="top">
                          <span className="dj-status ellipsis-single-line" style={{ cursor: 'pointer' }}>
                            {item.canRegistWorkItemName}
                          </span>
                        </Tooltip>
                      );
                    }
                  })}
                </div>
              )}
              {registrationSettingsConfig?.list?.length==0 && 
                <div className="box-h84 ellipsis-3-lines">
                </div>
              }
            </div>
          </div>
        </div>
        <div className="set-content content-style measure-card-style">
          <div className="content-top measure-content-top">
            <div>
              <div className="title measure-title-row">
                <span>统计设置</span>
                <InfoCircleFilled className="measure-title-icon" />
                {!configMeasure?.value && <span className="measure-status-tag">未启用</span>}
              </div>
            </div>
            <Button
              className="measure-setting-btn"
              onClick={() => setIsMeasureSetOpen(true)}
            >
              设置
            </Button>
          </div>
        </div>
         <div className="set-content content-style">
          <div className="content-top">
            <div>
              <div className="title">记录规范设置</div>
              <div className="desc">
                设置不同记录组，规范不同人员的记录规则
              </div>
            </div>
            <div>
              <span className="add-standards-btn" onClick={() => {
                setIsAdd(1)
                setStandardConfigData({
                  "id": null,
                  "dayUp": 24,
                  "onceDown": 1,
                  "standWorkHour": 8,
                  "standardsName": "",
                  "defaultUsers": []
                })
                setStandardsSetOpen(true)
              }}>添加记录规范</span>
            </div>
          </div>
          <div className="content-bottom">
            <div className="content-bottom-grid">
              {standardsConfigList.map((item, index) => (
                <div className="content-bottom-box" key={index}>
                  <div className="box-title standard-column">
                     <Tooltip title={item.standardsName}>
                       <span className="standards-record-item ellipsis-single-line" onClick={() => {
                        setIsAdd(0)
                        getStandardsConfigDetailInfo(item)
                      }}>{item.standardsName}</span>
                     </Tooltip>
                      {item.isDefault && <span className="defalut-standards-tag">默认</span>}
                      <RightOutlined  onClick={() => {
                        setIsAdd(0)
                        getStandardsConfigDetailInfo(item)
                      }} className="standards-record-detail"/>
                  </div>
                  <div className="box-value">
                    <span className="standards-people-num">{item?.count ? `${item.count}人` : '0人'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="set-content content-style">
          <div className="content-top">
            <div>
              <div className="title">工时审批设置</div>
              <div className="desc">
                工时审批的规则配置，若开启工时审批，登记工时需通过审批后才算有效工时
              </div>
            </div>
            <div>
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => setIsApprovalSetOpen(true)}
              />
            </div>
          </div>
          <div className="content-bottom">
            <div className="content-bottom-box">
              <div className="box-title">
                <span>工时审批</span>
                <Tooltip title="开启后，所有 [登记工时] 的变更将按照以下配置自动生成工时审批，且需通过审批后方能生效，即同步至工时日志">
                  <InfoCircleFilled />
                </Tooltip>
              </div>
              <div className="box-value">
                {configApproval?.value ? "开启" : "关闭"}
              </div>
            </div>
            <div className="content-bottom-box">
              <div className="box-title">
                <span>审批模式</span>
                <Tooltip title="提供指定成员、团队审批、角色审批三种模式，适配不同审批场景">
                  <InfoCircleFilled />
                </Tooltip>
              </div>
              <div className="box-value">
                {configApproval?.value && configApproval?.approvalName ? (
                  <Tooltip
                    placement="bottom"
                    title={configApproval?.approvalName}
                  >
                    {configApproval?.approvalName}
                  </Tooltip>
                ) : (
                  "--"
                )}
              </div>
            </div>
            <div className="content-bottom-box">
              <div className="box-title">
                <span>审批人</span>
                <Tooltip title="负责审批工时的人员">
                  <InfoCircleFilled />
                </Tooltip>
              </div>
              <div className="box-value">
                {configApproval?.value && configApproval?.approvalUser ? (
                  <Tooltip
                    placement="bottom"
                    title={configApproval?.approvalUser}
                  >
                    {configApproval?.approvalUser}
                  </Tooltip>
                ) : (
                  "--"
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="set-content content-style">
          <div className="content-top">
            <div>
              <div className="title">权限设置</div>
              <div className="desc">管理用户权限，控制成员操作范围及能力</div>
            </div>
            <div>
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => {
                  setIsDataPermissionsOpen(true);
                }}
              />
            </div>
          </div>
          <div className="content-bottom" style={{marginTop:'8px'}}>
            <div style={{fontWeight:'bold'}}>数据权限</div>
          </div>
           <div className="content-bottom" style={{marginTop:'0px'}}>
            <div className="content-auth-box box-switch" style={{color:'#646A73',fontSize:'12px'}}>
                配置成员在资源管理、工时日志、工时管理页面的数据可见权限。已配置 <span style={{color:'#4247F6'}}>{hasConfigCount}</span> 个权限规则
            </div>
          </div>
          <div className="content-bottom">
            <div className="content-bottom-box box-switch">
              <div className="box-title">
                <span>允许管理员代填工时</span>
                <Tooltip title="开启后，应用管理员和插件管理员可在该空间为成员进行「登记工时」的填报、编辑、删除">
                  <InfoCircleFilled />
                </Tooltip>
              </div>
              <div className="box-value">
                 <Switch
                    size="small"
                    checked={config?.value ? true : false}
                    onChange={onProjectConfigChange}
                  />
              </div>
            </div>
          </div>
        </div>
         <div className="set-content content-style">
          <div className="content-top">
            <div>
              <div className="title">消息通知</div>
              <div className="desc">支持配置各类消息的通知规则，触发飞书项目的消息提醒</div>
            </div>
            <div>
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => {
                  getWorkHourReminderConfigInfo(true)

                }}
              />
            </div>
          </div>
          <div className="content-bottom">
            <div className="content-bottom-box box-switch">
              <div className="box-title">
                工时登记提醒
              <Tooltip
                className="user-tooltip"
                placement="bottom"
                title={
                  <>
                    <div>
                       <span style={{ fontWeight: 'bold' }}>对应提醒频率周期内</span>未登记工时的用户，将按配置自动发送提醒
                      <div>工时登记提醒需同时配置：①本插件设置页的提醒时间、提醒成员；②飞书项目的触发器（触发器配置可参考帮助手册）</div>
                    </div>
                  </>
                }
              >
                <InfoCircleFilled className="icon" />
              </Tooltip>
              </div>
            </div>
          </div>
          <div className="content-bottom">
            <div className="content-bottom-box">
              <div className="box-title">
                <span className="info-remind-item">提醒状态</span>
                <span className="info-remind-ml-10 info-remind-open">{remindCommonConfig?.commonConfigVo?.value ? "开启" : "关闭"}</span> 
              </div>
            </div>
            <div className="content-bottom-box">
              <div className="box-title">
                <span className="info-remind-item">提醒频率</span>
                {remindCommonConfig?.commonConfigVo?.value && remindCommonConfig?.remindFrequencyDescribe ? (
                    <span className="info-remind-ml-10">{remindCommonConfig?.remindFrequencyDescribe}</span>
                ) : (
                   <span className="info-remind-ml-10">--</span>
                )}
              </div>
            </div>
            <div className="content-bottom-box">
              <div className="box-title">
                <span className="info-remind-item">提醒时间</span>
                {remindCommonConfig?.commonConfigVo?.value && remindCommonConfig?.remindDateDescribe && remindCommonConfig?.remindTime? (
                  <span className="info-remind-ml-10">{remindCommonConfig?.remindDateDescribe}{remindCommonConfig?.remindTime}</span>
                ) : (
                  <span className="info-remind-ml-10">--</span>
                )}
              </div>
            </div>
          </div>
          <div className="content-bottom" style={{marginTop:'8px'}}>
            <div className="content-bottom-box">
              <div className="box-title" style={{display:'flex'}}>
                <div className="info-remind-item" style={{width:'70px'}}>提醒成员</div>
                <div className="info-remind-ml-10" style={{width:'calc(100% - 70px)',marginLeft:'8px'}}>
                  {remindCommonConfig?.commonConfigVo?.value===1 && (
                  <div className="remind-ellipsis-3-lines" style={{ cursor: 'pointer', width: '100%', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    {remindAllUser.length >0 ? (
                        remindAllUser.map((item, index) => {
                          // 当超过30个对象时，显示前30个和省略号
                          if (remindAllUser.length > 30) {
                            if (index < 30) {
                              return (
                              <Tooltip key={index} title={item.teamId ? item.teamName : item.userName} placement="top">
                                  <span className="info-remind-obj ellipsis-single-line w60">
                                    {item.teamId ? (
                                      // item.teamId存在时显示teamName
                                      item.teamName
                                    ) : (
                                      // item.teamId为null时显示avatarUrl和userName
                                      <>
                                        {item.avatarUrl && (
                                        <Avatar size={20} src={item.avatarUrl}
                                        />
                                        )}
                                        {item.userName}
                                      </>
                                    )}
                                  </span>
                                </Tooltip>
                              );
                            } else if (index === 30) {
                              // 第31个位置显示省略号，并为省略号添加Tooltip显示全部对象
                              return (
                                   <span className="info-remind-obj" style={{ width:'20px', textAlign:'center'}}>
                                    ...
                                  </span>
                              );
                            } else {
                              return null;
                            }
                          } else {
                            // 不足30个时全部显示
                            return (
                              <Tooltip key={index} title={item.teamId ? item.teamName : item.userName} placement="top">
                                  <span className="info-remind-obj remind-ellipsis-single-line w60">
                                    {item.teamId ? (
                                      // item.teamId存在时显示teamName
                                      item.teamName
                                    ) : (
                                      // item.teamId为null时显示avatarUrl和userName
                                      <>
                                        {item.avatarUrl && (
                                        <Avatar size={20} src={item.avatarUrl}
                                        />
                                        )}
                                        {item.userName}
                                      </>
                                    )}
                                  </span>
                                </Tooltip>
                            );
                          }
                        })
                      ) : null}
                  </div>
                  )}
                  {remindCommonConfig?.commonConfigVo?.value==0 && 
                    <div className="remind-ellipsis-3-lines">
                      --
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="set-box">
        <div className="set-title">插件管理员</div>
        <div className="set-content between">
          <div>
            即拥有【工时资源管理】插件的管理权限（即编辑当前页）与全局数据查询权限的成员。无插件管理员时，空间管理员可在插件设置-配置页中管理插件
          </div>
          <Button size="small" type="primary" onClick={onSelectedUserOpen}>
            添加
          </Button>
        </div>
        <Table
          className="set-table"
          size="small"
          rowKey="staffId"
          loading={authorityLoading}
          columns={authorityColumns}
          dataSource={authorityList}
          pagination={false}
          scroll={{
            y: "100%",
          }}
        />
      </div>
      <Modal
        className="set-modal"
        width={600}
        destroyOnHidden={true}
        title="登记设置"
        open={isCapacityFormOpen}
        onCancel={() => setIsCapacityFormOpen(false)}
        footer={null}
        centered
        maskClosable={false}
      >
        <WorkHourSettings
          workItemKeyTypes={workItemKeyTypes}
          workFlowObjectList={workFlowObjectList}
          registerLevelConfigVos={registerLevelConfigVos}
          registerRecordEnumList={registerRecordEnumList}
          capacityInitialValues={capacityInitialValues}
          registrationSettingsConfig={registrationSettingsConfig}
          setIsCapacityFormOpen={(val) => {
            setIsCapacityFormOpen(false);
            if (val) getCapacity();
          }}
        />
      </Modal>
      <Modal
        destroyOnHidden={true}
        title="统计设置"
        open={isMeasureSetOpen}
        onCancel={() => setIsMeasureSetOpen(false)}
        footer={null}
        centered
        maskClosable={false}
      >
        <MeasureSet
          configMeasure={configMeasure}
          setIsMeasureSetOpen={(val) => {
            setIsMeasureSetOpen(false);
            if (val) getMeasureConfig();
          }}
        />
      </Modal>
       <Modal
       width={600}
        destroyOnHidden={true}
        title={isAdd ? "添加记录规范" : "编辑记录规范"}
        open={standardsSetOpen}
        onCancel={() => setStandardsSetOpen(false)}
        footer={null}
        centered
        maskClosable={false}
      >
        <StandardsSet
          isAdd={isAdd}
          standardConfigData={standardConfigData}
          setStandardsSetOpen={(val) => {
            setStandardsSetOpen(false)
            if (val)  getStandardsConfigInfo();
          }}
        />
      </Modal>
      <Modal
        width={700}
        destroyOnHidden={true}
        title="工时审批设置"
        open={isApprovalSetOpen}
        // width={650}
        onCancel={() => setIsApprovalSetOpen(false)}
        footer={null}
        centered
        maskClosable={false}
      >
        <ApprovalSet
          setIsApprovalSetOpen={(val) => {
            setIsApprovalSetOpen(false);
            if (val) {
              getConfig()
              getApprovalSettingsData()
            }
          }}
        />
      </Modal>
      <Modal
        width={800}
        destroyOnHidden={true}
        title="数据权限设置"
        open={isDataPermissionsOpen}
        // width={650}
        onCancel={() => setIsDataPermissionsOpen(false)}
        footer={null}
        centered
        maskClosable={false}
      >
        <PermissionsSet
          setIsApprovalSetOpen={(val) => {
            setIsDataPermissionsOpen(false);
            queryDataAuthConfigCountInfo()
            // if (val) {
            //   getConfig()
            //   getApprovalSettingsData()
            // }
          }}
        />
      </Modal>
      <Modal
        width={700}
        destroyOnHidden={true}
        title="消息通知"
        open={isNotificationSetOpen}
        // width={650}
        onCancel={() => setIsNotificationSetOpen(false)}
        footer={null}
        centered
        maskClosable={false}
      >
        <NotificationSet
          remindCommonConfigData={remindCommonConfigData}
          setIsNotificationSetOpen={(val) => {
            setIsNotificationSetOpen(false);
            if (val) {
             getWorkHourReminderConfigInfo(false)
            }
          }}
        />
      </Modal>
      <Modal
        destroyOnHidden
        title="选择成员"
        open={isSelectedUserOpen}
        onCancel={onSelectedUserCancel}
        width={"745px"}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SyncTeamBtn />
            <div>
              <Button className="cancel-btn" onClick={onSelectedUserCancel}>
                取消
              </Button>
              <Button
                style={{ marginLeft: 8 }}
                disabled={!selected.selectedUserIds.length}
                type="primary"
                onClick={onSelectedUserOk}
              >
                确定
              </Button>
            </div>
          </div>
        }
        centered
        maskClosable={false}
      >
        <SelectedUser
          type="authority"
          getSelectedUser={getSelectedUser}
          selectedUser={selected}
        />
      </Modal>
    </div>
  );
};
export default Set;
