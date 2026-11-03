import React, { useEffect, useState } from "react";
import { Alert } from "antd";
import { NotificationFilled } from "@ant-design/icons";
import Marquee from "react-fast-marquee";
import {
  getRollingAnnouncement,
  getCloseRollingAnnouncement,
} from '../../api/api';
import "./TopAlert.less";

const TopAlert = () => {
  const [isShow, setIsShow] = useState(false);
  const [topAlertInfo, setTopAlertInfo] = useState({});

  useEffect(() => {
    getTopAlert();
  }, []);

  const getTopAlert = async () => {
    const res = await getRollingAnnouncement();
    if (res?.result && res?.data) {
      setTopAlertInfo(res.data);
      setIsShow(true);
    }
  };
  const onClose = async () => {
    await getCloseRollingAnnouncement(topAlertInfo?.id);
  };
  return isShow ? (
    <Alert
      className="top-alert-warp"
      banner
      icon={<NotificationFilled />}
      closable={topAlertInfo?.canClosed}
      onClose={onClose}
      message={
        <div className="top-alert-content-wrapper">
          <div
            className="top-alert-content"
            dangerouslySetInnerHTML={{
              __html: topAlertInfo?.content,
            }}
          />
        </div>
      }
    />
  ) : null;
};
export default TopAlert;
