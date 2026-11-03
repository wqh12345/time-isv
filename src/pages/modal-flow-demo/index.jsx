import React, { useState } from 'react'
import { Card, Button, Radio, Table, Tag, Typography, Space, Descriptions } from 'antd'
import { ExperimentOutlined, PlayCircleOutlined, CheckCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import './index.less'

const { Title, Paragraph } = Typography

// 模拟的场景配置
const SCENARIOS = [
  {
    id: 'new-user-no-plugin',
    name: '新用户（未安装工时插件）',
    desc: '模拟已安装应用但未安装工时插件，初次进入',
    state: {
      install: true,
      workHourPluginInstalled: false,
      guideDisplayed: false,
    },
  },
  {
    id: 'existing-user-no-plugin',
    name: '老用户（未安装工时插件）',
    desc: '模拟已安装应用但未安装工时插件，已看过初始化指引',
    state: {
      install: true,
      workHourPluginInstalled: false,
      guideDisplayed: true,
    },
  },
  {
    id: 'existing-user-with-plugin-new',
    name: '老用户（已安装工时插件，未看过跨空间指引）',
    desc: '模拟已安装应用且已安装工时插件，初次进入',
    state: {
      install: true,
      workHourPluginInstalled: true,
      guideDisplayed: false,
    },
  },
  {
    id: 'existing-user-with-plugin-old',
    name: '老用户（已安装工时插件，已看过跨空间指引）',
    desc: '模拟已安装应用且已安装工时插件，已看过所有指引',
    state: {
      install: true,
      workHourPluginInstalled: true,
      guideDisplayed: true,
    },
  },
  {
    id: 'not-installed',
    name: '未安装应用',
    desc: '模拟应用未安装状态',
    state: {
      install: false,
      workHourPluginInstalled: false,
      guideDisplayed: false,
    },
  },
]

// 弹窗顺序说明
const MODAL_ORDER_DESC = [
  { name: 'CrossSpace (isv引导)', level: 1, note: '场景1优先级最高；场景2优先级第3' },
  { name: 'Expiration (权益弹窗)', level: 2, note: '场景2优先级最高；场景1优先级第2' },
  { name: 'CustInfo (留资弹窗)', level: 3, note: '场景1优先级第3；场景2优先级第2' },
  { name: 'Public (公告弹窗)', level: 4, note: '两个场景优先级最低' },
]

export default function ModalFlowDemo() {
  const [selectedScenario, setSelectedScenario] = useState(null)
  const [simulatedState, setSimulatedState] = useState(null)
  const [simulatedFlowSteps, setSimulatedFlowSteps] = useState([])

  const handleSelectScenario = (scenario) => {
    setSelectedScenario(scenario)
    setSimulatedState(scenario.state)
    simulateFlow(scenario.state)
  }

  const simulateFlow = (state) => {
    const steps = []
    
    if (!state.install) {
      steps.push({ order: 1, name: '无弹窗', note: '未安装应用，不展示任何弹窗' })
    } else if (!state.workHourPluginInstalled) {
      // ========= 场景1: 未安装工时插件 =========
      let order = 1
      
      if (!state.guideDisplayed) {
        steps.push({ order: order++, name: 'Welcome 页面（优先）', note: '优先跳转初始化指引页面' })
      }
      
      steps.push({ order: order++, name: 'Expiration (权益弹窗)', note: '引导页完成后，展示权益相关弹窗' })
      steps.push({ order: order++, name: 'CustInfo (留资弹窗)', note: '展示留资收集弹窗' })
      steps.push({ order: order++, name: 'Public (公告弹窗)', note: '展示版本更新公告' })
      
    } else {
      // ========= 场景2: 已安装工时插件 =========
      let order = 1
      
      if (!state.guideDisplayed) {
        steps.push({ order: order++, name: 'CrossSpace (isv引导，优先)', note: '优先展示跨空间升级引导' })
      }
      
      steps.push({ order: order++, name: 'Expiration (权益弹窗)', note: '引导页完成后，展示权益相关弹窗' })
      steps.push({ order: order++, name: 'CustInfo (留资弹窗)', note: '展示留资收集弹窗' })
      steps.push({ order: order++, name: 'Public (公告弹窗)', note: '最后展示' })
    }
    
    setSimulatedFlowSteps(steps)
  }

  // 场景列表列配置
  const scenarioColumns = [
    { title: '场景名称', dataIndex: 'name', key: 'name', width: 200 },
    { title: '描述', dataIndex: 'desc', key: 'desc', width: 300 },
    {
      title: '安装状态',
      key: 'state',
      render: (_, record) => (
        <Space size="small">
          <Tag color={record.state.install ? 'green' : 'red'}>
            {record.state.install ? '应用已安装' : '应用未安装'}
          </Tag>
          <Tag color={record.state.workHourPluginInstalled ? 'blue' : 'orange'}>
            {record.state.workHourPluginInstalled ? '插件已安装' : '插件未安装'}
          </Tag>
          <Tag color={record.state.guideDisplayed ? 'cyan' : 'purple'}>
            {record.state.guideDisplayed ? '已看过指引' : '未看过指引'}
          </Tag>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button
          type={selectedScenario?.id === record.id ? 'primary' : 'default'}
          icon={<PlayCircleOutlined />}
          onClick={() => handleSelectScenario(record)}
        >
          模拟
        </Button>
      ),
    },
  ]

  // 流程步骤列配置
  const flowColumns = [
    { title: '顺序', dataIndex: 'order', key: 'order', width: 80, align: 'center' },
    { title: '弹窗名称', dataIndex: 'name', key: 'name', width: 200, render: (text) => <span className="step-name">{text}</span> },
    { title: '说明', dataIndex: 'note', key: 'note' },
  ]

  return (
    <div className="modal-flow-demo-page">
      <div className="demo-container">
        <Card className="demo-header-card" title={<><ExperimentOutlined /> 弹窗流程测试页面</>}>
          <Paragraph>
            这个页面用于测试和演示 <strong>MainLayout 中的弹窗优先级流程</strong>，包含两种主要场景和多种子场景。
          </Paragraph>
        </Card>

        <Card className="demo-card" title="场景选择">
          <Table
            dataSource={SCENARIOS}
            columns={scenarioColumns}
            rowKey="id"
            pagination={false}
            size="middle"
            className="scenario-table"
          />
        </Card>

        {selectedScenario && simulatedState && (
          <Card
            className="demo-card"
            title={
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <span>当前场景: {selectedScenario.name}</span>
              </Space>
            }
          >
            <Descriptions column={3} bordered size="small" className="state-desc">
              <Descriptions.Item label="应用安装状态">
                <Tag color={simulatedState.install ? 'green' : 'red'}>
                  {simulatedState.install ? '已安装' : '未安装'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="工时插件安装状态">
                <Tag color={simulatedState.workHourPluginInstalled ? 'blue' : 'orange'}>
                  {simulatedState.workHourPluginInstalled ? '已安装' : '未安装'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="是否已看过初始化指引">
                <Tag color={simulatedState.guideDisplayed ? 'cyan' : 'purple'}>
                  {simulatedState.guideDisplayed ? '是' : '否'}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <Title level={4} style={{ marginTop: 24 }}>
              模拟的弹窗流程顺序:
            </Title>
            
            <Table
              dataSource={simulatedFlowSteps}
              columns={flowColumns}
              rowKey="order"
              pagination={false}
              size="middle"
              className="flow-table"
            />
          </Card>
        )}

        <Card className="demo-card" title="弹窗优先级总览说明">
          <Paragraph>
            <QuestionCircleOutlined style={{ marginRight: 8, color: '#1890ff' }} />
            弹窗优先级按照以下规则执行，高优先级弹窗展示时会暂停低优先级，高优先级完成后才展示下一个：
          </Paragraph>

          <div className="order-explanation">
            {MODAL_ORDER_DESC.map((item, idx) => (
              <div key={idx} className="order-item">
                <Tag color="blue" style={{ width: 80, textAlign: 'center' }}>
                  Level {item.level}
                </Tag>
                <span className="order-name">{item.name}</span>
                <span className="order-note">{item.note}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
