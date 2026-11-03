import JSSDK from '../../jssdk-adapter'
import { useEffect, useState } from "react";
import { Modal, Badge, Button, Space } from "antd";
import { getPlanMessage, setJumpPayUuid} from '../../api/api';
import { generateUuid} from '../../util/util';
import pluginConfig from '../../config';

export const SeatPermissionsModal = (props) => {
  const [open, setOpen] = useState();
  const [planInfo, setPlanInfo] = useState({});
  const jumpPayPage = async () => {
    const hostname = await JSSDK.navigation.getHostname();
    JSSDK.Context.load().then(async (ctx) => {
      const mainSpace = ctx.mainSpace;
      const space = await JSSDK.Space.load(mainSpace?.id);
      const data={
        uuid:generateUuid(),
        value:1
      }
      try {
        const res = await setJumpPayUuid(data);
        if (res?.result) {  // 确保API调用成功后再跳转
          JSSDK.navigation.open(
            `https://${hostname}/${space?.simpleName}/meegoPlg/${pluginConfig.pluginId}_${pluginConfig.boardKey}?uuid=${data.uuid}`
          );
        }
      } catch (error) {
        JSSDK.navigation.open(
          `https://${hostname}/${space?.simpleName}/meegoPlg/${pluginConfig.pluginId}_${pluginConfig.boardKey}?uuid=${data.uuid}`
        );
      }
    });
  }
  useEffect(() => {
    setOpen(props.open);
  }, [props.open]);

  // 添加防抖处理，防止频繁点击导致的异常
  const handleClose = () => {
    setOpen(false);
    // 通知父组件模态框已关闭，允许再次显示
    if (props.onClose) {
      props.onClose();
    }
  };

  return (
    <div>
      <div>
        <div>
        {sessionStorage.getItem("jwtMeegoTeamworkUserRole") === "Admin" 
          ? "您的账号还未被配置可用席位。作为插件管理员，您可以点击下方按钮 进行配置。"
          : "很抱歉，您的账号还未被企业配置可用席位。请联系您企业的 【插件管理员】为您开通。"
        }
      </div>
      <div>若仍有问题，可随时联系我们的客服团队。</div>
      </div>
      <div>
        {
        sessionStorage.getItem("jwtMeegoTeamworkUserRole") === "Admin" ? (
          <Space
            style={{
              marginTop: "20px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Button
              onClick={() => JSSDK.navigation.open(props.chatUrl)}
            >
              联系客服
            </Button>
            <Button
              type="primary"
              onClick={async () => {
                const hostname = await JSSDK.navigation.getHostname();
                JSSDK.Context.load().then(async (ctx) => {
                  const mainSpace = ctx.mainSpace;
                  const space = await JSSDK.Space.load(mainSpace?.id);
                  const data={
                    uuid:generateUuid(),
                    value:1
                  }
                  try {
                    const res = await setJumpPayUuid(data);
                    if (res?.result) {  // 确保API调用成功后再跳转
                      JSSDK.navigation.open(
                        `https://${hostname}/${space?.simpleName}/meegoPlg/${pluginConfig.pluginId}_${pluginConfig.boardKey}?uuid=${data.uuid}&&isSeat=1`
                      );
                    }
                  } catch (error) {
                    JSSDK.navigation.open(
                      `https://${hostname}/${space?.simpleName}/meegoPlg/${pluginConfig.pluginId}_${pluginConfig.boardKey}?uuid=${data.uuid}&&isSeat=1`
                    );
                  }
                });
              }}
            >
              配置席位
            </Button>
          </Space>
        ) : (
          <Space
            style={{
              marginTop: "20px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Button
              type="primary"
              onClick={() => JSSDK.navigation.open(props.chatUrl)}
            >
              联系客服
            </Button>
          </Space>
        )
      }
      </div>
    </div>
  );
};
export default SeatPermissionsModal;

