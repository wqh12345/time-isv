import React, { Component } from "react";
import { Avatar, Checkbox, Spin, Empty } from "antd";
import { TeamOutlined, CaretRightOutlined, CaretDownOutlined } from "@ant-design/icons";
import { List, AutoSizer } from 'react-virtualized';
import { UserTag } from '../user-tag/UserTag';
import noDataTable from "../../assets/images/no-data-table.png";
import deptImg from "../../assets/dept.png";
// import {
//   getDeptTreeData,
// } from "../../api/api";
// 临时导入本地JSON数据，替代API调用用于开发测试
// import LOCAL_DEPT_DATA from "./format.1779864726923.json";
import "./DepartmentTree.css";

// 默认头像常量
const DEFAULT_AVATAR = deptImg;

// ============ Mock 数据开关 ============
const USE_MOCK_DEPT = false;

// ============ Mock 部门数据 ============
const MOCK_DEPT_ROOTS = [
  { deptId: '1001', deptName: '星辰大海', parentPath: '', hasChildren: true }
];

const MOCK_DEPT_CHILDREN = {
  '1001': {
    childDepts: [
      { deptId: '100101', deptName: '测试', parentPath: '星辰大海', hasChildren: true },
      { deptId: '100102', deptName: '开发', parentPath: '星辰大海', hasChildren: true },
      { deptId: '100103', deptName: '新建部门', parentPath: '星辰大海', hasChildren: false },
    ],
    members: [
      { staffId: 'u1001', staffName: '测试052205', staffAvatarUrl: '', staffUserKey: 'u1001' },
      { staffId: 'u1002', staffName: '测试052204', staffAvatarUrl: '', staffUserKey: 'u1002' },
      { staffId: 'u1003', staffName: '李静芝', staffAvatarUrl: '', staffUserKey: 'u1003' },
      { staffId: 'u1004', staffName: '梁栩源', staffAvatarUrl: '', staffUserKey: 'u1004' },
    ]
  },
  '100101': {
    childDepts: [],
    members: [
      { staffId: 'u2001', staffName: '张炉飞', staffAvatarUrl: '', staffUserKey: 'u2001' },
      { staffId: 'u2002', staffName: '刘勇华', staffAvatarUrl: '', staffUserKey: 'u2002' },
    ]
  },
  '100102': {
    childDepts: [
      { deptId: '10010201', deptName: '后端开发', parentPath: '星辰大海/开发', hasChildren: false },
      { deptId: '10010202', deptName: '前端开发', parentPath: '星辰大海/开发', hasChildren: false },
    ],
    members: [
      { staffId: 'u3001', staffName: '赵鲁康', staffAvatarUrl: '', staffUserKey: 'u3001' },
      { staffId: 'u3002', staffName: '刘飞', staffAvatarUrl: '', staffUserKey: 'u3002' },
      { staffId: 'u3003', staffName: '陈丽晴', staffAvatarUrl: '', staffUserKey: 'u3003' },
    ]
  },
  '100103': {
    childDepts: [],
    members: [
      { staffId: 'u4001', staffName: '李杰', staffAvatarUrl: '', staffUserKey: 'u4001' },
    ]
  },
  '10010201': {
    childDepts: [],
    members: [
      { staffId: 'u5001', staffName: '王小明', staffAvatarUrl: '', staffUserKey: 'u5001' },
      { staffId: 'u5002', staffName: '张三', staffAvatarUrl: '', staffUserKey: 'u5002' },
    ]
  },
  '10010202': {
    childDepts: [],
    members: [
      { staffId: 'u6001', staffName: '李四', staffAvatarUrl: '', staffUserKey: 'u6001' },
      { staffId: 'u6002', staffName: '王五', staffAvatarUrl: '', staffUserKey: 'u6002' },
    ]
  }
};

