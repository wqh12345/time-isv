import React, { Component } from "react";
import { Button, Avatar, Input, Checkbox, Tooltip, Spin, Empty, Tabs, Breadcrumb, Alert } from "antd";
import { List, AutoSizer, CellMeasurer, CellMeasurerCache } from 'react-virtualized';
import 'react-virtualized/styles.css';
import { filterDuplicates, debounce } from '../../../util/util';
import {
  getProjectMemberList,
  getProjectAllStaff,
  postSearchMember,
  getProjectUserTeamAll,
  getreTeam,
  queryTeamUserList,
  querySeatAllUser,
  queryAuthAllUser,
  queryAuthTeamList
} from '../../../api/api';
import { SearchOutlined, CloseOutlined, UserOutlined, CaretRightOutlined, CaretDownOutlined, InfoCircleFilled } from "@ant-design/icons";
import noDataTable from "../../../assets/images/no-data-table.png";
import "./user.css";
// function repeatArrayEfficient(arr, times) {
//     // 创建长度为times的数组，填充原始数组后扁平化
//     return Array(times).fill(arr).flatMap(item => item.map(obj => ({ ...obj })));
// }
class TeamSettings extends Component {
  constructor(props) {
    super(props);
    
    this.cache = new CellMeasurerCache({
      defaultHeight: 40,
      fixedWidth: true,
      minHeight: 40,
      maxHeight: 40,
    });
    
    this.selectedUserCache = new CellMeasurerCache({
      defaultHeight: 50,
      fixedWidth: true,
      minHeight: 50,
      maxHeight: 50,
    });
    
    this.state = {
      type: "",
      searchKey: "",
      deptId: "0",
      isSpinning: true,
      allTree: [
        {
          name: "全部员工",
          id: "0",
          isLeaf: true,
          parentId: "0",
        },
      ],
      checkboxOptions: {
        label: "name",
        value: "id",
        disabled: "disabled",
      },
      projectMemberList: [],
      treeData: [],
      initTreeData: [],
      
      // 选择状态 - 使用更高效的数据结构
      selectedUsersMap: new Map(), // userId -> user
      selectedTeamsSet: new Set(), // 选中的团队ID
      
      // 为了兼容性保留的数组格式
      selectedUsers: [],
      selectedUserIds: [],
      selectedDeparts: [],
      selectedDepartIds: [],
      checkedKeys: [],
      defaultSelectedKeys: [],
      
      // 其他状态
      departNum: 0,
      userList: [],
      teamList: [],
      isDisabledTreeData: false,
      activeTabKey: '1',
      items: [
        {
          key: '1',
          label: '成员',
        },
        {
          key: '2',
          label: '团队',
        },
      ],
      
      // 标签页选择状态
      tabSelections: {
        '1': {
          selectedUserIds: [],
          selectedUsers: [],
          checkAll: false,
          isIndeterminate: false
        },
        '2': {
          selectedUserIds: [],
          selectedUsers: [],
          checkAll: false,
          isIndeterminate: false
        }
      },
      
      // 数据缓存
      fullTreeData: {
        '1': [],
        '2': []
      },
      seatCount: {
        "used": null,
        "residue": null,
        "total": null
      },
      hasInitializedSelection: false,
      isSearching: false,
      currentLevel: 1,
      currentTeamId: null,
      teamMemberData: {},
      teamMembers: [],
      teamName: "",
      
      // 团队选择状态
      teamSelectedUserIdsMap: new Map(), // teamId -> Set(userIds)
      teamSelectedUsersMap: new Map(), // teamId -> Map(userId -> user)
      
      breadcrumbItems: [
        { title: '所有团队', id: null }
      ],
      expandedTeams: {},
      showAlert: false,
      
      // 虚拟滚动相关
      leftListKey: 0,
      rightListKey: 0,
      
      // 计算缓存
      computedCache: {
        teamCheckboxCache: new Map(),
        teamDisplayCountCache: new Map(),
        selectedUsersCache: null,
      }
    };
    
    this.handleSearchChange = debounce(this.onSearchKeyChange, 300).bind(this);
    this.onCheckAll = this.onCheckAll.bind(this);
    this.onClearAll = this.onClearAll.bind(this);
    
    this.listRef = React.createRef();
    this.selectedListRef = React.createRef();
    
    this.getTeamCheckboxState = this.getTeamCheckboxState.bind(this);
    this.getTeamMemberDisplayCount = this.getTeamMemberDisplayCount.bind(this);
    this.refreshTeamCheckboxCache = this.refreshTeamCheckboxCache.bind(this);
  }

  // ==================== 生命周期方法 ====================
  
  componentDidMount() {
    const selectedUser = this.props.selectedUser || {};
    const {
      selectedDeparts = [],
      selectedUsers = [],
      selectedDepartIds = [],
      selectedUserIds = [],
    } = selectedUser;

    const selectedUsersMap = new Map();
    const selectedTeamsSet = new Set(selectedDepartIds);
    
    selectedUsers.forEach(user => {
      const userId = user.userKey || user.staffId || user.id;
      user.avatarUrl = user.avatarUrl || user.staffAvatarUrl;
      user.username = user.userName || user.username || user.nameCn || '';
      if (userId) {
        selectedUsersMap.set(userId, user);
      }
    });

    const tabSelections = {
      '1': {
        selectedUserIds: selectedUserIds,
        selectedUsers: selectedUsers,
        checkAll: false,
        isIndeterminate: false
      },
      '2': {
        selectedUserIds: selectedDepartIds,
        selectedUsers: selectedDeparts,
        checkAll: false,
        isIndeterminate: false
      }
    };
    
    this.setState({
      selectedDeparts,
      selectedUsers,
      selectedDepartIds,
      selectedUserIds,
      defaultSelectedKeys: selectedDepartIds.concat(selectedUserIds),
      selectedUsersMap,
      selectedTeamsSet,
      tabSelections
    }, () => {
      this.querySeatAllUserData().then(() => {
        this.updateCheckboxStatus();
      });
    });
  }

  componentDidUpdate(prevProps, prevState) {
    // 清理缓存
    if (
      prevState.treeData !== this.state.treeData ||
      prevState.isSearching !== this.state.isSearching ||
      prevState.searchKey !== this.state.searchKey
    ) {
      this.cache.clearAll();
      this.state.computedCache.teamCheckboxCache.clear();
      this.state.computedCache.teamDisplayCountCache.clear();
      this.state.computedCache.selectedUsersCache = null;
    }
    
    if (
      prevState.selectedUsersMap !== this.state.selectedUsersMap ||
      prevState.selectedTeamsSet !== this.state.selectedTeamsSet
    ) {
      this.selectedUserCache.clearAll();
      this.state.computedCache.selectedUsersCache = null;
    }
  }

  componentWillReceiveProps(nextProps) {
    const { treeData, activeTabKey } = this.state;
    const nextSelectedUser = nextProps.selectedUser || {};
    let {
      selectedDeparts = [],
      selectedUsers = [],
      selectedDepartIds = [],
      selectedUserIds = []
    } = nextSelectedUser;

    if (!selectedDepartIds.length) {
      this.setState({ isDisabledTreeData: false, departNum: 0 });
    }

    const selectedUsersMap = new Map();
    const selectedTeamsSet = new Set(selectedDepartIds);
    
    selectedUsers.forEach(user => {
      const userId = user.userKey || user.staffId || user.id;
      if (userId) {
        selectedUsersMap.set(userId, user);
      }
    });

    if (treeData.length) {
      treeData.forEach((item) => {
        const staffId = activeTabKey === "1" ? item.staffId : item.teamId;
        if (selectedUserIds.includes(staffId) && !selectedUsersMap.has(staffId)) {
          selectedUsersMap.set(staffId, {
            ...item,
            staffId,
            username: activeTabKey === "1" ? item.staffName : item.teamName,
          });
        }
      });
    }

    const updatedTabSelections = {
      ...this.state.tabSelections,
      '1': {
        ...this.state.tabSelections['1'],
        selectedUserIds: selectedUserIds,
        selectedUsers: Array.from(selectedUsersMap.values()).filter(user => user.isUser)
      },
      '2': {
        ...this.state.tabSelections['2'],
        selectedUserIds: selectedDepartIds,
        selectedUsers: selectedDeparts
      }
    };

    this.setState({
      selectedDepartIds,
      selectedUserIds,
      defaultSelectedKeys: selectedDepartIds.concat(selectedUserIds),
      selectedUsersMap,
      selectedTeamsSet,
      tabSelections: updatedTabSelections
    }, () => {
      this.updateCheckboxStatus();
      this.selectedUserCache.clearAll();
    });
  }

