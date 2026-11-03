import React, { useRef, useState } from 'react';
import { Button, Card, Descriptions, Space, Tag } from 'antd';
import SpaceCascader from '../../components/space-cascader/SpaceCascader';

/**
 * SpaceCascader 级联选择器演示父组件
 * 空间 → 工作项 → 工作项实例 → 节点 → 任务
 *
 * 默认调用后端 4 个接口：
 *   /project/list、/level/getWorkItemOption、/level/getItemEntityOption、/level/getNodeAndTaskOption
 * 如需静态空间列表，可通过 spaceOptions 或 fetchSpaceOptions 覆盖
 */
export default function SpaceCascaderDemo() {
  const cascaderRef = useRef(null);

  // ids = [spaceId, workItemId, workItemEntityId, nodeId, taskId]
  const [ids, setIds] = useState([]);
  const [names, setNames] = useState({});

  const handleCascaderChange = (nextIds, nextNames, selectedOptions) => {
    console.log('[SpaceCascader] ids =', nextIds);
    console.log('[SpaceCascader] names =', nextNames);
    console.log('[SpaceCascader] selectedOptions =', selectedOptions);
    setIds(nextIds || []);
    setNames(nextNames || {});
  };

  const handleReset = () => {
    cascaderRef.current?.reset();
    setIds([]);
    setNames({});
  };

  const handleReload = () => {
    cascaderRef.current?.reloadSpace();
  };

  // 展示层级中文名：便于 Tag / 占位符展示
  const LEVEL_META = [
    { key: 'spaceName',            idIdx: 0, label: '空间',       color: 'blue' },
    { key: 'workItemName',         idIdx: 1, label: '工作项',     color: 'cyan' },
    { key: 'workItemEntityName',   idIdx: 2, label: '工作项实例', color: 'geekblue' },
    { key: 'nodeName',             idIdx: 3, label: '节点',       color: 'purple' },
    { key: 'taskName',             idIdx: 4, label: '任务',       color: 'magenta' },
  ];
  const hasAny = ids.some(Boolean);

  return (
    <div style={{ padding: 24, background: '#f5f7fa', minHeight: '100%' }}>
      <Card
        title="五级级联选择器演示"
        variant="borderless"
        // maxWidth 限制读可读宽度 + margin: 0 auto 实现水平居中，
        // 任意屏幕宽度下内容始终跟随视口居中展示
        style={{ maxWidth: 880, margin: '0 auto' }}
        styles={{ body: { paddingTop: 16 } }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <div style={{ marginBottom: 8, color: '#666', fontSize: 13 }}>
              选择路径：空间 → 工作项 → 工作项实例 → 节点 → 任务
            </div>
            <SpaceCascader
              ref={cascaderRef}
              style={{ width: 420 }}
              onChange={handleCascaderChange}
            />
          </div>

          <Space>
            <Button size="small" onClick={handleReset}>重置</Button>
            <Button size="small" onClick={handleReload}>重新加载空间</Button>
          </Space>

          <Descriptions
            column={1}
            size="small"
            title={(
              <span style={{ fontSize: 14 }}>
                当前选择结果
                {!hasAny && (
                  <span style={{ marginLeft: 8, color: '#bbb', fontWeight: 'normal', fontSize: 12 }}>
                    （暂未选择）
                  </span>
                )}
              </span>
            )}
            bordered
            labelStyle={{ width: 110, background: '#fafafa' }}
            contentStyle={{ background: '#fff' }}
          >
            {LEVEL_META.map(({ key, idIdx, label, color }) => {
              const name = names[key];
              const id = ids[idIdx];
              return (
                <Descriptions.Item key={key} label={label}>
                  {name ? <Tag color={color}>{name}</Tag> : <span style={{ color: '#ccc' }}>-</span>}
                  <span style={{ marginLeft: 8, color: '#999', fontSize: 12 }}>
                    id: {id || '-'}
                  </span>
                </Descriptions.Item>
              );
            })}
          </Descriptions>
        </Space>
      </Card>
    </div>
  );
}
