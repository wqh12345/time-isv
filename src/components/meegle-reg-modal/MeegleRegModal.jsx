import JSSDK from '../../jssdk-adapter'
// src/FeatureModalInner.tsx
import React, { useEffect, useState } from "react";
import RegWorkHour from "../reg-workHour/RegWorkHour";
import FilterMemorySetting from "./FilterMemorySetting";
import "./MeegleRegModal.less";

export default () => {
  const [props, setProps] = useState({});
  const [filterMemoryEnabled, setFilterMemoryEnabled] = useState(false);
  const [filterMemoryConfig, setFilterMemoryConfig] = useState(null);
  
  useEffect(() => {
    // 首先尝试从 JSSDK 获取 context
    JSSDK.Context.load().then((context) => {
      // 检查 getCustomContext 是否存在且为函数
      if (context && typeof context.getCustomContext === 'function') {
        context.getCustomContext().then((customContext) => {
          try {
            console.log("从 JSSDK 获取 customContext:", customContext);
            setProps(customContext);
          } catch (e) {
            console.error("获取 customContext 失败:", e);
            // 降级方案：从 sessionStorage 获取
            loadFromSessionStorage();
          }
        }).catch((e) => {
          console.error("getCustomContext 失败:", e);
          // 降级方案：从 sessionStorage 获取
          loadFromSessionStorage();
        });
      } else {
        console.warn("context.getCustomContext 不是函数，使用降级方案");
        // 降级方案：从 sessionStorage 获取
        loadFromSessionStorage();
      }
    }).catch((e) => {
      console.error("Context.load 失败:", e);
      // 降级方案：从 sessionStorage 获取
      loadFromSessionStorage();
    });
  }, []);
  
  // 从 sessionStorage 加载 context 的降级方案
  const loadFromSessionStorage = () => {
    try {
      // 首先尝试读取 jssdk_context（JSSDK 设置的键）
      const storedContext = sessionStorage.getItem('jssdk_context');
      if (storedContext) {
        const parsed = JSON.parse(storedContext);
        // JSSDK 将数据存储在 customContext 属性中
        const context = parsed.customContext || parsed;
        setProps(context);
      } else {
        console.warn("sessionStorage 中没有找到 jssdk_context");
      }
    } catch (e) {
      console.error("从 sessionStorage 加载 context 失败:", e);
    }
  };

  const onRegistrationOk = (rel) => {
    // 通过 submit<Params>(params: Params): Promise<void> 对传入的 onSubmit 进行调用    
    props?.getRegStatus && props.getRegStatus(rel);
    JSSDK.containerModal.submit({ confirm: rel });
  };

  return (
    <div className="ant-modal" style={{ marginBottom: 0, width:'100%', height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div className="meegle-reg-modal-title">
        <span>{props?.title}</span>
        {props?.registrationType === "batch" && (
          <FilterMemorySetting
            configType="BATCH_REGISTER_FILTER_MEMORY"
            memoryConfig={filterMemoryConfig}
            memoryEnabled={filterMemoryEnabled}
            registrantUserKey={props?.loginUser?.userKey}
            onConfigLoaded={setFilterMemoryConfig}
            onSaved={setFilterMemoryEnabled}
          />
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {props?.registrationType ? (
          <RegWorkHour
            {...props}
            filterMemoryEnabled={filterMemoryEnabled}
            onFilterMemoryLoaded={setFilterMemoryEnabled}
            onFilterMemoryConfigLoaded={setFilterMemoryConfig}
            type={props?.type ? props?.type : "web"}
            loginUser={props?.loginUser}
            getRegistrationValue={onRegistrationOk}
            setRegistrationValue={props?.setRegistrationValue}
            registrationType={props?.registrationType}
            // ISV/JSSDK 场景下若外部显式传入 disableWorkItemValidate=true，则跳过登记对象必填校验
            // （切成员误报问题已在 SingleRegistration 中通过 setFields 清错处理，默认开启必填校验）
            disableWorkItemValidate={props?.disableWorkItemValidate === true}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
            加载中...
          </div>
        )}
      </div>
    </div>
  );
};
