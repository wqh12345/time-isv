/**
 * 授权核心模块
 * 统一管理 Token 存储、初始化授权流程、Token 刷新与重试队列
 */

import axios from 'axios'
import JSSDK from '../jssdk-adapter'

// ===================== Token 存储管理 =====================

const PLUGIN_ID = import.meta.env.VITE_PLUGIN_ID
const TOKEN_KEY = `${PLUGIN_ID}-meegoTeamworkToken`
const AUTH_RETRY_KEY = '_authRetryCount'
const MAX_AUTH_RETRY = 2

// ===================== 用户角色 & 模式存储管理 =====================

const USER_ROLE_KEY = 'meegoTeamworkUserRole'
const APP_MODE_KEY = 'meegoTeamworkAppMode'

/** 读取用户角色： app_admin | space_admin | member */
export function getUserRole() {
  return localStorage.getItem(USER_ROLE_KEY) || 'app_admin'
}

/** 设置用户角色 */
export function setUserRole(role) {
  if (role) localStorage.setItem(USER_ROLE_KEY, role)
  else localStorage.removeItem(USER_ROLE_KEY)
}

/** 读取应用模式： space | tenant */
export function getAppMode() {
  return localStorage.getItem(APP_MODE_KEY) || ''
}

/** 设置应用模式 */
export function setAppMode(mode) {
  if (mode) localStorage.setItem(APP_MODE_KEY, mode)
  else localStorage.removeItem(APP_MODE_KEY)
}

/** 是否有管理后台权限（app_admin 或 space_admin） */
export function hasAdminPermission() {
  console.log('hasAdminPermission66666:', getUserRole())
  const role = getUserRole()
  return role === 'app_admin' || role === 'space_admin'
}

// ===================== ISV 模式判断 =====================

/**
 * 是否处于 ISV 模式（运行时判断）
 *
 * 判定来源：用户在「模式设置」选择的应用模式 getAppMode()
 *   - 'tenant'  => ISV 模式（走 isv/ 前缀接口）
 *   - 'space'   => 非 ISV，走老接口
 *   - 其它/空   => 非 ISV
 *
 * 模式由「模式设置」页保存到 localStorage（key: meegoTeamworkAppMode），
 * 也会被 URL ?mode=xxx 同步更新，因此切换后立即生效，无需重启/打包。
 */
export function isISV() {
  return getAppMode() === 'tenant'
}

// 默认 Token（开发调试用，生产环境会被正常授权流程覆盖）
const DEFAULT_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJyZWZyZXNoX3Rva2VuIjoiYzFlOTBlMGQtZmQ5ZC00YWQwLWEyZjEtMzJkYzI0MjFjMmYzIiwicHJvamVjdF9rZXkiOiI2Nzg0NmQ2NjVjN2JhZTc5MDUyZTdmZmQiLCJ1c2VyX2tleSI6Ijc0ODUxODE3NTQyMTk2OTIwMzMiLCJ1c2VyX3Rva2VuIjoidS0zMGIwODYzMS04MTkyLTQ2ZmMtOWQ5OS0xMzAwNjg5ZWI0N2IiLCJlbnYiOiJ0ZXN0IiwiZXhwIjoxNzc5NzY4NTY5LCJzYWFzX3RlbmFudF9rZXkiOiJzYWFzXzViZmMxNjFjLWYwMTYtNDQ5OS1hMTc2LTJjMzFjN2U5MDRhYiJ9.OXFYCvQFlljs3_HXJVLVEDjjc-bZ9focgrql4HcRuM8'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) 
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export function hasToken() {
  return !!getToken()
}

// ===================== 重试计数（防死循环） =====================

function getAuthRetryCount() {
  return parseInt(sessionStorage.getItem(AUTH_RETRY_KEY) || '0', 10)
}

function incAuthRetryCount() {
  sessionStorage.setItem(AUTH_RETRY_KEY, String(getAuthRetryCount() + 1))
}

export function resetAuthRetryCount() {
  sessionStorage.removeItem(AUTH_RETRY_KEY)
}

// ===================== Token 刷新 + 重试队列 =====================

let isRefreshing = false
let pendingQueue = [] // 等待新 token 的请求回调队列

/**
 * 调用后端 refresh 接口获取新 token
 * 注意：这里直接使用 axios 而非封装的 get/post，避免循环依赖
 */
async function refreshTokenRequest() {
  const baseURL = import.meta.env.VITE_API_BASE_URL
  // 响应拦截器已返回 { code, data, result } 或 false
  const res = await axios.get(`${baseURL}notAuth/token/refresh`, {
    headers: {
      Authorization: getToken(),
    },
  })
  // data 可能是 token 字符串或 { accessToken: "..." }
  return res
}

