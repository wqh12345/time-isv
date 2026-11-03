import React from "react";
import { Button, Space } from "antd";
import { ExportOutlined } from "@ant-design/icons";
import JSSDK from "../../../jssdk-adapter";
import { MENU_KEY } from "../approvalMenuConfig";

/** 审批方式：1 自研审批，2 飞书审批 */
export const APPROVAL_TYPE_FEISHU = 2;

/**
 * 审批详情抽屉右上角操作区
 *   - 通过 / 拒绝：有审批权限时展示
 *   - 跳转：飞书审批且列表行有 instanceCode 时展示（与是否有审批权限无关）
 *
 * @param {object} props
 * @param {object} props.curItem        审批详情数据，需含 operationList（汇总审批详情不返回 approvalType，回退取列表行的）
 * @param {string} props.curMenu        当前侧边栏一级 tab（通过/拒绝仅「待办」tab 展示）
 * @param {object} props.listRecord     抽屉对应的列表行（跳转只取列表行数据：approvalType / instanceCode，前端拼 applink）
 * @param {Function} props.onOperateClick 既有操作处理函数 (e, record, operate)
 */
const ApprovalDrawerExtra = ({ curItem, curMenu, listRecord, onOperateClick }) => {
  // 通过/拒绝仅「待办」tab 展示（其他 tab 不提供抽屉内审批入口），且仍需行数据有 audit 权限
  const canAudit =
    curMenu === MENU_KEY.SELF_APPROVE_TODO &&
    curItem?.operationList?.includes("audit");
  // 飞书审批才展示跳转；汇总审批详情接口 approvalType 为 null，回退取列表行的；
  // instanceCode 只取列表行值（详情接口的值不参与），为空则隐藏
  const jumpUrl =
    Number(curItem?.approvalType ?? listRecord?.approvalType) ===
    APPROVAL_TYPE_FEISHU
      ? listRecord?.instanceCode || ""
      : "";

  const onJump = (e) => {
    e?.stopPropagation();
    let fs_url = `https://applink.feishu.cn/client/mini_program/open?mode=appCenter&appId=cli_9cb844403dbb9108&path=pc%2Fpages%2Fin-process%2Findex%3FinstanceId%3D${jumpUrl}`;
    if (jumpUrl) JSSDK.navigation.open(fs_url);
  };

  if (!canAudit && !jumpUrl) return null;

  return (
    <Space>
      {canAudit ? (
        <>
          <Button
            size="small"
            type="primary"
            onClick={(e) => onOperateClick(e, curItem, "pass")}
          >
            通过
          </Button>
          <Button
            size="small"
            danger
            type="primary"
            onClick={(e) => onOperateClick(e, curItem, "refuse")}
          >
            拒绝
          </Button>
        </>
      ) : null}
      {jumpUrl ? (
        <Button size="small" icon={<ExportOutlined />} onClick={onJump}>
          跳转
        </Button>
      ) : null}
    </Space>
  );
};

export default ApprovalDrawerExtra;
