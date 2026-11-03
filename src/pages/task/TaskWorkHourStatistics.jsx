import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Button, Spin } from 'antd'
import { BarChartOutlined, LinkOutlined, ReloadOutlined } from '@ant-design/icons'
import JSSDK from '../../jssdk-adapter'
import { createTaskWorkHourBitable, getCurrentTaskWorkHourBitable } from '../../api/api'
import { getUserRole } from '../../config/auth'
import taskWorkHourEmptyImage from '../../assets/task_img.jpg'
import './index.less'

const BITABLE_CREATE_PARAMS = {
  name: '任务工时登记',
  tableName: '工时统计',
}

export default function TaskWorkHourStatistics({ refreshKey = 0 }) {
  const mountedRef = useRef(true)
  const requestVersionRef = useRef(0)
  const [viewUrl, setViewUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [feishuAppAdmin, setFeishuAppAdmin] = useState(false)
  useEffect(() => () => {
    mountedRef.current = false
  }, [])

  const loadViewUrl = useCallback(async () => {
    const requestVersion = ++requestVersionRef.current
    setLoading(true)
    setHasError(false)
    try {
      const response = await getCurrentTaskWorkHourBitable()
      // if (!mountedRef.current || requestVersion !== requestVersionRef.current) return
      // if (!response?.result) throw new Error('working hours bitable query failed')

      const bitableUrl = response?.data?.bitableUrl
      const appAdmin = response?.data?.feishuAppAdmin ?? false
      setFeishuAppAdmin(appAdmin)
      setViewUrl(typeof bitableUrl === 'string' && bitableUrl.trim() ? bitableUrl : null)
    } catch (error) {
        setViewUrl(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadViewUrl()
  }, [loadViewUrl, refreshKey])

  const handleGenerateView = async () => {
    if (generating) return
    setGenerating(true)
    setHasError(false)
    try {
      const response = await createTaskWorkHourBitable(BITABLE_CREATE_PARAMS)
      if (!response?.result) throw new Error('task work hour bitable creation failed')

      const generatedUrl = response?.data?.bitableUrl
      if (typeof generatedUrl !== 'string' || !generatedUrl.trim()) {
        throw new Error('generated bitable URL is missing')
      }
      setViewUrl(generatedUrl)
    } catch (error) {
        setHasError(true)
        //JSSDK.toast.error('工时视图生成失败，请稍后重试')
    } finally {
      //setViewUrl("https://ldkj.feishu.cn/base/VxXFbd4paaNwUlspUHScWbsQntd?table=tblweC47ixVEUrqL&view=vewqbh383h")
      setGenerating(false)
      // if (mountedRef.current) setGenerating(false)
    }
  }

  const handleOpenView = () => {
    if (viewUrl) JSSDK.navigation.open(viewUrl, '_blank')
  }

  const userRole = getUserRole()
  const isAdmin = userRole === 'app_admin' || userRole === 'space_admin'

  return (
    <section className="task-work-hour-statistics" aria-label="工时统计">
      {/* <header className="task-work-hour-statistics-header">
        <Button
          icon={<LinkOutlined />}
          disabled={!viewUrl}
          onClick={handleOpenView}
        >
          在新标签页打开
        </Button>
      </header> */}

      <div className="task-work-hour-statistics-body">
        {loading ? (
          <div className="task-work-hour-statistics-state">
            <Spin />
          </div>
        ) : viewUrl ? (
          <iframe
            className="task-work-hour-statistics-iframe"
            src={viewUrl}
            title="工时数据统计"
            allow="fullscreen"
          />
        ) : (
          <div className="task-work-hour-statistics-state">
            <div className="task-work-hour-statistics-state-content">
              <img
                className="task-work-hour-statistics-empty-image"
                src={taskWorkHourEmptyImage}
                alt=""
              />
              {isAdmin ? (
                <Button type="primary" icon={<BarChartOutlined />} loading={generating} onClick={handleGenerateView}>
                  生成工时视图
                </Button>
              ) : (
                <p>您暂无该权限，请联系管理员生成工时视图</p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
