import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Modal, Input, Avatar, Checkbox, Button, Spin, Tooltip, message } from 'antd'
import { SearchOutlined, CloseOutlined, RightOutlined, InfoCircleFilled} from '@ant-design/icons'
import { getWebhookUserList, getTeamSearch, getOrgTree, getDataAuthRemoveInfo } from '../../api/api'
import SyncTeamBtn from '../sync-team-btn/SyncTeamBtn'
import { List, AutoSizer } from 'react-virtualized'
import deptIcon from '../../assets/zuzhi.png'
import './MemberSelectModal.less'
import teamIcon from '../../assets/team.png'
import noDataImg from '../../assets/images/no-data.png'
// 团队统一头像（飞书 CDN）
const TEAM_ICON_URL = teamIcon
// 部门统一头像（本地组织架构图标）
const DEPT_ICON_URL = deptIcon

const NoDataEmpty = () => (
  <div className="msm-no-data">
    <img src={noDataImg} alt="暂无数据" />
    <div>暂无数据</div>
  </div>
)

// TAB 配置
const TAB_LIST = [
  { key: 'member', label: '成员' },
  { key: 'team', label: '团队' },
  { key: 'department', label: '组织架构' },
]

// 虚拟滚动行高常量
const LEFT_ROW_HEIGHT = 44
const RIGHT_ROW_HEIGHT_DEPT = 56   // 部门行高
const RIGHT_ROW_HEIGHT_OTHER = 44  // 成员/团队行高

// 递归建立 id → node 的映射（含 children 引用，跳过用户节点）
const buildDeptMap = (nodes, map = {}) => {
  if (!Array.isArray(nodes)) return map
  nodes.forEach((node) => {
    if (isUserNode(node)) return // 跳过用户节点
    const id = node.departmentId || node.openDepartmentId
    if (id) map[id] = node
    if (node.children?.length) buildDeptMap(node.children, map)
  })
  return map
}

// 判断节点是否为用户节点（org/tree 接口中用户和部门混在 children 里）
const isUserNode = (node) => {
  if (!node) return false
  return !!(node.userKey || node.unionId || node.type === 'user' || node.nodeType === 'user')
}

// 从混合 children 中分离出部门子节点和用户节点
const splitChildren = (children) => {
  if (!Array.isArray(children)) return { deptChildren: [], userChildren: [] }
  const deptChildren = []
  const userChildren = []
  children.forEach((n) => {
    if (isUserNode(n)) userChildren.push(n)
    else deptChildren.push(n)
  })
  return { deptChildren, userChildren }
}

// ===================== React.memo 行组件 =====================

/**
 * ✅ P2优化：左侧列表行组件 - React.memo 避免不必要的重渲染
 * 配合 ref-based callbacks 确保只有可见行参与渲染
 */
