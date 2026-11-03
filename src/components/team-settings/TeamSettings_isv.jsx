import React, { Component } from "react";
import { Button, Avatar, Input, Checkbox, Tooltip, Spin, Empty, Tabs, Breadcrumb } from "antd";
import { debounce } from "../../util/util";
import {
  getreTeam,
  getProjectUserTeamAll,
  searchAuthUser,
  queryTeamUserList,
  getIsvOrgTree
} from "../../api/api";
import { SearchOutlined, CloseOutlined, UserOutlined, TeamOutlined } from "@ant-design/icons";
import "./TeamSettings_isv.css";
import { UserTag } from '../user-tag/UserTag';
import { List, AutoSizer } from 'react-virtualized';
import TEAM_DEFAULT_IMG from "../../assets/team.png";
import DEPT_DEFAULT_IMG from "../../assets/dept.png";
import noDataTable from "../../assets/images/no-data-table.png";
// 团队默认头像常量
const TEAM_DEFAULT_AVATAR = TEAM_DEFAULT_IMG
// 部门默认头像常量
const DEPT_DEFAULT_AVATAR = DEPT_DEFAULT_IMG
// 部门Tab 根节点常量
const DEPT_ROOT_ID = '0';
const DEPT_ROOT_NAME = '';

// ============ API 数据规范化工具（嵌套树 → 扁平缓存） ============
// 将 API 嵌套树节点规范化为内部格式
const normalizeDeptNode = (node, parentPath = '') => {
  const deptId = String(node.departmentId ?? node.deptId ?? '');
  const deptName = node.name || node.deptName || '';
  const currentPath = parentPath ? `${parentPath}/${deptName}` : deptName;
  const children = Array.isArray(node.children) ? node.children : [];
  const users = Array.isArray(node.users) ? node.users : [];
  return {
    deptId,
    deptName,
    parentPath,
    hasChildren: children.length > 0,
    childDepts: children.map(c => normalizeDeptNode(c, currentPath)),
    members: users.map(u => ({
      staffId: u.userKey ||u.openId || u.staffId || '',
      staffName: u.name || u.staffName || '',
      staffAvatarUrl: u.avatar || u.staffAvatarUrl || TEAM_DEFAULT_AVATAR,
      staffUserKey: u.userKey || u.openId || u.staffId || '',
    }))
  };
};

// 递归遍历规范化树，构建 deptChildrenCache（含处理后数据）
const buildCacheFromNormalizedTree = (nodes, cache, processDeptData, processDeptMember) => {
  for (const node of nodes) {
    const parentPath = node.parentPath;
    // 处理后的子部门（用于展示）
    const processedChildDepts = node.childDepts.map(c =>
      processDeptData({
        deptId: c.deptId,
        deptName: c.deptName,
        parentPath: c.parentPath,
        hasChildren: c.hasChildren,
      }, node.deptId)
    );
    // 处理后的成员（用于展示）
    const processedMembers = node.members.map(m =>
      processDeptMember(m, node.deptId, parentPath)
    );
    cache[node.deptId] = {
      childDepts: processedChildDepts,
      members: processedMembers,
      loaded: true,
    };
    if (node.childDepts.length > 0) {
      buildCacheFromNormalizedTree(node.childDepts, cache, processDeptData, processDeptMember);
    }
  }
};

// 从规范化树中提取所有部门（扁平化，用于搜索）
const flattenAllDeptsFromTree = (nodes) => {
  const result = [];
  const walk = (nodeList) => {
    for (const n of nodeList) {
      result.push({ deptId: n.deptId, deptName: n.deptName, parentPath: n.parentPath, hasChildren: n.hasChildren });
      if (n.childDepts.length > 0) walk(n.childDepts);
    }
  };
  walk(nodes);
  return result;
};

// 从规范化树构建全局成员-部门索引
const buildGlobalIndexFromTree = (nodes) => {
  const index = new Map();
  const walk = (nodeList, deptId) => {
    for (const n of nodeList) {
      n.members.forEach(m => {
        const sid = m.staffId;
        if (sid) {
          const deptSet = index.get(sid) || new Set();
          deptSet.add(String(n.deptId));
          index.set(sid, deptSet);
        }
      });
      if (n.childDepts.length > 0) walk(n.childDepts, n.deptId);
    }
  };
  walk(nodes, null);
  return index;
};


class TeamSettings extends Component {
  constructor(props) {
    super(props);
    this.state = {
      // 核心选中数据（唯一数据源）
      tabSelections: {
        '1': { selectedIds: new Set(), selectedUsers: [], checkAll: false, isIndeterminate: false }, // 成员
        '2': { selectedIds: new Set(), selectedUsers: [], checkAll: false, isIndeterminate: false }, // 团队
        '3': {
          selectedIds: new Set(),           // 选中的部门ID集合
          selectedUsers: [],                // 选中的部门对象数组
          selectedMemberIds: new Set(),     // 部门Tab下选中的成员ID集合（跨Tab联动）
          selectedMembers: [],              // 部门Tab下选中的成员对象列表
          expandedDeptIds: new Set(),       // 展开的部门ID集合
          currentDeptId: DEPT_ROOT_ID,      // 当前显示的部门ID（面包屑导航）
          breadcrumbPath: [{ deptId: DEPT_ROOT_ID, deptName: DEPT_ROOT_NAME }],
          checkAll: false,
          isIndeterminate: false
        }
      },
      // UI状态
      activeTabKey: '1',
      searchKey: '',
      isSpinning: true,
      isSearching: false,
      isDisabledTreeData: false,
      // 数据缓存
      fullTreeData: { '1': [], '2': [], '3': [] },
      treeData: [],
      // 部门相关状态
      deptChildrenCache: {},      // { [deptId]: { childDepts:[], members:[], loaded:true } }
      deptSearchResults: [],      // 搜索时使用
      // 业务标识
      isAllUser: false,
      isAllTeam: false,
      isAllDept: false,
      isAllDepartment: false,
      delTeamListId: [],
      allUserList: [],
    };
    // 节点元数据辅助 Map（实例字段，避免 setState 频繁触发渲染）
    this.deptParentMap = new Map();        // deptId → parentDeptId
    this.memberDeptIndex = new Map();      // staffId → Set(deptId)
    this._deptRootName = DEPT_ROOT_NAME;   // 动态根节点名称，API 返回后更新

    this.handleSearchChange = debounce(this.onSearchKeyChange, 800).bind(this);
    this.onCheckAll = this.onCheckAll.bind(this);
    this.onClearAll = this.onClearAll.bind(this);
  }

  componentDidMount() {
    console.log('TeamSettings componentDidMount', this.props.selectedUser);
    const selectedUser = this.props.selectedUser || {};
    const {
      selectedDeparts = [],
      selectedUsers = [],
      selectedDepartIds = [],
      selectedUserIds = [],
      selectedDepts = [],
      selectedDeptIds = [],
      selectedDeptMemberIds = [],
    } = selectedUser;
    // 初始化选中数据
    const tabSelections = {
      '1': {
        selectedIds: new Set(selectedUserIds),
        selectedUsers: selectedUsers,
        checkAll: false,
        isIndeterminate: false
      },
      '2': {
        selectedIds: new Set(selectedDepartIds),
        selectedUsers: selectedDeparts,
        checkAll: false,
        isIndeterminate: false
      },
      '3': {
        selectedIds: new Set(selectedDeptIds),
        selectedUsers: selectedDepts,
        selectedMemberIds: new Set(selectedDeptMemberIds),
        selectedMembers: [],
        expandedDeptIds: new Set(),
        currentDeptId: DEPT_ROOT_ID,
        breadcrumbPath: [{ deptId: DEPT_ROOT_ID, deptName: this._deptRootName }],
        checkAll: false,
        isIndeterminate: false
      }
    };
    console.log('资源管理页面初始化选中数据', tabSelections);
    this.setState({
      isAllUser: this.props.isAllUser || false,
      isAllTeam: this.props.isAllTeam || false,
      isAllDept: this.props.isAllDept || false,
      isAllDepartment: this.props.isAllDepartment || false,
      tabSelections
    });

    this.getreTeam();
  }

