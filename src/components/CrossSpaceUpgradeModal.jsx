import React, { useEffect, useState } from 'react'
import { Modal, Button, Spin, Empty } from 'antd'
import { CloseOutlined } from '@ant-design/icons'
import { getInstallList, postGuideDisplayed } from '../api/api'
import iconRegister from '../assets/isv/组 73085.png'
import iconApproval from '../assets/isv/组 73086.png'
import iconData from '../assets/isv/组 73086(1).png'
import iconTenant from '../assets/isv/组 73086(2).png'
import iconTitle from '../assets/isv/image.png'
import './CrossSpaceUpgradeModal.less'

const FEATURE_ICON_MAP = {
  register:  iconApproval,
  approval: iconData,
  data:  iconTenant,
  tenant:  iconRegister,
}

const FEATURES = [
  { key: 'register', title: '跨空间工时登记', desc: '在一个页面登记多个空间的工时，无需切换空间' },
  { key: 'approval', title: '跨空间工时审批', desc: '所有空间的工时审批统一管理，无需切换空间' },
  { key: 'data', title: '跨空间数据查看', desc: '所有空间的工时数据统一查看，全局数据一目了然' },
  { key: 'tenant', title: '租户管理模式', desc: '基于租户维度管理成员，多空间场景下更严谨的工时管理' },
]

/**
 * 跨空间升级引导弹窗
 * - role === 'admin'：展示已安装工时插件的空间列表，禁止关闭
 * - role === 'user' ：仅展示能力介绍，可关闭
 */
export default function CrossSpaceUpgradeModal(props) {
  const { visible, onClose, onStart, role = 'user' } = props
  const isAdmin = role === 'admin'

  const [spaces, setSpaces] = useState([])
  const [loadingSpaces, setLoadingSpaces] = useState(false)
  const [closing, setClosing] = useState(false)

  // 仅管理员需要加载空间列表，弹窗打开时拉取
  useEffect(() => {
    if (!visible || !isAdmin) return
    let aborted = false
    const fetchSpaces = async () => {
      try {
        setLoadingSpaces(true)
        const res = await getInstallList()
        if (aborted) return
        if (res?.code === 200 && Array.isArray(res.data)) {
          setSpaces(res.data)
        } else {
          setSpaces([])
        }
      } catch (e) {
        console.error('获取已安装空间列表失败:', e)
        if (!aborted) setSpaces([])
      } finally {
        if (!aborted) setLoadingSpaces(false)
      }
    }
    fetchSpaces()
    return () => { aborted = true }
  }, [visible, isAdmin])

  const handleStart = async () => {
    // 开始体验时调用 postGuideDisplayed 标记引导已展示
    if (closing) return
    setClosing(true)
    try {
      await postGuideDisplayed()
    } catch (e) {
      console.error('标记引导页已展示失败:', e)
    } finally {
      setClosing(false)
      onStart?.()
    }
  }

  const handleClose = async () => {
    // 关闭时也调用 postGuideDisplayed，跟开始体验保持一致
    if (closing) return
    setClosing(true)
    try {
      await postGuideDisplayed()
    } catch (e) {
      console.error('标记引导页已展示失败:', e)
    } finally {
      setClosing(false)
      onClose?.()
    }
  }

  return (
    <Modal
      open={visible}
      onCancel={handleClose}
      footer={null}
      closable={true}
      maskClosable={false}
      keyboard={false}
      confirmLoading={closing}
      width={isAdmin ? 720 : 720}
      centered
      className={`cross-space-upgrade-modal ${isAdmin ? 'is-admin' : 'is-user'}`}
    >
      <div className="cs-modal-header">
        <div className="cs-modal-title">
          <img className="cs-modal-title-icon" src={iconTitle} alt="" />
          升级工时资源管理，开启跨空间管理新体验
        </div>
      </div>

      <div className="cs-modal-subtitle">「当前飞书应用为限时体验版」</div>

      <div className="cs-feature-grid">
        {FEATURES.map((it) => (
          <div key={it.key} className="cs-feature-card">
            <img className="cs-feature-icon" src={FEATURE_ICON_MAP[it.key]} alt="" />
            <div className="cs-feature-text">
              <div className="cs-feature-title">{it.title}</div>
              <div className="cs-feature-desc">{it.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {isAdmin && (
        <div className="cs-install-box">
          <div className="cs-install-header">
            已安装工时插件的空间 <span className="cs-install-count">（{spaces.length}个）</span>
          </div>
          <div className="cs-install-list">
            {loadingSpaces ? (
              <div className="cs-install-loading">
                <Spin size="small" />
              </div>
            ) : spaces.length > 0 ? (
              spaces.map((space, index) => (
                <div key={space.value || index} className="cs-install-item">
                  <span className="cs-install-item-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="cs-install-item-name">{space.level || space.label || space.name}</span>
                </div>
              ))
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无已安装工时插件的空间"
                style={{ padding: '20px 0' }}
              />
            )}
          </div>
        </div>
      )}

      <div className="cs-modal-footer">
        <Button type="primary" className="cs-start-btn" onClick={handleStart}>
          开始体验
        </Button>
      </div>
    </Modal>
  )
}