/**
 * 处理 token 过期的核心入口
 * 拦截器检测到 token 失效时调用此方法
 * @param {Object} failedConfig - 失败请求的 axios config
 * @returns {Promise} 重发请求的结果
 */
export function handleTokenExpired(failedConfig) {
  // 如果已经达到最大重试次数，放弃刷新
  if (getAuthRetryCount() >= MAX_AUTH_RETRY) {
    resetAuthRetryCount()
    removeToken()
    JSSDK.toast.warning('登录已过期，请重新登录')
    return Promise.resolve({ data: { result: false } })
  }

  if (!isRefreshing) {
    isRefreshing = true

    return refreshTokenRequest()
      .then((res) => {
        // res = 拦截器返回的 { code, data, result } 或 false
        const newToken = (typeof res?.data === 'string' ? res.data : res?.data?.accessToken) || ''

        if (newToken) {
          setToken(newToken)
          incAuthRetryCount()

          // 用新 token 重发所有排队的请求
          pendingQueue.forEach((cb) => cb(newToken))
          pendingQueue = []

          // 重发当前失败的请求
          failedConfig.headers = failedConfig.headers || {}
          failedConfig.headers['Authorization'] = newToken
          return axios(failedConfig)
        } else {
          // refresh 接口未返回有效 token
          removeToken()
          JSSDK.toast.warning('登录已过期，请重新登录')
          // 拒绝队列中的所有请求
          pendingQueue.forEach((cb) => cb(null))
          pendingQueue = []
          return { data: { result: false } }
        }
      })
      .catch((err) => {
        console.error('Token 刷新失败:', err)
        removeToken()
        JSSDK.toast.warning('登录已过期，请重新登录')
        pendingQueue.forEach((cb) => cb(null))
        pendingQueue = []
        return { data: { result: false } }
      })
      .finally(() => {
        isRefreshing = false
      })
  } else {
    // 已有刷新请求在途，排队等待
    return new Promise((resolve) => {
      pendingQueue.push((newToken) => {
        if (newToken) {
          failedConfig.headers = failedConfig.headers || {}
          failedConfig.headers['Authorization'] = newToken
          resolve(axios(failedConfig))
        } else {
          resolve({ data: { result: false } })
        }
      })
    })
  }
}

// ===================== 初始化授权流程（供 MainLayout 调用） =====================

/**
 * 初始化授权 - h5sdk 环境
 * 通过飞书 h5sdk 获取 code，再调用后端换取 token
 * @param {Object} options
 * @param {string} options.appId - 飞书应用 appId
 * @param {Function} options.onSuccess - 授权成功回调(token)
 * @param {Function} options.onFail - 授权失败回调(error)
 */
export async function initAuthWithH5SDK({ appId, onSuccess, onFail }) {
  try {
    const url = window.location.href.split('#')[0]
    const baseURL = import.meta.env.VITE_API_BASE_URL

    // 1. 获取 h5sdk 配置（响应拦截器已返回 response.data，即 { code, data, result }）
    const configRes = await axios.get(`${baseURL}notAuth/web/token/access`, {
      params: { url },
    })

    if (!configRes?.result) {
      onFail?.(new Error('获取配置信息失败'))
      return
    }

    const config = configRes.data

    // 2. 调用 h5sdk.config
    window.h5sdk.config({
      appId: config.appId,
      timestamp: config.timestamp,
      nonceStr: config.nonceStr,
      signature: config.signature,
      jsApiList: Array.isArray(config.jsApiList) ? config.jsApiList : [],
      onSuccess: () => {},
      onFail: (err) => console.error('h5sdk config failed:', err),
    })

    // 3. h5sdk ready 后获取 code
    window.h5sdk.ready(() => {
      const authSuccess = async (info) => {
        try {
          // 响应拦截器已返回 { code, data, result }
          const tokenRes = await axios.post(`${baseURL}notAuth/token/access`, {
            code: info.code,
            url: window.location.origin,
          })

          if (tokenRes?.result && tokenRes?.data) {
            const accessToken = tokenRes.data.accessToken || ''
            setToken(accessToken)
            // 缓存用户角色和应用模式（全局公共变量）
            setUserRole(tokenRes.data.userRole || '')
            setAppMode(tokenRes.data.mode || '')

            // 缓存飞书用户信息
            if (tokenRes.data.tenantUser) {
              localStorage.setItem('feishuUserInfo', JSON.stringify(tokenRes.data.tenantUser))
            }
            if (tokenRes.data.userAccessToken) {
              localStorage.setItem('feishuToken', tokenRes?.data?.accessToken || '')
            }
            
            onSuccess?.(accessToken)
          } else {
            onFail?.(new Error(tokenRes?.msg || '授权失败'))
          }
        } catch (error) {
          onFail?.(error)
        }
      }

      const authFail = (error) => {
        console.error('requestAccess fail:', error)
        onFail?.(error)
      }

      // requestAccess 用 appID（大写D），requestAuthCode 用 appId（小写d）
      if (window.tt.requestAccess) {
        window.tt.requestAccess({
          appID: appId,
          scopeList: [
            'task:task:write',
            'task:task:read',
            'task:tasklist:read',
            'task:tasklist:write',
            'bitable:app',
            'base:app:create',
            'base:field:update',
            'docs:permission.setting:write_only',
            'docs:permission.member', 
            'docs:permission.member:create',
          ],
          success: authSuccess,
          fail: authFail,
        })
      } else {
        window.tt.requestAuthCode({
          appId: appId,
          scopeList: [
            'task:task:write',
            'task:task:read',
            'task:tasklist:read',
            'task:tasklist:write',
            'bitable:app',
            'base:app:create',
            'base:field:update',
            'docs:permission.setting:write_only',
            'docs:permission.member', 
            'docs:permission.member:create',
          ],
          success: authSuccess,
          fail: authFail,
        })
      }
    })
  } catch (error) {
    onFail?.(error)
  }
}

