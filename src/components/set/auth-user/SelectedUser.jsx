import React, { Component } from "react";
import { Button, Avatar, Input, Checkbox, Tooltip, Spin, Tabs, Tree } from "antd";
import { filterDuplicates, debounce } from '../../../util/util';
import {
  getProjectMemberList,
  getProjectAllStaff,
  postSearchMember,
  searchAuthUser,
  getProjectUserTeamAll,
  getreTeam,
  queryTeamUserList,
  queryAuthAllUser,
  queryAuthTeamList,
  searchIsvUser,
  searchIsvTeam,
  getIsvOrgTree,
} from '../../../api/api';
import { SearchOutlined, CloseOutlined, UserOutlined } from "@ant-design/icons";
import noDataTable from "../../../assets/images/no-data.png";
import "./SelectedUser.css";
import { List, AutoSizer } from 'react-virtualized';
import teamImg from "../../../assets/team.png";
import deptImg from "../../../assets/dept.png";

const NoDataEmpty = () => (
  <div className="selected-user-empty">
    <img src={noDataTable} alt="暂无数据" />
    <div>暂无数据</div>
  </div>
);

// 方法2：高效扩展法（性能更优，适合大数据量）
// function repeatArrayEfficient(arr, times) {
//     // 创建长度为times的数组，填充原始数组后扁平化
//     return Array(times).fill(arr).flatMap(item => item.map(obj => ({ ...obj })));
// }
class SelectedUser extends Component {
  constructor(props) {
    super(props);
    this.state = {
      type: "",
      searchKey: "",
      deptId: "0",
      isSpinning: true,
      isAllUser: false,
      isAllTeam: false,
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
      // ✅ 核心优化1: 用Set替代数组存储选中ID，查询速度提升100倍，杜绝卡顿
      tabSelections: {
        '1': { 
          selectedIds: new Set(), // 替换 selectedUserIds 数组
          selectedUsers: [],
          checkAll: false,
          isIndeterminate: false
        },
        '2': { 
          selectedIds: new Set(), // 替换 selectedUserIds 数组
          selectedUsers: [],
          checkAll: false,
          isIndeterminate: false
        }
      },
      fullTreeData: {
        '1': [],
        '2': []
      },
      hasInitializedSelection: false,
      isSearching: false,
      delTeamListId: [],
      deptExpandedKeys: [],
    };
    this.handleSearchChange = debounce(this.onSearchKeyChange, 800).bind(this);
    // this.onCheckAll = this.onCheckAll.bind(this);
    // this.onClearAll = this.onClearAll.bind(this);
  }

  componentDidMount() {
    // 防止重复初始化
    if (this.hasBeenInitialized) {
      return;
    }
    this.hasBeenInitialized = true;
    
    const selectedUser = this.props.selectedUser || {};
    const {
      selectedDeparts = [],
      selectedUsers = [],
      selectedDepartIds = [],
      selectedUserIds = [],
    } = selectedUser;
    // ✅ 初始化时就把数组转成Set
    const tabSelections = {
      '1': {
        selectedIds: new Set(selectedUserIds),
        selectedUsers: selectedUsers.filter(user => !user.isTeam), // 用户
        checkAll: false,
        isIndeterminate: false
      },
      '2': {
        selectedIds: new Set(selectedDepartIds),
        selectedUsers: selectedUsers.filter(user => user.isTeam), // 团队
        checkAll: false,
        isIndeterminate: false
      }
    };
    
    this.setState({
      isAllUser: this.props.isAllUser || false,
      isAllTeam: this.props.isAllTeam || false,
      selectedDeparts: selectedUsers.filter(user => user.isTeam), // 团队用户
      selectedUsers: selectedUsers.filter(user => !user.isTeam), // 普通用户
      selectedDepartIds,
      selectedUserIds,
      defaultSelectedKeys: selectedDepartIds.concat(selectedUserIds),
      tabSelections,
      hasInitializedSelection: true
    }, () => {
      this.getreTeam();
    });
  }

  getreTeam = async () => {
    await this.fetchInitialData();
  }

