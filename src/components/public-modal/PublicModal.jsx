import JSSDK from '../../jssdk-adapter'
import React, { useEffect, useState } from "react";
import { Button, Modal } from "antd";
import { NotificationFilled } from "@ant-design/icons";
import Marquee from "react-fast-marquee";
import {
  getFullScreenAnnouncement,
  getConfirmFullScreenAnnouncement,
} from '../../api/api';
import "./PublicModal.less";

const PublicModal = (props) => {
  const { onComplete } = props;
  const [isShow, setIsShow] = useState(false);
  const [publicModalInfo, setPublicModalInfo] = useState({});

  useEffect(() => {
    getPublicModal();
  }, []);

  const getPublicModal = async () => {
    const res = await getFullScreenAnnouncement();
    if (res?.result && res?.data) {
      setPublicModalInfo(res.data);
      setIsShow(true);
    } else {
      // 不需要显示公告，直接完成
      setIsShow(false);
      setTimeout(() => onComplete?.(false), 0);
    }
  };
  const handleComplete = () => {
    setIsShow(false);
    setTimeout(() => onComplete?.(true), 0);
  };
  const onCancel = async () => {
    handleComplete();
  };
  const onOk = async () => {
    await getConfirmFullScreenAnnouncement(publicModalInfo?.id);
    if (publicModalInfo?.buttonUrl) {
      JSSDK.navigation.open(publicModalInfo?.buttonUrl);
    }
    handleComplete();
  };
  return (
    <Modal
      className="public-modal-warp"
      title={
        <img
          src={publicModalInfo?.backgroundUrl}
          className="public-modal-header"
        />
      }
      open={isShow}
      width={648}
      closable={publicModalInfo?.canClosed}
      keyboard={publicModalInfo?.canClosed}
      maskClosable={publicModalInfo?.canClosed}
      footer={
        <Button type="primary" onClick={onOk}>
          {publicModalInfo?.buttonText}
        </Button>
      }
      onCancel={onCancel}
    >
      <div dangerouslySetInnerHTML={{ __html: publicModalInfo?.content }} />
    </Modal>
  );
};
export default PublicModal;