  getreTeam = async () => {
    this.fetchInitialData();
    // const res = await getreTeam();
    // if (res?.code == 200) {
    //   this.fetchInitialData();
    // }
  }

  // 标准化 remindUserInfo 数据字段，使其与 processUserData 兼容
  normalizeRemindItem = (item, tabKey) => {
    if (tabKey === '1') {
      // 用户: userKey → staffId, userName → staffName
      return {
        ...item,
        staffId: item.staffId || item.userKey,
        staffUserKey: item.staffUserKey || item.userKey,
        staffName: item.staffName || item.userName,
        staffAvatarUrl: item.staffAvatarUrl || item.avatarUrl || TEAM_DEFAULT_AVATAR,
      };
    }
    if (tabKey === '2') {
      // 团队: teamId → id
      return {
        ...item,
        id: item.id || item.teamId,
        teamName: item.teamName,
      };
    }
    console.log('normalizeRemindItem8888', item);
    return item;
  }

  // 公共数据处理函数（成员/团队）
  processUserData = (item, tabKey) => {
    const isUser = tabKey === '1';
    const staffId = isUser ? item.staffUserKey : item.id;
    const username = isUser ? item.staffName : item.teamName;
    const staffAvatarUrl = isUser
      ? (item.staffAvatarUrl || TEAM_DEFAULT_AVATAR)
      : TEAM_DEFAULT_AVATAR;

    return {
      ...item,
      isUser,
      isLeaf: true,
      staffId,
      username,
      staffAvatarUrl,
      _type: isUser ? 'user' : 'team',
      icon: <Avatar size={20} src={staffAvatarUrl} icon={<UserOutlined />} />
    };
  }

  // 部门数据处理（部门节点）
  processDeptData = (item, parentDeptId) => {
    //console.log('processDeptData8888', item);
    const deptId = String(item.deptId ?? item.id ?? '');
    //console.log('processDeptData8888', item);
    const parentPath = item.parentPath || '';
    if (parentDeptId !== undefined && parentDeptId !== null) {
      this.deptParentMap.set(deptId, String(parentDeptId));
    }
    // 构建完整路径：租户名称/上级部门路径
    const tenantName = this._tenantName || '';
    const fullPath = tenantName && parentPath ? `${tenantName}/${parentPath}` : (tenantName || parentPath);
    return {
      ...item,
      deptId,
      deptName: item.deptName || item.name || '',
      parentPath,
      fullPath,
      hasChildren: !!item.hasChildren,
      _type: 'dept',
      // 用于复用现有 selectedIds/Map 接口
      staffId: deptId,
      username: item.deptName || item.name || ''
    };
  }

  // 部门下成员处理（与成员Tab对齐）
  processDeptMember = (item, parentDeptId, parentPath) => {
    const staffId = item.staffId || item.id;
    const username = item.staffName || item.username || '';
    const staffAvatarUrl = item.staffAvatarUrl || TEAM_DEFAULT_AVATAR;
    if (parentDeptId !== undefined && parentDeptId !== null && staffId) {
      const set = this.memberDeptIndex.get(staffId) || new Set();
      set.add(String(parentDeptId));
      this.memberDeptIndex.set(staffId, set);
    }
    return {
      ...item,
      staffId,
      username,
      staffAvatarUrl,
      parentPath: parentPath || item.parentPath || '',
      isUser: true,
      _type: 'user'
    };
  }

  // 统一状态同步到父组件
  syncStateToParent = (tabSelections, isAllUser, isAllTeam, isAllDept, isAllDepartment) => {
    const cb = this.props.getSelectedUser;
    if (typeof cb !== 'function') return;
    cb({
      allUserList: this.state.allUserList,
      selectedDeparts: tabSelections['2'].selectedUsers,
      selectedUsers: tabSelections['1'].selectedUsers,
      selectedDepartIds: Array.from(tabSelections['2'].selectedIds),
      selectedUserIds: Array.from(tabSelections['1'].selectedIds),
      selectedDepts: tabSelections['3'].selectedUsers,
      selectedDeptIds: Array.from(tabSelections['3'].selectedIds),
      selectedDeptMemberIds: Array.from(tabSelections['3'].selectedMemberIds || new Set()),
      checkedKeys: [],
      isAllUser,
      isAllTeam,
      isAllDepartment,
      isAllDept
    });
  }

  fetchInitialData = async () => {
    try {
      this.setState({ isSpinning: true });

      let selectUserList, selectTeamList, delTeamList, selectDepartmentIds;

      if (this.props.remindUserInfo) {
        // 兼容 RemindUserSettings 数据源
        const info = this.props.remindUserInfo;
        selectUserList = (info.selectUserList || []).map(u => this.normalizeRemindItem(u, '1'));
        selectTeamList = (info.selectTeamVos || info.selectTeamList || []).map(t => this.normalizeRemindItem(t, '2'));
        delTeamList = info.delTeamList || [];
        selectDepartmentIds = Array.isArray(info.selectDepartmentIds)
          ? info.selectDepartmentIds.map(id => id.departmentId).filter(Boolean)
          : [];
      } else {
        const res = await getProjectUserTeamAll(this.props.projectId || 0);
        if (res?.result && res.data) {
          selectUserList = res.data.selectUserList || [];
          selectTeamList = res.data.selectTeamList || [];
          delTeamList = res.data.delTeamList || [];
          selectDepartmentIds = res.data.selectDepartmentIds || [];
          this.setState({ allUserList: res.data.userList || [] });
        } else {
          this.setState({ isSpinning: false });
          return Promise.resolve();
        }
      }

      {
        console.log('selectUserList========', selectUserList);
        console.log('selectTeamList========', selectTeamList);
        console.log('selectDepartmentIds========', selectDepartmentIds);
        let delTeamListId = [];
        const processedTeams = [...selectTeamList];
        if (delTeamList.length > 0) {
          delTeamListId = delTeamList.map(item => item.teamId);
          delTeamList.forEach(item => {
            processedTeams.push({
              id: item.id,
              teamId: item.teamId,
              teamName: item.teamName,
              selectStatus: "1"
            });
          });
        }

        const processedUsers = selectUserList.map(item => this.processUserData(item, '1'));
        const processedSelectTeams = processedTeams.map(item => this.processUserData(item, '2'));

        const selectedUserIds = processedUsers.map(u => u.staffId || u.staffUserKey).filter(Boolean);
        const tab1Selections = {
          selectedIds: new Set(selectedUserIds),
          selectedUsers: processedUsers,
          checkAll: false,
          isIndeterminate: false
        };
        const tab2Selections = {
          selectedIds: new Set(processedSelectTeams.map(t => t.staffId)),
          selectedUsers: processedSelectTeams,
          checkAll: false,
          isIndeterminate: false
        };

        // 初始化部门Tab选中状态
        const tab3Selections = {
          ...this.state.tabSelections['3'],
          selectedIds: new Set(selectDepartmentIds.map(id => String(id))),
          selectedUsers: [],  // 部门对象需要后续加载
          selectedMemberIds: new Set(selectedUserIds),
          selectedMembers: processedUsers,
          checkAll: false,
          isIndeterminate: false
        };

        const tabSelections = {
          ...this.state.tabSelections,
          '1': tab1Selections,
          '2': tab2Selections,
          '3': tab3Selections
        };

        this.setState({
          tabSelections,
          delTeamListId
        }, () => {
          this.syncStateToParent(tabSelections, this.state.isAllUser, this.state.isAllTeam, this.state.isAllDept, this.state.isAllDepartment);
          this.fetchCurrentTabData();
          
          // 如果有选中的部门，立即加载部门树以回显部门数据
          if (selectDepartmentIds.length > 0) {
            this.loadDeptRoot();
          }
        });

        return Promise.resolve();
      }
    } catch (error) {
      console.error('获取初始数据失败:', error);
      this.setState({ isSpinning: false });
      return Promise.reject(error);
    }
  }

