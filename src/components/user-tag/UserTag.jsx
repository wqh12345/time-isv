import React from 'react';
import { Avatar } from 'antd';
import { UserOutlined } from '@ant-design/icons';

const UserTag = ({ userId, name, avatar }) => {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Avatar
        size={18}
        src={avatar}
        icon={<UserOutlined />}
        style={{ flexShrink: 0 }}
      />
      {name && <span>{name}</span>}
    </span>
  );
};

export default UserTag;

export { UserTag };