// ============ API 数据规范化 ============
// 将API返回的部门树数据递归解析为组件内部格式
const normalizeDeptNode = (apiDept) => {
  const deptId = apiDept.departmentId || apiDept.deptId;
  const deptName = apiDept.name || apiDept.deptName;
  const childDepts = (apiDept.children || []).map(child => normalizeDeptNode(child));
  const members = (apiDept.users || apiDept.members || []).map(user => ({
    outId: user.unionId || user.userKey,
    staffId: user.userKey || user.openId || user.staffId,
    staffUserKey: user.userKey || user.openId || user.staffUserKey,
    staffName: user.name || user.staffName || user.userName || '',
    staffAvatarUrl: user.avatar || user.staffAvatarUrl || DEFAULT_AVATAR,
  }));
  const hasChildren = childDepts.length > 0 || members.length > 0;

  return {
    deptId,
    deptName,
    hasChildren,
    parentPath: apiDept.parentDepartmentId || apiDept.parentPath || '',
    childDepts,
    members,
  };
};

// 递归构建 deptChildrenCache 和 deptRoots
const buildCacheFromNormalizedTree = (normalizedDepts) => {
  const cache = {};
  const traverse = (deptList) => {
    deptList.forEach(dept => {
      cache[dept.deptId] = {
        childDepts: dept.childDepts.map(child => ({
          deptId: child.deptId,
          deptName: child.deptName,
          hasChildren: child.hasChildren,
          parentPath: child.parentPath,
        })),
        members: dept.members,
        loaded: true,
      };
      if (dept.childDepts.length > 0) {
        traverse(dept.childDepts);
      }
    });
  };
  traverse(normalizedDepts);
  return cache;
};

// 预构建全局成员-部门索引（从规范化数据中构建）
const buildMemberDeptIndexFromCache = (cache) => {
  const index = new Map();
  Object.entries(cache).forEach(([deptId, data]) => {
    const members = Array.isArray(data.members) ? data.members : [];
    members.forEach(m => {
      // 统一使用 staffUserKey（即 userKey）作为成员标识
      const userKey = m.staffUserKey || m.staffId;
      if (userKey) {
        const deptSet = index.get(userKey) || new Set();
        deptSet.add(String(deptId));
        index.set(userKey, deptSet);
      }
    });
  });
  return index;
};

const GLOBAL_MEMBER_DEPT_INDEX = USE_MOCK_DEPT ? (() => {
  const cache = {};
  Object.entries(MOCK_DEPT_CHILDREN).forEach(([deptId, mockData]) => {
    cache[deptId] = {
      childDepts: mockData.childDepts || [],
      members: mockData.members || [],
      loaded: true,
    };
  });
  return buildMemberDeptIndexFromCache(cache);
})() : new Map(); // 真实模式在loadDeptRoot中动态构建

/**
 * DepartmentTree 部门树公共组件
 * 
 * Props:
 * - deptTreeData: Array - 外部传入的部门树数据（API原始格式，与getDeptTreeData返回的data一致）
 * - deptTreeLoading: boolean - 外部数据是否正在加载
 * - selectedMemberIds: Set<string> - 已选中的成员ID集合
 * - onMemberCheck: (staffId, checked, memberItem) => void - 成员勾选回调
 * - onSelectAllMembers: (deptId, members, checked) => void - 全选某部门下员工回调
 * - searchKey: string - 搜索关键词
 * - isSearching: boolean - 是否处于搜索状态
 * - isSpinning: boolean - 外部控制loading(可选)
 * - disabled: boolean - 是否禁用
 */
