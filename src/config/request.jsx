import axios from 'axios'
import pluginConfig from './index'
import { Badge, Button, Space } from 'antd'
import { getUserRole, setJumpPayUuid } from '../api/api'
import { generateUuid } from '../util/util'
import modalService from './modalService'
import JSSDK from '../jssdk-adapter'
import { getToken, resetAuthRetryCount, handleTokenExpired } from './auth'

axios.defaults.timeout = 100000

// ===================== 常量定义 =====================

const TOKEN_INVALID_CODES = [10210, 1002, 1001, 1003, 10022, 10021]
const TOKEN_INVALID_KEYWORDS = ['Token is missing', 'Token was']

// 不需要携带 Authorization 的接口前缀
const NO_AUTH_PREFIXES = ['notAuth/']
// 不需要携带 mode 的接口前缀
const NO_AUTH_MODE = ['api/user/info','platform/lark_permission','notAuth/token/refresh','notAuth/web/token/access','notAuth/token/access']
// ===================== 工具函数 =====================

function isTokenInvalid(code, msg) {
  return TOKEN_INVALID_CODES.includes(code) ||
    (msg && TOKEN_INVALID_KEYWORDS.some(keyword => msg?.includes(keyword)))
}

// 后端成功码兼容：旧接口统一为 200，新接口返回 0 也表示成功
function isSuccessCode(code) {
  return code === 200 || code === 0
}

function isNoAuthUrl(url) {
  return NO_AUTH_PREFIXES.some(prefix => url?.includes(prefix))
}

// 40201 刷新标记：防止多个并发接口同时返回40201时重复刷新
let isReloading40201 = false

function showErrorMessage(code, msg, url) {
  if (code === 40200) {
    JSSDK.toast.error('当前用户没有操作权限')
  } else if (code === 40201) {
    if (isReloading40201) return
    isReloading40201 = true
    if(localStorage.getItem('meegoTeamworkAppMode')){
      let appMode = localStorage.getItem('meegoTeamworkAppMode')
      if(appMode === 'space'){
        localStorage.setItem('meegoTeamworkAppMode', 'tenant')
      }else{
        localStorage.setItem('meegoTeamworkAppMode', 'space')
      }
    }
    JSSDK.toast.error(msg)
    setTimeout(() => {
      window.location.reload()
    }, 2000)
  } else if (code === 2001) {
    JSSDK.toast.error('该成员为此空间最后一名管理员')
  } else if (!isSuccessCode(code)) {
    if (url?.includes('work/hour/v2/register/cache?point') && (code === 10062 || code === 110015)) {
      JSSDK.toast.error('权限已更新：您现在只能登记自己的工时。他人工时数据已清除。')
    } else {
      // 防止 msg 为空时弹出空白提示（只有红色X图标无文字）
      const errorMsg = msg && String(msg).trim() ? msg : '请求失败，请稍后重试'
      JSSDK.toast.error(errorMsg)
    }
  }
}

// ===================== 付费/席位相关 Modal =====================

async function handlePaymentRedirect() {
  const PLUGIN_ID = import.meta.env.VITE_PLUGIN_ID
  let url = `https://project.feishu.cn/openapp/plugin_share?appKey=${PLUGIN_ID}`
  window.open(url, '_blank');
}

async function handleRenewAction() {
  handlePaymentRedirect()
}

