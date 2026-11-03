import React, { useState } from 'react'
import { Button, Card, Space, Tag, message } from 'antd'
import MemberSelectModal from '../../components/member-select-modal/MemberSelectModal'

export default function MemberSelectDemo() {
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedData, setSelectedData] = useState(null)

  const handleOpenModal = () => {
    setModalOpen(true)
  }

  const handleCancel = () => {
    setModalOpen(false)
  }

  const handleConfirm = (data) => {
    console.log('选择结果:', data)
    setSelectedData(data)
    setModalOpen(false)
    message.success('选择成功！')
  }

  return (
    <div style={{ padding: 24, background: '#f5f7fa', minHeight: '100vh' }}>
      <Card
        title="成员选择弹窗演示"
        style={{ maxWidth: 880, margin: '0 auto' }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <p style={{ marginBottom: 12, color: '#666' }}>
              点击下方按钮打开成员选择弹窗，支持选择成员、团队、部门
            </p>
            <Button type="primary" size="large" onClick={handleOpenModal}>
              打开成员选择弹窗
            </Button>
          </div>

          {selectedData && (
            <div>
              <h4 style={{ marginBottom: 12, color: '#333' }}>选择结果：</h4>
              
              {selectedData.selectedMembers?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ marginBottom: 8, color: '#666', fontSize: 13 }}>
                    已选成员 ({selectedData.selectedMembers.length}人)：
                  </p>
                  <Space wrap>
                    {selectedData.selectedMembers.map(member => (
                      <Tag key={member.id} color="blue">
                        {member.name}
                      </Tag>
                    ))}
                  </Space>
                </div>
              )}

              {selectedData.selectedTeams?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ marginBottom: 8, color: '#666', fontSize: 13 }}>
                    已选团队 ({selectedData.selectedTeams.length}个)：
                  </p>
                  <Space wrap>
                    {selectedData.selectedTeams.map(team => (
                      <Tag key={team.id} color={team.color || 'purple'}>
                        {team.name}
                      </Tag>
                    ))}
                  </Space>
                </div>
              )}

              {selectedData.selectedDepartments?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ marginBottom: 8, color: '#666', fontSize: 13 }}>
                    已选部门 ({selectedData.selectedDepartments.length}个)：
                  </p>
                  <Space wrap>
                    {selectedData.selectedDepartments.map(dept => (
                      <Tag key={dept.id} color={dept.color || 'cyan'}>
                        {dept.name}
                      </Tag>
                    ))}
                  </Space>
                </div>
              )}

              <div style={{ marginTop: 16, padding: 12, background: '#f7f8fa', borderRadius: 4 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
                  选择团队时同时选中团队管理员：
                  <span style={{ color: selectedData.selectTeamAdmin ? '#52c41a' : '#ff4d4f', marginLeft: 8 }}>
                    {selectedData.selectTeamAdmin ? '是' : '否'}
                  </span>
                </p>
              </div>
            </div>
          )}
        </Space>
      </Card>

      <MemberSelectModal
        open={modalOpen}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
      />
    </div>
  )
}