class DepartmentTree extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isSpinning: true,
      expandedDeptIds: new Set(),
      deptChildrenCache: {},
      deptRoots: [], // 根节点列表（规范化后的内部格式）
      flattenedRows: [],
      searchResults: [],
    };
    this.listRef = React.createRef();
    this.searchListRef = React.createRef();
    this.memberDeptIndex = GLOBAL_MEMBER_DEPT_INDEX;
  }

  componentDidMount() {
    if (this.props.deptTreeData && (Array.isArray(this.props.deptTreeData) ? this.props.deptTreeData.length > 0 : typeof this.props.deptTreeData === 'object')) {
      const transformedData = this.transformData(this.props.deptTreeData);
      this.processDeptTreeData(transformedData);
    } else if (!this.props.deptTreeLoading) {
      this.loadDeptRoot();
    }
    // 若deptTreeLoading为true，等待componentDidUpdate中处理
  }

  componentDidUpdate(prevProps) {
    // 监听外部传入的部门树数据变化
    if (prevProps.deptTreeData !== this.props.deptTreeData) {
      const newData = this.props.deptTreeData;
      if (newData && (Array.isArray(newData) ? newData.length > 0 : typeof newData === 'object')) {
        const transformedData = this.transformData(newData);
        this.processDeptTreeData(transformedData);
      } else if (newData && Array.isArray(newData) && newData.length === 0) {
        // 空数据，结束加载状态
        this.setState({ isSpinning: false });
      }
    }

    if (prevProps.searchKey !== this.props.searchKey) {
      if (this.props.searchKey) {
        this.searchMembers(this.props.searchKey);
      } else {
        this.setState({ searchResults: [] }, () => {
          this.rebuildFlattenedRows();
        });
      }
    }

    // 当选中成员集合变化时，直接强制刷新虚拟列表中的复选框状态
    // 不改变List key（会导致组件卸载/重新挂载、丢失滚动位置）
    if (prevProps.selectedMemberIds !== this.props.selectedMemberIds) {
      if (this.listRef.current) {
        this.listRef.current.forceUpdateGrid();
      }
      if (this.searchListRef.current) {
        this.searchListRef.current.forceUpdateGrid();
      }
    }
  }
  transformData(obj) {
    const { tenantName, departments, rootUsers } = obj;
    const root = {
        departmentId: "0",
        openDepartmentId: "0",
        name: tenantName,
        parentDepartmentId: null,
        leaderUserId: null,
        orderNum: 0,
        children: departments,   // 直接引用，不深拷贝
        users: rootUsers         // 直接引用
    };
    obj = [root];           // 覆盖原 data
    return obj;
}
  // ==================== 数据加载 ====================

  /**
   * 处理外部传入的部门树数据（API原始格式）
   * 将嵌套树形数据递归规范化为组件内部格式，构建缓存和索引
   */
  processDeptTreeData = (apiData) => {

    try {
      this.setState({ isSpinning: true });
      
      // 将API返回的嵌套树形数据递归规范化为组件内部格式
      const normalizedRoots = apiData.map(dept => normalizeDeptNode(dept));
      const deptChildrenCache = buildCacheFromNormalizedTree(normalizedRoots);
      
      // 自动展开第一层
      const expandedDeptIds = new Set();
      normalizedRoots.forEach(root => {
        expandedDeptIds.add(root.deptId);
      });
      
      // 重建成员-部门索引
      this.memberDeptIndex = buildMemberDeptIndexFromCache(deptChildrenCache);
      
      this.setState({ 
        deptChildrenCache, 
        deptRoots: normalizedRoots,
        expandedDeptIds, 
        isSpinning: false 
      }, () => {
        this.rebuildFlattenedRows();
      });
    } catch (error) {
      console.error('处理部门树数据失败:', error);
      this.setState({ isSpinning: false });
    }
  };

  loadDeptRoot = async () => {
    try {
      this.setState({ isSpinning: true });
      if (this.props.deptTreeData) {
        const newTreeData = this.transformData(this.props.deptTreeData);
        this.processDeptTreeData(newTreeData);
      } else {
        // 备用：加载本地JSON数据
        const apiData = LOCAL_DEPT_DATA.data || [];
        this.processDeptTreeData(apiData);
      }
    } catch (error) {
      console.error('加载部门根节点失败:', error);
      this.setState({ isSpinning: false });
    }
  }

  loadDeptChildren = async (deptId) => {
    const { deptChildrenCache } = this.state;
    // 真实API模式下所有数据已在loadDeptRoot中一次性加载完毕，无需再请求
    if (deptChildrenCache[deptId]?.loaded) return;
    
    try {
      if (USE_MOCK_DEPT) {
        await new Promise(resolve => setTimeout(resolve, 150));
        const mockData = MOCK_DEPT_CHILDREN[deptId] || { childDepts: [], members: [] };
        const newCache = {
          ...this.state.deptChildrenCache,
          [deptId]: { ...mockData, loaded: true }
        };
        this.setState({ deptChildrenCache: newCache }, () => {
          this.rebuildFlattenedRows();
        });
        return;
      }
      
      // 真实API模式下所有数据已在loadDeptRoot中一次性加载，此处不再需要调用getDeptTreeChildren
      // 如果缓存中没有数据，说明该部门确实没有子内容
    } catch (error) {
      console.error('加载部门子节点失败:', error);
    }
  }

  // ==================== 搜索 ====================
  searchMembers = async (keyword) => {
    if (!keyword || !keyword.trim()) {
      this.setState({ searchResults: [] }, () => this.rebuildFlattenedRows());
      return;
    }
    
    try {
      this.setState({ isSpinning: true });
      if (USE_MOCK_DEPT) {
        await new Promise(resolve => setTimeout(resolve, 200));
        const allMembers = [];
        const collectMembers = (data) => {
          if (data.members) {
            data.members.forEach(m => {
              if (m.staffName.toLowerCase().includes(keyword.toLowerCase())) {
                allMembers.push(m);
              }
            });
          }
        };
        Object.values(MOCK_DEPT_CHILDREN).forEach(collectMembers);
        
        this.setState({ 
          searchResults: allMembers, 
          isSpinning: false 
        });
        return;
      }
      
      // 真实API模式：从预加载的缓存中搜索成员
      const allMembers = [];
      const kw = keyword.trim().toLowerCase();
      Object.values(this.state.deptChildrenCache).forEach(cache => {
        if (cache.members) {
          cache.members.forEach(m => {
            const name = m.staffName || m.name || '';
            if (name.toLowerCase().includes(kw)) {
              allMembers.push(m);
            }
          });
        }
      });
      this.setState({ 
        searchResults: allMembers, 
        isSpinning: false 
      });
    } catch (error) {
      console.error('搜索成员失败:', error);
      this.setState({ isSpinning: false });
    }
  }

  // ==================== 展开/收起 ====================
  toggleExpand = async (deptId) => {
    const { expandedDeptIds, deptChildrenCache } = this.state;
    const newExpanded = new Set(expandedDeptIds);
    
    if (newExpanded.has(deptId)) {
      newExpanded.delete(deptId);
      this.setState({ expandedDeptIds: newExpanded }, () => {
        this.rebuildFlattenedRows();
      });
    } else {
      newExpanded.add(deptId);
      this.setState({ expandedDeptIds: newExpanded }, async () => {
        if (!deptChildrenCache[deptId]?.loaded) {
          await this.loadDeptChildren(deptId);
        } else {
          this.rebuildFlattenedRows();
        }
      });
    }
  }

  // ==================== 构建扁平化行数据 ====================
  rebuildFlattenedRows = () => {
    const { expandedDeptIds, deptChildrenCache } = this.state;
    const rows = [];
    
    const roots = USE_MOCK_DEPT ? MOCK_DEPT_ROOTS : this.state.deptRoots;
    
    const buildRows = (deptList, level) => {
      deptList.forEach(dept => {
        const deptId = dept.deptId;
        const isExpanded = expandedDeptIds.has(deptId);
        
        // 添加部门行
        rows.push({
          type: 'dept',
          deptId,
          deptName: dept.deptName,
          hasChildren: dept.hasChildren !== false,
          level,
          isExpanded,
          data: dept
        });
        
        // 如果展开了，添加子节点
        if (isExpanded && deptChildrenCache[deptId]?.loaded) {
          const cache = deptChildrenCache[deptId];
          
          // 子部门
          if (cache.childDepts && cache.childDepts.length > 0) {
            buildRows(cache.childDepts, level + 1);
          }
          
          // 成员（带"全选以下员工"标头）
          if (cache.members && cache.members.length > 0) {
            rows.push({
              type: 'selectAll',
              deptId,
              level: level + 1,
              members: cache.members
            });
            cache.members.forEach(member => {
              rows.push({
                type: 'member',
                staffId: member.staffId || member.staffUserKey,
                staffUserKey: member.staffUserKey || member.staffId,
                staffName: member.staffName,
                staffAvatarUrl: member.staffAvatarUrl || DEFAULT_AVATAR,
                level: level + 1,
                deptId,
                data: member
              });
            });
          }
        }
      });
    };
    
    buildRows(roots, 0);
    this.setState({ flattenedRows: rows });
  }

  // ==================== 选中状态计算 ====================
  getDeptMemberCheckState = (deptId) => {
    const { deptChildrenCache } = this.state;
    const { selectedMemberIds } = this.props;
    const cache = deptChildrenCache[deptId];
    
    if (!cache?.loaded || !cache.members || cache.members.length === 0) {
      return { checked: false, indeterminate: false };
    }
    
    const members = cache.members;
    let selectedCount = 0;
    
    members.forEach(m => {
      // 统一使用 staffUserKey（即 userKey）作为成员标识
      const userKey = m.staffUserKey || m.staffId;
      if (selectedMemberIds.has(userKey)) {
        selectedCount++;
      }
    });
    
    if (selectedCount === 0) {
      return { checked: false, indeterminate: false };
    } else if (selectedCount === members.length) {
      return { checked: true, indeterminate: false };
    } else {
      return { checked: false, indeterminate: true };
    }
  }

  // ==================== 事件处理 ====================
  handleMemberCheck = (member, checked) => {
    // 统一使用 staffUserKey（即 userKey）作为成员标识
    const userKey = member.staffUserKey || member.staffId;
    if (this.props.onMemberCheck) {
      this.props.onMemberCheck(userKey, checked, member);
    }
  }

  handleSelectAllMembers = (deptId, members, checked) => {
    if (this.props.onSelectAllMembers) {
      this.props.onSelectAllMembers(deptId, members, checked);
    }
  }

  // ==================== 渲染 ====================
  renderSearchResults = () => {
    const { searchResults } = this.state;
    const { selectedMemberIds, disabled } = this.props;
    
    if (!searchResults || searchResults.length === 0) {
      return (
        <div className="dept-tree-empty">
          <Empty
            image={noDataTable}
            styles={{ image: { height: 90, width: 90, margin: "auto", marginBottom: 10 } }}
            description={<span style={{ color: "#727272", fontSize: "12px" }}>暂无数据</span>}
          />
        </div>
      );
    }
    
    return (
      <div className="dept-tree-search-results" style={{ height: '100%' }}>
        <AutoSizer>
          {({ height, width }) => (
            <List
              ref={this.searchListRef}
              key="dept-search"
              height={height}
              width={width}
              rowCount={searchResults.length}
              rowHeight={40}
              overscanRowCount={5}
              rowRenderer={({ index, key, style }) => {
                const member = searchResults[index];
                // 统一使用 staffUserKey（即 userKey）作为成员标识
                const userKey = member.staffUserKey || member.staffId;
                const isChecked = selectedMemberIds.has(userKey);
                
                return (
                  <div key={key} className="dept-tree-member-row" style={style}>
                    <Checkbox
                      checked={isChecked}
                      disabled={disabled}
                      onChange={(e) => this.handleMemberCheck(member, e.target.checked)}
                    >
                      <UserTag 
                        userId={member.staffUserKey || member.staffId} 
                        name={member.staffName} 
                        avatar={member.staffAvatarUrl || DEFAULT_AVATAR} 
                      />
                    </Checkbox>
                  </div>
                );
              }}
            />
          )}
        </AutoSizer>
      </div>
    );
  }

  renderVirtualRow = ({ index, key, style }) => {
    const { flattenedRows } = this.state;
    const { selectedMemberIds, disabled } = this.props;
    const row = flattenedRows[index];
    if (!row) return null;
    
    const indent = row.level * 20;
    
    if (row.type === 'dept') {
      const hasContent = row.hasChildren || 
        (this.state.deptChildrenCache[row.deptId]?.members?.length > 0);
      
      return (
        <div 
          key={key} 
          className="dept-tree-dept-row" 
          style={{ ...style, paddingLeft: `${16 + indent}px` }}
        >
          <span 
            className="dept-tree-expand-icon" 
            onClick={() => hasContent && this.toggleExpand(row.deptId)}
          >
            {hasContent ? (
              row.isExpanded ? <CaretDownOutlined /> : <CaretRightOutlined />
            ) : <span style={{ width: 14, display: 'inline-block' }} />}
          </span>
          <Avatar size={20} className="dept-tree-avatar" src={deptImg} />
          <span className="dept-tree-dept-name" title={row.deptName}>
            {row.deptName}
          </span>
        </div>
      );
    }
    
    if (row.type === 'selectAll') {
      const checkState = this.getDeptMemberCheckState(row.deptId);
      
      return (
        <div 
          key={key} 
          className="dept-tree-select-all-row" 
          style={{ ...style, paddingLeft: `${16 + indent}px` }}
        >
          <Checkbox
            checked={checkState.checked}
            indeterminate={checkState.indeterminate}
            disabled={disabled}
            onChange={(e) => this.handleSelectAllMembers(row.deptId, row.members, e.target.checked)}
          >
            <span className="dept-tree-select-all-text">全选以下员工</span>
          </Checkbox>
        </div>
      );
    }
    
    if (row.type === 'member') {
      // 统一使用 staffUserKey（即 userKey）作为成员标识
      const userKey = row.staffUserKey || row.staffId;
      const isChecked = selectedMemberIds.has(userKey);
      
      return (
        <div 
          key={key} 
          className="dept-tree-member-row" 
          style={{ ...style, paddingLeft: `${16 + indent}px` }}
        >
          <Checkbox
            checked={isChecked}
            disabled={disabled}
            onChange={(e) => this.handleMemberCheck(row.data, e.target.checked)}
          >
            <UserTag 
              userId={row.staffUserKey || row.staffId} 
              name={row.staffName} 
              avatar={row.staffAvatarUrl} 
            />
          </Checkbox>
        </div>
      );
    }
    
    return null;
  }

  render() {
    const { isSpinning, flattenedRows, searchResults } = this.state;
    const { searchKey, isSearching } = this.props;
    const showSearch = isSearching || (searchKey && searchKey.trim().length > 0);
    
    return (
      <div className="dept-tree-container">
        <Spin spinning={isSpinning} tip="数据加载中...">
          {showSearch ? (
            <div className="dept-tree-content">
              {this.renderSearchResults()}
            </div>
          ) : (
            <div className="dept-tree-content">
              {flattenedRows.length > 0 ? (
                <AutoSizer>
                  {({ height, width }) => (
                    <List
                      ref={this.listRef}
                      key="dept-tree"
                      height={height}
                      width={width}
                      rowCount={flattenedRows.length}
                      rowHeight={40}
                      overscanRowCount={5}
                      rowRenderer={this.renderVirtualRow}
                    />
                  )}
                </AutoSizer>
              ) : !isSpinning ? (
                <div className="dept-tree-empty">
                  <Empty
                    image={noDataTable}
                    styles={{ image: { height: 90, width: 90, margin: "auto", marginBottom: 10 } }}
                    description={<span style={{ color: "#727272", fontSize: "12px" }}>暂无数据</span>}
                  />
                </div>
              ) : null}
            </div>
          )}
        </Spin>
      </div>
    );
  }
}

export default DepartmentTree;
