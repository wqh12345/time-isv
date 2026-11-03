import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Menu,
  Tabs,
  Card,
  Button,
  Tag,
  Switch,
  Avatar,
  Table,
  Space,
  Tooltip,
  Modal,
  Input,
  Empty,
  Radio,
  Spin,
} from 'antd'
import {
  UserOutlined,
  ExclamationCircleFilled,
  CloseOutlined,
  EditOutlined,
  FormOutlined,
  CrownOutlined,
  RightOutlined,
  SafetyOutlined,
  InfoCircleFilled,
} from '@ant-design/icons'
// 菜单图标 - 自定义图片（蓝色 = 选中态，灰度滤镜处理未选态）
import iconModeSet from '../../assets/card-edit.png'
import iconBasicSet from '../../assets/images/mbsettins.png'
import iconPermSet from '../../assets/setting-4.png'
import iconAdminUser from '../../assets/profile-tick.png'
import iconSpaceConfig from '../../assets/color-swatch@2x.png'
import iconCustomField from '../../assets/images/custom-field.png'
import iconAdd from '../../assets/images/add.png'
import JSSDK from '../../jssdk-adapter'
import {
  getRegistrationSettings,
  getProjectAdminList,
  postSetProjectAdmin,
  postSetProjectMember,
  getProjectConfig,
  postProjectConfig,
  getMeasureProjectConfig,
  getRefreshTeam,
  getApprovalSettings,
  queryDataAuthConfigCount,
  getDataAuthConfig,
  saveDataAuthConfig,
  queryIsvDataAuthConfigCount,
  getIsvDataAuthConfig,
  saveIsvDataAuthConfig,
  getWorkHourReminderConfig,
  getStandardsConfig,
  getStandardsConfigDetail,
  getStandardsConfigIsv,
  getStandardsConfigDetailIsv,
  postChangeMode,
  getInstallList,
  getAdminList,
  getAppAdminList,
  getWebhookUserList,
  getProjectMemberList,
  postAddAppAdmin,
  deleteAppAdminByIds,
  deleteDataAuthAppPermission,
  deleteDataAuthPermission,
  deleteSpecialNodeFlowConfig,
  postSearchMember,
  getUserRoleInfo,
} from '../../api/api'
import { getAppMode, setAppMode, isISV, getUserRole, setUserRole } from '../../config/auth'
import WorkHourSettings from '../../components/set/capacity-set/WorkHourSettings'
import MeasureSet from '../../components/set/measure-set/MeasureSet'
import ApprovalSet from '../../components/set/approval-set/ApprovalSet'
import NotificationSet from '../../components/set/notification-set/notificationSet'
import PermissionsSet from '../../components/set/permissions-set/permissionsSet'
import StandardsSet from '../../components/set/standards-set/StandardsSet'
import SelectedAuthUser from '../../components/set/auth-user/SelectedUser'
import SyncTeamBtn from '../../components/sync-team-btn/SyncTeamBtn'
import SelectedUser from '../../components/selected-user/SelectedUser'
import MemberSelectModal from '../../components/member-select-modal/MemberSelectModal'
import {
  CustomFieldSettings,
  CustomFieldSummary,
} from '../../components/set/custom-field-set/CustomFieldSettings'
import './index.less'
import team_img from '../../assets/team.png'
import dept_img from '../../assets/dept.png'
import noDataImg from '../../assets/images/no-data.png'
import authLeftIcon from '../../assets/images/auth_left.png'
import authRightIcon from '../../assets/images/auth_right.png'
import backIcon from '../../assets/组 72825@2x.png'

/**
 * 系统设置页面
 *
 * 布局：
 *   ┌──────────────┬───────────────────────────────────────┐
 *   │ 左侧菜单     │ 主内容区（根据所选菜单展示）          │
 *   │ - 管理模式   │ ┌── 顶部标题（如：产品设计空间配置） │
 *   │ - 租户配置   │ ┌── Tabs（登记/统计/审批/权限/通知/插件管理员）
 *   │ - 空间配置   │ └── 各 Card 块                        │
 *   └──────────────┴───────────────────────────────────────┘
 *
 * 注：当前为 UI 还原；交互入口与按钮已就位，所有数据均通过接口接入。
 */

const AdminEmpty = ({ description = '暂无数据' }) => (
  <Empty
    image={noDataImg}
    imageStyle={{ height: 90 }}
    description={<span className="admin-empty-desc">{description}</span>}
  />
)

// 「允许管理员代填工时」提示文案：根据当前模式动态展示
const getAllowFillTip = () => {
  const mode = getAppMode() || 'space'
  return mode === 'tenant'
    ? '开启后，应用管理员可在全部空间为成员进行「登记工时」的填报、编辑、删除；插件管理员可在其管理的空间内为成员进行「登记工时」的填报、编辑、删除'
    : '开启后，应用管理员和插件管理员可在该空间为成员进行「登记工时」的填报、编辑、删除'
}

