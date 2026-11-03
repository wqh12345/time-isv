import JSSDK from '../../jssdk-adapter'
/**
 * @file RegWorkHour.jsx
 * @description 工时登记组件入口，根据 registrationType 渲染单项或批量登记
 * @author TeamMeego
 * @date 2024
 */

import React, { useState, useEffect } from "react";
import { Spin, Space, Button } from "antd";
import { getApprovalSettings } from "../../api/api";
import { getAppMode } from "../../config/auth";
import "./RegWorkHour.less";

// 子组件导入
import SingleRegistration from "./SingleRegistration";
// 使用原始的批量登记组件
import RegWorkHourBatchNew from "../reg-workHour-batch-new/RegWorkHourBatchNew";

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
 * @param {number} props.windowHeight - 窗口高度
 * @param {number} props.wHeight - 模态框高度
 * @param {string} props.openType - 打开类型
 * @param {Object} props.currItem - 当前项
 */
const RegWorkHour = (props) => {
  const [registrationType, setRegistrationType] = useState(
    props?.registrationType || "single"
  );
  const [spinning, setSpinning] = useState(false);
  const [submitLoadings, setSubmitLoadings] = useState(false);
  const [saveHourLoadings, setSaveHourLoadings] = useState(false);
  const [submitBtnTxt, setSubmitBtnTxt] = useState("提交");
  const [currentProjectKey, setCurrentProjectKey] = useState("");
  // 监听登记类型变化
  useEffect(() => {
    if (props?.registrationType) {
      setRegistrationType(props.registrationType);
    }
  }, [props?.registrationType]);

  /**
   * 根据应用模式和空间配置动态设置按钮文本
   * 租户模式 → "提交"
   * 空间模式 → 根据 enableApproval 配置决定 "提交审批" 或 "提交"
   */
  useEffect(() => {
    const appMode = getAppMode();
    if (appMode === 'tenant') {
      setSubmitBtnTxt('提交');
      return;
    }
    const fetchApprovalConfig = async () => {
      try {
        const enableApproval=currentProjectKey?.enableApproval || false
        setSubmitBtnTxt(enableApproval ? '提交审批' : '提交');
      } catch (e) {
        setSubmitBtnTxt('提交');
      }
    };
    fetchApprovalConfig();
  }, [JSON.stringify(currentProjectKey)]);

  /** 子组件选中空间变更回调 */
  const handleSpaceKeyChange = (spaceKey) => {
    setCurrentProjectKey(spaceKey || '');
  };

  // 提交结果回调
  const handleSubmitResult = (val) => {
    if (val === 2 && props?.openType !== "again_launch") {
      JSSDK.toast.success(`${submitBtnTxt}成功`);
    }
    if (val === 1) {
      const msg = props?.openType === "tab" 
        ? "已暂存" 
        : "已暂存，下次打开将自动恢复";
      JSSDK.toast.success(msg);
    }
    props.getRegistrationValue && props.getRegistrationValue(val);
  };

  // 取消回调
  const handleCancel = () => {
    props.getRegistrationValue && props.getRegistrationValue(0);
  };

  // 根据登记类型渲染对应组件
  const renderRegistration = () => {
    if (registrationType === "batch") {
      return (
        <div className="registration-warp batch-registration-warp">
          <RegWorkHourBatchNew
            {...props}
            loginUser={props?.loginUser}
            type="web"
            getRegistrantUserKey={(val) => {}}
            setSubmitLoadings={setSubmitLoadings}
            setSaveHourLoadings={setSaveHourLoadings}
            submitLoadings={submitLoadings}
            saveHourLoadings={saveHourLoadings}
            submitResult={handleSubmitResult}
            onSpaceKeyChange={handleSpaceKeyChange}
          />
          <div className="content-footer">
            {/* <span style={{marginRight: 20}}>当前模式：{getAppMode()}</span> */}
            <Space>
              <Button onClick={handleCancel}>取消</Button>
              {/* {props?.openType === "again_launch" ? null : (
                <Button
                  loading={saveHourLoadings}
                  onClick={() => setSaveHourLoadings(true)}
                >
                  暂存
                </Button>
              )} */}
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
      );
    }

    return (
      <SingleRegistration
        {...props}
        submitLoadings={submitLoadings}
        saveHourLoadings={saveHourLoadings}
        submitBtnTxt={submitBtnTxt}
        setSubmitLoadings={setSubmitLoadings}
        setSaveHourLoadings={setSaveHourLoadings}
        getRegistrationValue={handleSubmitResult}
        onCancel={handleCancel}
      />
    );
  };

  return (
    <Spin spinning={spinning}>
      <div className="reg-work-hour-container">
        {renderRegistration()}
      </div>
    </Spin>
  );
};

export default RegWorkHour;