  componentWillUnmount() {
    this.cache.clearAll();
    this.selectedUserCache.clearAll();
  }

  // ==================== 数据获取和处理方法 ====================

  getTenantSeatCountData = async () => {
    try {
      const res = await getTenantSeatCount();
      const seatCountNew = {
        "used": 12,
        "residue": 12,
        "total": 1
      }
      this.setState({ seatCount: { ...seatCountNew } })
    } catch (error) {
      console.error('获取席位数据失败:', error);
    }
  }

  processedUserData = () => {
    const { activeTabKey, userList, teamList, selectedUsersMap, selectedTeamsSet } = this.state;
    const dataList = activeTabKey === '1' ? userList || [] : teamList || [];

    const processedData = dataList.map((item, idx) => {
      const isUser = activeTabKey === '1';
      const staffId = isUser ? item.userKey : item.teamId;
      const username = isUser ? item.userName : item.teamName;
      const staffAvatarUrl = !isUser 
        ? 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png'
        : (item.avatarUrl || 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png');

      // 如果是团队，检查是否需要设置isAll标志
      const isAll = !isUser && selectedTeamsSet.has(staffId) ? 1 : 0;

      return {
        ...item,
        isUser,
        isLeaf: true,
        staffId,
        username,
        staffAvatarUrl,
        isAll,
        __unique_key__: `${staffId}_${Date.now()}_${idx}`,
        icon: (
          <Avatar
            size={20}
            src={staffAvatarUrl}
            icon={<UserOutlined />}
          />
        )
      };
    });

    const updatedFullTreeData = {
      ...this.state.fullTreeData,
      [activeTabKey]: processedData
    };
    // const newStaffDataEfficient = repeatArrayEfficient(processedData, 30);
    //     console.log(`重复30次后数据长度: ${newStaffDataEfficient.length}`);
    //     newStaffDataEfficient.forEach((item, index) => {
    //       item.unikey=index
    // })
    this.setState({
      treeData: processedData,
      fullTreeData: updatedFullTreeData,
      isSpinning: false,
      isSearching: false
    }, () => {
      this.updateCheckboxStatus();
      this.cache.clearAll();
      setTimeout(() => {
        this.updateListKeys();
      }, 0);
    });
  }

  // 修复：根据已保存的成员数据初始化团队选择状态
  initializeTeamSelectionState = (teamList, selectedUsersMap, selectedTeamsSet) => {
    const teamSelectedUserIdsMap = new Map();
    const teamSelectedUsersMap = new Map();
    
    // 遍历所有团队
    teamList.forEach(team => {
      const teamId = team.teamId;
      const teamMemberSet = new Set();
      const teamUserMap = new Map();
      
      // 检查团队成员是否在已选用户中
      if (team.teamMemberVoList) {
        team.teamMemberVoList.forEach(member => {
          const userId = member.userKey;
          if (selectedUsersMap.has(userId)) {
            teamMemberSet.add(userId);
            teamUserMap.set(userId, {
              ...member,
              userKey: member.userKey,
              username: member.userName,
              isUser: true
            });
          }
        });
        
        // 如果团队有选中的成员，更新团队选择状态
        if (teamMemberSet.size > 0) {
          teamSelectedUserIdsMap.set(teamId, teamMemberSet);
          teamSelectedUsersMap.set(teamId, teamUserMap);
          
          // 如果团队所有成员都被选中，则团队本身也应该被选中
          if (teamMemberSet.size === team.teamMemberVoList.length) {
            selectedTeamsSet.add(teamId);
          }
        }
      }
    });
    
    return { teamSelectedUserIdsMap, teamSelectedUsersMap, selectedTeamsSet };
  }

  getSearchUserList = async () => {
    this.setState({ isSpinning: true });
    const { searchKey, activeTabKey, currentLevel, fullTreeData, teamMembers } = this.state;
    
    if (!searchKey) {
      const treeData = currentLevel === 1 
        ? fullTreeData[activeTabKey] || []
        : teamMembers;
      
      this.setState({
        treeData,
        isSpinning: false,
        isSearching: false
      }, () => {
        this.updateCheckboxStatus();
        this.cache.clearAll();
        setTimeout(() => {
          this.updateListKeys();
        }, 0);
      });
      return;
    }

    try {
      let res;
      const data = { query: searchKey.trim() };

      if (activeTabKey === '1' || (activeTabKey === '2' && currentLevel === 2)) {
        res = await postSearchMember(data);
      } else if (activeTabKey === '2' && currentLevel === 1) {
        const projectKey = this.props.projectKey || sessionStorage.getItem('adminCurrentProjectKey') || sessionStorage.getItem('jwtMeegoTeamworkProjectKey') || ''
        res = await queryAuthTeamList({ teamName: data.query, projectKey });
      }

      if (res?.result) {
        let searchList = activeTabKey === '2' && currentLevel === 1 ? res?.data || [] : res.data;
        
        const processedData = searchList.map((item, idx) => {
          const isUser = activeTabKey === '1' || (activeTabKey === '2' && currentLevel === 2);
          const staffId = isUser ? item.staffUserKey : item.teamId;
          const username = isUser ? item.staffName : item.teamName;
          const staffAvatarUrl = !isUser && currentLevel === 1
            ? 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png'
            : (item.staffAvatarUrl || 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png');

          const isTeamInSelected = !isUser && this.state.selectedTeamsSet.has(staffId);

          return {
            ...item,
            isUser,
            isLeaf: true,
            staffId,
            userName: username,
            username,
            userKey: item.staffUserKey,
            staffAvatarUrl,
            __unique_key__: `${staffId}_${this.state.searchKey}_${idx}`,
            ...(isTeamInSelected && { isAll: 1 }),
            icon: (
              <Avatar
                size={20}
                src={staffAvatarUrl}
                icon={<UserOutlined />}
              />
            )
          };
        });
        
        this.setState({
          treeData: processedData,
          isSpinning: false,
          isSearching: true
        }, () => {
          this.updateCheckboxStatus();
          this.cache.clearAll();
          setTimeout(() => {
            this.updateListKeys();
          }, 0);
        });
      } else {
        this.setState({ isSpinning: false });
      }
    } catch (error) {
      console.error('搜索失败:', error);
      this.setState({ isSpinning: false });
    }
  };

  onSearchKeyChange = (e) => {
    this.getSearchUserList();
  };

  // ==================== 选择状态计算方法 ====================

  getTeamCheckboxState = (team) => {
    const teamId = team.staffId || team.teamId;
    const cacheKey = `${teamId}_${this.state.selectedUsersMap.size}_${this.state.selectedTeamsSet.has(teamId)}`;
    
    if (this.state.computedCache.teamCheckboxCache.has(cacheKey)) {
      return this.state.computedCache.teamCheckboxCache.get(cacheKey);
    }

    const teamMembers = team.teamMemberVoList || [];
    const totalMembers = teamMembers.length;
    //console.log('totalMembers8888', totalMembers);
    if (totalMembers === 0) {
      const result = { checked: false, indeterminate: false };
      this.state.computedCache.teamCheckboxCache.set(cacheKey, result);
      return result;
    }

    let selectedMembersCount = 0;
    for (const member of teamMembers) {
      //console.log(member.userKey,this.state.selectedUsersMap);
      if (this.state.selectedUsersMap.has(member.userKey)) {
        selectedMembersCount++;
      }
    }

    let result;
    //console.log(team.teamName,'--------', selectedMembersCount,totalMembers);
    if (selectedMembersCount === totalMembers) {
      result = { checked: true, indeterminate: false };
    } else if (selectedMembersCount > 0 && selectedMembersCount < totalMembers) {
      result = { checked: false, indeterminate: true };
    } else {
      result = { checked: false, indeterminate: false };
    }

    // 如果团队本身被选中，确保复选框状态为选中
    // if (this.state.selectedTeamsSet.has(teamId)) {
    // console.log('this.state.selectedTeamsSet', this.state.selectedTeamsSet);
    //   result = { checked: true, indeterminate: false };
    // }

    this.state.computedCache.teamCheckboxCache.set(cacheKey, result);
    return result;
  };

  getTeamMemberDisplayCount = (team) => {
    const teamId = team.staffId;
    const cacheKey = `${teamId}_${this.state.selectedUsersMap.size}_${this.state.selectedTeamsSet.has(teamId)}`;
    
    if (this.state.computedCache.teamDisplayCountCache.has(cacheKey)) {
      return this.state.computedCache.teamDisplayCountCache.get(cacheKey);
    }
    const teamMembers = team.teamMemberVoList || [];
    const totalMembers = teamMembers.length;
    let selectedMemberCount = 0;
    if (this.state.selectedTeamsSet.has(teamId)) {
      // 如果团队被选中，显示团队所有成员数量
      //const result = `${totalMembers}/${totalMembers}`;
      for (const member of teamMembers) {
        if (this.state.selectedUsersMap.has(member.userKey)) {
          selectedMemberCount++;
        }
      }
      const result = `${selectedMemberCount}/${totalMembers}`;
      this.state.computedCache.teamDisplayCountCache.set(cacheKey, result);
      return result;
    } else {
      // 如果团队未被选中，显示被选中的成员数量
      for (const member of teamMembers) {
        if (this.state.selectedUsersMap.has(member.userKey)) {
          selectedMemberCount++;
        }
      }
      const result = `${selectedMemberCount}/${totalMembers}`;
      this.state.computedCache.teamDisplayCountCache.set(cacheKey, result);
      return result;
    }
  };

  // 刷新团队复选框缓存
  refreshTeamCheckboxCache() {
    this.state.computedCache.teamCheckboxCache.clear();
    this.state.computedCache.teamDisplayCountCache.clear();
  }

  updateCheckboxStatus = () => {
    const { treeData, activeTabKey, tabSelections, currentLevel, currentTeamId } = this.state;
    const currentTabSelection = tabSelections[activeTabKey];
    
    let selectedCountInCurrentTab = 0;
    const totalItems = treeData.length;
    
    if (activeTabKey === '2' && currentLevel === 1) {
      // 团队tab页面
      selectedCountInCurrentTab = treeData.filter(item => 
        this.state.selectedTeamsSet.has(item.staffId)
      ).length;
    } else if (activeTabKey === '2' && currentLevel === 2 && currentTeamId) {
      // 团队下级成员页面
      selectedCountInCurrentTab = treeData.filter(item => 
        this.state.selectedUsersMap.has(item.staffId)
      ).length;
    } else {
      // 成员tab页面
      selectedCountInCurrentTab = treeData.filter(item => 
        this.state.selectedUsersMap.has(item.staffId)
      ).length;
    }

    let checkAll = totalItems > 0 && selectedCountInCurrentTab === totalItems;
    let isIndeterminate = selectedCountInCurrentTab > 0 && selectedCountInCurrentTab < totalItems;
    
    // 如果是团队tab页面，还需要检查所有团队的所有成员是否都被选中
    if(activeTabKey === '2' && currentLevel === 1) {
      const allMembersSelected = treeData.every(team => {
        if (!team.teamMemberVoList) return false;
        return team.teamMemberVoList.every(member => {
          const userId = member.userKey || member.staffId;
          return this.state.selectedUsersMap.has(userId);
        });
      });
      
      if (allMembersSelected) {
        checkAll = true;
        isIndeterminate = false;
      }
    }

    if (currentTabSelection.checkAll !== checkAll || currentTabSelection.isIndeterminate !== isIndeterminate) {
      const updatedTabSelections = {
        ...tabSelections,
        [activeTabKey]: {
          ...currentTabSelection,
          checkAll,
          isIndeterminate
        }
      };
      
      this.setState({
        tabSelections: updatedTabSelections
      });
    }
  };

  // ==================== 选择操作核心方法 ====================

  // 修复：勾选团队时正确处理团队成员
  onTeamCheckboxChange = (team, checked) => {
    const teamId = team.staffId;
    const teamMembers = team.teamMemberVoList || [];
    
    this.setState(prevState => {
      // console.log('prevState.selectedTeamsSet', prevState.selectedTeamsSet);
      // console.log('prevState.newTeamSelectedUserIdsMap', prevState.newTeamSelectedUserIdsMap);
      const newSelectedUsersMap = new Map(prevState.selectedUsersMap);
      const newSelectedTeamsSet = new Set(prevState.selectedTeamsSet);
      const newTeamSelectedUserIdsMap = new Map(prevState.teamSelectedUserIdsMap);
      const newTeamSelectedUsersMap = new Map(prevState.teamSelectedUsersMap);
      
      if (checked) {
        // 选中团队
        newSelectedTeamsSet.add(teamId);
        
        const teamMemberSet = new Set();
        const teamUserMap = new Map();
        
        // 添加团队所有成员到选中状态
        teamMembers.forEach(member => {
          const userId = member.userKey;
          teamMemberSet.add(userId);
          teamUserMap.set(userId, {
            ...member,
            userKey: member.userKey,
            username: member.userName,
            isUser: true
          });
          
          // 只添加当前团队未选中的成员
          if (!newSelectedUsersMap.has(userId)) {
            newSelectedUsersMap.set(userId, {
              ...member,
              userKey: member.userKey,
              username: member.userName,
              isUser: true
            });
          }
        });
        
        newTeamSelectedUserIdsMap.set(teamId, teamMemberSet);
        newTeamSelectedUsersMap.set(teamId, teamUserMap);
      } else {
        // 取消选中团队
        newSelectedTeamsSet.delete(teamId);
        
        // 尝试从现有缓存中获取团队成员的ID集合
        let teamMemberSet = newTeamSelectedUserIdsMap.get(teamId);
        
        if (!teamMemberSet || teamMemberSet.size === 0) {
          // 如果缓存中没有团队成员信息，直接从team对象中获取
          teamMemberSet = new Set();
          teamMembers.forEach(member => {
            const userId = member.userKey;
            teamMemberSet.add(userId);
          });
        }
        // console.log('teamMemberSet8888', teamMemberSet);
        // 从全局选中中移除当前团队的成员
        teamMemberSet.forEach(userId => {
          // 检查该成员是否属于其他被选中的团队
          // let shouldKeepUser = false;
          
          // for (const [otherTeamId, otherMemberSet] of newTeamSelectedUserIdsMap) {
          //   if (otherTeamId !== teamId && otherMemberSet.has(userId)) {
          //     shouldKeepUser = true;
          //     break;
          //   }
          // }
          
          // // 如果用户不属于其他选中团队，则从全局选中中移除
          // if (!shouldKeepUser) {
          //   newSelectedUsersMap.delete(userId);
          // }
          newSelectedUsersMap.delete(userId);
        });
        
        // 移除当前团队的选中状态
        newTeamSelectedUserIdsMap.delete(teamId);
        newTeamSelectedUsersMap.delete(teamId);
      }
      
      // 更新兼容性数组
      const selectedUsers = Array.from(newSelectedUsersMap.values());
      const selectedUserIds = Array.from(newSelectedUsersMap.keys());
      const selectedDeparts = Array.from(newSelectedTeamsSet).map(teamId => 
        prevState.teamList.find(team => team.teamId === teamId) || { staffId: teamId }
      );
      const selectedDepartIds = Array.from(newSelectedTeamsSet);
      
      // 更新团队数据的isAll标志
      const updatedTeamList = prevState.teamList.map(t => 
        t.teamId === teamId ? { ...t, isAll: checked ? 1 : 0 } : t
      );
      const updatedTreeData = prevState.treeData.map(item => 
        item.staffId === teamId ? { ...item, isAll: checked ? 1 : 0 } : item
      );
      
      return {
        selectedUsersMap: newSelectedUsersMap,
        selectedTeamsSet: newSelectedTeamsSet,
        teamSelectedUserIdsMap: newTeamSelectedUserIdsMap,
        teamSelectedUsersMap: newTeamSelectedUsersMap,
        selectedUsers,
        selectedUserIds,
        selectedDeparts,
        selectedDepartIds,
        defaultSelectedKeys: selectedUserIds,
        teamList: updatedTeamList,
        treeData: updatedTreeData
      };
    }, () => {
      this.refreshTeamCheckboxCache();
      this.updateCheckboxStatus();
      this.notifyParentComponent();
      this.updateListKeys();
    });
  };

  onCheck = (checkedValues) => {
    const { treeData, activeTabKey, currentLevel, currentTeamId } = this.state;
    const checkedSet = new Set(checkedValues);
    
    this.setState(prevState => {
      const newSelectedUsersMap = new Map(prevState.selectedUsersMap);
      const newTeamSelectedUserIdsMap = new Map(prevState.teamSelectedUserIdsMap);
      const newTeamSelectedUsersMap = new Map(prevState.teamSelectedUsersMap);
      const newSelectedTeamsSet = new Set(prevState.selectedTeamsSet);
      
      // 处理当前视图中的所有项目
      treeData.forEach(item => {
        const itemId = item.staffId;
        const shouldBeSelected = checkedSet.has(itemId);
        const currentlySelected = newSelectedUsersMap.has(itemId);
        
        if (shouldBeSelected && !currentlySelected) {
          // 选中项目
          newSelectedUsersMap.set(itemId, item);
          
          // 如果是团队下级页面，更新团队选中状态
          if (activeTabKey === '2' && currentLevel === 2 && currentTeamId) {
            const teamMemberSet = newTeamSelectedUserIdsMap.get(currentTeamId) || new Set();
            teamMemberSet.add(itemId);
            newTeamSelectedUserIdsMap.set(currentTeamId, teamMemberSet);
            
            const teamUserMap = newTeamSelectedUsersMap.get(currentTeamId) || new Map();
            teamUserMap.set(itemId, item);
            newTeamSelectedUsersMap.set(currentTeamId, teamUserMap);
            
            // 检查团队是否应该被选中（所有成员都被选中）
            const team = prevState.teamList.find(t => t.teamId === currentTeamId);
            if (team && team.teamMemberVoList) {
              const allMembersSelected = team.teamMemberVoList.every(member => 
                newSelectedUsersMap.has(member.userKey)
              );
              if (allMembersSelected) {
                newSelectedTeamsSet.add(currentTeamId);
              }
            }
          }
          
          // 如果是团队主页面，找到对应的团队
          if (activeTabKey === '2' && currentLevel === 1) {
            const team = prevState.teamList.find(t => 
              t.teamMemberVoList?.some(member => member.userKey === itemId)
            );
            if (team) {
              const teamMemberSet = newTeamSelectedUserIdsMap.get(team.teamId) || new Set();
              teamMemberSet.add(itemId);
              newTeamSelectedUserIdsMap.set(team.teamId, teamMemberSet);
              
              const teamUserMap = newTeamSelectedUsersMap.get(team.teamId) || new Map();
              teamUserMap.set(itemId, item);
              newTeamSelectedUsersMap.set(team.teamId, teamUserMap);
              
              // 检查团队是否应该被选中
              const allMembersSelected = team.teamMemberVoList.every(member => 
                newSelectedUsersMap.has(member.userKey)
              );
              if (allMembersSelected) {
                newSelectedTeamsSet.add(team.teamId);
              }
            }
          }
        } else if (!shouldBeSelected && currentlySelected) {
          // 取消选中项目
          newSelectedUsersMap.delete(itemId);
          
          // 从所有团队的选中成员中移除
          for (const [teamId, memberSet] of newTeamSelectedUserIdsMap) {
            if (memberSet.has(itemId)) {
              memberSet.delete(itemId);
              
              const teamUserMap = newTeamSelectedUsersMap.get(teamId);
              if (teamUserMap) {
                teamUserMap.delete(itemId);
                
                // 如果团队没有选中成员了，清除团队选中状态
                if (teamUserMap.size === 0) {
                  newTeamSelectedUserIdsMap.delete(teamId);
                  newTeamSelectedUsersMap.delete(teamId);
                  newSelectedTeamsSet.delete(teamId);
                } else {
                  // 如果还有成员被选中，确保团队不被标记为全选
                  newSelectedTeamsSet.delete(teamId);
                }
              }
            }
          }
        }
      });
      
      // 更新兼容性数组
      const selectedUsers = Array.from(newSelectedUsersMap.values());
      const selectedUserIds = Array.from(newSelectedUsersMap.keys());
      const selectedDeparts = Array.from(newSelectedTeamsSet).map(teamId => 
        prevState.teamList.find(team => team.teamId === teamId) || { staffId: teamId }
      );
      const selectedDepartIds = Array.from(newSelectedTeamsSet);
      
      // 更新团队数据的isAll标志
      const updatedTeamList = prevState.teamList.map(team => {
        const isAll = newSelectedTeamsSet.has(team.teamId) ? 1 : 0;
        return { ...team, isAll };
      });
      
      const updatedTreeData = treeData.map(item => {
        if (!item.isUser) {
          const isAll = newSelectedTeamsSet.has(item.staffId) ? 1 : 0;
          return { ...item, isAll };
        }
        return item;
      });
      
      return {
        selectedUsersMap: newSelectedUsersMap,
        selectedTeamsSet: newSelectedTeamsSet,
        teamSelectedUserIdsMap: newTeamSelectedUserIdsMap,
        teamSelectedUsersMap: newTeamSelectedUsersMap,
        selectedUsers,
        selectedUserIds,
        selectedDeparts,
        selectedDepartIds,
        defaultSelectedKeys: selectedUserIds,
        teamList: updatedTeamList,
        treeData: updatedTreeData
      };
    }, () => {
      this.refreshTeamCheckboxCache();
      this.updateCheckboxStatus();
      this.notifyParentComponent();
      this.updateListKeys();
    });
  };

  // 修复：团队下级页面取消全选时，移除所有同名成员
  onCheckAll = (e) => {
    const { checked } = e.target;
    const { treeData, activeTabKey, currentLevel, currentTeamId, teamList, searchKey, isSearching,tabSelections,fullTreeData} = this.state;

    this.setState(prevState => {
      let newSelectedUsersMap = new Map(prevState.selectedUsersMap);
      const newSelectedTeamsSet = new Set(prevState.selectedTeamsSet);
      const newTeamSelectedUserIdsMap = new Map(prevState.teamSelectedUserIdsMap);
      const newTeamSelectedUsersMap = new Map(prevState.teamSelectedUsersMap);
      
      let updatedTeamList = teamList;
      let updatedTreeData = treeData;
      
      if (checked) {
        // 全选
        if (activeTabKey === '2' && currentLevel === 2 && currentTeamId) {
          // 全选团队下级成员
          const allMemberIds = treeData.map(member => member.staffId);
          const memberSet = new Set(allMemberIds);
          const userMap = new Map();
          
          treeData.forEach(member => {
            userMap.set(member.staffId, member);
            newSelectedUsersMap.set(member.staffId, member);
          });
          
          newTeamSelectedUserIdsMap.set(currentTeamId, memberSet);
          newTeamSelectedUsersMap.set(currentTeamId, userMap);
          
          // 标记团队为选中状态
          newSelectedTeamsSet.add(currentTeamId);
        } else if (activeTabKey === '2' && currentLevel === 1) {
          // 全选所有团队
          treeData.forEach(team => {
            const teamId = team.staffId;
            newSelectedTeamsSet.add(teamId);
            
            if (team.teamMemberVoList) {
              const memberSet = new Set();
              const userMap = new Map();
              
              team.teamMemberVoList.forEach(member => {
                const userId = member.userKey;
                memberSet.add(userId);
                userMap.set(userId, {
                  ...member,
                  userKey: member.userKey,
                  username: member.userName,
                  isUser: true
                });
                
                if (!newSelectedUsersMap.has(userId)) {
                  newSelectedUsersMap.set(userId, {
                    ...member,
                    userKey: member.userKey,
                    username: member.userName,
                    isUser: true
                  });
                }
              });
              
              newTeamSelectedUserIdsMap.set(teamId, memberSet);
              newTeamSelectedUsersMap.set(teamId, userMap);
            }
          });
          
          updatedTeamList = teamList.map(team => ({ ...team, isAll: 1 }));
          updatedTreeData = treeData.map(item => ({ ...item, isAll: 1 }));
        } else {
          // 全选成员
          if (isSearching) {
            // 搜索状态下，只全选当前搜索结果
            treeData.forEach(item => {
              newSelectedUsersMap.set(item.staffId, item);
            });
          } else {
            // 非搜索状态下，全选所有成员
            treeData.forEach(item => {
              newSelectedUsersMap.set(item.staffId, item);
            });
          }
        }
      } else {
        // 取消全选
        if (activeTabKey === '2' && currentLevel === 2 && currentTeamId) {
          // 取消全选团队下级成员 - 移除所有同名成员
          const memberIds = treeData.map(member => member.staffId);
          
          // 从所有团队的选中成员中移除这些成员
          for (const [teamId, memberSet] of newTeamSelectedUserIdsMap) {
            memberIds.forEach(id => {
              if (memberSet.has(id)) {
                memberSet.delete(id);
              }
            });
            
            // 如果团队没有选中成员了，清除团队选中状态
            if (memberSet.size === 0) {
              newTeamSelectedUserIdsMap.delete(teamId);
              newTeamSelectedUsersMap.delete(teamId);
              
              // 如果团队本身没有被选中，从选中团队中移除
              if (!newSelectedTeamsSet.has(teamId)) {
                newSelectedTeamsSet.delete(teamId);
              }
            }
          }
          
          // 从全局选中中移除这些成员
          memberIds.forEach(id => {
            newSelectedUsersMap.delete(id);
          });
          
          // 移除当前团队的选中状态
          newTeamSelectedUserIdsMap.delete(currentTeamId);
          newTeamSelectedUsersMap.delete(currentTeamId);
          newSelectedTeamsSet.delete(currentTeamId);
        } else if (activeTabKey === '2' && currentLevel === 1) {
          // 取消全选所有团队
          treeData.forEach(team => {
            const teamId = team.staffId;
            newSelectedTeamsSet.delete(teamId);
            const teamMemberSet = newTeamSelectedUserIdsMap.get(teamId);
            if (teamMemberSet) {
              // 从全局选中中移除该团队的所有成员
              teamMemberSet.forEach(userId => {
                newSelectedUsersMap.delete(userId);
              });
            }
            team.teamMemberVoList.forEach(member => {
              const userId = member.userKey;
              newSelectedUsersMap.delete(userId);
            });
            // 移除当前团队的选中状态
            newTeamSelectedUserIdsMap.delete(teamId);
            newTeamSelectedUsersMap.delete(teamId);
          });
          updatedTeamList = teamList.map(team => ({ ...team, isAll: 0 }));
          updatedTreeData = treeData.map(item => ({ ...item, isAll: 0 }));
        } else {
          // 取消全选成员 - 根据搜索状态决定取消范围
          if (isSearching) {
            // 搜索状态下，只取消当前搜索结果中的成员
            const searchResultIds = treeData.map(item => item.staffId);
            
            // 从全局选中中移除搜索结果成员
            searchResultIds.forEach(id => {
              newSelectedUsersMap.delete(id);
            });
            
            // 从所有团队的选中成员中移除这些搜索结果成员
            for (const [teamId, memberSet] of newTeamSelectedUserIdsMap) {
              searchResultIds.forEach(id => {
                if (memberSet.has(id)) {
                  memberSet.delete(id);
                }
              });
              
              // 如果团队没有选中成员了，清除团队选中状态
              if (memberSet.size === 0) {
                newTeamSelectedUserIdsMap.delete(teamId);
                newTeamSelectedUsersMap.delete(teamId);
                
                // 如果团队本身没有被选中，从选中团队中移除
                if (!newSelectedTeamsSet.has(teamId)) {
                  newSelectedTeamsSet.delete(teamId);
                }
              }
            }
          } else {
            // 非搜索状态下，取消所有成员，包括属于已选团队的成员
            const allMemberIds = treeData.map(item => item.staffId);
            
            // 清空所有成员
            for (const id of allMemberIds) {
              newSelectedUsersMap.delete(id);
            }
            
            // 清空团队选中状态
            newTeamSelectedUserIdsMap.clear();
            newTeamSelectedUsersMap.clear();
            
            // 清空团队选中
            newSelectedTeamsSet.clear();
            
            // 更新团队数据的isAll标志
            updatedTeamList = teamList.map(team => ({ ...team, isAll: 0 }));
            updatedTreeData = treeData.map(item => ({ ...item, isAll: 0 }));
          }
        }
      }
      
      const selectedUsers = Array.from(newSelectedUsersMap.values());
      const selectedUserIds = Array.from(newSelectedUsersMap.keys());
      const selectedDeparts = Array.from(newSelectedTeamsSet).map(teamId => 
        teamList.find(team => team.teamId === teamId) || { staffId: teamId }
      );
      const selectedDepartIds = Array.from(newSelectedTeamsSet);
      return {
        teamList: updatedTeamList,
        treeData: updatedTreeData,
        selectedUsersMap: newSelectedUsersMap,
        selectedTeamsSet: newSelectedTeamsSet,
        teamSelectedUserIdsMap: newTeamSelectedUserIdsMap,
        teamSelectedUsersMap: newTeamSelectedUsersMap,
        selectedUsers,
        selectedUserIds,
        selectedDeparts,
        selectedDepartIds,
        defaultSelectedKeys: selectedUserIds
      };
    }, () => {
      this.refreshTeamCheckboxCache();
      this.updateCheckboxStatus();
      this.notifyParentComponent();
      this.updateListKeys();
    });
  };

  // 修复：删除右侧选中成员时，同步更新团队状态
  onDelSelectedClick = (item, index, type) => {
    const itemId = item.userKey || item.id;
    
    this.setState(prevState => {
      const newSelectedUsersMap = new Map(prevState.selectedUsersMap);
      const newSelectedTeamsSet = new Set(prevState.selectedTeamsSet);
      const newTeamSelectedUserIdsMap = new Map(prevState.teamSelectedUserIdsMap);
      const newTeamSelectedUsersMap = new Map(prevState.teamSelectedUsersMap);
      
      if (type === 'user') {
        // 从全局选中中移除用户
        newSelectedUsersMap.delete(itemId);
        
        // 从所有团队的选中成员中移除该用户
        const affectedTeams = [];
        
        for (const [teamId, memberSet] of newTeamSelectedUserIdsMap) {
          if (memberSet.has(itemId)) {
            memberSet.delete(itemId);
            
            const teamUserMap = newTeamSelectedUsersMap.get(teamId);
            if (teamUserMap) {
              teamUserMap.delete(itemId);
            }
            
            // 检查团队是否还应该被选中
            let shouldTeamBeSelected = false;
            if (memberSet.size > 0) {
              shouldTeamBeSelected = true;
            }
            
            // 更新团队的选中状态
            if (!shouldTeamBeSelected) {
              newSelectedTeamsSet.delete(teamId);
              affectedTeams.push(teamId);
            }
          }
        }
        
        // 更新团队列表的isAll标志
        const updatedTeamList = prevState.teamList.map(team => {
          if (affectedTeams.includes(team.teamId)) {
            return { ...team, isAll: 0 };
          }
          return team;
        });
        
        // 更新树数据的isAll标志
        const updatedTreeData = prevState.treeData.map(treeItem => {
          if (affectedTeams.includes(treeItem.staffId)) {
            return { ...treeItem, isAll: 0 };
          }
          return treeItem;
        });
        
        // 更新兼容性数组
        const selectedUsers = Array.from(newSelectedUsersMap.values());
        const selectedUserIds = Array.from(newSelectedUsersMap.keys());
        const selectedDeparts = Array.from(newSelectedTeamsSet).map(teamId => 
          prevState.teamList.find(team => team.teamId === teamId) || { staffId: teamId }
        );
        const selectedDepartIds = Array.from(newSelectedTeamsSet);
        
        return {
          selectedUsersMap: newSelectedUsersMap,
          selectedTeamsSet: newSelectedTeamsSet,
          teamSelectedUserIdsMap: newTeamSelectedUserIdsMap,
          teamSelectedUsersMap: newTeamSelectedUsersMap,
          selectedUsers,
          selectedUserIds,
          selectedDeparts,
          selectedDepartIds,
          defaultSelectedKeys: selectedUserIds,
          teamList: updatedTeamList,
          treeData: updatedTreeData
        };
      } else if (type === 'depart') {
        // 取消选中团队
        newSelectedTeamsSet.delete(itemId);
        const teamMemberSet = newTeamSelectedUserIdsMap.get(itemId);
        
        if (teamMemberSet) {
          // 从全局选中中移除该团队的所有成员
          teamMemberSet.forEach(userId => {
            newSelectedUsersMap.delete(userId);
          });
        }
        
        newTeamSelectedUserIdsMap.delete(itemId);
        newTeamSelectedUsersMap.delete(itemId);
        
        const updatedTeamList = prevState.teamList.map(team => 
          team.teamId === itemId ? { ...team, isAll: 0 } : team
        );
        const updatedTreeData = prevState.treeData.map(treeItem => 
          treeItem.staffId === itemId ? { ...treeItem, isAll: 0 } : treeItem
        );
        
        const selectedUsers = Array.from(newSelectedUsersMap.values());
        const selectedUserIds = Array.from(newSelectedUsersMap.keys());
        const selectedDeparts = Array.from(newSelectedTeamsSet).map(teamId => 
          prevState.teamList.find(team => team.teamId === teamId) || { staffId: teamId }
        );
        const selectedDepartIds = Array.from(newSelectedTeamsSet);
        
        return {
          selectedUsersMap: newSelectedUsersMap,
          selectedTeamsSet: newSelectedTeamsSet,
          teamSelectedUserIdsMap: newTeamSelectedUserIdsMap,
          teamSelectedUsersMap: newTeamSelectedUsersMap,
          selectedUsers,
          selectedUserIds,
          selectedDeparts,
          selectedDepartIds,
          defaultSelectedKeys: selectedUserIds,
          teamList: updatedTeamList,
          treeData: updatedTreeData
        };
      }
      
      // 更新兼容性数组
      const selectedUsers = Array.from(newSelectedUsersMap.values());
      const selectedUserIds = Array.from(newSelectedUsersMap.keys());
      const selectedDeparts = Array.from(newSelectedTeamsSet).map(teamId => 
        prevState.teamList.find(team => team.teamId === teamId) || { staffId: teamId }
      );
      const selectedDepartIds = Array.from(newSelectedTeamsSet);
      
      return {
        selectedUsersMap: newSelectedUsersMap,
        selectedTeamsSet: newSelectedTeamsSet,
        teamSelectedUserIdsMap: newTeamSelectedUserIdsMap,
        teamSelectedUsersMap: newTeamSelectedUsersMap,
        selectedUsers,
        selectedUserIds,
        selectedDeparts,
        selectedDepartIds,
        defaultSelectedKeys: selectedUserIds
      };
    }, () => {
      // 刷新缓存，确保团队复选框状态正确
      this.refreshTeamCheckboxCache();
      this.updateCheckboxStatus();
      this.notifyParentComponent();
      this.updateListKeys();
    });
  };

  // 清空所有选择
  onClearAll = () => {
    this.setState(prevState => {
      const updatedTeamList = prevState.teamList.map(team => ({ ...team, isAll: 0 }));
      const updatedTreeData = prevState.treeData.map(item => ({ ...item, isAll: 0 }));
      
      return {
        selectedUsersMap: new Map(),
        selectedTeamsSet: new Set(),
        teamSelectedUserIdsMap: new Map(),
        teamSelectedUsersMap: new Map(),
        selectedUsers: [],
        selectedUserIds: [],
        selectedDeparts: [],
        selectedDepartIds: [],
        checkedKeys: [],
        defaultSelectedKeys: [],
        isDisabledTreeData: false,
        teamList: updatedTeamList,
        treeData: updatedTreeData
      };
    }, () => {
      this.refreshTeamCheckboxCache();
      this.updateCheckboxStatus();
      this.notifyParentComponent();
      this.updateListKeys();
    });
  };

  // 通知父组件
  notifyParentComponent = () => {
    const { selectedUsers, selectedUserIds, selectedDeparts, selectedDepartIds } = this.state;
    
    this.props.getSelectedUser?.({
      selectedDeparts,
      selectedUsers,
      selectedDepartIds,
      selectedUserIds,
      checkedKeys: []
    });
  };

  // ==================== 团队相关操作 ====================

  getTeamMembers = async (teamId, teamName, teamUserList) => {
    try {
      const processedMembers = teamUserList.map((item, idx) => ({
        ...item,
        isUser: true,
        isLeaf: true,
        staffId: item.userKey,
        username: item.userName || item.nameCn,
        staffAvatarUrl: item.avatarUrl || 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png',
        __unique_key__: `${item.userKey}_${Date.now()}_${idx}`,
        icon: (
          <Avatar
            size={20}
            src={item.avatarUrl || 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png'}
            icon={<UserOutlined />}
          />
        )
      }));

      const newBreadcrumbItems = [
        { title: '所有团队', id: null },
        { title: teamName, id: teamId }
      ];
      
      this.setState({
        treeData: processedMembers,
        teamMembers: processedMembers,
        currentTeamId: teamId,
        currentLevel: 2,
        teamName: teamName,
        breadcrumbItems: newBreadcrumbItems,
        isSpinning: false
      }, () => {
        // 关键：确保团队下级页面的成员复选框状态正确
        this.refreshTeamCheckboxCache();
        this.updateCheckboxStatus();
        this.cache.clearAll();
        setTimeout(() => {
          this.updateListKeys();
        }, 0);
      });
    } catch (error) {
      console.error('获取团队成员失败:', error);
      this.setState({ isSpinning: false });
    }
  };

  backToTeamList = () => {
    this.setState({
      currentLevel: 1,
      currentTeamId: null,
      treeData: this.state.fullTreeData['2'] || [],
      teamName: "",
      breadcrumbItems: [
        { title: '所有团队', id: null }
      ]
    }, () => {
      this.refreshTeamCheckboxCache();
      this.updateCheckboxStatus();
      this.cache.clearAll();
      setTimeout(() => {
        this.updateListKeys();
      }, 0);
    });
  };

  handleBreadcrumbClick = (item) => {
    if (item.id === null) {
      this.backToTeamList();
    }
  };

  // ==================== 标签页切换 ====================

  onChange = (key) => {
    this.setState({
      activeTabKey: key,
      searchKey: '',
      isSearching: false,
      currentLevel: 1,
      currentTeamId: null,
      teamName: "",
      breadcrumbItems: [
        { title: '所有团队', id: null }
      ]
    }, () => {
      const fullTreeData = this.state.fullTreeData[key] || [];
      
      if (key === '2') {
        const updatedTreeData = fullTreeData.map(team => {
          const isTeamSelected = this.state.selectedTeamsSet.has(team.staffId);
          return { ...team, isAll: isTeamSelected ? 1 : 0 };
        });

        const updatedFullTreeData = {
          ...this.state.fullTreeData,
          [key]: updatedTreeData
        };
        
        this.setState({
          fullTreeData: updatedFullTreeData,
          treeData: updatedTreeData
        }, () => {
          this.refreshTeamCheckboxCache();
          this.updateCheckboxStatus();
          this.cache.clearAll();
          setTimeout(() => {
            this.updateListKeys();
          }, 0);
        });
      } else {
        this.setState({
          treeData: fullTreeData
        }, () => {
          this.refreshTeamCheckboxCache();
          this.updateCheckboxStatus();
          this.cache.clearAll();
          setTimeout(() => {
            this.updateListKeys();
          }, 0);
        });
      }

      if (!this.state.fullTreeData[key] || this.state.fullTreeData[key].length === 0) {
        this.processedUserData();
      }
    });
  };

  // ==================== 虚拟滚动相关 ====================

  renderSelectedUserRow = ({ index, key, parent, style }) => {
    // 使用缓存的选择用户列表
    if (!this.state.computedCache.selectedUsersCache) {
      this.state.computedCache.selectedUsersCache = Array.from(this.state.selectedUsersMap.values())
        .filter(user => user.isUser);
    }
    
    const selectedUsers = this.state.computedCache.selectedUsersCache;
    const user = selectedUsers[index];
    
    if (!user) return null;
    
    const userKey = user.__unique_key__ || `${user.staffId || user.userKey || user.id}_${index}`;

    return (
      <CellMeasurer
        key={userKey}
        parent={parent}
        index={index}
        cache={this.selectedUserCache}
      >
        <div
          className="selected-item"
          style={style}
        >
          <div className="selected-item-left">
            <Avatar size={20} src={user.staffAvatarUrl || user.avatarUrl} icon={<UserOutlined />} />
            <span className="selected-item-name">{user.username || user.nameCn || ''}</span>
          </div>
          <Button
            size="small"
            type="text"
            icon={<CloseOutlined />}
            onClick={() => this.onDelSelectedClick(user, index, "user")}
          />
        </div>
      </CellMeasurer>
    );
  };

  // 渲染左侧列表
  renderVirtualRow = ({ index, key, parent, style }) => {
    const { treeData, activeTabKey, currentLevel, currentTeamId } = this.state;
    const item = treeData[index];
    
    if (!item) return null;

    const itemKey = item.unikey || `${item.staffId}_${index}`;
    
    // 渲染团队项目
    if (activeTabKey === '2' && currentLevel === 1) {
      const { checked, indeterminate } = this.getTeamCheckboxState(item);
      return (
        <CellMeasurer
          key={itemKey}
          parent={parent}
          index={index}
          cache={this.cache}
        >
          <div className="select-item" style={style}>
            <Checkbox
              value={item.staffId}
              disabled={this.state.isDisabledTreeData || item.disabled}
              checked={checked}
              indeterminate={indeterminate}
              onChange={(e) => this.onTeamCheckboxChange(item, e.target.checked)}
            >
              <Avatar
                size={20}
                src={item.staffAvatarUrl}
                icon={<UserOutlined />}
              />
              <span className="select-item-txt-2" title={item.username}>
                {item.username}
              </span>
              <span className="team-teamMemberVoList-num">({this.getTeamMemberDisplayCount(item)})</span>
            </Checkbox>
            <Button
              type="text"
              size="small"
              onClick={() => this.getTeamMembers(item.staffId, item.username, item?.teamMemberVoList)}
              style={{
                padding: '0 6px',
                fontSize: '12px',
                color: '#4247f6'
              }}
            >
              下级
            </Button>
          </div>
        </CellMeasurer>
      );
    }

    // 渲染成员项目（包括团队下级页面）
    const isChecked = this.state.selectedUsersMap.has(item.staffId);
    
    return (
      <CellMeasurer
        key={itemKey}
        parent={parent}
        index={index}
        cache={this.cache}
      >
        <div className="select-item" style={style}>
          <Checkbox
            value={item.staffId}
            disabled={this.state.isDisabledTreeData || item.disabled}
            checked={isChecked}
            onChange={(e) => {
              const currentValues = Array.from(this.state.selectedUsersMap.keys());
              const newValue = e.target.checked
                ? [...currentValues, item.staffId]
                : currentValues.filter(id => id !== item.staffId);
              
              if (activeTabKey === '2' && currentLevel === 2 && currentTeamId) {
                const currentCheckedSet = new Set(currentValues);
                if (e.target.checked) {
                  currentCheckedSet.add(item.staffId);
                } else {
                  currentCheckedSet.delete(item.staffId);
                }
                this.onCheck(Array.from(currentCheckedSet));
              } else {
                this.onCheck(newValue);
              }
            }}
          >
            <Avatar
                size={20}
                src={item.staffAvatarUrl}
                icon={<UserOutlined />}
              />
              <span className="select-item-txt-2" title={item.username}>
                {item.username}
              </span>
          </Checkbox>
        </div>
      </CellMeasurer>
    );
  };

  updateListKeys = () => {
    // this.setState({
    //   leftListKey: this.state.leftListKey + 1,
    //   rightListKey: this.state.rightListKey + 1
    // });
  };

  // ==================== API 方法 ====================

  querySeatAllUserData = async () => {
    try {
      this.setState({ isSpinning: true });
      const projectKey = this.props.projectKey || sessionStorage.getItem('adminCurrentProjectKey') || sessionStorage.getItem('jwtMeegoTeamworkProjectKey') || ''
      const teamParams = {
        teamName: '',
        projectKey,
      };
      const res = await queryAuthAllUser();
      const teamRes = await queryAuthTeamList(teamParams);
      
      if (res?.result && res.data) {
        // 处理已选中的用户数据
        const processedSelectUsers = this.state.selectedUsers.map((item, idx) => {
          const staffAvatarUrl = item.avatarUrl || 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png';

          return {
            ...item,
            isUser: true,
            isLeaf: true,
            staffId: item.userKey,
            username: item.userName,
            staffAvatarUrl,
            __unique_key__: `${item.userKey}_${Date.now()}_${idx}`,
            icon: (
              <Avatar
                size={20}
                src={staffAvatarUrl}
                icon={<UserOutlined />}
              />
            )
          };
        });

        // 关键修复：根据已保存的成员数据初始化团队选择状态
        const teamList = teamRes?.data || [];
        const { selectedUsersMap, selectedTeamsSet } = this.state;
        
        // 初始化团队选择状态
        const { 
          teamSelectedUserIdsMap, 
          teamSelectedUsersMap, 
          selectedTeamsSet: updatedSelectedTeamsSet 
        } = this.initializeTeamSelectionState(teamList, selectedUsersMap, selectedTeamsSet);
        
        // 更新团队数据的isAll标志
        const updatedTeamList = teamList.map(team => {
          const isAll = updatedSelectedTeamsSet.has(team.teamId) ? 1 : 0;
          return { ...team, isAll };
        });
        
        const allSelectedUsers = [...processedSelectUsers];
        const allSelectedUserIds = allSelectedUsers.map(user => user.staffId);

        const selectedUsers = processedSelectUsers;
        const selectedUserIds = selectedUsers.map(user => user.staffId);
        const selectedDeparts = Array.from(updatedSelectedTeamsSet).map(teamId => 
          updatedTeamList.find(team => team.teamId === teamId) || { staffId: teamId }
        );
        const selectedDepartIds = Array.from(updatedSelectedTeamsSet);

        const updatedTabSelections = {
          '1': {
            selectedUserIds: selectedUserIds,
            selectedUsers: selectedUsers,
            checkAll: false,
            isIndeterminate: false
          },
          '2': {
            selectedUserIds: selectedDepartIds,
            selectedUsers: selectedDeparts,
            checkAll: false,
            isIndeterminate: false
          }
        };

        this.setState({
          userList: res?.data || [],
          teamList: updatedTeamList,
          teamSelectedUserIdsMap,
          teamSelectedUsersMap,
          selectedTeamsSet: updatedSelectedTeamsSet,
          selectedUsers: allSelectedUsers,
          selectedUserIds: allSelectedUserIds,
          selectedDeparts,
          selectedDepartIds,
          defaultSelectedKeys: allSelectedUserIds,
          tabSelections: updatedTabSelections,
          hasInitializedSelection: true
        }, () => {
          this.props.getSelectedUser({
            selectedDeparts: selectedDeparts,
            selectedUsers: selectedUsers,
            selectedDepartIds: selectedDepartIds,
            selectedUserIds: selectedUserIds,
            checkedKeys: []
          });
          this.processedUserData();
        });

        return Promise.resolve();
      } else {
        this.setState({ isSpinning: false, showAlert: true });
        return Promise.resolve();
      }
    } catch (error) {
      console.error('获取初始数据失败:', error);
      this.setState({ isSpinning: false });
      return Promise.reject(error);
    }
  }

  // ==================== 渲染方法 ====================

  render() {
    const { 
      activeTabKey, 
      breadcrumbItems, 
      treeData, 
      tabSelections,
      isSpinning,
      searchKey,
      selectedUsersMap,
      selectedTeamsSet
    } = this.state;

    const currentTabSelection = tabSelections[activeTabKey];
    const selectedUsersCount = selectedUsersMap.size;
    
    const hasSelections = selectedUsersCount > 0 || selectedTeamsSet.size > 0;

    return (
      <div className="selected-setting-warp standards-setting">
        <div style={{ color: '#666'}}>
          可通过成员或团队维度选择人员。注意：若选中的成员已属于其他规范，保存后将自动从原规范移入当前规范。若删除已选中的成员，保存后将会自动移入到默认规范。
        </div>
        <div className="selected-seat-content">
          <div className="selected-user-left">
            <div className="select-input">
              <Input
                placeholder="请输入关键词"
                value={searchKey}
                suffix={
                  <SearchOutlined 
                    style={{ color: "#BBBBBB", cursor: 'pointer' }} 
                    onClick={() => this.handleSearchChange({ target: { value: searchKey } })}
                  />
                }
                onChange={(e) => {
                  this.setState({ searchKey: e.target.value });
                  this.handleSearchChange(e);
                }}
              />
            </div>
            <div className="select-tabs">
              <Tabs
                activeKey={activeTabKey}
                items={this.state.items}
                onChange={this.onChange}
                inkBarStyle={{
                  backgroundColor: '#1890ff',
                  height: 3,
                  borderRadius: 2,
                }}
              />

              {activeTabKey === '2' && this.state.currentLevel === 2 && (
                <div className="team-breadcrumb" style={{
                  padding: '8px 0',
                  borderBottom: '1px solid #f0f0f0',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <Breadcrumb
                    items={breadcrumbItems.map((item, index) => ({
                      title: index === breadcrumbItems.length - 1 ? (
                        <span style={{ color: '#333', fontWeight: '500' }}>{item.title}</span>
                      ) : (
                        <a
                          onClick={() => this.handleBreadcrumbClick(item)}
                          style={{ color: '#4247f6', cursor: 'pointer' }}
                        >
                          {item.title}
                        </a>
                      )
                    }))}
                    separator=">"
                  />
                </div>
              )}
            </div>

            <Spin spinning={isSpinning} tip="数据加载中...">
              <div className="select-content" style={{ height: '330px', overflow: 'hidden', paddingLeft: '10px' }}>
                {treeData?.length > 0 && !this.state.isDisabledTreeData && (
                  <div className="select-item select-all-item" style={{ marginTop: '6px', marginBottom: '0px' }}>
                    <Checkbox
                      indeterminate={currentTabSelection.isIndeterminate}
                      checked={currentTabSelection.checkAll}
                      onChange={this.onCheckAll}
                    >
                      全选
                    </Checkbox>
                  </div>
                )}

                <div style={{ height: treeData?.length > 0 && !this.state.isDisabledTreeData ? 'calc(100% - 40px)' : '100%' }}>
                  <AutoSizer>
                    {({ height, width }) => (
                      <List
                        ref={this.listRef}
                        key={`left-list-${this.state.leftListKey}-${searchKey}-${activeTabKey}-${this.state.currentLevel}`}
                        width={width}
                        height={height}
                        rowCount={treeData.length}
                        rowHeight={40}
                        rowRenderer={this.renderVirtualRow}
                        deferredMeasurementCache={this.cache}
                        overscanRowCount={5}
                        noRowsRenderer={() => (
                          <div className="empty-data">
                            <Empty
                              image={noDataTable}
                              styles={{
                                image: {
                                  height: 90,
                                  width: 90,
                                  margin: "auto",
                                  marginBottom: 10,
                                },
                              }}
                              description={
                                <span style={{ color: "#727272", fontSize: "12px" }}>
                                  暂无数据
                                </span>
                              }
                            />
                          </div>
                        )}
                      />
                    )}
                  </AutoSizer>
                </div>
              </div>
            </Spin>
          </div>

          {/* 右侧选中区域 */}
          <div className="selected-user-right selected-seat-right">
            <div className="selected-title" style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 14 }}>
              {hasSelections ? (
                <>
                  <p>
                    <span>已选{selectedUsersCount}人</span>
                  </p>
                  <p onClick={this.onClearAll} style={{ cursor: 'pointer', color: '#4147F5FF' }}>清空</p>
                </>
              ) : null}
            </div>
            <div className="selected-content" style={{ height: '100%', overflow: 'hidden' }}>
              <AutoSizer>
                {({ height, width }) => {
                  if (!this.state.computedCache.selectedUsersCache) {
                    this.state.computedCache.selectedUsersCache = Array.from(selectedUsersMap.values())
                      .filter(user => user.isUser);
                  }
                  const selectedUsers = this.state.computedCache.selectedUsersCache;
                  
                  return (
                    <List
                      ref={this.selectedListRef}
                      // key={`right-list-${this.state.rightListKey}-${selectedUsers.length}`}
                      width={width}
                      height={height}
                      rowCount={selectedUsers.length}
                      rowHeight={40}
                      rowRenderer={this.renderSelectedUserRow}
                      deferredMeasurementCache={this.selectedUserCache}
                      overscanRowCount={5}
                      noRowsRenderer={() => (
                        <div className="empty-data" style={{ padding: '28px 0 0' }}>
                          <Empty
                            image={noDataTable}
                            styles={{
                              image: {
                                height: 90,
                                width: 90,
                                margin: "auto",
                                marginBottom: 10,
                              },
                            }}
                            description={
                              <span style={{ color: "#727272", fontSize: "12px" }}>
                                暂无数据
                              </span>
                            }
                          />
                        </div>
                      )}
                    />
                  );
                }}
              </AutoSizer>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default TeamSettings;