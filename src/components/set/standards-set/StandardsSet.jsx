import JSSDK from '../../../jssdk-adapter'
import React, { useEffect, useState } from "react";
import { Form, Button, InputNumber, message, Space, Typography, Input, Tooltip, Modal,Spin, Radio} from "antd";
import {
  getStandWorkHour,
  postUpdateStandWorkHour,
  saveStandardsConfig,
  getStandardsConfigHoliday,
  queryCountryHoliday,
  deleteStandardsConfig,
  standardsClearByUuid,
  saveStandardsConfigIsv,
  getStandardsConfigHolidayIsv,
  queryCountryHolidayIsv,
  deleteStandardsConfigIsv,
  standardsClearByUuidIsv
} from '../../../api/api';
import { ExclamationCircleFilled,CloseOutlined } from '@ant-design/icons';
import { isISV } from '../../../config/auth';
import authLeftIcon from "../../../assets/images/auth_left.png";
import RestDayConfigModal from './RestDayConfigModal';
import MemberModal from './MemberModal';
import UserSettings from '../standards-user/user_isv';
import SyncTeamBtn from '../../sync-team-btn/SyncTeamBtn';
import AttendanceToggle from '../capacity-set/attendance-config/AttendanceToggle';
import {
  normalizeAttendanceConfig,
  buildAttendanceConfigPayload,
  ATTENDANCE_DATA_SOURCE,
  MISSING_CARD_POLICY,
} from '../capacity-set/attendance-config/attendanceConfig';
import "./StandardsSet.less";
const { Text } = Typography;
import { generateUuid} from '../../../util/util';
const StandardsSet = (props) => {
  // ISV 模式走 isv/ 前缀接口，老模式走原接口，与老接口独立并存
  const isv = isISV();
  const saveStandardsConfigFn = isv ? saveStandardsConfigIsv : saveStandardsConfig;
  const getStandardsConfigHolidayFn = isv ? getStandardsConfigHolidayIsv : getStandardsConfigHoliday;
  const queryCountryHolidayFn = isv ? queryCountryHolidayIsv : queryCountryHoliday;
  const deleteStandardsConfigFn = isv ? deleteStandardsConfigIsv : deleteStandardsConfig;
  const standardsClearByUuidFn = isv ? standardsClearByUuidIsv : standardsClearByUuid;
  // ISV（租户模式）下新接口不需要 projectKey，老接口需要保留
  const adaptParams = (data = {}) => {
    if (!isv) return data;
    if (!data || typeof data !== 'object') return data;
    const { projectKey, ...rest } = data;
    return rest;
  };
  const [capacityInitialValues, setCapacityInitialValues] = useState(
      props?.standardConfigData
  );
  const [uuid, setUuid] = useState(generateUuid());
  const [countryCode, setCountryCode] = useState(props?.standardConfigData?.countryCode || null);
  const [isDefault, setIsDefault] = useState(props?.standardConfigData?.isDefault || false);
  const [capacityForm] = Form.useForm();
  const [capacityFormVS, setCapacityFormVS] = useState({
    standardsName: false,
    standWorkHour: false,
    standWorkHourMsg: "",
    dayUp: false,
    dayUpMsg: "",
    onceDown: false,
    onceDownMsg: "",
  });
  const [missingCardLimitError, setMissingCardLimitError] = useState("");
  const [isAdd, setIsAdd] = useState(props?.isAdd?1:0);
  // 控制弹窗显隐
  const [updateMemberData, setUpdateMemberData] = useState(false);
  const [saveMemberData, setSaveMemberData] = useState({});
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [memberModalVisible, setMemberModalVisible] = useState(false);
  const [isSelectedUserOpen, setIsSelectedUserOpen] = useState(false);
  const [selected, setSelected] = useState({
      selectedDeparts: [],
      selectedUsers: [],
      selectedDepartIds: [],
      selectedUserIds: [],
      checkedKeys: []
    });
  const [newSelected, setNewSelected] = useState({
    selectedDeparts: [],
    selectedUsers: [],
    selectedDepartIds: [],
    selectedUserIds: [],
    checkedKeys: []
  });
  const [selectedSeatCount, setSelectedSeatCount] = useState({
      uniqueSelectedCount: 0,
      seatTotal: 0,
  });
  const [holidayConfigData, setHolidayConfigData] = useState({});
  const showModal = () => setVisible(true);
  const [standardUser, setStandardUser] = useState(props?.standardConfigData?.defaultUsers || []);
  const [stashRest, setStashRest] = useState(null);
  const [restTime, setRestTime] = useState(null);
  const [isDirty, setIsDirty] = useState(!!props?.isAdd);
  const [attendanceConfig, setAttendanceConfig] = useState(() => (
    normalizeAttendanceConfig(props?.standardConfigData)
  ));
  useEffect(() => {
    if (props?.isAdd === 0 && props?.standardConfigData) {
      // 编辑模式：用接口返回的数据回填表单
      const editData = props.standardConfigData;
      const restoredAttendanceConfig = normalizeAttendanceConfig(editData);
      capacityForm.setFieldsValue({
        standardsName: editData.standardsName || '',
        standWorkHour: editData.standWorkHour,
        dayUp: editData.dayUp,
        onceDown: editData.onceDown,
      });
      setAttendanceConfig(restoredAttendanceConfig);
      validatorCapacityForm({
        standWorkHour: editData.standWorkHour,
        dayUp: editData.dayUp,
        onceDown: editData.onceDown,
      }, restoredAttendanceConfig.attendanceEnabled);
      getStandardsConfigHolidayInfo(true);
    } else {
      // 新增模式：清空表单，设置默认值
      capacityForm.setFieldsValue({ onceDown: 1 });
      validatorCapacityForm({ onceDown: 1 });
    }
  }, []);

  /** 校验容量填报规则 */
  const validateTwoDecimalPlaces = (_, value) => {
    const reg = /^\d+(\.\d{1,2})?$/;
    // 检查值是否存在且不为空字符串，然后进行正则验证
    if (value !== undefined && value !== null && value !== '') {
      // 如果值为0，拒绝输入
      if (parseFloat(value) === 0) {
        return Promise.reject(new Error("请输入大于0的数字"));
      }
      // 进行正则验证
      if (!reg.test(value)) {
        return Promise.reject(new Error("请输入保留两位小数的数字"));
      }
    }
    return Promise.resolve();
  };

  /** 登记设置字段值变化 */
  const onCapacityValuesChange = (changedValues, allValues) => {
    setIsDirty(true);
    validatorCapacityForm(allValues);
  };

  /** 校验容量规则 */
  const validatorCapacityForm = (allValues, attendanceEnabled = attendanceConfig.attendanceEnabled) => {
    if (!attendanceEnabled && allValues.standWorkHour && allValues.dayUp) {
      if (allValues.standWorkHour > allValues.dayUp) {
        capacityFormVS.standWorkHour = true;
        capacityFormVS.standWorkHourMsg =
          "请注意，当前单位人天标准工时大于[单天填报工时上限]";
        capacityFormVS.dayUp = true;
        capacityFormVS.dayUpMsg =
          "请注意，当前单天填报工时上限小于[单位人天标准工时]";
      } else {
        capacityFormVS.standWorkHour = false;
        capacityFormVS.standWorkHourMsg = "";
        capacityFormVS.dayUp = false;
        capacityFormVS.dayUpMsg = "";
      }
      if (allValues.onceDown) {
        if (
          allValues.onceDown > allValues.standWorkHour &&
          allValues.onceDown > allValues.dayUp
        ) {
          capacityFormVS.onceDown = true;
          capacityFormVS.onceDownMsg =
            "请注意，当前填报大于[单位人天标准工时]且大于[单天填报工时上限]";
        } else if (allValues.onceDown > allValues.dayUp) {
          capacityFormVS.onceDown = true;
          capacityFormVS.onceDownMsg = "请注意，当前填报大于[单天填报工时上限]";
        } else if (allValues.onceDown > allValues.standWorkHour) {
          capacityFormVS.onceDown = true;
          capacityFormVS.onceDownMsg = "请注意，当前填报大于[单位人天标准工时]";
        } else {
          capacityFormVS.onceDown = false;
          capacityFormVS.onceDownMsg = "";
        }
      }
    } else {
      capacityFormVS.standWorkHour = false;
      capacityFormVS.standWorkHourMsg = "";
      capacityFormVS.dayUp = false;
      capacityFormVS.dayUpMsg = "";
      capacityFormVS.dayDown = false;
      capacityFormVS.dayDownMsg = "";
    }
    setCapacityFormVS({ ...capacityFormVS });
  };

  /** 设置容量 */
  const onFinish = async (values) => {
    let { standardsName, standWorkHour, dayUp, onceDown } = values;
    if (attendanceConfig.attendanceEnabled && (dayUp === undefined || dayUp === null || dayUp === '')) {
      dayUp = capacityInitialValues?.dayUp || attendanceConfig.dayUp || 8;
    }
    if (
      attendanceConfig.attendanceEnabled &&
      attendanceConfig.missingCardPolicy === MISSING_CARD_POLICY.CUSTOM_LIMIT &&
      !(typeof attendanceConfig.missingCardLimit === 'number' && attendanceConfig.missingCardLimit > 0)
    ) {
      setMissingCardLimitError('缺卡自定义提交上限不能为空');
      return;
    }
    //const userKeys = standardUser.map((user) => user.unionId);
    let holidayData=[]
    let operationDate = [];
    let sumbitCountryCode=null
    if(stashRest && stashRest.holidayDefaultConfigArr){
      // 将日期数组转换为对象数组
      holidayData=Array.from(stashRest.holidayDefaultConfigArr).map(date => ({"holiday": date }))
      sumbitCountryCode=stashRest.countryCode
    }
    if((stashRest && stashRest.holidayDefaultConfigArr)&& (stashRest &&  stashRest.operationDate)){
      stashRest.operationDate.forEach((val,key) => {
         operationDate.push(key)
      });
      operationDate= operationDate.map(date => ({ holiday: date }))
    }
    if(!stashRest && holidayConfigData && holidayConfigData.holidayDefaultConfigArr){
      sumbitCountryCode=holidayConfigData.countryCode
      // 将日期数组转换为对象数组
      holidayData=Array.from(holidayConfigData.holidayDefaultConfigArr).map(date => ({"holiday": date }))
      operationDate=[]
    }
    //console.log('operationDate',holidayData,operationDate);
    const data={
      id: props?.standardConfigData?.id || null,
      projectKey: props?.projectKey || sessionStorage.getItem('jwtMeegoTeamworkProjectKey') || '',
      standardsName,
      standWorkHour, 
      dayUp, 
      onceDown,
      isDefault: props?.standardConfigData?.isDefault || false,
      countryCode: sumbitCountryCode,
      holiday: holidayData,
      operationDate:operationDate,
      ...buildAttendanceConfigPayload(attendanceConfig),
    }
    if (isISV()){
      data.outIds = standardUser.map((user) => user.unionId || user.outId);
    }else{
      data.userKeys=standardUser.map((user) => user.userKey);
    }
     if (!data.id && (stashRest && stashRest.syncTime || stashRest && stashRest.restTime)) {
      data.uuid =  uuid
    }
    // if (!data.id && restTime) {
    //   data.restTime = restTime;
    // }
    // if (!data.id && stashRest.syncTime) {
    //   data.syncTime = stashRest.syncTime;
    // }
    setLoading(true);
    const res = await saveStandardsConfigFn(adaptParams(data));
    if (res?.result) {
      JSSDK.toast.success("保存成功");
      setLoading(false)
      props.setStandardsSetOpen(true)
    }else{
      setLoading(false)
    }

  };
  const getStandardsConfigHolidayInfo = async (flag) => {
     const data={
      isDefault: isDefault || false,
    }
    if (props?.standardConfigData?.id) {
      data.id = props?.standardConfigData?.id
    }
    if (props?.standardConfigData?.countryCode) {
      data.countryCode = props?.standardConfigData?.countryCode
    }
    setLoading(true);
    const res = await getStandardsConfigHolidayFn(adaptParams(data));
    if (res?.result) {
      if (res?.data?.holidayDefaultConfigVos) {
        const holidayDefaultConfigArr = new Set();
        res?.data?.holidayDefaultConfigVos.forEach((config) => {
          holidayDefaultConfigArr.add(config.holiday);
        });
        res.data.holidayDefaultConfigArr = holidayDefaultConfigArr;
      }
      setHolidayConfigData(res.data);
      //setVisible(true);
    } else {
    }
    if (!flag) {
      setVisible(true);
    }
    setLoading(false);
  };
  // 自定义初始休息日（可从接口获取）
  const customRestDays = [
    '2025-07-04', '2025-07-05', '2025-07-11'
  ];

  // 同步未来日历回调
  const deleteStandardsConfigData = async() => {
    const data = { id: props?.standardConfigData?.id };
    const res = await deleteStandardsConfigFn(adaptParams(data))
    if (res?.result) {
      JSSDK.toast.success("删除成功");
      props.setStandardsSetOpen(true)
    }
  };
  const deleteStandardsConfigModal = () => {
    //const deleteName=capacityForm.getFieldValue('standardsName')
    const deleteName=props?.standardConfigData?.standardsName
    // 模拟同步操作
     Modal.confirm({
      title: "确认删除？",
      icon: <ExclamationCircleFilled />,
      content: `删除后，该记录规范中的用户将加入默认记录规范！确认删除【${deleteName}】吗?`,
      closeIcon: <CloseOutlined />,
      width: 480,
      centered: true,
      async onOk() {
        deleteStandardsConfigData()
      },
      onCancel() {
      },
    });
  };
  const onClose = async() => {
    const data = { uuid: uuid };
    const res = await standardsClearByUuidFn(adaptParams(data))
    setVisible(false);
  };
  const getRestTime = (val) => {
    setRestTime(val);
  };
  const getHolidayConfig = (val) => {
    //console.log('val888888',val);
    setVisible(false);
    setStashRest(val);
    setIsDirty(true);
  };
  const handleSelectedUserCancel = () => {
    setIsSelectedUserOpen(false);
    if(updateMemberData){
      //setUpdateMemberData(false);
    }else{

    }
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
  const handleSelectedUserOk = () => {
    setSaveMemberData({...selected});
    setStandardUser(selected.selectedUsers);
    setIsSelectedUserOpen(false);
    setIsDirty(true);
  };
   const getSelectedUser = (user) => {
    user?.selectedUsers?.forEach(item => {
      item.userName = item.userName || item.staffName || item.username ||item.nameCn;
    })
    setSelected({ ...user});
  };
  const onSelectedCountChange = (count) => {
    setSelectedSeatCount({...count});
  }
  const showMemberModal = async () => {
    let memberData
    if(updateMemberData){
      memberData=saveMemberData
    }else{
      memberData=[]
    }
    setSaveMemberData({ ...memberData });
    //console.log('memberData88888', standardUser);
    setIsSelectedUserOpen(true);
    setSelected({
      selectedDeparts: [],
      selectedUsers: JSON.parse(JSON.stringify(standardUser)),
      selectedDepartIds: [],
      selectedUserIds: standardUser.map((user) => user.userKey) ,
      checkedKeys: [],
    });
  };
  return (
    <Spin spinning={loading}>
    <div className="set-container">
      <Form
        form={capacityForm}
        onValuesChange={onCapacityValuesChange}
        onFinish={onFinish}
        initialValues={capacityInitialValues}
        layout="vertical"
        className="set-form standards-set-form"
      >
        <Form.Item
          label={
            <div>
              <div>规范名称</div>
            </div>
          }
          name="standardsName"
          rules={[
            {
              required: true,
              message: <div>规范名称不能为空</div>,
            }
          ]}
        >
          <Input style={{ width: 420 }} placeholder="请输入规范名称" maxLength={50} allowClear autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck="false" />
        </Form.Item>
        <Form.Item
          label={
            <div>
              <div>成员</div>
            </div>
          }
          name="name"
        >
          <div className="standards-user-list" style={{ width: 420 }} onClick={() => { 
            if(isDefault){
              setMemberModalVisible(true);
            }else{
             showMemberModal()
            } 
            }}>
            <div className="standards-user-list-content">
              {standardUser.length === 0 && (
                <span className="standards-user-placeholder">请输入</span>
              )}
              {standardUser.length > 0 && (
                <>
                  {/* 显示前四个成员 */}
                  {standardUser.slice(0, 4).map((item, idx) => (
                    <span key={idx} className="user-item-area">
                      <img
                        src={item.avatarUrl || item.staffAvatarUrl }
                        alt={item.userName || item.staffName || item.username}
                        className="user-item-head-img"
                      />
                      <span>{item.userName || item.staffName || item.username || item.name}{item.tag === 0 ? ' [已删除]' : ''}</span>
                    </span>
                  ))}
                  {/* 如果超过四个成员，显示+N并添加Tooltip */}
                  {standardUser.length > 4 && (
                    <Tooltip
                      title={
                        <div style={{ maxHeight: '300px', overflowY: 'auto', width: '100px' }}>
                          {standardUser.slice(4).map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <img
                                src={item.avatarUrl || item.staffAvatarUrl}
                                alt={item.userName || item.staffName || item.username}
                                style={{ width: '20px', height: '20px', borderRadius: '50%'}}
                              />
                              <span>{item.userName || item.staffName || item.username || item.name}{item.tag === 0 ? ' [已删除]' : ''}</span>
                            </div>
                          ))}
                        </div>
                      }
                      placement="top"
                    >
                      <span
                        className="user-item-area-num"
                        onClick={(e) => {
                          e.stopPropagation();
                          // 处理添加更多人员的逻辑
                        }}
                      >
                        +{standardUser.length - 4}
                      </span>
                    </Tooltip>
                  )}
                </>
              )
              }
            </div>
            <span className="auth-user-head"><img src={authLeftIcon} alt="auth_left" width="18px" /></span>
          </div>
        </Form.Item>
        <Form.Item
          label={
            <div>
              <div>单位人天标准工时</div>
              <div className="label-desc">
                设置后，成员登记的工时将按标准工作时长换算人天
              </div>
            </div>
          }
          name="standWorkHour"
          rules={[
            {
              required: true,
              message: <div>单位人天标准工时不能为空</div>,
            },
            {
              validator: validateTwoDecimalPlaces,
            },
          ]}
        >
          <InputNumber min={0.01} max={24} addonAfter="小时" />
        </Form.Item>
        {capacityFormVS?.standWorkHour ? (
          <Text type="warning">{capacityFormVS?.standWorkHourMsg}</Text>
        ) : null}
        <AttendanceToggle
          attendanceEnabled={attendanceConfig.attendanceEnabled}
          onChange={(next) => {
            const enabled = Boolean(next?.attendanceEnabled);
            setIsDirty(true);
            if (!enabled) {
              setMissingCardLimitError('');
            }
            if (enabled) {
              const fallback = capacityInitialValues?.dayUp || attendanceConfig.dayUp || 8;
              capacityForm.setFieldsValue({ dayUp: fallback });
            }
            setAttendanceConfig(normalizeAttendanceConfig({
              ...attendanceConfig,
              ...next,
              dayUp: capacityForm.getFieldValue('dayUp'),
            }));
            validatorCapacityForm(capacityForm.getFieldsValue(), enabled);
          }}
        />
        {attendanceConfig.attendanceEnabled ? (
          <Form.Item
            label={
              <div>
                <div>单天填报工时上限</div>
                <div className="label-desc">成员当天可登记工时上限将取自考勤数据</div>
              </div>
            }
          >
            <Radio.Group
              value={attendanceConfig.attendanceDataSource || ATTENDANCE_DATA_SOURCE.SCHEDULED}
              onChange={(event) => {
                setIsDirty(true);
                setAttendanceConfig(normalizeAttendanceConfig({
                  ...attendanceConfig,
                  attendanceDataSource: event.target.value,
                  dayUp: capacityForm.getFieldValue('dayUp'),
                }));
              }}
            >
              <Radio value={ATTENDANCE_DATA_SOURCE.SCHEDULED}>班内工作时长</Radio>
              <Radio value={ATTENDANCE_DATA_SOURCE.ACTUAL}>实际出勤时长</Radio>
            </Radio.Group>
          </Form.Item>
        ) : (
          <Form.Item
            label={
              <div>
                <div>单天填报工时上限</div>
                <div className="label-desc">
                  设置后，单个成员每自然天填报的工时数不可超过此数
                </div>
              </div>
            }
            name="dayUp"
            rules={[
              {
                required: true,
                message: <div>单天填报工时上限不能为空</div>,
              },
              {
                validator: validateTwoDecimalPlaces,
              },
            ]}
          >
            <InputNumber min={0.01} max={24} addonAfter="小时" />
          </Form.Item>
        )}
        {!attendanceConfig.attendanceEnabled && capacityFormVS?.dayUp ? (
          <Text type="warning">{capacityFormVS?.dayUpMsg}</Text>
        ) : null}
        {attendanceConfig.attendanceEnabled ? (
          <>
            <Form.Item
              label={
                <div>
                  <div>缺卡异常</div>
                  <div className="label-desc">考勤数据为缺卡时，记录和提交规则</div>
                </div>
              }
            >
              <Radio.Group
                value={attendanceConfig.missingCardPolicy || MISSING_CARD_POLICY.BLOCK}
                onChange={(event) => {
                  setIsDirty(true);
                  setMissingCardLimitError('');
                  setAttendanceConfig(normalizeAttendanceConfig({
                    ...attendanceConfig,
                    missingCardPolicy: event.target.value,
                    dayUp: capacityForm.getFieldValue('dayUp'),
                  }));
                }}
              >
                <Radio value={MISSING_CARD_POLICY.BLOCK}>不允许提交</Radio>
                <Radio value={MISSING_CARD_POLICY.CUSTOM_LIMIT}>允许提交-自定义提交上限</Radio>
              </Radio.Group>
            </Form.Item>
            {attendanceConfig.missingCardPolicy === MISSING_CARD_POLICY.CUSTOM_LIMIT ? (
              <Form.Item
                label={
                  <div>
                    <div>缺卡自定义提交上限</div>
                    <div className="label-desc">设置后，缺卡日期提交工时不可超过此数</div>
                  </div>
                }
                required
                validateStatus={missingCardLimitError ? 'error' : ''}
                help={missingCardLimitError}
              >
                <InputNumber
                  id="missingCardLimit"
                  min={0.01}
                  max={24}
                  addonAfter="小时"
                  value={attendanceConfig.missingCardLimit}
                  onChange={(value) => {
                    setIsDirty(true);
                    setMissingCardLimitError('');
                    setAttendanceConfig(normalizeAttendanceConfig({
                      ...attendanceConfig,
                      missingCardLimit: value,
                      dayUp: capacityForm.getFieldValue('dayUp'),
                    }));
                  }}
                />
              </Form.Item>
            ) : null}
          </>
        ) : null}
        <Form.Item
          label={
            <div>
              <div>单次填报工时下限</div>
              <div className="label-desc">
                设置后，成员单次登记工时不得小于当前数量
              </div>
            </div>
          }
          name="onceDown"
          rules={[
            {
              required: true,
              message: "单次填报下限不能为空",
            },
            {
              validator: validateTwoDecimalPlaces,
            },
          ]}
        >
          <InputNumber min={0.01} max={24} addonAfter="小时" />
        </Form.Item>
        {capacityFormVS?.onceDown ? (
          <Text
            style={{
              marginBottom: !capacityFormVS?.onceDown ? 0 : "20px",
              display: "block",
            }}
            type="warning"
          >
            {capacityFormVS?.onceDownMsg}
          </Text>
        ) : null}
        <div className="standards-holiday-set">
          <div>
            <div>休息日配置</div>
            <div className="xiuxu-desc">可配置工作日和休息日</div>
          </div>
          <div>
            <Button onClick={() => {
              //console.log('休息日配置',stashRest);
              if (stashRest) {
                //setStashRest(null);
                //console.log('有配置');
                setHolidayConfigData(stashRest);
                setVisible(true);
              } else {
                //console.log('无配置');
                //setStashRest(holidayConfigData);
                getStandardsConfigHolidayInfo(false)
              }
            }}>配置</Button>
          </div>
        </div>
        <Space className="standards-form-actions">
          <Button type="primary" htmlType="submit">
            保存配置
          </Button>
          {isAdd === 0 && !isDefault ? (
            <Button
              danger
              onClick={() => {
                deleteStandardsConfigModal()
              }}
            >
              删除
            </Button>
          ) : null}
        </Space>
      </Form>
      {/* 休息日配置组件 */}
      <Modal
            centered={true}
            title="休息日配置"
            open={visible}
            onCancel={onClose} // 点击弹窗关闭按钮/蒙层时触发父组件的关闭回调
            width={600}
            destroyOnHidden={true} // 关闭时销毁组件，避免缓存状态
            maskClosable={false} // 点击蒙层不关闭（可选，根据业务需求调整）
            footer={null}
          >
            <RestDayConfigModal
              isDefault={isDefault} 
              editId={props?.standardConfigData && props?.standardConfigData?.id || null}
              holidayConfigData={holidayConfigData}
              getHolidayConfig={getHolidayConfig}
              getRestTime={getRestTime}
              uuid={uuid}
            />
      </Modal>
      {/* 查看成员组件 */}
      {memberModalVisible && (
        <MemberModal
          visible={memberModalVisible}
          onClose={() => setMemberModalVisible(false)}
          initialData={standardUser}
          destroyOnHidden={true}
        />
      )}
      {/* 成员配置组件 */}
       <Modal
        centered
        destroyOnHidden
        title={<div style={{ fontSize:'18px',color: 'color: #1F2329;' }}>成员配置</div>}
        open={isSelectedUserOpen}
        onCancel={handleSelectedUserCancel}
        width={"600px"}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SyncTeamBtn />
            <div>
              <Button className="cancel-btn" onClick={handleSelectedUserCancel}>
                取消
              </Button>
              <Button
                style={{ marginLeft: 8 }}
                type="primary"
                onClick={handleSelectedUserOk}
              >
                确定
              </Button>
            </div>
          </div>
        }
      > 
        <UserSettings
          type={isISV() ? "isv" : "space"}
          getSelectedUser={getSelectedUser}
          onSelectedCountChange={onSelectedCountChange}
          projectId={2}
          selectedUser={selected}
        />
      </Modal>
    </div>
    </Spin>
  );
};
export default StandardsSet;
