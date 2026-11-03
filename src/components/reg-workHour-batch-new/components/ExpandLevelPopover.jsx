import React from "react";
import { Popover } from "antd";
import zhankai from '../../../assets/images/zhankai.png';

const expandOptions = [
  { levelName: "展开至第一级", level: 1 },
  { levelName: "展开至第二级", level: 2 },
  { levelName: "展开至第三级", level: 3 }
];

/** 展开层级Popover */
const ExpandLevelPopover = ({ expandPopoverVisible, onVisibleChange, onLevelSelect, expandLevel }) => {
  return (
    <Popover
      placement="bottomLeft"
      open={expandPopoverVisible}
      onOpenChange={onVisibleChange}
      trigger="click"
      content={
        <div style={{ width: 160 }}>
          <div
            style={{
              padding: "6px 8px", cursor: "pointer",
              backgroundColor: expandLevel === -1 ? "#EFF1FD" : "transparent",
            }}
            onClick={() => onLevelSelect(-1)}
          >
            展开所有层级
          </div>
          {expandOptions.map(item => (
            <div
              key={item.level}
              style={{
                padding: "6px 8px", cursor: "pointer",
                backgroundColor: item.level === expandLevel ? "#EFF1FD" : "transparent",
              }}
              onClick={() => onLevelSelect(item.level)}
            >
              {item.levelName}
            </div>
          ))}
        </div>
      }
    >
      <div title="展开" className="zhankai-icon">
        <img src={zhankai} alt="展开" style={{ width: 20, height: 20 }} />
      </div>
    </Popover>
  );
};

export default ExpandLevelPopover;
