import React from 'react'
import { createRoot } from 'react-dom/client'
import { message, Modal, ConfigProvider, App, Empty } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { webTheme } from './config/commConfig'
import noDataImg from './assets/images/no-data-table.png'
import MeegleRegModal from './components/meegle-reg-modal/MeegleRegModal'

const theme = webTheme()

// 全局统一空状态渲染
const renderEmpty = () => (
  <Empty
    image={noDataImg}
    styles={{ image: { height: 90, width: 90, margin: 'auto', marginBottom: 10 } }}
    description={<span style={{ color: '#727272', fontSize: '12px' }}>暂无数据</span>}
  />
)

// 注册模态框组件映射
const modalRegistry = {
  'RegModal': MeegleRegModal,
}

// 存储 message 实例
let messageInstance = message

 // 全局 toast 去重：记录当前正在显示的提示（type + 内容），相同内容短时间内不重复弹出
const activeToasts = new Set()
// toast 最小间隔时间（毫秒），同一内容在此时间内不重复弹出
const TOAST_DEDUP_INTERVAL = 2000

/**
 * 带去重的 toast 调用
 * @param {'success'|'error'|'warning'|'info'} type
 * @param {string} msg
 */
const showToast = (type, msg) => {
  if (msg === undefined || msg === null) return
  const key = `${type}:${String(msg)}`
  if (activeToasts.has(key)) return
  activeToasts.add(key)
  const instance = getMessage()
  // 调用 antd message，关闭后或超时后释放 key
  instance[type](msg, 3, () => {
    activeToasts.delete(key)
  })
  // 兜底：2秒后强制释放，防止 onClose 不触发导致卡死
  setTimeout(() => {
    activeToasts.delete(key)
  }, TOAST_DEDUP_INTERVAL)
}

// 初始化 JSSDK，注入 message 实例
export const initJSSDK = (antdMessage) => {
  messageInstance = antdMessage
  // App context 下的 message 实例也设置最大显示数
  if (antdMessage && typeof antdMessage.config === 'function') {
    antdMessage.config({ maxCount: 3 })
  }
}

// 获取 message 实例
const getMessage = () => {
  return messageInstance
}

// 全局最多同时显示 3 条 toast，避免堆叠
message.config({ maxCount: 3 })

