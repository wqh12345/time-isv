import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider, App as AntdApp, Empty } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { webTheme } from './config/commConfig'
import noDataImg from './assets/images/no-data-table.png'
import App from './App'
import './style/comm.less'
//import VConsole from "vconsole"
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
//const vconsole = new VConsole()
dayjs.locale('zh-cn')
document.title = import.meta.env.VITE_APP_TITLE || 'TeamWork'
const theme = webTheme()

// 全局统一空状态渲染
const renderEmpty = () => (
  <Empty
    image={noDataImg}
    styles={{ image: { height: 90, width: 90, margin: 'auto', marginBottom: 10 } }}
    description={<span style={{ color: '#727272', fontSize: '12px' }}>暂无数据</span>}
  />
)
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={theme} renderEmpty={renderEmpty}>
      <AntdApp>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <App />
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>
)
