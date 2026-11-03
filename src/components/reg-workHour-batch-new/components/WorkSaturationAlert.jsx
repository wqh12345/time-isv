import React from "react";
import { Alert, Tooltip } from "antd";
import { InfoCircleFilled } from "@ant-design/icons";
import dayjs from "dayjs";

/** 工作饱和度提示Alert */
const WorkSaturationAlert = ({ workDate, alertDetail, attendanceEnabled, attendanceHours, missPunchPolicy, onSyncAttendance }) => {
  if (!workDate) return null;
  //console.log('attendanceHours',  attendanceHours);
  // console.log('missPunchPolicy',  missPunchPolicy);
  return (
    <Alert
      style={{ background: "#F4F4FE" }}
      className="registration-alert"
      message={
        <div>
          <div>
            该成员{dayjs(workDate).format("YYYY年MM月DD日")}
            {/* 考勤开启 + 已选日期 + 有考勤记录 */}
            {attendanceEnabled === 1 && typeof attendanceHours === "number" && attendanceHours > 0 && (
              <span>考勤工时<span className="num">{attendanceHours}小时</span>，</span>
            )}
            {/* 考勤开启 + 已选日期 + 缺卡(允许提交) */}
            {attendanceEnabled === 1 && (attendanceHours === null || attendanceHours === undefined || attendanceHours === 0) && missPunchPolicy === 2 && (
              <span>无考勤记录，</span>
            )}
            {/* 考勤开启 + 已选日期 + 缺卡(不允许提交) */}
            {attendanceEnabled === 1 &&(attendanceHours === null || attendanceHours === undefined || attendanceHours === 0) && missPunchPolicy === 1 && (
              <span>无考勤记录，暂不可登记工时，</span>
            )}
            已登记工时
            <span className="num">
              {typeof alertDetail?.registeredWorkingHours === "number"
                ? alertDetail?.registeredWorkingHours : "--"}
              小时
            </span>
            ，待审批工时
            <span className="num">
              {typeof alertDetail?.approvalingWork === "number"
                ? alertDetail?.approvalingWork : "--"}
              小时
            </span>
            ，当前拟提交工时
            <span className="num">
              {typeof alertDetail?.submitHours === "number"
                ? alertDetail?.submitHours : "--"}
              小时
            </span>
            ，剩余可登记工时
            <span className="num">
              {typeof alertDetail?.remainingWork === "number"
                ? alertDetail?.remainingWork : "--"}
              小时
            </span>
            ，工作饱和度
            <span className="num">
              {typeof alertDetail?.saturation === "number"
                ? alertDetail?.saturation : "--"}
              %
            </span>
            <Tooltip
              className="user-tooltip"
              placement="bottom"
              title={
                <>
                  <div>已登记工时：指该「成员」在当前「工作日期」成功登记的工时（已经在工时日志的工时）</div>
                  <div>待审批工时：指该「成员」在当前「工作日期」下处于待审批状态的工时</div>
                  <div>当前拟提交工时：指该「成员」在当前「工作日期」，正准备提交的工时</div>
                  <div>剩余可登记工时：「单天填报工时上限」减去该「成员」在当前「工作日期」的「已登记工时」「待审批工时」及「当前拟提交工时」之和</div>
                  <div>工作饱和度：（该「成员」在当前「工作日期」的「已登记工时」+「待审批工时」+「当前拟提交工时」）÷「单位人天标准工时」× 100%</div>
                </>
              }
            >
              <InfoCircleFilled className="icon" />
            </Tooltip>
            {attendanceEnabled === 1 && <span className="attattendance-sync-btn" onClick={onSyncAttendance}>同步考勤</span>}
          </div>
        </div>
      }
      type="info"
      showIcon
    />
  );
};

export default WorkSaturationAlert;