  // 加载某Tab当前需要的数据
  fetchCurrentTabData = async () => {
    const { activeTabKey } = this.state;
    if (activeTabKey === '3') {
      return this.loadDeptByCurrent();
    }

    // 兼容 RemindUserSettings 数据源
    if (this.props.remindUserInfo) {
      const info = this.props.remindUserInfo;
      const rawList = activeTabKey === '1'
        ? (Array.isArray(info.allUser) ? info.allUser : [])
        : (Array.isArray(info.allTeamVos) ? info.allTeamVos : (Array.isArray(info.allTeamList) ? info.allTeamList : []));

      const dataList = rawList.map(item => this.normalizeRemindItem(item, activeTabKey));
      const processedData = dataList.map(item => this.processUserData(item, activeTabKey));

      this.setState({
        treeData: processedData,
        fullTreeData: {
          ...this.state.fullTreeData,
          [activeTabKey]: processedData
        },
        isSpinning: false,
        isSearching: false
      }, () => {
        this.updateCheckboxStatus();
      });
      return Promise.resolve();
    }

    try {
      this.setState({ isSpinning: true });
      const res = await getProjectUserTeamAll(this.props.projectId || 0);

      if (res?.result && res.data) {
        const dataList = activeTabKey === '1'
          ? (Array.isArray(res.data.userList) ? res.data.userList : [])
          : (Array.isArray(res.data.teamList) ? res.data.teamList : []);
        if(activeTabKey === '1' && dataList.length > 0){
          dataList.forEach(item => {
            item.oldStaffId = item.staffId || item.staffUserKey;
          });
        }
        const processedData = dataList.map(item => this.processUserData(item, activeTabKey));

        this.setState({
          treeData: processedData,
          fullTreeData: {
            ...this.state.fullTreeData,
            [activeTabKey]: processedData
          },
          isSpinning: false,
          isSearching: false
        }, () => {
          this.updateCheckboxStatus();
        });
        return Promise.resolve();
      } else {
        this.setState({ isSpinning: false });
        return Promise.resolve();
      }
    } catch (error) {
      console.error('获取当前标签页数据失败:', error);
      this.setState({ isSpinning: false });
      return Promise.reject(error);
    }
  }

  // ==================== 部门数据加载 ====================
  loadDeptByCurrent = async () => {
    const { tabSelections } = this.state;
    const currentDeptId = tabSelections['3'].currentDeptId;
    if (currentDeptId === DEPT_ROOT_ID) {
      return this.loadDeptRoot();
    }
    return this.loadDeptChildren(currentDeptId);
  }

  loadDeptRoot = async () => {
    const cache = this.state.deptChildrenCache[DEPT_ROOT_ID];
    if (cache?.loaded) {
      // 缓存命中时仍同步面包屑根节点名称（防止其他操作重置面包屑后名称回退）
      const currentRootName = this.state.tabSelections['3'].breadcrumbPath?.[0]?.deptName;
      if (currentRootName !== this._deptRootName) {
        this.setState(prevState => ({
          tabSelections: {
            ...prevState.tabSelections,
            '3': {
              ...prevState.tabSelections['3'],
              breadcrumbPath: [
                { deptId: DEPT_ROOT_ID, deptName: this._deptRootName },
                ...prevState.tabSelections['3'].breadcrumbPath.slice(1)
              ]
            }
          }
        }), () => this.applyDeptListToTree(DEPT_ROOT_ID));
      } else {
        this.applyDeptListToTree(DEPT_ROOT_ID);
      }
      return;
    }
    try {
      //this.setState({ isSpinning: true });
      const data={
        userKey: sessionStorage.getItem('jwtMeegoTeamworkUserId') || ''
      }
      if(this.props.type === 'all'){
        data.needCheckAuth=true
      }
      const res = await getIsvOrgTree();
      // API 返回 { data: { departments: [...], rootUsers: [...], tenantName: '...' } } 或兼容直接数组格式
      const rawTree = Array.isArray(res?.data?.departments)
        ? res.data.departments
        : (Array.isArray(res?.data) ? res.data : []);
      const rootUsers = Array.isArray(res?.data?.rootUsers) ? res.data.rootUsers : [];
      // 动态获取租户名称作为根节点显示名，回退到默认值
      this._deptRootName = res?.data?.tenantName || DEPT_ROOT_NAME;
      // 保存租户名称，供 processDeptData 构建完整路径
      this._tenantName = res?.data?.tenantName || '';
      // 规范化嵌套树
      console.log('rawTree:', rawTree);
      console.log('rootUsers:', rootUsers);
      const normalizedTree = rawTree.map(n => normalizeDeptNode(n, ''));
      // 规范化 rootUsers（根部门的直属用户）
      const normalizedRootMembers = rootUsers.map(u => ({
        staffId: u.userKey || u.openId || u.staffId || '',
        staffName: u.name || u.staffName || '',
        staffAvatarUrl: u.avatar || u.staffAvatarUrl || TEAM_DEFAULT_AVATAR,
        staffUserKey: u.userKey || u.openId || u.staffId || '',
      }));
      // 一次性构建全量缓存（含处理后数据）
      const newCache = { [DEPT_ROOT_ID]: { childDepts: [], members: [], loaded: true } };
      buildCacheFromNormalizedTree(
        normalizedTree, newCache,
        (item, pid) => this.processDeptData(item, pid),
        (item, pid, pp) => this.processDeptMember(item, pid, pp)
      );
      // 根节点的一级子部门（需经 processDeptData 处理，补齐 _type/staffId/username 等渲染字段）
      const rootChildDepts = normalizedTree.map(n =>
        this.processDeptData({
          deptId: n.deptId,
          deptName: n.deptName,
          parentPath: n.parentPath,
          hasChildren: n.hasChildren,
        })
      );
      // 处理 rootUsers（经 processDeptMember 处理，补齐渲染字段）
      const processedRootMembers = normalizedRootMembers.map(m => 
        this.processDeptMember(m, DEPT_ROOT_ID, '')
      );
      newCache[DEPT_ROOT_ID] = { 
        childDepts: rootChildDepts, 
        members: processedRootMembers, // 根部门的直属用户
        loaded: true 
      };
      // 构建全局成员-部门索引（跨部门选中状态同步）
      this.memberDeptIndex = buildGlobalIndexFromTree(normalizedTree);
      // 扁平化所有部门（用于搜索）
      this._allDeptsFlat = flattenAllDeptsFromTree(normalizedTree);

      // 根据已选中的部门ID，从树中找出对应的部门对象
      const currentSelectedIds = this.state.tabSelections['3']?.selectedIds || new Set();
      const selectedDeptObjects = [];
      if (currentSelectedIds.size > 0 && this._allDeptsFlat) {
        this._allDeptsFlat.forEach(dept => {
          if (currentSelectedIds.has(String(dept.deptId))) {
            // 使用 processDeptData 处理部门对象，补齐渲染所需的字段
            const processedDept = this.processDeptData(dept);
            selectedDeptObjects.push(processedDept);
          }
        });
      }

      this.setState({
        deptChildrenCache: newCache,
        isSpinning: false,
        isSearching: false,
        tabSelections: {
          ...this.state.tabSelections,
          '3': {
            ...this.state.tabSelections['3'],
            breadcrumbPath: [{ deptId: DEPT_ROOT_ID, deptName: this._deptRootName }],
            selectedUsers: selectedDeptObjects  // 填充已选中的部门对象
          }
        }
      }, () => {
        // 只有当前Tab是部门Tab时才更新 treeData
        if (this.state.activeTabKey === '3') {
          this.applyDeptListToTree(DEPT_ROOT_ID);
        }
      });
    } catch (error) {
      console.error('加载部门根节点失败:', error);
      this.setState({ isSpinning: false });
    }
  }

