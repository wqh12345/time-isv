import JSSDK from '../../../jssdk-adapter'
import React, { useEffect, useState } from "react";
import { Form, Button, Select, message, Switch, Space, Modal, Alert } from "antd";
import {
  getUnlockedWorkItemInfo,
  getCheckIsEmptyWorkItem,
  postBindMeasurementProject,
  getMeasureEditParam,
} from '../../../api/api';
import "./MeasureSet.less";

const MeasureSet = (props) => {
  const disabledDefaultMeasure = !!props.disabledDefaultMeasure;
  const [isOpen, setIsOpen] = useState(false);
  const [measureForm] = Form.useForm();
  const [isDisabled, setIsDisabled] = useState(true);
  const [isEmpty, setIsEmpty] = useState(false);
  const [measureWorkItemOptions, setMeasureWorkItemOptions] = useState([]);
  const [bindWorkItemOptions, setBindWorkItemOptions] = useState([]);
  const [measureWorkItemValidateStatus, setMeasureWorkItemValidateStatus] =
    useState("success");
  const [measureWorkItemHelp, setMeasureWorkItemHelp] = useState("");
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [measureWorkItemName, setMeasureWorkItemName] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  // 获取配置
  const getConfig = async () => {
    const data = {
      type: "ALLOW_MEASUREMENT",
      projectKey: props?.projectKey,
    };
    const res = await getMeasureEditParam(data);
    if (res?.result) {
      setIsOpen(res.data?.value === 1 ? true : false);
      setIsDisabled(res.data?.measureWorkItemId ? false : true);
      setIsEmpty(res.data?.measureWorkItemId ? true : false);
      if (res.data?.measureWorkItemId) {
        getBindWorkItemOptions(res.data?.measureWorkItemId);
      }
      setMeasureWorkItemName(res.data?.measureWorkItemName);
      measureForm.setFieldsValue({
        id: res.data?.id,
        type: res.data?.type,
        measureWorkItemId: res.data?.measureWorkItemId,
        bindWorkItemIds: res.data?.bindWorkItemIds,
      });
    }
  };

  useEffect(() => {
    getConfig();
  }, []);

  // 获取工时统计工作项
  const getMeasureWorkItemOptions = async () => {
    const res = await getUnlockedWorkItemInfo({ projectKey: props?.projectKey });
    if (res?.result) {
      setMeasureWorkItemOptions(res.data);
      if (
        !res.data?.some(
          (item) =>
            item.typeKey === measureForm.getFieldValue("measureWorkItemId")
        )
      ) {
        if (measureForm.getFieldValue("measureWorkItemId")) {
          setMeasureWorkItemValidateStatus("error");
          setMeasureWorkItemHelp("该工作项已禁用或删除");
        }
        if (props?.configMeasure?.measureWorkItemName || measureWorkItemName) {
          measureForm.setFieldValue(
            "measureWorkItemId",
            props?.configMeasure?.measureWorkItemName || measureWorkItemName
          );
        }
      }
    }
  };

  useEffect(() => {
    if (isOpen) getMeasureWorkItemOptions();
  }, [isOpen]);

  // 获取启用工作项
  const getBindWorkItemOptions = async (typeKey) => {
    const data = {
      typeKey,
      projectKey: props?.projectKey,
    };
    const res = await getUnlockedWorkItemInfo(data);
    if (res?.result) {
      setBindWorkItemOptions(res.data);
    }
  };

  // 校验承载度量的工时统计工作项
  const checkIsEmptyWorkItem = async (_, value) => {
    if (!value) {
      setMeasureWorkItemValidateStatus("error");
      setMeasureWorkItemHelp("工时统计工作项不能为空");
      return Promise.reject(new Error("工时统计工作项不能为空"));
    }
    if (
      props?.configMeasure?.measureWorkItemName &&
      value === props?.configMeasure?.measureWorkItemName
    )
      return Promise.reject(new Error("该工作项已禁用或删除"));
    setIsDisabled(false);
    try {
      let isOk = false;
      measureWorkItemOptions.forEach((item) => {
        if (item.id === value && item.disabled) {
          isOk = true;
        }
      });
      if (isOk) {
        setMeasureWorkItemValidateStatus("success");
        setMeasureWorkItemHelp("");
        return Promise.resolve();
      }
      const data = {
        measureWorkItemId: value,
        projectKey: props?.projectKey,
      };
      const res = await getCheckIsEmptyWorkItem(data);
      if (res?.result) {
        setIsEmpty(res.data);
        if (res.data) {
          setIsDisabled(false);
          getBindWorkItemOptions(value);
          setMeasureWorkItemValidateStatus("success");
          setMeasureWorkItemHelp("");
          return Promise.resolve();
        } else {
          setMeasureWorkItemValidateStatus("error");
          setMeasureWorkItemHelp("请选择为空的工作项");
          measureForm.setFieldValue("bindWorkItemIds", []);
          // return Promise.reject(new Error("请选择为空的工作项"));
        }
      }
    } catch (error) {
      console.error("接口调用出错:", error);
      setMeasureWorkItemValidateStatus("error");
      setMeasureWorkItemHelp("校验工时统计工作项时发生错误，请稍后再试");
      return Promise.reject(
        new Error("校验工时统计工作项时发生错误，请稍后再试")
      );
    }
  };

  // 提交配置
  const onFinish = async (values, confirmUpdate) => {
    setIsSubmitLoading(true);
    const data = {
      measureWorkItemId: values?.measureWorkItemId,
      bindWorkItemIds: values?.bindWorkItemIds,
      type: "ALLOW_MEASUREMENT",
      value: isOpen ? 1 : 0,
      measureWorkItemName,
      projectKey: props?.projectKey,
    };
    if (confirmUpdate) data.confirmUpdate = true;
    const res = await postBindMeasurementProject(data);
    if (res?.result) {
      JSSDK.toast.success("设置成功");
      props.setIsMeasureSetOpen(true);
    } else {
      setIsSubmitLoading(false);
      switch (res?.code) {
        case 10024:
          setMeasureWorkItemValidateStatus("error");
          setMeasureWorkItemHelp("工时统计工作项非法");
          break;
        case 10025:
          setMeasureWorkItemValidateStatus("error");
          setMeasureWorkItemHelp("工时统计工作项非法");
          break;
        case 40100:
          setMeasureWorkItemValidateStatus("error");
          setMeasureWorkItemHelp(
            <div>
              当前工作项的名称与已有工作项的关联关系名称
              {res?.msg}
              重复。
              <br />
              请先到
              <Button
                type="link"
                style={{ padding: 0, height: "inherit" }}
                onClick={async () => {
                  const hostname = await JSSDK.navigation.getHostname();
                  JSSDK.Context.load().then(async (ctx) => {
                    const mainSpace = ctx.mainSpace;
                    const space = await JSSDK.Space.load(mainSpace?.id);
                    JSSDK.navigation.open(
                      `https://${hostname}/${space?.simpleName}/setting/workObjectSetting/advancedConfig?menuTab=relation`
                    );
                  });
                }}
              >
                空间配置-工作项管理-工作项高级配置
              </Button>
              中，删除或修改以上关联关系名称
            </div>
          );
          break;
        case 40003:
          Modal.confirm({
            title: "提示",
            content: res?.msg,
            okText: "继续",
            cancelText: "取消",
            onOk: () => {
              onFinish(values, true);
            },
          });
          break;
        default:
          break;
      }
    }
  };

  const onValuesChange = (changedValues, allValues) => {
    setIsDirty(true);
    if (changedValues?.measureWorkItemId) {
      setMeasureWorkItemValidateStatus("");
      setMeasureWorkItemHelp("");
    }
  };

  return (
    <div className="measure-set-warp">
      <div className="measure-set-top">
        <div className="measure-set-title-row">
          <div className="label">度量设置</div>
          <Switch
            size="small"
            checked={disabledDefaultMeasure ? false : isOpen}
            disabled={disabledDefaultMeasure}
            onChange={(e) => {
              setIsOpen(e);
              setIsDirty(true);
              // if (!e) measureForm.resetFields();
            }}
          />
          {/* {disabledDefaultMeasure && <span className="measure-set-disabled-tip">开关按钮置灰，不能点击</span>} */}
        </div>
        <div className="des">开启后，登记的工时可被飞书项目度量消费</div>
      </div>
      {disabledDefaultMeasure ? (
        <>
          <div className="measure-set-divider" />
          <Alert
            className="measure-set-alert"
            type="warning"
            showIcon
            message="默认配置暂不支持度量配置。如果使用度量，请前往具体空间进行配置。"
          />
          <Button className="measure-set-save-btn" type="primary" disabled>
            保存配置
          </Button>
        </>
      ) : isOpen ? (
        <>
          <div className="measure-set-divider" />
          <Form
            layout="vertical"
            form={measureForm}
            onFinish={onFinish}
            className="set-form"
            onValuesChange={onValuesChange}
          >
          <Form.Item
            label={
              <div>
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  工时统计工作项
                  <span style={{ color: '#ff4d4f', fontFamily: 'SimSun, sans-serif', marginLeft: 4 }}>*</span>
                </span>
                <div className="label-desc" style={{ lineHeight: 1.6 }}>
                  此工作项将用于存放工时日志的原始数据，实现工时的度量消费，详情请
                  &nbsp;
                  <Button
                    type="link"
                    style={{
                      padding: 0,
                      lineHeight: 'inherit',
                      fontSize: 'inherit',
                      height: 'auto',
                    }}
                    onClick={() => {
                      JSSDK.navigation.open(
                        `https://ldkj.feishu.cn/wiki/SLGKwWQN6ij5pIkZSmbclm1InYf#FrYcdUHQOoH2wSxyT44ccWX0nN9`
                      );
                    }}
                  >
                    查看教程
                  </Button>
                </div>
              </div>
            }
            name="measureWorkItemId"
            rules={[
              {
                required: false,
                message: "工时统计工作项不能为空",
              },
              {
                validator: checkIsEmptyWorkItem,
              },
            ]}
            required={false}
            validateStatus={measureWorkItemValidateStatus}
            help={measureWorkItemHelp}
          >
            <Select
              options={measureWorkItemOptions}
              fieldNames={{
                label: "name",
                value: "typeKey",
              }}
              placeholder="请选择"
              onChange={(val, option) => {
                setMeasureWorkItemName(option.name);
                setIsDirty(true);
                if (props?.configMeasure?.measureWorkItemName)
                  measureForm.setFieldValue("bindWorkItemIds", []);
              }}
            />
          </Form.Item>
          <Form.Item
            label={
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                启用工作项
                <span style={{ color: '#ff4d4f', fontFamily: 'SimSun, sans-serif', marginLeft: 4 }}>*</span>
              </span>
            }
            name="bindWorkItemIds"
            disabled={isDisabled && !isEmpty}
            rules={[
              {
                required: true,
                message: "启用工作项不能为空",
              },
            ]}
            required={false}
            help={
              isDisabled || !isEmpty ? (
                <div className="ant-form-item-explain-error">
                  请先选择工时统计工作项
                </div>
              ) : null
            }
          >
            <Select
              mode="multiple"
              maxCount={20}
              options={bindWorkItemOptions}
              fieldNames={{
                label: "name",
                value: "typeKey",
              }}
              disabled={isDisabled || !isEmpty}
              placeholder="请选择"
            />
          </Form.Item>
          <Space style={{ justifyContent: "flex-start", width: "100%" }}>
            <Button type="primary" htmlType="submit" loading={isSubmitLoading}>
              保存配置
            </Button>
          </Space>
        </Form>
        </>
      ) : (
        <>
          <div className="measure-set-divider" />
          <Space className="measure-set-bottom">
            <Button type="primary" onClick={onFinish}>
              保存配置
            </Button>
          </Space>
        </>
      )}
    </div>
  );
};
export default MeasureSet;
