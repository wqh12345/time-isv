import React, { useState, useEffect, useRef } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Tabs, Button, Dropdown, Spin, App } from 'antd'
import {
  QuestionOutlined,
  ReadOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { getUrlState } from '../util/util'
import {
  hasToken,
  hasAdminPermission,
  initAuthWithH5SDK,
  initAuthWithCode,
  redirectToFeishuAuth,
  clearAuthCodeFromUrl,
} from '../config/auth'
import { getUserRoleInfo } from '../api/api'
import TopAlert from '../components/top-alert/TopAlert'
import CustInfoModal from '../components/cust-info-modal/CustInfoModal'
import ExpirationModal from '../components/expiration-modal/ExpirationModal'
import PublicModal from '../components/public-modal/PublicModal'
import JSSDK, { initJSSDK } from '../jssdk-adapter'
import './MainLayout.less'

export default function MainLayout() {
  const appId = import.meta.env.VITE_API_ID
  const { message: antdMessage } = App.useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [hasAuth, setHasAuth] = useState(false)
  const [isShow, setIsShow] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [userRole, setUserRole] = useState('')
  const hasInitializedRef = useRef(false)
  
  // 用户安装状态（路由跳转与弹窗队列的唯一依据）
  const [installState, setInstallState] = useState({
    install: false,
    workHourPluginInstalled: false,
    resolved: false,
  })

  // 弹窗队列控制
  // flowQueueRef: 当前场景下按优先级排好序的弹窗步骤数组
  // flowIndex:    当前执行到队列的第几步（-1 表示尚未开始）
  const flowQueueRef = useRef([])
  const [flowIndex, setFlowIndex] = useState(-1)
  const [showExpirationModal, setShowExpirationModal] = useState(false)
  const [showCustInfoModal, setShowCustInfoModal] = useState(false)
  const [showPublicModal, setShowPublicModal] = useState(false)

  // ExpirationModal 内部状态，用于知道它是否应该显示
  const [expirationShouldShow, setExpirationShouldShow] = useState(null) // null=pending, true/false=已确定

  // 初始化 JSSDK 的 message 实例
  useEffect(() => {
    initJSSDK(antdMessage)
  }, [antdMessage])

  const currentTab = location.pathname.replace('/', '') || 'resource'
  const isAdminPage = currentTab === 'admin' || location.pathname.startsWith('/admin')
  const isTaskPage = currentTab === 'task'
  const pageKey = currentTab.split('/')[0] || 'resource'
  const needsSpecialMargin = isAdminPage
  const pageWarpClassName = [
    'page-warp',
    needsSpecialMargin ? 'page-warp-with-margin' : '',
    pageKey ? `page-warp-${pageKey}` : '',
  ].filter(Boolean).join(' ')

  useEffect(() => {
    if (hasInitializedRef.current) return
    if (isInitializing) return
    hasInitializedRef.current = true
    initApp()
  }, [])

  /**
   * 调用 getUserRoleInfo 获取用户角色，更新 userRole 状态
   * 只负责保存安装状态；引导/弹窗展示完全基于 install + workHourPluginInstalled 实时判断
   */
  const fetchUserRole = async () => {
    try {
      const res = await getUserRoleInfo()
      const role = res?.data?.userRole || 'app_admin'
      const appMode = res?.data?.mode || 'space'
      const install = res?.data?.install ?? false
      const workHourPluginInstalled = res?.data?.workHourPluginInstalled ?? false
      //const workHourPluginInstalled = false
      localStorage.setItem("meegoTeamworkAppMode", appMode)
      localStorage.setItem('meegoTeamworkUserRole', role)
      setUserRole(role)

      // 仅保存这两个状态，作为路由跳转与弹窗队列的唯一依据
      setInstallState({
        install,
        workHourPluginInstalled,
        resolved: true,
      })

    } catch (e) {
      console.error('获取用户角色失败:', e)
      setInstallState((previous) => ({ ...previous, resolved: true }))
    }
  }

  /**
   * 授权成功回调
   */
  const onAuthSuccess = () => {
    try { clearAuthCodeFromUrl() } catch (e) { /* ignore */ }
    sessionStorage.removeItem('_authRedirectRetry')
    navigate(isTaskPage ? '/task' : '/resource', { replace: true })
    setHasAuth(true)
    setIsShow(true)
    fetchUserRole()
  }

  /**
   * 授权失败回调
   */
  const onAuthFail = (error) => {
    console.error('授权失败:', error)
    try { clearAuthCodeFromUrl() } catch (e) { /* ignore */ }

    const retryKey = '_authRedirectRetry'
    const retryCount = parseInt(sessionStorage.getItem(retryKey) || '0', 10)
    if (retryCount >= 2) {
      sessionStorage.removeItem(retryKey)
      antdMessage.error('授权失败，请稍后刷新页面重试')
      setIsShow(true)
      return
    }
    sessionStorage.setItem(retryKey, String(retryCount + 1))
    redirectToFeishuAuth(appId, isTaskPage ? '/task' : '/resource')
  }

  const initApp = async () => {
    if (isInitializing) return
    try {
      setIsInitializing(true)

      const store = getUrlState()
      if (store?.code) {
        await initAuthWithCode({
          code: store.code,
          state: store.state,
          onSuccess: onAuthSuccess,
          onFail: onAuthFail,
        })
        return
      }

      if (!window.h5sdk) {
        if (!hasToken()) {
          redirectToFeishuAuth(appId)
          return
        }
      } else {
        if (!hasToken()) {
          initAuthWithH5SDK({
            appId,
            onSuccess: onAuthSuccess,
            onFail: onAuthFail,
          })
          return
        }
      }
      await checkedHasAuth()
      setIsShow(true)

    } catch (error) {
      console.error('initApp error:', error)
      setIsShow(true)
      setHasAuth(true)
    } finally {
      setIsInitializing(false)
    }
  }

  const checkedHasAuth = async () => {
    setHasAuth(true)
    setIsShow(true)
    await fetchUserRole()
  }

  const onTabChange = (key) => {
    if (sessionStorage.getItem('approvalInfo')) {
      sessionStorage.removeItem('approvalInfo')
    }
    if (sessionStorage.getItem('jumpPayUuid')) {
      sessionStorage.removeItem('jumpPayUuid')
    }
    navigate(`/${key}`)
  }

  const isAdminRole = userRole === 'app_admin' || userRole === 'space_admin'

  const tabItems = [
    { label: '资源管理', key: 'resource' },
    { label: '工时日志', key: 'log' },
    { label: '工时审批', key: 'approval' },
    { label: '工时管理', key: 'management' },
    ...(isAdminRole ? [{ label: '系统设置', key: 'admin' }] : []),
    ...(sessionStorage.getItem('jwtMeegoTeamworkUserRole') === 'Admin'
      ? [{ label: '插件设置', key: 'setting' }]
      : []),
    { label: '方案中心', key: 'pay' },
  ]

  const helpItems = [
    {
      key: '1',
      icon: <ReadOutlined />,
      label: <a onClick={() => JSSDK.navigation.open('https://ldkj.feishu.cn/docx/VkRid1jaqo4q1OxhSntc2wCcnXm', '_blank')}>操作手册</a>,
    },
    {
      key: '2',
      icon: <TeamOutlined />,
      label: <a onClick={() => JSSDK.navigation.open('https://applink.feishu.cn/client/chat/chatter/add_by_link?link_token=ea0o6fce-ecc0-4fa7-9651-4484a7ff8f0f', '_blank')}>我要咨询</a>,
    },
  ]

  // ============ 路由跳转与弹窗队列控制逻辑 ============
  //
  // 判断完全基于 install + workHourPluginInstalled 两个实时状态，不再依赖 guideDisplayed。
  //
  // 场景1（已装应用、未装工时插件）：进入飞书任务工时系统，不展示任何弹窗。
  // 场景2（已装应用、已装工时插件）：留在首页，按优先级展示弹窗：
  //   expiration（权益）→ custInfo（留资）→ public（公告）
  //
  // 队列步骤标识：'expiration' | 'custInfo' | 'public'

  // 执行队列中指定下标的步骤
  const runFlowStep = (index) => {
    const queue = flowQueueRef.current
    if (!queue || index < 0 || index >= queue.length) return
    const step = queue[index]
    switch (step) {
      case 'expiration':
        setShowExpirationModal(true)
        break
      case 'custInfo':
        setShowCustInfoModal(true)
        break
      case 'public':
        setShowPublicModal(true)
        break
      default:
        break
    }
  }

  // 推进到下一步（统一出口，供各弹窗完成回调调用）
  const goNextFlowStep = () => {
    setFlowIndex((prev) => {
      const next = prev + 1
      runFlowStep(next)
      return next
    })
  }

  // 拿到 installState 后，按场景决定跳转或启动弹窗队列
  useEffect(() => {
    if (!hasAuth) return
    // 未完成登录授权（无 token）时不执行任何弹窗逻辑
    if (!hasToken()) return
    const { install, workHourPluginInstalled, resolved } = installState
    if (!resolved) return

    if (!install) {
      // 未安装应用：不展示任何弹窗
      flowQueueRef.current = []
      setFlowIndex(0)
      return
    }
    if (!workHourPluginInstalled) {
      // 场景1：已装应用、未装工时插件 → 进入飞书任务工时系统，跳过所有弹窗
      flowQueueRef.current = []
      setFlowIndex(0)
      if (!isTaskPage) {
        navigate('/task', { replace: true })
      }
      return
    }

    // 已安装飞书项目工时插件的用户始终进入原有系统
    if (isTaskPage) {
      navigate('/resource', { replace: true })
      return
    }

    // 场景2：已装应用 + 已装工时插件 → 启动弹窗队列：权益 → 留资 → 公告
    flowQueueRef.current = ['expiration', 'custInfo', 'public']
    setFlowIndex(0)
    runFlowStep(0)
  }, [installState, hasAuth, isTaskPage, navigate])

  // ============ 弹窗完成回调 ============

  const handleExpirationComplete = () => {
    setShowExpirationModal(false)
    goNextFlowStep()
  }

  const handleCustInfoComplete = () => {
    setShowCustInfoModal(false)
    goNextFlowStep()
  }

  // PublicModal 内部接口无公告数据时也会自动回调，不会卡队列
  const handlePublicComplete = () => {
    setShowPublicModal(false)
    goNextFlowStep()
  }

  if (!isShow) {
    return <Spin style={{ width: '100%', marginTop: '20%' }} />
  }

  if (!hasAuth) {
    return <div className="page-warp" style={{ background: '#fff' }} />
  }

  if (!installState.resolved) {
    return <Spin style={{ width: '100%', marginTop: '20%' }} />
  }

  return (
    <div className={pageWarpClassName}>
      {!isTaskPage && <TopAlert />}
      
      {/* 权益弹窗 (最高优先级) */}
      {showExpirationModal && (
        <ExpirationModal
          onVisibleChange={(visible) => {
            if (expirationShouldShow === null) {
              setExpirationShouldShow(visible);
            }
          }}
          suppress={false}
          onComplete={handleExpirationComplete}
        />
      )}

      {/* 留资弹窗 */}
      {showCustInfoModal && (
        <CustInfoModal
          isShowPublicModal={() => {}}
          onComplete={handleCustInfoComplete}
        />
      )}

      {/* 公告弹窗（优先级最低，队列末尾） */}
      {showPublicModal && (
        <PublicModal onComplete={handlePublicComplete} />
      )}

      {!isTaskPage && (
        <Tabs
          className="page-tabs"
          centered={true}
          activeKey={currentTab}
          defaultActiveKey="resource"
          items={tabItems}
          onChange={onTabChange}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            background: '#fff',
            padding: '10px',
          }}
          tabBarExtraContent={
            <Dropdown menu={{ items: helpItems }} placement="bottomRight" arrow>
              <Button className="help-icon" type="primary" shape="circle" icon={<QuestionOutlined />} />
            </Dropdown>
          }
        />
      )}
      <div className="page-content">
        <Outlet />
      </div>
    </div>
  )
}