  loadDeptChildren = async (deptId) => {
    const cache = this.state.deptChildrenCache[deptId];
    if (cache?.loaded) {
      this.applyDeptListToTree(deptId);
      return;
    }
    try {
      this.setState({ isSpinning: true });

      // 真实 API 模式：数据已在 loadDeptRoot 一次性加载并处理到缓存
      // 缓存命中已在 loadDeptChildren 开头的 cache?.loaded 检查中处理，
      // 若未命中则说明该部门无子节点，直接设置为空
      const newCache = {
        ...this.state.deptChildrenCache,
        [deptId]: { childDepts: [], members: [], loaded: true }
      };
      this.setState({ deptChildrenCache: newCache, isSpinning: false, isSearching: false }, () => {
        this.applyDeptListToTree(deptId);
      });
    } catch (error) {
      console.error('加载部门子节点失败:', error);
      this.setState({ isSpinning: false });
    }
  }

  // 把缓存里的当前部门 children 拼成一维 treeData（部门在前，成员在后）
  applyDeptListToTree = (deptId) => {
    const cache = this.state.deptChildrenCache[deptId] || { childDepts: [], members: [] };
    const rows = [
      ...cache.childDepts,
      ...cache.members
    ];
    this.setState({
      treeData: rows,
      fullTreeData: {
        ...this.state.fullTreeData,
        '3': rows
      },
      isSearching: false
    }, () => {
      this.updateCheckboxStatus();
    });
  }

  // ==================== 搜索 ====================
  getSearchUserList = async () => {
    const { searchKey, activeTabKey } = this.state;

    if (!searchKey) {
      // 清空搜索 → 还原本Tab列表
      if (activeTabKey === '3') {
        this.applyDeptListToTree(this.state.tabSelections['3'].currentDeptId);
        this.setState({ isSearching: false, isSpinning: false });
      } else {
        this.setState({
          treeData: this.state.fullTreeData[activeTabKey] || [],
          isSpinning: false,
          isSearching: false
        }, () => this.updateCheckboxStatus());
      }
      return;
    }

    this.setState({ isSpinning: true });
    try {
      const projectKey=sessionStorage.getItem('adminCurrentProjectKey') || '';
      const data = { query: searchKey.trim(), projectKey: projectKey };
      if (activeTabKey === '1') {
        const res = await searchAuthUser(data);
        if (res?.result) {
          const processedData = res.data.map(item => this.processUserData(item, '1'));
          this.setState({ treeData: processedData, isSpinning: false, isSearching: true }, () => this.updateCheckboxStatus());
        } else {
          this.setState({ isSpinning: false });
        }
      } else if (activeTabKey === '2') {
        const res = await queryTeamUserList({ key: data.query, projectKey: projectKey });
        if (res?.result) {
          const processedData = res.data.map(item => this.processUserData(item, '2'));
          this.setState({ treeData: processedData, isSpinning: false, isSearching: true }, () => this.updateCheckboxStatus());
        } else {
          this.setState({ isSpinning: false });
        }
      } else if (activeTabKey === '3') {
        const keyword = data.query.toLowerCase();
        const allDepts = this._allDeptsFlat || [];
        const filtered = allDepts.filter(d =>
          d.deptName.toLowerCase().includes(keyword)
        );
        const processedData = filtered.map(d => this.processDeptData(d));
        this.setState({
          treeData: processedData,
          deptSearchResults: processedData,
          isSpinning: false,
          isSearching: true
        }, () => this.updateCheckboxStatus());
      }
    } catch (error) {
      console.error('搜索失败:', error);
      this.setState({ isSpinning: false });
    }
  };

  onSearchKeyChange = () => {
    this.getSearchUserList();
  };

  // ==================== 复选框状态 ====================
  updateCheckboxStatus = () => {
    const { treeData, activeTabKey, tabSelections } = this.state;
    const currentTabSelection = tabSelections[activeTabKey];
    if (!treeData || treeData.length === 0) {
      if (currentTabSelection.checkAll || currentTabSelection.isIndeterminate) {
        // 使用函数式 setState 确保基于最新状态合并，避免闭包捕获旧 selectedMemberIds
        this.setState(prevState => ({
          tabSelections: {
            ...prevState.tabSelections,
            [activeTabKey]: { ...prevState.tabSelections[activeTabKey], checkAll: false, isIndeterminate: false }
          }
        }));
      }
      return;
    }

    let selectedCount = 0;
    const totalItems = treeData.length;

    if (activeTabKey === '3') {
      // 部门Tab：dept 看 selectedIds，user 看 selectedMemberIds
      const deptIds = tabSelections['3'].selectedIds;
      const memIds = tabSelections['3'].selectedMemberIds;
      treeData.forEach(item => {
        if (item._type === 'dept') {
          if (deptIds.has(item.deptId)) selectedCount++;
        } else {
          if (memIds.has(item.staffId)) selectedCount++;
        }
      });
    } else {
      const { selectedIds } = currentTabSelection;
      for (let i = 0; i < treeData.length; i++) {
        if (selectedIds.has(treeData[i].staffId)) selectedCount++;
      }
    }

    const checkAll = selectedCount === totalItems && totalItems > 0;
    const isIndeterminate = selectedCount > 0 && selectedCount < totalItems;

    if (currentTabSelection.checkAll !== checkAll || currentTabSelection.isIndeterminate !== isIndeterminate) {
      // 使用函数式 setState 确保基于最新状态合并，保留 selectedMemberIds 等关键字段
      this.setState(prevState => ({
        tabSelections: {
          ...prevState.tabSelections,
          [activeTabKey]: { ...prevState.tabSelections[activeTabKey], checkAll, isIndeterminate }
        }
      }));
    }
  };

  // 计算单个部门项的复选框状态（半选/全选/未选）
  // 注意：搜索时不使用此方法，直接使用部门自身的选中状态
  computeDeptCheckStatus = (deptId) => {
    const sel = this.state.tabSelections['3'];
    if (sel.selectedIds.has(deptId)) {
      return { checked: true, indeterminate: false };
    }
    // 优先检查已加载的部门缓存
    const cache = this.state.deptChildrenCache[deptId];
    if (cache?.loaded) {
      const anyChildDeptSelected = (cache.childDepts || []).some(d =>
        sel.selectedIds.has(d.deptId) || this.computeDeptCheckStatus(d.deptId).indeterminate
      );
      const anyMemberSelected = (cache.members || []).some(m => sel.selectedMemberIds.has(m.staffId));
      if (anyChildDeptSelected || anyMemberSelected) {
        return { checked: false, indeterminate: true };
      }
      // 缓存已加载但无选中项，直接返回未选
      return { checked: false, indeterminate: false };
    }
    
    // 回退：缓存未加载时，通过运行时 memberDeptIndex 判断
    // 解决跨部门选择时，未展开部门无法反映已选成员状态的问题
    if (sel.selectedMemberIds.size > 0) {
      const anySelectedInDept = Array.from(sel.selectedMemberIds).some(staffId => {
        // 查运行时索引（已加载过的部门）
        const runtimeDepts = this.memberDeptIndex.get(staffId);
        if (runtimeDepts && runtimeDepts.has(String(deptId))) return true;
        return false;
      });
      if (anySelectedInDept) {
        return { checked: false, indeterminate: true };
      }
    }
    return { checked: false, indeterminate: false };
  }

  // 全选父部门时，自动删除右侧已选区域中的子部门
  removeChildDeptsFromSelection = (parentDeptId, deptIds, deptUsers) => {
    const childDeptIds = this.getAllChildDeptIds(parentDeptId);
    
    // 从 deptIds 中移除子部门
    childDeptIds.forEach(childId => {
      if (deptIds.has(childId)) {
        deptIds.delete(childId);
        const idx = deptUsers.findIndex(d => d.deptId === childId);
        if (idx > -1) {
          deptUsers.splice(idx, 1);
        }
      }
    });
  }