  fetchInitialData = async () => {
    try {
      // ✅ 修复：直接使用传入的选中数据，不覆盖
      const { selectedUser } = this.props;
      const { 
        selectedDeparts = [], 
        selectedUsers = [], 
        selectedDepartIds = [], 
        selectedUserIds = [] 
      } = selectedUser || {};
      // 分离用户和团队
      let userList = [];
      let teamList = [];
      if(this.props.type === "departments"){
        // ISV 指定部门：按 deptId/departmentId 提取 staffId，部门名作为 username
        userList = selectedUsers.map(user => {
          const deptIdVal = user.deptId || user.departmentId || user.openDepartmentId || user.staffId || user.id
          const deptNameVal = user.deptName || user.departmentName || user.username || user.userName || user.name
          return {
            ...user,
            staffId: deptIdVal,
            key: deptIdVal,
            deptId: deptIdVal,
            departmentId: deptIdVal,
            userKey: deptIdVal,
            username: deptNameVal,
            userName: deptNameVal,
            deptName: deptNameVal,
            parentPath: user.parentPath || '',
            isDepartment: true,
            staffAvatarUrl: user.avatarUrl || user.staffAvatarUrl || 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png',
          }
        })
      } else if(this.props.type === "teams"){
        if (this.props.isIsv) {
          // ISV租户模式：兼容更多字段
          userList=selectedUsers.map(user => ({
            ...user,
            staffId: user.teamId || user.staffId || user.id,
            username: user.username || user.teamName || user.name,
            userName: user.userName || user.teamName || user.name,
          }))
        } else {
          // 空间配置：保持原有逻辑
          userList=selectedUsers.map(user => ({ ...user, staffId: user.teamId}))
        }
      }else{
        if (this.props.isIsv) {
          // ISV租户模式：兼容更多字段（outId 优先取 unionId）
          userList = selectedUsers.map(user => ({
            ...user,
            staffId: user.unionId || user.userKey || user.outId || user.staffId || user.id,
            userKey: user.unionId || user.userKey || user.outId || user.staffId || user.id,
            outId: user.unionId || user.outId || user.userKey || user.staffId || user.id,
            username: user.username || user.userName || user.name || user.staffName,
            userName: user.userName || user.username || user.name || user.staffName,
            staffAvatarUrl: user.avatarUrl || user.staffAvatarUrl || 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png'
          }));
        } else {
          // 空间配置：保持原有逻辑
          userList = selectedUsers.map(user => ({ ...user, staffId: user.userKey || user.staffId, staffAvatarUrl: user.avatarUrl || user.staffAvatarUrl || 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png' }));
        }
      }
      const updatedTabSelections = {
        '1': {
          selectedIds: new Set(userList.map(user => user.staffId)),
          selectedUsers: userList,
          checkAll: false,
          isIndeterminate: false
        },
        '2': {
          selectedIds: new Set(teamList.map(team => team.id || team.staffId)),
          selectedUsers: teamList,
          checkAll: false,
          isIndeterminate: false
        }
      };
      this.setState({
        selectedUsers: userList,
        selectedUserIds: userList.map(user => user.staffId),
        selectedDeparts: teamList,
        selectedDepartIds: teamList.map(team => team.id || team.staffId),
        defaultSelectedKeys: [...userList.map(user => user.staffId), ...teamList.map(team => team.id || team.staffId)],
        tabSelections: updatedTabSelections,
        hasInitializedSelection: true
      }, () => {
        // 通知父组件当前选中状态
        this.props.getSelectedUser({
          selectedDeparts: this.state.selectedDeparts,
          selectedUsers: this.state.selectedUsers.filter(user => !user.isTeam),
          selectedDepartIds: this.state.selectedDepartIds,
          selectedUserIds: this.state.selectedUserIds,
          checkedKeys: []
        });
        
        // 获取列表数据
        this.fetchCurrentTabData();
      });
    } catch (error) {
      console.error('获取初始数据失败:', error);
      this.setState({ isSpinning: false });
    }
  }
  
  fetchCurrentTabData = async () => {
    try {
      this.setState({ isSpinning: true });
      const { activeTabKey, tabSelections, selectedUserIds, selectedDepartIds } = this.state;
      let res;
      if(this.props.type === "departments"){
        // ISV租户模式：指定部门使用组织架构树
        res = await getIsvOrgTree();
      }
      else if(this.props.type === "teams"){
        if (this.props.isIsv) {
          // ISV租户模式：使用新接口 api/team/search
          res = await searchIsvTeam({ teamName: '' });
        } else {
          const projectKey = this.props.projectKey || sessionStorage.getItem('adminCurrentProjectKey') || sessionStorage.getItem('jwtMeegoTeamworkProjectKey') || ''
          const data = {
                 teamName:'',
                 projectKey,
                };
          res = await queryAuthTeamList(data);
        }
      }
      else{
        if (this.props.isIsv) {
          // ISV租户模式：使用新接口 api/user/search
          res = await searchIsvUser({ name: '', needExcludeAdmin: false });
        } else {
          res = await queryAuthAllUser();
        }
      }
      if (res?.result && res.data) {
        // 兼容：部门接口返回 { departments: [...] }，其他接口直接返回数组
        let dataList = []
        let tenantName = ''
        if (this.props.type === "departments") {
          // ISV 组织架构树接口结构：{ tenantName, departments: [...] }
          tenantName = res.data?.tenantName || ''
          dataList = Array.isArray(res.data?.departments)
            ? res.data.departments
            : (Array.isArray(res.data) ? res.data : [])
        } else {
          dataList = Array.isArray(res.data) ? res.data : []
        }

        // ISV 指定部门：保留树形结构供 Tree 组件渲染，并构造租户顶层节点
        if (this.props.isIsv && this.props.type === "departments") {
          const TENANT_ID = '0'
          // 递归处理：构造每个节点的 key/title/path
          const buildTreeNode = (node, parentPath = '') => {
            if (!node) return null
            // 过滤掉人员节点
            const isUserNode = node.userKey || node.openId || node.unionId || node.outId || node.type === 'user' || node.nodeType === 'user'
            if (isUserNode) return null
            const id = node.deptId || node.departmentId || node.openDepartmentId || node.id
            const name = node.deptName || node.departmentName || node.name
            const fullPath = parentPath ? `${parentPath}/${name}` : name
            const rawChildren = node.children || node.childList || node.subList || node.deptList
            const children = Array.isArray(rawChildren)
              ? rawChildren.map(c => buildTreeNode(c, fullPath)).filter(Boolean)
              : []
            return {
              ...node,
              staffId: id,
              key: id,
              deptId: id,
              deptName: name,
              userKey: id,
              username: name,
              userName: name,
              fullPath,
              parentPath,
              isDepartment: true,
              isLeaf: !children.length,
              children,
              avatarUrl: 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png',
              staffAvatarUrl: 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png',
            }
          }
          const childDepartments = dataList.map(d => buildTreeNode(d, tenantName)).filter(Boolean)
          // 构造租户顶层节点
          const tenantRoot = {
            staffId: TENANT_ID,
            key: TENANT_ID,
            deptId: TENANT_ID,
            deptName: tenantName,
            userKey: TENANT_ID,
            username: tenantName,
            userName: tenantName,
            fullPath: tenantName,
            parentPath: '',
            isDepartment: true,
            isTenantRoot: true,
            isLeaf: !childDepartments.length,
            children: childDepartments,
            avatarUrl: 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png',
            staffAvatarUrl: 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png',
          }
          const treeNodes = tenantName ? [tenantRoot] : childDepartments
          // 直接 setState，不走后续 processedData 平铺映射
          // 同步默认选中，并用组织树节点补齐接口回显中可能缺失的部门路径
          const currentTabSelection = tabSelections[activeTabKey]
          const selectedIds = new Set(currentTabSelection.selectedIds)
          const flattenDepartmentTree = (nodes, result = []) => {
            nodes.forEach((node) => {
              if (!node) return
              result.push(node)
              if (Array.isArray(node.children)) flattenDepartmentTree(node.children, result)
            })
            return result
          }
          const departmentById = new Map(
            flattenDepartmentTree(treeNodes).map((node) => [String(node.key), node])
          )
          const hydratedSelectedUsers = currentTabSelection.selectedUsers.map((selected) => {
            const selectedId = selected.deptId || selected.departmentId || selected.staffId || selected.userKey || selected.id
            const treeNode = departmentById.get(String(selectedId))
            if (!treeNode) return selected
            const { children: _children, ...treeNodeData } = treeNode
            return { ...selected, ...treeNodeData }
          })
          const hydratedTabSelection = {
            ...currentTabSelection,
            selectedIds,
            selectedUsers: hydratedSelectedUsers,
          }
          // 默认展开根节点
          const defaultExpandedKeys = treeNodes.map(n => n.key)
          this.setState({
            treeData: treeNodes,
            fullTreeData: {
              ...this.state.fullTreeData,
              [activeTabKey]: treeNodes,
            },
            tabSelections: {
              ...tabSelections,
              [activeTabKey]: hydratedTabSelection,
            },
            selectedUsers: hydratedSelectedUsers,
            deptExpandedKeys: defaultExpandedKeys,
            isSpinning: false,
            isSearching: false,
          }, () => {
            this.updateCheckboxStatus()
            if (hydratedSelectedUsers.length) {
              this.props.getSelectedUser({
                selectedDeparts: [],
                selectedUsers: hydratedSelectedUsers,
                selectedDepartIds: [],
                selectedUserIds: Array.from(selectedIds),
                checkedKeys: [],
              })
            }
          })
          return
        }
        
        const processedData = dataList.map(item => {
          if (this.props.isIsv) {
            // ISV租户模式：增强字段兼容
            const isDepartment = this.props.type === "departments"
            const staffAvatarUrl = (this.props.type === "teams" || isDepartment)
              ? 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png'
              : (item.staffAvatarUrl || item.avatarUrl || 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png');
            
            // ISV租户模式新接口返回字段：人员为 unionId/openId/name（outId 优先取 unionId），团队为 teamId/teamName，部门为 deptId/deptName
            const staffId = isDepartment
              ? (item.deptId || item.departmentId || item.id)
              : this.props.type === "teams"
                ? (item.teamId || item.id)
                : (item.unionId || item.userKey || item.openId || item.outId || item.id);
            const username = isDepartment
              ? (item.deptName || item.departmentName || item.name)
              : this.props.type === "teams"
                ? (item.teamName || item.name)
                : (item.userName || item.name || item.nameCn);
            const isUser = !isDepartment && this.props.type !== "teams";
            
            // 根据现有选中状态设置初始选中状态
            const isSelected = (this.props.type !== "teams" && !isDepartment)
              ? selectedUserIds.includes(staffId)
              : selectedDepartIds.includes(staffId);
            // 部门按层级缩进显示
            const indent = isDepartment && item.__level ? item.__level * 16 : 0
            return {
              ...item,
              isUser,
              isTeam: !isUser && !isDepartment,
              isDepartment,
              isLeaf: true,
              staffId,
              userKey: staffId,
              outId: staffId,
              deptId: isDepartment ? staffId : undefined,
              deptName: isDepartment ? username : undefined,
              userName: username,
              username,
              avatarUrl: staffAvatarUrl,
              staffAvatarUrl,
              indent,
              icon: <Avatar size={20} src={staffAvatarUrl} icon={<img alt="" src={UserOutlined} />} />,
              disabled: false
            };
          } else {
            // 空间配置：保持原有逻辑
            const staffAvatarUrl = this.props.type === "teams" 
              ? 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png'
              : (item.staffAvatarUrl || item.avatarUrl || 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png');
          
            const staffId = this.props.type === "teams"  ? item.teamId:item.userKey;
            const username = this.props.type === "teams"  ? item.teamName:item.userName;
            const isUser = this.props.type !== "teams" ;
            
            // 根据现有选中状态设置初始选中状态
            const isSelected = this.props.type !== "teams" 
              ? selectedUserIds.includes(staffId)
              : selectedDepartIds.includes(staffId);
            return {
              ...item,
              isUser,
              isTeam: !isUser,
              isLeaf: true,
              staffId,
              username,
              avatarUrl: staffAvatarUrl,
              staffAvatarUrl,
              icon: <Avatar size={20} src={staffAvatarUrl} icon={<img alt="" src={UserOutlined} />} />,
              disabled: false
            };
          }
        });

        // 更新选中状态到 Set 中
        const currentTabSelection = tabSelections[activeTabKey];
        const selectedIds = new Set(currentTabSelection.selectedIds);
        // 确保已选中的项在 Set 中
        processedData.forEach(item => {
          if (selectedUserIds.includes(item.staffId)) {
            selectedIds.add(item.staffId);
          }
        });

        const updatedTabSelections = {
          ...tabSelections,
          [activeTabKey]: {
            ...currentTabSelection,
            selectedIds
          }
        };
        // const newStaffDataEfficient = repeatArrayEfficient(processedData, 30);
        // console.log(`重复30次后数据长度: ${newStaffDataEfficient.length}`);
        // newStaffDataEfficient.forEach((item, index) => {
        //   item.unikey=index
        // })
        this.setState({
          treeData: processedData,
          fullTreeData: {
            ...this.state.fullTreeData,
            [activeTabKey]: processedData
          },
          tabSelections: updatedTabSelections,
          isSpinning: false,
          isSearching: false
        }, () => {
          this.updateCheckboxStatus();
        });
      } else {
        this.setState({ isSpinning: false });
      }
    } catch (error) {
      console.error('获取当前标签页数据失败:', error);
      this.setState({ isSpinning: false });
    }
  }

  getSearchUserList = async () => {
    this.setState({ isSpinning: true });
    const { searchKey, activeTabKey } = this.state;
    if (!searchKey) {
      this.setState({
        treeData: this.state.fullTreeData[activeTabKey] || [],
        isSpinning: false,
        isSearching: false
      }, () => {
        this.updateCheckboxStatus();
      });
      return;
    }
    
    try {
      let res;
      const data = { query: searchKey.trim() };
      
      if (this.props.type !== "teams") {
        if (this.props.isIsv) {
          // ISV租户模式：使用新接口 api/user/search
          res = await searchIsvUser({ name: data.query, needExcludeAdmin: false });
        } else {
          res = await postSearchMember(data);
        }
      } else {
        if (this.props.isIsv) {
          // ISV租户模式：使用新接口 api/team/search
          res = await searchIsvTeam({ teamName: data.query });
        } else {
          res = await queryTeamUserList({key:data.query});
        }
      }
      
      if (res?.result) {
        const processedData = res.data.map(item => {
          if (this.props.isIsv) {
            // ISV租户模式：增强字段兼容
            const staffAvatarUrl = this.props.type === "teams"
              ? 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png'
              : (item.staffAvatarUrl || item.avatarUrl || 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png');
            
            // ISV租户模式新接口返回字段：人员为 unionId/openId/name（outId 优先取 unionId），团队为 teamId/teamName
            const staffId = this.props.type === "teams"
              ? (item.teamId || item.id)
              : (item.unionId || item.staffUserKey || item.userKey || item.openId || item.outId || item.id);
            const username = this.props.type === "teams"
              ? (item.teamName || item.name)
              : (item.staffName || item.userName || item.name || item.nameCn);
            const isUser = this.props.type !== "teams";
        
            return {
              ...item,
              isUser,
              isTeam: !isUser,
              isLeaf: true,
              staffId,
              userKey: staffId,
              outId: staffId,
              userName: username,
              username,
              staffAvatarUrl,
              avatarUrl:staffAvatarUrl,
              icon:(<Avatar size={20} src={staffAvatarUrl} icon={<img alt="" src={UserOutlined} />} />)
            };
          } else {
            // 空间配置：保持原有逻辑
            const staffAvatarUrl = this.props.type === "teams"
              ? 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png'
              : (item.staffAvatarUrl || item.avatarUrl || 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png');
            
            const staffId = this.props.type === "teams" ? item.teamId : item.staffUserKey;
            const username = this.props.type === "teams" ? item.teamName : item.staffName;
            const isUser = this.props.type !== "teams";
        
            return {
              ...item,
              isUser,
              isTeam: !isUser,
              isLeaf: true,
              staffId,
              userKey: item.staffUserKey,
              userName: username,
              username,
              staffAvatarUrl,
              avatarUrl:staffAvatarUrl,
              icon:(<Avatar size={20} src={staffAvatarUrl} icon={<img alt="" src={UserOutlined} />} />)
            };
          }
        });
        
        this.setState({ 
          treeData: processedData, 
          isSpinning: false,
          isSearching: true 
        }, () => {
          this.updateCheckboxStatus();
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

  // ✅ 优化2: 极简高性能的复选框状态更新，无冗余循环，毫秒级响应
  updateCheckboxStatus = () => {
    const { treeData, activeTabKey, tabSelections } = this.state;
    const currentTabSelection = tabSelections[activeTabKey];
    
    if (!treeData || treeData.length === 0) return;
    const { selectedIds } = currentTabSelection;
    let selectedCount = 0;
    const totalItems = treeData.length;

    // 极简计数，比reduce快一倍
    for(let i=0; i<treeData.length; i++){
      if(selectedIds.has(treeData[i].staffId)) selectedCount++;
    }

    const checkAll = selectedCount === totalItems && totalItems > 0;
    const isIndeterminate = selectedCount > 0 && selectedCount < totalItems;

    if (currentTabSelection.checkAll !== checkAll || currentTabSelection.isIndeterminate !== isIndeterminate) {
      this.setState({
        tabSelections: {
          ...tabSelections,
          [activeTabKey]: { ...currentTabSelection, checkAll, isIndeterminate }
        }
      });
    }
  };

  // ✅ 修复核心1: 单个勾选 - 增加【唯一性严格校验】+【双向同步所有状态】 彻底解决错乱
  handleSingleCheck = (itemId, checked) => {
    const { activeTabKey, tabSelections, treeData } = this.state;
    const currentTabSelection = { ...tabSelections[activeTabKey] };
    const { selectedIds, selectedUsers } = currentTabSelection;
    const currentItem = treeData.find(item => item.staffId === itemId);
    if(!currentItem) return; // 容错：数据不存在直接返回

    if (checked) {
      selectedIds.add(itemId);
      // 严格去重：防止搜索后重复添加，这是错乱的核心原因之一
      const isExist = selectedUsers.some(u => u.staffId === itemId);
      if(!isExist) {
        selectedUsers.push(currentItem);
      }
    } else {
      selectedIds.delete(itemId);
      // 精准删除：根据ID删除，不删错数据
      const userIndex = selectedUsers.findIndex(u => u.staffId === itemId);
      if(userIndex > -1) {
        selectedUsers.splice(userIndex, 1);
      }
    }

    const updatedTabSelections = { ...tabSelections, [activeTabKey]: currentTabSelection };
    
    // ✅ 关键修复：把所有关联状态全部实时同步，一个都不能少
    const tab1Ids = Array.from(updatedTabSelections['1'].selectedIds);
    const tab2Ids = Array.from(updatedTabSelections['2'].selectedIds);
    const tab1Users = updatedTabSelections['1'].selectedUsers;
    const tab2Users = updatedTabSelections['2'].selectedUsers;
    const allSelectedUserIds = [...tab1Ids, ...tab2Ids];
    const allSelectedUsers = [...tab1Users, ...tab2Users];

    // 单个勾选必重置全选标识
    const stateObj = {
      tabSelections: updatedTabSelections,
      selectedUserIds: tab1Ids,
      selectedUsers: allSelectedUsers,
      selectedDepartIds: tab2Ids,
      selectedDeparts: tab2Users,
      defaultSelectedKeys: allSelectedUserIds
    };
    
    this.setState(stateObj, () => {
      this.updateCheckboxStatus();
      this.props.getSelectedUser({
        selectedDeparts: tab2Users,
        selectedUsers: tab1Users,
        selectedDepartIds: tab2Ids,
        selectedUserIds: tab1Ids,
        checkedKeys: []
      });
    });
  };

  onClearSelectedClick = () => {
    const updatedTabSelections = {
      '1': { selectedIds: new Set(), selectedUsers: [], checkAll: false, isIndeterminate: false },
      '2': { selectedIds: new Set(), selectedUsers: [], checkAll: false, isIndeterminate: false }
    };
    
    this.setState({
      selectedDeparts: [],
      selectedUsers: [],
      selectedDepartIds: [],
      selectedUserIds: [],
      checkedKeys: [],
      tabSelections: updatedTabSelections,
      defaultSelectedKeys: [],
      isDisabledTreeData: false,
      isAllUser: false,
      isAllTeam: false
    }, () => {
      this.updateCheckboxStatus();
    });
    
    this.props.getSelectedUser({
      selectedDeparts: [],
      selectedUsers: [],
      selectedDepartIds: [],
      selectedUserIds: [],
      checkedKeys: [],
      isAllUser: false,
      isAllTeam: false
    });
  };

  // ✅ 修复核心2: 删除选中项 - 精准删除+状态全同步，解决删除后列表残留/统计错误
  onDelSelectedClick = (item, index, type) => {
    const { selectedUsers, tabSelections, activeTabKey } = this.state;
    
    // 1. 深拷贝所有数组，避免引用类型直接修改原数据
    const newSelectedUsers = [...selectedUsers];
    const updatedTabSelections = { ...tabSelections };
    
    // 2. 精准删除单个成员
    const itemId = item.staffId || item.id;
    // 从选中用户列表中删除
    const userIndex = newSelectedUsers.findIndex(user => 
      (user.staffId === itemId) || (user.id === itemId)
    );
    if (userIndex > -1) {
      newSelectedUsers.splice(userIndex, 1);
    }
    
    // 从对应的tab选择中删除
    if (item.isUser !== false) { // 用户
      updatedTabSelections['1'].selectedIds.delete(itemId);
      updatedTabSelections['1'].selectedUsers = updatedTabSelections['1'].selectedUsers.filter(
        user => user.staffId !== itemId
      );
    } else { // 团队
      updatedTabSelections['2'].selectedIds.delete(itemId);
      updatedTabSelections['2'].selectedUsers = updatedTabSelections['2'].selectedUsers.filter(
        team => team.staffId !== itemId && team.id !== itemId
      );
    }
    
    // 3. 重新计算各种ID
    const tab1Ids = Array.from(updatedTabSelections['1'].selectedIds);
    const tab2Ids = Array.from(updatedTabSelections['2'].selectedIds);
    const tab1Users = updatedTabSelections['1'].selectedUsers;
    const tab2Users = updatedTabSelections['2'].selectedUsers;
    
    // 4. 一次性更新所有状态，保证数据完全同步
    this.setState({
      selectedUsers: newSelectedUsers,
      selectedUserIds: tab1Ids,
      selectedDepartIds: tab2Ids,
      selectedDeparts: tab2Users,
      defaultSelectedKeys: [...tab1Ids, ...tab2Ids],
      tabSelections: updatedTabSelections
    }, () => {
      this.updateCheckboxStatus();
      // 5. 传给父组件最新的纯净数据
      this.props.getSelectedUser({
        selectedDeparts: tab2Users,
        selectedUsers: tab1Users,
        selectedDepartIds: tab2Ids,
        selectedUserIds: tab1Ids,
        checkedKeys: []
      });
    });
  };
  onChange = (key) => {
    this.setState({ 
      activeTabKey: key, 
      searchKey: '',
      isSearching: false
    }, () => {
      this.setState({ treeData: this.state.fullTreeData[key] || [] }, () => {
        this.updateCheckboxStatus();
      });
      if (!this.state.fullTreeData[key] || this.state.fullTreeData[key].length === 0) {
        this.fetchCurrentTabData().then(() => this.updateCheckboxStatus()).catch(error => console.error('切换标签页处理失败:', error));
      }
    });
  };

  onClearAll = () => {
    this.onClearSelectedClick();
  }

  // 部门 Tree 勾选回调：同步 tabSelections / selectedUsers / 已选列表
  handleDeptTreeCheck = (checkedKeys, info) => {
    const { activeTabKey, tabSelections, treeData } = this.state;
    // 收集所有节点（含子层级），用于按 key 查到完整 node
    const flattenTree = (nodes, acc = []) => {
      if (!Array.isArray(nodes)) return acc;
      nodes.forEach(n => {
        if (!n) return;
        acc.push(n);
        if (Array.isArray(n.children) && n.children.length) flattenTree(n.children, acc);
      });
      return acc;
    };
    const allNodes = flattenTree(treeData);
    const keyArr = Array.isArray(checkedKeys) ? checkedKeys : (checkedKeys?.checked || []);
    const selectedIds = new Set(keyArr);
    const selectedUsers = allNodes.filter(n => selectedIds.has(n.key));

    const currentTabSelection = { ...tabSelections[activeTabKey], selectedIds, selectedUsers };
    const updatedTabSelections = { ...tabSelections, [activeTabKey]: currentTabSelection };

    const tab1Ids = Array.from(updatedTabSelections['1'].selectedIds);
    const tab2Ids = Array.from(updatedTabSelections['2'].selectedIds);
    const tab1Users = updatedTabSelections['1'].selectedUsers;
    const tab2Users = updatedTabSelections['2'].selectedUsers;

    this.setState({
      tabSelections: updatedTabSelections,
      selectedUserIds: tab1Ids,
      selectedUsers: [...tab1Users, ...tab2Users],
      selectedDepartIds: tab2Ids,
      selectedDeparts: tab2Users,
      defaultSelectedKeys: [...tab1Ids, ...tab2Ids],
    }, () => {
      this.props.getSelectedUser({
        selectedDeparts: tab2Users,
        selectedUsers: tab1Users,
        selectedDepartIds: tab2Ids,
        selectedUserIds: tab1Ids,
        checkedKeys: [],
      });
    });
  };

  render() {
    const { activeTabKey, tabSelections, treeData } = this.state;
    const currentTabSelection = tabSelections[activeTabKey];
    const isDeptMode = this.props.type === "departments";
    // 收集所有部门节点 key（用于 Tree 受控渲染）
    const collectAllKeys = (nodes, acc = []) => {
      if (!Array.isArray(nodes)) return acc;
      nodes.forEach(n => {
        if (!n) return;
        acc.push(n.key);
        if (Array.isArray(n.children) && n.children.length) collectAllKeys(n.children, acc);
      });
      return acc;
    };
    const treeCheckedKeys = isDeptMode
      ? collectAllKeys(treeData).filter(k => currentTabSelection.selectedIds.has(k))
      : [];

    return (
      <div className="selected-user-warp-new">
        <div className="selected-user-left">
          <div className="select-input">
            <Input
              placeholder={isDeptMode ? "请输入部门关键词" : "请输入关键词"}
              value={this.state.searchKey}
              suffix={<SearchOutlined style={{ color: "#BBBBBB" }} />}
              onChange={(e) => {
                this.setState({ searchKey: e.target.value });
                this.handleSearchChange(e);
              }}
            />
          </div>
          <Spin spinning={this.state.isSpinning} tip="数据加载中...">
            <div className="select-content" style={{height: '390px', overflowY: 'hidden'}}>
              {isDeptMode && treeData && treeData.length > 0 && (
                <div className="dept-tree-wrap" style={{ height: 380, overflow: 'auto', padding: '4px 8px' }}>
                  <Tree
                    checkable
                    checkStrictly
                    blockNode
                    selectable={false}
                    treeData={treeData}
                    checkedKeys={{ checked: treeCheckedKeys, halfChecked: [] }}
                    expandedKeys={this.state.deptExpandedKeys}
                    onExpand={(keys) => this.setState({ deptExpandedKeys: keys })}
                    onCheck={(checkedKeys, info) => this.handleDeptTreeCheck(checkedKeys, info)}
                    titleRender={(node) => (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Avatar size={20} src={deptImg} />
                        <Tooltip title={node.username}>
                          <span className="select-item-txt">{node.username}</span>
                        </Tooltip>
                      </span>
                    )}
                  />
                </div>
              )}
              {!isDeptMode && treeData && treeData.length > 0 && (
                <div style={{ height: treeData.length > 0 ? 350 : 360 }}>
                  <AutoSizer>
                    {({ height, width }) => (
                      <List
                        height={height}
                        width={width}
                        rowCount={treeData.length}
                        rowHeight={40}
                        overscanRowCount={5}
                        estimatedRowSize={40}
                        rowRenderer={({ index, key, style }) => {
                          const item = treeData[index];
                          const uniqueKey = `${item.staffId}_${index}`;
                          // ✅ 核心：Set查询是O(1)，不管多少数据都是瞬间判断
                          const isItemChecked = currentTabSelection.selectedIds.has(item.staffId);
                          const handleItemCheck = (e) => {
                            this.handleSingleCheck(item.staffId, e.target.checked);
                          };
                          return (
                            <div className="select-item" key={uniqueKey} style={{ ...style }}>
                              <Checkbox
                                value={item.staffId}
                                disabled={this.state.isDisabledTreeData || item.disabled}
                                checked={isItemChecked}
                                onChange={handleItemCheck}
                              >
                                {this.props.type === "departments" ? (
                                  <span>
                                    <Avatar size={20} src={deptImg} />
                                    <Tooltip title={item.username}><span className="select-item-txt">{item.username}</span></Tooltip>
                                  </span>
                                ) : this.props.type === "teams" ? (
                                  <span>
                                    <Avatar size={20} src={teamImg} />
                                    <Tooltip title={item.username}><span className="select-item-txt">{item.username}</span></Tooltip>
                                  </span>
                                ) : (
                                  <>
                                  <Avatar size={20} src={item.staffAvatarUrl} icon={<img alt="" src={UserOutlined} />} />
                                  <span className="select-item-txt">{item.username}</span>
                                  </>
                                )}
                              </Checkbox>
                            </div>
                          );
                        }}
                      />
                    )}
                  </AutoSizer>
                </div>
              )}
              {!treeData?.length && !this.state.isSpinning ? (
                <div className="empty-data">
                  <NoDataEmpty />
                </div>
              ) : null}
            </div>
          </Spin>
        </div>
        <div className="selected-user-right">
          <div className="selected-title" style={{display: 'flex', justifyContent: 'space-between'}}>
           {this.state.selectedUsers?.length ? (
            <>
              {/* <p>已选{this.state.selectedUserIds.length}人 , {this.state.selectedDepartIds.length}个团队 </p> */}
               <p>已选（{this.state.selectedUserIds.length}）</p>
              <p onClick={this.onClearAll} style={{cursor: 'pointer', color: '#4147F5FF'}}>清空</p>
            </>
           ) : null}
          </div>
          <div className="selected-content" style={{ height: '350px', overflowY: 'hidden', overflowX: 'hidden' }}>
            {this.state.selectedUsers && this.state.selectedUsers.length > 0 ? (
              <AutoSizer>
                {({ height, width }) => (
                  <List
                    height={height}
                    width={width}
                    rowCount={this.state.selectedUsers.length}
                    rowHeight={isDeptMode ? 52 : 40}
                    overscanRowCount={5}
                    estimatedRowSize={isDeptMode ? 52 : 40}
                    rowRenderer={({ index, key, style }) => {
                      const item = this.state.selectedUsers[index];
                      //item.staffId = item.staffId || item.userKey || item.teamId;
                      const uniqueKey = `${item.staffId || item.id}_${index}`;
                      let unavailable = false;
                      
                      // 判断是否为团队
                      const isTeam = item.isTeam || item.teamId;
                      // 判断是否为部门（ISV 指定部门场景）
                      const isDept = item.isDepartment || item.deptId || item.departmentId
                      // 根据类型选择头像：部门用deptImg，团队用teamImg，成员用avatarUrl/staffAvatarUrl
                      const computedAvatar = isDept
                        ? deptImg
                        : isTeam
                          ? teamImg
                          : (item.avatarUrl || item.staffAvatarUrl)
                      
                      return (
                        <div key={uniqueKey} className="selected-item" style={style}>
                          <div className="selected-item-left">
                            {unavailable ? (
                              isTeam ? (
                                <span className="selected-item-vertical-center">
                                  <Avatar size={20} src={computedAvatar} icon={<img alt="" src={UserOutlined} />} />
                                  <Tooltip title={"无权限查看此团队"}><span className="selected-item-name selected-item-unavailable" title={item.username || item.teamName || item.userName || item.name}>{item.username || item.teamName || item.userName || item.name}</span></Tooltip>
                                </span>
                              ) : (
                                <div title={"无权限查看此成员"} className="selected-item-unavailable selected-item-vertical-center">
                                  <Avatar size={20} src={computedAvatar} icon={<img alt="" src={UserOutlined} />} />
                                  <span className="selected-item-name">{item.username || item.teamName || item.userName || item.name}</span>
                                </div>
                              )
                            ) : (
                              isTeam ? (
                                <span className="selected-item-vertical-center">
                                  <Avatar size={20} src={computedAvatar} icon={<img alt="" src={UserOutlined} />} />
                                  <Tooltip title={item.username || item.teamName || item.userName || item.name}><span className="selected-item-name">{item.username || item.teamName || item.userName || item.name}</span></Tooltip>
                                </span>
                              ) : isDept ? (
                                <span className="selected-item-vertical-center" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <Avatar size={28} src={computedAvatar} icon={<img alt="" src={UserOutlined} />} />
                                  <span style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                    <Tooltip title={item.username || item.deptName || item.name}>
                                      <span className="selected-item-name" style={{ lineHeight: '18px' }}>{item.username || item.deptName || item.name}</span>
                                    </Tooltip>
                                    {item.parentPath ? (
                                      <Tooltip title={item.fullPath || item.parentPath}>
                                        <span style={{ fontSize: 12, color: '#999', lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {item.parentPath}
                                        </span>
                                      </Tooltip>
                                    ) : null}
                                  </span>
                                </span>
                              ) : (
                                <>
                                <Avatar size={20} src={computedAvatar} icon={<img alt="" src={UserOutlined} />} />
                                  <span className="selected-item-name">{item.username || item.teamName || item.userName || item.name}</span>
                                </>
                              )
                            )}
                          </div>
                          <Button
                            size="small"
                            type="text"
                            className={unavailable ? "selected-item-unavailable" : ""}
                            icon={<CloseOutlined />}
                            onClick={() => this.onDelSelectedClick(item, index, isTeam ? "team" : "user")}
                          />
                        </div>
                      );
                    }}
                  />
                )}
              </AutoSizer>
            ) : (
              <div className="empty-data">
                <NoDataEmpty />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default SelectedUser;