function showExpiredModal(response) {
  modalService.info({
    title: "版本权限已过期",
    closable: true,
    content: (
      <Badge
        color="#4247f6"
        text={<div style={{ display: "inline-block" }}>
          您的<span style={{ fontWeight: 600, color: "#4247f6" }}>{response?.data?.msg}</span>套餐已到期，请重新购买后使用
        </div>}
      />
    ),
    footer: (
      <Space style={{ marginTop: "20px", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <Button onClick={() => JSSDK.navigation.open(response?.data?.url)}>咨询客服</Button>
        <Button type="primary" onClick={handleRenewAction}>立即续费</Button>
      </Space>
    ),
  })
}

function showTrialModal() {
  modalService.info({
    title: null,
    closable: true,
    width: 480,
    wrapClassName: 'modal-wrap-receive',
    icon: null,
    content: (
      <>
        <div className='modal-title'><span className='modal-title-icon'></span>限时福利：15天免费试用！</div>
        <div className='modal-content'><span className='modal-content-icon'></span>为感恩回馈，已为您准备好<span style={{ fontWeight: 600 }}>15天免费试用福利</span></div>
        <div className='modal-content'><span className='modal-content-icon'></span>试用期间，您可以畅享所有功能，全面感受高效、透明的工时管理体验。</div>
        <div className='modal-content'><span className='modal-content-icon'></span>试用到期后，系统将自动进入"只读模式"，您仍可查看历史数据和页面，但无法进行新增或编辑操作。</div>
      </>
    ),
    footer: (
      <div style={{ textAlign: "center", marginTop: "20px" }}>
        <div className='modal-btn' onClick={handleRenewAction}>
          <span className='modal-btn-icon'></span>立即领取15天权益
        </div>
      </div>
    ),
  })
}

function showNoSeatModal(response) {
  const isAdmin = localStorage.getItem("meegoTeamworkUserRole") !== "member"
  modalService.info({
    title: "无席位权限",
    closable: true,
    content: (
      <>
        <div>
          {isAdmin
            ? "您的账号还未被配置可用席位。作为应用管理员或插件管理员，您可以点击下方按钮进行配置。"
            : "很抱歉，您的账号还未被企业配置可用席位。请联系您企业的[应用管理员]或「插件管理员」为您开通。"}
        </div>
        <div>若仍有问题，可随时联系我们的客服团队。</div>
      </>
    ),
    footer: isAdmin ? (
      <Space style={{ marginTop: "20px", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <Button onClick={() => JSSDK.navigation.open(response?.data?.url)}>联系客服</Button>
        <Button type="primary" onClick={() => {
          if (window.location.pathname === '/pay') {
            modalService.destroy();
            window.dispatchEvent(new CustomEvent('openSeatConfig'));
          } else {
            sessionStorage.setItem("jumpPayUuid", "expiration");
            window.location.replace('/pay');
          }
        }}>配置席位</Button>
      </Space>
    ) : (
      <Space style={{ marginTop: "20px", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <Button onClick={() => JSSDK.navigation.open(response?.data?.url)}>联系客服</Button>
      </Space>
    ),
  })
}

// ===================== 请求拦截器 =====================

// HMR / 重复导入安全：每次执行本模块前，先弹出上一次注册的拦截器，
// 避免热更新时拦截器层层堆叠（堆叠会导致后一层拿到前一层已解包的返回值，
// 误判为“无效响应，接口返回非JSON数据”）。
if (axios.__teamworkInterceptors) {
  axios.interceptors.request.eject(axios.__teamworkInterceptors.request)
  axios.interceptors.response.eject(axios.__teamworkInterceptors.response)
}

const requestInterceptorId = axios.interceptors.request.use(
  (config) => {
    config.baseURL = import.meta.env.VITE_API_BASE_URL

    // 不需要 auth 的接口跳过 token
    if (!isNoAuthUrl(config.url)) {
      const token = getToken()
      if (token) {
        config.headers.set('Authorization', token)
      }
    }
    // 不需要 mode 的接口跳过 mode
    if (!NO_AUTH_MODE.includes(config.url)){
      if(localStorage.getItem('meegoTeamworkAppMode')){
        config.headers.set('Mode', localStorage.getItem('meegoTeamworkAppMode'))
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ===================== 响应拦截器 =====================

const responseInterceptorId = axios.interceptors.response.use(
  async (response) => {
    const url = response?.config?.url

    // 用户活跃上报接口不处理
    if (url?.includes('operation/management/user/active')) return

    // 无效响应（非 JSON 数据，通常是网关错误页或登录重定向）
    if (!response || !response.data || typeof response.data === 'string') {
      console.error('[request] 无效响应，接口返回非JSON数据:', url, response?.data?.substring?.(0, 200) || response)
      JSSDK.toast.warning('服务暂不可用，请稍后重试')
      return { data: { result: false } }
    }

    const code = response.data.code
    const msg = response.data.msg || response.data.message
    response.data.result = isSuccessCode(code)
    // 业务码成功 → 清掉重试计数
    if (isSuccessCode(code)) resetAuthRetryCount()

    // 短信校验接口直接返回
    if (url?.includes('sms/checkCode')) return response.data

    // 绑定项目接口特殊码直接返回
    if (url?.includes('measurement/bindMeasurementProject') && [10025, 10024, 10026, 40100, 40003].includes(code)) {
      return response.data
    }

    // 飞书任务授权失效，由任务页面触发现有重新授权流程
    if ([10031, 100861].includes(code) && url?.includes('feishu/task/work-hour')) {
      return response.data
    }

    // ========== Token 失效（业务码） ==========
    if (isTokenInvalid(code, msg)) {
      return handleTokenExpired(response.config)
    }

    // ========== 付费/席位相关业务码 ==========
    if (code === 10024) {
      showExpiredModal(response)
      return { data: { ...response.data, result: false } }
    }

    if (code === 10025) {
      showTrialModal()
      return { data: { ...response.data, result: false } }
    }

    if (code === 10026) {
      showNoSeatModal(response)
      return { data: { ...response.data, result: false } }
    }

    // ========== 其他错误 ==========
    showErrorMessage(code, msg, url)
    if (!isSuccessCode(code)) {
      response.ok = false
      return false
    }
    return response.data
  },

  // ========== HTTP 错误处理 ==========
  async (error) => {
    const status = error?.response?.status || error?.request?.status
    if (status === 401) {
      // HTTP 401: Token 过期，委托 auth 模块处理刷新+重试
      const config = error.config || {}
      return handleTokenExpired(config)
    }

    if (status === 404) {
      // HTTP 404: 直接返回失败，不重试
      return { data: { result: false } }
    }

    // 其他网络错误
    JSSDK.toast.warning('网络错误，请稍后再试')
    return { data: { result: false } }
  }
)

// 记录本次注册的拦截器 id，供下次（HMR 重载时）弹出，防止重复堆叠
axios.__teamworkInterceptors = {
  request: requestInterceptorId,
  response: responseInterceptorId,
}

// ===================== 请求去重 + 导出 =====================

// 进行中的请求缓存：同一 URL + 同参数，在上一次未完成前复用同一个 Promise
const pendingRequests = new Map()

const getRequestKey = (method, url, data) => {
  let paramStr = ''
  try {
    paramStr = data ? JSON.stringify(data) : ''
  } catch (e) {
    paramStr = ''
  }
  return `${method}:${url}:${paramStr}`
}

const createRequest = (method) => (url, data) => {
  const key = getRequestKey(method, url, data)
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)
  }
  const promise = axios[method](url, method === 'get' ? { params: data } : data)
    .finally(() => {
      pendingRequests.delete(key)
    })
  pendingRequests.set(key, promise)
  return promise
}

export const get = createRequest('get')
export const del = createRequest('delete')
export const post = createRequest('post')
export const patch = createRequest('patch')
export const put = createRequest('put')