// ---------------------------------------------------------- 顶层菜单
const buildMenuItems = (spaces, onSpaceItemClick, selectedKey) => {

  const currentMode = getAppMode() || 'space'
  const isTenant = currentMode === 'tenant'
  const userRole = getUserRole()
  // 只有 app_admin 可以看到“管理模式”和“租户配置”
  const showAdminMenus = userRole === 'app_admin'

  const menuItems = []

  // 管理模式
  if (showAdminMenus) {
    menuItems.push({
      key: 'g-mode',
      type: 'group',
      label: '管理模式',
      children: [
        { key: 'mode-setting', icon: <img src={iconModeSet} width={16} height={16} style={{ objectFit: 'contain' }} />, label: '模式设置' },
      ],
    })
  }

  // 租户配置组：基础设置和权限设置仅在租户模式下展示
  if (showAdminMenus) {
    menuItems.push({
      key: 'g-tenant',
      type: 'group',
      label: '租户配置',
      children: [
        ...(isTenant ? [
          { key: 'tenant-base', icon: <img src={iconBasicSet} width={16} height={16} style={{ objectFit: 'contain' }} />, label: '基础设置' },
          { key: 'tenant-perm', icon: <img src={iconPermSet} width={16} height={16} style={{ objectFit: 'contain' }} />, label: '权限设置' },
        ] : []),
        { key: 'tenant-custom-field', icon: <img src={iconCustomField} width={16} height={16} style={{ objectFit: 'contain' }} />, label: '自定义字段设置' },
        { key: 'tenant-admin', icon: <img src={iconAdminUser} width={16} height={16} style={{ objectFit: 'contain' }} />, label: '应用管理员' },
      ],
    })
  }

  // 空间配置
  menuItems.push({
      key: 'g-space',
      type: 'group',
      label: <span>空间配置</span>,
      children: [
        {
          // 用一个不可点击的虚拟节点承载滚动容器，平铺展示所有空间
          key: 'space-config-list',
          style: { height: 'auto', lineHeight: 'normal', padding: 0, cursor: 'default', background: 'transparent' },
          className: 'admin-space-list-item',
          label: (
            <div className="admin-space-scroll">
              {spaces.map((s) => (
                <div
                  key={s.key}
                  data-space-key={s.key}
                  className={`admin-space-item-flat ${s.key === selectedKey ? 'selected' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSpaceItemClick && onSpaceItemClick(s.key)
                  }}
                >
                  <span className="admin-space-label">{s.label}</span>
                </div>
              ))}
            </div>
          ),
          // 禁用点击：通过 disabled 让 antd 不触发选择，再在外层 onClick 中通过 data-space-key 处理
          disabled: false,
        },
      ],
    })
  return menuItems
}

// ---------------------------------------------------------- 通用：Section Card
const SectionCard = ({ title, extra, statusTag, desc, children, className, hideBody }) => (
  <Card
    className={`admin-section ${hideBody ? 'admin-section-hide-body' : ''} ${className || ''}`}
    title={
      <div className="admin-section-title-wrap">
        <div className="admin-section-title">
          <span className="admin-section-title-text">{title}</span>
          {statusTag}
        </div>
        {desc && <div className="admin-section-subtitle">{desc}</div>}
      </div>
    }
    extra={extra}
  >
    {children}
  </Card>
)

// ---------------------------------------------------------- 子模块：登记设置
// 全部 Panel 均使用父级下发的真实接口数据渲染，按钮点击回调由父级统一记忆并打开对应 Modal

const RegistrationSettingPanel = ({ data = {}, onEdit, registerLevelConfigVos = [], onDeleteSpecial }) => {
  const list = data?.list || []
  const item = list[0] || {}

  // 工作描述是否必填（0/1）
  const descRequired = data?.workDescReq == 1
  // 成员可登记范围：0=全部登记对象，1=仅限本人负责的登记对象
  const myselfStatus = Number(item.myselfStatus ?? 0)
  const memberScopeText = myselfStatus === 1 ? '仅限本人负责的登记对象' : '全部登记对象'
  // 默认可登记层级：取 registerLevelConfigVos 中 configType==='global' 那条的 registerLevelVoList
  const globalLevelConfig = (registerLevelConfigVos || []).find((c) => c.configType === 'global')
  const defaultLevels = globalLevelConfig?.registerLevelVoList || []
  // 特殊节点流配置：排除 global
  const specialList = (registerLevelConfigVos || []).filter((c) => c.configType !== 'global')

  return (
    <SectionCard
      title="登记设置"
      desc="设置后，基于此标准约束工时填报"
      extra={<Button onClick={onEdit}>设置</Button>}
    >
      {/* 登记规则 */}
      <div className="admin-block">
        <div className="admin-block-title">登记规则</div>
        <div className="admin-grid-3">
          <KvLine
            label="管理员填报设置"
            value={data?.adminImpact == 1 ? <Tag className="admin-tag-blue">开启</Tag> : <Tag className="admin-tag-grey">关闭</Tag>}
          />
          <KvLine
            label="工作描述是否必填"
            value={descRequired ? <Tag color="green">必填</Tag> : <Tag className="admin-tag-grey">非必填</Tag>}
          />
          <KvLine
            label="提前天数限制"
            value={data?.enableAdvanceDay == 1
              ? <span className="admin-blue">{data?.inAdvanceDay ?? '--'} 天</span>
              : <Tag color="orange">未启用</Tag>}
          />
          <KvLine
            label="未来日期限制"
            value={data?.enableFutureDay == 1
              ? <span className="admin-blue">{data?.futureDay ?? '--'} 天</span>
              : <Tag color="orange">未启用</Tag>}
          />
        </div>
      </div>

      {/* 登记范围 */}
      <div className="admin-block">
        <div className="admin-block-title">登记范围</div>
        <div className="admin-kv">
          <span className="admin-kv-label">成员可登记范围：</span>
          <span className="admin-kv-value">{memberScopeText}</span>
        </div>
        <div className="admin-kv" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <span className="admin-kv-label" style={{ flexShrink: 0 }}>可登记工作项：</span>
          <span className="admin-tag-wrap" style={{ flex: 1 }}>
            {list.length > 0 ? (
              <>
                {list.slice(0, 15).map((t, i) => (
                  <Tooltip key={i} title={t.canRegistWorkItemName}>
                    <Tag className="admin-tag-grey">{t.canRegistWorkItemName}</Tag>
                  </Tooltip>
                ))}
                {list.length > 15 && (
                  <Tooltip
                    title={
                      <div style={{ maxWidth: 500 }}>
                        {list.map((t, idx) => (
                          <span key={idx}>
                            {t.canRegistWorkItemName}
                            {idx < list.length - 1 ? '；' : ''}
                          </span>
                        ))}
                      </div>
                    }
                  >
                    <Tag className="admin-tag-grey" style={{ cursor: 'pointer' }}>...</Tag>
                  </Tooltip>
                )}
              </>
            ) : (
              <span className="admin-text-grey">--</span>
            )}
          </span>
        </div>
      </div>

      {/* 禁填设置 */}
      <div className="admin-block">
        <div className="admin-block-title">禁填设置</div>
        <div className="admin-grid-3">
          <KvLine
            label="工作项实例"
            value={(item.entityStatus || []).length
              ? (item.entityStatus || []).map((s, i) => (
                <Tag key={i} className="admin-tag-blue">
                  {s === 1 ? '已冻结' : s === 2 ? '已终止' : s === 3 ? '已完成' : ''}
                </Tag>
              ))
              : <span className="admin-text-grey">--</span>}
          />
          <KvLine label="节点" value={item.nodeStatus === 1 ? <Tag className="admin-tag-blue">已完成</Tag> : <span className="admin-text-grey">--</span>} />
          <KvLine label="任务" value={item.taskStatus === 1 ? <Tag className="admin-tag-blue">已完成</Tag> : <span className="admin-text-grey">--</span>} />
        </div>
      </div>

      {/* 节点流默认可登记层级 */}
      <div className="admin-block">
        <div className="admin-block-title">节点流默认可登记层级</div>
        <div className="admin-tag-wrap">
          {defaultLevels.length > 0
            ? defaultLevels.map((lv, i) => (
              <Tag key={i} className="admin-tag-blue">{lv.typeDescribe || '--'}</Tag>
            ))
            : <span className="admin-text-grey">--</span>}
        </div>
      </div>

      {/* 特殊节点流配置：无数据时整个块（含标题）不展示 */}
      {specialList.length > 0 && (
      <div className="admin-block">
        <div className="admin-block-title">特殊节点流配置</div>
          <div className="admin-special-table">
            <div className="admin-special-row admin-special-head">
              <span className="admin-special-cell">工作项</span>
              <span className="admin-special-cell">可登记层级</span>
              <span className="admin-special-cell admin-special-cell-op">操作</span>
            </div>
            {specialList.map((cfg, idx) => {
              const levelNames = (cfg.registerLevelVoList || []).map((v) => v.typeDescribe).filter(Boolean).join('、') || '--'
              return (
                <div key={cfg.id || idx} className="admin-special-row">
                  <span className="admin-special-cell">{cfg.workItemName || '--'}</span>
                  <span className="admin-special-cell">{levelNames}</span>
                  <span className="admin-special-cell admin-special-cell-op">
                    <span className="admin-link" onClick={() => onDeleteSpecial && onDeleteSpecial(cfg)}>删除</span>
                  </span>
                </div>
              )
            })}
          </div>
      </div>
      )}
    </SectionCard>
  )
}

// ---------------------------------------------------------- 子模块：统计设置
const StatsSettingPanel = ({ data = {}, onEdit }) => {
  const bindWorkItemNames = data?.bindWorkItemNames || data?.bindWorkItemName || data?.bindWorkItems?.map?.((item) => item.name).join('、') || '--'

  return (
    <SectionCard
      title="统计设置"
      statusTag={
        <Tag color={data?.value ? 'green' : 'orange'} className="admin-status-tag">
          {data?.value ? '已启用' : '未启用'}
        </Tag>
      }
      desc={data?.value ? "设置部分工作项的工时数据被度量消费" : ""}
      extra={<Button onClick={onEdit}>设置</Button>}
      hideBody={!data?.value}
    >
      <div className="admin-stats-summary">
        <div className="admin-stats-item">
          <div className="admin-stats-label">
            <FieldLabel tip="此工作项将用于存放工时日志的原始数据，实现工时的度量消费">工时统计工作项</FieldLabel>
          </div>
          <div className="admin-stats-value">{data?.value && data?.measureWorkItemName ? data.measureWorkItemName : ''}</div>
        </div>
        <div className="admin-stats-item">
          <div className="admin-stats-label">
            <FieldLabel tip="开启后，该工作项的工时数据会被统计工作项度量消费">启用工作项</FieldLabel>
          </div>
          <div className="admin-stats-value">{data?.value ? bindWorkItemNames : '--'}</div>
        </div>
      </div>
    </SectionCard>
  )
}

// ---------------------------------------------------------- 子模块：工时审批设置
const ApprovalSettingPanel = ({ data = {}, onEdit }) => {
  // approvalType === 2：飞书审批模式，仅展示「审批方式」「审批规则」两个字段
  const isFeishuApproval = data?.approvalType === 2
  return (
    <SectionCard
      title="工时审批设置"
      statusTag={
        <Tag color={data?.value ? 'green' : 'orange'} className="admin-status-tag">
          {data?.value ? '已启用' : '未启用'}
        </Tag>
      }
      desc={data?.value ? "工时审批的规则配置，若开启工时审批，登记工时需通过审批后才算有效工时" : ""}
      extra={<Button onClick={onEdit}>设置</Button>}
      hideBody={!data?.value}
    >
      {isFeishuApproval ? (
        <div className="admin-approval-summary">
          <div className="admin-approval-item">
            <div className="admin-approval-label">审批方式</div>
            <div className="admin-approval-value">飞书审批</div>
          </div>
          <div className="admin-approval-item">
            <div className="admin-approval-label">审批规则</div>
            <div className="admin-approval-value">已配置 {data?.ruleCount || 0} 条</div>
          </div>
        </div>
      ) : (
        <div className="admin-approval-summary">
          <div className="admin-approval-item">
            <div className="admin-approval-label">
              <FieldLabel tip="提供指定成员、团队审批、角色审批三种模式，适配不同审批场景">审批模式</FieldLabel>
            </div>
            <div className="admin-approval-value">{data?.value && data?.approvalName ? data.approvalName : '--'}</div>
          </div>
          <div className="admin-approval-item">
            <div className="admin-approval-label">多人审批时采用的审批方式</div>
            <div className="admin-approval-value">{data?.value && data?.approvalRuleName ? data.approvalRuleName : '--'}</div>
          </div>
          <div className="admin-approval-item">
            <div className="admin-approval-label">
              <FieldLabel tip="负责审批工时的人员">审批人</FieldLabel>
            </div>
            <div className="admin-approval-value">{data?.value && data?.approvalUser ? data.approvalUser : '--'}</div>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

// ---------------------------------------------------------- 子模块：权限设置
// 可见数据范围描述映射
const getScopeDescription = (value) => {
  const v = typeof value === 'string' ? value.toLowerCase() : ''
  switch (value) {
    case 'isv_all_data':
      return '可以查看所有成员、团队和部门数据'
    case 'all_data':
      return '可以查看所有成员和团队的数据'
    case 'my_teams':
      return '仅能查看自己管理的团队内所有成员的数据'
    case 'specified_members':
      return '手动选择可查看的成员数据'
    case 'all_teams':
      return '可查看该空间下所有授权团队'
    case 'specified_teams':
      return '手动选择可查看的团队数据'
    case 'specified_departments':
    case 'specified_department':
    case 'specified_dept':
      return '手动选择可查看的部门数据'
    default:
      if (v.includes('dept') || v.includes('department')) return '手动选择可查看的部门数据'
      return '--'
  }
}

const PermissionPanel = ({
  allowFill,
  onAllowFillChange,
  configCount,
  authConfigs = [],
  authLoading = false,
  onEdit,
  onRefresh,
}) => {

  // 渲染授权对象
  const renderAuthObj = (row) => {
    const dataScope = row?.authObj
    // 全部成员场景
     if (dataScope === 'admin_administrator') {
      return <span className="admin-perm-value">应用管理员</span>
    }
    if (dataScope === 'plugin_administrator') {
      return <span className="admin-perm-value">插件管理员</span>
    }
    if (dataScope === 'team_administrator') {
      return <span className="admin-perm-value">团队管理员</span>
    }
    if (dataScope === 'all_members') {
      return <span className="admin-perm-value">所有成员</span>
    }
    // ISV接口：授权对象成员从 dataAuthUserVos 取值，团队/部门从 dataAuthExtraVos 取
    const isSpecifiedMembers = row?.authObj === 'specified_members'
    const items = isSpecifiedMembers
      ? (row?.dataAuthUserVos || row?.dataAuthOutIdVos || row?.authObjVos || [])
      : (row?.authObjVos || row?.dataAuthExtraVos || [])
    if (!items.length) return <span className="admin-perm-value">{row?.authObjValue || '--'}</span>
    return (
      <div className="admin-avatar-wrap">
        {items.slice(0, 8).map((u, i) => {
          const isTeam = !!(u?.teamId || u?.teamName)
          const isDept = !!(u?.deptId || u?.departmentId || u?.deptName || u?.departmentName)
          const name = u?.userName || u?.teamName || u?.deptName || u?.departmentName || u?.staffName || '--'
          const avatarSrc = (isTeam || isDept) ? TEAM_DEFAULT_AVATAR : u?.avatarUrl
          return (
            <span key={u?.outId || u?.unionId || u?.userKey || u?.teamId || u?.deptId || u?.departmentId || i} className="admin-avatar-chip">
              <Avatar size={20} src={avatarSrc} className="admin-avatar-name">
                {!avatarSrc && name.charAt(0)}
              </Avatar>
              <span className="admin-avatar-chip-name">{name}</span>
            </span>
          )
        })}
        {items.length > 8 && (
          <Tooltip
            title={items.map((u) => u?.userName || u?.teamName || u?.deptName || u?.departmentName || u?.staffName || '--').join('、')}
          >
            <span className="admin-avatar-chip" style={{ cursor: 'pointer' }}>
              <span className="admin-avatar-chip-name">+{items.length - 8}</span>
            </span>
          </Tooltip>
        )}
      </div>
    )
  }

  // 渲染可见数据范围
  const renderDataScope = (row) => {
    const vos = row?.dataAuthExtraVos || []
    if (!vos.length) return <span className="admin-perm-value admin-text-grey">--</span>
    const firstScope = vos[0]?.dataScope
    const firstValue = vos[0]?.dataScopeValue
    if(firstScope === 'isv_all_data' || firstScope === 'all_data' || firstScope === 'my_teams' || firstScope === 'all_teams' || firstScope === 'only_myself'){
        return <span className="admin-perm-value">{firstValue}</span>
    }
    // 取首个 dataScope 描述
    const desc = getScopeDescription(firstScope)
    // 兼容后端返回的部门枚举 specified_department / specified_dept
    const scopeValue = typeof firstScope === 'string' ? firstScope.toLowerCase() : ''
    const isDeptScope = scopeValue.includes('dept') || scopeValue.includes('specified_department')
    const isTeamScope = firstScope === 'specified_teams'
    // 当为 specified_members/specified_teams/部门 时附加具体名称
    // if (firstScope === 'specified_members') {
    //   vos=row.dataAuthUserVos
    // }
    if (firstScope === 'specified_members' || isTeamScope || isDeptScope) {
      const names = vos
        .map((v) => v?.userName || v?.teamName || v?.deptName || v?.departmentName || v?.staffName)
        .filter(Boolean)
      return (
        <span className="admin-perm-value">
          <span className="admin-avatar-wrap" style={{ display: 'inline-flex', verticalAlign: 'middle', marginLeft: 4 }}>
            {vos.slice(0, 8).map((v, i) => {
              const name = v?.userName || v?.teamName || v?.deptName || v?.departmentName || v?.staffName || '--'
              const avatarSrc = isTeamScope ? team_img : isDeptScope ? dept_img : v?.avatarUrl
              return (
                <span key={v?.outId || v?.unionId || v?.teamId || v?.deptId || v?.departmentId || i} className="admin-avatar-chip">
                  <Avatar size={20} src={avatarSrc} className="admin-avatar-name">
                    {!avatarSrc && name.charAt(0)}
                  </Avatar>
                  <span className="admin-avatar-chip-name">{name}</span>
                </span>
              )
            })}
            {vos.length > 8 && (
              <Tooltip title={names.join('、')}>
                <span className="admin-avatar-chip" style={{ cursor: 'pointer' }}>
                  <span className="admin-avatar-chip-name">+{vos.length - 8}</span>
                </span>
              </Tooltip>
            )}
          </span>
        </span>
      )
    }
  }
  const handleDelSetting2 = async(row) => {
    if (row.isDefault) return
    const res = await deleteDataAuthPermission({ id: row.id })
    if (res?.result) {
      JSSDK?.toast?.success?.('删除成功')
      onRefresh?.()
    } else {
      JSSDK?.toast?.warning?.('删除失败，请重试')
    }
    // Modal.confirm({
    //   title: '确定删除该权限规则？',
    //   icon: <ExclamationCircleFilled />,
    //   content: '删除后不可恢复，请确认操作。',
    //   okText: '确定',
    //   okType: 'danger',
    //   cancelText: '取消',
    //   closeIcon: <CloseOutlined />,
    //   async onOk() {
    //     const res = await deleteDataAuthPermission({ id: row.id })
    //     if (res?.result) {
    //       JSSDK?.toast?.success?.('删除成功')
    //       onRefresh?.()
    //     } else {
    //       JSSDK?.toast?.warning?.('删除失败，请重试')
    //     }
    //   },
    // })
  }
  return (
    <SectionCard
      title="权限设置"
      desc="管理用户权限，控制成员操作范围及能力"
      extra={<Button onClick={onEdit}>设置</Button>}
    >
      <div className="admin-block">
        <div className="admin-block-title">
          <FieldLabel tip={getAllowFillTip()}>允许管理员代填工时</FieldLabel>
        </div>
        <Switch checked={!!allowFill} onChange={onAllowFillChange} />
      </div>
      <div className="admin-block">
        <div className="admin-block-title">数据权限</div>
        <div className="admin-section-desc">
          配置成员在资源管理、工时日志、工时管理页面的数据可见权限。已配置{' '}
          <span className="admin-blue">{configCount || authConfigs.length || 0}</span> 个权限规则
        </div>
        <div className="admin-perm-rules">
          {authLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="small" />
            </div>
          ) : authConfigs.length > 0 ? (
            authConfigs.map((row, idx) => (
              <div key={row.id || idx} className="admin-perm-rule">
                <div className="admin-perm-rule-no">规则{idx + 1}</div>
                <div className="admin-perm-rule-body">
                  <div className="admin-perm-row">
                    <span className="admin-perm-label">授权对象</span>
                    {renderAuthObj(row)}
                  </div>
                  <div className="admin-perm-row">
                    <span className="admin-perm-label">可见数据范围</span>
                    {renderDataScope(row)}
                  </div>
                </div>
                <div >
                 <a
                    className={`admin-link admin-perm-del${row.isDefault ? ' admin-perm-del-disabled' : ''}`}
                    onClick={row.isDefault ? undefined : () => handleDelSetting2(row)}
                    style={row.isDefault ? { color: '#bfbfbf', cursor: 'not-allowed', pointerEvents: 'none' } : undefined}
                  >
                    删除
                  </a>
                  </div>
                  
              </div>
            ))
          ) : null}
        </div>
      </div>
    </SectionCard>
  )
}

// ---------------------------------------------------------- 子模块：消息通知
const NotificationPanel = ({ data = {}, allUsers = [], onEdit }) => {
  const enabled = data?.commonConfigVo?.value
  return (
    <SectionCard
      title="消息通知"
      desc="支持配置各类消息的通知规则,触发飞书项目的消息提醒"
      extra={<Button onClick={onEdit}>设置</Button>}
    >
      <div className="admin-block">
        <div className="admin-block-title">
          <FieldLabel tip="对应提醒频率周期内任意工作日未登记工时的用户，将按配置自动发送提醒。工时登记提醒需同时配置：①本插件设置页的提醒时间、提醒成员；②飞书项目的触发器（触发器配置可参考帮助手册）">工时登记提醒</FieldLabel>
        </div>
        <div className="admin-grid-3">
          <KvLine
            label="提醒状态"
            value={<Tag color={enabled ? 'green' : 'orange'}>{enabled ? '已启用' : '未启用'}</Tag>}
          />
          <KvLine
            label="提醒频率"
            value={enabled && data?.remindFrequencyDescribe ? data.remindFrequencyDescribe : '--'}
          />
          <KvLine
            label="提醒时间"
            value={
              enabled && data?.remindDateDescribe && data?.remindTime
                ? `${data.remindDateDescribe}${data.remindTime}`
                : '--'
            }
          />
        </div>
        <div className="admin-kv">
          <span className="admin-kv-label">提醒对象：</span>
          {enabled && allUsers.length > 0 ? (
            <div className="admin-tag-wrap">
              
              {allUsers.slice(0, 30).map((u, i) => (
                <Tag key={i} className="admin-tag-blue">
                  {u.teamId ? (
                    u.teamName
                  ) : u.departmentId ? (
                    u.departmentName
                  ) : (
                    <>
                      {u.avatarUrl && (
                        <Avatar size={18} src={u.avatarUrl} className="admin-avatar-inline" />
                      )}{' '}
                      {u.userName}
                    </>
                  )}
                </Tag>
              ))}
              {allUsers.length > 30 && <Tag className="admin-tag-blue">...</Tag>}
            </div>
          ) : (
            <span className="admin-text-grey">--</span>
          )}
        </div>
      </div>
    </SectionCard>
  )
}

// ---------------------------------------------------------- 子模块：插件管理员
const PluginAdminPanel = ({ list = [], staffUserKey, onAdd, onDelete }) => (
  <SectionCard
    title="插件管理员"
    desc={
      <>
        即拥有【工时资源管理】插件的管理权限（即编辑当前页）与全局数据查询权限的成员。
        <br />
        无插件管理员时，空间管理员可在插件设置-配置页中管理插件
      </>
    }
    extra={<Button type="default"  onClick={onAdd}>添加插件管理员</Button>}
  >
    <Table
      size="small"
      pagination={false}
      rowKey={(r) => r.staffId || r.staffUserKey || r.id}
      dataSource={list}
      locale={{ emptyText: <AdminEmpty description="暂无管理员" /> }}
      columns={[
        {
          title: '成员',
          dataIndex: 'staffName',
          render: (_, r) => (
            <Space>
              <Avatar size={24} src={r.staffAvatarUrl} icon={<UserOutlined />} />
              <span>{r.staffName || '--'}</span>
            </Space>
          ),
        },
        {
          title: '添加人',
          dataIndex: 'operatorName',
          render: (_, r) => (
            <Space>
              {r.operatorAvatarUrl ? (
                <Avatar size={24} src={r.operatorAvatarUrl} icon={<UserOutlined />} />
              ) : null}
              <span>{r.operatorName || '--'}</span>
            </Space>
          ),
        },
        { title: '添加时间', dataIndex: 'operationTime' },
        {
          title: '操作',
          dataIndex: 'op',
          width: 100,
          render: (_, r) =>
            r.staffUserKey === staffUserKey ? (
              <span className="admin-text-grey">当前账号</span>
            ) : (
              <a className="admin-link" onClick={() => onDelete(r)}>删除</a>
            ),
        },
      ]}
    />
  </SectionCard>
)

// ---------------------------------------------------------- 子模块：记录规范设置（仅空间模式展示）
const StandardRulePanel = ({ projectKey }) => {
  const navigate = useNavigate()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)

  // 加载记录规范列表
  const loadStandardsConfig = async () => {
    setLoading(true)
    try {
      const res = await getStandardsConfig({ projectKey })
      if (res?.result && Array.isArray(res?.data)) {
        setList(res.data)
      }
    } catch (e) {
      console.error('加载记录规范失败:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!projectKey) return
    loadStandardsConfig()
  }, [projectKey])

  // 添加记录规范，跳转到独立子页面
  const handleAdd = () => {
    navigate('/admin/standard-setting', { state: { isAdd: 1, from: 'space-config' } })
  }

  // 编辑记录规范
  const handleEdit = async (item) => {
    try {
      // isDefault 取列表项里 getConfig/out 返回的值
      const res = await getStandardsConfigDetail({ id: item.id, projectKey, isDefault: !!item.isDefault })
      const editData = res?.result ? res.data : item
      navigate('/admin/standard-setting', {
        state: { isAdd: 0, editData, from: 'space-config' },
      })
    } catch (e) {
      console.error('获取记录规范详情失败:', e)
      navigate('/admin/standard-setting', {
        state: { isAdd: 0, editData: item, from: 'space-config' },
      })
    }
  }

  return (
    <SectionCard
      title="记录规范设置"
      desc="设置不同记录组，规范不同人员的记录规则"
      extra={
        <Button className="admin-section-header-btn" type="default" onClick={handleAdd}>
          添加记录规范
        </Button>
      }
    >
      <div className="admin-rules-grid">
        {loading ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0' }}>
            <Spin size="small" />
          </div>
        ) : list.length > 0 ? (
          [...list].filter(r => r != null).sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0)).map((r) => (
            <div
              key={r.id || r.standardsName}
              className="admin-rule-card"
              onClick={() => handleEdit(r)}
            >
              <div className="admin-rule-header">
                <Tooltip title={r.standardsName || '--'} placement="topLeft">
                  <span className="admin-rule-name">{r.standardsName || '--'}</span>
                </Tooltip>
                {r.isDefault && <Tag className="admin-rule-tag">默认</Tag>}
                <RightOutlined className="admin-rule-arrow" />
              </div>
              <div className="admin-rule-count">
                <span className="admin-blue">{r.count || 0}</span> 人
              </div>
            </div>
          ))
        ) : (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0' }}>
            <AdminEmpty description="暂无记录规范" />
          </div>
        )}
      </div>
    </SectionCard>
  )
}

const FieldLabel = ({ children, tip }) => (
  <span className="admin-field-label">
    {children}
    {tip ? (
      <Tooltip title={tip}>
        <InfoCircleFilled className="admin-field-tip" />
      </Tooltip>
    ) : null}
  </span>
)

// ---------------------------------------------------------- KV 行
const KvLine = ({ label, value }) => (
  <div className="admin-kv">
    <span className="admin-kv-label">
      {label}：
    </span>
    <span className="admin-kv-value">{value}</span>
  </div>
)

// ---------------------------------------------------------- 空间配置主区域
// 锡点节点：仅包含 key + label，具体渲染由父级 panelMap 绑定真实数据与回调
const SECTIONS = [
  { key: 'reg', label: '登记设置' },
  { key: 'stats', label: '统计设置' },
  { key: 'approval', label: '工时审批设置' },
  { key: 'perm', label: '权限设置' },
  { key: 'notify', label: '消息通知' },
  { key: 'plugin', label: '插件管理员' },
]

// 空间配置 Tabs 显隐规则：
//   - 租户模式：所有角色均隐藏「记录规范设置」和「权限设置」
//   - 空间模式：app_admin / space_admin 均展示「记录规范设置」和「权限设置」
const buildSections = (mode, userRole) => {
  const isTenant = mode === 'tenant'

  // 将「记录规范设置」插入到「统计设置」与「工时审批设置」之间
  const insertStandard = (sections) => {
    const idx = sections.findIndex((s) => s.key === 'approval')
    if (idx < 0) return [...sections, { key: 'standard', label: '记录规范设置' }]
    return [
      ...sections.slice(0, idx),
      { key: 'standard', label: '记录规范设置' },
      ...sections.slice(idx),
    ]
  }

  if (isTenant) {
    // 租户模式：所有角色均不展示「权限设置」和「记录规范设置」这两个空间配置 tab
    return SECTIONS.filter((section) => section.key !== 'perm' && section.key !== 'standard')
  }

  // 空间模式：app_admin / space_admin 均展示完整的配置项（含记录规范设置和权限设置）
  return insertStandard(SECTIONS)
}

// 锥点偏移：滚动到 section 顶部时预留的内边距（容器内滚动，无需考虑顶部 fixed 高度）
const ANCHOR_GAP = 8

const SpaceConfigContent = ({ space }) => {
  const location = useLocation()
  const navigate = useNavigate()
  // 当前应用模式（空间模式下展示「记录规范设置」tab）
  const currentMode = useMemo(() => getAppMode() || 'space', [])
  const userRole = useMemo(() => getUserRole(), [])
  const sections = useMemo(() => buildSections(currentMode, userRole), [currentMode, userRole])
  // 默认始终定位到第一个区块
  const [tab, setTab] = useState(sections[0].key)
  // 点击 Tabs 后进行的平滑滚动期间，忽略 scroll-spy，避免高亮闪烁
  const isClickScrollingRef = useRef(false)
  const sectionRefs = useRef({})
  // 内容滚动容器（「Tabs 不动，内容滚」的关键：仅该容器参与滚动）
  const scrollContainerRef = useRef(null)

  // ---- 业务数据（接口返回）
  const [registration, setRegistration] = useState({})
  const [workItemKeyTypes, setWorkItemKeyTypes] = useState([])
  const [workFlowObjectList, setWorkFlowObjectList] = useState([])
  const [registerRecordEnumList, setRegisterRecordEnumList] = useState([])
  const [registerLevelConfigVos, setRegisterLevelConfigVos] = useState([])
  const [capacityInitialValues, setCapacityInitialValues] = useState({})
  const [statsConfig, setStatsConfig] = useState({})
  const [approvalConfig, setApprovalConfig] = useState({})
  const [permConfig, setPermConfig] = useState({})
  const [permConfigCount, setPermConfigCount] = useState(0)
  // 数据权限规则列表 + 加载状态
  const [authConfigs, setAuthConfigs] = useState([])
  const [authConfigsLoading, setAuthConfigsLoading] = useState(false)
  const [notifyConfig, setNotifyConfig] = useState({})
  const [notifyAllUsers, setNotifyAllUsers] = useState([])
  const [adminList, setAdminList] = useState([])
  const [loginUser, setLoginUser] = useState(null)
  // 记录规范（当前 admin 页面重在空间配置，记录规范在租户配置中嵌入，这里依然预加载供中心复用）
  const [standardConfigData, setStandardConfigData] = useState({})

  // 选人弹窗（替换为 SelectedUser 组件）
  const [isSelectedUserOpen, setIsSelectedUserOpen] = useState(false)
  // SelectedUser 选中态（成员/部门）
  const [selected, setSelected] = useState({
    selectedDeparts: [],
    selectedUsers: [],
    selectedDepartIds: [],
    selectedUserIds: [],
    checkedKeys: [],
  })

  // 当前空间的 projectKey（来自菜单选中项的 key，对应接口返回的 value）
  // 所有页面内的接口调用都会带上该参数，确保数据按空间隔离
  const projectKey = space?.key || ''

  // 当前登录用户的 userKey，用于插件管理员列表中识别当前账号
  const staffUserKey = useMemo(() => {
    try {
      const raw = localStorage.getItem('feishuUserInfo')
      if (!raw) return ''
      const info = JSON.parse(raw)
      return info?.userKey || ''
    } catch (_) {
      return ''
    }
  }, [])

  // ---- 接口封装
  const loadRegistration = async () => {
    const res = await getRegistrationSettings({ projectKey })
    if (!res?.result || !res?.data) return
    const data = res.data
    if (data.list && data.list.length === 0) {
      data.list.push({
        id: null,
        projectKey: '',
        canRegistWorkItemId: '0',
        canRegistWorkItemName: '全部工作项',
        entityStatus: [2],
        nodeStatus: 0,
        taskStatus: 0,
      })
    } else {
      data.list?.forEach((it) => {
        if (it?.tag == 0) it.canRegistWorkItemName = (it.canRegistWorkItemName || '') + '[已删除]'
      })
    }
    data.registerRecordEnumList?.forEach((it) => {
      it.label = it.typeDescribe
      it.value = it.typeName
    })
    setRegisterLevelConfigVos(data.registerLevelConfigVos || [])
    setRegisterRecordEnumList(data.registerRecordEnumList || [])
    setCapacityInitialValues({
      standWorkHour: data.standWorkHour || 0,
      onceDown: data.onceDown || 0,
      dayUp: data.dayUp || 0,
    })
    setWorkItemKeyTypes(data.workItemKeyTypes || [])
    setRegistration(data)
  }

  /** 删除特殊节点流配置 */
  const onDeleteSpecialFlowConfig = async (record) => {
    const data = { id: record.id }
    const res = await deleteSpecialNodeFlowConfig(data)
    if (res?.result) {
      loadRegistration()
      JSSDK.toast.success('删除成功')
    } else {
      JSSDK.toast.error(res?.message || '删除失败')
    }
  }

  const loadStats = async () => {
    const res = await getMeasureProjectConfig({ type: 'ALLOW_MEASUREMENT', projectKey })
    if (res?.result) setStatsConfig(res.data || {})
  }

  const loadApproval = async () => {
    const res = await getApprovalSettings({ projectKey })
    if (!res?.result) return
    let approvalName = '--'
    const approvalUser = []
    if (res.data?.pattern == 1) {
      approvalName = '指定成员'
      res.data?.userIds?.forEach((it) => approvalUser.push(it.nameCn))
    } else if (res.data?.pattern == 2) {
      approvalName = '团队审批'
      approvalUser.push('团队管理员')
    } else if (res.data?.pattern == 3) {
      approvalName = '角色审批'
      res.data?.roles?.forEach((it) => approvalUser.push(it.roleName))
    }
    const approvalRule = String(res.data?.approvalRule || '').toUpperCase()
    setApprovalConfig({
      value: res.data?.enableApproval,
      approvalType: res.data?.approvalType,
      ruleCount: res.data?.ruleCount || 0,
      approvalName,
      approvalRuleName: approvalRule === 'ALL' ? '会签（所有审批人同意即可）' : '或签（任一审批人同意即可）',
      approvalUser: approvalUser.length > 0 ? approvalUser.join(';') : '--',
    })
  }

  const loadPermission = async () => {
    const res = await getProjectConfig({
      type: 'ALLOW_ADMINISTRATORS_TO_REGISTER_OTHERS_WORKING_HOURS',
      projectKey,
    })
    if (res?.result) setPermConfig(res.data || {})
  }

  const loadPermissionCount = async () => {
    const res = await queryDataAuthConfigCount({ projectKey })
    if (res?.result && res?.data) setPermConfigCount(res.data)
  }

  // 加载数据权限规则列表（空间配置-权限设置 面板使用）
  const loadAuthConfigs = async () => {
    setAuthConfigsLoading(true)
    try {
      const res = await getDataAuthConfig({ projectKey })
      if (res?.result && res?.data?.authConfigs) {
        let appMode=localStorage.getItem('meegoTeamworkAppMode') || 'space'
        if(appMode == 'space'){
          let authConfigsList=res.data.authConfigs || [];
          if(authConfigsList && authConfigsList.length > 0){
            let isexist=authConfigsList.some(item => item?.authObj == "admin_administrator" && item?.isDefault);
            if(!isexist){
              authConfigsList.unshift({
                  "id": null,
                  "projectKey": null,
                  "tenantKey": "null",
                  "authObj": "admin_administrator",
                  "authObjValue": "应用管理员",
                  "isDefault": true,
                  "sort": 1,
                  "dataAuthUserVos": [],
                  "dataAuthExtraVos": [
                      {
                          "id": null,
                          "authId": 4993,
                          "dataScope": "isv_all_data",
                          "dataScopeValue": "所有成员、团队和部门",
                          "outId": null,
                          "userKey": null,
                          "userName": null,
                          "avatarUrl": null,
                          "teamId": null,
                          "teamName": null,
                          "isDefault": true,
                          "isAll": null,
                          "tag": null,
                          "departmentName": null,
                          "departmentId": null
                      }
                  ]
              })
              res.data.authConfigs=authConfigsList
            }
          }
        }
        const configs = [...res.data.authConfigs].sort(
          (a, b) => (a.sort || 0) - (b.sort || 0)
        )
        setAuthConfigs(configs)
      } else {
        setAuthConfigs([])
      }
    } catch (e) {
      console.error('获取数据权限规则失败:', e)
      setAuthConfigs([])
    } finally {
      setAuthConfigsLoading(false)
    }
  }

  const loadNotification = async () => {
    const res = await getWorkHourReminderConfig({ isInner: true, projectKey })
    if (!res?.result || !res?.data) return
    const d = res.data
    let time = d.remindTime || ''
    if (time.includes(':')) {
      const parts = time.split(':')
      if (parts.length >= 2) time = `${parts[0]}:${parts[1]}`
    }
    d.remindTime = time
    const all = [].concat(d.selectUserList || [], d.selectTeamVos || [], d.selectDepartmentIds || [])
    setNotifyAllUsers(d?.commonConfigVo?.value ? all : [])
    setNotifyConfig(d)
  }

  const loadAdminList = async () => {
    const res = await getProjectAdminList({ projectKey })
    if (res?.result) setAdminList(res.data || [])
  }

  const loadAllWorkObjects = async () => {
    try {
      const context = await JSSDK.Context.load()
      const space = await JSSDK.Space.load(context.mainSpace.id)
      const filterFlowMode = []
      const getFilterFlowMode = async (workObjectId) => {
        try {
          const d = await JSSDK.WorkObject.load({ spaceId: context.mainSpace.id, workObjectId })
          if (d?.flowMode == 'workflow') filterFlowMode.push(d.id)
        } catch (_) {}
      }
      if (Array.isArray(space.allWorkObjectList)) {
        await Promise.all(space.allWorkObjectList.map((it) => getFilterFlowMode(it.id)))
      }
      setWorkFlowObjectList(filterFlowMode)
    } catch (e) {
      console.error('allWorkObjectList 加载失败', e)
    }
  }

  const loadLoginUser = async () => {
    try {
      const ctx = await JSSDK.Context.load()
      setLoginUser(ctx?.user || null)
    } catch (_) {}
  }

  // 切换空间或首次进入时重新加载所有接口
  // projectKey 变化即触发重新拉取，确保每个空间的数据按 key 隔离
  useEffect(() => {
    if (!projectKey) return
    loadRegistration()
    loadStats()
    loadApproval()
    loadPermission()
    loadPermissionCount()
    loadAuthConfigs()
    loadNotification()
    loadAdminList()
    loadLoginUser()
    getRefreshTeam({ projectKey }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectKey])

  // ---- 锥点逻辑
  const getOffsetTopInContainer = (el, container) => {
    if (!el || !container) return 0
    const elRect = el.getBoundingClientRect()
    const cRect = container.getBoundingClientRect()
    return elRect.top - cRect.top + container.scrollTop
  }

  const handleTabClick = (key) => {
    setTab(key)
    const container = scrollContainerRef.current
    const el = sectionRefs.current[key]
    if (!container || !el) return
    const top = getOffsetTopInContainer(el, container) - ANCHOR_GAP
    isClickScrollingRef.current = true
    container.scrollTo({ top, behavior: 'smooth' })
    setTimeout(() => { isClickScrollingRef.current = false }, 600)
  }

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const onScroll = () => {
      if (isClickScrollingRef.current) return
      const triggerLine = ANCHOR_GAP + 4
      const cRect = container.getBoundingClientRect()
      let active = sections[0].key
      for (const s of sections) {
        const el = sectionRefs.current[s.key]
        if (!el) continue
        const top = el.getBoundingClientRect().top - cRect.top
        if (top - triggerLine <= 0) active = s.key
        else break
      }
      setTab((cur) => (cur === active ? cur : active))
    }
    onScroll()
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [sections])

  // 从设置页返回时，自动滚动到目标区块；小屏下内容高度可能二次变化，需要延迟校准
  useEffect(() => {
    const targetSection = location.state?.activeSection
    if (!targetSection || targetSection === sections[0].key) return

    const scrollToTarget = () => {
      handleTabClick(targetSection)
    }

    requestAnimationFrame(scrollToTarget)
    const timers = [100, 300, 600].map((delay) => setTimeout(scrollToTarget, delay))
    const clearStateTimer = setTimeout(() => {
      navigate(location.pathname, { replace: true, state: {} })
    }, 650)

    return () => {
      timers.forEach(clearTimeout)
      clearTimeout(clearStateTimer)
    }
  }, [location.state?.activeSection, sections]) // eslint-disable-line react-hooks/exhaustive-deps

  // 从子页面返回时如携带 refreshList 标识，则根据 activeSection 刷新对应数据
  useEffect(() => {
    const state = location.state || {}
    if (state.refreshList) {
      if (state.activeSection === 'perm') {
        loadPermission()
        loadPermissionCount()
        loadAuthConfigs()
      }
      // 消费后清除 refreshList 标识，避免重复触发
      navigate(location.pathname, {
        replace: true,
        state: { activeSection: state.activeSection },
      })
    }
  }, [location.state]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setTab(sections[0].key)
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [space?.key, sections])

  // ---- 业务交互
  const handleOpenRegistrationSetting = () => {
    navigate('/admin/reg-setting')
  }

  const handleAllowFillChange = async (val) => {
    const res = await postProjectConfig({
      type: 'ALLOW_ADMINISTRATORS_TO_REGISTER_OTHERS_WORKING_HOURS',
      id: permConfig?.id,
      value: val ? 1 : 0,
      projectKey,
    })
    if (res?.result) {
      JSSDK?.toast?.success?.('设置成功')
      loadPermission()
    }
  }

  const handleOpenSelectUser = () => setIsSelectedUserOpen(true)
  const handleCancelSelectUser = () => {
    setIsSelectedUserOpen(false)
    // 关闭时重置选中态，避免下次打开残留
    setSelected({
      selectedDeparts: [],
      selectedUsers: [],
      selectedDepartIds: [],
      selectedUserIds: [],
      checkedKeys: [],
    })
  }
  const handleConfirmSelectUser = () => {
    const userIds = selected.selectedUserIds || []
    if (!userIds.length) return
    postSetProjectAdmin({ userId: userIds, projectKey }).then((res) => {
      if (res?.result) {
        JSSDK?.toast?.success?.('添加成功')
        handleCancelSelectUser()
        loadAdminList()
      }
    })
  }
  const handleDeleteAdmin = (record) => {
    Modal.confirm({
      title: '确定删除？',
      icon: <ExclamationCircleFilled />,
      content: '您即将删除该成员的插件管理权限，此操作不可撤销。',
      closeIcon: <CloseOutlined />,
      okText: '确定',
      cancelText: '取消',
      async onOk() {
        const res = await postSetProjectMember({ userId: [record.staffId], projectKey })
        if (res?.result) {
          JSSDK?.toast?.success?.('删除成功')
          loadAdminList()
        }
      },
    })
  }

  // ---- 各 panel 渲染
  const panelMap = {
    reg: <RegistrationSettingPanel data={registration} registerLevelConfigVos={registerLevelConfigVos} onEdit={handleOpenRegistrationSetting} onDeleteSpecial={onDeleteSpecialFlowConfig} />,
    stats: <StatsSettingPanel data={statsConfig} onEdit={() => navigate('/admin/stats-setting')} />,
    approval: <ApprovalSettingPanel data={approvalConfig} onEdit={() => navigate('/admin/approval-setting')} />,
    perm: (
      <PermissionPanel
        allowFill={!!permConfig?.value}
        onAllowFillChange={handleAllowFillChange}
        configCount={permConfigCount}
        authConfigs={authConfigs}
        authLoading={authConfigsLoading}
        onEdit={() => navigate('/admin/perm-setting')}
        onRefresh={() => { loadAuthConfigs(); loadPermissionCount(); }}
      />
    ),
    notify: <NotificationPanel data={notifyConfig} allUsers={notifyAllUsers} onEdit={() => navigate('/admin/notify-setting')} />,
    plugin: (
      <PluginAdminPanel
        list={adminList}
        staffUserKey={staffUserKey}
        onAdd={handleOpenSelectUser}
        onDelete={handleDeleteAdmin}
      />
    ),
    // 仅空间模式下展示：记录规范设置
    standard: <StandardRulePanel projectKey={projectKey} />,
  }

  return (
    <div className="admin-space-content">
      <div className="admin-page-title">{space?.label || '空间'}配置</div>
      <Tabs
        className="admin-sub-tabs"
        activeKey={tab}
        onChange={handleTabClick}
        items={sections.map((i) => ({ key: i.key, label: i.label }))}
      />
      <div className="admin-anchor-list" ref={scrollContainerRef}>
        {sections.map((s) => (
          <div
            key={s.key}
            id={`admin-anchor-${s.key}`}
            ref={(el) => (sectionRefs.current[s.key] = el)}
          >
            {panelMap[s.key]}
          </div>
        ))}
      </div>

      {/* ---- 选人弹窗：使用 SelectedUser 组件 ---- */}
      <Modal
        destroyOnHidden
        title="添加插件管理员"
        open={isSelectedUserOpen}
        onCancel={handleCancelSelectUser}
        width="745px"
       footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SyncTeamBtn />
            <div>
              <Button key="cancel" className="cancel-btn" onClick={handleCancelSelectUser}>取消</Button>
              <Button
                key="ok"
                style={{ marginLeft: 8 }}
                disabled={!selected.selectedUserIds?.length}
                type="primary"
                onClick={handleConfirmSelectUser}
              >
                确定
              </Button>
            </div>
          </div>
        }
        centered
        maskClosable={false}
      >
        <SelectedUser
          type="authority"
          getSelectedUser={(e) => setSelected(e)}
          selectedUser={selected}
          customFetchUsers={async () => {
            // 排除已添加的管理员
            const adminIds = new Set(adminList.map(r => r.staffId).filter(Boolean))
            // 使用老接口 user/getProjectSimpleStaff，按当前空间 projectKey 拉取成员
            const res = await getProjectMemberList({ projectKey })
            if (res?.result) {
              const list = Array.isArray(res.data) ? res.data : []
              return {
                result: true,
                data: list
                  .filter(item => !adminIds.has(item.staffId))
                  .map(item => ({
                    ...item,
                    staffId: item.staffId,
                    staffName: item.staffName || item.name,
                    staffAvatarUrl: item.staffAvatarUrl || item.avatarUrl,
                  })),
              }
            }
            return { result: false, data: [] }
          }}
          customSearchUsers={async (keyword) => {
            // 排除已添加的管理员
            const adminIds = new Set(adminList.map(r => r.staffId).filter(Boolean))
            const res = await postSearchMember({ projectKey, query: keyword })
            if (res?.result) {
              const list = Array.isArray(res.data) ? res.data : []
              const kw = (keyword || '').trim().toLowerCase()
              const filtered = list
                .filter(item => {
                  if (adminIds.has(item.staffId)) return false
                  if (!kw) return true
                  const name = item.staffName || item.name || ''
                  return name.toLowerCase().includes(kw)
                })
                .map(item => ({
                  ...item,
                  staffId: item.staffId,
                  staffName: item.staffName || item.name,
                  staffAvatarUrl: item.staffAvatarUrl || item.avatarUrl,
                }))
              return { result: true, data: filtered }
            }
            return { result: false, data: [] }
          }}
        />
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------- 简单占位内容
const SimplePlaceholder = ({ title, desc }) => (
  <div className="admin-placeholder">
    <div className="admin-page-title">{title}</div>
    <Card className="admin-section">
      {desc ? (
        <div className="admin-placeholder-text">{desc}</div>
      ) : (
        <div className="admin-placeholder-loading">
          <Spin tip="正在加载中..." />
        </div>
      )}
    </Card>
  </div>
)

// ---------------------------------------------------------- 成员选择组件演示页
const MemberSelectDemoContent = () => {
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('选择成员')
  const [result, setResult] = useState(null)
  const [sourceLabel, setSourceLabel] = useState('')

  const handleOpen = (source) => {
    setSourceLabel(source)
    if (source === 'resource') setModalTitle('资源管理 - 团队设置')
    else if (source === 'log') setModalTitle('工时日志 - 团队设置')
    else setModalTitle('团队设置')
    setModalOpen(true)
  }

  const handleConfirm = (data) => {
    setResult(data)
    setModalOpen(false)
  }

  return (
    <div className="admin-placeholder">
      <Card className="admin-section admin-plain-card">
        <div className="admin-section-header">
          <div className="admin-section-header-text">
            <div className="admin-page-title">成员选择组件</div>
            <div className="admin-page-desc">
              支持成员 / 团队 / 部门三种类型选择，单选、半选、全选逻辑完整。
            </div>
          </div>
        </div>

        <div className="admin-divider" />

        <div className="admin-block">
          <div className="admin-block-title">选择场景</div>
          <div className="admin-grid-3">
            <Button type="primary" icon={<RightOutlined />} iconPosition="end" onClick={() => handleOpen('resource')}>
              资源管理
            </Button>
            <Button icon={<RightOutlined />} iconPosition="end" onClick={() => handleOpen('log')}>
              工时日志
            </Button>
            <Button type="link" icon={<RightOutlined />} iconPosition="end" onClick={() => handleOpen('team')}>
              团队设置
            </Button>
          </div>
        </div>

        {result && (
          <>
            <div className="admin-divider" />
            <div className="admin-block">
              <div className="admin-block-title">已选结果（{sourceLabel}）</div>
              <div className="admin-grid-3">
                <KvLine label="成员" value={result.selectedMembers.map(m => m.name).join('、') || '--'} />
                <KvLine label="团队" value={result.selectedTeams.map(t => t.name).join('、') || '--'} />
                <KvLine label="部门" value={result.selectedDepartments.map(d => d.name).join('、') || '--'} />
                <KvLine label="同时选管理员" value={result.selectTeamAdmin ? '是' : '否'} />
              </div>
            </div>
          </>
        )}
      </Card>

      <MemberSelectModal
        title={modalTitle}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onConfirm={handleConfirm}
      />
    </div>
  )
}

// ---------------------------------------------------------- 模式设置（按设计稿还原）
const MODE_OPTIONS = [
  {
    key: 'space',
    title: '空间模式',
    icon: <img src={iconSpaceConfig} />,
    lines: ['各飞书项目空间独立管理，数据隔离', '适合团队成员在同一空间内登记工时'],
  },
  {
    key: 'tenant',
    title: '租户模式',
    icon: <img src={iconModeSet} />,
    lines: ['跨飞书项目空间统一管理', '适合成员需要在多个空间登记工时的场景'],
  },
]

const ModeSettingContent = () => {
  const navigate = useNavigate()
  const [mode, setMode] = useState(() => getAppMode() || 'space')
  const [switchModalOpen, setSwitchModalOpen] = useState(false)
  const [pendingMode, setPendingMode] = useState(null)
  const [switchLoading, setSwitchLoading] = useState(false)
  const [installedSpaces, setInstalledSpaces] = useState([])
  const [spacesLoading, setSpacesLoading] = useState(false)

  // 加载已安装空间列表
  useEffect(() => {
    fetchInstalledSpaces()
  }, [])

  const fetchInstalledSpaces = async (currentMode) => {
    try {
      setSpacesLoading(true)
      // 租户模式调用租户已安装空间列表，空间模式调用用户已安装空间列表
      const modeToUse = currentMode || mode
      const userRole = getUserRole()
      const res = userRole === 'app_admin' ? await getInstallList() : await getAdminList()
      //const res = modeToUse === 'tenant' ? await getInstallList() : await getAdminList()
      if (res?.code === 200 && Array.isArray(res.data)) {
        setInstalledSpaces(res.data)
      }
    } catch (e) {
      console.error('获取已安装空间列表失败:', e)
    } finally {
      setSpacesLoading(false)
    }
  }

  const handleModeClick = (key) => {
    if (key === mode) return
    setPendingMode(key)
    setSwitchModalOpen(true)
  }

  const handleConfirmSwitch = async () => {
    if (!pendingMode) return
    try {
      setSwitchLoading(true)
      const res = await postChangeMode({ mode: pendingMode })
      if (res?.code === 200) {
        setMode(pendingMode)
        setAppMode(pendingMode)
        JSSDK.toast.success('模式切换成功')
        // 切换模式后用 window.location 硬跳回 /admin 首页（触发整页重载），
        // 避免停留在「租户配置-基础设置-添加记录规范」等二级页面时，按新模式加载出现残留错位。
        setTimeout(() => {
          // 用 href 赋值确保浏览器发起全新的文档请求；basename 为 '/'，直接写绝对路径
          window.location.href = '/admin'
        }, 500)
      } else {
        JSSDK.toast.warning(res?.msg || '模式切换失败')
      }
    } catch (e) {
      console.error('模式切换失败:', e)
      JSSDK.toast.warning('模式切换失败，请重试')
    } finally {
      setSwitchLoading(false)
      setSwitchModalOpen(false)
      setPendingMode(null)
    }
  }

  const pendingTitle = MODE_OPTIONS.find((o) => o.key === pendingMode)?.title || ''

  return (
    <div className="admin-placeholder">
      <Card className="admin-section admin-mode-card" >
        <div className="admin-page-title">选择管理模式</div>
        <div className="admin-page-desc">
          切换模式后，插件设置的配置将会改变。工时数据、审批数据均保持不变。
        </div>
        <div className="admin-mode-row">
          {MODE_OPTIONS.map((opt) => {
            const active = mode === opt.key
            return (
              <div
                key={opt.key}
                className={`admin-mode-item${active ? ' is-active' : ''}`}
                onClick={() => handleModeClick(opt.key)}
              >
                <div className="admin-mode-icon">{opt.icon}</div>
                <div className="admin-mode-body">
                  <div className="admin-mode-title">{opt.title}</div>
                  {opt.lines.map((line, i) => (
                    <div key={i} className="admin-mode-line">· {line}</div>
                  ))}
                </div>
                <Radio checked={active} className="admin-mode-radio" />
              </div>
            )
          })}
        </div>
      </Card>

      <Card className="admin-section admin-installed-card">
        <div className="admin-installed-title">
          已安装工时插件的空间 <span className="admin-installed-count">({installedSpaces.length}个)</span>
        </div>
        {spacesLoading ? (
          <Spin size="small" />
        ) : installedSpaces.length > 0 ? (
          <div className="admin-installed-grid">
            {installedSpaces.map((s, idx) => (
              <div key={s.value} className="admin-installed-item">
                <span className="admin-installed-idx">{String(idx + 1).padStart(2, '0')}</span>
                <span className="admin-installed-name">{s.level}</span>
              </div>
            ))}
          </div>
        ) : (
          <AdminEmpty description="暂无已安装空间" />
        )}
      </Card>

      {/* 模式切换二次确认弹窗 */}
      <Modal
        open={switchModalOpen}
        onCancel={() => { setSwitchModalOpen(false); setPendingMode(null) }}
        width={600}
        centered
        footer={null}
      >
        <div className="mode-switch-modal">
          <div className="mode-switch-modal-title">
            <ExclamationCircleFilled className="mode-switch-modal-icon" />
            确认切换至{pendingTitle}？
          </div>
          <div className="mode-switch-modal-desc">
            <p>工时数据、审批数据均保持不变。</p>
            <p>插件设置的配置将会改变。空间模式与租户模式的配置是相互独立的，</p>
            <p>切换后，将恢复为您在该模式下之前保存的配置。</p>
          </div>
          <div className="mode-switch-modal-footer">
            <Button onClick={() => { setSwitchModalOpen(false); setPendingMode(null) }}>取消</Button>
            <Button danger type="primary" loading={switchLoading} onClick={handleConfirmSwitch}>已谨慎考虑，确认切换</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------- 租户配置：基础设置（记录规范设置）
const TenantBaseContent = () => {
  const navigate = useNavigate()
  const location = useLocation()
  // 当前空间的 projectKey，传给所有接口
  const projectKey = sessionStorage.getItem('adminCurrentProjectKey') || ''
  const [standardsConfigList, setStandardsConfigList] = useState([])
  const [loading, setLoading] = useState(false)
  // ISV 模式走 isv/ 前缀接口，老模式走原接口
  const isv = isISV()
  const fetchConfigList = isv ? getStandardsConfigIsv : getStandardsConfig
  const fetchConfigDetail = isv ? getStandardsConfigDetailIsv : getStandardsConfigDetail
  // ISV（租户模式）下新接口无需 projectKey；老接口仍需要
  const withProjectKey = (extra = {}) => (isv ? { ...extra } : { projectKey, ...extra })

  // 加载记录规范列表
  const loadStandardsConfig = async () => {
    setLoading(true)
    try {
      const res = await fetchConfigList(withProjectKey())
      if (res?.result && Array.isArray(res?.data)) {
        setStandardsConfigList(res.data)
      }
    } catch (e) {
      console.error('加载记录规范失败:', e)
    } finally {
      setLoading(false)
    }
  }

  // 初始化加载
  useEffect(() => {
    loadStandardsConfig()
  }, [])

  // 子页面返回时如携带 refreshList 标识则重新加载
  useEffect(() => {
    const state = location.state || {}
    if (state.refreshList) {
      loadStandardsConfig()
      // 消费后清除 state，避免重复刷新
      navigate(location.pathname, { replace: true, state: { activeSection: 'tenant-base' } })
    }
  }, [location.state]) // eslint-disable-line react-hooks/exhaustive-deps

  // 跳转到添加记录规范子页面
  const handleAddStandard = () => {
    navigate('/admin/standard-setting', { state: { isAdd: 1 } })
  }

  // 跳转到编辑记录规范子页面
  const handleEditStandard = async (item) => {
    try {
      // isDefault 取列表项里 getConfig/out 返回的值
      const res = await fetchConfigDetail(withProjectKey({ id: item.id, isDefault: !!item.isDefault }))
      const editData = res?.result ? res.data : item
      navigate('/admin/standard-setting', { state: { isAdd: 0, editData } })
    } catch (e) {
      console.error('获取记录规范详情失败:', e)
      navigate('/admin/standard-setting', { state: { isAdd: 0, editData: item } })
    }
  }

  return (
    <div className="admin-placeholder">
      <Card className="admin-section admin-plain-card">
        <div className="admin-section-header">
          <div className="admin-section-header-text">
            <div className="admin-page-title">记录规范设置</div>
            <div className="admin-page-desc">设置不同记录组，规范不同人员的记录规则</div>
          </div>
          <Button className="admin-section-header-btn" onClick={handleAddStandard}>添加记录规范</Button>
        </div>
        <div className="admin-divider" />
        <div className="admin-rules-grid">
          {loading ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0' }}>
              <Spin size="small" />
            </div>
          ) : standardsConfigList.length > 0 ? (
            [...standardsConfigList].filter(r => r != null).sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0)).map((r) => (
              <div key={r.id || r.standardsName} className="admin-rule-card" onClick={() => handleEditStandard(r)}>
                <div className="admin-rule-header">
                  <Tooltip title={r.standardsName || '--'} placement="topLeft">
                    <span className="admin-rule-name">{r.standardsName || '--'}</span>
                  </Tooltip>
                  {r.isDefault && <Tag className="admin-rule-tag">默认</Tag>}
                  <RightOutlined className="admin-rule-arrow" />
                </div>
                <div className="admin-rule-count">
                  <span className="admin-blue">{r.count || 0}</span> 人
                </div>
              </div>
            ))
          ) : (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0' }}>
              <AdminEmpty description="暂无记录规范" />
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------- 租户配置：权限设置（数据权限）
const TenantPermContent = () => {
  const navigate = useNavigate()
  const location = useLocation()
  // 当前空间的 projectKey，传给所有接口
  const projectKey = sessionStorage.getItem('adminCurrentProjectKey') || ''
  const [allowAdminFill, setAllowAdminFill] = useState(false)
  const [permConfigData, setPermConfigData] = useState(null)
  const [authConfigs, setAuthConfigs] = useState([])
  const [permConfigCount, setPermConfigCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [switchLoading, setSwitchLoading] = useState(false)

  // 可见数据范围描述映射
  const getScopeDescription = (value) => {
    const v = typeof value === 'string' ? value.toLowerCase() : ''
    switch (value) {
      case 'isv_all_data':
        return '可以查看所有成员、团队和部门数据'
      case 'all_data':
        return '可以查看所有成员和团队的数据'
      case 'my_teams':
        return '仅能查看自己管理的团队内所有成员的数据'
      case 'specified_members':
        return '手动选择可查看的成员数据'
      case 'all_teams':
        return '可查看该空间下所有授权团队'
      case 'specified_teams':
        return '手动选择可查看的团队数据'
      case 'specified_departments':
      case 'specified_department':
      case 'specified_dept':
        return '手动选择可查看的部门数据'
      default:
        if (v.includes('dept') || v.includes('department')) return '手动选择可查看的部门数据'
        return '--'
    }
  }

  // 加载权限配置开关（租户模式：不传 projectKey，由租户维度全局配置）
  const loadPermissionConfig = async () => {
    try {
      const res = await getProjectConfig({
        type: 'ALLOW_ADMINISTRATORS_TO_REGISTER_OTHERS_WORKING_HOURS',
      })
      if (res?.result) {
        setPermConfigData(res.data)
        setAllowAdminFill(!!res.data?.value)
      }
    } catch (e) {
      console.error('获取权限配置失败:', e)
    }
  }

  // 加载数据权限配置数量
  const loadPermConfigCount = async () => {
    try {
      const res = await queryIsvDataAuthConfigCount()
      if (res?.result) {
        setPermConfigCount(res.data || 0)
      }
    } catch (e) {
      console.error('获取数据权限规则数量失败:', e)
    }
  }

  // 加载数据权限规则列表
  const loadAuthConfigs = async () => {
    setLoading(true)
    try {
      const res = await getIsvDataAuthConfig()
      if (res?.result && res?.data?.authConfigs) {
        const configs = [...res.data.authConfigs].sort(
          (a, b) => (a.sort || 0) - (b.sort || 0)
        )
        setAuthConfigs(configs)
      } else {
        setAuthConfigs([])
      }
    } catch (e) {
      console.error('获取数据权限规则失败:', e)
      setAuthConfigs([])
    } finally {
      setLoading(false)
    }
  }

  // 初始化加载
  useEffect(() => {
    loadPermissionConfig()
    loadPermConfigCount()
    loadAuthConfigs()
  }, [])

  // 子页面返回时如携带 refreshList 标识则重新加载
  useEffect(() => {
    const state = location.state || {}
    if (state.refreshList) {
      loadPermConfigCount()
      loadAuthConfigs()
      navigate(location.pathname, {
        replace: true,
        state: { activeSection: 'tenant-perm' },
      })
    }
  }, [location.state]) // eslint-disable-line react-hooks/exhaustive-deps

  // 切换"允许管理员代填工时"（租户模式：不传 projectKey，由租户维度全局配置）
  const handleAllowFillChange = async (val) => {
    setSwitchLoading(true)
    try {
      const res = await postProjectConfig({
        type: 'ALLOW_ADMINISTRATORS_TO_REGISTER_OTHERS_WORKING_HOURS',
        id: permConfigData?.id,
        value: val ? 1 : 0,
      })
      if (res?.result) {
        JSSDK?.toast?.success?.('设置成功')
        setAllowAdminFill(val)
        loadPermissionConfig()
      } else {
        JSSDK?.toast?.warning?.('设置失败，请重试')
      }
    } catch (e) {
      console.error('设置失败:', e)
      JSSDK?.toast?.warning?.('设置失败，请重试')
    } finally {
      setSwitchLoading(false)
    }
  }

  // 跳转到数据权限设置子页面
  const handleOpenSetting = () => {
    navigate('/admin/tenant-perm-setting', { state: { from: 'tenant-perm' } })
  }
  const handleDelSetting = async (row) => {
    const res = await deleteDataAuthAppPermission({ id: row.id })
    if (res?.result) {
      JSSDK?.toast?.success?.('删除成功')
      loadPermConfigCount()
      loadAuthConfigs()
    } else {
      JSSDK?.toast?.warning?.('删除失败，请重试')
    }
  }
  // 团队默认头像
  const TEAM_DEFAULT_AVATAR = 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png'

  // 渲染授权对象
  const renderAuthObj = (row) => {
    const dataScope = row?.authObj
    // 全部成员场景
    if (dataScope === 'plugin_administrator') {
      return <span className="admin-perm-value">插件管理员</span>
    }
    if (dataScope === 'team_administrator') {
      return <span className="admin-perm-value">团队管理员</span>
    }
    if (dataScope === 'all_members') {
      return <span className="admin-perm-value">所有成员</span>
    }
    if (dataScope === 'all_members') {
      return <span className="admin-perm-value">所有成员</span>
    }
    if (dataScope === 'admin_administrator') {
      return <span className="admin-perm-value">应用管理员</span>
    }
    // ISV接口：授权对象成员从 dataAuthUserVos 取值，团队/部门从 dataAuthExtraVos 取
    const isSpecifiedMembers = row?.authObj === 'specified_members'
    const items = isSpecifiedMembers
      ? (row?.dataAuthUserVos || row?.dataAuthOutIdVos || row?.authObjVos || [])
      : (row?.authObjVos || row?.dataAuthExtraVos || [])
    if (!items.length) return <span className="admin-perm-value">{row?.authObjValue || '--'}</span>
    return (
      <div className="admin-avatar-wrap">
        {items.slice(0, 8).map((u, i) => {
          const isTeam = !!(u?.teamId || u?.teamName)
          const isDept = !!(u?.deptId || u?.departmentId || u?.deptName || u?.departmentName)
          const name = u?.userName || u?.teamName || u?.deptName || u?.departmentName || u?.staffName || '--'
          const avatarSrc = (isTeam || isDept) ? TEAM_DEFAULT_AVATAR : u?.avatarUrl
          return (
            <span key={u?.outId || u?.unionId || u?.userKey || u?.teamId || u?.deptId || u?.departmentId || i} className="admin-avatar-chip">
              <Avatar size={20} src={avatarSrc} className="admin-avatar-name">
                {!avatarSrc && name.charAt(0)}
              </Avatar>
              <span className="admin-avatar-chip-name">{name}</span>
            </span>
          )
        })}
        {items.length > 8 && (
          <Tooltip
            title={items.map((u) => u?.userName || u?.teamName || u?.deptName || u?.departmentName || u?.staffName || '--').join('、')}
          >
            <span className="admin-avatar-chip" style={{ cursor: 'pointer' }}>
              <span className="admin-avatar-chip-name">+{items.length - 8}</span>
            </span>
          </Tooltip>
        )}
      </div>
    )
  }

  // 渲染可见数据范围
  const renderDataScope = (row) => {
    const vos = row?.dataAuthExtraVos || []
    if (!vos.length) return <span className="admin-perm-value admin-text-grey">--</span>
    const firstScope = vos[0]?.dataScope
    const firstValue = vos[0]?.dataScopeValue
    if(firstScope === 'all_data' || firstScope === 'my_teams' || firstScope === 'all_teams' || firstScope === 'only_myself' || firstScope === 'isv_all_data'){
        return <span className="admin-perm-value">{firstValue}</span>
    }
    // 取首个 dataScope 描述
    const desc = getScopeDescription(firstScope)
    // 兼容后端返回的部门枚举 specified_department / specified_dept
    const scopeValue = typeof firstScope === 'string' ? firstScope.toLowerCase() : ''
    const isDeptScope = scopeValue.includes('dept') || scopeValue.includes('specified_department')
    const isTeamScope = firstScope === 'specified_teams'
    // 当为 specified_members/specified_teams/部门 时附加具体名称
    // if (firstScope === 'specified_members') {
    //   vos=row.dataAuthUserVos
    // }
    if (firstScope === 'specified_members' || isTeamScope || isDeptScope) {
      const names = vos
        .map((v) => v?.userName || v?.teamName || v?.deptName || v?.departmentName || v?.staffName)
        .filter(Boolean)
      return (
        <span className="admin-perm-value">
          <span className="admin-avatar-wrap" style={{ display: 'inline-flex', verticalAlign: 'middle', marginLeft: 4 }}>
            {vos.slice(0, 8).map((v, i) => {
              const name = v?.userName || v?.teamName || v?.deptName || v?.departmentName || v?.staffName || '--'
              const avatarSrc = isTeamScope ? team_img : isDeptScope ? dept_img : v?.avatarUrl
              return (
                <span key={v?.outId || v?.unionId || v?.teamId || v?.deptId || v?.departmentId || i} className="admin-avatar-chip">
                  <Avatar size={20} src={avatarSrc} className="admin-avatar-name">
                    {!avatarSrc && name.charAt(0)}
                  </Avatar>
                  <span className="admin-avatar-chip-name">{name}</span>
                </span>
              )
            })}
            {vos.length > 8 && (
              <Tooltip title={names.join('、')}>
                <span className="admin-avatar-chip" style={{ cursor: 'pointer' }}>
                  <span className="admin-avatar-chip-name">+{vos.length - 8}</span>
                </span>
              </Tooltip>
            )}
          </span>
        </span>
      )
    }
  }
  return (
    <div className="admin-placeholder">
      <Card className="admin-section admin-plain-card">
        <div className="admin-section-header">
          <div className="admin-section-header-text">
            <div className="admin-page-title">数据权限</div>
            <div className="admin-page-desc">管理用户权限，控制成员操作范围及能力</div>
          </div>
          <Button type="default" className="admin-section-header-btn" onClick={handleOpenSetting}>
            设置
          </Button>
        </div>
        <div className="admin-divider" />
        <div className="admin-block">
          <div className="admin-block-title">
           <FieldLabel tip={getAllowFillTip()}>允许管理员代填工时</FieldLabel>
          </div>
          <Switch
            checked={allowAdminFill}
            loading={switchLoading}
            onChange={handleAllowFillChange}
          />
        </div>

     
        <div className="admin-block">
          <div className="admin-block-title">可见成员</div>
          <div className="admin-section-desc">
            配置成员在资源管理、工时日志、工时管理页面的数据可见权限。已配置{' '}
            <span className="admin-blue">{permConfigCount || authConfigs.length}</span> 个权限规则
          </div>
          <div className="admin-perm-rules">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Spin size="small" />
              </div>
            ) : authConfigs.length > 0 ? (
              authConfigs.map((row, idx) => (
                <div key={row.id || idx} className="admin-perm-rule">
                  <div className="admin-perm-rule-no">规则{idx + 1}</div>
                  <div className="admin-perm-rule-body">
                    <div className="admin-perm-row">
                      <span className="admin-perm-label">授权对象</span>
                      {renderAuthObj(row)}
                    </div>
                    <div className="admin-perm-row">
                      <span className="admin-perm-label">可见数据范围</span>
                      {renderDataScope(row)}
                    </div>
                  </div>
                  <a
                    className={`admin-link admin-perm-del${row.isDefault ? ' admin-perm-del-disabled' : ''}`}
                    onClick={row.isDefault ? undefined : () => handleDelSetting(row)}
                    style={row.isDefault ? { color: '#bfbfbf', cursor: 'not-allowed', pointerEvents: 'none' } : undefined}
                  >
                    删除
                  </a>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <AdminEmpty description="暂无权限规则，点击右上角「设置」添加" />
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------- 租户配置：应用管理员
const TenantAdminContent = () => {
  const [adminList, setAdminList] = useState([])
  const [loginUser, setLoginUser] = useState(null)
  const [isSelectedUserOpen, setIsSelectedUserOpen] = useState(false)
  const [selected, setSelected] = useState({
    selectedDeparts: [],
    selectedUsers: [],
    selectedDepartIds: [],
    selectedUserIds: [],
    checkedKeys: [],
  })

  const initedRef = useRef(false)
  useEffect(() => {
    if (initedRef.current) return
    initedRef.current = true
    loadAdminList()
    loadLoginUser()
  }, [])

  const loadAdminList = async () => {
    const res = await getAppAdminList()
    if (res?.code === 200) {
      const list = res.data || []
      list.sort((a, b) => (b.current ? 1 : 0) - (a.current ? 1 : 0))
      setAdminList(list)
    }
  }

  const loadLoginUser = async () => {
    try {
      const ctx = await JSSDK.Context.load()
      setLoginUser(ctx?.user || null)
    } catch (_) {}
  }

  const handleOpenSelectUser = () => setIsSelectedUserOpen(true)
  const handleCancelSelectUser = () => {
    setIsSelectedUserOpen(false)
    setSelected({
      selectedDeparts: [], selectedUsers: [], selectedDepartIds: [], selectedUserIds: [], checkedKeys: [],
    })
  }
  const handleConfirmSelectUser = async () => {
    if (!selected.selectedUserIds.length) return
    const res = await postAddAppAdmin({ outIds: selected.selectedUserIds })
    if (res?.code === 200) {
      JSSDK?.toast?.success?.('添加成功')
      handleCancelSelectUser()
      loadAdminList()
    }
  }
  const handleDeleteAppAdmin = (record) => {
    Modal.confirm({
      title: '确定删除？',
      icon: <ExclamationCircleFilled />,
      content: '您即将删除该成员的应用管理员权限，此操作不可撤销。',
      closeIcon: <CloseOutlined />,
      okText: '确定',
      cancelText: '取消',
      async onOk() {
        const res = await deleteAppAdminByIds({ id: record.id})
        if (res?.result) {
          JSSDK?.toast?.success?.('删除成功')
          loadAdminList()
        }
      },
    })
  }

  return (
    <div className="admin-placeholder">
      <Card className="admin-section admin-plain-card">
        <div className="admin-section-header">
          <div className="admin-section-header-text">
            <div className="admin-page-title">应用管理员</div>
            <div className="admin-page-desc">
              应用管理员可管理整个应用。飞书租户管理员及飞书应用管理员将自动成为应用管理员。
            </div>
          </div>
          <Button className="admin-add-btn"  onClick={handleOpenSelectUser}>添加应用管理员</Button>
        </div>
        <Table
          className="admin-app-admin-table"
          size="middle"
          pagination={false}
          rowKey={(r) => r.staffId || r.staffUserKey || r.id}
          dataSource={adminList}
          locale={{ emptyText: <AdminEmpty description="暂无管理员" /> }}
          columns={[
            {
              title: '成员', dataIndex: 'name',
              render: (_, r) => (
                <Space>
                  <Avatar size={24} src={r.avatarUrl || r.staffAvatarUrl} icon={<UserOutlined />} />
                  <span>{r.name || r.staffName || '--'}</span>
                </Space>
              ),
            },
            {
              title: '添加人', dataIndex: 'operatorName',
              render: (_, r) => (
                <Space>
                  {r.avatarUrl ? (
                    <Avatar size={24} src={r.operatorAvatarUrl} icon={<UserOutlined />} />
                  ) : null}
                  <span>{r.operatorName || '--'}</span>
                </Space>
              ),
            },
            { title: '添加时间', dataIndex: 'operatorTime' },
            {
              title: '操作', dataIndex: 'op', width: 100,
              render: (_, r) =>
                r.current ? (
                  <span className="admin-text-grey">当前账号</span>
                ) : (
                  <a className="admin-link" onClick={() => handleDeleteAppAdmin(r)}>删除</a>
                ),
            },
          ]}
        />
      </Card>

      {/* 选人弹窗 */}
      <Modal
        destroyOnHidden
        title="选择成员"
        open={isSelectedUserOpen}
        onCancel={handleCancelSelectUser}
        width="745px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SyncTeamBtn />
            <div>
              <Button key="cancel" className="cancel-btn" onClick={handleCancelSelectUser}>取消</Button>
              <Button
                key="ok"
                style={{ marginLeft: 8 }}
                disabled={!selected.selectedUserIds.length}
                type="primary"
                onClick={handleConfirmSelectUser}
              >
                确定
              </Button>
            </div>
          </div>
        }
        centered
        maskClosable={false}
      >
        <SelectedUser
          type="authority"
          isIsv
          getSelectedUser={(e) => setSelected(e)}
          selectedUser={selected}
          customFetchUsers={async () => {
            const res = await getWebhookUserList({ name: '', needExcludeAdmin: true })
            if (res?.code === 200) {
              return {
                result: true,
                data: (res.data || []).map(item => ({
                  ...item,
                  staffId: item.unionId,
                  staffName: item.name,
                  staffAvatarUrl: item.avatarUrl,
                })),
              }
            }
            return { result: false, data: [] }
          }}
          customSearchUsers={async (keyword) => {
            const res = await getWebhookUserList({ name: keyword, needExcludeAdmin: true })
            if (res?.code === 200) {
              return {
                result: true,
                data: (res.data || []).map(item => ({
                  ...item,
                  staffId: item.unionId,
                  staffName: item.name,
                  staffAvatarUrl: item.avatarUrl,
                })),
              }
            }
            return { result: false, data: [] }
          }}
        />
      </Modal>
    </div>
  )
}

// ========================================================== 设置子页面（路由页）
// 统一包装：返回按钮 + 标题 + 内容
const SettingPageLayout = ({ title, sectionKey, children }) => {
  const navigate = useNavigate()
  return (
    <div className="admin-setting-page">
      <div className="admin-setting-header">
        <Button
          type="text"
          icon={<img src={backIcon} alt="返回" width={24} height={24} />}
          onClick={() => navigate('/admin', { state: { activeSection: sectionKey } })}
          className="admin-setting-back"
        />
        <span className="admin-setting-title">{title}</span>
      </div>
      <div className="admin-setting-body">
        {children}
      </div>
    </div>
  )
}

// 自定义字段设置页（租户级配置，空间模式与租户模式共用）
const CustomFieldSettingPage = () => {
  const navigate = useNavigate()
  const handleBack = () => navigate('/admin', { state: { activeSection: 'tenant-custom-field' } })

  return (
    <SettingPageLayout title="自定义字段设置" sectionKey="tenant-custom-field">
      <CustomFieldSettings onCancel={handleBack} onSaved={handleBack} />
    </SettingPageLayout>
  )
}

// 登记设置页
const RegSettingPage = () => {
  const navigate = useNavigate()
  // 从 sessionStorage 读取当前空间的 projectKey，传给所有接口
  const projectKey = sessionStorage.getItem('adminCurrentProjectKey') || ''
  const [registration, setRegistration] = useState({})
  const [workItemKeyTypes, setWorkItemKeyTypes] = useState([])
  const [workFlowObjectList, setWorkFlowObjectList] = useState([])
  const [registerRecordEnumList, setRegisterRecordEnumList] = useState([])
  const [registerLevelConfigVos, setRegisterLevelConfigVos] = useState([])
  const [capacityInitialValues, setCapacityInitialValues] = useState({})

  const loadRegistration = async () => {
    const res = await getRegistrationSettings({ projectKey })
    if (!res?.result || !res?.data) return
    const data = res.data
    if (data.list && data.list.length === 0) {
      data.list.push({
        id: null, projectKey: '', canRegistWorkItemId: '0',
        canRegistWorkItemName: '全部工作项', entityStatus: [2], nodeStatus: 0, taskStatus: 0,
      })
    } else {
      data.list?.forEach((it) => {
        if (it?.tag == 0) it.canRegistWorkItemName = (it.canRegistWorkItemName || '') + '[已删除]'
      })
    }
    data.registerRecordEnumList?.forEach((it) => { it.label = it.typeDescribe; it.value = it.typeName })
    setRegisterLevelConfigVos(data.registerLevelConfigVos || [])
    setRegisterRecordEnumList(data.registerRecordEnumList || [])
    setCapacityInitialValues({ standWorkHour: data.standWorkHour || 0, onceDown: data.onceDown || 0, dayUp: data.dayUp || 0 })
    setWorkItemKeyTypes(data.workItemKeyTypes || [])
    setRegistration(data)
  }

  const loadAllWorkObjects = async () => {
    try {
      const context = await JSSDK.Context.load()
      const space = await JSSDK.Space.load(context.mainSpace.id)
      const filterFlowMode = []
      const getFilter = async (id) => {
        try {
          const d = await JSSDK.WorkObject.load({ spaceId: context.mainSpace.id, workObjectId: id })
          if (d?.flowMode == 'workflow') filterFlowMode.push(d.id)
        } catch (_) {}
      }
      if (Array.isArray(space.allWorkObjectList)) {
        await Promise.all(space.allWorkObjectList.map((it) => getFilter(it.id)))
      }
      setWorkFlowObjectList(filterFlowMode)
    } catch (e) { console.error('allWorkObjectList 加载失败', e) }
  }

  const initedRef = useRef(false)
  useEffect(() => {
    if (initedRef.current) return
    initedRef.current = true
    loadRegistration()
    //loadAllWorkObjects()
  }, [])

  return (
    <SettingPageLayout title="登记设置" sectionKey="reg">
      <WorkHourSettings
        key={registration?.id || (registration?.list ? 'loaded' : 'pending')}
        workItemKeyTypes={workItemKeyTypes}
        workFlowObjectList={workFlowObjectList}
        registerLevelConfigVos={registerLevelConfigVos}
        registerRecordEnumList={registerRecordEnumList}
        capacityInitialValues={capacityInitialValues}
        registrationSettingsConfig={registration}
        projectKey={projectKey}
        setIsCapacityFormOpen={(val) => {
          navigate('/admin', { state: { activeSection: 'reg' } })
        }}
      />
    </SettingPageLayout>
  )
}

// 统计设置页
const StatsSettingPage = () => {
  const navigate = useNavigate()
  // 从 sessionStorage 读取当前空间的 projectKey
  const projectKey = sessionStorage.getItem('adminCurrentProjectKey') || ''
  const [statsConfig, setStatsConfig] = useState({})

  const loadStats = async () => {
    const res = await getMeasureProjectConfig({ type: 'ALLOW_MEASUREMENT', projectKey })
    if (res?.result) setStatsConfig(res.data || {})
  }

  const initedRef = useRef(false)
  useEffect(() => {
    if (initedRef.current) return
    initedRef.current = true
    loadStats()
  }, [])

  return (
    <SettingPageLayout title="统计设置" sectionKey="stats">
      <MeasureSet
        configMeasure={statsConfig}
        projectKey={projectKey}
        setIsMeasureSetOpen={(val) => {
          navigate('/admin', { state: { activeSection: 'stats' } })
        }}
      />
    </SettingPageLayout>
  )
}

// 工时审批设置页
const ApprovalSettingPage = () => {
  const navigate = useNavigate()
  // 从 sessionStorage 读取当前空间的 projectKey
  const projectKey = sessionStorage.getItem('adminCurrentProjectKey') || ''
  return (
    <SettingPageLayout title="工时审批设置" sectionKey="approval">
      <ApprovalSet
        projectKey={projectKey}
        setIsApprovalSetOpen={(val) => {
          navigate('/admin', { state: { activeSection: 'approval' } })
        }}
      />
    </SettingPageLayout>
  )
}

// 数据权限设置页
const PermSettingPage = () => {
  const navigate = useNavigate()
  // 从 sessionStorage 读取当前空间的 projectKey
  const projectKey = sessionStorage.getItem('adminCurrentProjectKey') || ''
  return (
    <SettingPageLayout title="权限设置" sectionKey="perm">
      <PermissionsSet
        projectKey={projectKey}
        setIsApprovalSetOpen={(needRefresh) => {
          navigate('/admin', {
            state: {
              activeSection: 'perm',
              refreshList: needRefresh !== false,
            },
          })
        }}
      />
    </SettingPageLayout>
  )
}

// 租户配置 - 数据权限设置页（独立路由，返回到 tenant-perm 菜单）
const TenantPermSettingPage = () => {
  const navigate = useNavigate()
  // 从 sessionStorage 读取当前空间的 projectKey
  const projectKey = sessionStorage.getItem('adminCurrentProjectKey') || ''
  return (
    <SettingPageLayout title="权限设置" sectionKey="tenant-perm">
      <Card className="admin-section admin-plain-card">
        <PermissionRuleTable
          projectKey={projectKey}
          onClose={(needRefresh) => {
            navigate('/admin', {
              state: {
                activeSection: 'tenant-perm',
                refreshList: needRefresh !== false,
              },
            })
          }}
        />
      </Card>
    </SettingPageLayout>
  )
}

// 数据权限规则表格 - 内嵌实现，点击单元格调起弹窗
// 默认枚举值（接口异常或返回为空时使用，确保弹窗内可正常选择）
const DEFAULT_DATA_AUTH_ENUM = [
  { label: '插件管理员', value: 'plugin_administrator' },
  { label: '团队管理员', value: 'team_administrator' },
  { label: '所有成员', value: 'all_members' },
  { label: '指定成员', value: 'specified_members' },
]
const DEFAULT_DATA_SCOPE_ENUM = [
  { label: '所有成员和团队', value: 'all_data' },
  { label: '所有团队', value: 'all_teams' },
  { label: '我管理的团队', value: 'my_teams' },
  { label: '指定成员', value: 'specified_members' },
  { label: '指定团队', value: 'specified_teams' },
  { label: '指定部门', value: 'specified_departments' },
  { label: '仅自己', value: 'only_myself' },
]

const PermissionRuleTable = ({ projectKey: projectKeyProp, onClose }) => {
  // 团队默认头像
  const TEAM_DEFAULT_AVATAR = 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png'
  // 优先使用父组件传入的 projectKey，未传入时回退到 sessionStorage
  const projectKey = projectKeyProp || sessionStorage.getItem('adminCurrentProjectKey') || ''
  const [loading, setLoading] = useState(false)
  const [authConfigsData, setAuthConfigsData] = useState([])
  // 初始用默认值，避免接口返回前/异常时弹窗空白
  const [dataAuthEnumList, setDataAuthEnumList] = useState(DEFAULT_DATA_AUTH_ENUM)
  const [dataScopeEnumList, setDataScopeEnumList] = useState(DEFAULT_DATA_SCOPE_ENUM)

  // 弹窗状态
  const [memberModalOpen, setMemberModalOpen] = useState(false)
  const [scopeModalOpen, setScopeModalOpen] = useState(false)
  // 当前编辑的行 ID
  const [currentEditRowId, setCurrentEditRowId] = useState(null)
  // 当前选中的 authObj / dataScope
  const [tempAuthObj, setTempAuthObj] = useState('')
  const [tempDataScope, setTempDataScope] = useState('')
  // 选择成员/团队的状态（指定成员、指定团队场景使用）
  const [selectedUser, setSelectedUser] = useState({
    selectedDeparts: [],
    selectedUsers: [],
    selectedDepartIds: [],
    selectedUserIds: [],
    checkedKeys: [],
  })

  // 重置选择状态
  const resetSelectedUser = () => {
    setSelectedUser({
      selectedDeparts: [],
      selectedUsers: [],
      selectedDepartIds: [],
      selectedUserIds: [],
      checkedKeys: [],
    })
  }

  // 接收子组件选择回调
  const handleSelectUserChange = (user) => {
    setSelectedUser({ ...user })
  }

  // 数据范围描述
  const getScopeDesc = (value) => {
    const v = typeof value === 'string' ? value.toLowerCase() : ''
    switch (value) {
      case 'isv_all_data':
        return '可以查看所有成员、团队和部门数据'
      case 'all_data':
        return '可以查看所有成员和团队的数据'
      case 'my_teams':
        return '仅能查看自己管理的团队内所有成员的数据'
      case 'specified_members':
        return '手动选择可查看的成员数据'
      case 'all_teams':
        return '可查看该空间下所有授权团队'
      case 'specified_teams':
        return '手动选择可查看的团队数据'
      case 'specified_departments':
      case 'specified_department':
      case 'specified_dept':
        return '手动选择可查看的部门数据'
      case 'only_myself':
        return '仅自己'
      default:
        if (v.includes('dept') || v.includes('department')) return '手动选择可查看的部门数据'
        return ''
    }
  }

  // 初始化数据
  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    setLoading(true)
    try {
      const res = await getIsvDataAuthConfig()
      if (res?.result && res?.data) {
        const data = res.data
        // 处理 dataAuthEnumList（仅当返回非空时覆盖默认值）
        const authEnumList = data.dataAuthEnumList || data.dataAuthList
        if (Array.isArray(authEnumList) && authEnumList.length > 0) {
          setDataAuthEnumList(
            authEnumList.map((item) => ({
              label: item.value,
              value: item.level,
            }))
          )
        }
        // 处理 dataScopeEnumList（仅当返回非空时覆盖默认值）
        if (Array.isArray(data.dataScopeEnumList) && data.dataScopeEnumList.length > 0) {
          const mapped = data.dataScopeEnumList.map((item) => {
            const rawValue = item.level || item.value
            const rawLabel = item.value || item.label
            // 容错：将后端可能的部门枚举值（驼峰/单数/大小写差异）统一规范化为 specified_departments
            let normalized = rawValue
            if (typeof rawValue === 'string' && rawValue.toLowerCase().includes('department')) {
              normalized = 'specified_departments'
            }
            return {
              label: rawLabel,
              value: normalized,
            }
          })
          setDataScopeEnumList(mapped)
        }
        // 处理 authConfigs
        if (Array.isArray(data.authConfigs)) {
          const sorted = [...data.authConfigs]
            .sort((a, b) => (a.sort || 0) - (b.sort || 0))
            .map((row) => {
              // ISV 接口返回字段为 dataAuthUserVos，统一映射为内部使用的 dataAuthOutIdVos（保留完整对象用于回显）
              const userVos = Array.isArray(row.dataAuthUserVos) ? row.dataAuthUserVos : []
              const outIdVos = Array.isArray(row.dataAuthOutIdVos) ? row.dataAuthOutIdVos : []
              const merged = (outIdVos.length ? outIdVos : userVos).map((u) => {
                if (!u) return null
                if (typeof u === 'string') {
                  return { outId: u }
                }
                return {
                  ...u,
                  outId: u.outId || u.unionId || u.userKey || u.staffId || u.id,
                  userName: u.userName || u.username || u.staffName || u.name,
                  avatarUrl: u.avatarUrl || u.staffAvatarUrl,
                }
              }).filter(Boolean)
              return {
                ...row,
                dataAuthOutIdVos: merged,
              }
            })
          setAuthConfigsData(sorted)
        }
      }
    } catch (e) {
      console.error('加载数据权限配置失败:', e)
      // 接口异常时保留默认枚举，确保弹窗可用
    } finally {
      setLoading(false)
    }
  }

  // 添加行
  const handleAddRow = () => {
    const maxId = authConfigsData.reduce(
      (max, r) => Math.max(max, Number(r.id) || 0),
      0
    )
    const newId = maxId + 1
    const newRow = {
      id: newId,
      authObj: '',
      authObjValue: '',
      isDefault: false,
      dataAuthOutIdVos: [],
      dataAuthExtraVos: [
        {
          id: newId,
          authId: newId,
          dataScope: '',
          dataScopeValue: '',
          outId: null,
          userName: null,
          avatarUrl: null,
          teamId: null,
          teamName: null,
          isDefault: false,
        },
      ],
    }
    setAuthConfigsData([...authConfigsData, newRow])
  }

  // 删除行
  const handleDeleteRow = (record) => {
    setAuthConfigsData(authConfigsData.filter((r) => r.id !== record.id))
  }

  // 打开成员选择弹窗
  const handleOpenMemberModal = (record) => {
    if (record.isDefault) return
    setCurrentEditRowId(record.id)
    setTempAuthObj(record.authObj || '')
    // 如果是指定成员场景，将已选成员同步到 selectedUser
    // 兼容接口字段 dataAuthUserVos / 内部字段 dataAuthOutIdVos
    const vos = (Array.isArray(record.dataAuthOutIdVos) && record.dataAuthOutIdVos.length)
      ? record.dataAuthOutIdVos
      : (Array.isArray(record.dataAuthUserVos) ? record.dataAuthUserVos : [])
    if (record.authObj === 'specified_members' && vos.length) {
      setSelectedUser({
        selectedDeparts: [],
        selectedUsers: vos,
        selectedDepartIds: [],
        selectedUserIds: vos.map((u) => u.unionId || u.outId || u.userKey),
        checkedKeys: [],
      })
    } else {
      resetSelectedUser()
    }
    setMemberModalOpen(true)
  }

  // 关闭成员选择弹窗
  const handleCloseMemberModal = () => {
    setMemberModalOpen(false)
    setTempAuthObj('')
    setCurrentEditRowId(null)
    resetSelectedUser()
  }

  // 确定成员选择
  const handleConfirmMember = () => {
    if (!tempAuthObj) {
      JSSDK?.toast?.warning?.('请选择成员')
      return
    }
    // 指定成员场景必须选择具体成员
    if (tempAuthObj === 'specified_members' && !selectedUser.selectedUsers.length) {
      JSSDK?.toast?.warning?.('请选择具体成员')
      return
    }
    const authType = dataAuthEnumList.find((i) => i.value === tempAuthObj)?.label
    // ISV租户模式：dataAuthOutIdVos 内部保留完整对象用于UI回显，提交时序列化为纯 outId 字符串数组（优先取 unionId）
    const dataAuthOutIdVos =
      tempAuthObj === 'specified_members'
        ? selectedUser.selectedUsers.map((u) => ({
            outId: u.unionId || u.outId || u.userKey || u.staffId || u.id,
            userName: u.userName || u.username || u.staffName || u.name,
            avatarUrl: u.avatarUrl || u.staffAvatarUrl,
          }))
        : []
    setAuthConfigsData((prev) =>
      prev.map((row) =>
        row.id === currentEditRowId
          ? { ...row, authObj: tempAuthObj, authObjValue: authType, dataAuthOutIdVos }
          : row
      )
    )
    handleCloseMemberModal()
  }

  // 打开可见数据范围弹窗
  const handleOpenScopeModal = (record) => {
    if (record.isDefault) return
    setCurrentEditRowId(record.id)
    const rawScope = record?.dataAuthExtraVos?.[0]?.dataScope || ''
    // 兼容后端返回的 'specified_department' / 'specified_dept'，前端统一使用 'specified_departments'
    const rawScopeValue = typeof rawScope === 'string' ? rawScope.toLowerCase() : ''
    const isDeptScope = rawScopeValue.includes('dept') || rawScopeValue.includes('department')
    const curScope = isDeptScope ? 'specified_departments' : rawScope
    setTempDataScope(curScope)
    // 如果是指定成员/团队/部门场景，将已选数据同步到 selectedUser
    if (
      (curScope === 'specified_members' || curScope === 'specified_teams' || curScope === 'specified_departments') &&
      Array.isArray(record.dataAuthExtraVos)
    ) {
      // 部门回显：保留原始字段（含 parentPath / deptName / deptId 等），并补 staffId / username 兼容 Tree 组件渲染
      const sourceVos = isDeptScope
        ? record.dataAuthExtraVos.map((u) => {
            const deptIdVal = u.deptId || u.departmentId || u.openDepartmentId || u.staffId || u.id
            const deptNameVal = u.deptName || u.departmentName || u.username || u.name
            return {
              ...u,
              staffId: deptIdVal,
              key: deptIdVal,
              deptId: deptIdVal,
              departmentId: deptIdVal,
              userKey: deptIdVal,
              deptName: deptNameVal,
              departmentName: deptNameVal,
              username: deptNameVal,
              userName: deptNameVal,
              parentPath: u.parentPath || '',
              isDepartment: true,
              staffAvatarUrl: u.avatarUrl || u.staffAvatarUrl,
            }
          })
        : record.dataAuthExtraVos
      setSelectedUser({
        selectedDeparts: [],
        selectedUsers: sourceVos,
        selectedDepartIds: [],
        selectedUserIds: sourceVos.map((u) => {
          if (curScope === 'specified_teams') {
            return u.teamId || u.staffId || u.id
          }
          if (curScope === 'specified_departments') {
            return u.deptId || u.departmentId || u.openDepartmentId || u.staffId || u.id
          }
          return u.unionId || u.outId || u.userKey || u.staffId || u.id
        }),
        checkedKeys: [],
      })
    } else {
      resetSelectedUser()
    }
    setScopeModalOpen(true)
  }

  // 关闭可见数据范围弹窗
  const handleCloseScopeModal = () => {
    setScopeModalOpen(false)
    setTempDataScope('')
    setCurrentEditRowId(null)
    resetSelectedUser()
  }

  // 确定可见数据范围
  const handleConfirmScope = () => {
    if (!tempDataScope) {
      JSSDK?.toast?.warning?.('请选择可见数据范围')
      return
    }
    // 指定成员/团队/部门场景必须选择具体成员/团队/部门
    if (tempDataScope === 'specified_members' && !selectedUser.selectedUsers.length) {
      JSSDK?.toast?.warning?.('请选择具体成员')
      return
    }
    if (tempDataScope === 'specified_teams' && !selectedUser.selectedUsers.length) {
      JSSDK?.toast?.warning?.('请选择具体团队')
      return
    }
    if (tempDataScope === 'specified_departments' && !selectedUser.selectedUsers.length) {
      JSSDK?.toast?.warning?.('请选择具体部门')
      return
    }
    const scopeType = dataScopeEnumList.find((i) => i.value === tempDataScope)?.label
    let dataAuthExtraVos = []
    if (tempDataScope === 'specified_members') {
      dataAuthExtraVos = selectedUser.selectedUsers.map((u) => ({
        dataScope: tempDataScope,
        dataScopeValue: scopeType,
        userKey: u.unionId || u.outId || u.userKey || u.staffId || u.id,
        userName: u.userName || u.username || u.staffName || u.name,
        avatarUrl: u.avatarUrl || u.staffAvatarUrl,
        teamId: null,
        teamName: null,
        deptId: null,
        deptName: null,
        isDefault: false,
        isAll: null,
      }))
    } else if (tempDataScope === 'specified_teams') {
      dataAuthExtraVos = selectedUser.selectedUsers.map((u) => ({
        dataScope: tempDataScope,
        dataScopeValue: scopeType,
        userKey: null,
        userName: null,
        teamId: u.teamId || u.staffId || u.id,
        teamName: u.teamName || u.username || u.name,
        avatarUrl: u.avatarUrl || u.staffAvatarUrl,
        deptId: null,
        deptName: null,
        isDefault: false,
        isAll: null,
      }))
    } else if (tempDataScope === 'specified_departments') {
      // 接口要求：dataScope 写为后端枚举 'specified_department'（单数），并补充 parentPath 字段
      dataAuthExtraVos = selectedUser.selectedUsers.map((u) => {
        const deptIdVal = u.deptId || u.departmentId || u.openDepartmentId || u.staffId || u.id
        const deptNameVal = u.deptName || u.departmentName || u.username || u.name
        return {
          dataScope: 'specified_department',
          dataScopeValue: scopeType,
          userName: null,
          teamId: null,
          teamName: null,
          deptId: deptIdVal,
          departmentId: deptIdVal,
          deptName: deptNameVal,
          departmentName: deptNameVal,
          staffId: deptIdVal,
          userKey: deptIdVal,
          username: deptNameVal,
          name: deptNameVal,
          parentPath: u.parentPath || '',
          avatarUrl: dept_img,
          staffAvatarUrl: dept_img,
          isDepartment: true,
          isDefault: false,
          isAll: null,
        }
      })
    } else {
      dataAuthExtraVos = [
        {
          dataScope: tempDataScope,
          dataScopeValue: scopeType,
          userKey: null,
          userName: null,
          teamId: null,
          teamName: null,
          deptId: null,
          deptName: null,
          avatarUrl: null,
          isDefault: false,
          isAll: null,
        },
      ]
    }
    setAuthConfigsData((prev) =>
      prev.map((row) =>
        row.id === currentEditRowId ? { ...row, dataAuthExtraVos } : row
      )
    )
    handleCloseScopeModal()
  }

  // 提交保存
  const handleSubmit = async () => {
    // 校验
    for (let i = 0; i < authConfigsData.length; i++) {
      const row = authConfigsData[i]
      if (!row.authObjValue) {
        JSSDK?.toast?.warning?.(`第 ${i + 1} 行请选择成员`)
        return
      }
      if (!row.dataAuthExtraVos?.[0]?.dataScope) {
        JSSDK?.toast?.warning?.(`第 ${i + 1} 行请选择可见数据范围`)
        return
      }
    }
    // ISV租户模式入参优化：
    // 1) 不传 projectKey（由网关/header带入）
    // 2) dataAuthOutIdVos 仅传 outId 字符串集合（ISV 模式优先取 unionId）
    // 3) 不再传 dataAuthUserVos
    // 4) dataAuthExtraVos 内部以 outId 字段标识人员（非 userKey），同样优先取 unionId
    const data = authConfigsData.map((row, idx) => {
      const {
        projectKey: _omitProjectKey,
        dataAuthUserVos: _omitDataAuthUserVos,
        dataAuthOutIdVos = [],
        dataAuthExtraVos = [],
        ...rest
      } = row
      return {
        ...rest,
        sort: idx + 1,
        dataAuthOutIdVos: dataAuthOutIdVos
          .map((u) => {
            if (!u) return null
            if (typeof u === 'string') return u
            return u.unionId || u.outId || u.userKey || u.staffId || u.id || null
          })
          .filter(Boolean),
        dataAuthExtraVos: dataAuthExtraVos.map((vo) => {
          const { userKey: _omitUserKey, outId: _omitOutId, ...voRest } = vo || {}
          const resolvedId = _omitUserKey || _omitOutId || vo?.outId || vo?.userKey || null
          return { ...voRest, outId: resolvedId, userKey: resolvedId }
        }),
      }
    })
    try {
      const res = await saveIsvDataAuthConfig(data)
      if (res?.result) {
        JSSDK?.toast?.success?.('保存成功')
        onClose?.(true)
      } else {
        JSSDK?.toast?.warning?.('保存失败')
      }
    } catch (e) {
      console.error('保存失败:', e)
      JSSDK?.toast?.warning?.('保存失败，请重试')
    }
  }

  // 表格列定义
  const columns = [
    {
      title: '授权对象',
      dataIndex: 'authObj',
      key: 'authObj',
      render: (_, record) => {
        const isDisabled = record.isDefault;
        // 指定成员：展示具体选中的成员名称+头像，否则展示类型名称
        // 兼容接口字段 dataAuthUserVos / 内部字段 dataAuthOutIdVos
        const memberVos = Array.isArray(record.dataAuthOutIdVos) && record.dataAuthOutIdVos.length
          ? record.dataAuthOutIdVos
          : (Array.isArray(record.dataAuthUserVos) ? record.dataAuthUserVos : [])
        return (
          <div>
            <div
              onClick={() => {
                if (!isDisabled) handleOpenMemberModal(record);
              }}
              className="auth-obj-item"
              style={{
                opacity: isDisabled ? 0.5 : 1,
                cursor: isDisabled ? 'not-allowed' : 'pointer'
              }}
            >
              {record.authObj === 'specified_members' ? (
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  {memberVos.length > 0 ? (
                    <>
                      {/* 显示前2个成员 */}
                      {memberVos.slice(0, 2).map((item, idx) => (
                        <span key={idx} className="user-item-area">
                          <img
                            src={item.avatarUrl || item.staffAvatarUrl || 'default-avatar-url'}
                            alt={item.userName || item.name}
                            style={{ width: '20px', height: '20px', borderRadius: '50%' }}
                          />
                          <span>{item.userName || item.name || item.username || ''}{item.tag === 0 ? ' [已删除]' : ''}</span>
                        </span>
                      ))}
                      {/* 超过2个成员，显示 +N 并 Tooltip */}
                      {memberVos.length > 2 && (
                        <Tooltip
                          title={
                            <div style={{ maxHeight: '300px', overflowY: 'auto', width: '100px' }}>
                              {memberVos.slice(2).map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                  <img
                                    src={item.avatarUrl || item.staffAvatarUrl || 'default-avatar-url'}
                                    alt={item.userName || item.name}
                                    style={{ width: '20px', height: '20px', borderRadius: '50%' }}
                                  />
                                  <span>{item.userName || item.name || item.username || ''}{item.tag === 0 ? ' [已删除]' : ''}</span>
                                </div>
                              ))}
                            </div>
                          }
                          placement="top"
                        >
                          <span className="user-item-area-num">+{memberVos.length - 2}</span>
                        </Tooltip>
                      )}
                    </>
                  ) : (
                    <span style={{ color: '#999' }}>请选择授权对象</span>
                  )}
                </div>
              ) : (
                <span>{record.authObjValue ? record.authObjValue : <span style={{ color: '#999' }}>请选择授权对象</span>}</span>
              )}
              <span className="auth-user-head"><img src={authLeftIcon} alt="auth_left" width="18px" /></span>
            </div>
          </div>
        );
      },
    },
    {
      title: '可见数据范围',
      dataIndex: 'dataScope',
      key: 'dataScope',
      render: (_, record) => {
        const isDisabled = record.isDefault;
        const firstScope = record?.dataAuthExtraVos?.[0]?.dataScope;
        // 指定成员/团队/部门：展示具体选中的名称+头像，否则展示类型名称
        const scopeValue = typeof firstScope === 'string' ? firstScope.toLowerCase() : '';
        const isDeptScope = scopeValue.includes('dept') || scopeValue.includes('department');
        const isTeamScope = firstScope === 'specified_teams';
        return (
          <div>
            <div
              onClick={() => {
                if (!isDisabled) handleOpenScopeModal(record);
              }}
              className="auth-obj-item"
              style={{
                opacity: isDisabled ? 0.5 : 1,
                cursor: isDisabled ? 'not-allowed' : 'pointer'
              }}
            >
              {record.dataAuthExtraVos && record.dataAuthExtraVos.length > 0 ? (
                (firstScope === 'specified_members' || isTeamScope || isDeptScope) ? (
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    {/* 显示前2个成员/团队/部门 */}
                    {record.dataAuthExtraVos.slice(0, 2).map((scopeItem, scopeIndex) => (
                      <span key={scopeIndex} className="user-item-area">
                        <img
                          src={scopeItem.departmentId ? dept_img : scopeItem.teamName ? team_img : (scopeItem.avatarUrl || scopeItem.staffAvatarUrl || 'default-avatar-url')}
                          alt={scopeItem.userName || scopeItem.teamName || scopeItem.departmentName}
                          style={{ width: '20px', height: '20px', borderRadius: (scopeItem.departmentName || scopeItem.teamName) ? '4px' : '50%' }}
                        />
                        <Tooltip title={(scopeItem.userName || scopeItem.departmentName || scopeItem.teamName || '') + (scopeItem.tag === 0 ? ' [已删除]' : '')}>
                          <span className="team-name-jx">
                            {scopeItem.userName || scopeItem.departmentName || scopeItem.teamName || ''}{scopeItem.tag === 0 ? ' [已删除]' : ''}
                          </span>
                        </Tooltip>
                      </span>
                    ))}
                    {/* 超过2个显示 +N 并 Tooltip */}
                    {record.dataAuthExtraVos.length > 2 && (
                      <Tooltip
                        title={
                          <div style={{ maxHeight: '300px', overflowY: 'auto', width: '150px' }}>
                            {record.dataAuthExtraVos.slice(2).map((scopeItem, scopeIndex) => (
                              <div key={scopeIndex} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <img
                                  src={scopeItem.departmentName ? dept_img : scopeItem.teamName ? team_img : (scopeItem.avatarUrl || scopeItem.staffAvatarUrl || 'default-avatar-url')}
                                  alt={scopeItem.userName || scopeItem.teamName || scopeItem.departmentName}
                                  style={{ width: '20px', height: '20px', borderRadius: (scopeItem.departmentName || scopeItem.teamName) ? '4px' : '50%' }}
                                />
                                <span className="teams-long-show">{scopeItem.userName || scopeItem.teamName || scopeItem.departmentName || ''}{scopeItem.tag === 0 ? ' [已删除]' : ''}</span>
                              </div>
                            ))}
                          </div>
                        }
                        placement="top"
                      >
                        <span className="user-item-area-num">+{record.dataAuthExtraVos.length - 2}</span>
                      </Tooltip>
                    )}
                  </div>
                ) : (
                  <span>{record.dataAuthExtraVos[0].dataScopeValue ? record.dataAuthExtraVos[0].dataScopeValue : <span style={{ color: '#999' }}>请选择可见数据范围</span>}</span>
                )
              ) : (
                <span style={{ color: '#999' }}>请选择可见数据范围</span>
              )}
              <span className="auth-user-head"><img src={authRightIcon} alt="auth_right" width="18px" /></span>
            </div>
          </div>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: '70px',
      align: 'center',
      render: (_, record) => {
        const isDisabled = record.isDefault;
        return (
          <div
            className="delete-text"
            onClick={() => !isDisabled && handleDeleteRow(record)}
            style={{
              opacity: isDisabled ? 0.5 : 1,
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              color: isDisabled ? '#ccc' : '#4247f6',
              textAlign: 'center'
            }}
          >
            删除
          </div>
        );
      }
    }
  ]

  return (
    <Spin spinning={loading}>
      <div className="admin-perm-rule-table">
        <div className="admin-perm-table-title">数据权限</div>
        <div className="admin-perm-table-tip">
          配置成员在资源管理、工时日志、工时管理页面的数据可见权限；用户最终权限 = 所有可查看的数据。
        </div>
        <Table
          className="admin-data-auth-table"
          size="middle"
          bordered
          pagination={false}
          rowKey="id"
          dataSource={authConfigsData}
          columns={columns}
          scroll={{ y: 432 }}
          locale={{ emptyText: <AdminEmpty description="暂无数据" /> }}
          footer={() => (
            <div className="add-row-container">
              <span onClick={handleAddRow} className="add-row-text">
                <img src={iconAdd} alt="添加" width={18} className="add-role-row" />
                添加数据权限
              </span>
            </div>
          )}
        />
        <div className="admin-perm-actions">
          <Button className="admin-perm-save-btn" type="primary" onClick={handleSubmit}>
            保存设置
          </Button>
        </div>

        {/* 成员选择弹窗 */}
        <Modal
          title="成员"
          open={memberModalOpen}
          onCancel={handleCloseMemberModal}
          onOk={handleConfirmMember}
          okText="确定"
          cancelText="取消"
          width={680}
          centered
          destroyOnHidden
          footer={
            <div style={{ display: 'flex', justifyContent: tempAuthObj === 'specified_members' ? 'space-between' : 'flex-end', alignItems: 'center' }}>
              {tempAuthObj === 'specified_members' && (<SyncTeamBtn />)}
              <div>
                <Button className="cancel-btn" onClick={handleCloseMemberModal}>取消</Button>
                <Button style={{ marginLeft: 8 }} type="primary" onClick={handleConfirmMember}>确定</Button>
              </div>
            </div>
          }
        >
          <div style={{ padding: '12px 0', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ marginRight: 12, flexShrink: 0 }}>选择成员：</span>
            <Radio.Group
              value={tempAuthObj}
              onChange={(e) => {
                const next = e.target.value
                // 切换类型时清空已选成员
                if (next !== tempAuthObj) resetSelectedUser()
                setTempAuthObj(next)
              }}
            >
              {dataAuthEnumList.map((item) => (
                <Radio key={item.value} value={item.value}>
                  {item.label}
                </Radio>
              ))}
            </Radio.Group>
          </div>
          {tempAuthObj === 'specified_members' && (
            <SelectedAuthUser
              type="authority"
              isIsv
              getSelectedUser={handleSelectUserChange}
              selectedUser={selectedUser}
            />
          )}
        </Modal>

        {/* 可见数据范围弹窗 */}
        <Modal
          title="可见数据范围"
          open={scopeModalOpen}
          onCancel={handleCloseScopeModal}
          onOk={handleConfirmScope}
          okText="确定"
          cancelText="取消"
          width={745}
          centered
          destroyOnHidden
          footer={
            <div style={{ display: 'flex', justifyContent: (tempDataScope === 'specified_members' || tempDataScope === 'specified_teams' || tempDataScope === 'specified_departments' || (typeof tempDataScope === 'string' && tempDataScope.toLowerCase().includes('department'))) ? 'space-between' : 'flex-end', alignItems: 'center' }}>
              {(tempDataScope === 'specified_members' || tempDataScope === 'specified_teams' || tempDataScope === 'specified_departments' || (typeof tempDataScope === 'string' && tempDataScope.toLowerCase().includes('department'))) && (<SyncTeamBtn />)}
              <div>
                <Button className="cancel-btn" onClick={handleCloseScopeModal}>取消</Button>
                <Button style={{ marginLeft: 8 }} type="primary" onClick={handleConfirmScope}>确定</Button>
              </div>
            </div>
          }
        >
          <div style={{ padding: '12px 0' }}>
            <Radio.Group
              value={tempDataScope}
              onChange={(e) => {
                const next = e.target.value
                // 切换类型时清空已选成员/团队
                if (next !== tempDataScope) resetSelectedUser()
                setTempDataScope(next)
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              {dataScopeEnumList
                .filter((i) => i.value !== 'only_myself')
                .map((item) => (
                  <Radio key={item.value} value={item.value}>
                    {item.label}
                    <span style={{ color: '#999', marginLeft: 8 }}>
                      （{getScopeDesc(item.value)}）
                    </span>
                  </Radio>
                ))}
            </Radio.Group>
          </div>
          {tempDataScope === 'specified_members' && (
            <SelectedAuthUser
              type="authority"
              isIsv
              getSelectedUser={handleSelectUserChange}
              selectedUser={selectedUser}
            />
          )}
          {tempDataScope === 'specified_teams' && (
            <SelectedAuthUser
              type="teams"
              isIsv
              getSelectedUser={handleSelectUserChange}
              selectedUser={selectedUser}
            />
          )}
          {(tempDataScope === 'specified_departments' || (typeof tempDataScope === 'string' && tempDataScope.toLowerCase().includes('department'))) && (
            <SelectedAuthUser
              type="departments"
              isIsv
              getSelectedUser={handleSelectUserChange}
              selectedUser={selectedUser}
            />
          )}
        </Modal>
      </div>
    </Spin>
  )
}

// 消息通知设置页
const NotifySettingPage = () => {
  const navigate = useNavigate()
  // 从 sessionStorage 读取当前空间的 projectKey，传给所有接口
  const projectKey = sessionStorage.getItem('adminCurrentProjectKey') || ''
  const [notifyConfig, setNotifyConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadNotification = async () => {
    setLoading(true)
    setError(null)
    try {
      // Promise.race 超时兜底，避免请求挂起导致无限 loading
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('请求超时，请检查网络后重试')), 15000)
      )
      const res = await Promise.race([
        getWorkHourReminderConfig({ isInner: true, projectKey }),
        timeoutPromise,
      ])
      if (res?.result && res?.data) {
        const d = { ...res.data }
        // 确保 commonConfigVo 存在，防止 NotificationSet 组件内部读取崩溃
        if (!d.commonConfigVo) {
          d.commonConfigVo = { value: 0 }
        }
        if (!d.selectFrequencyList) {
          d.selectFrequencyList = []
        }
        let time = d.remindTime || ''
        if (time.includes(':')) {
          const parts = time.split(':')
          if (parts.length >= 2) time = `${parts[0]}:${parts[1]}`
        }
        d.remindTime = time
        setNotifyConfig(d)
      } else {
        setError('获取配置数据失败')
      }
    } catch (e) {
      console.error('loadNotification error', e)
      setError(e?.message || '网络请求失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const initedRef = useRef(false)
  useEffect(() => {
    if (initedRef.current) return
    initedRef.current = true
    loadNotification()
  }, [])

  return (
    <SettingPageLayout title="消息通知" sectionKey="notify">
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin />
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
          <div style={{ marginBottom: 12, fontSize: 14 }}>{error}</div>
          <Button onClick={() => loadNotification()}>重新加载</Button>
        </div>
      ) : notifyConfig ? (
        <NotificationSet
          remindCommonConfigData={notifyConfig}
          projectKey={projectKey}
          setIsNotificationSetOpen={(val) => {
            navigate('/admin', { state: { activeSection: 'notify' } })
          }}
        />
      ) : (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <AdminEmpty description="暂无数据" />
          <Button onClick={() => loadNotification()}>重新加载</Button>
        </div>
      )}
    </SettingPageLayout>
  )
}

// 记录规范设置页
const StandardSettingPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  // 从 sessionStorage 读取当前空间的 projectKey，传给所有接口
  const projectKey = sessionStorage.getItem('adminCurrentProjectKey') || ''
  // 同步从 location.state 初始化，避免首次渲染传入空数据导致子组件回显失败
  const initialState = location.state || {}
  const [isAdd, setIsAdd] = useState(initialState.isAdd === 0 ? 0 : 1)
  const defaultConfigData = {
    standardsName: '',
    standWorkHour: 8,
    dayUp: 24,
    onceDown: 0.5,
    defaultUsers: []
  }
  const [standardConfigData, setStandardConfigData] = useState(
    initialState.isAdd === 0 && initialState.editData
      ? initialState.editData
      : defaultConfigData
  )
  // 来源页（'tenant-base' 或 'space-config'），决定返回时去往何处
  const [fromSource, setFromSource] = useState(
    initialState.from === 'space-config' ? 'space-config' : 'tenant-base'
  )

  useEffect(() => {
    // 从路由 state 接收编辑数据（同步初始化后仍需响应 state 变化）
    const state = location.state || {}
    if (state.from === 'space-config') {
      setFromSource('space-config')
    } else {
      setFromSource('tenant-base')
    }
    if (state.isAdd === 0 && state.editData) {
      setIsAdd(0)
      setStandardConfigData(state.editData)
    } else {
      // 新增模式，重置为默认值
      setIsAdd(1)
      setStandardConfigData(defaultConfigData)
    }
  }, [location.state])

  const handleSetStandardsSetOpen = (needRefresh) => {
    // 来源为空间配置时返回空间配置的 standard 区块，否则返回租户配置-基础设置
    if (fromSource === 'space-config') {
      navigate('/admin', {
        state: {
          activeSection: 'standard',
          refreshList: needRefresh,
        },
      })
    } else {
      navigate('/admin', {
        state: {
          activeSection: 'tenant-base',
          refreshList: needRefresh,
        },
      })
    }
  }

  return (
    <SettingPageLayout
      title={isAdd ? "添加记录规范" : "编辑记录规范"}
      sectionKey={fromSource === 'space-config' ? 'standard' : 'tenant-base'}
    >
      <Card className="admin-section admin-plain-card">
        <StandardsSet
          isAdd={isAdd}
          standardConfigData={standardConfigData}
          projectKey={projectKey}
          setStandardsSetOpen={handleSetStandardsSetOpen}
        />
      </Card>
    </SettingPageLayout>
  )
}

// 路由子页面映射
const SETTING_ROUTES = {
  'reg-setting': RegSettingPage,
  'stats-setting': StatsSettingPage,
  'approval-setting': ApprovalSettingPage,
  'perm-setting': PermSettingPage,
  'notify-setting': NotifySettingPage,
  'standard-setting': StandardSettingPage,
  'tenant-perm-setting': TenantPermSettingPage,
  'custom-field-setting': CustomFieldSettingPage,
}

// ========================================================== 主组件
export default function AdminPage() {
  const location = useLocation()
  const navigate = useNavigate()

  // ============================================================
  // 模块初始化（必须最先执行）：解析 URL ?mode=xxx&projectKey=yyy
  // 关键时序：必须在任何 useState/useEffect 之前同步把 URL 参数写入存储，
  // 这样后续 useState 初始化、loadSpaces() 读到的就是新模式+新空间，
  // 避免按"旧模式"先调一次错误接口（install/list vs admin/list）的竞态问题。
  // 仅在组件模块首次加载时执行一次（用 useRef 保护，防止 StrictMode 双调用副作用）
  // ============================================================
  const urlInitRef = useRef(null)
  if (urlInitRef.current === null) {
    try {
      const sp = new URLSearchParams(window.location.search)
      const urlMode = sp.get('mode')
      const urlProjectKey = sp.get('projectKey')
      if (urlMode === 'space' || urlMode === 'tenant') {
        setAppMode(urlMode)
      }
      if (urlProjectKey) {
        sessionStorage.setItem('adminCurrentProjectKey', urlProjectKey)
        sessionStorage.setItem('adminSelectedKey', urlProjectKey)
        // 把"需要置顶"的 projectKey 持久化（刷新页面后仍生效，直到用户手动切换空间为止）
        sessionStorage.setItem('adminPinnedProjectKey', urlProjectKey)
      }
      urlInitRef.current = { urlMode: urlMode || '', urlProjectKey: urlProjectKey || '' }
    } catch (e) {
      urlInitRef.current = { urlMode: '', urlProjectKey: '' }
    }
  }
  const initialUrlParams = urlInitRef.current

  // spaces 通过接口加载真实数据：
  //   - 空间模式：/api/tenant/projects/admin/list
  //   - 租户模式：/api/tenant/projects/install/list
  const [spaces, setSpaces] = useState([])
  const [spacesLoading, setSpacesLoading] = useState(false)
  // 角色加载状态：确保 getUserRoleInfo 完成后再渲染内容
  const [roleLoading, setRoleLoading] = useState(true)
  const [selectedKey, setSelectedKey] = useState(() => {
    return sessionStorage.getItem('adminSelectedKey') || 'mode-setting'
  })
  const [openKeys, setOpenKeys] = useState(['space-config'])

  // 加载空间列表（接口返回 [{ label, value }] 结构，转换为内部 { key, label, removable }）
  const loadSpaces = async () => {
    setSpacesLoading(true)
    try {
      const currentMode = getAppMode() || 'space'
      const userRole = getUserRole()
      const res = userRole === 'app_admin' ? await getInstallList() : await getAdminList()
      //const res = currentMode === 'tenant' ? await getInstallList() : await getInstallList()
      // 兼容两种返回格式：res.code === 200 / res.result === true
      const list = (res?.code === 200 || res?.result) && Array.isArray(res?.data) ? res.data : []
      if (list.length > 0) {
        const mapped = list.map((item, idx) => ({
          key: item.value || `space-${idx}`,
          label: item.level || '未命名空间',
        }))
        setSpaces(mapped)
        // space_admin 页面初始化时，自动选中第一个空间
        // 仅当没有 URL/置顶的 pendingProjectKey 时才触发，避免与 pendingProjectKey useEffect 冲突
        if (userRole === 'space_admin') {
          const pendingFromStorage = sessionStorage.getItem('adminPinnedProjectKey') || ''
          const pendingFromUrl = initialUrlParams.urlProjectKey || ''
          if (!pendingFromStorage && !pendingFromUrl) {
            const firstSpace = mapped[0]
            setSelectedKey(firstSpace.key)
            sessionStorage.setItem('adminSelectedKey', firstSpace.key)
            sessionStorage.setItem('adminCurrentProjectKey', firstSpace.key)
          }
        }
      } else {
        setSpaces([])
      }
    } catch (e) {
      console.error('加载空间列表失败:', e)
      setSpaces([])
    } finally {
      setSpacesLoading(false)
    }
  }

  // ============================================================
  // URL 参数支持：?mode=space|tenant & projectKey=xxx
  // 上方 urlInitRef 已经在 render 开始就同步写入 localStorage/sessionStorage，
  // 这里只负责：① 列表加载完后定位选中  ② 清理 URL 查询串
  // ============================================================

  // 获取用户角色信息（必须在渲染内容前完成）
  const fetchUserRole = async () => {
    setRoleLoading(true)
    try {
      const res = await getUserRoleInfo()
      const role = res?.data?.userRole || 'app_admin'
      //const role = 'member'
      // 后端返回的 mode 为权威值，同步到本地，避免被别人切换模式后本地 localStorage 仍是旧值
      const appMode = res?.data?.mode || 'space'
      setAppMode(appMode)
      localStorage.setItem('meegoTeamworkUserRole', role)
      setUserRole(role)
      // 如果是普通成员，无管理权限，跳转到资源管理页面
      if (role === 'member') {
        navigate('/resource', { replace: true })
        return false
      }
      return true
    } catch (e) {
      console.error('获取用户角色失败:', e)
      return true
    } finally {
      setRoleLoading(false)
    }
  }

  // 初始化加载：先获取用户角色，再加载空间列表
  useEffect(() => {
    const init = async () => {
      const canAccess = await fetchUserRole()
      if (canAccess) {
        loadSpaces()
      }
    }
    init()
  }, [])

  // 首次进入后清理 URL 查询串（避免回退/刷新时重复触发）
  useEffect(() => {
    if (initialUrlParams.urlMode || initialUrlParams.urlProjectKey) {
      navigate(location.pathname, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 空间列表加载完成后，若 URL 携带了 projectKey（或 sessionStorage 中有已置顶的 projectKey），
  // 则在列表中查找并选中，同时置顶到第一条。刷新页面后依然生效，直到用户手动切换其他空间为止。
  const [pendingProjectKey, setPendingProjectKey] = useState(
    initialUrlParams.urlProjectKey || sessionStorage.getItem('adminPinnedProjectKey') || ''
  )
  useEffect(() => {
    if (!pendingProjectKey) return
    if (!Array.isArray(spaces) || spaces.length === 0) return
    const targetIndex = spaces.findIndex((s) => s.key === pendingProjectKey)
    if (targetIndex >= 0) {
      const target = spaces[targetIndex]
      // 命中：置顶该条，并设为选中
      if (targetIndex > 0) {
        const reordered = [target, ...spaces.slice(0, targetIndex), ...spaces.slice(targetIndex + 1)]
        setSpaces(reordered)
      }
      setSelectedKey(target.key)
      sessionStorage.setItem('adminSelectedKey', target.key)
      sessionStorage.setItem('adminCurrentProjectKey', target.key)
    }
    // 处理完后清空 pending，避免重复触发
    setPendingProjectKey('')
  }, [pendingProjectKey, spaces])

  // 模式/角色/空间加载完成后，若当前 selectedKey 在当前模式下不合法（例如模式被他人切换后
  // sessionStorage 仍残留 tenant-perm，而当前已切回空间模式），则回退到一个安全的默认项，
  // 避免出现"菜单已消失但右侧仍渲染租户专属页面"的残留问题
  useEffect(() => {
    if (roleLoading) return
    if (spacesLoading) return
    if (pendingProjectKey) return // 等待空间置顶逻辑完成再判断
    const currentMode = getAppMode() || 'space'
    const userRole = localStorage.getItem('meegoTeamworkUserRole') || 'app_admin'
    const isSpaceKey = (k) => spaces.some((s) => s.key === k)
    const isTenantOnlyKey = (k) => k === 'tenant-base' || k === 'tenant-perm'
    const isAlwaysAvailable = (k) =>
      k === 'mode-setting' || k === 'tenant-custom-field' || k === 'tenant-admin' || k === 'member-select-demo'

    const valid = isSpaceKey(selectedKey) || isAlwaysAvailable(selectedKey) ||
      (currentMode === 'tenant' && userRole === 'app_admin' && isTenantOnlyKey(selectedKey))
    if (valid) return

    // 回退策略：app_admin 默认到 mode-setting；space_admin 默认到第一个空间
    let fallback = 'mode-setting'
    if (userRole === 'space_admin' && spaces.length > 0) {
      fallback = spaces[0].key
    }
    setSelectedKey(fallback)
    sessionStorage.setItem('adminSelectedKey', fallback)
  }, [roleLoading, spacesLoading, pendingProjectKey, spaces, selectedKey])

  // 判断当前是否处于设置子页面
  const subPath = location.pathname.replace(/^\/admin\/?/, '')
  const SettingComp = SETTING_ROUTES[subPath] || null

  // 子页面模式/权限兜底：若当前访问的子页面在当前模式/角色下不合法，
  // （典型场景：模式被他人改为空间模式后刷新，仍停留在租户专属子页，或角色无对应空间上下文）
  // 则直接导航回 /admin，避免子页面残留渲染
  useEffect(() => {
    if (roleLoading) return
    if (!subPath || !SettingComp) return
    const currentMode = getAppMode() || 'space'
    const userRole = localStorage.getItem('meegoTeamworkUserRole') || 'app_admin'
    // 仅租户模式且 app_admin 可访问的子页面
    const tenantOnlySubPages = ['tenant-perm-setting']
    // 必须处于某个空间上下文才能访问的子页面（空间配置类）
    const spaceScopedSubPages = ['reg-setting', 'stats-setting', 'approval-setting', 'perm-setting', 'notify-setting']
    let invalid = false
    if (tenantOnlySubPages.includes(subPath)) {
      // 空间模式下、或非 app_admin 角色，不允许访问租户专属页
      if (currentMode !== 'tenant' || userRole !== 'app_admin') invalid = true
    } else if (subPath === 'custom-field-setting') {
      // 自定义字段是租户级配置，两种模式共用，但仅应用管理员可维护
      if (userRole !== 'app_admin') invalid = true
    } else if (spaceScopedSubPages.includes(subPath)) {
      // 没有 projectKey（即没有选中任何空间）时不允许访问空间配置子页
      const pk = sessionStorage.getItem('adminCurrentProjectKey')
      if (!pk) invalid = true
    } else if (subPath === 'standard-setting') {
      // 记录规范页：根据进入来源( fromSource )判定是否合法
      // - from='space-config'：空间配置入口，空间模式下合法（需有 projectKey）
      // - from='tenant-base' 或 无显式来源：租户基础设置入口，仅租户模式下合法
      //   空间模式下若没有 projectKey，亦视为非法（避免模式切换后页面残留）
      const from = location.state?.from
      const pk = sessionStorage.getItem('adminCurrentProjectKey')
      if (from === 'space-config') {
        if (!pk) invalid = true
      } else {
        // tenant-base 或无 from
        if (currentMode !== 'tenant') invalid = true
      }
    }
    if (invalid) {
      // 清理可能残留的选中 key，触发主页面兜底逻辑
      sessionStorage.removeItem('adminSelectedKey')
      sessionStorage.removeItem('adminCurrentProjectKey')
      navigate('/admin', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading, subPath, location.state])

  // 处理空间项点击
  const handleSpaceItemClick = (key) => {
    setSelectedKey(key)
    sessionStorage.setItem('adminSelectedKey', key)
    sessionStorage.setItem('adminCurrentProjectKey', key)
    // 用户主动切换空间后，清掉"URL 置顶"的记忆，避免下次刷新被强制重置
    sessionStorage.removeItem('adminPinnedProjectKey')
    // 如果当前在设置子页面，导航回 /admin
    const subPath2 = location.pathname.replace(/^\/admin\/?/, '')
    navigate('/admin')
    // if (subPath2 && SETTING_ROUTES[subPath2]) {
    //   console.log('Navigating back to /admin')
    //   navigate('/admin')
    // }
  }

  const menuItems = useMemo(
    () => buildMenuItems(spaces, handleSpaceItemClick, selectedKey),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spaces, selectedKey]
  )

  // 当前选中节点对应的渲染逻辑
  const renderMain = () => {
    const space = spaces.find((s) => s.key === selectedKey)
    if (space) return <SpaceConfigContent space={space} />
    if (selectedKey === 'mode-setting') return <ModeSettingContent />
    if (selectedKey === 'tenant-base') return <TenantBaseContent />
    if (selectedKey === 'tenant-perm') return <TenantPermContent />
    if (selectedKey === 'tenant-custom-field') {
      return <CustomFieldSummary onSetting={() => navigate('/admin/custom-field-setting')} />
    }
    if (selectedKey === 'tenant-admin') return <TenantAdminContent />
    if (selectedKey === 'member-select-demo') return <MemberSelectDemoContent />
    return <SimplePlaceholder title="系统设置" />
  }

  return (
    <div className="admin-page">
      <aside className="admin-sider">
        {getUserRole() !== 'space_admin' && (
          <div className="admin-sider-header">工时资源管理</div>
        )}
        {/* 角色加载中或空间配置加载中：显示 loading 占位，避免渲染不完整的菜单结构 */}
        {roleLoading || spacesLoading ? (
          <div style={{ padding: '24px 16px', textAlign: 'center' }}>
            <Spin size="small" />
          </div>
        ) : (
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            openKeys={openKeys}
            onOpenChange={setOpenKeys}
            onClick={({ key }) => {
              // 虚拟节点不触发选择
              if (key === 'space-config-list') return
              setSelectedKey(key)
              sessionStorage.setItem('adminSelectedKey', key)
              // 如果当前在设置子页面，导航回 /admin
              const subPath = location.pathname.replace(/^\/admin\/?/, '')
              if (subPath && SETTING_ROUTES[subPath]) {
                navigate('/admin')
              }
            }}
            items={menuItems}
            className="admin-menu"
          />
        )}
      </aside>

      <main className="admin-main">
        {roleLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Spin tip="加载中..." />
          </div>
        ) : (
          SettingComp ? <SettingComp /> : renderMain()
        )}
      </main>
    </div>
  )
}
