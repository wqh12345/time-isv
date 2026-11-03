import React, { useState, useEffect } from 'react'
import { Card, Button, Table, Tag, Typography, Space, Descriptions, Switch } from 'antd'
import { ExperimentOutlined, PlayCircleOutlined, CheckCircleOutlined, QuestionCircleOutlined, DatabaseOutlined } from '@ant-design/icons'
import './index.less'

const { Title, Paragraph, Text } = Typography

// 真实接口返回数据模拟
const MOCK_USER_ROLE_DATA = {
  "new-user-no-plugin": {
    code: 200,
    result: true,
    data: {
      userRole: "app_admin",
      mode: "space",
      install: true,
      workHourPluginInstalled: false,
      guideDisplayed: false,
    }
  },
  "existing-user-no-plugin": {
    code: 200,
    result: true,
    data: {
      userRole: "app_admin",
      mode: "space",
      install: true,
      workHourPluginInstalled: false,
      guideDisplayed: true,
    }
  },
  "existing-user-with-plugin-new": {
    code: 200,
    result: true,
    data: {
      userRole: "app_admin",
      mode: "space",
      install: true,
      workHourPluginInstalled: true,
      guideDisplayed: false,
    }
  },
  "existing-user-with-plugin-old": {
    code: 200,
    result: true,
    data: {
      userRole: "app_admin",
      mode: "space",
      install: true,
      workHourPluginInstalled: true,
      guideDisplayed: true,
    }
  },
  "not-installed": {
    code: 200,
    result: true,
    data: {
      userRole: "app_admin",
      mode: "space",
      install: false,
      workHourPluginInstalled: false,
      guideDisplayed: false,
    }
  }
}

// 弹窗相关接口模拟
const MOCK_EXPIRATION_DATA = {
  "has-expiration": {
    result: true,
    data: {
      messageContent: "套餐即将到期",
      planName: "专业版",
      remainingTime: 7,
      chatUrl: "https://example.com",
      planStartTime: "2026-01-01",
      planEndTime: "2026-06-30",
      msgType: 1,
    }
  },
  "no-expiration": {
    result: false,
    data: null
  }
}

const MOCK_JUDGE_HAS_RECORD = {
  "has-record": { result: true, data: true },
  "no-record": { result: true, data: false }
}

const MOCK_FULL_SCREEN_ANNOUNCEMENT = {
  "has-announcement": {
    result: true,
    data: {
      id: "123",
      title: "版本更新公告",
      content: "新版本上线了！",
      buttonText: "我知道了",
      canClosed: true,
    }
  },
  "no-announcement": {
    result: false,
    data: null
  }
}

// 场景配置
const SCENARIOS = [
  {
    id: 'new-user-no-plugin',
    name: '新用户（未安装工时插件）',
    desc: 'install=true, workHourPluginInstalled=false, guideDisplayed=false',
    userRoleData: 'new-user-no-plugin',
    expirationData: 'has-expiration',
    judgeRecordData: 'no-record',
    announcementData: 'has-announcement',
  },
  {
    id: 'existing-user-no-plugin',
    name: '老用户（未安装工时插件）',
    desc: 'install=true, workHourPluginInstalled=false, guideDisplayed=true',
    userRoleData: 'existing-user-no-plugin',
    expirationData: 'has-expiration',
    judgeRecordData: 'has-record',
    announcementData: 'has-announcement',
  },
  {
    id: 'existing-user-with-plugin-new',
    name: '老用户（已安装工时插件，未看过跨空间）',
    desc: 'install=true, workHourPluginInstalled=true, guideDisplayed=false',
    userRoleData: 'existing-user-with-plugin-new',
    expirationData: 'has-expiration',
    judgeRecordData: 'no-record',
    announcementData: 'has-announcement',
  },
  {
    id: 'existing-user-with-plugin-old',
    name: '老用户（已安装工时插件，已看过所有）',
    desc: 'install=true, workHourPluginInstalled=true, guideDisplayed=true',
    userRoleData: 'existing-user-with-plugin-old',
    expirationData: 'no-expiration',
    judgeRecordData: 'has-record',
    announcementData: 'no-announcement',
  },
  {
    id: 'not-installed',
    name: '未安装应用',
    desc: 'install=false',
    userRoleData: 'not-installed',
    expirationData: 'no-expiration',
    judgeRecordData: 'no-record',
    announcementData: 'no-announcement',
  }
]

