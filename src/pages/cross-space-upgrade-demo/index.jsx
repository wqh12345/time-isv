import React, { useState } from 'react'
import { Button, Card, Radio, Space, Descriptions, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import CrossSpaceUpgradeModal from '../../components/CrossSpaceUpgradeModal'
import { postGuideDisplayed } from '../../api/api'
import JSSDK from '../../jssdk-adapter'

/**
 * CrossSpaceUpgradeModal 演示页
 * - 可切换 admin / user 两种角色，验证：
 *   - admin：展示已安装工时插件的空间列表、不可关闭
 *   - user ：仅展示功能介绍卡片、可点击右上角 × 关闭
 * - "开始体验"按钮调用与引导页"开始使用"按钮完全一致的接口和处理逻辑：
 *   postGuideDisplayed → Toast → 跳转到 /resource
 */
export default function CrossSpaceUpgradeModalDemo() {
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)
  const [role, setRole] = useState('admin')
  const [lastAction, setLastAction] = useState('')

  const handleOpen = () => {
    setVisible(true)
    setLastAction('打开弹窗')
  }

  const handleClose = () => {
    setVisible(false)
    setLastAction('关闭弹窗（onClose）')
  }

  // 与 welcome 页 handleStartUse 完全一致的处理逻辑
  const handleStart = async () => {
    try {
      await postGuideDisplayed()
      // JSSDK.toast.success('配置完成，即将开始使用')
      setVisible(false)
      setLastAction('点击开始体验：postGuideDisplayed 成功，跳转 /resource')
      setTimeout(() => {
        navigate('/resource', { replace: true })
      }, 500)
    } catch (e) {
      console.error('标记引导页已展示失败:', e)
      message.error('标记引导页已展示失败')
      setLastAction('点击开始体验：postGuideDisplayed 失败')
    }
  }

  return (
    <div style={{ padding: 24, background: '#f5f7fa', minHeight: '100%' }}>
      <Card title="CrossSpaceUpgradeModal 演示" bordered={false}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <span style={{ marginRight: 12, fontWeight: 500 }}>角色：</span>
            <Radio.Group
              value={role}
              onChange={(e) => setRole(e.target.value)}
              optionType="button"
              buttonStyle="solid"
              options={[
                { label: '管理员 admin', value: 'admin' },
                { label: '普通用户 user', value: 'user' },
              ]}
            />
          </div>

          <Space>
            <Button type="primary" onClick={handleOpen}>
              打开弹窗
            </Button>
            <Button onClick={handleClose} disabled={!visible}>
              手动关闭
            </Button>
          </Space>

          <Descriptions
            size="small"
            column={1}
            bordered
            labelStyle={{ width: 120 }}
          >
            <Descriptions.Item label="当前角色">{role}</Descriptions.Item>
            <Descriptions.Item label="弹窗状态">{visible ? '打开中' : '已关闭'}</Descriptions.Item>
            <Descriptions.Item label="最近动作">{lastAction || '-'}</Descriptions.Item>
            <Descriptions.Item label="交互说明">
              admin：无关闭按钮、展示已安装空间列表；user：右上角可关闭、仅展示功能介绍。
              "开始体验"按钮调用 postGuideDisplayed 接口，成功后跳转 /resource。
            </Descriptions.Item>
          </Descriptions>
        </Space>
      </Card>

      <CrossSpaceUpgradeModal
        visible={visible}
        role={role}
        onClose={handleClose}
        onStart={handleStart}
      />
    </div>
  )
}