const LeftRow = React.memo(({
  item, activeTab, isChecked, isItemIndeterminate,
  isDeptManualChecked, onCheck, onInfoClick, onExpand,
}) => {
  const isDeptType = item.itemType === 'department'
  const showExpand = activeTab === 'department' && item.hasChildren
  const showAvatarText = !isDeptType && activeTab !== 'team'

  return (
    <div className={`msm-list-item${isChecked ? ' is-checked' : ''}`}>
      <Checkbox
        checked={isChecked}
        indeterminate={isItemIndeterminate}
        onChange={(e) => onCheck(item.id, e.target.checked, item.itemType)}
      />
      <Avatar
        size={20}
        src={item.avatar || undefined}
        style={{ backgroundColor: 'transparent', color: '#1f2329', flexShrink: 0 }}
      >
        {showAvatarText ? item.name?.charAt(0) : null}
      </Avatar>
      <div className="msm-list-item-info" onClick={() => onInfoClick(item)}>
        <Tooltip title={item.name} placement="topLeft">
          <span className="msm-list-item-name">{item.name}</span>
        </Tooltip>
        {item.org && <Tooltip title={item.org} placement="topLeft"><span className="msm-list-item-org">{item.org}</span></Tooltip>}
      </div>
      {showExpand && (
        <span
          className={`msm-list-item-expand${isDeptManualChecked ? ' is-disabled' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            if (!isDeptManualChecked) onExpand(item.id)
          }}
        >
          展开
        </span>
      )}
    </div>
  )
})

/**
 * ✅ P2优化：右侧已选行组件 - React.memo 避免不必要的重渲染
 */
const RightRow = React.memo(({ item, onRemove }) => {
  const subText = item.type === 'member' || item.type === 'team' ? '' : (item.tagLabel || '')
  const isTeamOrDept = item.type === 'team' || item.type === 'department'
  return (
    <div className="msm-right-item">
      <div className="msm-right-item-left">
        <Avatar
          size={20}
          src={item.avatar ||  item.avatarUrl || undefined}
          style={{ backgroundColor: 'transparent', color: '#1f2329', flexShrink: 0 }}
        >
          {!isTeamOrDept ? item.name?.charAt(0) : null}
        </Avatar>
        <div className="msm-right-item-info">
          <Tooltip title={item.name} placement="topLeft">
            <span className="msm-right-item-name">{item.name}</span>
          </Tooltip>
          {subText && <Tooltip title={subText} placement="topLeft"><span className="msm-right-item-sub">{subText}</span></Tooltip>}
        </div>
      </div>
      <Button
        type="text"
        size="small"
        icon={<CloseOutlined />}
        onClick={() => onRemove(item)}
      />
    </div>
  )
})

/**
 * 选择成员弹窗组件
 *
 * Props:
 *   open          - 弹窗是否可见
 *   onCancel      - 取消回调
 *   onConfirm     - 确定回调
 *   initialValue  - 初始回填数据（来自统一查询设置接口）
 *                   { selectUserList, selectOrgList, selectTeamList, isSynchronous, isSelectedTeamAdmin, isAllUser, isAllTeam }
 */
const MemberSelectModal = ({ open, onCancel, onConfirm, initialValue,queryType}) => {
  const [activeTab, setActiveTab] = useState('member')
  const [searchKey, setSearchKey] = useState('')
  const [loading, setLoading] = useState(false)

  // 三个 tab 各自的数据源
  const [memberList, setMemberList] = useState([])
  const [teamList, setTeamList] = useState([])

  // 部门树：完整原始数据 + 导航路径
  const orgTreeRef = useRef([])       // 顶层 departments 数组
  const rootUsersRef = useRef([])      // 顶层不属于任何部门的用户（rootUsers）
  const deptMapRef = useRef({})       // id → node 映射
  const [deptPath, setDeptPath] = useState([]) // [{ id, name }] 导航路径
  const [tenantName, setTenantName] = useState('')
  // ✅ 是否有组织机构数据，没有时不显示租户名称
  const [hasDeptData, setHasDeptData] = useState(false)
  // ✅ 部门数据加载完成信号，用于触发依赖 ref 数据的 useMemo 重新计算
  const [deptLoaded, setDeptLoaded] = useState(false)

  // 三个 tab 各自独立的选中 ID 集合
  const [checkedMemberIds, setCheckedMemberIds] = useState(() => new Set())
  const [checkedTeamIds, setCheckedTeamIds] = useState(() => new Set())
  const [checkedDepartIds, setCheckedDepartIds] = useState(() => new Set())

  // 保留完整原始数据（按 id 索引），确保右侧已选能取到完整信息
  const dataMapRef = useRef({ member: {}, team: {}, department: {} })

  // ✅ P1优化：userId → Set<deptId> 反向索引，避免每次勾选全量递归
  const userDeptIndexRef = useRef({})
  // 子部门 → 父部门映射，用于子部门勾选时向上标记父部门半选
  const deptParentMapRef = useRef({})

  const [selectTeamAdmin, setSelectTeamAdmin] = useState(true)
  const [isSynchronous, setIsSynchronous] = useState(false)
  // ✅ removeRef 数据加载完成信号，用于触发 allSelectedItems 重新过滤
  const [removeLoaded, setRemoveLoaded] = useState(false)

  // 各 tab 独立的全选标记（传递给父组件的 API 标记，与当前列表勾选状态解耦）
  const [isAllUser, setIsAllUser] = useState(false)
  const [isAllTeam, setIsAllTeam] = useState(false)
  const [isAllDepartment, setIsAllDepartment] = useState(false)

  // ✅ P2优化：ref-based callbacks，确保 memo 组件拿到最新函数而不触发多余重渲染
  const callbacksRef = useRef({})
  const removeRef = useRef({})
  // ===================== 数据加载 =====================
  const fetchMembers = useCallback(async (keyword = '') => {
    setLoading(true)
    try {
      const res = await getWebhookUserList({ needExcludeAdmin: false, needCheckAuth: true, name: keyword })
      if (res?.code === 200 && Array.isArray(res.data)) {
        const list = res.data.map((u) => ({
          id: u.unionId,
          name: u.name,
          avatar: u.avatarUrl || '',
          org: '',
          unionId: u.unionId,
          userKey: u.userKey,
        }))
        setMemberList(list)
        list.forEach((item) => { dataMapRef.current.member[item.id] = item })
      }
    } catch (e) { console.error('获取成员列表失败:', e) }
    finally { setLoading(false) }
  }, [])

  const fetchTeams = useCallback(async (keyword = '') => {
    setLoading(true)
    try {
      const res = await getTeamSearch({ needCheckAuth: true, teamName: keyword })
      if (res?.code === 200 && Array.isArray(res.data)) {
        const list = res.data.map((t) => ({
          id: t.teamId,
          name: t.teamName,
          avatar: TEAM_ICON_URL,
          color: '#1664ff',
          teamId: t.teamId,
        }))
        setTeamList(list)
        list.forEach((item) => { dataMapRef.current.team[item.id] = item })
      }
    } catch (e) { console.error('获取团队列表失败:', e) }
    finally { setLoading(false) }
  }, [])

  const fetchDepartments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getOrgTree({ needCheckAuth: true })
      if (res?.code === 200 && res.data) {
        const departments = Array.isArray(res.data) ? res.data : (res.data.departments || [])
        const tenantName = (!Array.isArray(res.data) && res.data.tenantName) ? res.data.tenantName : ''
        // 提取 rootUsers：顶层不属于任何部门的用户
        const rootUsers = (!Array.isArray(res.data) && Array.isArray(res.data.rootUsers)) ? res.data.rootUsers : []
        setTenantName(tenantName)
        setHasDeptData(departments.length > 0)
        orgTreeRef.current = departments
        rootUsersRef.current = rootUsers
        deptMapRef.current = buildDeptMap(departments)

        // ✅ P1优化：同时构建 userId → Set<deptId> 反向索引 + 子→父映射
        const userIdToDeptIds = {}
        const childToParent = {} // childDeptId → parentDeptId
        const addAll = (nodes, parentPath = tenantName ? [tenantName] : [], parentId = null) => {
          if (!Array.isArray(nodes)) return
          nodes.forEach((n) => {
            const id = n.departmentId || n.openDepartmentId
            if (parentId) childToParent[id] = parentId // 记录父子关系
            const fullPath = [...parentPath, n.name]
            dataMapRef.current.department[id] = {
              id, name: n.name, avatar: DEPT_ICON_URL, color: '#7b61ff',
              tagLabel: fullPath.join(' / '),
              departmentId: n.departmentId,
              openDepartmentId: n.openDepartmentId,
              unionId: n.unionId,
              userKey: n.userKey,
            }
            // 从混合 children 中分离出用户节点（org/tree 接口用户和部门混在一起）
            const { deptChildren, userChildren } = splitChildren(n.children)
            // 同时检查独立的 users 字段（兼容不同接口版本）
            const allUsers = [...userChildren, ...(n.users || [])]
            if (allUsers.length) {
              allUsers.forEach((u) => {
                const uid = u.unionId || u.userKey
                if (uid) {
                  dataMapRef.current.member[uid] = {
                    id: uid, name: u.name, avatar: u.avatar || u.avatarUrl || '',
                    org: fullPath.join(' / '), unionId: u.unionId, userKey: u.userKey,
                  }
                  // 建立反向索引：用户 → 所属部门列表
                  if (!userIdToDeptIds[uid]) userIdToDeptIds[uid] = new Set()
                  userIdToDeptIds[uid].add(id)
                }
              })
            }
            if (deptChildren.length) addAll(deptChildren, fullPath, id)
          })
        }
        addAll(departments)

        // 将 rootUsers 注册到 member dataMap（顶层用户，不属于任何部门）
        if (rootUsers.length) {
          rootUsers.forEach((u) => {
            const uid = u.unionId || u.userKey
            if (uid) {
              dataMapRef.current.member[uid] = {
                id: uid, name: u.name, avatar: u.avatar || u.avatarUrl || '',
                org: tenantName || '', unionId: u.unionId, userKey: u.userKey,
              }
            }
          })
        }

        userDeptIndexRef.current = userIdToDeptIds
        deptParentMapRef.current = childToParent
        setDeptLoaded(true)
        setDeptPath([])
      }
    } catch (e) { console.error('获取组织架构失败:', e) }
    finally { setLoading(false) }
  }, [setTenantName])

  // 弹窗打开时加载数据 + 回填初始选中
  useEffect(() => {
    if (!open) return
    dataMapRef.current = { member: {}, team: {}, department: {} }
    orgTreeRef.current = []
    rootUsersRef.current = []
    deptMapRef.current = {}
    userDeptIndexRef.current = {}
    deptParentMapRef.current = {}
    setDeptLoaded(false)
    setRemoveLoaded(false)

    const initUsers = (initialValue?.selectUserList || [])
    const initOrgs = (initialValue?.selectOrgList || [])
    const initTeams = (initialValue?.selectTeamList || [])

    const memberSet = new Set()
    initUsers.forEach((u) => {
      const id = u.unionId || u.userKey
      if (!id) return
      memberSet.add(id)
      dataMapRef.current.member[id] = {
        id, name: u.name || '', avatar: u.avatar || '',
        org: '', unionId: u.unionId, userKey: u.userKey,
      }
    })
    const deptSet = new Set()
    initOrgs.forEach((d) => {
      const id = d.departmentId || d.openDepartmentId
      if (!id) return
      const deptName = d.name || d.departmentName || ''
      deptSet.add(id)
      dataMapRef.current.department[id] = {
        id, name: deptName, avatar: DEPT_ICON_URL, color: '#7b61ff',
        tagLabel: deptName, departmentId: d.departmentId,
        openDepartmentId: d.openDepartmentId, unionId: d.unionId, userKey: d.userKey,
      }
    })
    const teamSet = new Set()
    initTeams.forEach((t) => {
      const id = t.teamId
      if (!id) return
      teamSet.add(id)
      dataMapRef.current.team[id] = {
        id, name: t.teamName || '', avatar: TEAM_ICON_URL, color: '#1664ff', teamId: t.teamId,
      }
    })
    setCheckedMemberIds(memberSet)
    setCheckedTeamIds(teamSet)
    setCheckedDepartIds(deptSet)

    setSelectTeamAdmin(initialValue?.isSelectedTeamAdmin ?? true)
    setIsSynchronous(!!initialValue?.isSynchronous)
    setIsAllUser(!!initialValue?.isAllUser)
    setIsAllTeam(!!initialValue?.isAllTeam)
    setIsAllDepartment(!!initialValue?.isAllDepartment)

    setSearchKey('')
    setActiveTab('member')
    setDeptPath([])
    getDataAuthRemoveInfoData()
    fetchMembers()
    fetchTeams()
    fetchDepartments()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const getDataAuthRemoveInfoData = async () => {
    try {
      const res = await getDataAuthRemoveInfo({locationType:queryType })
      if(res?.result){
        if(res?.data){
          removeRef.current = res.data
          setRemoveLoaded(true)
        }
      }
    } catch (e) { console.error('获取数据权限移除信息失败:', e) }
  }
  // ===================== 搜索（防抖） =====================
  const searchTimerRef = useRef(null)
  const handleSearchChange = (e) => {
    const val = e.target.value
    setSearchKey(val)
    clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      if (activeTab === 'member') fetchMembers(val)
      else if (activeTab === 'team') fetchTeams(val)
      // department 本地过滤
    }, 400)
  }

  // ===================== 部门下钻导航 =====================

  const currentNode = useMemo(() => {
    if (deptPath.length === 0) return null
    const lastId = deptPath[deptPath.length - 1].id
    return deptMapRef.current[lastId] || null
  }, [deptPath]) // eslint-disable-line react-hooks/exhaustive-deps

  const currentDeptNodes = useMemo(() => {
    if (deptPath.length === 0) return orgTreeRef.current
    // 从混合 children 中过滤出部门子节点
    return splitChildren(currentNode?.children).deptChildren
  }, [deptPath, currentNode, orgTreeRef.current]) // eslint-disable-line react-hooks/exhaustive-deps

  const currentUsers = useMemo(() => {
    // 顶层：返回 rootUsers（不属于任何一级部门的用户）
    if (deptPath.length === 0) return rootUsersRef.current
    // 从混合 children 中提取用户节点 + 兼容独立 users 字段
    const { userChildren } = splitChildren(currentNode?.children)
    return [...userChildren, ...(currentNode?.users || [])]
  }, [deptPath, currentNode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ 修复：部门搜索支持全量递归，可搜索到任意层级的子部门和用户
  const deptItemList = useMemo(() => {
    const keyword = searchKey.trim()

    // 有搜索词时：递归搜索全量部门树，只返回匹配的部门（无展开按钮、不显示下属用户）
    if (keyword) {
      const deptItems = []
      const seen = new Set() // 防止重复添加同一部门

      const searchNodes = (nodes) => {
        if (!Array.isArray(nodes)) return
        nodes.forEach((n) => {
          // 跳过用户节点，只处理部门
          if (isUserNode(n)) return
          const id = n.departmentId || n.openDepartmentId
          const nameMatch = n.name.includes(keyword)
          // 部门名匹配 → 加入部门项，hasChildren=false 禁用展开按钮
          if (nameMatch && !seen.has(id)) {
            seen.add(id)
            const parts = (dataMapRef.current.department[id]?.tagLabel || n.name).split(' / ')
            parts.pop() // 去掉当前部门名，只保留上级路径
            deptItems.push({
              id, name: n.name, avatar: DEPT_ICON_URL,
              itemType: 'department',
              org: parts.join(' / '),
              hasChildren: false, // 搜索模式下不显示展开按钮
            })
          }
          // 始终递归子部门（只传部门节点，跳过用户节点）
          const { deptChildren } = splitChildren(n.children)
          if (deptChildren.length) searchNodes(deptChildren)
        })
      }

      searchNodes(orgTreeRef.current)
      return deptItems // 搜索结果只返回匹配的部门，不展示下属用户
    }

    // 无搜索词：保持原有层级下钻逻辑，只显示当前层级的部门和用户
    const deptItems = currentDeptNodes.map((n) => {
      const id = n.departmentId || n.openDepartmentId
      // 从混合 children 判断是否有部门子节点
      const { deptChildren, userChildren } = splitChildren(n.children)
      // 取完整路径去掉当前部门名，只保留上级路径：租户 > 上级部门
      const parts = (dataMapRef.current.department[id]?.tagLabel || n.name).split(' / ')
      parts.pop()
      return {
        id, name: n.name, avatar: DEPT_ICON_URL,
        itemType: 'department',
        org: parts.join(' / '),
        hasChildren: !!(deptChildren.length || userChildren.length || (n.users?.length || 0)),
      }
    })
    const userItems = currentUsers.map((u) => ({
      id: u.unionId || u.userKey, name: u.name, avatar: u.avatar || u.avatarUrl || '',
      itemType: 'user', hasChildren: false,
    }))
    return [...deptItems, ...userItems]
  }, [currentDeptNodes, currentUsers, searchKey, deptLoaded])

  // ✅ P1优化：部门视觉状态 — 同时追踪勾选的用户和子部门对父部门的影响
  const deptSelectionStatusMap = useMemo(() => {
    const map = {}
    const childToParent = deptParentMapRef.current
    // 辅助函数：从某个部门向上递归标记所有祖先部门
    const markAncestors = (deptId, field) => {
      let cur = childToParent[deptId]
      while (cur) {
        if (!map[cur]) map[cur] = { hasCheckedUser: false, hasCheckedDept: false }
        if (map[cur][field]) break // 已标记过，无需继续向上
        map[cur][field] = true
        cur = childToParent[cur]
      }
    }
    // 1. 被勾选的成员 → 标记所属部门及所有祖先部门
    checkedMemberIds.forEach((uid) => {
      const deptIds = userDeptIndexRef.current[uid]
      if (deptIds) {
        deptIds.forEach((deptId) => {
          if (!map[deptId]) map[deptId] = { hasCheckedUser: false, hasCheckedDept: false }
          map[deptId].hasCheckedUser = true
          markAncestors(deptId, 'hasCheckedUser')
        })
      }
    })
    // 2. 被勾选的部门 → 标记所有祖先部门
    checkedDepartIds.forEach((deptId) => {
      markAncestors(deptId, 'hasCheckedDept')
    })
    return map
  }, [checkedMemberIds, checkedDepartIds, deptLoaded])

  const handleDrillDown = (node) => {
    const id = node.departmentId || node.openDepartmentId
    setDeptPath((prev) => [...prev, { id, name: node.name }])
    setSearchKey('')
  }

  const handleBreadcrumbClick = (index) => {
    if (index < 0) {
      setDeptPath([])
    } else {
      setDeptPath((prev) => prev.slice(0, index + 1))
    }
    setSearchKey('')
  }

  // ===================== 当前 tab 数据 =====================

  const dataList = useMemo(() => {
    if (activeTab === 'member') return memberList
    if (activeTab === 'team') return teamList
    return deptItemList
  }, [activeTab, memberList, teamList, deptItemList])

  // ===================== 选中状态管理 =====================

  const getCheckedSet = useCallback((tab) => {
    switch (tab) {
      case 'member': return checkedMemberIds
      case 'team': return checkedTeamIds
      case 'department': return checkedDepartIds
      default: return new Set()
    }
  }, [checkedMemberIds, checkedTeamIds, checkedDepartIds])

  const setCheckedByTab = useCallback((tab, newSet) => {
    switch (tab) {
      case 'member': setCheckedMemberIds(newSet); break
      case 'team': setCheckedTeamIds(newSet); break
      case 'department': setCheckedDepartIds(newSet); break
      default: break
    }
  }, [])

  const currentChecked = getCheckedSet(activeTab)

  const checkedCountInList = useMemo(() => {
    if (activeTab === 'department') {
      return dataList.filter((item) => {
        if (item.itemType === 'department') {
          const status = deptSelectionStatusMap[item.id]
          return checkedDepartIds.has(item.id) || status?.hasCheckedUser || status?.hasCheckedDept || false
        }
        return checkedMemberIds.has(item.id)
      }).length
    }
    // ✅ P2优化：使用 for 循环计数，比 filter 快
    let count = 0
    for (let i = 0; i < dataList.length; i++) {
      if (currentChecked.has(dataList[i].id)) count++
    }
    return count
  }, [dataList, currentChecked, activeTab, checkedMemberIds, checkedDepartIds, deptSelectionStatusMap])

  const isCheckAll = dataList.length > 0 && checkedCountInList === dataList.length
  const isIndeterminate = checkedCountInList > 0 && checkedCountInList < dataList.length

  const getActiveSet = () => {
    switch (activeTab) {
      case 'team': return checkedTeamIds
      default: return checkedMemberIds
    }
  }
  const setActiveSheet = (newSet) => {
    switch (activeTab) {
      case 'team': setCheckedTeamIds(newSet); break
      default: setCheckedMemberIds(newSet); break
    }
  }

  const handleItemCheck = (id, checked, itemType) => {
    // 取消勾选任何项时，清除对应 tab 的全选标记
    if (!checked) {
      if (activeTab === 'member') setIsAllUser(false)
      else if (activeTab === 'team') setIsAllTeam(false)
      else if (activeTab === 'department') setIsAllDepartment(false)
    }
    if (itemType === 'department') {
      const next = new Set(checkedDepartIds)
      if (checked) next.add(id); else next.delete(id)
      setCheckedDepartIds(next)
    } else {
      const next = new Set(getActiveSet())
      if (checked) next.add(id); else next.delete(id)
      setActiveSheet(next)
    }
  }

  // ✅ P2优化：全选使用批量 Set 操作，减少中间状态更新
  const handleCheckAll = (checked) => {
    // 更新当前 tab 的全选 API 标记
    if (activeTab === 'member') setIsAllUser(checked)
    else if (activeTab === 'team') setIsAllTeam(checked)
    else if (activeTab === 'department') setIsAllDepartment(checked)

    if (activeTab === 'department') {
      const nextMembers = new Set(checkedMemberIds)
      const nextDepts = new Set(checkedDepartIds)
      for (let i = 0; i < dataList.length; i++) {
        const item = dataList[i]
        if (item.itemType === 'department') {
          if (checked) nextDepts.add(item.id); else nextDepts.delete(item.id)
        } else {
          if (checked) nextMembers.add(item.id); else nextMembers.delete(item.id)
        }
      }
      setCheckedDepartIds(nextDepts)
      setCheckedMemberIds(nextMembers)
    } else {
      const next = new Set(getActiveSet())
      for (let i = 0; i < dataList.length; i++) {
        if (checked) next.add(dataList[i].id)
        else next.delete(dataList[i].id)
      }
      setActiveSheet(next)
    }
  }

  // ===================== 右侧已选列表 =====================

  const allSelectedItems = useMemo(() => {
    // ✅ 从 removeRef 获取已移除权限的数据，过滤右侧选中区域
    const removeData = removeRef.current || {}
    const removeUserKeys = new Set((removeData.removeUserKeys || []).map(String))
    const removeTeamIds = new Set((removeData.removeTeamIds || []).map(String))
    const removeDeptIds = new Set(
      (removeData.removeDepartmentIds || []).map(d => String(d.departmentId || d.deptId || ''))
    )

    const members = Array.from(checkedMemberIds).map((id) => ({
      ...(dataMapRef.current.member[id] || {}), type: 'member', tagLabel: '',
    })).filter((m) => {
      if (!m.id) return false
      // 成员的 unionId 或 userKey 存在于 removeUserKeys 中则过滤
      if (removeUserKeys.size > 0) {
        if (removeUserKeys.has(String(m.id)) || removeUserKeys.has(String(m.unionId || '')) || removeUserKeys.has(String(m.userKey || ''))) {
          return false
        }
      }
      return true
    })
    const teams = Array.from(checkedTeamIds).map((id) => ({
      ...(dataMapRef.current.team[id] || {}), type: 'team',
      tagLabel: dataMapRef.current.team[id]?.name || '',
    })).filter((t) => {
      if (!t.id) return false
      // 团队的 teamId 存在于 removeTeamIds 中则过滤
      if (removeTeamIds.size > 0 && removeTeamIds.has(String(t.id))) return false
      return true
    })
    const depts = Array.from(checkedDepartIds).map((id) => ({
      ...(dataMapRef.current.department[id] || {}), type: 'department',
      tagLabel: dataMapRef.current.department[id]?.tagLabel || dataMapRef.current.department[id]?.name || '',
    })).filter((d) => {
      if (!d.id) return false
      // 组织机构的 departmentId 存在于 removeDepartmentIds 中则过滤
      if (removeDeptIds.size > 0 && removeDeptIds.has(String(d.id))) return false
      return true
    })
    return [...members, ...teams, ...depts]
  }, [checkedMemberIds, checkedTeamIds, checkedDepartIds, deptLoaded, removeLoaded])

  // ✅ 使用过滤后的实际显示数量
  const totalSelected = allSelectedItems.length
  const filteredMemberCount = allSelectedItems.filter(i => i.type === 'member').length
  const filteredTeamCount = allSelectedItems.filter(i => i.type === 'team').length
  const filteredDeptCount = allSelectedItems.filter(i => i.type === 'department').length

  const handleRemoveItem = (item) => {
    const next = new Set(getCheckedSet(item.type))
    next.delete(item.id)
    setCheckedByTab(item.type, next)
    // 移除已选项时清除对应 tab 的全选标记
    if (item.type === 'member') setIsAllUser(false)
    else if (item.type === 'team') setIsAllTeam(false)
    else if (item.type === 'department') setIsAllDepartment(false)
  }

  const handleClearAll = () => {
    setCheckedMemberIds(new Set())
    setCheckedTeamIds(new Set())
    setCheckedDepartIds(new Set())
    setIsAllUser(false)
    setIsAllTeam(false)
    setIsAllDepartment(false)
  }

  const handleOk = () => {
    // 应用 removeRef 过滤规则，确保已移除权限的数据不包含在返回结果中
    const removeData = removeRef.current || {}
    const removeUserKeys = new Set((removeData.removeUserKeys || []).map(String))
    const removeTeamIds = new Set((removeData.removeTeamIds || []).map(String))
    const removeDeptIds = new Set(
      (removeData.removeDepartmentIds || []).map(d => String(d.departmentId || d.deptId || ''))
    )

    const selectedMembers = Array.from(checkedMemberIds)
      .map((id) => dataMapRef.current.member[id])
      .filter(Boolean)
      .filter((m) => {
        if (removeUserKeys.size === 0) return true
        return !removeUserKeys.has(String(m.id)) &&
          !removeUserKeys.has(String(m.unionId || '')) &&
          !removeUserKeys.has(String(m.userKey || ''))
      })

    const selectedTeams = Array.from(checkedTeamIds)
      .map((id) => dataMapRef.current.team[id])
      .filter(Boolean)
      .filter((t) => {
        if (removeTeamIds.size === 0) return true
        return !removeTeamIds.has(String(t.id || t.teamId || ''))
      })

    const selectedDepartments = Array.from(checkedDepartIds)
      .map((id) => dataMapRef.current.department[id])
      .filter(Boolean)
      .filter((d) => {
        if (removeDeptIds.size === 0) return true
        return !removeDeptIds.has(String(d.id || d.departmentId || ''))
      })

    onConfirm?.({
      selectedMembers,
      selectedTeams,
      selectedDepartments,
      selectTeamAdmin,
      isSynchronous,
      isAllUser,
      isAllTeam,
      isAllDepartment,
    })
  }

  const handleTabChange = (key) => {
    // 切换 Tab 前先清除可能存在的搜索防抖定时器，避免切换后又触发上一 Tab 的搜索请求
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
      searchTimerRef.current = null
    }
    setActiveTab(key)
    setSearchKey('')
    if (key === 'department') {
      setDeptPath([])
    } else if (key === 'member') {
      fetchMembers('')
    } else if (key === 'team') {
      fetchTeams('')
    }
  }

  // ===================== 虚拟滚动回调（ref 模式保持引用稳定） =====================

  // 始终指向最新的业务函数
  callbacksRef.current = {
    handleItemCheck,
    handleDrillDown: (itemId) => {
      const node = deptMapRef.current[itemId]
      if (node) handleDrillDown(node)
    },
    handleInfoClick: (item) => {
      if (item.itemType === 'department') {
        const status = deptSelectionStatusMap[item.id]
        const isManual = checkedDepartIds.has(item.id)
        // 半选状态（子部门或用户被勾选）→ 点击直接手动选中该部门
        if (!isManual && (status?.hasCheckedUser || status?.hasCheckedDept)) {
          handleItemCheck(item.id, true, item.itemType)
          return
        }
      }
      const isChecked = item.itemType === 'department'
        ? checkedDepartIds.has(item.id)
        : (activeTab === 'team' ? checkedTeamIds : checkedMemberIds).has(item.id)
      handleItemCheck(item.id, !isChecked, item.itemType)
    },
    handleRemoveItem,
  }

  // ✅ 稳定的代理回调，引用不变 → memo 组件不会因回调变化而重渲染
  const stableCheck = useCallback((id, checked, itemType) => {
    callbacksRef.current.handleItemCheck(id, checked, itemType)
  }, [])
  const stableInfoClick = useCallback((item) => {
    callbacksRef.current.handleInfoClick(item)
  }, [])
  const stableExpand = useCallback((itemId) => {
    callbacksRef.current.handleDrillDown(itemId)
  }, [])
  const stableRemove = useCallback((item) => {
    callbacksRef.current.handleRemoveItem(item)
  }, [])

  // ✅ P0优化：左侧虚拟滚动行渲染器
  const leftRowRenderer = useCallback(({ index, key, style }) => {
    const item = dataList[index]
    let isChecked = false
    let isItemIndeterminate = false
    if (activeTab === 'department') {
      if (item.itemType === 'department') {
        const isManual = checkedDepartIds.has(item.id)
        const status = deptSelectionStatusMap[item.id]
        isChecked = isManual
        isItemIndeterminate = !isManual && ((status?.hasCheckedUser || status?.hasCheckedDept) || false)
      } else {
        isChecked = checkedMemberIds.has(item.id)
      }
    } else {
      isChecked = currentChecked.has(item.id)
    }
    const isDeptManualChecked = item.itemType === 'department' && checkedDepartIds.has(item.id)
    return (
      <div key={key} style={style}>
        <LeftRow
          item={item}
          activeTab={activeTab}
          isChecked={isChecked}
          isItemIndeterminate={isItemIndeterminate}
          isDeptManualChecked={isDeptManualChecked}
          onCheck={stableCheck}
          onInfoClick={stableInfoClick}
          onExpand={stableExpand}
        />
      </div>
    )
  }, [dataList, activeTab, checkedDepartIds, checkedMemberIds, currentChecked, deptSelectionStatusMap, stableCheck, stableInfoClick, stableExpand])

  // ✅ P0优化：右侧虚拟滚动行渲染器
  const rightRowRenderer = useCallback(({ index, key, style }) => {
    const item = allSelectedItems[index]
    return (
      <div key={key} style={style}>
        <RightRow item={item} onRemove={stableRemove} />
      </div>
    )
  }, [allSelectedItems, stableRemove])

  // 右侧列表动态行高：部门56px，成员/团队44px
  const getRightRowHeight = useCallback(({ index }) => {
    const item = allSelectedItems[index]
    return item?.type === 'department' ? RIGHT_ROW_HEIGHT_DEPT : RIGHT_ROW_HEIGHT_OTHER
  }, [allSelectedItems])

  // ===================== 渲染 =====================

  return (
    <Modal
      destroyOnHidden
      className="msm-modal"
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          选择成员
          {localStorage.getItem('meegoTeamworkAppMode') === 'space' && (
            <Tooltip
              title={
                <div>
                  <div>管理模式为空间模式，可选范围按用户在各飞书项目空间内的数据权限展示。</div>
                  <div>1. 仅展示用户有权限的空间数据；若用户未加入某个飞书项目空间，即使该空间的插件已配置数据权限，用户也无法查看该空间数据。</div>
                  <div>2. 空间模式下，数据权限按空间分别生效。选中成员后，若用户只拥有该成员在 B 空间的数据权限，则不会展示该成员在 A 空间的数据。</div>
                </div>
              }
            >
              <InfoCircleFilled style={{ color: '#BBBBBB', fontSize: 14, marginLeft: 6, cursor: 'pointer' }} />
            </Tooltip>
          )}
        </span>
      }
      open={open}
      onCancel={onCancel}
      width={780}
      centered
      maskClosable={false}
      footer={
        <div className="msm-footer">
          <div className="msm-footer-left">
            <Checkbox
              checked={isSynchronous}
              onChange={(e) => setIsSynchronous(e.target.checked)}
            >
              设置完成后，将配置同步到【资源管理】、【工时管理】模块
            </Checkbox>
            <Checkbox checked={selectTeamAdmin} onChange={(e) => setSelectTeamAdmin(e.target.checked)}>
              选择团队时，同时选中团队管理员
            </Checkbox>
            <SyncTeamBtn />
          </div>
          <div className="msm-footer-right">
            <Button onClick={onCancel}>取消</Button>
            <Button disabled={!allSelectedItems.length} type="primary" onClick={handleOk}>确定</Button>
          </div>
        </div>
      }
    >
      <div className="msm-body">
        {/* ---- 左侧 ---- */}
        <div className="msm-left">
          <div className="msm-search">
            <Input
              placeholder="请输入关键词"
              prefix={<SearchOutlined style={{ color: '#bbb' }} />}
              value={searchKey}
              onChange={handleSearchChange}
              allowClear
            />
          </div>

          <div className="msm-tabs">
            {TAB_LIST.map((t) => (
              <div key={t.key} className={`msm-tab-item${activeTab === t.key ? ' is-active' : ''}`}
                onClick={() => handleTabChange(t.key)}>
                {t.label}
              </div>
            ))}
          </div>

          {/* 部门面包屑导航 */}
          {activeTab === 'department' && (
            <div className="msm-breadcrumb">
              <span className={`msm-breadcrumb-item${deptPath.length === 0 ? ' is-current' : ''}`}
                onClick={() => handleBreadcrumbClick(-1)}>
                {hasDeptData ? (tenantName || '') : ''}
              </span>
              {deptPath.map((p, i) => (
                <React.Fragment key={p.id}>
                  <RightOutlined className="msm-breadcrumb-sep" />
                  <span className={`msm-breadcrumb-item${i === deptPath.length - 1 ? ' is-current' : ''}`}
                    onClick={() => handleBreadcrumbClick(i)}>{p.name}</span>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* 全选行 */}
          {!loading && dataList.length > 0 && (
            <div className="msm-check-all">
              <Checkbox checked={isCheckAll} indeterminate={isIndeterminate}
                onChange={(e) => handleCheckAll(e.target.checked)}>全选</Checkbox>
              {/* <span className="msm-check-all-count">{checkedCountInList}/{dataList.length}</span> */}
            </div>
          )}

          {/* ✅ P0优化：虚拟滚动列表 — 只渲染可视区域行，万级数据流畅 */}
          <Spin spinning={loading} tip="加载中...">
            <div className="msm-list">
              {!loading && dataList.length > 0 ? (
                <AutoSizer>
                  {({ height, width }) => (
                    <List
                      height={height}
                      width={width}
                      rowCount={dataList.length}
                      rowHeight={LEFT_ROW_HEIGHT}
                      overscanRowCount={10}
                      rowRenderer={leftRowRenderer}
                    />
                  )}
                </AutoSizer>
              ) : !loading ? (
                <div className="msm-empty">
                  <NoDataEmpty />
                </div>
              ) : null}
            </div>
          </Spin>
        </div>

        {/* ---- 右侧 ---- */}
        <div className="msm-right">
          <div className="msm-right-header">
            {totalSelected > 0 && (
              <span className="msm-right-title">
                已选{filteredMemberCount}人，{filteredTeamCount}个团队，{filteredDeptCount}个部门
              </span>
            )}
            {totalSelected > 0 && <span className="msm-right-clear" onClick={handleClearAll}>清空</span>}
          </div>
          {/* ✅ P0优化：右侧已选也使用虚拟滚动 */}
          <div className="msm-right-list">
            {allSelectedItems.length > 0 ? (
              <AutoSizer>
                {({ height, width }) => (
                  <List
                    height={height}
                    width={width}
                    rowCount={allSelectedItems.length}
                    rowHeight={getRightRowHeight}
                    overscanRowCount={10}
                    rowRenderer={rightRowRenderer}
                  />
                )}
              </AutoSizer>
            ) : (
              <div className="msm-empty">
                <NoDataEmpty />
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default MemberSelectModal