  // 获取某个部门的所有子部门ID（递归）
  getAllChildDeptIds = (parentDeptId) => {
    const childIds = new Set();
    const queue = [parentDeptId];
    
    while (queue.length > 0) {
      const currentId = queue.shift();
      const cache = this.state.deptChildrenCache[currentId];
      
      if (cache?.loaded && cache.childDepts) {
        cache.childDepts.forEach(child => {
          childIds.add(child.deptId);
          queue.push(child.deptId); // 递归查找子部门
        });
      }
    }
    
    return childIds;
  }

  // ==================== 单选 ====================
  handleSingleCheck = (item, checked) => {
    const { activeTabKey } = this.state;
    if (activeTabKey === '3') {
      if (item._type === 'dept') {
        this.toggleDept(item, checked);
      } else {
        this.toggleMemberInDeptTab(item, checked);
      }
      return;
    }
    // 成员/团队Tab 原逻辑
    this.handleSingleCheckLegacy(item.staffId, checked);
  };

  handleSingleCheckLegacy = (itemId, checked) => {
    const { activeTabKey, tabSelections, treeData } = this.state;
    const currentTabSelection = { ...tabSelections[activeTabKey] };
    const selectedIds = new Set(currentTabSelection.selectedIds);
    const selectedUsers = [...currentTabSelection.selectedUsers];
    const currentItem = treeData.find(item => item.staffId === itemId);
    if (!currentItem) return;

    if (checked) {
      selectedIds.add(itemId);
      const isExist = selectedUsers.some(u => u.staffId === itemId);
      if (!isExist) selectedUsers.push(currentItem);
    } else {
      selectedIds.delete(itemId);
      const idx = selectedUsers.findIndex(u => u.staffId === itemId);
      if (idx > -1) selectedUsers.splice(idx, 1);
    }
    currentTabSelection.selectedIds = selectedIds;
    currentTabSelection.selectedUsers = selectedUsers;

    let updatedTabSelections = { ...tabSelections, [activeTabKey]: currentTabSelection };

    // tab1（成员）选择需同步到 tab3.selectedMemberIds
    if (activeTabKey === '1') {
      const tab3 = { ...updatedTabSelections['3'] };
      const memIds = new Set(tab3.selectedMemberIds);
      const memList = [...(tab3.selectedMembers || [])];
      if (checked) {
        memIds.add(itemId);
        if (!memList.some(u => u.staffId === itemId)) memList.push(currentItem);
      } else {
        memIds.delete(itemId);
        const i = memList.findIndex(u => u.staffId === itemId);
        if (i > -1) memList.splice(i, 1);
      }
      tab3.selectedMemberIds = memIds;
      tab3.selectedMembers = memList;
      updatedTabSelections = { ...updatedTabSelections, '3': tab3 };
    }

    const isAllUserFlag = activeTabKey === '1' ? false : this.state.isAllUser;
    const isAllTeamFlag = activeTabKey === '2' ? false : this.state.isAllTeam;

    this.setState({
      tabSelections: updatedTabSelections,
      isAllUser: isAllUserFlag,
      isAllTeam: isAllTeamFlag
    }, () => {
      this.updateCheckboxStatus();
      this.syncStateToParent(updatedTabSelections, isAllUserFlag, isAllTeamFlag, this.state.isAllDept);
    });
  };

  // 部门勾选/取消
  toggleDept = (item, checked) => {
    const { tabSelections } = this.state;
    const tab3 = { ...tabSelections['3'] };
    const selectedIds = new Set(tab3.selectedIds);
    const selectedUsers = [...tab3.selectedUsers];

    if (checked) {
      selectedIds.add(item.deptId);
      if (!selectedUsers.some(d => d.deptId === item.deptId)) selectedUsers.push(item);
      
      // 勾选父部门时，自动删除右侧已选区域中的子部门
      this.removeChildDeptsFromSelection(item.deptId, selectedIds, selectedUsers);
    } else {
      selectedIds.delete(item.deptId);
      const idx = selectedUsers.findIndex(d => d.deptId === item.deptId);
      if (idx > -1) selectedUsers.splice(idx, 1);
    }
    tab3.selectedIds = selectedIds;
    tab3.selectedUsers = selectedUsers;

    const updatedTabSelections = { ...tabSelections, '3': tab3 };
    this.setState({
      tabSelections: updatedTabSelections,
      isAllDept: false
    }, () => {
      this.updateCheckboxStatus();
      this.syncStateToParent(updatedTabSelections, this.state.isAllUser, this.state.isAllTeam, false);
    });
  }

  // 部门Tab 内勾选成员（双向同步到 tab1）
  toggleMemberInDeptTab = (item, checked) => {
    const { tabSelections } = this.state;
    const tab1 = { ...tabSelections['1'] };
    const tab3 = { ...tabSelections['3'] };

    const tab1Ids = new Set(tab1.selectedIds);
    const tab1Users = [...tab1.selectedUsers];
    const memIds = new Set(tab3.selectedMemberIds);
    const memList = [...(tab3.selectedMembers || [])];

    console.log('[跨部门同步] 勾选成员:', item.staffName, 'staffId:', item.staffId, 'checked:', checked);
    console.log('[跨部门同步] 勾选前 selectedMemberIds:', Array.from(memIds));

    if (checked) {
      tab1Ids.add(item.staffId);
      if (!tab1Users.some(u => u.staffId === item.staffId)) tab1Users.push(item);
      memIds.add(item.staffId);
      if (!memList.some(u => u.staffId === item.staffId)) memList.push(item);
    } else {
      tab1Ids.delete(item.staffId);
      const i1 = tab1Users.findIndex(u => u.staffId === item.staffId);
      if (i1 > -1) tab1Users.splice(i1, 1);
      memIds.delete(item.staffId);
      const i3 = memList.findIndex(u => u.staffId === item.staffId);
      if (i3 > -1) memList.splice(i3, 1);
    }

    console.log('[跨部门同步] 勾选后 selectedMemberIds:', Array.from(memIds));

    tab1.selectedIds = tab1Ids;
    tab1.selectedUsers = tab1Users;
    tab3.selectedMemberIds = memIds;
    tab3.selectedMembers = memList;

    const updatedTabSelections = { ...tabSelections, '1': tab1, '3': tab3 };
    this.setState({
      tabSelections: updatedTabSelections,
      isAllUser: false
    }, () => {
      console.log('[跨部门同步] setState 完成，成员状态已全局更新');
      this.updateCheckboxStatus();
      this.syncStateToParent(updatedTabSelections, false, this.state.isAllTeam, this.state.isAllDept);
    });
  }

  // ==================== 清空 / 删除 ====================
  onClearSelectedClick = () => {
    const updatedTabSelections = {
      '1': { selectedIds: new Set(), selectedUsers: [], checkAll: false, isIndeterminate: false },
      '2': { selectedIds: new Set(), selectedUsers: [], checkAll: false, isIndeterminate: false },
      '3': {
        selectedIds: new Set(),
        selectedUsers: [],
        selectedMemberIds: new Set(),
        selectedMembers: [],
        expandedDeptIds: new Set(),
        currentDeptId: DEPT_ROOT_ID,
        breadcrumbPath: [{ deptId: DEPT_ROOT_ID, deptName: this._deptRootName || DEPT_ROOT_NAME }],
        checkAll: false,
        isIndeterminate: false
      }
    };

    this.setState({
      tabSelections: updatedTabSelections,
      isDisabledTreeData: false,
      isAllUser: false,
      isAllTeam: false,
      isAllDept: false
    }, () => {
      this.updateCheckboxStatus();
    });

    if (typeof this.props.getSelectedUser === 'function') {
      this.props.getSelectedUser({
        allUserList: this.state.allUserList,
        selectedDeparts: [],
        selectedUsers: [],
        selectedDepartIds: [],
        selectedUserIds: [],
        selectedDepts: [],
        selectedDeptIds: [],
        selectedDeptMemberIds: [],
        checkedKeys: [],
        isAllUser: false,
        isAllTeam: false,
        isAllDept: false
      });
    }
  };

