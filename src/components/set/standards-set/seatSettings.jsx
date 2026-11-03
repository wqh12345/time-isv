import React, { Component } from "react";
import { Button, Avatar, Input, Checkbox, Tooltip, Spin, Empty, Tabs, Breadcrumb, Alert } from "antd";
import { filterDuplicates, debounce } from '../../../util/util';
import {
  getProjectMemberList,
  getProjectAllStaff,
  postSearchMember,
  getProjectUserTeamAll,
  getreTeam,
  queryTeamUserList,
  querySeatAllUser
} from '../../../api/api';
import { SearchOutlined, CloseOutlined, UserOutlined, CaretRightOutlined, CaretDownOutlined, InfoCircleFilled } from "@ant-design/icons";
import noDataTable from "../../../assets/images/no-data-table.png";
import "./seatSettings.css";
class TeamSettings extends Component {
  constructor(props) {
    super(props);
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
      selectedUsers: [],
      selectedUserIds: [],
      selectedDeparts: [],
      selectedDepartIds: [],
      checkedKeys: [],
      defaultSelectedKeys: [],
      departNum: 0,
      userList: [],
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
      fullTreeData: {
        '1': [],
        '2': []
      },
      seatCount: {
        "used": null,
        "residue": null,
        "total": null
      },
      lastSeatTotal: 0, // 记录上一次的座位总数，用于比较
      hasInitializedSelection: false,
      isSearching: false,
      currentLevel: 1,
      currentTeamId: null,
      teamMemberData: {},
      teamMembers: [],
      teamName: "",
      teamSelectedUserIds: {},
      teamSelectedUsers: {},
      breadcrumbItems: [
        { title: '全部团队', id: null }
      ],
      expandedTeams: {},
      uniqueSelectedCount: 0, // 新增：将已选人数作为状态存储
      showAlert: false
    };
    this.handleSearchChange = debounce(this.onSearchKeyChange, 800).bind(this);
    this.onCheckAll = this.onCheckAll.bind(this);
  }

  componentDidMount() {
    //console.log('selectedUser', this.props.selectedUser);
    const selectedUser = this.props.selectedUser || {};
    const {
      selectedDeparts = [],
      selectedUsers = [],
      selectedDepartIds = [],
      selectedUserIds = [],
    } = selectedUser;

    this.onClearAll = this.onClearAll.bind(this);

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
      tabSelections
    }, () => {
      this.querySeatAllUserData().then(() => {
        // 数据加载完成后更新已选人数
        this.updateSelectedCount();
      });
    });
  }

  componentDidUpdate(prevProps, prevState) {
    //console.log('componentDidUpdate', prevProps);
    // 检查关键状态是否变化，如果变化则更新已选人数
    const keysToWatch = [
      'selectedUserIds', 'selectedDepartIds', 'teamSelectedUserIds', 
      'tabSelections', 'selectedDeparts'
    ];
    
    const shouldUpdateCount = keysToWatch.some(key => 
      JSON.stringify(prevState[key]) !== JSON.stringify(this.state[key])
    );

    if (shouldUpdateCount) {
      //console.log('状态变化，更新已选人数');
      this.updateSelectedCount();
    }
  }

  componentWillReceiveProps(nextProps) {
    const { treeData, activeTabKey, tabSelections } = this.state;
    const nextSelectedUser = nextProps.selectedUser || {};
    let {
      selectedDeparts = [],
      selectedUsers = [],
      selectedDepartIds = [],
      selectedUserIds = []
    } = nextSelectedUser;

    if (!selectedDepartIds.length) {
      const isDisabledTreeData = false;
      this.setState({ isDisabledTreeData, departNum: 0 });
    }

    if (treeData.length) {
      treeData?.forEach((item) => {
        const staffId = activeTabKey === "1" ? item.staffId : item.teamId;
        const username = activeTabKey === "1" ? item.staffName : item.teamName;
        if (
          selectedUserIds.includes(staffId) &&
          !JSON.stringify(selectedUsers).includes(staffId)
        ) {
          selectedUsers.push({
            ...item,
            staffId,
            username,
          });
        }
      });
    }

    const updatedTabSelections = {
      ...tabSelections,
      '1': {
        ...tabSelections['1'],
        selectedUserIds: selectedUserIds,
        selectedUsers: selectedUsers.filter(user => user.isUser)
      },
      '2': {
        ...tabSelections['2'],
        selectedUserIds: selectedDepartIds,
        selectedUsers: selectedDeparts
      }
    };

    this.setState({
      selectedDepartIds,
      selectedUserIds,
      defaultSelectedKeys: selectedDepartIds.concat(selectedUserIds),
      tabSelections: updatedTabSelections
    }, () => {
      this.updateCheckboxStatus();
      this.updateSelectedCount();
    });
  }

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
    const dataList = this.state.activeTabKey === '1'
      ? this.state.userList || []
      : this.state.teamList || [];

    const processedData = dataList.map(item => {
      const staffAvatarUrl = this.state.activeTabKey === '2'
        ? 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png'
        : (item.avatarUrl || 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png');

      const staffId = this.state.activeTabKey === '1' ? item.userKey : item.teamId;
      const username = this.state.activeTabKey === '1' ? item.userName : item.teamName;
      const isUser = this.state.activeTabKey === '1';

      return {
        ...item,
        isUser,
        isLeaf: true,
        staffId,
        username,
        staffAvatarUrl,
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
      [this.state.activeTabKey]: processedData
    };

    this.setState({
      treeData: processedData,
      fullTreeData: updatedFullTreeData,
      isSpinning: false,
      isSearching: false
    }, () => {
      this.updateCheckboxStatus();
      this.updateSelectedCount();
    });
  }

  getSearchUserList = async () => {
    this.setState({ isSpinning: true });
    const { searchKey, activeTabKey, currentLevel } = this.state;
    if (!searchKey) {
      if (currentLevel === 1) {
        this.setState({
          treeData: this.state.fullTreeData[activeTabKey] || [],
          isSpinning: false,
          isSearching: false
        }, () => {
          this.updateCheckboxStatus();
          this.updateSelectedCount();
        });
      } else {
        this.setState({
          treeData: this.state.teamMembers,
          isSpinning: false,
          isSearching: false
        }, () => {
          this.updateCheckboxStatus();
          this.updateSelectedCount();
        });
      }
      return;
    }

    try {
      let res;
      const data = {
        query: searchKey.trim(),
      };

      if (activeTabKey === '1' || (activeTabKey === '2' && currentLevel === 2)) {
        res = await postSearchMember(data);
      } else if (activeTabKey === '2' && currentLevel === 1) {
        res = await querySeatAllUser({ teamName: data.query });
      }

      if (res?.result) {
        let searchList = []
        if (activeTabKey === '2' && currentLevel === 1) {
          searchList = res?.data?.teamList || []
        } else {
          searchList = res.data
        }
        const processedData = searchList.map(item => {
          const staffAvatarUrl = activeTabKey === '2' && currentLevel === 1
            ? 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png'
            : (item.staffAvatarUrl || 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png');

          const staffId = activeTabKey === '1' || (activeTabKey === '2' && currentLevel === 2) ? item.staffUserKey : item.teamId;
          const username = activeTabKey === '1' || (activeTabKey === '2' && currentLevel === 2) ? item.staffName : item.teamName;
          const isUser = activeTabKey === '1' || (activeTabKey === '2' && currentLevel === 2);
          
          // 检查是否是团队且该团队在右侧选中团队列表中存在
          const isTeamInSelected = !isUser && this.state.tabSelections['2']?.selectedUserIds?.includes(staffId);

          return {
            ...item,
            isUser,
            isLeaf: true,
            staffId,
            username,
            userKey: item.staffUserKey,
            staffAvatarUrl,
            // 如果是团队且在选中列表中，添加isAll:1
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
          this.updateSelectedCount();
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

  updateCheckboxStatus = () => {
    const { treeData, activeTabKey, tabSelections, isSearching, currentLevel, currentTeamId, selectedDepartIds } = this.state;
    const currentTabSelection = tabSelections[activeTabKey];
    const currentTabItemIds = treeData.map(item => item.staffId);
    let selectedCountInCurrentTab;

    if (activeTabKey === '2' && currentLevel === 1) {
      selectedCountInCurrentTab = treeData.filter(item =>
        item.isAll === 1 && currentTabSelection.selectedUserIds.includes(item.staffId)
      ).length;
    } else {
      selectedCountInCurrentTab = currentTabItemIds.filter(id => {
        if (activeTabKey === '2' && currentLevel === 2 && currentTeamId) {
          return this.state.teamSelectedUserIds[currentTeamId]?.includes(id) || false;
        }
        return currentTabSelection.selectedUserIds.includes(id);
      }).length;
    }

    const totalItems = currentTabItemIds.length;
    const checkAll = totalItems > 0 && selectedCountInCurrentTab === totalItems;
    const isIndeterminate = selectedCountInCurrentTab > 0 && selectedCountInCurrentTab < totalItems;

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

  // 新增：更新已选人数的方法
  updateSelectedCount = () => {
    const uniqueSelectedCount = this.calculateUniqueSelectedCount();
    const seatTotal = this.state.seatCount.total || 0;
    
    // 当已选人数或座位总数变化时，通知父组件
    if (this.state.uniqueSelectedCount !== uniqueSelectedCount || this.state.lastSeatTotal !== seatTotal) {
      this.setState({ 
        uniqueSelectedCount,
        lastSeatTotal: seatTotal // 记录上一次的座位总数用于比较
      });
      
      // 如果父组件提供了回调函数，调用它传递已选人数和座位总数
      if (typeof this.props.onSelectedCountChange === 'function') {
        this.props.onSelectedCountChange({ uniqueSelectedCount, seatTotal });
        console.log('通知父组件 - 已选人数:', uniqueSelectedCount, '座位总数:', seatTotal);
      }
    }
  };

  querySeatAllUserData = async () => {
    try {
      this.setState({ isSpinning: true });
      const res = await querySeatAllUser();
      if (res?.result && res.data) {
        const { selectUserList = [], selectTeamList = [], seatNumVo } = res.data;
        const seatCountNew = {
          "used": 12,
          "residue": 12,
          "total": 2
        }
        this.setState({ seatCount: { ...seatNumVo},showAlert: true})

        // 按sort字段升序排序selectUserList
        const sortedSelectUserList = [...selectUserList].sort((a, b) => {
          // 处理可能的undefined/null值，确保排序稳定性
          const sortA = a.sort || 0;
          const sortB = b.sort || 0;
          return sortA - sortB;
        });
        const processedSelectUsers = sortedSelectUserList.map(item => {
          const staffAvatarUrl = item.avatarUrl || 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png';

          return {
            ...item,
            isUser: true,
            isLeaf: true,
            staffId: item.userKey,
            username: item.userName,
            staffAvatarUrl,
            icon: (
              <Avatar
                size={20}
                src={staffAvatarUrl}
                icon={<UserOutlined />}
              />
            )
          };
        });

        let teamSelectedUserIds = {};
        if (res?.data?.teamList) {
          res.data.teamList.forEach(team => {
            if (!teamSelectedUserIds[team.teamId]) {
              teamSelectedUserIds[team.teamId] = [];
            }
          });
        }

        if (processedSelectUsers && processedSelectUsers.length > 0) {
          processedSelectUsers.forEach(user => {
            res.data.teamList.forEach(team => {
              team.teamMemberVoList.forEach(member => {
                if (member.userKey == user.userKey && !teamSelectedUserIds[team.teamId].includes(user.userKey)) {
                  teamSelectedUserIds[team.teamId].push(user.userKey);
                }
              })
            });
          });
        }

        const processedSelectTeams = selectTeamList.map(item => {
          const staffAvatarUrl = 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png';

          if (item.teamMemberVoList && item.teamMemberVoList.length > 0) {
            item.teamMemberVoList.forEach(member => {
              if (!teamSelectedUserIds[item.teamId]) {
                teamSelectedUserIds[item.teamId] = [];
              }
              if (!teamSelectedUserIds[item.teamId].includes(member.userKey)) {
                teamSelectedUserIds[item.teamId].push(member.userKey);
              }
            });
          }

          return {
            ...item,
            isUser: false,
            isLeaf: true,
            staffId: item.teamId,
            username: item.teamName,
            staffAvatarUrl,
            icon: (
              <Avatar
                size={20}
                src={staffAvatarUrl}
                icon={<UserOutlined />}
              />
            )
          };
        });

        const allSelectedUsers = [...processedSelectUsers, ...processedSelectTeams];
        const allSelectedUserIds = allSelectedUsers.map(user => user.staffId);

        const selectedUsers = processedSelectUsers;
        const selectedUserIds = selectedUsers.map(user => user.staffId);
        const selectedDeparts = processedSelectTeams;
        const selectedDepartIds = selectedDeparts.map(depart => depart.staffId);

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
          userList: res?.data?.userList || [],
          teamList: res?.data?.teamList || [],
          teamSelectedUserIds: teamSelectedUserIds,
          selectedUsers: allSelectedUsers,
          selectedUserIds: allSelectedUserIds,
          selectedDeparts: selectedDeparts,
          selectedDepartIds: selectedDepartIds,
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
          this.updateSelectedCount();
        });

        return Promise.resolve();
      } else {
        this.setState({ isSpinning: false,showAlert: true});
        return Promise.resolve();
      }
    } catch (error) {
      console.error('获取初始数据失败:', error);
      this.setState({ isSpinning: false });
      return Promise.reject(error);
    }
  }

  getTeamMembers = async (teamId, teamName, teamUserList) => {
    try {
      //console.log('teamUserList', teamId, teamName, teamUserList,this,this.state,teamSelectedUserIds);
      const processedMembers = teamUserList.map(item => ({
        ...item,
        isUser: true,
        isLeaf: true,
        staffId: item.userKey,
        username: item.userName,
        staffAvatarUrl: item.avatarUrl || 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png',
        icon: (
          <Avatar
            size={20}
            src={item.staffAvatarUrl}
            icon={<UserOutlined />}
          />
        )
      }));

      const newBreadcrumbItems = [
        { title: '全部团队', id: null },
        { title: teamName, id: teamId }
      ];
      
      this.setState(prevState => ({
        treeData: processedMembers,
        teamMembers: processedMembers,
        currentTeamId: teamId,
        currentLevel: 2,
        teamName: teamName,
        teamMemberData: {
          ...prevState.teamMemberData,
          [teamId]: processedMembers
        },
        breadcrumbItems: newBreadcrumbItems,
        teamSelectedUserIds: {
          ...prevState.teamSelectedUserIds,
          [teamId]: prevState.teamSelectedUserIds[teamId] || []
        },
        teamSelectedUsers: {
          ...prevState.teamSelectedUsers,
          [teamId]: prevState.teamSelectedUsers[teamId] || []
        },
        isSpinning: false
      }), () => {
        this.updateCheckboxStatus();
        this.updateSelectedCount();
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
        { title: '全部团队', id: null }
      ]
    }, () => {
      this.updateCheckboxStatus();
      this.updateSelectedCount();
    });
  };

  handleBreadcrumbClick = (item) => {
    if (item.id === null) {
      this.backToTeamList();
    }
  };

  hasTeamSelectedMembers = (teamId) => {
    return this.state.teamSelectedUserIds[teamId]?.length > 0;
  };

  getTeamCheckboxState = (team) => {
    // 首先检查团队是否在当前标签页的选中用户列表中
    const currentTabSelection = this.state.tabSelections[this.state.activeTabKey];
    const isTeamDirectlySelected = currentTabSelection?.selectedUserIds?.includes(team.staffId);
    
    if (isTeamDirectlySelected) {
      return { checked: true, indeterminate: false };
    }

    if (team.isAll === 1) {
      return { checked: true, indeterminate: false };
    }

    if (team.isAll === 2) {
      return { checked: false, indeterminate: true };
    }

    const hasSelectedMembers = this.hasTeamSelectedMembers(team.teamId);
    const memberTabSelectedUserIds = this.state.tabSelections['1']?.selectedUserIds || [];
    const hasMemberInMemberTab = team.teamMemberVoList?.some(member =>
      memberTabSelectedUserIds.includes(member.userKey)
    );

    if (hasSelectedMembers || hasMemberInMemberTab) {
      return { checked: false, indeterminate: true };
    }

    return { checked: false, indeterminate: false };
  };

  getTeamMemberDisplayCount = (team) => {
    const teamId = team.staffId;
    const currentTabSelection = this.state.tabSelections['2'];
    const memberTabSelection = this.state.tabSelections['1'];
    
    const isTeamSelected = currentTabSelection.selectedUserIds.includes(teamId);
    if (isTeamSelected) {
      const selectedMemberCount = this.state.teamSelectedUserIds[teamId]?.length || 0;
      return `${selectedMemberCount}/${team?.teamMemberVoList?.length}`;
    } else {
      const memberTabSelectedUserIds = memberTabSelection.selectedUserIds || [];
      const memberInMemberTabCount = team?.teamMemberVoList?.filter(member =>
        memberTabSelectedUserIds.includes(member.userKey)
      ).length || 0;
      return `${memberInMemberTabCount}/${team?.teamMemberVoList?.length}`;
    }
  };

  onTeamCheckboxChange = (team, checked) => {
    console.log('onTeamCheckboxChange',team, checked);
    const { tabSelections } = this.state;
    const currentTabSelection = tabSelections['2'];
    const teamId = team.staffId;

    let updatedSelectedUserIds, updatedSelectedUsers;
    let updatedSelectedDepartIds, updatedSelectedDeparts;

    const updatedTeamList = this.state.teamList.map(t =>
      t.teamId === teamId ? { ...t, isAll: checked ? 1 : 0 } : t
    );

    const updatedTreeData = this.state.treeData.map(item =>
      item.staffId === teamId ? { ...item, isAll: checked ? 1 : 0 } : item
    );

    if (checked) {
      updatedSelectedUserIds = [...new Set([...currentTabSelection.selectedUserIds, teamId])];
      const existingIds = currentTabSelection.selectedUsers.map(user => user.staffId);
      const updatedSelectedUsersList = [...currentTabSelection.selectedUsers];

      if (!existingIds.includes(teamId)) {
        updatedSelectedUsersList.push(team);
      }

      updatedSelectedUsers = updatedSelectedUsersList;
      updatedSelectedDepartIds = updatedSelectedUserIds;
      updatedSelectedDeparts = updatedSelectedUsersList;

      this.setState(prevState => {
        const teamMembers = team.teamMemberVoList || [];
        const uniqueUserIds = [];
        const uniqueUsers = [];

        teamMembers.forEach(member => {
          if (!uniqueUserIds.includes(member.userKey)) {
            uniqueUserIds.push(member.userKey);
            uniqueUsers.push(member);
          }
        });

        return {
          teamSelectedUserIds: {
            ...prevState.teamSelectedUserIds,
            [teamId]: uniqueUserIds
          },
          teamSelectedUsers: {
            ...prevState.teamSelectedUsers,
            [teamId]: uniqueUsers
          }
        };
      });
    } else {
      updatedSelectedUserIds = currentTabSelection.selectedUserIds.filter(id => id !== teamId);
      updatedSelectedUsers = currentTabSelection.selectedUsers.filter(user => user.staffId !== teamId);
      updatedSelectedDepartIds = updatedSelectedUserIds;
      updatedSelectedDeparts = updatedSelectedUsers;

      this.setState(prevState => {
        const memberTabUserIds = prevState.tabSelections['1']?.selectedUserIds || [];
        const teamUsers = prevState.teamSelectedUsers[teamId] || [];
        const usersToKeep = teamUsers.filter(user => memberTabUserIds.includes(user.userKey));
        const userIdsToKeep = usersToKeep.map(user => user.userKey);

        return {
          teamSelectedUserIds: {
            ...prevState.teamSelectedUserIds,
            [teamId]: userIdsToKeep
          },
          teamSelectedUsers: {
            ...prevState.teamSelectedUsers,
            [teamId]: usersToKeep
          }
        };
      });
    }

    const updatedTabSelections = {
      ...tabSelections,
      '2': {
        ...currentTabSelection,
        selectedUserIds: updatedSelectedUserIds,
        selectedUsers: updatedSelectedUsers
      }
    };

    const allSelectedUserIds = [
      ...tabSelections['1'].selectedUserIds,
      ...updatedSelectedUserIds
    ];

    const allSelectedUsers = [
      ...tabSelections['1'].selectedUsers,
      ...updatedSelectedUsers
    ];

    this.setState({
      teamList: updatedTeamList,
      treeData: updatedTreeData,
      tabSelections: updatedTabSelections,
      selectedUserIds: allSelectedUserIds,
      selectedUsers: allSelectedUsers,
      selectedDeparts: updatedSelectedDeparts,
      selectedDepartIds: updatedSelectedDepartIds,
      defaultSelectedKeys: allSelectedUserIds
    }, () => {
      this.updateCheckboxStatus();
      this.updateSelectedCount();
      this.props.getSelectedUser({
        selectedDeparts: updatedSelectedDeparts,
        selectedUsers: tabSelections['1'].selectedUsers,
        selectedDepartIds: updatedSelectedDepartIds,
        selectedUserIds: tabSelections['1'].selectedUserIds,
        checkedKeys: []
      });
    });
  };

  onCheck = (checkedValues) => {
    const {
      treeData,
      activeTabKey,
      tabSelections,
      currentLevel,
      currentTeamId,
      teamSelectedUserIds,
      teamSelectedUsers
    } = this.state;

    // console.log('onCheck called with:', {
    //   checkedValues,
    //   activeTabKey,
    //   currentLevel,
    //   currentTeamId,
    //   treeDataLength: treeData.length
    // });
    checkedValues = [...new Set(checkedValues)];
    //console.log('checkedValues',checkedValues);
    // 情况1: 在团队下级页面勾选团队成员
    if (activeTabKey === '2' && currentLevel === 2 && currentTeamId) {
      console.log('处理团队下级成员勾选');
      
      const prevSelectedIds = teamSelectedUserIds[currentTeamId] || [];
      const currentSelectedIds = [...checkedValues];
      
      // 找出新增和移除的成员
      const addedIds = currentSelectedIds.filter(id => !prevSelectedIds.includes(id));
      const removedIds = prevSelectedIds.filter(id => !currentSelectedIds.includes(id));
      
      console.log('成员变化:', { addedIds, removedIds, prevSelectedIds, currentSelectedIds });

      // 更新团队选中的成员
      const updatedTeamSelectedIds = {
        ...teamSelectedUserIds,
        [currentTeamId]: currentSelectedIds
      };

      const updatedTeamSelectedUsers = {
        ...teamSelectedUsers,
        [currentTeamId]: treeData
          .filter(item => currentSelectedIds.includes(item.staffId))
          .map(user => ({
            ...user,
            userKey: user.staffId,
            userName: user.userName
          }))
      };

      // 获取成员标签页的当前选择
      const memberTabSelection = tabSelections['1'];
      let updatedMemberSelectedIds = [...memberTabSelection.selectedUserIds];
      let updatedMemberSelectedUsers = [...memberTabSelection.selectedUsers];

      // 处理新增的成员：添加到成员标签页
      addedIds.forEach(addedId => {
        if (!updatedMemberSelectedIds.includes(addedId)) {
          const userToAdd = treeData.find(item => item.staffId === addedId);
          if (userToAdd) {
            updatedMemberSelectedIds.push(addedId);
            updatedMemberSelectedUsers.push({
              ...userToAdd,
              userKey: userToAdd.staffId,
              userName: userToAdd.userName
            });
          }
        }
      });

      // 处理移除的成员：从成员标签页中移除
      removedIds.forEach(removedId => {
        updatedMemberSelectedIds = updatedMemberSelectedIds.filter(id => id !== removedId);
        updatedMemberSelectedUsers = updatedMemberSelectedUsers.filter(user => 
          (user.staffId || user.userKey) !== removedId
        );
      });

      // 更新标签页选择状态
      const updatedTabSelections = {
        ...tabSelections,
        '1': {
          ...memberTabSelection,
          selectedUserIds: updatedMemberSelectedIds,
          selectedUsers: updatedMemberSelectedUsers
        }
      };

      // 计算所有选中的用户（包括直接选中的和通过团队选中的）
      const allSelectedUserIds = new Set();
      const allSelectedUsers = new Map();

      // 添加直接选中的用户（成员标签页）
      updatedMemberSelectedUsers.forEach(user => {
        const userId = user.staffId || user.userKey;
        allSelectedUserIds.add(userId);
        allSelectedUsers.set(userId, user);
      });

      // 添加团队标签页选中的团队
      tabSelections['2'].selectedUsers.forEach(team => {
        const teamId = team.staffId;
        allSelectedUserIds.add(teamId);
        allSelectedUsers.set(teamId, team);
      });

      const finalSelectedUsers = Array.from(allSelectedUsers.values());
      const finalSelectedUserIds = Array.from(allSelectedUserIds);

      console.log('更新后的选中状态:', {
        teamSelectedIds: updatedTeamSelectedIds[currentTeamId],
        memberTabSelectedCount: updatedMemberSelectedIds.length,
        allSelectedCount: finalSelectedUserIds.length
      });

      this.setState({
        teamSelectedUserIds: updatedTeamSelectedIds,
        teamSelectedUsers: updatedTeamSelectedUsers,
        tabSelections: updatedTabSelections,
        selectedUsers: finalSelectedUsers,
        selectedUserIds: finalSelectedUserIds,
        defaultSelectedKeys: finalSelectedUserIds
      }, () => {
        this.updateCheckboxStatus();
        this.updateSelectedCount();
        // 调用父组件回调，传递最新的选中状态
        this.props.getSelectedUser({
          selectedDeparts: this.state.tabSelections['2'].selectedUsers,
          selectedUsers: updatedMemberSelectedUsers,
          selectedDepartIds: this.state.tabSelections['2'].selectedUserIds,
          selectedUserIds: updatedMemberSelectedIds,
          checkedKeys: []
        });
      });

      return;
    }

    // 情况2: 在成员页面或团队主页面勾选
    const currentTabSelection = tabSelections[activeTabKey];
    const currentDisplayItemIds = treeData.map(item => item.staffId);
    
    const previouslyCheckedInDisplay = currentTabSelection.selectedUserIds.filter(
      id => currentDisplayItemIds.includes(id)
    );
    
    const addedIds = checkedValues.filter(
      id => !previouslyCheckedInDisplay.includes(id)
    );
    const removedIds = previouslyCheckedInDisplay.filter(
      id => !checkedValues.includes(id)
    );

    console.log('普通勾选变化:', { addedIds, removedIds, previouslyCheckedInDisplay, checkedValues });

    const updatedSelectedIds = [
      ...currentTabSelection.selectedUserIds.filter(id => !removedIds.includes(id)),
      ...addedIds
    ];

    let updatedSelectedUsers = [
      ...currentTabSelection.selectedUsers.filter(user => !removedIds.includes(user.staffId))
    ];

    // 添加新选中的项目
    addedIds.forEach(addedId => {
      const newItem = treeData.find(item => item.staffId === addedId);
      if (newItem && !updatedSelectedUsers.find(user => user.staffId === addedId)) {
        updatedSelectedUsers.push(newItem);
      }
    });
    const updatedTabSelections = {
      ...tabSelections,
      [activeTabKey]: {
        ...currentTabSelection,
        selectedUserIds: updatedSelectedIds,
        selectedUsers: updatedSelectedUsers
      }
    };

    // 计算最终的选中用户（合并成员和团队选中的用户）
    const memberSelectedUsers = updatedTabSelections['1'].selectedUsers;
    const memberSelectedUserIds = updatedTabSelections['1'].selectedUserIds;
    //console.log('updatedSelectedUsers',memberSelectedUsers,memberSelectedUserIds);
    const teamMembersSelectedUserIds = [];
    const teamMembersSelectedUsers = [];

    Object.keys(this.state.teamSelectedUserIds).forEach(teamId => {
      const teamIds = this.state.teamSelectedUserIds[teamId] || [];
      const teamUsers = this.state.teamSelectedUsers[teamId] || [];
      teamMembersSelectedUserIds.push(...teamIds);
      teamMembersSelectedUsers.push(...teamUsers);
    });
    //console.log('teamMembersSelectedUsers',teamMembersSelectedUsers,teamMembersSelectedUserIds);
    const uniqueUserMap = new Map();
    
    // 添加团队选中的用户
    // teamMembersSelectedUsers.forEach(user => {
    //   const userId = user.staffId || user.userKey;
    //   uniqueUserMap.set(userId, user);
    // });
    //console.log('uniqueUserMap',uniqueUserMap);
    let uniqueUsers=[], uniqueUserIds=[];

    if (activeTabKey === '1') {
      // 成员页面：合并成员页面选中的用户和团队选中的用户
      memberSelectedUsers.forEach(user => {
        const userId = user.staffId || user.userKey;
        uniqueUserMap.set(userId, user);
      });
      uniqueUsers = Array.from(uniqueUserMap.values());
      uniqueUserIds = Array.from(uniqueUserMap.keys());
      //console.log('uniqueUsers',uniqueUsers,uniqueUserIds);
    } else {
      // 团队页面：直接使用成员页面选中的用户
      uniqueUsers = memberSelectedUsers;
      uniqueUserIds = memberSelectedUserIds;
    }
    //console.log('uniqueUsers',updatedTabSelections['2'].selectedUsers);
    let allSelectedUsers = [];
    let allSelectedUserIds = [];
    if (activeTabKey === '1') {
      allSelectedUsers = [...uniqueUsers];
      allSelectedUserIds = [...uniqueUserIds];
    }else{
      allSelectedUsers = [...uniqueUsers, ...updatedTabSelections['2'].selectedUsers];
      allSelectedUserIds = [...uniqueUserIds, ...updatedTabSelections['2'].selectedUserIds];
    }
    console.log('最终选中状态:', {
      uniqueUsersCount: uniqueUsers.length,
      allSelectedCount: allSelectedUserIds.length,
      teamSelectedCount: updatedTabSelections['2'].selectedUsers.length
    });
    //console.log('allSelectedUsers',allSelectedUsers,uniqueUsers);
    this.setState({
      tabSelections: updatedTabSelections,
      selectedUsers: allSelectedUsers,
      selectedUserIds: allSelectedUserIds,
      defaultSelectedKeys: allSelectedUserIds
    }, () => {
      this.updateCheckboxStatus();
      this.updateSelectedCount();
      this.props.getSelectedUser({
        selectedDeparts: updatedTabSelections['2'].selectedUsers,
        selectedUsers: uniqueUsers,
        selectedDepartIds: updatedTabSelections['2'].selectedUserIds,
        selectedUserIds: uniqueUserIds,
        checkedKeys: []
      });
    });
  };

  onClearSelectedClick = () => {
    const { activeTabKey, tabSelections } = this.state;
    const updatedTabSelections = {
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
    };

    this.setState({
      selectedDeparts: [],
      selectedUsers: [],
      selectedDepartIds: [],
      selectedUserIds: [],
      checkedKeys: [],
      tabSelections: updatedTabSelections,
      defaultSelectedKeys: [],
      isDisabledTreeData: false
    }, () => {
      this.updateCheckboxStatus();
      this.updateSelectedCount();
    });

    this.props.getSelectedUser({
      selectedDeparts: [],
      selectedUsers: [],
      selectedDepartIds: [],
      selectedUserIds: [],
      checkedKeys: [],
    });
  };

  onDelSelectedClick = (item, index, type) => {
    console.log('删除项目:', { item, index, type });
    
    const { 
      tabSelections, 
      selectedDeparts, 
      selectedDepartIds, 
      teamSelectedUserIds,
      teamSelectedUsers,
      selectedUsers,
      selectedUserIds
    } = this.state;
    
    const targetTabKey = type === 'user' ? '1' : '2';
    const targetTabSelection = tabSelections[targetTabKey];
    
    // 统一使用 staffId 作为主要ID标识
    const itemIdToDelete = item.staffId || item.id;
    
    console.log('要删除的项目ID:', itemIdToDelete);

    // 更新标签页选择状态
    const updatedSelectedUserIds = targetTabSelection.selectedUserIds.filter(id => id !== itemIdToDelete);
    const updatedSelectedUsers = targetTabSelection.selectedUsers.filter(user => 
      (user.staffId || user.id) !== itemIdToDelete
    );

    const updatedTabSelections = {
      ...tabSelections,
      [targetTabKey]: {
        ...targetTabSelection,
        selectedUserIds: updatedSelectedUserIds,
        selectedUsers: updatedSelectedUsers
      }
    };

    let updatedSelectedDeparts = [...selectedDeparts];
    let updatedSelectedDepartIds = [...selectedDepartIds];
    let updatedTeamSelectedUserIds = { ...teamSelectedUserIds };
    let updatedTeamSelectedUsers = { ...teamSelectedUsers };

    // 处理删除用户的情况
    if (type === 'user') {
      console.log('删除用户，更新团队选中状态');
      
      // 从所有团队的选中成员中移除该用户
      Object.keys(updatedTeamSelectedUserIds).forEach(teamId => {
        if (updatedTeamSelectedUserIds[teamId]) {
          updatedTeamSelectedUserIds[teamId] = updatedTeamSelectedUserIds[teamId].filter(
            userId => userId !== itemIdToDelete
          );
        }
        
        if (updatedTeamSelectedUsers[teamId]) {
          updatedTeamSelectedUsers[teamId] = updatedTeamSelectedUsers[teamId].filter(
            user => (user.staffId || user.id || user.userKey) !== itemIdToDelete
          );
        }
        
        // 如果团队没有选中的成员了，清理空数组
        if (updatedTeamSelectedUserIds[teamId] && updatedTeamSelectedUserIds[teamId].length === 0) {
          delete updatedTeamSelectedUserIds[teamId];
          delete updatedTeamSelectedUsers[teamId];
        }
      });
    }

    // 处理删除团队的情况
    if (type === 'depart') {
      console.log('删除团队:', itemIdToDelete);
      
      updatedSelectedDeparts = selectedDeparts.filter(depart => depart.staffId !== itemIdToDelete);
      updatedSelectedDepartIds = selectedDepartIds.filter(id => id !== itemIdToDelete);
      
      // 保留该团队中在成员页面单独选中的用户
      const memberTabUserIds = tabSelections['1']?.selectedUserIds || [];
      const teamMembers = teamSelectedUsers[itemIdToDelete] || [];
      const usersToKeep = teamMembers.filter(user => 
        memberTabUserIds.includes(user.userKey || user.staffId || user.id)
      );
      const userIdsToKeep = usersToKeep.map(user => user.userKey || user.staffId || user.id);

      if (userIdsToKeep.length > 0) {
        updatedTeamSelectedUserIds[itemIdToDelete] = userIdsToKeep;
        updatedTeamSelectedUsers[itemIdToDelete] = usersToKeep;
      } else {
        delete updatedTeamSelectedUserIds[itemIdToDelete];
        delete updatedTeamSelectedUsers[itemIdToDelete];
      }

      // 更新树数据中的团队状态
      let updatedFullTreeData = { ...this.state.fullTreeData };
      let updatedTreeData = [...this.state.treeData];

      if (updatedFullTreeData['2']) {
        updatedFullTreeData['2'] = updatedFullTreeData['2'].map(team => {
          if (team.staffId === itemIdToDelete) {
            return { ...team, isAll: 0 };
          }
          return team;
        });
      }

      updatedTreeData = updatedTreeData.map(team => {
        if (team.staffId === itemIdToDelete) {
          return { ...team, isAll: 0 };
        }
        return team;
      });

      this.setState({
        fullTreeData: updatedFullTreeData,
        treeData: updatedTreeData
      });
    }

    // 计算最终的选中用户
    const allSelectedUserIds = [
      ...updatedTabSelections['1'].selectedUserIds,
      ...updatedTabSelections['2'].selectedUserIds
    ];

    const allSelectedUsers = [
      ...updatedTabSelections['1'].selectedUsers,
      ...updatedTabSelections['2'].selectedUsers
    ];

    console.log('删除后的状态:', {
      updatedTeamSelectedUserIds,
      allSelectedCount: allSelectedUserIds.length
    });

    this.setState({
      tabSelections: updatedTabSelections,
      selectedUserIds: allSelectedUserIds,
      selectedUsers: allSelectedUsers,
      selectedDeparts: updatedSelectedDeparts,
      selectedDepartIds: updatedSelectedDepartIds,
      teamSelectedUserIds: updatedTeamSelectedUserIds,
      teamSelectedUsers: updatedTeamSelectedUsers,
      defaultSelectedKeys: allSelectedUserIds
    }, () => {
      this.updateCheckboxStatus();
      this.updateSelectedCount();
      this.props.getSelectedUser({
        selectedDeparts: updatedSelectedDeparts,
        selectedUsers: updatedTabSelections['1'].selectedUsers,
        selectedDepartIds: updatedSelectedDepartIds,
        selectedUserIds: updatedTabSelections['1'].selectedUserIds,
        checkedKeys: []
      });
    });
  };

  onCheckAll = (e) => {
    const { checked } = e.target;
    const {
      treeData, activeTabKey, tabSelections,
      selectedDeparts, selectedDepartIds,
      teamSelectedUserIds, teamSelectedUsers,
      currentLevel, currentTeamId
    } = this.state;
    const currentTabSelection = tabSelections[activeTabKey];
    const currentTabItemIds = treeData.map(item => item.staffId);

    let updatedSelectedUserIds, updatedSelectedUsers;
    let updatedSelectedDeparts = [...selectedDeparts];
    let updatedSelectedDepartIds = [...selectedDepartIds];
    let updatedTeamSelectedUserIds = { ...teamSelectedUserIds };
    let updatedTeamSelectedUsers = { ...teamSelectedUsers };
    let updatedTeamList = [...this.state.teamList];
    let updatedTreeData = [...this.state.treeData];

    if (checked) {
      if (currentLevel === 2 && currentTeamId) {
        const allMemberIds = treeData.map(member => member.staffId);
        const allMembers = treeData.map(member => ({ ...member, isUser: true }));
        updatedTeamSelectedUserIds[currentTeamId] = allMemberIds;
        updatedTeamSelectedUsers[currentTeamId] = allMembers;
        const memberTabSelection = tabSelections['1'];
        const existingMemberIds = memberTabSelection.selectedUserIds;
        const existingMembers = memberTabSelection.selectedUsers;
        const newMemberIds = allMemberIds.filter(id => !existingMemberIds.includes(id));
        const newMembers = allMembers.filter(member => !existingMemberIds.includes(member.staffId));
        updatedSelectedUserIds = [...existingMemberIds, ...newMemberIds];
        updatedSelectedUsers = [...existingMembers, ...newMembers];
      } else {
        updatedSelectedUserIds = [...new Set([...currentTabSelection.selectedUserIds, ...currentTabItemIds])];
        const existingIds = currentTabSelection.selectedUsers.map(user => user.staffId);
        const newUsers = treeData.filter(item => !existingIds.includes(item.staffId));
        updatedSelectedUsers = [...currentTabSelection.selectedUsers, ...newUsers];

        if (activeTabKey === '2') {
          const existingTeamIds = updatedSelectedDepartIds;
          const newTeams = treeData.filter(item => !existingTeamIds.includes(item.staffId));
          updatedSelectedDeparts = [...updatedSelectedDeparts, ...newTeams];
          updatedSelectedDepartIds = [...updatedSelectedDepartIds, ...currentTabItemIds];
          updatedTeamList = updatedTeamList.map(team =>
            currentTabItemIds.includes(team.teamId) ? { ...team, isAll: 1 } : team
          );
          updatedTreeData = updatedTreeData.map(item =>
            currentTabItemIds.includes(item.staffId) ? { ...item, isAll: 1 } : item
          );

          treeData.forEach(team => {
            if (team.teamMemberVoList && Array.isArray(team.teamMemberVoList)) {
              const allMemberIds = team.teamMemberVoList.map(member => member.userKey);
              const allMembers = team.teamMemberVoList.map(member => ({
                ...member,
                staffId: member.userKey,
                username: member.userName
              }));
              updatedTeamSelectedUserIds[team.staffId] = allMemberIds;
              updatedTeamSelectedUsers[team.staffId] = allMembers;
            }
          });
        }
      }
    } else {
      if (currentLevel === 2 && currentTeamId) {
        updatedTeamSelectedUserIds[currentTeamId] = [];
        updatedTeamSelectedUsers[currentTeamId] = [];
        const memberTabSelection = tabSelections['1'];
        updatedSelectedUserIds = memberTabSelection.selectedUserIds.filter(
          id => !currentTabItemIds.includes(id)
        );
        updatedSelectedUsers = memberTabSelection.selectedUsers.filter(
          user => !currentTabItemIds.includes(user.staffId)
        );
      } else {
        updatedSelectedUserIds = currentTabSelection.selectedUserIds.filter(
          id => !currentTabItemIds.includes(id)
        );
        updatedSelectedUsers = currentTabSelection.selectedUsers.filter(
          user => !currentTabItemIds.includes(user.staffId)
        );

        if (activeTabKey === '2') {
          updatedSelectedDeparts = updatedSelectedDeparts.filter(
            team => !currentTabItemIds.includes(team.staffId)
          );
          updatedSelectedDepartIds = updatedSelectedDepartIds.filter(
            id => !currentTabItemIds.includes(id)
          );
          updatedTeamList = updatedTeamList.map(team =>
            currentTabItemIds.includes(team.teamId) ? { ...team, isAll: 0 } : team
          );
          updatedTreeData = updatedTreeData.map(item =>
            currentTabItemIds.includes(item.staffId) ? { ...item, isAll: 0 } : item
          );

          currentTabItemIds.forEach(teamId => {
            delete updatedTeamSelectedUserIds[teamId];
            delete updatedTeamSelectedUsers[teamId];
          });
        }
      }
    }

    const updatedTabSelections = { ...tabSelections };
    if (currentLevel === 2 && currentTeamId) {
      updatedTabSelections['1'] = {
        ...updatedTabSelections['1'],
        selectedUserIds: updatedSelectedUserIds,
        selectedUsers: updatedSelectedUsers,
        checkAll: checked,
        isIndeterminate: false
      };
    } else {
      updatedTabSelections[activeTabKey] = {
        ...currentTabSelection,
        selectedUserIds: updatedSelectedUserIds,
        selectedUsers: updatedSelectedUsers,
        checkAll: checked,
        isIndeterminate: false
      };
    }

    const allSelectedUserIds = [
      ...updatedTabSelections['1'].selectedUserIds,
      ...updatedTabSelections['2'].selectedUserIds
    ];

    const allSelectedUsers = [
      ...updatedTabSelections['1'].selectedUsers,
      ...updatedTabSelections['2'].selectedUsers
    ];

    this.setState({
      teamList: updatedTeamList,
      treeData: updatedTreeData,
      tabSelections: updatedTabSelections,
      selectedUserIds: allSelectedUserIds,
      selectedUsers: allSelectedUsers,
      selectedDeparts: updatedSelectedDeparts,
      selectedDepartIds: updatedSelectedDepartIds,
      teamSelectedUserIds: updatedTeamSelectedUserIds,
      teamSelectedUsers: updatedTeamSelectedUsers,
      defaultSelectedKeys: allSelectedUserIds
    }, () => {
      this.updateSelectedCount();
      this.props.getSelectedUser({
        selectedDeparts: updatedSelectedDeparts,
        selectedUsers: updatedTabSelections['1'].selectedUsers,
        selectedDepartIds: updatedSelectedDepartIds,
        selectedUserIds: updatedTabSelections['1'].selectedUserIds,
        checkedKeys: []
      });
    });
  };

  onChange = (key) => {
    this.setState({
      activeTabKey: key,
      searchKey: '',
      isSearching: false,
      currentLevel: 1,
      currentTeamId: null,
      teamName: "",
      breadcrumbItems: [
        { title: '全部团队', id: null }
      ]
    }, () => {
      const fullTreeData = this.state.fullTreeData[key] || [];
      let updatedTreeData = fullTreeData;

      if (key === '2') {
        updatedTreeData = fullTreeData.map(team => {
          const isTeamSelected = this.state.selectedDepartIds.includes(team.staffId);
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
          this.updateCheckboxStatus();
          this.updateSelectedCount();
        });
      } else {
        this.setState({
          treeData: updatedTreeData
        }, () => {
          this.updateCheckboxStatus();
          this.updateSelectedCount();
        });
      }

      if (!this.state.fullTreeData[key] || this.state.fullTreeData[key].length === 0) {
        this.processedUserData();
      }
    });
  };

  onClearAll = () => {
    const { activeTabKey, tabSelections } = this.state;
    const updatedTabSelections = {
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
    };

    const updatedTeamList = this.state.teamList.map(team => ({ ...team, isAll: 0 }));
    const updatedTreeData = this.state.treeData.map(item => ({ ...item, isAll: 0 }));

    this.setState({
      selectedDeparts: [],
      selectedUsers: [],
      selectedDepartIds: [],
      selectedUserIds: [],
      checkedKeys: [],
      tabSelections: updatedTabSelections,
      defaultSelectedKeys: [],
      isDisabledTreeData: false,
      teamSelectedUserIds: {},
      teamSelectedUsers: {},
      expandedTeams: {},
      teamList: updatedTeamList,
      treeData: updatedTreeData
    }, () => {
      this.updateCheckboxStatus();
      this.updateSelectedCount();
    });

    this.props.getSelectedUser({
      selectedDeparts: [],
      selectedUsers: [],
      selectedDepartIds: [],
      selectedUserIds: [],
      checkedKeys: [],
    });
  }

  toggleTeamExpand = (teamId) => {
    this.setState(prevState => ({
      expandedTeams: {
        ...prevState.expandedTeams,
        [teamId]: !prevState.expandedTeams[teamId]
      }
    }));
  };

  calculateUniqueSelectedCount = () => {
    const uniqueSelectedIds = new Set();

    // console.log('计算已选人数 - 当前状态:', {
    //   selectedUserIds: this.state.selectedUserIds,
    //   selectedDepartIds: this.state.selectedDepartIds,
    //   teamSelectedUserIds: this.state.teamSelectedUserIds,
    //   tabSelections: this.state.tabSelections
    // });

    try {
      // 1. 添加直接选中的用户（成员标签页）
      const memberTabSelection = this.state.tabSelections['1'];
      if (memberTabSelection && memberTabSelection.selectedUserIds) {
        memberTabSelection.selectedUserIds.forEach(userId => {
          uniqueSelectedIds.add(userId);
        });
      }
      //console.log(memberTabSelection.selectedUserIds,'直接选中的用户ID888888:', uniqueSelectedIds.size,this.state.teamSelectedUserIds);
      // // 2. 添加通过团队选中的用户
      // Object.entries(this.state.teamSelectedUserIds).forEach(([teamId, selectedMemberIds]) => {
      //   // 如果团队本身没有被选中（即不是全选团队），则添加该团队中选中的成员
      //   const isTeamSelected = this.state.selectedDepartIds.includes(teamId);
      //   if (!isTeamSelected && selectedMemberIds && Array.isArray(selectedMemberIds)) {
      //     selectedMemberIds.forEach(userId => {
      //       uniqueSelectedIds.add(userId);
      //     });
      //   }
      // });
       //console.log('直接选中的用户ID99999:', uniqueSelectedIds.size);
      // 3. 添加全选团队的所有成员
      this.state.selectedDeparts.forEach(team => {
        if (team.teamMemberVoList && Array.isArray(team.teamMemberVoList)) {
          team.teamMemberVoList.forEach(member => {
            uniqueSelectedIds.add(member.userKey);
          });
        }
      });

      // console.log('最终计算的已选用户ID:', Array.from(uniqueSelectedIds));
      // console.log('已选人数:', uniqueSelectedIds.size);

      return uniqueSelectedIds.size;
    } catch (error) {
      console.error('计算已选人数时出错:', error);
      return 0;
    }
  };

  render() {
    const { activeTabKey, tabSelections, breadcrumbItems, expandedTeams } = this.state;
    const currentTabSelection = tabSelections[activeTabKey];
    const selectedTeams = this.state.selectedDeparts || [];
    const selectedUsers = this.state.selectedUsers.filter(user => user.isUser) || [];
    
    // 使用状态中的已选人数，确保实时更新
    const uniqueSelectedCount = this.state.uniqueSelectedCount;
    const seatTotal = this.state.seatCount.total || 0;

    //console.log('渲染 - 已选人数:', uniqueSelectedCount, '座位总数:', seatTotal);

    return (
      <div className="selected-setting-warp">
        {uniqueSelectedCount > seatTotal && this.state.showAlert &&(
          <Alert message={<span style={{color:'#FDA500',fontSize:'14px'}}><span style={{marginRight: 8}}><InfoCircleFilled className="icon" /></span>当前配置已超出 {uniqueSelectedCount - seatTotal} 人，请删减人员</span>} type="warning" style={{marginBottom: 12}}/>
        )}
        <div className="selected-seat-content">
          <div className="selected-user-left">
            <div className="select-input">
              <Input
                placeholder="请输入关键词"
                value={this.state.searchKey}
                suffix={
                  <SearchOutlined 
                    style={{ color: "#BBBBBB", cursor: 'pointer' }} 
                    onClick={() => this.handleSearchChange({ target: { value: this.state.searchKey } })}
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
                activeKey={this.state.activeTabKey}
                items={this.state.items}
                onChange={this.onChange}
                inkBarStyle={{
                  backgroundColor: '#1890ff',
                  height: 3,
                  borderRadius: 2,
                }}
              />

              {this.state.activeTabKey === '2' && this.state.currentLevel === 2 && (
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

            <Spin spinning={this.state.isSpinning} tip="数据加载中...">
              <div className="select-content" style={{ height: '330px', overflowY: 'auto', overflowX: 'hidden' }}>
                {this.state.treeData?.length > 0 && !this.state.isDisabledTreeData && (
                  <div className="select-item select-all-item" style={{ marginTop: '6px',marginBottom:'0px'}}>
                    <Checkbox
                      indeterminate={currentTabSelection.isIndeterminate}
                      checked={currentTabSelection.checkAll}
                      onChange={this.onCheckAll}
                    >
                      全选
                    </Checkbox>
                  </div>
                )}

                {this.state.treeData && this.state.treeData.length > 0 && (
                  <Checkbox.Group
                    value={this.state.activeTabKey === '2' && this.state.currentLevel === 2 && this.state.currentTeamId
                      ? this.state.teamSelectedUserIds[this.state.currentTeamId] || []
                      : currentTabSelection.selectedUserIds
                    }
                    onChange={this.onCheck}
                  >
                    {this.state.treeData.map((item) => {
                      if (this.state.activeTabKey === '2' && this.state.currentLevel === 1) {
                        const { checked, indeterminate } = this.getTeamCheckboxState(item);
                        const isTeamSelected = currentTabSelection.selectedUserIds.includes(item.staffId);
                        return (
                          <div className="select-item" key={item.staffId}>
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
                              <span className="select-item-txt" title={item.username}>
                                {item.username}
                              </span>
                              <span className="team-teamMemberVoList-num">({this.getTeamMemberDisplayCount(item)})</span>
                            </Checkbox>
                            <Button
                              type="text"
                              size="small"
                              onClick={() => this.getTeamMembers(item.staffId, item.username, item?.teamMemberVoList)}
                              disabled={isTeamSelected}
                              style={{
                                padding: '0 6px',
                                fontSize: '12px',
                                color: isTeamSelected ? '#d9d9d9' : '#4247f6'
                              }}
                            >
                              下级
                            </Button>
                          </div>
                        );
                      }

                      const isTeamMemberLevel = this.state.activeTabKey === '2' && this.state.currentLevel === 2 && this.state.currentTeamId;
                      const isChecked = isTeamMemberLevel
                        ? (this.state.teamSelectedUserIds[this.state.currentTeamId] || []).includes(item.staffId)
                        : (this.state.tabSelections[this.state.activeTabKey]?.selectedUserIds || []).includes(item.staffId);

                      return (
                        <div className="select-item" key={item.staffId}>
                          <Checkbox
                            value={item.staffId}
                            disabled={this.state.isDisabledTreeData || item.disabled}
                            checked={isChecked}
                            onChange={(e) => {
                              const currentValues = this.state.defaultSelectedKeys || [];
                              const newValue = e.target.checked
                                ? [...currentValues, item.staffId]
                                : currentValues.filter(id => id !== item.staffId);
                              this.onCheck(newValue);
                            }}
                          >
                            {/* <Avatar
                              size={20}
                              src={item.staffAvatarUrl}
                              icon={<UserOutlined />}
                            />
                            <span className="select-item-txt">
                              {item.username}
                            </span> */}
                             {item.userKey ? <Tag userId={item.userKey} name={item.username} avatar={item.staffAvatarUrl} /> : ""}
                          </Checkbox>
                        </div>
                      );
                    })}
                  </Checkbox.Group>
                )}
                {!this.state.treeData?.length && !this.state.isSpinning ? (
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
                ) : null}
              </div>
            </Spin>
          </div>

          {/* 右侧选中区域 */}
          <div className="selected-user-right selected-seat-right">
            <div className="selected-title" style={{ display: 'flex', justifyContent: 'space-between',paddingLeft: 14 }}>
              {this.state.selectedUsers?.length==0 && this.state.selectedTeams?.length==0 ? null: (
                <>
                  <p>
                    {seatTotal >= 999999 ? 
                      `已选${uniqueSelectedCount}人` : 
                      <>
                        <span>可选{seatTotal}人</span>，
                        <span>
                          已选<span style={{ color: uniqueSelectedCount > seatTotal ? '#ff4d4f' : 'inherit' }}>{uniqueSelectedCount}</span>人
                        </span>
                      </>
                    }
                  </p>
                  <p onClick={this.onClearAll} style={{ cursor: 'pointer', color: '#4147F5FF' }}>清空</p>
                </>
              )}
            </div>
            <div className="selected-content">
              {/* 渲染单独选中的成员 */}
              {selectedUsers.map((user, index) => {
                const isExceedLimit = uniqueSelectedCount > seatTotal;
                const isGrayed = isExceedLimit && index >= seatTotal;

                return (
                  // <Tooltip
                  //   key={user.staffId || user.id}
                  //   title={isGrayed ? "暂无席位权限" : ""}
                  //   placement="top"
                  //   trigger="hover"
                  // >
                    <div
                      title={isGrayed ? "暂无席位权限" : ""}
                      className={`selected-item ${isGrayed ? 'selected-item-grayed' : ''}`}
                    >
                      <div className="selected-item-left">
                        {/* <Avatar
                          size={20}
                          src={user.staffAvatarUrl}
                          icon={<UserOutlined />}
                          style={{ filter: isGrayed ? 'grayscale(100%)' : 'none' }}
                        />
                        <span className="selected-item-name" style={{ color: isGrayed ? '#ccc' : 'inherit' }}>
                          {user.username}
                        </span> */}
                         {user.userKey ? <Tag userId={user.userKey} name={user.username} avatar={user.staffAvatarUrl} /> : ""}
                      </div>
                      <Button
                        size="small"
                        type="text"
                        icon={<CloseOutlined />}
                        onClick={() => this.onDelSelectedClick(user, index, "user")}
                        style={{ color: isGrayed ? '#ccc' : 'inherit' }}
                      />
                    </div>
                );
              })}

              {/* 渲染选中的团队 - 确保暂无席位团队排在最后 */}
              {selectedTeams
                .map((team, originalIndex) => {
                  // 计算团队是否为灰色状态（暂无席位权限）
                  const isExceedLimit = uniqueSelectedCount > seatTotal;
                  let currentTotal = selectedUsers.length;
                  // 计算当前团队之前所有团队占用的席位
                  for (let i = 0; i < originalIndex; i++) {
                    const prevTeam = selectedTeams[i];
                    currentTotal += prevTeam.teamMemberVoList?.length || 0;
                  }
                  const isGrayed = isExceedLimit && currentTotal >= seatTotal;
                  return { ...team, isGrayed, originalIndex };
                })
                .sort((a, b) => {
                  // 排序规则：灰色团队（暂无席位）排在最后，其他按原顺序排列
                  if (a.isGrayed && !b.isGrayed) return 1;
                  if (!a.isGrayed && b.isGrayed) return -1;
                  return a.originalIndex - b.originalIndex;
                })
                .map((team, index) => {
                  const isExpanded = expandedTeams[team.staffId] || false;
                  const teamMembers = team.teamMemberVoList || [];
                  const selectedMemberCount = this.state.teamSelectedUserIds[team.staffId]?.length || 0;
                  const totalMemberCount = teamMembers.length;
                return (
                    <Tooltip
                      key={`team-${team.staffId}`}
                      title={team.isGrayed ? "暂无席位权限" : ""}
                      placement="top"
                      trigger="hover"
                    >
                    <div
                      className={`selected-team-container ${team.isGrayed ? 'selected-item-grayed' : ''}`}
                    >
                      <div className="selected-item selected-team">
                        <div className="selected-item-left">
                          <Button
                            type="text"
                            size="small"
                            icon={isExpanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
                            onClick={() => this.toggleTeamExpand(team.staffId)}
                            style={{
                                width: '16px',
                                height: '16px',
                                minWidth: '16px',
                                marginRight: '8px',
                                color: team.isGrayed ? '#C6C6C6' : '#C6C6C6'
                              }}
                          />
                          <Avatar
                            size={20}
                            src={team.staffAvatarUrl}
                            icon={<UserOutlined />}
                            style={{ filter: team.isGrayed ? 'grayscale(100%)' : 'none' }}
                          />
                          <span className="selected-item-name selected-item-team-name" style={{ color: team.isGrayed ? '#ccc' : 'inherit',}} title={team.username}>
                            {team.username || team.userName}
                          </span>
                          <span style={{ color: team.isGrayed ? '#bbb' : '#999'}} className="item-team-member-count">
                              ({totalMemberCount})
                          </span>
                        </div>
                        <Button
                          size="small"
                          type="text"
                          icon={<CloseOutlined />}
                          onClick={() => this.onDelSelectedClick(team, index, "depart")}
                          style={{ color: team.isGrayed ? '#ccc' : 'inherit' }}
                        />
                      </div>

                      {/* 团队成员列表 */}
                      {isExpanded && (
                        <div className="team-members-list">
                          {teamMembers.length > 0 ? (
                            teamMembers.map((member) => {
                              const isMemberSelected = this.state.teamSelectedUserIds[team.staffId]?.includes(member.userKey) || false;
                              return (
                                <Tooltip
                                  key={`member-${member.userKey}`}
                                  //title={team.isGrayed ? "暂无席位权限" : (isMemberSelected ? "已选中" : "未选中")}
                                  title={team.isGrayed ? "暂无席位权限" : ""}
                                  placement="top"
                                  trigger="hover"
                                >
                                  <div
                                    className={`selected-item team-member ${isMemberSelected ? 'selected' : ''}`}
                                    style={{
                                      backgroundColor: isMemberSelected ? (team.isGrayed ? '#f5f5f5' : '#ffffff') : 'transparent',
                                      color: team.isGrayed ? '#ccc' : 'inherit'
                                    }}
                                  >
                                    <div className="selected-item-left">
                                      <Avatar
                                        size={20}
                                        src={member.avatarUrl || 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png'}
                                        icon={<UserOutlined />}
                                        style={{ filter: team.isGrayed ? 'grayscale(100%)' : 'none' }}
                                      />
                                      <span className="selected-item-name">{member.userName || member.userName}</span>
                                    </div>
                                    {/* {isMemberSelected && (
                                      <Button
                                        size="small"
                                        type="text"
                                        icon={<CloseOutlined />}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // 创建虚拟用户对象用于删除
                                          const virtualUser = {
                                            staffId: member.userKey,
                                            username: member.userName,
                                            userKey: member.userKey,
                                            isUser: true
                                          };
                                          this.onDelSelectedClick(virtualUser, index, "user");
                                        }}
                                        style={{ color: isGrayed ? '#ccc' : 'inherit' }}
                                      />
                                    )} */}
                                  </div>
                                </Tooltip>
                              );
                            })
                          ) : (
                            <div className="empty-team-members" style={{ color: isGrayed ? '#ccc' : 'inherit' }}>
                              暂无成员数据
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </Tooltip>
                );
              })}

              {/* 空数据提示 */}
              {!this.state.selectedUsers?.length && !this.state.selectedTeams?.length ? (
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
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default TeamSettings;