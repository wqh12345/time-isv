import React from 'react';
import { Switch, Typography } from 'antd';

const { Title } = Typography;

const AttendanceToggle = ({ attendanceEnabled = false, onChange }) => (
  <div className="common-card-item" style={{ marginBottom: 18 }}>
    <div className="card-item-header">
      <Title level={5} className="attendance-toggle-title">对接考勤数据</Title>
      <Switch
        checked={Boolean(attendanceEnabled)}
        onChange={(value) => onChange?.({ attendanceEnabled: value })}
        aria-label="对接考勤数据"
        size="small"
      />
    </div>
  </div>
);

export default AttendanceToggle;
