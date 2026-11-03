import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  App as AntdApp,
  Button,
  DatePicker,
  Select,
  Table,
  Tabs,
  Tooltip,
} from 'antd'
import {
  BarChartOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import Decimal from 'decimal.js'
import {
  deleteFeishuTaskWorkHourRecord,
  getFeishuTaskWorkHourRecords,
  getFeishuTaskWorkHourTasks,
  postFeishuTaskWorkHourRecord,
  postUpdateFeishuTaskWorkHourRecord,
} from '../../api/api'
import { redirectToFeishuAuth } from '../../config/auth'
import TaskWorkHourModal from './TaskWorkHourModal'
import TaskWorkHourStatistics from './TaskWorkHourStatistics'
import './index.less'

const { RangePicker } = DatePicker
const DEFAULT_PAGE_SIZE = 20
const TASK_PAGE_SIZE = 100
const MIN_TABLE_BODY_HEIGHT = 160
const TASK_AUTH_EXPIRED_CODES = [10031, 100861]

function formatHour(value) {
  const hour = Number(value)
  if (!Number.isFinite(hour)) return 0
  return hour
}

function sumRecordHours(records) {
  return records
    .reduce((total, record) => total.plus(formatHour(record?.workHour)), new Decimal(0))
    .toNumber()
}

function getTableScrollY({
  viewportHeight,
  sectionTop,
  headerHeight,
  paginationHeight,
  paginationMarginTop,
  paginationMarginBottom,
  pagePaddingBottom,
}) {
  const availableHeight = viewportHeight
    - sectionTop
    - headerHeight
    - paginationHeight
    - paginationMarginTop
    - paginationMarginBottom
    - pagePaddingBottom

  return Math.max(MIN_TABLE_BODY_HEIGHT, Math.floor(availableHeight))
}

export default function TaskWorkHourPage() {
  const appId = import.meta.env.VITE_API_ID
  const { message, modal } = AntdApp.useApp()
  const mountedRef = useRef(true)
  const recordsRequestVersionRef = useRef(0)
  const tasksRequestVersionRef = useRef(0)
  const authorizationRedirectingRef = useRef(false)
  const pageRef = useRef(null)
  const tableSectionRef = useRef(null)
  const tasksPageTokenRef = useRef(undefined)
  const tasksHasMoreRef = useRef(true)
  const tasksLoadedRef = useRef(false)
  const tasksLoadingRef = useRef(false)

  const [tasks, setTasks] = useState([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [records, setRecords] = useState([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [recordsError, setRecordsError] = useState(false)
  const [summary, setSummary] = useState({ totalRecords: 0, totalHours: 0 })
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [tableScrollY, setTableScrollY] = useState(undefined)
  const [taskGuid, setTaskGuid] = useState(undefined)
  const [dateRange, setDateRange] = useState(null)
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
  })
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [activeTab, setActiveTab] = useState('records')
  const [statisticsRefreshKey, setStatisticsRefreshKey] = useState(0)
  const [modalState, setModalState] = useState({
    open: false,
    mode: 'create',
    record: null,
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useLayoutEffect(() => {
    const page = pageRef.current
    const tableSection = tableSectionRef.current
    if (!page || !tableSection) return undefined

    let frameId
    const updateTableScrollY = () => {
      const tableHeader = tableSection.querySelector('.ant-table-thead')
      const paginationElement = tableSection.querySelector('.ant-table-pagination')
      const paginationStyle = paginationElement ? window.getComputedStyle(paginationElement) : null
      const nextTableScrollY = getTableScrollY({
        viewportHeight: window.innerHeight,
        sectionTop: tableSection.getBoundingClientRect().top,
        headerHeight: tableHeader?.getBoundingClientRect().height || 0,
        paginationHeight: paginationElement?.getBoundingClientRect().height || 0,
        paginationMarginTop: Number.parseFloat(paginationStyle?.marginTop) || 0,
        paginationMarginBottom: Number.parseFloat(paginationStyle?.marginBottom) || 0,
        pagePaddingBottom: Number.parseFloat(window.getComputedStyle(page).paddingBottom) || 0,
      })

      setTableScrollY((previous) => (
        previous === nextTableScrollY ? previous : nextTableScrollY
      ))
    }
    const scheduleTableScrollYUpdate = () => {
      window.cancelAnimationFrame(frameId)
      frameId = window.requestAnimationFrame(updateTableScrollY)
    }
    const resizeObserver = typeof window.ResizeObserver === 'function'
      ? new window.ResizeObserver(scheduleTableScrollYUpdate)
      : null

    resizeObserver?.observe(page)
    resizeObserver?.observe(tableSection)
    window.addEventListener('resize', scheduleTableScrollYUpdate)
    scheduleTableScrollYUpdate()

    return () => {
      window.cancelAnimationFrame(frameId)
      resizeObserver?.disconnect()
      window.removeEventListener('resize', scheduleTableScrollYUpdate)
    }
  }, [activeTab, recordsError])

  const handleAuthorizationExpired = useCallback((response) => {
    if (!TASK_AUTH_EXPIRED_CODES.includes(response?.code)) return false

    if (!authorizationRedirectingRef.current) {
      authorizationRedirectingRef.current = true
       redirectToFeishuAuth(appId, '/task')
      // message.warning('飞书授权已失效，正在重新授权')
      // setTimeout(() => {
      //   redirectToFeishuAuth(appId, '/task')
      // }, 1000)
    }
    return true
  }, [appId, message])

  const loadTasks = useCallback(async ({ reset = false } = {}) => {
    if (tasksLoadingRef.current) {
      if (!reset) return false
      // 让切换 Tab 时的初始化请求取代旧请求，旧响应会因版本过期而被忽略。
      tasksRequestVersionRef.current += 1
      tasksLoadingRef.current = false
    }
    if (!reset && tasksLoadedRef.current && !tasksHasMoreRef.current) return false

    const pageToken = reset ? undefined : tasksPageTokenRef.current
    const requestVersion = ++tasksRequestVersionRef.current
    tasksLoadingRef.current = true
    setTasksLoading(true)
    try {
      const response = await getFeishuTaskWorkHourTasks({
        pageSize: TASK_PAGE_SIZE,
        ...(pageToken ? { pageToken } : {}),
      })
      if (!mountedRef.current || requestVersion !== tasksRequestVersionRef.current) return false
      if (handleAuthorizationExpired(response)) return false
      if (!response?.result || !Array.isArray(response?.data?.items)) {
        throw new Error('invalid task list response')
      }

      const hasMore = response.data.hasMore === true
      const nextPageToken = response.data.pageToken
      if (hasMore && (!nextPageToken || nextPageToken === pageToken)) {
        throw new Error('invalid task page token')
      }

      tasksPageTokenRef.current = nextPageToken
      tasksHasMoreRef.current = hasMore
      tasksLoadedRef.current = true
      setTasks((previous) => {
        const taskMap = new Map(
          (reset ? [] : previous)
            .filter((task) => task?.taskGuid)
            .map((task) => [task.taskGuid, task]),
        )

        response.data.items
          .filter((task) => task?.taskGuid)
          .forEach((task) => taskMap.set(task.taskGuid, task))

        return Array.from(taskMap.values())
      })
      return true
    } catch (error) {
      if (mountedRef.current && requestVersion === tasksRequestVersionRef.current) {
        message.error('任务列表加载失败，请稍后重试')
      }
      return false
    } finally {
      if (requestVersion === tasksRequestVersionRef.current) {
        tasksLoadingRef.current = false
        if (mountedRef.current) {
          setTasksLoading(false)
        }
      }
    }
  }, [handleAuthorizationExpired, message])

  const handleTaskDropdownOpenChange = useCallback((open) => {
    if (open) loadTasks()
  }, [loadTasks])

  const handleTaskDropdownScroll = useCallback((event) => {
    const dropdown = event.currentTarget
    const distanceToBottom = dropdown.scrollHeight - dropdown.scrollTop - dropdown.clientHeight
    if (distanceToBottom <= 8) loadTasks()
  }, [loadTasks])

  const filterParams = useMemo(() => {
    const params = {}
    if (taskGuid) params.taskGuid = taskGuid
    if (dateRange?.[0]) params.startDate = dateRange[0].format('YYYY-MM-DD')
    if (dateRange?.[1]) params.endDate = dateRange[1].format('YYYY-MM-DD')
    return params
  }, [dateRange, taskGuid])

  const loadRecords = useCallback(async () => {
    const requestVersion = ++recordsRequestVersionRef.current
    setRecordsLoading(true)
    setSummaryLoading(true)
    setRecordsError(false)
    try {
      const response = await getFeishuTaskWorkHourRecords({
        ...filterParams,
        pageNo: pagination.current,
        pageSize: pagination.pageSize,
      })
      if (!mountedRef.current || requestVersion !== recordsRequestVersionRef.current) return
      if (handleAuthorizationExpired(response)) return
      if (!response?.result) {
        setRecordsError(true)
        setSummary({ totalRecords: 0, totalHours: null })
        return
      }

      const pageData = response?.data || {}
      const nextRecords = Array.isArray(pageData.records) ? pageData.records : []
      const total = Number(pageData.totalRecordCount) || 0

      setRecords(nextRecords)
      setSummary({
        totalRecords: total,
        totalHours: pageData?.totalWorkHour || 0,
      })
      setPagination((previous) => ({
        ...previous,
        current: Number(pageData.current) || previous.current,
        pageSize: Number(pageData.size) || previous.pageSize,
        total,
      }))
    } catch (error) {
      if (mountedRef.current && requestVersion === recordsRequestVersionRef.current) {
        setRecordsError(true)
        setSummary({ totalRecords: 0, totalHours: null })
      }
    } finally {
      if (mountedRef.current && requestVersion === recordsRequestVersionRef.current) {
        setRecordsLoading(false)
        setSummaryLoading(false)
      }
    }
  }, [filterParams, pagination.current, pagination.pageSize])

  useEffect(() => {
    loadRecords()
  }, [loadRecords, refreshVersion])

  const resetRecordView = useCallback(() => {
    recordsRequestVersionRef.current += 1
    tasksPageTokenRef.current = undefined
    tasksHasMoreRef.current = true
    tasksLoadedRef.current = false
    tasksRequestVersionRef.current += 1
    setTasks([])
    setTaskGuid(undefined)
    setDateRange(null)
    setPagination({ current: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0 })
    setRecords([])
    setRecordsError(false)
    setSummary({ totalRecords: 0, totalHours: 0 })
    setTableScrollY(undefined)
    setModalState({ open: false, mode: 'create', record: null })
    setRefreshVersion((version) => version + 1)
    loadTasks({ reset: true })
  }, [loadTasks])

  const handleTabChange = useCallback((key) => {
    setActiveTab(key)
    if (key === 'records') {
      resetRecordView()
    } else {
      setStatisticsRefreshKey((version) => version + 1)
    }
  }, [resetRecordView])

  const taskOptions = useMemo(() => tasks.map((task) => ({
    label: task.workItemName || task.taskSummary || task.taskGuid,
    value: task.taskGuid,
  })), [tasks])

  const openCreateModal = () => {
    setModalState({ open: true, mode: 'create', record: null })
  }

  const openEditModal = (record) => {
    setModalState({ open: true, mode: 'edit', record })
  }

  const handleDeleteRecord = (record) => {
    modal.confirm({
      title: '删除工时记录',
      content: `确认删除“${record.workItemName || '该任务'}”的这条工时记录吗？删除后无法恢复。`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      centered: true,
      onOk: async () => {
        try {
          const response = await deleteFeishuTaskWorkHourRecord(record.id)
          if (handleAuthorizationExpired(response)) return
          if (!response?.result) throw new Error('delete request failed')
          message.success('工时记录已删除')
          if (records.length === 1 && pagination.current > 1) {
            setPagination((previous) => ({ ...previous, current: previous.current - 1 }))
          }
          setRefreshVersion((version) => version + 1)
        } catch (error) {
          message.error('工时记录删除失败')
          throw error
        }
      },
    })
  }

  const closeModal = () => {
    if (submitting) return
    setModalState((previous) => ({ ...previous, open: false }))
  }

  const handleModalSubmit = async (values) => {
    if (submitting) return
    setSubmitting(true)
    try {
      let response
      if (modalState.mode === 'edit') {
        response = await postUpdateFeishuTaskWorkHourRecord({
          id: modalState.record?.id,
          workDate: values.workDate.format('YYYY-MM-DD'),
          workHour: Number(values.workHour),
          workDesc: values.workDesc?.trim() || undefined,
        })
      } else {
        const selectedTask = tasks.find((task) => task.taskGuid === values.taskGuid)
        if (!selectedTask) {
          message.error('所选任务已失效，请重新选择')
          return
        }
        response = await postFeishuTaskWorkHourRecord({
          taskGuid: selectedTask.taskGuid,
          workItemName: selectedTask.workItemName || selectedTask.taskSummary || selectedTask.taskGuid,
          workDate: values.workDate.format('YYYY-MM-DD'),
          workHour: Number(values.workHour),
          workDesc: values.workDesc?.trim() || undefined,
        })
      }

      if (handleAuthorizationExpired(response)) return
      if (!response?.result) return
      message.success(modalState.mode === 'edit' ? '工时记录已更新' : '工时记录已创建')
      setModalState((previous) => ({ ...previous, open: false }))
      setPagination((previous) => ({ ...previous, current: 1 }))
      setRefreshVersion((version) => version + 1)
    } catch (error) {
      message.error(modalState.mode === 'edit' ? '工时记录更新失败' : '工时记录创建失败')
    } finally {
      if (mountedRef.current) setSubmitting(false)
    }
  }

  const handleTaskFilterChange = (value) => {
    setTaskGuid(value)
    setPagination((previous) => ({ ...previous, current: 1 }))
  }

  const handleDateRangeChange = (value) => {
    setDateRange(value)
    setPagination((previous) => ({ ...previous, current: 1 }))
  }

  const resetFilters = () => {
    setTaskGuid(undefined)
    setDateRange(null)
    setPagination((previous) => ({ ...previous, current: 1 }))
  }

  const columns = [
    {
      title: '任务名称',
      dataIndex: 'workItemName',
      key: 'workItemName',
      width: 260,
      ellipsis: { showTitle: false },
      render: (value) => <Tooltip title={value}>{value || '-'}</Tooltip>,
    },
    {
      title: '工时（小时）',
      dataIndex: 'workHour',
      key: 'workHour',
      width: 140,
      render: (value) => formatHour(value),
    },
    {
      title: '工作描述',
      dataIndex: 'workDesc',
      key: 'workDesc',
      width: 360,
      ellipsis: { showTitle: false },
      render: (value) => <Tooltip title={value || undefined}>{value || '-'}</Tooltip>,
    },
    {
      title: '工作日期',
      dataIndex: 'workDate',
      key: 'workDate',
      width: 150,
      render: (value) => value ? dayjs(value).format('YYYY-MM-DD') : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 112,
      fixed: 'right',
      render: (_, record) => (
        <div className="task-work-hour-actions">
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              aria-label={`编辑${record.workItemName || '工时记录'}`}
              onClick={() => openEditModal(record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              aria-label={`删除${record.workItemName || '工时记录'}`}
              onClick={() => handleDeleteRecord(record)}
            />
          </Tooltip>
        </div>
      ),
    },
  ]

  return (
    <main ref={pageRef} className="task-work-hour-page">
      <Tabs
        className="task-work-hour-tabs"
        activeKey={activeTab}
        onChange={handleTabChange}
        items={[
          {
            key: 'records',
            label: (
              <span className="task-work-hour-tab-label">
                <ClockCircleOutlined aria-hidden="true" />
                <span>工时记录</span>
              </span>
            ),
          },
          // 注释掉「工时统计」tab
          // {
          //   key: 'statistics',
          //   label: (
          //     <span className="task-work-hour-tab-label">
          //       <BarChartOutlined aria-hidden="true" />
          //       <span>工时统计</span>
          //     </span>
          //   ),
          // },
        ]}
      />

      {activeTab === 'statistics' ? (
        <TaskWorkHourStatistics refreshKey={statisticsRefreshKey} />
      ) : (
        <>
          <header className="task-work-hour-header">
            <h1>工时管理</h1>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              新增登记
            </Button>
          </header>

      <section className="task-work-hour-summary" aria-label="工时汇总">
        <div className="task-work-hour-stat">
          <div className="task-work-hour-stat-label">
            <FileTextOutlined />
            <span>总记录数</span>
          </div>
          <div className="task-work-hour-stat-value">
            {summaryLoading ? '-' : summary.totalRecords}
          </div>
        </div>
        <div className="task-work-hour-stat">
          <div className="task-work-hour-stat-label">
            <ClockCircleOutlined />
            <span>总工时</span>
          </div>
          <div className="task-work-hour-stat-value">
            {summaryLoading || summary.totalHours === null ? '-' : `${summary.totalHours} 小时`}
          </div>
        </div>
      </section>

      <section className="task-work-hour-filters" aria-label="筛选条件">
        <Select
          className="task-work-hour-task-filter"
          aria-label="筛选任务"
          allowClear
          loading={tasksLoading}
          optionFilterProp="label"
          onOpenChange={handleTaskDropdownOpenChange}
          onPopupScroll={handleTaskDropdownScroll}
          options={taskOptions}
          value={taskGuid}
          placeholder="筛选任务"
          onChange={handleTaskFilterChange}
        />
        <RangePicker
          className="task-work-hour-date-filter"
          aria-label="工作日期范围"
          placeholder={['开始日期', '结束日期']}
          value={dateRange}
          format="YYYY-MM-DD"
          onChange={handleDateRangeChange}
        />
        <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置</Button>
      </section>
      <section ref={tableSectionRef} className="task-work-hour-table" aria-label="工时记录列表">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={records}
          loading={recordsLoading}
          scroll={{
            x: 1022,
            ...(records.length > 0 && tableScrollY ? { y: tableScrollY } : {}),
          }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total) => `共 ${total} 条`,
          }}
          onChange={(nextPagination) => {
            setPagination((previous) => ({
              ...previous,
              current: nextPagination.current || 1,
              pageSize: nextPagination.pageSize || DEFAULT_PAGE_SIZE,
            }))
          }}
        />
      </section>

      <TaskWorkHourModal
        open={modalState.open}
        mode={modalState.mode}
        record={modalState.record}
        tasks={tasks}
        tasksLoading={tasksLoading}
        confirmLoading={submitting}
        onTaskDropdownOpenChange={handleTaskDropdownOpenChange}
        onTaskDropdownScroll={handleTaskDropdownScroll}
        onCancel={closeModal}
        onSubmit={handleModalSubmit}
      />
        </>
      )}
    </main>
  )
}
