import React, { useEffect, useMemo } from 'react'
import { DatePicker, Empty, Form, Input, InputNumber, Modal, Select, Spin } from 'antd'
import dayjs from 'dayjs'
import noDataImg from '../../assets/images/no-data-table.png'

const { TextArea } = Input
const WORK_DESC_MAX_LENGTH = 200
const WORK_HOUR_PATTERN = /^\d+(?:\.\d{1,2})?$/

function parseWorkHourInput(value) {
  const rawValue = String(value || '')
  const isNegative = rawValue.trim().startsWith('-')
  const normalizedValue = rawValue.replace(/[^\d.]/g, '')
  const [integerPart = '', ...decimalParts] = normalizedValue.split('.')

  const parsedValue = decimalParts.length === 0
    ? integerPart
    : `${integerPart}.${decimalParts.join('').slice(0, 2)}`

  return isNegative ? `-${parsedValue}` : parsedValue
}

export default function TaskWorkHourModal({
  open,
  mode,
  record,
  tasks,
  tasksLoading,
  confirmLoading,
  onTaskDropdownOpenChange,
  onTaskDropdownScroll,
  onCancel,
  onSubmit,
}) {
  const [form] = Form.useForm()
  const isEdit = mode === 'edit'

  const taskOptions = useMemo(() => {
    const options = tasks.map((task) => ({
      label: task.workItemName || task.taskSummary || task.taskGuid,
      value: task.taskGuid,
    }))

    if (isEdit && record?.taskGuid && !options.some((option) => option.value === record.taskGuid)) {
      options.unshift({
        label: record.workItemName || record.taskGuid,
        value: record.taskGuid,
      })
    }

    return options
  }, [isEdit, record, tasks])

  useEffect(() => {
    if (!open) return

    form.setFieldsValue({
      taskGuid: isEdit ? record?.taskGuid : undefined,
      workDate: record?.workDate ? dayjs(record.workDate) : dayjs(),
      workHour: record?.workHour ?? 1,
      workDesc: record?.workDesc || '',
    })
  }, [form, isEdit, open, record])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      await onSubmit(values)
    } catch (error) {
      if (!error?.errorFields) throw error
    }
  }

  const emptyContent = tasksLoading ? (
    <Spin size="small" />
  ) : (
    <Empty
      className="task-work-hour-task-empty"
      image={noDataImg}
      description={(
        <span className="task-work-hour-task-empty-description">
          暂无由你负责的飞书任务，请先在飞书中创建任务或将任务负责人设为自己
        </span>
      )}
    />
  )

  return (
    <Modal
      className="task-work-hour-modal"
      open={open}
      width={520}
      centered
      destroyOnClose
      maskClosable={false}
      title={(
        <div className="task-work-hour-modal-heading">
          <div className="task-work-hour-modal-title">
            {isEdit ? '编辑工时记录' : '新增工时记录'}
          </div>
          <div className="task-work-hour-modal-desc">
            {isEdit ? '修改工时登记信息' : '填写工时登记信息'}
          </div>
        </div>
      )}
      okText={isEdit ? '保存' : '创建'}
      cancelText="取消"
      confirmLoading={confirmLoading}
      onOk={handleSubmit}
      onCancel={onCancel}
      afterClose={() => form.resetFields()}
    >
      <Form form={form} layout="vertical" requiredMark>
        <Form.Item
          label="任务"
          name="taskGuid"
          rules={[{ required: true, message: '请选择任务' }]}
        >
          <Select
            allowClear={!isEdit}
            disabled={isEdit}
            loading={tasksLoading}
            options={taskOptions}
            optionFilterProp="label"
            onOpenChange={onTaskDropdownOpenChange}
            onPopupScroll={onTaskDropdownScroll}
            placeholder="请选择任务"
            notFoundContent={emptyContent}
          />
        </Form.Item>

        <Form.Item
          label="工作日期"
          name="workDate"
          rules={[{ required: true, message: '请选择工作日期' }]}
        >
          <DatePicker className="task-work-hour-modal-control" format="YYYY-MM-DD" />
        </Form.Item>

        <Form.Item
          label="工时（小时）"
          name="workHour"
          rules={[
            { required: true, message: '请输入工时' },
            {
              validator: (_, value) => {
                if (value === undefined || value === null || value === '') {
                  return Promise.resolve()
                }
                if (Number(value) <= 0) {
                  return Promise.reject(new Error('工时必须大于 0'))
                }
                if (!WORK_HOUR_PATTERN.test(String(value))) {
                  return Promise.reject(new Error('工时最多保留两位小数'))
                }
                return Promise.resolve()
              },
            },
          ]}
        >
          <InputNumber
            className="task-work-hour-modal-control"
            min={0.01}
            precision={2}
            parser={parseWorkHourInput}
            step={0.5}
            placeholder="请输入工时"
          />
        </Form.Item>

        <Form.Item
          label="工作描述"
          name="workDesc"
          rules={[{ max: WORK_DESC_MAX_LENGTH, message: '工作描述不能超过 200 个字符' }]}
        >
          <TextArea
            rows={3}
            maxLength={WORK_DESC_MAX_LENGTH}
            showCount
            placeholder="输入工作描述（可选）"
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
