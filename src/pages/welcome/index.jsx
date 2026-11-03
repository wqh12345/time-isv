import React, { useEffect, useRef, useState } from 'react'
import { Empty, Spin, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { hasToken, redirectToFeishuAuth, setToken, setUserRole, setAppMode, getToken, resetAuthRetryCount } from '../../config/auth'
import { getUserRoleInfo } from '../../api/api'
import JSSDK from '../../jssdk-adapter'
// 本地图片资源（统一使用 @2x 二倍图）
import heroBannerIcon from '../../assets/weicome/组 181@2x.png'
import bgDecoration from '../../assets/weicome/组 73124@2x.png'
import linkIcon from '../../assets/weicome/链接 (1)@2x.png'
import emptyIcon from '../../assets/weicome/暂无 (1)@2x.png'
import welcomeIllust from '../../assets/isv/image@2x.png'
import './index.less'

// 背景装饰：使用本地图片
const WelcomeBackground = () => (
  <img className="welcome-bg-curves" src={bgDecoration} alt="" aria-hidden />
)

// HeroBanner 图标
const HeroBannerIcon = () => (
  <img src={heroBannerIcon} alt="" className="welcome-hero-banner-img" />
)

// 空状态
const WelcomeEmpty = ({ description }) => (
  <Empty
    image={emptyIcon}
    imageStyle={{ height: 48 }}
    description={description}
    style={{ padding: '16px 0' }}
  />
)

export default function WelcomePage() {
  const appId = import.meta.env.VITE_API_ID
  const navigate = useNavigate()
  const [checking, setChecking] = useState(false)
  const checkedOnceRef = useRef(false)

  // 未完成登录授权（本地无 token）时不停留在欢迎页，直接跳转飞书授权
  useEffect(() => {
    if (!hasToken()) {
      redirectToFeishuAuth(appId)
    }
  }, [])

  /**
   * 检查插件安装状态：先调用 refresh 接口刷新 token，再用新 token 调用 getUserRoleInfo，
   * 已安装应用时，根据 workHourPluginInstalled 进入对应的工时系统。
   */
  const checkInstallAndRedirect = async () => {
    if (checking) return false
    setChecking(true)
    try {
      // 1. 先调用 refresh 接口刷新 token：
      //    注意：axios 会被项目的全局响应拦截器解包，成功时返回 { result:true, code, data:{...} }，失败返回 false。
      const baseURL = import.meta.env.VITE_API_BASE_URL
      const currentToken = getToken()
      try {
        const tokenRes = await axios.get(`${baseURL}notAuth/token/refresh`, {
          headers: { Authorization: currentToken },
        })
        // 响应已被拦截器解包：tokenRes = { code, data, result }，其中 data 可能是字符串 token 或 { accessToken, userRole, mode, ... }
        const payloadData = tokenRes?.data
        const newToken =
          (typeof payloadData === 'string' ? payloadData : payloadData?.accessToken) || ''
        if (newToken) {
          // 更新全局 token localStorage（请求拦截器每次从 localStorage 读取，后续请求自动使用新 token）
          setToken(newToken)
          // 同步更新所有关联缓存（与 initAuthWithCode/initAuthWithH5SDK 保持一致）
          if (payloadData?.userRole) setUserRole(payloadData.userRole)
          if (payloadData?.mode) setAppMode(payloadData.mode)
          if (payloadData?.tenantUser) {
            localStorage.setItem('feishuUserInfo', JSON.stringify(payloadData.tenantUser))
          }
          if (payloadData?.userAccessToken) {
            localStorage.setItem('feishuToken', payloadData.userAccessToken || '')
          }
          // 重置 401 重试计数，避免历史重试计数影响后续请求
          resetAuthRetryCount()
        }
      } catch (e) {
        console.warn('刷新 token 失败，将使用现有 token 继续:', e)
      }

      // 2. 使用 refresh 后的新 token 调用 getUserRoleInfo（get 封装每次都从 localStorage 读取最新 token）
      const res = await getUserRoleInfo()
      const info = res?.data || {}
      const install = info.install === true
      const workHourPluginInstalled = info.workHourPluginInstalled === true

      // 3. 已安装飞书项目工时插件时进入原有系统
      if (install && workHourPluginInstalled) {
        navigate('/resource', { replace: true })
        return true
      }
      // 4. 未安装飞书项目工时插件时进入飞书任务工时系统
      if (install) {
        navigate('/task', { replace: true })
        return true
      }
      return false
    } catch (e) {
      console.error('检查安装状态失败:', e)
      return false
    } finally {
      setChecking(false)
    }
  }

  // 浏览器进入/刷新 welcome 页时自动检查一次：
  // refresh token 后根据插件安装状态进入对应系统（不做浏览器硬刷新）
  useEffect(() => {
    if (!hasToken() || checkedOnceRef.current) return
    checkedOnceRef.current = true
    checkInstallAndRedirect()
  }, [])

  // 从 localStorage 获取 MainLayout 已存储的用户角色
  const userRole = localStorage.getItem('meegoTeamworkUserRole') || ''
  // 仅 app_admin 按管理员处理，其他角色按非管理员逻辑处理
  const isAdmin = userRole === 'app_admin'

  return (
    <div className="welcome-page">
      <WelcomeBackground />
      <div className="welcome-container">
        {/* 欢迎卡片 */}
        <section className="welcome-card welcome-hero">
          <div className="welcome-hero-head">
            <h1 className="welcome-hero-title">欢迎使用工时资源管理</h1>
            <span className="welcome-hero-tag">「当前飞书应用为限时体验版」</span>
          </div>
          <p className="welcome-hero-desc">初次使用前，需要您完成一些基础配置，以供您更好的体验产品</p>

          <div className="welcome-hero-banner">
            <div className="welcome-hero-banner-icon">
              <HeroBannerIcon />
            </div>
            <div className="welcome-hero-banner-text">
              <div className="welcome-hero-banner-title">精准统计工时，高效管理项目成本</div>
              <div className="welcome-hero-banner-sub">
                一款高效的人效管理工具，帮助您轻松记录工时、优化资源配置、提升团队协作效率。
              </div>
            </div>
          </div>
        </section>

        {isAdmin && (
          <>
            {/* 已安装空间列表 */}
            <section className="welcome-card welcome-install-section">
              <div className="welcome-install-header">
                <div className="welcome-install-title">
                  {/* <span className="welcome-step-num">1</span> */}
                  项目设置
                </div>
              </div>
              <p className="welcome-install-desc">
                工时数据需从飞书项目 (Meeegle) 中获取。在使用ISV工时应用前，您需要先在飞书项目中安装工时插件，完成数据同步配置。
              </p>

              <div className="welcome-install-list-box">
                <div className="welcome-install-list-label">
                  <span>已安装工时插件的空间（0个）</span>
                </div>
                <div className="welcome-install-list">
                  <div className="welcome-install-empty">
                    <WelcomeEmpty description="暂无已安装工时插件的空间,请先在飞书项目中安装" />
                  </div>
                </div>
              </div>

              <div className="welcome-install-help">
                <div className="welcome-install-help-title">如何安装工时插件?</div>
                <div className="welcome-install-help-text">
                  请在飞书项目中安装工时插件，具体操作请参考
                  <a
                    href="https://ldkj.feishu.cn/wiki/TJmMwxorTigjqxkVh8XcmOOqngc"
                    target="_blank"
                    rel="noreferrer noopener"
                  > <img src={linkIcon} alt="ldkj" className="welcome-manual-link-icon" /> 工时资源管理安装手册 </a>
                  ，如需帮助，请
                  <a
                    href="https://applink.feishu.cn/client/chat/chatter/add_by_link?link_token=0b1k67e9-edeb-44cb-a232-db5b3217131f"
                    target="_blank"
                    rel="noreferrer noopener"
                  > 联系我们</a>
                </div>
                <div className="welcome-install-help-text" style={{ marginTop: 8 }}>
                  若已完成安装，可点击
                  <a
                    href="#"
                    onClick={async (e) => {
                      e.preventDefault()
                      const ok = await checkInstallAndRedirect()
                      if (!ok) {
                        // 仍未就绪，执行普通页面刷新让用户看到最新状态
                        window.location.reload()
                      }
                    }}
                    style={{ margin: '0 4px' }}
                  > 刷新页面 </a>
                  进入首页
                </div>
              </div>
            </section>
          </>
        )}

        {!isAdmin && (
          /* 非管理员提示 */
          <section className="welcome-card welcome-waiting">
            <div className="welcome-waiting-head">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="10" cy="10" r="9" fill="#ffc107" />
                <path
                  d="M10 4.5v5M10 11.5v1.25"
                  stroke="#fff"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
              <span className="welcome-waiting-title">等待管理员完成配置</span>
            </div>
            <p className="welcome-waiting-desc">
              在使用工时功能前，需要管理员完成相关配置。您也可以联系管理员打开应用，完成配置。完成配置后您即可开始使用。
            </p>

            <div className="welcome-waiting-links">
              <div className="welcome-waiting-link-row">
                <span className="welcome-waiting-link-desc">您可以先查看产品介绍，了解产品功能和使用场景</span>
                <a
                  className="welcome-waiting-link"
                  href="https://ldkj.feishu.cn/wiki/B4krwZh59i1fRJk6vNNc94cPnPc"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <img src={linkIcon} alt="" className="welcome-waiting-link-icon" />
                  工时资源管理产品介绍
                </a>
              </div>
              <div className="welcome-waiting-link-row">
                <span className="welcome-waiting-link-desc">您可以让管理员查阅安装手册，快速完成工时配置</span>
                <a
                  className="welcome-waiting-link"
                  href="https://ldkj.feishu.cn/wiki/TJmMwxorTigjqxkVh8XcmOOqngc"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <img src={linkIcon} alt="" className="welcome-waiting-link-icon" />
                  工时资源管理安装手册
                </a>
              </div>
              <div className="welcome-waiting-link-row">
                <span className="welcome-waiting-link-desc">若需进一步帮助，可联系我们获取支持</span>
                <a
                  className="welcome-waiting-link"
                  href="https://applink.feishu.cn/client/chat/chatter/add_by_link?link_token=0b1k67e9-edeb-44cb-a232-db5b3217131f"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <img src={linkIcon} alt="" className="welcome-waiting-link-icon" />
                  联系我们
                </a>
              </div>
              <div className="welcome-waiting-link-row">
                <span className="welcome-waiting-link-desc">若已完成安装，可点击右侧按钮进入首页</span>
                <a
                  className="welcome-waiting-link "
                  href="#"
                  onClick={async (e) => {
                    e.preventDefault()
                    if (checking) return
                    const ok = await checkInstallAndRedirect()
                    if (!ok) {
                      window.location.reload()
                    }
                  }}
                >
                  {checking ? '检查中...' : '刷新页面'}
                </a>
              </div>
            </div>

            <div className="welcome-waiting-illust">
              <img
                src={welcomeIllust}
                alt="等待配置"
                className="welcome-illust"
              />
            </div>
          </section>
        )}
      </div>


    </div>
  )
}
