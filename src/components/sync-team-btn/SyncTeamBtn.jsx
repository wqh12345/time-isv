import React, { useState } from 'react'
import { Tooltip, message } from 'antd'
import { ReloadOutlined, LoadingOutlined, InfoCircleFilled } from '@ant-design/icons'
import { postTeamRefreshAll } from '../../api/api'

/**
 * 同步成员/团队 按钮组件
 * - 独立 loading 状态，不影响外部
 * - 带说明 Tooltip
 * @param {Object}   props
 * @param {Function} props.onSuccess  同步成功回调
 * @param {Function} props.onError    同步失败回调
 * @param {Object}   props.style      外层容器额外样式
 * @param {String}   props.className  外层容器额外类名
 * @param {Boolean}  props.showTip    是否显示右侧信息 Tooltip，默认 true
 */
const SyncTeamBtn = ({ onSuccess, onError, style, className, showTip = true, msgRight = false }) => {
  const [syncLoading, setSyncLoading] = useState(false)

  const handleSync = async () => {
    if (syncLoading) return
    setSyncLoading(true)
    try {
      const res = await postTeamRefreshAll()
      if (res?.code === 200) {
        message.success('同步成功')
        onSuccess?.(res)
      } else {
        message.error('同步失败')
        onError?.(res)
      }
    } catch (e) {
      console.error('同步失败:', e)
      onError?.(e)
    } finally {
      setSyncLoading(false)
    }
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', ...style }} className={className}>
      <div
        style={{
          color: '#4247f6',
          fontSize: 13,
          cursor: syncLoading ? 'not-allowed' : 'pointer',
          opacity: syncLoading ? 0.6 : 1,
          pointerEvents: syncLoading ? 'none' : 'auto',
          display: 'inline-flex',
          alignItems: 'center',
        }}
        onClick={handleSync}
      >
        {syncLoading
          ? <LoadingOutlined style={{ marginRight: msgRight ? 8 : 10, fontSize: 15, color: '#4247f6' }} spin />
          : <ReloadOutlined style={{ marginRight: msgRight ? 8 : 10, fontSize: 15, color: '#4247f6' }} />}
        {syncLoading ? '同步中...' : '同步成员/团队'}
      </div>
      {showTip && (
        <Tooltip
          title={
            <div>
              <div>1. 成员和团队数据支持自动同步和手动同步。系统每天凌晨自动全量同步；从飞书项目内进入应用时，自动同步当前空间数据。可点击「同步成员/团队」手动同步最新全量数据。</div>
              <div>2. 组织架构下的部门或成员，实时更新。</div>
            </div>
          }
        >
          <InfoCircleFilled style={{ color: '#BBBBBB', fontSize: 14, marginLeft: 6, cursor: 'pointer' }} />
        </Tooltip>
      )}
    </div>
  )
}

export default SyncTeamBtn