  // 删除已选项（兼容 user/team/dept 三类）
  onDelSelectedClick = (item) => {
    const { tabSelections } = this.state;
    let targetTabKey = '1';
    if (item._type === 'dept' || item.deptId && !item.staffId) {
      targetTabKey = '3';
    } else if (item.teamId) {
      targetTabKey = '2';
    } else {
      targetTabKey = '1';
    }
    const targetTabSelection = { ...tabSelections[targetTabKey] };
    const selectedIds = new Set(targetTabSelection.selectedIds);
    const selectedUsers = [...targetTabSelection.selectedUsers];

    const removeKey = targetTabKey === '3' ? item.deptId : item.staffId;
    selectedIds.delete(removeKey);
    const idx = selectedUsers.findIndex(u => (targetTabKey === '3' ? u.deptId : u.staffId) === removeKey);
    if (idx > -1) selectedUsers.splice(idx, 1);
    targetTabSelection.selectedIds = selectedIds;
    targetTabSelection.selectedUsers = selectedUsers;

    let updatedTabSelections = { ...tabSelections, [targetTabKey]: targetTabSelection };

    // 删除成员时也要从 tab3.selectedMemberIds 移除
    if (targetTabKey === '1') {
      const tab3 = { ...updatedTabSelections['3'] };
      const memIds = new Set(tab3.selectedMemberIds);
      const memList = [...(tab3.selectedMembers || [])];
      if (memIds.has(item.staffId)) {
        memIds.delete(item.staffId);
        const i = memList.findIndex(u => u.staffId === item.staffId);
        if (i > -1) memList.splice(i, 1);
        tab3.selectedMemberIds = memIds;
        tab3.selectedMembers = memList;
        updatedTabSelections = { ...updatedTabSelections, '3': tab3 };
      }
    }

    const isAllUserFlag = targetTabKey === '1' ? false : this.state.isAllUser;
    const isAllTeamFlag = targetTabKey === '2' ? false : this.state.isAllTeam;
    const isAllDeptFlag = targetTabKey === '3' ? false : this.state.isAllDept;

    this.setState({
      tabSelections: updatedTabSelections,
      isAllUser: isAllUserFlag,
      isAllTeam: isAllTeamFlag,
      isAllDept: isAllDeptFlag
    }, () => {
      this.updateCheckboxStatus();
      this.syncStateToParent(updatedTabSelections, isAllUserFlag, isAllTeamFlag, isAllDeptFlag);
    });
  };

  // ==================== 全选 ====================
  onCheckAll = (e) => {
    const { checked } = e.target;
    const { treeData, activeTabKey, tabSelections, searchKey } = this.state;
    if (!treeData || treeData.length === 0) return;

    if (activeTabKey === '3') {
      const tab3 = { ...tabSelections['3'] };
      const tab1 = { ...tabSelections['1'] };
      const deptIds = new Set(tab3.selectedIds);
      const deptUsers = [...tab3.selectedUsers];
      const memIds = new Set(tab3.selectedMemberIds);
      const memList = [...(tab3.selectedMembers || [])];
      const tab1Ids = new Set(tab1.selectedIds);
      const tab1Users = [...tab1.selectedUsers];

      treeData.forEach(item => {
        if (item._type === 'dept') {
          if (checked) {
            deptIds.add(item.deptId);
            if (!deptUsers.some(d => d.deptId === item.deptId)) deptUsers.push(item);
            
            // 全选父部门时，自动删除右侧已选区域中的子部门
            this.removeChildDeptsFromSelection(item.deptId, deptIds, deptUsers);
          } else {
            deptIds.delete(item.deptId);
            const i = deptUsers.findIndex(d => d.deptId === item.deptId);
            if (i > -1) deptUsers.splice(i, 1);
          }
        } else {
          // member
          if (checked) {
            memIds.add(item.staffId);
            if (!memList.some(u => u.staffId === item.staffId)) memList.push(item);
            tab1Ids.add(item.staffId);
            if (!tab1Users.some(u => u.staffId === item.staffId)) tab1Users.push(item);
          } else {
            memIds.delete(item.staffId);
            const im = memList.findIndex(u => u.staffId === item.staffId);
            if (im > -1) memList.splice(im, 1);
            tab1Ids.delete(item.staffId);
            const it = tab1Users.findIndex(u => u.staffId === item.staffId);
            if (it > -1) tab1Users.splice(it, 1);
          }
        }
      });

      tab3.selectedIds = deptIds;
      tab3.selectedUsers = deptUsers;
      tab3.selectedMemberIds = memIds;
      tab3.selectedMembers = memList;
      tab3.checkAll = checked;
      tab3.isIndeterminate = false;
      tab1.selectedIds = tab1Ids;
      tab1.selectedUsers = tab1Users;

      const updatedTabSelections = { ...tabSelections, '1': tab1, '3': tab3 };
      const isAllDeptFlag = !searchKey ? checked : (checked ? this.state.isAllDept : false);
      const isAllDepartmentFlag = !searchKey ? checked : (checked ? this.state.isAllDepartment : false);
      this.setState({
        tabSelections: updatedTabSelections,
        isAllDept: isAllDeptFlag,
        isAllDepartment: isAllDepartmentFlag,
        isAllUser: false
      }, () => {
        this.syncStateToParent(updatedTabSelections, false, this.state.isAllTeam, isAllDeptFlag, isAllDepartmentFlag);
      });
      return;
    }

    // 成员/团队Tab 走原逻辑
    const currentTabSelection = { ...tabSelections[activeTabKey] };
    const currentTabItemIds = treeData.map(item => item.staffId);
    const selectedIds = new Set(currentTabSelection.selectedIds);
    let selectedUsers = [...currentTabSelection.selectedUsers];

    if (checked) {
      currentTabItemIds.forEach(id => selectedIds.add(id));
      treeData.forEach(item => {
        if (!selectedUsers.some(u => u.staffId === item.staffId)) selectedUsers.push(item);
      });
    } else {
      currentTabItemIds.forEach(id => selectedIds.delete(id));
      selectedUsers = selectedUsers.filter(u => !currentTabItemIds.includes(u.staffId));
    }
    currentTabSelection.selectedIds = selectedIds;
    currentTabSelection.selectedUsers = selectedUsers;
    currentTabSelection.checkAll = checked;
    currentTabSelection.isIndeterminate = false;

    let updatedTabSelections = { ...tabSelections, [activeTabKey]: currentTabSelection };

    // tab1 全选/全消时同步 tab3.selectedMemberIds
    if (activeTabKey === '1') {
      const tab3 = { ...updatedTabSelections['3'] };
      const memIds = new Set(tab3.selectedMemberIds);
      const memList = [...(tab3.selectedMembers || [])];
      treeData.forEach(item => {
        if (checked) {
          memIds.add(item.staffId);
          if (!memList.some(u => u.staffId === item.staffId)) memList.push(item);
        } else {
          memIds.delete(item.staffId);
          const idx = memList.findIndex(u => u.staffId === item.staffId);
          if (idx > -1) memList.splice(idx, 1);
        }
      });
      tab3.selectedMemberIds = memIds;
      tab3.selectedMembers = memList;
      updatedTabSelections = { ...updatedTabSelections, '3': tab3 };
    }

    let isAllUserFlag = this.state.isAllUser;
    let isAllTeamFlag = this.state.isAllTeam;
    if (activeTabKey === '1') isAllUserFlag = !searchKey ? checked : (checked ? isAllUserFlag : false);
    if (activeTabKey === '2') isAllTeamFlag = !searchKey ? checked : (checked ? isAllTeamFlag : false);

    this.setState({
      tabSelections: updatedTabSelections,
      isAllUser: isAllUserFlag,
      isAllTeam: isAllTeamFlag
    }, () => {
      this.syncStateToParent(updatedTabSelections, isAllUserFlag, isAllTeamFlag, this.state.isAllDept);
    });
  };