/**
 * 初始化授权 - 非 h5sdk 环境（网页端 OAuth）
 * 通过 URL 上的 code 参数换取 token
 * @param {Object} options
 * @param {string} options.code - 飞书 OAuth code
 * @param {string} options.state - 回调 state（用于跳转）
 * @param {Function} options.onSuccess - 授权成功回调(token)
 * @param {Function} options.onFail - 授权失败回调(error)
 */
export async function initAuthWithCode({ code, state, onSuccess, onFail }) {
  try {
    const baseURL = import.meta.env.VITE_API_BASE_URL
    // 响应拦截器已返回 { code, data, result }
    const tokenRes = await axios.post(`${baseURL}notAuth/token/access`, {
      code,
      url: state || window.location.origin,
    })

    if (tokenRes?.result && tokenRes?.data) {
      const accessToken = tokenRes.data.accessToken || ''
      setToken(accessToken)

      // 缓存用户角色和应用模式（全局公共变量）
      setUserRole(tokenRes.data.userRole || '')
      setAppMode(tokenRes.data.mode || '')
      //  setUserRole('app_admin')
      // setAppMode()

      if (tokenRes.data.tenantUser) {
        localStorage.setItem('feishuUserInfo', JSON.stringify(tokenRes.data.tenantUser))
      }
      if (tokenRes.data.userAccessToken) {
        localStorage.setItem('feishuToken', tokenRes?.data?.accessToken || '')
      }

      onSuccess?.(accessToken)
    } else {
      onFail?.(new Error(tokenRes?.msg || '授权失败'))
    }
  } catch (error) {
    onFail?.(error)
  }
}

/**
 * 跳转飞书 OAuth 授权页
 * @param {string} appId
 * @param {string} redirectPath
 */
export function redirectToFeishuAuth(appId, redirectPath = '/resource') {
  const { protocol, host } = window.location
  const redirectUri = encodeURIComponent(`${protocol}//${host}${redirectPath}`)
  const url = `https://open.feishu.cn/open-apis/authen/v1/authorize?redirect_uri=${redirectUri}&app_id=${appId}&state=${redirectUri}&scope=task:task:write%20task:task:read%20task:tasklist:read%20task:tasklist:write%20bitable:app%20base:app:create%20base:field:update%20docs:permission.setting:write_only%20docs:permission.member%20docs:permission.member:create`
  window.location.href = url
}

/**
 * 清除 URL 中的授权码参数
 */
export function clearAuthCodeFromUrl() {
  const url = new URL(window.location.href)
  url.searchParams.delete('code')
  url.searchParams.delete('state')
  window.history.replaceState({}, document.title, url.toString())
}

export default {
  getToken,
  setToken,
  removeToken,
  hasToken,
  getUserRole,
  setUserRole,
  getAppMode,
  setAppMode,
  hasAdminPermission,
  resetAuthRetryCount,
  handleTokenExpired,
  initAuthWithH5SDK,
  initAuthWithCode,
  redirectToFeishuAuth,
  clearAuthCodeFromUrl,
}
