import JSSDK from '../../jssdk-adapter'
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from 'react-router-dom'
import { Modal, Badge, Button, Space } from "antd";
import { getPlanMessage, setJumpPayUuid} from '../../api/api';
import { generateUuid} from '../../util/util';
import pluginConfig from '../../config';

export const ExpirationModal = (props) => {
  const { onVisibleChange, suppress, onComplete } = props || {};
  const [open, setOpen] = useState(false);
  const [planInfo, setPlanInfo] = useState({});
  const [ready, setReady] = useState(false); // 接口是否已返回（用于区分"待定"和"确定不显示"）
  const navigate = useNavigate();
  const location = useLocation();

  // 实际展示状态：suppress 时不展示，但仍需向父组件汇报"本应展示"的状态
  const actualOpen = open && !suppress;

  // 接口返回后通知父组件实际可见状态
  useEffect(() => {
    if (ready) {
      onVisibleChange?.(actualOpen);
      // 如果本不应展示，直接触发完成回调
      if (!actualOpen) {
        setTimeout(() => onComplete?.(), 0);
      }
    }
  }, [actualOpen, ready, onVisibleChange, onComplete]);

  // 弹窗关闭时触发完成回调
  const handleClose = () => {
    setOpen(false);
    setTimeout(() => onComplete?.(), 0);
  };

  const getMessage = async () => {
    try {
      const res = await getPlanMessage();
      if (res?.data) {
        setPlanInfo(res.data);
        if (res?.result) {
          setOpen(true);
        }
      }
    } finally {
      setReady(true);
    }
//     const plan={
//         "messageContent": "当前仅前10个席位用户可用，请续费升级或重新分配席位",
//         "planName": "基础版",
//         "remainingTime": null,
//         "chatUrl": "https://applink.larksuite.com/client/chat/chatter/add_by_link?link_token=a8er9221-1ddf-47f3-a29b-654478rkgebi",
//         "planStartTime": "2025-11-18",
//         "planEndTime": "2025-12-07",
//         "msgType": 2
//     }
// setPlanInfo(plan);
// setOpen(true)
  };
  const jumpPayPage = () => {
      if (location.pathname === '/pay') {
        handleClose();
        window.dispatchEvent(new CustomEvent('openSeatConfig'));
      } else {
        sessionStorage.setItem("jumpPayUuid", "expiration");
        navigate('/pay', { replace: true });
      }
  }
   const handlePaymentRedirect= async () => {
    const PLUGIN_ID = import.meta.env.VITE_PLUGIN_ID
    let url = `https://project.feishu.cn/openapp/plugin_share?appKey=${PLUGIN_ID}`
    window.open(url, '_blank');
  }
  const jumpToPay = async() => {
    handlePaymentRedirect()
  }
  useEffect(() => {
    getMessage();
  }, []);

  return (
    <Modal
      title={planInfo?.msgType === 2 ? "席位超额" : "权限即将过期"}
      open={actualOpen}
      onClose={handleClose}
      onCancel={handleClose}
      footer={
        <Space
          style={{
            marginTop: "20px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {/* msgType=1: 显示原来的按钮 */}
          {planInfo?.msgType === 1 && (
            <>
              <Button
                onClick={() => JSSDK.navigation.open(planInfo?.chatUrl)}
              >
                咨询客服
              </Button>
              <Button
                type="primary"
                onClick={async () => {
                  jumpToPay()
                }}
              >
                立即续费
              </Button>
            </>
          )}
          
          {/* msgType=2: 显示重新分配和续费升级按钮 */}
          {planInfo?.msgType === 2 && (
            <>
              <Button
                onClick={() => {
                  jumpPayPage()
                }}
              >
                重新分配
              </Button>
              <Button
                type="primary"
                onClick={async () => {
                  jumpToPay()
                }}
              >
                续费升级
              </Button>
            </>
          )}
        </Space>
      }
    >
      {planInfo?.msgType === 1 && (planInfo?.remainingTime === 0 ? (
        <Badge
          color="#4247f6"
          text={
            <div style={{ display: "inline-block" }}>
              您的
              <span style={{ fontWeight: 600, color: "#4247f6" }}>
                {planInfo?.planName}
              </span>
              套餐将在今天到期，为避免影响正常使用，请及时续费
            </div>
          }
        />
      ) : (
        <Badge
          color="#4247f6"
          text={
            <div style={{ display: "inline-block" }}>
              您的
              <span style={{ fontWeight: 600, color: "#4247f6" }}>
                {planInfo?.planName}
              </span>
              套餐将在{planInfo?.remainingTime}
              天后到期，为避免影响正常使用，请及时续费
            </div>
          }
        />
      ))}
      {planInfo?.msgType === 2 && (
        <div>{planInfo?.messageContent}</div>
      )}
    </Modal>
  );
};
export default ExpirationModal;