  // ==================== 面包屑 ====================
  onDeptExpand = (item) => {
    const { tabSelections } = this.state;
    const tab3 = { ...tabSelections['3'] };
    if (tab3.selectedIds.has(item.deptId)) return; // 部门已勾选则禁用
    const breadcrumbPath = [...tab3.breadcrumbPath, { deptId: item.deptId, deptName: item.deptName }];
    const expandedDeptIds = new Set(tab3.expandedDeptIds);
    expandedDeptIds.add(item.deptId);
    tab3.breadcrumbPath = breadcrumbPath;
    tab3.expandedDeptIds = expandedDeptIds;
    tab3.currentDeptId = item.deptId;

    this.setState({
      tabSelections: { ...tabSelections, '3': tab3 },
      searchKey: '',
      isSearching: false
    }, () => {
      this.loadDeptChildren(item.deptId);
    });
  }

  onBreadcrumbClick = (idx) => {
    const { tabSelections } = this.state;
    const tab3 = { ...tabSelections['3'] };
    if (idx >= tab3.breadcrumbPath.length - 1) return; // 最后一级不可点击
    const newPath = tab3.breadcrumbPath.slice(0, idx + 1);
    const targetDeptId = newPath[newPath.length - 1].deptId;
    tab3.breadcrumbPath = newPath;
    tab3.currentDeptId = targetDeptId;

    this.setState({
      tabSelections: { ...tabSelections, '3': tab3 },
      searchKey: '',
      isSearching: false
    }, () => {
      if (targetDeptId === DEPT_ROOT_ID) {
        this.loadDeptRoot();
      } else {
        this.loadDeptChildren(targetDeptId);
      }
    });
  }

  // ==================== Tab 切换 ====================
  onChange = (key) => {
    this.setState({
      activeTabKey: key,
      searchKey: '',
      isSearching: false
    }, () => {
      if (key === '3') {
        // 切换到部门Tab时，重置到根部门（初始状态），不保留之前的操作状态
        const { tabSelections } = this.state;
        const newTab3 = {
          ...tabSelections['3'],
          currentDeptId: DEPT_ROOT_ID,
          breadcrumbPath: [{ deptId: DEPT_ROOT_ID, deptName: this._deptRootName }],
          expandedDeptIds: new Set()
        };
        this.setState({
          tabSelections: { ...tabSelections, '3': newTab3 }
        }, () => {
          this.loadDeptRoot();
        });
        return;
      }
      this.setState({ treeData: this.state.fullTreeData[key] || [] }, () => {
        this.updateCheckboxStatus();
      });
      if (!this.state.fullTreeData[key] || this.state.fullTreeData[key].length === 0) {
        this.fetchCurrentTabData()
          .then(() => this.updateCheckboxStatus())
          .catch(error => console.error('切换标签页处理失败:', error));
      }
    });
  };

  onClearAll = () => {
    this.onClearSelectedClick();
  }

  // ==================== 渲染 ====================
  renderRow = ({ index, key, style }) => {
    const { activeTabKey, tabSelections, isDisabledTreeData } = this.state;
    const item = this.state.treeData[index];
    if (!item) return null;
    // 使用staffId作为key的一部分，确保React能正确识别组件
    const uniqueKey = `${item._type}-${item.staffId || item.deptId}-${index}`;

    if (activeTabKey === '3' && item._type === 'dept') {
      // 搜索时只显示匹配部门本身的选中状态，不检查子项
      const status = this.state.isSearching
        ? { checked: tabSelections['3'].selectedIds.has(item.deptId), indeterminate: false }
        : this.computeDeptCheckStatus(item.deptId);
      const expandDisabled = status.checked; // 已勾选则禁用展开
      return (
        <div className="select-item dept-row" key={uniqueKey} style={style}>
          <Checkbox
            value={item.deptId}
            disabled={isDisabledTreeData || item.disabled}
            checked={status.checked}
            indeterminate={status.indeterminate}
            onChange={(e) => this.handleSingleCheck(item, e.target.checked)}
          >
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <Avatar size={26} className="dept-avatar" src={DEPT_DEFAULT_IMG} />
              <span className="dept-meta">
                <Tooltip title={item.deptName}>
                  <span className="dept-name">{item.deptName}</span>
                </Tooltip>
                {item.fullPath ? (
                  <Tooltip title={item.fullPath}>
                    <span className="dept-path">{item.fullPath}</span>
                  </Tooltip>
                ) : null}
              </span>
            </span>
          </Checkbox>
          {/* 搜索时不显示展开按钮；浏览模式下所有部门均可展开查看子部门/成员 */}
          {!this.state.isSearching && (
            <Button
              type="link"
              size="small"
              className="dept-expand-btn"
              disabled={expandDisabled}
              onClick={() => this.onDeptExpand(item)}
            >
              展开
            </Button>
          )}
        </div>
      );
    }

    if (activeTabKey === '3' && item._type === 'user') {
      const isItemChecked = tabSelections['1'].selectedIds.has(item.staffId);
      // 调试日志：验证跨部门状态同步
      // if (item.staffName === '吴权河') {
      //   //console.log('[渲染-吴权河] staffId:', item.staffId, 'isItemChecked:', isItemChecked, 'selectedMemberIds:', Array.from(tabSelections['3'].selectedMemberIds));
      // }
      return (
        <div className="select-item" key={uniqueKey} style={style}>
          <Checkbox
            value={item.staffId}
            disabled={isDisabledTreeData || item.disabled}
            checked={isItemChecked}
            onChange={(e) => this.handleSingleCheck(item, e.target.checked)}
          >
            <UserTag userId={item.staffUserKey} name={item.username} avatar={item.staffAvatarUrl} />
          </Checkbox>
        </div>
      );
    }

    // 成员/团队Tab 原渲染
    const currentTabSelection = tabSelections[activeTabKey];
    const isItemChecked = currentTabSelection.selectedIds.has(item.staffId);
    return (
      <div className="select-item" key={uniqueKey} style={style}>
        <Checkbox
          value={item.staffId}
          disabled={isDisabledTreeData || item.disabled}
          checked={isItemChecked}
          onChange={(e) => this.handleSingleCheck(item, e.target.checked)}
        >
          {activeTabKey === '2' ? (
            <span>
              <Avatar size={20} src={item.staffAvatarUrl} icon={<UserOutlined />} />
              <Tooltip title={item.username}><span className="select-item-txt">{item.username}</span></Tooltip>
            </span>
          ) : (
            <UserTag userId={item.staffUserKey} name={item.username} avatar={item.staffAvatarUrl} />
          )}
        </Checkbox>
      </div>
    );
  }