const JSSDKAdapter = {
  toast: {
    success: (msg) => showToast('success', msg),
    error: (msg) => showToast('error', msg),
    warning: (msg) => showToast('warning', msg),
    info: (msg) => showToast('info', msg),
  },

  navigation: {
    open: (url, target = '_blank') => {
      if (url) {
        window.open(url, target)
      }
    },
    getHostname: async () => {
      return window.location.hostname
    },
    getHref: async () => {
      return window.location.href
    },
  },

  Context: {
    load: async () => {
      const stored = sessionStorage.getItem('jssdk_context')
      if (stored) {
        try {
          return JSON.parse(stored)
        } catch (e) {
          // fallback
        }
      }
      return {
        loginUser: {
          id: sessionStorage.getItem('jwtMeegoTeamworkUserId') || '999',
          name: sessionStorage.getItem('jwtMeegoTeamworkUserName') || 'Current User',
          avatar: '',
        },
        mainSpace: {
          id: sessionStorage.getItem('jwtMeegoTeamworkProjectKey') || '9999',
          name: 'Default Space',
          simpleName: 'default',
        },
      }
    },
    getCustomContext: async function() {
      const ctx = await this.load()
      return ctx.customContext || {}
    }
  },

  Space: {
    load: async (spaceId) => {
      const stored = sessionStorage.getItem('jssdk_space')
      if (stored) {
        try {
          return JSON.parse(stored)
        } catch (e) {
          // fallback
        }
      }
      return {
        id: spaceId || '',
        name: 'Default Space',
        simpleName: sessionStorage.getItem('jwtMeegoTeamworkSpaceName') || 'default',
      }
    },
  },

  WorkObject: {
    load: async (params) => {
      return {
        workItemKey: params?.workItemKey || '',
        name: '',
      }
    },
  },

  utils: {
    getAuthCode: async () => {
      return { code: sessionStorage.getItem('jssdk_auth_code') || 'mock_auth_code' }
    },
  },

  modal: {
    open: async (options) => {
      const { entry, width = 600, height, maskClosable = true, context = {}, onSubmit } = options
      
      // 获取对应的组件
      const ModalComponent = modalRegistry[entry]
      if (!ModalComponent) {
        console.warn(`Modal entry "${entry}" not found in registry`)
        return new Promise((resolve) => {
          const modal = Modal.confirm({
            centered: true,
            title: context?.title || 'Dialog',
            width: width,
            maskClosable: maskClosable,
            icon: null, // 去掉默认的问号图标
            content: `Component "${entry}" not found`,
            onOk: () => {
              if (onSubmit) {
                onSubmit({ confirm: true })
              }
              resolve({ close: () => modal.destroy() })
            },
            onCancel: () => {
              resolve({ close: () => modal.destroy() })
            },
          })
          return { close: () => modal.destroy() }
        })
      }

      return new Promise((resolve) => {
        // 创建容器
        const container = document.createElement('div')
        document.body.appendChild(container)
        
        const root = createRoot(container)
        let isClosed = false
        
        // 存储自定义上下文，供 ModalComponent 使用
        const customContext = {
          ...context,
          getRegStatus: onSubmit,
        }
        
        // 设置到 sessionStorage 供 MeegleRegModal 读取
        const existingContext = JSON.parse(sessionStorage.getItem('jssdk_context') || '{}')
        sessionStorage.setItem('jssdk_context', JSON.stringify({
          ...existingContext,
          customContext: customContext,
        }))
        
        const closeModal = () => {
          if (isClosed) return
          isClosed = true
          // 使用 setTimeout 异步执行卸载操作，避免与 React 渲染过程冲突
          setTimeout(() => {
            root.unmount()
            if (container.parentNode) {
              container.parentNode.removeChild(container)
            }
          }, 0)
        }
        
        // 创建模态框 - 使用 App 组件包裹以支持动态主题
        let modalInstance = null
        
        const ModalContent = () => {
          const { modal } = App.useApp()
          
          React.useEffect(() => {
            modalInstance = modal.info({
              title: null,
              width: width,
              centered: true, // 水平垂直居中
              maskClosable: maskClosable,
              closable: true,
              footer: null,
              icon: null, // 去掉默认的信息图标
              onCancel: () => {
                closeModal()
                resolve({ close: closeModal })
              },
              content: (
                <div style={{ height: height ? `${height}px` : 'auto', overflow: 'auto' }}>
                  <ModalComponent />
                </div>
              ),
            })
          }, [])
          
          return null
        }
        
        // 渲染 App 组件以获取 modal 实例
        root.render(
          <ConfigProvider locale={zhCN} theme={theme} renderEmpty={renderEmpty}>
            <App>
              <ModalContent />
            </App>
          </ConfigProvider>
        )
        
        // 重写 submit 方法
        JSSDKAdapter.containerModal.submit = (data) => {
          if (onSubmit) {
            onSubmit(data)
          }
          closeModal()
          resolve({ close: closeModal })
        }
        
        resolve({ close: () => {
          if (modalInstance) {
            modalInstance.destroy()
          }
          closeModal()
        }})
      })
    },
  },

  control: {
    getContext: async () => {
      const stored = sessionStorage.getItem('jssdk_control_context')
      if (stored) {
        try {
          return JSON.parse(stored)
        } catch (e) {
          // fallback
        }
      }
      return {}
    },
  },

  tab: {
    getContext: async () => {
      const stored = sessionStorage.getItem('jssdk_tab_context')
      if (stored) {
        try {
          return JSON.parse(stored)
        } catch (e) {
          // fallback
        }
      }
      return {}
    },
  },

  containerModal: {
    submit: (data) => {
      console.log('containerModal.submit', data)
    },
  },

  shared: {
    setSharedModules: (modules) => {
      console.log('shared.setSharedModules called', Object.keys(modules))
    },
  },
}

export default JSSDKAdapter