export default function ModalFlowRealDemo() {
  const [selectedScenario, setSelectedScenario] = useState(null)
  const [simulatedFlowSteps, setSimulatedFlowSteps] = useState([])
  const [showMockDetails, setShowMockDetails] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  const handleSelectScenario = (scenario) => {
    setSelectedScenario(scenario)
    simulateFlow(scenario)
    setCurrentStep(0)
  }

  // 严格复刻 MainLayout 的 buildFlowQueue + 各弹窗内部接口判断逻辑
  const simulateFlow = (scenario) => {
    const { userRoleData, expirationData, judgeRecordData } = scenario
    const userRole = MOCK_USER_ROLE_DATA[userRoleData].data
    const hasExpiration = MOCK_EXPIRATION_DATA[expirationData].result
    const hasRecord = MOCK_JUDGE_HAS_RECORD[judgeRecordData].data
    const { install, workHourPluginInstalled, guideDisplayed } = userRole

    // 1) 未安装应用：队列为空
    if (!install) {
      setSimulatedFlowSteps([{
        order: 1,
        name: '无弹窗',
        api: 'getUserRoleInfo',
        input: userRole,
        output: 'install=false → 队列为空，不展示任何弹窗',
        willShow: false,
        status: 'completed',
      }])
      return
    }

    // 2) 按场景构建优先级队列（与 buildFlowQueue 一致）
    let queue = []
    if (!workHourPluginInstalled) {
      // 场景1：未装工时插件
      queue = [
        ...(!guideDisplayed ? ['welcome'] : []),
        'expiration',
        'custInfo',
        // 'public', // 暂时停用
      ]
    } else {
      // 场景2：已装工时插件
      queue = [
        'expiration',
        'custInfo',
        ...(!guideDisplayed ? ['crossSpace'] : []),
        // 'public', // 暂时停用
      ]
    }

    // 3) 队列步骤 → 展示信息映射（含弹窗内部「是否真正展示」的接口判断）
    const stepMeta = {
      welcome: {
        name: '跳转 Welcome 引导页',
        api: 'getUserRoleInfo / postGuideDisplayed',
        input: userRole,
        output: 'guideDisplayed=false 且未装插件 → 跳转 /welcome，完成后标记已看',
        willShow: true,
      },
      crossSpace: {
        name: 'CrossSpace 跨空间引导弹窗',
        api: 'getUserRoleInfo / postGuideDisplayed',
        input: userRole,
        output: 'guideDisplayed=false 且已装插件 → 展示，开始/关闭均标记已看',
        willShow: true,
      },
      expiration: {
        name: 'Expiration 权益弹窗',
        api: 'getPlanMessage',
        input: null,
        output: MOCK_EXPIRATION_DATA[expirationData],
        // 内部判断：result=true 才真正弹出，否则直接 onComplete 跳过
        willShow: hasExpiration,
        skipNote: hasExpiration ? '' : 'getPlanMessage 返回 result=false → 跳过，直接推进下一步',
      },
      custInfo: {
        name: 'CustInfo 留资弹窗',
        api: 'getJudgeHasRecord',
        input: null,
        output: MOCK_JUDGE_HAS_RECORD[judgeRecordData],
        // 内部判断：data=false（未留资）才弹出
        willShow: !hasRecord,
        skipNote: !hasRecord ? '' : 'getJudgeHasRecord 返回 data=true（已留资）→ 跳过',
      },
    }

    // 4) 生成展示步骤（标注每步是否真正展示）
    const steps = queue.map((step, idx) => {
      const meta = stepMeta[step] || {}
      return {
        order: idx + 1,
        step,
        name: meta.name,
        api: meta.api,
        input: meta.input,
        output: meta.skipNote ? `${meta.skipNote}` : meta.output,
        willShow: meta.willShow,
        status: idx === 0 ? 'active' : 'pending',
      }
    })

    setSimulatedFlowSteps(steps)
  }

  const handleNextStep = () => {
    if (currentStep < simulatedFlowSteps.length - 1) {
      const newSteps = [...simulatedFlowSteps]
      newSteps[currentStep].status = 'completed'
      newSteps[currentStep + 1].status = 'active'
      setSimulatedFlowSteps(newSteps)
      setCurrentStep(currentStep + 1)
    }
  }

  const handleReset = () => {
    if (selectedScenario) {
      simulateFlow(selectedScenario)
      setCurrentStep(0)
    }
  }

  // 场景列表列配置
  const scenarioColumns = [
    { title: '场景名称', dataIndex: 'name', key: 'name', width: 220 },
    { title: '状态说明', dataIndex: 'desc', key: 'desc', width: 320 },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button
          type={selectedScenario?.id === record.id ? 'primary' : 'default'}
          icon={<PlayCircleOutlined />}
          onClick={() => handleSelectScenario(record)}
        >
          开始模拟
        </Button>
      ),
    },
  ]

  // 流程步骤列配置
  const flowColumns = [
    { title: '顺序', dataIndex: 'order', key: 'order', width: 70, align: 'center' },
    {
      title: '状态',
      key: 'status',
      width: 100,
      align: 'center',
      render: (_, record) => {
        let color = 'default'
        let text = '等待'
        if (record.status === 'active') { color = 'blue'; text = '执行中' }
        if (record.status === 'completed') { color = 'green'; text = '已完成' }
        return <Tag color={color}>{text}</Tag>
      }
    },
    { title: '操作/弹窗', dataIndex: 'name', key: 'name', width: 200, render: (text) => <Text strong>{text}</Text> },
    { title: '调用接口', dataIndex: 'api', key: 'api', width: 180 },
    {
      title: '是否实际展示',
      key: 'willShow',
      width: 110,
      align: 'center',
      render: (_, record) => (
        record.willShow
          ? <Tag color="green">展示</Tag>
          : <Tag color="orange">跳过</Tag>
      )
    },
  ]

  const currentStepData = simulatedFlowSteps[currentStep]

  return (
    <div className="modal-flow-real-demo-page">
      <div className="demo-container">
        <Card className="demo-header-card" title={<><DatabaseOutlined /> 真实数据场景模拟</>}>
          <Paragraph>
            本页面模拟真实接口返回数据，展示完整的弹窗流程逻辑。
          </Paragraph>
          <Space>
            <Text type="secondary">显示接口详情:</Text>
            <Switch checked={showMockDetails} onChange={setShowMockDetails} />
          </Space>
        </Card>

        <Card className="demo-card" title="选择模拟场景">
          <Table
            dataSource={SCENARIOS}
            columns={scenarioColumns}
            rowKey="id"
            pagination={false}
            size="middle"
            className="scenario-table"
          />
        </Card>

        {selectedScenario && (
          <Card
            className="demo-card"
            title={
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <span>正在模拟: {selectedScenario.name}</span>
                <Button onClick={handleReset}>重置</Button>
              </Space>
            }
          >
            <Title level={4} style={{ marginTop: 0 }}>流程执行步骤:</Title>
            <Table
              dataSource={simulatedFlowSteps}
              columns={flowColumns}
              rowKey="order"
              pagination={false}
              size="middle"
              className="flow-table"
              footer={() => (
                <div style={{ textAlign: 'right' }}>
                  <Button
                    type="primary"
                    disabled={currentStep >= simulatedFlowSteps.length - 1}
                    onClick={handleNextStep}
                  >
                    下一步
                  </Button>
                </div>
              )}
            />

            {currentStepData && (
              <div style={{ marginTop: 24 }}>
                <Title level={5}>当前步骤详情:</Title>
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="操作名称">{currentStepData.name}</Descriptions.Item>
                  <Descriptions.Item label="调用接口">{currentStepData.api}</Descriptions.Item>
                  {showMockDetails && currentStepData.input && (
                    <Descriptions.Item label="接口输入">
                      <pre className="api-json">{JSON.stringify(currentStepData.input, null, 2)}</pre>
                    </Descriptions.Item>
                  )}
                  {showMockDetails && (
                    <Descriptions.Item label="接口输出/执行结果">
                      {typeof currentStepData.output === 'string' ? (
                        <Text>{currentStepData.output}</Text>
                      ) : (
                        <pre className="api-json">{JSON.stringify(currentStepData.output, null, 2)}</pre>
                      )}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </div>
            )}
          </Card>
        )}

        <Card className="demo-card" title="核心逻辑规则（队列模式）">
          <div className="rules-box">
            <h4>队列构建：buildFlowQueue 按场景排序</h4>
            <ul>
              <li><strong>场景1</strong>（未装工时插件）：<code>welcome(未看引导) → expiration → custInfo</code></li>
              <li><strong>场景2</strong>（已装工时插件）：<code>expiration → custInfo → crossSpace(未看引导)</code></li>
              <li><code>install=false</code> → 队列为空，不展示任何弹窗</li>
              <li>Public 公告弹窗暂时停用（队列中已注释）</li>
            </ul>
            <h4>各步骤内部「是否实际展示」判断</h4>
            <ul>
              <li>welcome / crossSpace：仅 <code>guideDisplayed=false</code> 时入队，完成后调 <code>postGuideDisplayed</code> 标记已看</li>
              <li>expiration：<code>getPlanMessage</code> 返回 result=true 才展示，否则跳过推进</li>
              <li>custInfo：<code>getJudgeHasRecord</code> 返回 data=false（未留资）才展示，否则跳过</li>
            </ul>
            <h4>串行推进 + 中断恢复</h4>
            <ul>
              <li>每个弹窗 onComplete → <code>goNextFlowStep()</code> 索引+1，执行下一步</li>
              <li>高优先级未完成，低优先级绝不出现（任一时刻仅一个弹窗）</li>
              <li>welcome 跳转返回后，监听 pathname+guideDisplayed 自动续接，不重头开始</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  )
}