  // 已选区单项渲染
  renderSelectedRow = (allSelectedUsers) => ({ index, key, style }) => {
    const item = allSelectedUsers[index];
    if (!item) return null;
    const uniqueKey = `${item.staffId || item.id || item.deptId}_${index}`;
    let unavailable = false;
    if (this.props.removeTeamIds && this.props.removeTeamIds.includes(item.staffId)) unavailable = true;
    if (this.state.delTeamListId.includes(item.teamId) && item.teamId) unavailable = true;
    if (this.props.removeUserIds && this.props.removeUserIds.includes(item.staffId) && !item.teamId && item._type !== 'dept') unavailable = true;

    let content;
    if (item._type === 'dept') {
      content = (
        <span className="selected-item-vertical-center">
          <Avatar size={20} className="dept-avatar" src={DEPT_DEFAULT_IMG} />
          <span className="dept-meta-wrap">
            <Tooltip title={item.deptName}><span className="selected-item-name">{item.deptName}</span></Tooltip>
            {item.fullPath ? (
              <Tooltip title={item.fullPath}><span className="dept-meta-path">{item.fullPath}</span></Tooltip>
            ) : null}
          </span>
        </span>
      );
    } else if (item.teamId) {
      content = unavailable ? (
        <span className="selected-item-vertical-center">
          <Avatar size={20} src={item.staffAvatarUrl} icon={<UserOutlined />} />
          <Tooltip title={"无权限查看此团队"}><span className="selected-item-name selected-item-unavailable" title={item.username}>{item.username}</span></Tooltip>
        </span>
      ) : (
        <span className="selected-item-vertical-center">
          <Avatar size={20} src={item.staffAvatarUrl} icon={<UserOutlined />} />
          <Tooltip title={item.username}><span className="selected-item-name">{item.username}</span></Tooltip>
        </span>
      );
    } else {
      content = unavailable ? (
        <div title={"无权限查看此成员"} className="selected-item-unavailable selected-item-vertical-center">
          {item.staffUserKey ? <UserTag userId={item.staffUserKey} name={item.username} avatar={item.staffAvatarUrl} /> : null}
        </div>
      ) : (
        <UserTag userId={item.staffUserKey} name={item.username} avatar={item.staffAvatarUrl} />
      );
    }

    return (
      <div key={uniqueKey} className="selected-item" style={style}>
        <div className="selected-item-left">
          {content}
        </div>
        <Button
          size="small"
          type="text"
          className={unavailable ? "selected-item-unavailable" : ""}
          icon={<CloseOutlined />}
          onClick={() => this.onDelSelectedClick(item)}
        />
      </div>
    );
  }

  buildSelectedTitle = (userCount, teamCount, deptCount) => {
    const parts = [];
    if (userCount) parts.push(`${userCount}人`);
    if (teamCount) parts.push(`${teamCount}个团队`);
    if (deptCount) parts.push(`${deptCount}个部门`);
    if (parts.length === 0) return '';
    return `已选${parts.join('，')}`;
  }

  render() {
    const { activeTabKey, tabSelections } = this.state;
    const currentTabSelection = tabSelections[activeTabKey];

    const tab1 = tabSelections['1'];
    const tab2 = tabSelections['2'];
    const tab3 = tabSelections['3'];

    const selectedUsers = tab1.selectedUsers;
    const selectedDeparts = tab2.selectedUsers;
    const selectedDepts = tab3.selectedUsers;
    const allSelectedUsers = [...selectedUsers, ...selectedDeparts, ...selectedDepts];

    // 根据 tenantModeInfo.install 字段动态控制部门Tab显示
    const tenantModeInfo = JSON.parse(sessionStorage.getItem('tenantModeInfo') || '{}');
    const showDeptTab = tenantModeInfo.install === true;

    const tabItems = [
      { key: '1', label: '成员' },
      { key: '2', label: '团队' },
      { key: '3', label: '组织架构' }
    ];

    const showBreadcrumb = activeTabKey === '3' && !this.state.isSearching;
    const breadcrumbPath = tab3.breadcrumbPath || [];

    return (
      <div className="selected-user-warp-new">
        <div className="selected-user-left">
          <div className="select-input">
            <Input
              placeholder="请输入关键词"
              value={this.state.searchKey}
              suffix={<SearchOutlined style={{ color: "#BBBBBB" }} />}
              onChange={(e) => {
                this.setState({ searchKey: e.target.value });
                this.handleSearchChange(e);
              }}
            />
          </div>
          <div className="select-tabs">
            <Tabs
              activeKey={activeTabKey}
              items={tabItems}
              onChange={this.onChange}
              inkBarStyle={{ backgroundColor: '#1890ff', height: 3, borderRadius: 2, marginBottom: 6 }}
            />
          </div>

          <Spin spinning={this.state.isSpinning} tip="数据加载中...">
            <div className="select-content" style={{ height: showBreadcrumb ? '316px' : '316px', overflowY: 'hidden' }}>
              {showBreadcrumb && (
                <Breadcrumb separator=">">
                  {breadcrumbPath.map((node, idx) => {
                    const isLast = idx === breadcrumbPath.length - 1;
                    return (
                      <Breadcrumb.Item key={`${node.deptId}_${idx}`}>
                        {isLast
                          ? <span>{node.deptName}</span>
                          : <a onClick={() => this.onBreadcrumbClick(idx)}>{node.deptName}</a>}
                      </Breadcrumb.Item>
                    );
                  })}
                </Breadcrumb>
              )}

              {this.state.treeData?.length > 0 && !this.state.isDisabledTreeData && (
                <div className="select-item select-all-item">
                  <Checkbox
                    className="select-all-checkbox"
                    indeterminate={currentTabSelection.isIndeterminate}
                    checked={currentTabSelection.checkAll}
                    onChange={this.onCheckAll}
                  >
                    全选
                  </Checkbox>
                </div>
              )}

              {this.state.treeData && this.state.treeData.length > 0 && (
                <div style={{ height: showBreadcrumb ? 232 : 270 }}>
                  <AutoSizer>
                    {({ height, width }) => {
                      // 简化key策略：只在切换Tab或切换部门时重建List
                      // 避免在选择/删除/搜索时因key变化导致滚动位置丢失
                      const listKey = `left-list-${activeTabKey}-${tab3.currentDeptId || 'root'}`;
                      return (
                        <List
                          key={listKey}
                          height={height}
                          width={width}
                          rowCount={this.state.treeData.length}
                          rowHeight={({ index }) => {
                            const it = this.state.treeData[index];
                            if (activeTabKey === '3' && it && it._type === 'dept') return 56;
                            return 40;
                          }}
                          overscanRowCount={5}
                          estimatedRowSize={40}
                          rowRenderer={this.renderRow}
                        />
                      );
                    }}
                  </AutoSizer>
                </div>
              )}
              {!this.state.treeData?.length && !this.state.isSpinning ? (
                <div className="empty-data">
                  <Empty
                    image={noDataTable}
                    styles={{ image: { height: 90, width: 90, margin: "auto", marginBottom: 10 } }}
                    description={<span style={{ color: "#727272", fontSize: "12px" }}>暂无数据</span>}
                  />
                </div>
              ) : null}
            </div>
          </Spin>
        </div>
        <div className="selected-user-right">
          <div className="selected-title" style={{ display: 'flex', justifyContent: 'space-between',fontWeight: 400,fontSize: 14,color: '#646A73' }}>
            {allSelectedUsers?.length ? (
              <>
                <p>{this.buildSelectedTitle(tab1.selectedIds.size, tab2.selectedIds.size, tab3.selectedIds.size)}</p>
                <p onClick={this.onClearAll} style={{ cursor: 'pointer', color: '#4147F5FF' }}>清空</p>
              </>
            ) : null}
          </div>
          <div className="selected-content" style={{ height: '350px', overflowY: 'hidden', overflowX: 'hidden' }}>
            {allSelectedUsers && allSelectedUsers.length > 0 ? (
              <AutoSizer>
                {({ height, width }) => (
                  <List
                    height={height}
                    width={width}
                    rowCount={allSelectedUsers.length}
                    rowHeight={({ index }) => {
                      const it = allSelectedUsers[index];
                      if (it && it._type === 'dept' && it.parentPath) return 48;
                      return 40;
                    }}
                    overscanRowCount={5}
                    estimatedRowSize={40}
                    rowRenderer={this.renderSelectedRow(allSelectedUsers)}
                  />
                )}
              </AutoSizer>
            ) : (
              <div className="empty-data">
                <Empty
                  image={noDataTable}
                  styles={{ image: { height: 90, width: 90, margin: "auto", marginBottom: 10 } }}
                  description={<span style={{ color: "#727272", fontSize: "12px" }}>暂无数据</span>}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default TeamSettings;
