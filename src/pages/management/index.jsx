import JSSDK from '../../jssdk-adapter'
import React, { Component } from "react";
import { getAppMode } from '../../config/auth';
import {
  DatePicker,
  Table,
  Button,
  Dropdown,
  Modal,
  Input,
  Space,
  Divider,
  Select,
  message,
  Checkbox,
  Spin,
  Tooltip
} from "antd";
import {
  UserOutlined,
  DownOutlined,
  RightCircleOutlined,
  TeamOutlined,
  BarChartOutlined,
  FileTextOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  getWeekStartAndEnd,
  getFirstDayOfNaturalMonth,
  getLastDayOfNaturalMonth,
  getQuarterStartAndEnd,
  urlDownload,
  isNumber,
} from '../../util/util';
import {
  getStatConditionDetail,
  postAdminQueryEntityStat,
  postAdminQueryStaffStat,
  postWorkHourQuerySelfStat,
  postAdminExportEntityStat,
  postAdminExportStaffStat,
  postWorkHourExportSelfStat,
  getUserRole,
  querySeatUserPermission,
  queryNeedShowTeamConfig,
  exportWorkHoursTotalDetail,
  exportMemberWorkHoursTotalDetail,
  getProjectList,
  exportPeopleWorkHoursTotalDetail,
} from '../../api/api';
import "./index.less";
import dayjs from "dayjs";
import RegBtn from "../../components/reg-btn/RegBtn";
import SelectedUser from "../../components/team-settings/TeamSettings";
import MemberSelectModal from "../../components/member-select-modal/MemberSelectModal";
import RegWorkHour from "../../components/reg-workHour/RegWorkHour";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { SeatPermissionsModal } from '../../components/seat-permissions-modal/SeatPermissionsModal';
import SpaceCascader from '../../components/space-cascader/SpaceCascader';
dayjs.extend(customParseFormat);
const { RangePicker } = DatePicker;
const MANAGEMENT_SPACE_ID_STORAGE_KEY = 'managementSpaceId';
const rangePresets = [
  {
    label: "本周",
    value: [
      dayjs(getWeekStartAndEnd().Monday),
      dayjs(getWeekStartAndEnd().Sunday),
    ],
  },
  {
    label: "本月",
    value: [
      dayjs(getFirstDayOfNaturalMonth()),
      dayjs(getLastDayOfNaturalMonth()),
    ],
  },
  {
    label: "本季度",
    value: [
      dayjs(getQuarterStartAndEnd().start),
      dayjs(getQuarterStartAndEnd().end),
    ],
  },
];

const rangeTypeOptions = [
  {
    value: "Month",
    label: "月",
  },
  {
    value: "Week",
    label: "周",
  },
  {
    value: "Day",
    label: "天",
  },
];

class Management extends Component {
  constructor(props) {
    super(props);
    this.isPersonal = 1;
    // 初始化防抖相关变量
    this.debounceTimer = null;
    this.lastRequestVersion = 0;
    this.lastStaffRequestVersion = 0;
    this.hasInitializedRefManagement = false;
    this.state = {
      exportLoading: false,
      // 级联组件：[spaceId, workItemId, workItemEntityId, nodeId, taskId]
      cascaderValue: [],
      cascaderIds: [],
      cascaderNames: {},
      // 个人统计专用级联选择器
      selfCascaderValue: [],
      selfCascaderIds: [],
      selfCascaderNames: {},
      spaceIds: [],
      // 空间列表下拉选项 & 当前选中空间（空间模式：showTeamConfig=true 且 团队统计）
      spaceOptions: [],
      selectedProjectKey: undefined,
      workItemIds: [],
      // workItemOptions: [
      //   { label: '需求分析', value: 'work_item_1' },
      //   { label: '前端开发', value: 'work_item_2' },
      //   { label: '后端开发', value: 'work_item_3' },
      //   { label: '测试验证', value: 'work_item_4' },
      //   { label: 'Bug修复', value: 'work_item_5' },
      //   { label: '文档编写', value: 'work_item_6' },
      //   { label: '代码评审', value: 'work_item_7' },
      //   { label: '会议讨论', value: 'work_item_8' },
      // ],
      chatUrl: "",
      modalOpen: false,
      modalCode: undefined,
      modalResponseData: undefined,
      showSeatModal: false,
      beginTime:
        localStorage.getItem("managementBeginTime") ||
        getFirstDayOfNaturalMonth(),
      endTime:
        localStorage.getItem("managementEndTime") || getLastDayOfNaturalMonth(),
      currDropdownIndex: 0,
      currRangeType: "Month",
      queryEntityStat: {
        table_rowData: [],
        staffSum: 0,
        workHourSum: 0,
        workItemSum: 0,
        workHourPerStaff: 0,
        table_columnName: [],
      },
      queryStaffStat: {
        table_rowData: [],
        table_columnName: [],
      },
      querySelfStat: {
        table_rowData: [],
        workHourSum: 0,
        workItemSum: 0,
        table_columnName: [],
      },
      isSelectedUserOpen: false,
      memberSelectInitial: null,
      selected: {
        selectedDeparts: [],
        selectedUsers: [],
        selectedDepartIds: [],
        selectedUserIds: [],
        checkedKeys: [],
      },
      newSelected: {
        selectedDeparts: [],
        selectedUsers: [],
        selectedDepartIds: [],
        selectedUserIds: [],
        checkedKeys: [],
      },
      isRegistrationOpen: false,
      queryEntityStatTableData: [],
      querySelfStatTableData: [],
      // 团队统计的搜索值
      entitySearchValue: "",
      // 个人统计的搜索值
      selfSearchValue: "",
      dropdownItems: [
        {
          key: 0,
          onClick: () => this.onDropdownChange(0),
          label: "团队统计",
        },
        {
          key: 1,
          onClick: () => this.onDropdownChange(1),
          label: "个人统计",
        },
      ],
      isSynchronous: Boolean,
      isSelectedTeamAdmin: false,
      showTeamConfig: false,
      removeTeamIds: [],
      removeUserIds: [],
      isAllUser: false,
      isAllTeam: false,
      loading: false,
      entityLoading: false,
      staffLoading: false,
      // 工作项登记工时表滚动加载
      entityPageNo: 1,
      entityPageSize: 50,
      entityTotal: 0,
      entityHasNext: true,
      entityLoadingMore: false,
      // 成员登记工时表滚动加载
      staffPageNo: 1,
      staffPageSize: 10,
      staffTotal: 0,
      staffHasNext: true,
      staffLoadingMore: false,
      // 表格是否处于“窄列”状态（列少 / 未出现横向滚动条）
      // narrow=true 时整体居左展示，narrow=false 时保持居中
      entityNarrow: false,
      staffNarrow: false,
      selfNarrow: false,
    };
    this.entityTableRef = React.createRef();
    this.entityScrollEl = null;
    this.staffTableRef = React.createRef();
    this.staffScrollEl = null;
    this.selfTableRef = React.createRef();
    this.measureNarrowRaf = null;
  }
  /** 是否为空间模式（反之为租户/ISV模式） */
  isSpaceMode() {
    return getAppMode() === 'space';
  }

  async componentDidMount() {
    // 先完成团队设置配置接口，确保 this.isPersonal 已赋值，再拉取列表数据
    await this.queryNeedShowTeamConfigData();
    let canLoadTeamStatistics = true;
    // 空间模式下先拉空间列表，优先恢复缓存空间，无有效缓存时选中第一个空间
    if (this.isSpaceMode()) {
      canLoadTeamStatistics = await this.loadSpaceOptions();
    }
    if (canLoadTeamStatistics) {
      this.fetchQueryEntityStatData();
      this.fetchQueryStaffStatData();
    }
    if (sessionStorage.getItem("jwtMeegoTeamworkUserRole") !== "Admin") {
      this.fetchQuerySelfStatData();
    } else {
      this.getHistoryState();
    }
    // 窗口尺寸变化时重新判断是否“窄列”
    window.addEventListener('resize', this.scheduleMeasureNarrow);
  }

  componentDidUpdate() {
    // 团队统计页签下绑定工作项表滚动监听，其它 tab 解绑
    if (this.state.currDropdownIndex === 0) {
      this.tryBindEntityScroll();
      this.tryBindStaffScroll();
    } else {
      this.unbindEntityScroll();
      this.unbindStaffScroll();
    }
    // 数据 / 列变化后重测是否“窄列”
    this.scheduleMeasureNarrow();
  }

  componentWillUnmount() {
    this.unbindEntityScroll();
    this.unbindStaffScroll();
    window.removeEventListener('resize', this.scheduleMeasureNarrow);
    if (this.measureNarrowRaf) cancelAnimationFrame(this.measureNarrowRaf);
  }

  /**
   * 测量两张表是否处于“窄列”状态：
   *  scrollWidth ≤ clientWidth 表示未出现横向滚动条（列少）→ narrow=true → 居左。
   *  反之保持居中。
   */
  init = async() => {
  };

  /** 拉取空间列表并恢复上次选中空间，无有效缓存时选中第一个 */
  loadSpaceOptions = async () => {
    try {
      const res = await getProjectList();
      if (res?.result && Array.isArray(res.data)) {
        const list = res.data.map((it) => ({
          label: it.label,
          value: String(it.value),
        }));
        const cachedProjectKey = localStorage.getItem(MANAGEMENT_SPACE_ID_STORAGE_KEY);
        const selectedProjectKey = list.some((item) => item.value === cachedProjectKey)
          ? cachedProjectKey
          : list[0]?.value;
        if (selectedProjectKey) {
          localStorage.setItem(MANAGEMENT_SPACE_ID_STORAGE_KEY, selectedProjectKey);
        }
        await new Promise((resolve) => {
          this.setState({
            spaceOptions: list,
            selectedProjectKey,
            // 级联 ids 里带上 spaceKey，确保查询接口带 projectKey
            cascaderValue: selectedProjectKey ? [selectedProjectKey] : [],
            cascaderIds: selectedProjectKey ? [selectedProjectKey] : [],
          }, resolve);
        });
        return Boolean(selectedProjectKey);
      }
    } catch (e) {
      // ignore
    }
    return false;
  };

  /** 顶部空间下拉切换 */
  onSpaceChange = (projectKey) => {
    localStorage.setItem(MANAGEMENT_SPACE_ID_STORAGE_KEY, String(projectKey));
    this.setState(
      {
        selectedProjectKey: projectKey,
        cascaderValue: projectKey ? [projectKey] : [],
        cascaderIds: projectKey ? [projectKey] : [],
        cascaderNames: {},
        workItemEntityName: '',
      },
      () => {
        this.fetchQueryEntityStatData();
        this.fetchQueryStaffStatData();
      }
    );
  };

  scheduleMeasureNarrow = () => {
    if (this.measureNarrowRaf) return;
    this.measureNarrowRaf = requestAnimationFrame(() => {
      this.measureNarrowRaf = null;
      this.measureNarrow();
    });
  };

  measureNarrow = () => {
    const nextState = {};
    const measure = (refName, stateKey) => {
      const wrap = this[refName] && this[refName].current;
      if (!wrap) return;
      const body = wrap.querySelector('.ant-table-body');
      const head = wrap.querySelector('.ant-table-header');
      const target = body || head;
      if (!target) return;
      const diff = target.scrollWidth - target.clientWidth;
      const current = this.state[stateKey];
      const narrow = current ? diff <= 16 : diff <= 4;
      if (current !== narrow) {
        nextState[stateKey] = narrow;
      }
    };
    measure('entityTableRef', 'entityNarrow');
    measure('staffTableRef', 'staffNarrow');
    measure('selfTableRef', 'selfNarrow');
    if (Object.keys(nextState).length) {
      this.setState(nextState);
    }
  };

  /** 绑定工作项登记工时表的滚动加载事件 */
  tryBindEntityScroll = () => {
    if (this.entityScrollEl) return;
    if (!this.entityTableRef.current) return;
    const scrollEl = this.entityTableRef.current.querySelector('.ant-table-body');
    if (!scrollEl) return;
    this.entityScrollEl = scrollEl;
    scrollEl.addEventListener('scroll', this.onEntityTableScroll);
  };

  unbindEntityScroll = () => {
    if (this.entityScrollEl) {
      this.entityScrollEl.removeEventListener('scroll', this.onEntityTableScroll);
      this.entityScrollEl = null;
    }
  };

  onEntityTableScroll = () => {
    const el = this.entityScrollEl;
    if (!el) return;
    const { scrollTop, clientHeight, scrollHeight } = el;
    if (scrollTop + clientHeight >= scrollHeight - 30) {
      this.loadMoreEntityStat();
    }
  };

  /** 滚动到底触发下一页 */
  loadMoreEntityStat = () => {
    const {
      entityLoadingMore,
      entityPageNo,
      entityPageSize,
      entityTotal,
      entityHasNext,
      queryEntityStatTableData,
      entityLoading,
    } = this.state;
    if (entityLoading || entityLoadingMore) return;
    // 后端明确告知没有下一页
    if (entityHasNext === false) return;
    // 已加载条数 >= 总数，也视为加载完
    if (entityTotal && entityPageNo * entityPageSize >= entityTotal) return;
    if (!queryEntityStatTableData.length) return;
    this.fetchQueryEntityStatData(undefined, true);
  };

  /** 绑定成员登记工时表的滚动加载事件（仅监听表内部） */
  tryBindStaffScroll = () => {
    if (this.staffScrollEl) return;
    if (!this.staffTableRef.current) return;
    const scrollEl = this.staffTableRef.current.querySelector('.ant-table-body');
    if (!scrollEl) return;
    this.staffScrollEl = scrollEl;
    scrollEl.addEventListener('scroll', this.onStaffTableScroll);
  };

  unbindStaffScroll = () => {
    if (this.staffScrollEl) {
      this.staffScrollEl.removeEventListener('scroll', this.onStaffTableScroll);
      this.staffScrollEl = null;
    }
  };

  onStaffTableScroll = () => {
    const el = this.staffScrollEl;
    if (!el) return;
    const { scrollTop, clientHeight, scrollHeight } = el;
    if (scrollTop + clientHeight >= scrollHeight - 30) {
      this.loadMoreStaffStat();
    }
  };

  /** 滚动到底触发下一页（成员表） */
  loadMoreStaffStat = () => {
    const {
      staffLoadingMore,
      staffPageNo,
      staffPageSize,
      staffTotal,
      staffHasNext,
      queryStaffStat,
      staffLoading,
    } = this.state;
    const loaded = (queryStaffStat.table_rowData || []).length;
    if (staffLoading || staffLoadingMore) return;
    if (staffHasNext === false) return;
    if (staffTotal && staffPageNo * staffPageSize >= staffTotal) return;
    if (!loaded) return;
    this.fetchQueryStaffStatData(undefined, true);
  };

  /**
   * 占满滚动容器：数据少、表高小于 scroll.y 时，内部不会出滚动条，
   * onScroll 永远不会触发。自动加载下一页，直到擑满或 hasNext=false。
   */
  ensureStaffFill = () => {
    // 设个安全上限，防止极端情况无限叒归
    if (!this._staffFillSafetyCount) this._staffFillSafetyCount = 0;
    this._staffFillSafetyCount += 1;
    if (this._staffFillSafetyCount > 50) return;

    setTimeout(() => {
      if (!this.staffTableRef.current) return;
      const scrollEl = this.staffTableRef.current.querySelector('.ant-table-body');
      if (!scrollEl) return;
      const { staffHasNext, staffLoadingMore, staffLoading, queryStaffStat } = this.state;
      const loaded = (queryStaffStat.table_rowData || []).length;
      if (staffLoading || staffLoadingMore) return;
      if (staffHasNext === false) return;
      if (!loaded) return;
      // 内容高 ≤ 可视高，说明未擑满，继续加载
      if (scrollEl.scrollHeight <= scrollEl.clientHeight + 1) {
        this.fetchQueryStaffStatData(undefined, true);
      } else {
        this._staffFillSafetyCount = 0;
      }
    }, 0);
  };

  renderEllipsisCell = (text, width) => {
    const title = ['string', 'number'].includes(typeof text) ? String(text) : '';
    return (
      <span
        className="management-table-ellipsis"
        title={title}
        style={{ maxWidth: width ? Math.max(width - 24, 40) : undefined }}
      >
        {text ?? ''}
      </span>
    );
  };

  applyColumnEllipsis = (column, width) => {
    const originalRender = column.render;
    return {
      ...column,
      width,
      ellipsis: true,
      render: (text, record, index) => {
        const value = originalRender ? originalRender(text, record, index) : text;
        return this.renderEllipsisCell(value, width);
      },
    };
  };

  /** 校验管理员权限 */
  checkedUserRole = async () => {
    const res = await getUserRole();
    if (res && res.data) {
      sessionStorage.setItem("jwtMeegoTeamworkUserRole", res.data);
    }
  };

  /** 获取以往查询条件（统一接口，locationType=1 工时管理） */
  getHistoryState = async () => {
    const { selected } = this.state;
    const res = await getStatConditionDetail({ locationType: 1 });
    if (res?.code === 200 && res?.data) {
      const d = res.data || {};
      const userIds = (d.selectUserList || []).map((u) => u.unionId || u.userKey).filter(Boolean);
      const departIds = [
        ...(d.selectOrgList || []).map((o) => o.departmentId || o.openDepartmentId).filter(Boolean),
        ...(d.selectTeamList || []).map((t) => t.teamId).filter(Boolean),
      ];
      const next = {
        ...selected,
        selectedUserIds: userIds,
        selectedDepartIds: departIds,
      };
      (d?.selectUserList || []).forEach((u) => { if (u) u.avatar = u.avatarUrl })
      this.setState(
        {
          selected: next,
          newSelected: next,
          isSynchronous: !!d.isSynchronous,
          isAllUser: !!d.isAllUser,
          isAllTeam: !!d.isAllTeam,
          isSelectedTeamAdmin: !!d.isSelectedTeamAdmin,
          memberSelectInitial: {
            selectUserList: d.selectUserList || [],
            selectOrgList: d.selectOrgList || [],
            selectTeamList: d.selectTeamList || [],
            isSynchronous: !!d.isSynchronous,
            isSelectedTeamAdmin: !!d.isSelectedTeamAdmin,
            isAllUser: !!d.isAllUser,
            isAllTeam: !!d.isAllTeam,
          },
        },
        () => {
          this.fetchQuerySelfStatData();
        }
      );
    }
  };

  /** 获取团队统计-工作项登记工时 */
  fetchQueryEntityStatData = async (n, isLoadMore = false) => {
    const {
      newSelected,
      beginTime,
      endTime,
      currDropdownIndex,
      entitySearchValue,
      isSynchronous,
      entityPageNo,
      entityPageSize,
      cascaderIds,
    } = this.state;
    const pageSize = entityPageSize || 50;
    const pageNo = isLoadMore ? (entityPageNo || 1) + 1 : 1;

    if (isLoadMore) {
      this.setState({ entityLoadingMore: true });
    } else {
      this.setState({ entityLoading: true, entityLoadingMore: false });
    }

    // 生成新的请求版本号
    const currentRequestVersion = ++this.lastRequestVersion;

    // 级联选中的 ids 按层级拆解：[spaceId, workItemId, workItemEntityId, nodeId, taskId]
    const cascIds = Array.isArray(cascaderIds) ? cascaderIds : [];
    
    const data = {
      startDate: beginTime + " 00:00:00",
      endDate: endTime + " 23:59:59",
      workItemEntityName: entitySearchValue,
      pageNo,
      pageSize,
      // 级联结果切片传给后端，未选的层级传空字符串
      // 字段约定：空间id=projectKey、工作项id=workItemId、工作项实例id=workItemEntityId
      // 空间模式：projectKey 使用 selectedProjectKey；租户模式：projectKey 使用 cascIds[0]
      projectKey: this.isSpaceMode() ? (this.state.selectedProjectKey || "") : (cascIds[0] || ""),
      workItemId: cascIds[1] || "",
      workItemEntityId: cascIds[2] || "",
      nodeId: cascIds[3] || "",
      taskId: cascIds[4] || "",
      statisticType: this.isPersonal
    };
    if (n) {
      data.isSynchronous = isSynchronous
      data.isAllUser = newSelected.isAllUser || false
      data.isAllTeam = newSelected.isAllTeam || false
      // data.userId = newSelected.selectedUserIds
      // data.teamIds = newSelected.selectedDepartIds
      data.isSelectedTeamAdmin = this.state.isSelectedTeamAdmin
      data.selectUserList = newSelected.selectUserList
      data.selectOrgList = newSelected.selectOrgList
      data.selectTeamList = newSelected.selectTeamList
    }
    try {
      const res = await postAdminQueryEntityStat(data);

      // 旧请求既不更新数据，也不能结束最新请求的加载状态。
      if (currentRequestVersion !== this.lastRequestVersion) return;
      if (res?.result) {
        // 兼容新旧字段：新接口返回 tableColumnName/tableRowData（驼峰），旧为 table_columnName/table_rowData
        const raw = res.data || {};
        const columns = raw.tableColumnName || raw.table_columnName || [];
        const rows = raw.tableRowData || raw.table_rowData || [];
        const summary = raw.summary || null;
        // 分页字段：兼容 data.pagination.* 与 data.* 平铺两种结构
        const pag = raw.pagination || raw;
        const total = pag.totalRecords ?? raw.total ?? raw.totalCount ?? 0;
        const hasNext = typeof pag.hasNext === 'boolean' ? pag.hasNext : undefined;
        const processedColumns = columns.map((item, index) => {
          // 统一列宽 + 溢出省略，防止长文本撑出列宽导致表头与数据不对齐
          const column = { ...item, align: 'left' };
          // 注：不设 fixed —— fixed 列会导致 antd Table 拆成多个独立 <table>，
          // 与 scroll.y 垂直滚动条叠加时，横滚到底会出现 header/body 对不齐的误差
          if (index === 0) {
            return this.applyColumnEllipsis(column, 140);
          }
          if (column.dataIndex === 'firstColumn') {
            return this.applyColumnEllipsis(column, 180);
          }
          if (column.dataIndex === 'workHourSum') {
            return this.applyColumnEllipsis(column, 110);
          }
          return this.applyColumnEllipsis(column, 110);
        });
        this.setState((prev) => {
          const mergedRows = isLoadMore
            ? [...prev.queryEntityStatTableData, ...rows]
            : rows;
          // 优先用 hasNext；不返回时退回用 total 与已加载条数比较
          const nextHasNext = hasNext !== undefined
            ? hasNext
            : (total > 0 ? mergedRows.length < total : true);
          return {
            queryEntityStat: {
              ...raw,
              table_columnName: processedColumns,
              table_rowData: mergedRows,
              // summary 是全量汇总，最新响应覆盖即可
              summary: summary ?? prev.queryEntityStat.summary,
            },
            queryEntityStatTableData: mergedRows,
            entityPageNo: pageNo,
            entityTotal: total,
            entityHasNext: nextHasNext,
          };
        });
      }
    } finally {
      if (currentRequestVersion === this.lastRequestVersion) {
        this.setState(isLoadMore
          ? { entityLoadingMore: false }
          : { entityLoading: false });
      }
    }
  };

  /** 获取团队统计-成员登记工时 */
  fetchQueryStaffStatData = async (n, isLoadMore = false) => {
    const {
      newSelected,
      beginTime,
      endTime,
      currRangeType,
      currDropdownIndex,
      isSynchronous,
      staffPageNo,
      staffPageSize,
      selectedProjectKey,
      cascaderIds,
    } = this.state;
    const pageSize = staffPageSize || 10;
    const pageNo = isLoadMore ? (staffPageNo || 1) + 1 : 1;

    if (isLoadMore) {
      this.setState({ staffLoadingMore: true });
    } else {
      this.setState({ staffLoading: true, staffLoadingMore: false });
    }

    const currentRequestVersion = ++this.lastStaffRequestVersion;

    const data = {
      statisticType: this.isPersonal,
      startDate: beginTime + " 00:00:00",
      endDate: endTime + " 23:59:59",
      rangeType: currRangeType,
      pageNo,
      pageSize,
    };
    // 选中空间时带上 projectKey（租户模式通过级联第一层选空间；空间模式通过顶部空间下拉）
    const projectKey = selectedProjectKey || cascaderIds?.[0] || "";
    if (projectKey) {
      data.projectKey = projectKey;
    }

    if (n) {
      data.isSynchronous = isSynchronous
      data.isAllUser = newSelected.isAllUser || false
      data.isAllTeam = newSelected.isAllTeam || false
      // data.userId = newSelected.selectedUserIds
      // data.teamIds = newSelected.selectedDepartIds
      data.isSelectedTeamAdmin = this.state.isSelectedTeamAdmin
      data.selectUserList = newSelected.selectUserList
      data.selectOrgList = newSelected.selectOrgList
      data.selectTeamList = newSelected.selectTeamList
    }
    try {
      const res = await postAdminQueryStaffStat(data);
      // 只接受当前空间/筛选条件对应的最新响应。
      if (currentRequestVersion !== this.lastStaffRequestVersion) return;
      if (res?.result) {
        const raw = res.data || {};
        const columns = raw.tableColumnName || raw.table_columnName || [];
        const rows = raw.tableRowData || raw.table_rowData || [];
        const summary = raw.summary || null;
        // 分页字段兼容两种结构：data.pagination.* 与 data.* 平铺
        const pag = raw.pagination || raw;
        const total = pag.totalRecords ?? raw.total ?? raw.totalCount ?? 0;
        const hasNext = typeof pag.hasNext === 'boolean' ? pag.hasNext : undefined;
        const processedColumns = columns.map((item, index) => {
          const column = { ...item, align: 'left' };
          // 注：不设 fixed，保证 header/body 使用同一个 <table>和同一个 colgroup，横滚严格对齐
          if (index === 0) {
            return this.applyColumnEllipsis(column, 140);
          }
          return this.applyColumnEllipsis(column, 120);
        });
        this.setState((prev) => {
          const prevRows = prev.queryStaffStat.table_rowData || [];
          const mergedRows = isLoadMore ? [...prevRows, ...rows] : rows;
          const nextHasNext = hasNext !== undefined
            ? hasNext
            : (total > 0 ? mergedRows.length < total : true);
          return {
            queryStaffStat: {
              ...raw,
              table_columnName: processedColumns,
              table_rowData: mergedRows,
              summary: summary ?? prev.queryStaffStat.summary,
            },
            staffPageNo: pageNo,
            staffTotal: total,
            staffHasNext: nextHasNext,
          };
        }, () => {
          if (!isLoadMore) this._staffFillSafetyCount = 0;
          // 不再自动擑满下一页；用户滚动到底时再触发 loadMoreStaffStat
        });
      }
    } finally {
      if (currentRequestVersion === this.lastStaffRequestVersion) {
        this.setState(isLoadMore
          ? { staffLoadingMore: false }
          : { staffLoading: false });
      }
    }
  };

  /** 获取个人统计-实际工时统计 */
  fetchQuerySelfStatData = async () => {
    this.setState({ loading: true })
    const {
      beginTime,
      endTime,
      currRangeType,
      currDropdownIndex,
      selfSearchValue,
      selfCascaderIds,
    } = this.state;
    // if (currDropdownIndex !== 1) {
    //   this.setState({ loading: false })
    //   return;
    // }
    // 级联选中的 ids 按层级拆解：[spaceId, workItemId, workItemEntityId, nodeId, taskId]
    const cascIds = Array.isArray(selfCascaderIds) ? selfCascaderIds : [];
    const data = {
      statisticType: this.isPersonal,
      startDate: beginTime + " 00:00:00",
      endDate: endTime + " 23:59:59",
      rangeType: currRangeType,
      workItemEntityName: selfSearchValue,
      projectKey: cascIds[0] || "",
      workItemId: cascIds[1] || "",
      workItemEntityId: cascIds[2] || "",
    };
    const res = await postWorkHourQuerySelfStat(data);
    if (res?.result) {
      const raw = res.data || {};
      const columns = raw.tableColumnName || raw.table_columnName || [];
      const rows = raw.tableRowData || raw.table_rowData || [];
      if(rows.length > 0 && Object.keys(raw.summary || {}).length > 0) {
       rows.push(raw.summary)
      }
      // const hasWorkHourSumColumn = columns.some(
      //   (item) => item.dataIndex === "workItemName" || item.key === "workHourSum" || item.title === "总工时"
      // );
      const selfStatColumns = columns
      const processedColumns = selfStatColumns.map((item, index) => {
        if (index === 0) {
          return this.applyColumnEllipsis(item, 180);
        }
        return this.applyColumnEllipsis(item, 120);
      });
      this.setState({
        querySelfStat: {
          ...raw,
          table_columnName: processedColumns,
          table_rowData: rows,
        },
        querySelfStatTableData: rows,
      });
    }
    this.setState({ loading: false })
  };

  /** 时间改变 */
  onTimeChange = (date, dateString) => {
    localStorage.setItem("managementBeginTime", dateString[0]);
    localStorage.setItem("managementEndTime", dateString[1]);
    this.setState(
      {
        beginTime: dateString[0],
        endTime: dateString[1],
      },
      () => {
        this.fetchQueryEntityStatData();
        this.fetchQueryStaffStatData();
        this.fetchQuerySelfStatData();
      }
    );
  };

  /** 统计纬度切换 */
  onDropdownChange = (e) => {
    this.isPersonal = e;
    this.setState(
      {
        currDropdownIndex: e,
        // 切换到团队统计时，清空团队统计的级联选择器和搜索值
        ...(e === 0
          ? {
              cascaderValue: [],
              cascaderIds: [],
              cascaderNames: {},
              entitySearchValue: "",
            }
          : {}),
        // 切换到个人统计时，清空个人统计的级联选择器和搜索值
        ...(e === 1
          ? {
              selfCascaderValue: [],
              selfCascaderIds: [],
              selfCascaderNames: {},
              selfSearchValue: "",
            }
          : {}),
      },
      () => {
        if(e === 0) {
          this.fetchQueryEntityStatData();
          this.fetchQueryStaffStatData();
        }else{
          this.fetchQuerySelfStatData();
        }
      }
    );
  };

  /** 时间维度切换  */
  handleRangeTypeChange = (value) => {
    this.setState({ currRangeType: value }, () => {
      this.fetchQueryStaffStatData();
      this.fetchQuerySelfStatData();
    });
  };
  /** 是否显示团队设置 */
  queryNeedShowTeamConfigData = async () => {
    const res = await queryNeedShowTeamConfig();
    if (res?.result) {
      this.isPersonal = res.data ? 0 : 1;
      this.setState({
        showTeamConfig: res.data || false,
      });
    }
  };
  /** 打开人员选择器：直接使用初始化阶段已拉取的 memberSelectInitial，避免重复请求 */
  onSelectedUserOpen = () => {
    this.getHistoryState().then(() => {
      this.setState({
        isSelectedUserOpen: true,
      });
    });
  };

  handleSelectedUserCancel = () => {
    const { newSelected } = this.state;
    this.setState({ isSelectedUserOpen: false, selected: newSelected });
  };

  handleSelectedUserOk = () => {
    const { selected } = this.state;
    if (!selected.selectedUserIds.length && !selected.selectedDepartIds.length) {
      JSSDK.toast.warning("团队成员不能为空");
      return;
    }
    this.setState({ isSelectedUserOpen: false, newSelected: selected }, () => {
      this.fetchQueryEntityStatData(1);
      this.fetchQueryStaffStatData(1);
    });
  };

  /** MemberSelectModal 确认：按 admin/queryEntityStat 接口入参构造 payload 并调用接口 */
  handleMemberSelectConfirm = async (data) => {
    console.log("MemberSelectModal 确认:", data);
    const selectedUserIds = (data.selectedMembers || []).map(m => m.id);
    const selectedDepartIds = [
      ...(data.selectedTeams || []).map(t => t.id),
      ...(data.selectedDepartments || []).map(d => d.id),
    ];
    if (!(data.selectedMembers || []).length && !(data.selectedDepartments || []).length && !(data.selectedTeams || []).length) {
      JSSDK.toast.warning("团队成员不能为空");
      return;
    }

    const selectUserList = (data.selectedMembers || []).map(m => ({
      unionId: m.unionId || m.id,
      userKey: m.userKey,
    }));
    const selectOrgList = (data.selectedDepartments || []).map(d => ({
      departmentId: d.departmentId || d.openDepartmentId || d.id,
      unionId: d.unionId,
      userKey: d.userKey,
    }));
    const selectTeamList = (data.selectedTeams || []).map(t => ({
      teamId: t.teamId || t.id,
    }));

    const { beginTime, endTime, workItemEntityName } = this.state;
    const payload = {
      startDate: beginTime + " 00:00:00",
      endDate: endTime + " 23:59:59",
      workItemEntityName: workItemEntityName || "",
      isSynchronous: !!data.isSynchronous,
      isAllUser: data.isAllUser || false,
      isAllTeam: data.isAllTeam || false,
      isAllDepartment: data.isAllDepartment || false,
      isSelectedTeamAdmin: !!data.selectTeamAdmin,
      selectUserList,
      selectOrgList,
      selectTeamList,
      statisticType: this.isPersonal
    };

    const newSelected = {
      ...this.state.selected,
      selectedUserIds,
      selectedDepartIds,
      selectUserList,
      selectOrgList,
      selectTeamList,
    };
    this.setState({
      isSelectedUserOpen: false,
      newSelected,
      selected: newSelected,
      isSynchronous: !!data.isSynchronous,
      isSelectedTeamAdmin: !!data.selectTeamAdmin,
      //loading: true,
    }, () => {
      this.fetchQueryEntityStatData(1);
      this.fetchQueryStaffStatData(1);
    });
    //  this.setState({
    //   isSelectedUserOpen: false,
    //   newSelected,
    //   selected: newSelected,
    //   isSynchronous: !!data.isSynchronous,
    //   isSelectedTeamAdmin: !!data.selectTeamAdmin,
    //   loading: true,
    // }, () => {
    //   this.fetchQueryEntityStatData(1);
    //   this.fetchQueryStaffStatData(1);
    // });
    // try {
    //   const res = await postAdminQueryEntityStat(payload);
    //   if (res?.result) {
    //     // 拉到最新 userId 列表后，按已选条件刷新两个表格
    //     //this.fetchQueryEntityStatData(1);
    //     this.fetchQueryStaffStatData(1);
    //   }
    // } finally {
    //   this.setState({ loading: false });
    // }
  };

  getSelectedUser = (e) => {
    this.setState({ selected: e });
  };

  /** 团队统计-工作项实际工时模糊搜索 */
  onQueryEntityStatSearch = (e) => {
    const value = e.target.value.replace(/\s+/g, "");

    // 清除之前的定时器，实现防抖
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // 设置新的定时器，延迟300ms执行搜索
    this.debounceTimer = setTimeout(() => {
      //console.log("搜索值:", value);
      this.setState({ entitySearchValue: value }, () =>
        this.fetchQueryEntityStatData()
      );
    }, 300);
  };

  /** 个人统计-工作项实际工时模糊搜索 */
  onQuerySelfStatSearch = (e) => {
    const { querySelfStat } = this.state;
    const value = e.target.value.replace(/\s+/g, "");
    this.setState({ selfSearchValue: value }, () =>
      this.fetchQuerySelfStatData()
    );
  };

 /** 导出-团队统计-工作项登记工时 */
  onQueryEntityStatExport = async () => {
    const res2 = await querySeatUserPermission();
    // 如果接口返回true，显示SeatPermissionsModal
    if (res2?.result && res2?.data?.msgCode) {
      this.setState({
        modalOpen: true,
        modalCode: res2?.data?.msgCode,
        modalResponseData: res2?.data,
        chatUrl: res2?.data?.chatUrl
      });
      return;
    }
     message.loading({
      key: "EntityStatExport",
      content: "数据导出中，请稍后",
      duration: 0,
    });
    const {beginTime, endTime, entitySearchValue, cascaderIds, currDropdownIndex} = this.state;
    // 级联选中的 ids 按层级拆解：[spaceId, workItemId, workItemEntityId, nodeId, taskId]
    const cascIds = Array.isArray(cascaderIds) ? cascaderIds : [];
    const data = {
      startDate: beginTime + " 00:00:00",
      endDate: endTime + " 23:59:59",
      workItemEntityName: entitySearchValue,
      pageNo:1,
      pageSize:50,
      projectKey: this.isSpaceMode() ? (this.state.selectedProjectKey || "") : (cascIds[0] || ""),
      workItemId: cascIds[1] || "",
      workItemEntityId: cascIds[2] || "",
      nodeId: cascIds[3] || "",
      taskId: cascIds[4] || "",
      statisticType: currDropdownIndex,
    };
    const res = await postAdminExportEntityStat(data);
    if (res?.result) {
      urlDownload(res.data.url);
    }
    message.destroy("EntityStatExport");
  };

  /** 导出-团队统计-成员登记工时 */
  onQueryStaffStatExport = async () => {
    const res2 = await querySeatUserPermission();
    // 如果接口返回true，显示SeatPermissionsModal
    if (res2?.result && res2?.data?.msgCode) {
      this.setState({
        modalOpen: true,
        modalCode: res2?.data?.msgCode,
        modalResponseData: res2?.data,
        chatUrl: res2?.data?.chatUrl
      });
      return;
    }
    message.loading({
      key: "StaffStatExport",
      content: "数据导出中，请稍后",
      duration: 0,
    });
    const {beginTime, endTime, currRangeType, currDropdownIndex, selectedProjectKey, cascaderIds } = this.state;
    const data = {
      startDate: beginTime + " 00:00:00",
      endDate: endTime + " 23:59:59",
      rangeType: currRangeType,
      statisticType: currDropdownIndex,
    };
    if (this.isSpaceMode()) {
      data.projectKey = selectedProjectKey || cascaderIds?.[0] || "";
    } else if (cascaderIds?.[0]) {
      // 租户模式：级联选中了空间时也带上 projectKey
      data.projectKey = cascaderIds[0];
    }
    let res=''
    if(currDropdownIndex){
      res = await exportPeopleWorkHoursTotalDetail(data);
    }else{
      res = await exportMemberWorkHoursTotalDetail(data);
    }
    if (res?.result) {
      urlDownload(res.data.url);
    }
    message.destroy("StaffStatExport");
  };

  /** 导出-个人统计-实际工时统计 */
  onQuerySelfStatExport = async () => {
    const { beginTime, endTime, currRangeType, selfSearchValue, currDropdownIndex, selfCascaderIds } =
      this.state;
    // 级联选中的 ids 按层级拆解：[spaceId, workItemId, workItemEntityId, nodeId, taskId]
    const cascIds = Array.isArray(selfCascaderIds) ? selfCascaderIds : [];
    const data = {
      startDate: beginTime + " 00:00:00",
      endDate: endTime + " 23:59:59",
      rangeType: currRangeType,
      workItemEntityName: selfSearchValue,
      statisticType: currDropdownIndex,
      projectKey: cascIds[0] || "",
      workItemId: cascIds[1] || "",
      workItemEntityId: cascIds[2] || "",
    };
    let res=''
    if(currDropdownIndex){
      res = await exportPeopleWorkHoursTotalDetail(data);
    }else{
      res = await exportMemberWorkHoursTotalDetail(data);
    }
    if (res?.result) {
      urlDownload(res.data.url);
    }
  };

  /** 提交实际工时 */
  onRegistrationOk = async (result) => {
    if (result) {
      this.fetchQuerySelfStatData();
    }
    this.setState({ isRegistrationOpen: false });
  };

  render() {
    return (
      <div className="management-warp">
        <div className="management-top">
          <div className="top-left">
            {this.state.showTeamConfig && this.state.currDropdownIndex === 0 ? (
              <Button
                icon={<RightCircleOutlined />}
                iconPosition="end"
                type="link"
                onClick={this.onSelectedUserOpen}
              >
                团队设置
              </Button>
            ) : null}
          </div>
          <div className="top-right">
            {this.isSpaceMode() && this.state.currDropdownIndex === 0 ? (
              <Select
                size="small"
                className="top-item"
                style={{ width: 180, marginRight: 8 }}
                placeholder="选择空间"
                value={this.state.selectedProjectKey}
                onChange={this.onSpaceChange}
                options={this.state.spaceOptions}
              />
            ) : null}
            <RangePicker
              size="small"
              allowClear={false}
              presets={rangePresets}
              className="top-item time-picker"
              value={[dayjs(this.state.beginTime), dayjs(this.state.endTime)]}
              onChange={this.onTimeChange}
            />
            <Divider type="vertical" />
            {this.state.showTeamConfig ? (
              <Dropdown
                className="top-item"
                menu={{
                  items: this.state.dropdownItems,
                }}
              >
                <a onClick={(e) => e.preventDefault()}>
                  <Space>
                    {
                      this.state.dropdownItems[this.state.currDropdownIndex]
                        .label
                    }
                    <DownOutlined />
                  </Space>
                </a>
              </Dropdown>
            ) : null}
          </div>
        </div>
        <div className="management-scroll-body">
          {this.state.currDropdownIndex === 0 ? (
            <Spin spinning={this.state.entityLoading || this.state.staffLoading}>
              <div className="management-content">
              <div className="content-top">
                {!this.isSpaceMode() ? (
                  <>
                <div className="content-top-box">
                  <div className="box-left">
                    <UserOutlined className="icon" />
                    <span>空间</span>
                  </div>
                  <div className="box-right">
                    {this.state.queryEntityStat.spaceSum ?? 0}
                  </div>
                </div>
                <div className="flex-box"></div>
                  </>
                ) : null}
                <div className="content-top-box">
                  <div className="box-left">
                    <FileTextOutlined className="icon" />
                    <span>工作项</span>
                  </div>
                  <div className="box-right">
                    {this.state.queryEntityStat.workItemSum}
                  </div>
                </div>
                <div className="flex-box"></div>
                <div className="content-top-box">
                  <div className="box-left">
                    <TeamOutlined className="icon" />
                    <span>团队成员</span>
                  </div>
                  <div className="box-right">
                    {this.state.queryEntityStat.staffSum}
                  </div>
                </div>
                <div className="flex-box"></div>
                <div className="content-top-box">
                  <div className="box-left">
                    <BarChartOutlined className="icon" />
                    <span>总计登记工时</span>
                  </div>
                  <div className="box-right">
                    {this.state.queryEntityStat.workHourSum}
                  </div>
                </div>
                <div className="flex-box"></div>
                <div className="content-top-box">
                  <div className="box-left">
                    <UserOutlined className="icon" />
                    <span>人均登记工时</span>
                  </div>
                  <div className="box-right">
                    {isNumber(this.state.queryEntityStat.workHourPerStaff)
                      ? this.state.queryEntityStat.workHourPerStaff.toFixed(2)
                      : this.state.queryEntityStat.workHourPerStaff}
                  </div>
                </div>
              </div>
              <div className="content-body">
                <div className="content-table">
                  <div className="content-table-header">
                    <div className="header-title">工作项登记工时</div>
                    <Space className="header-box">
                      {/* 空间模式下：级联从工作项层开始（工作项/工作项实例）；租户模式保留三级（空间/工作项/工作项实例） */}
                      <SpaceCascader
                        size="small"
                        style={{ width: this.isSpaceMode() ? 280 : 360 }}
                        maxLevel={3}
                        rootProjectKey={this.isSpaceMode() ? this.state.selectedProjectKey : undefined}
                        value={this.isSpaceMode() ? this.state.cascaderIds : this.state.cascaderValue}
                        placeholder={this.isSpaceMode() ? "工作项 / 工作项实例" : "空间 / 工作项 / 工作项实例"}
                        onChange={(ids, names, selectedOptions) => {
                          const newIds = ids || [];
                          const prevIds = this.state.cascaderIds || [];
                          // 判断是否切换了空间（第一位 projectKey 发生变化）：切空间时同时刷新成员表与工作项表
                          const spaceChanged = newIds[0] !== prevIds[0];
                          this.setState(
                            {
                              // rootProjectKey 模式下 cascaderValue 不需要（由 cascaderIds 驱动回显）；非 root 模式仍用 selectedOptions.value 数组
                              cascaderValue: this.isSpaceMode() ? newIds : (selectedOptions ? selectedOptions.map(o => o.value) : []),
                              cascaderIds: newIds,
                              cascaderNames: names || {},
                              // 切空间时重置分页
                              entityPageNo: 1,
                              staffPageNo: 1,
                              queryEntityStatTableData: spaceChanged ? [] : this.state.queryEntityStatTableData,
                            },
                            () => {
                              this.fetchQueryEntityStatData();
                              // 切空间时成员登记工时也需要按新空间 key 刷新
                              if (spaceChanged) {
                                this.fetchQueryStaffStatData();
                              }
                            }
                          );
                        }}
                      />
                      <Input
                        size="small"
                        placeholder="输入工作项实例名称"
                        value={this.state.entitySearchValue}
                        onChange={this.onQueryEntityStatSearch}
                        style={{
                          width: 180,
                        }}
                        suffix={<SearchOutlined style={{ color: "#BBBBBB" }} />}
                      />
                      <Button
                        size="small"
                        type="primary"
                        onClick={this.onQueryEntityStatExport}
                      >
                        导出
                      </Button>
                    </Space>
                  </div>
                  <div className={`content-table-body${this.state.entityNarrow ? ' is-narrow' : ''}`} ref={this.entityTableRef}>
                    {(() => {
                      const {
                        entityLoadingMore,
                        entityTotal,
                        entityHasNext,
                        queryEntityStatTableData,
                        queryEntityStat,
                      } = this.state;
                      const loaded = queryEntityStatTableData.length;
                      // 优先用 hasNext；没有时退回用 total 比较
                      const isDone =
                        loaded > 0 &&
                        (entityHasNext === false ||
                          (entityTotal > 0 && loaded >= entityTotal));
                      const baseCols = queryEntityStat.table_columnName || [];

                      // 根据状态在数据末尾追加一行“加载中”提示行（加载完成后不再展示“已加载全部”）
                      const tipRow = entityLoadingMore
                        ? { __tipType: 'loading', key: '__tip_loading__' }
                        : null;

                      let displayData = queryEntityStatTableData.map((r, i) => ({
                        ...r,
                        __rk: r?.key ?? r?.workItemEntityId ?? r?.workItemEntityName ?? `entity_${i}`,
                      }));
                      let displayCols = baseCols;
                      // 统一 header/body/summary 三个子表的横向宽度，避免 "max-content" 各自计算
                      // 导致横滚到底时最后一列表头与数据行错位
                      // 列宽之和与容器宽度取大，确保表格始终填满容器
                      const colWidthSum = baseCols.reduce((sum, c) => sum + (Number(c.width) || 110), 0);
                      const containerWidth = this.entityTableRef?.current?.offsetWidth || 0;
                      const totalX = Math.max(colWidthSum, containerWidth);
                      // 当容器宽度 > 列宽之和时，将多余宽度均摊到每列，确保 summary 列宽与 header/body 保持一致
                      const extraPerCol = baseCols.length > 0 && containerWidth > colWidthSum
                        ? Math.floor((containerWidth - colWidthSum) / baseCols.length)
                        : 0;
                      const effectiveCols = extraPerCol > 0
                        ? baseCols.map(c => ({ ...c, width: (Number(c.width) || 110) + extraPerCol }))
                        : baseCols;
                      displayCols = effectiveCols;
                      if (tipRow && baseCols.length) {
                        displayData = [...displayData, { ...tipRow, __rk: tipRow.key }];
                        displayCols = effectiveCols.map((col, idx) => ({
                          ...col,
                          onCell: (record) => {
                            if (record && record.__tipType) {
                              return idx === 0
                                ? { colSpan: baseCols.length }
                                : { colSpan: 0 };
                            }
                            return {};
                          },
                          render:
                            idx === 0
                              ? (text, record, index) => {
                                  if (record && record.__tipType === 'loading') {
                                    // sticky + left:50% + translateX(-50%) → 始终跟随 .ant-table-body 可视区域水平居中，
                                    // 不随横向滚动而偶向偏移（视口多宽都在屏幕中部）
                                    return (
                                      <div style={{
                                        position: 'sticky',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        display: 'inline-block',
                                        color: '#999',
                                        fontSize: 12,
                                        whiteSpace: 'nowrap',
                                      }}>
                                        加载中...
                                      </div>
                                    );
                                  }
                                  return col.render ? col.render(text, record, index) : (text ?? '');
                                }
                              : col.render,
                        }));
                      }

                      return (
                        <Table
                          size="small"
                          pagination={false}
                          tableLayout="fixed"
                          rowKey={(record) => record?.__rk ?? record?.key}
                          columns={displayCols}
                          dataSource={displayData}
                          scroll={{
                            // y 设得小于 pageSize 条数据的自然高度，确保内部一定出现滚动条，
                            // 这样鼠标在表格内滚动时才能触发 onEntityTableScroll 加载下一页
                            y: 300,
                            // 用列宽之和代替 "max-content"，让 thead/tbody/summary 三者宽度完全一致，防止横滚到底错位
                            x: totalX || "max-content",
                          }}
                          summary={() => {
                            const s = this.state.queryEntityStat.summary;
                            const cols = this.state.queryEntityStat.table_columnName || [];
                            if (!queryEntityStatTableData.length || !s || !cols.length) return null;
                            return (
                              <Table.Summary fixed>
                                <Table.Summary.Row>
                                  {cols.map((col, idx) => (
                                    <Table.Summary.Cell
                                      index={idx}
                                      key={col.dataIndex ?? idx}
                                      align="left"
                                      style={col.width ? { width: col.width, minWidth: col.width, maxWidth: col.width } : undefined}
                                    >
                                      {s[col.dataIndex] ?? ''}
                                    </Table.Summary.Cell>
                                  ))}
                                </Table.Summary.Row>
                              </Table.Summary>
                            );
                          }}
                        />
                      );
                    })()}
                  </div>
                </div>
                <div className="content-table">
                  <div className="content-table-header">
                    <div className="header-title">成员登记工时</div>
                    <Space className="header-box">
                      <Select
                        size="small"
                        defaultValue={this.state.currRangeType}
                        style={{
                          width: 80,
                        }}
                        onChange={this.handleRangeTypeChange}
                        options={rangeTypeOptions}
                      />
                      <Button
                        type="primary"
                        size="small"
                        onClick={this.onQueryStaffStatExport}
                      >
                        导出
                      </Button>
                    </Space>
                  </div>
                  <div className={`content-table-body${this.state.staffNarrow ? ' is-narrow' : ''}`} ref={this.staffTableRef}>
                    {(() => {
                      // staff 表：使用表内部滚动条 + scroll 事件触发分页加载
                      const {
                        staffLoadingMore,
                        staffTotal,
                        staffHasNext,
                        queryStaffStat,
                      } = this.state;
                      const baseRows = queryStaffStat.table_rowData || [];
                      const baseCols = queryStaffStat.table_columnName || [];
                      const loaded = baseRows.length;
                      const isDone =
                        loaded > 0 &&
                        (staffHasNext === false ||
                          (staffTotal > 0 && loaded >= staffTotal));

                      const tipRow = staffLoadingMore
                        ? { __tipType: 'loading', key: '__staff_tip_loading__' }
                        : null;

                      let displayData = baseRows.map((r, i) => ({
                        ...r,
                        __rk: r?.key ?? r?.userId ?? r?.staffId ?? r?.staffName ?? `staff_${i}`,
                      }));
                      let displayCols = baseCols;
                      // 统一 header/body/summary 三个子表的横向宽度，避免 "max-content" 各自计算导致错位
                      // 列宽之和与容器宽度取大，确保表格始终填满容器
                      const colWidthSum = baseCols.reduce((sum, c) => sum + (Number(c.width) || 120), 0);
                      const totalX = Math.max(colWidthSum, this.staffTableRef?.current?.offsetWidth || 0);
                      if (tipRow && baseCols.length) {
                        displayData = [...displayData, { ...tipRow, __rk: tipRow.key }];
                        displayCols = baseCols.map((col, idx) => ({
                          ...col,
                          onCell: (record) => {
                            if (record && record.__tipType) {
                              return idx === 0
                                ? { colSpan: baseCols.length }
                                : { colSpan: 0 };
                            }
                            return {};
                          },
                          render:
                            idx === 0
                              ? (text, record, index) => {
                                  if (record && record.__tipType === 'loading') {
                                    // sticky + left:50% + translateX(-50%) → 始终跟随 .ant-table-body 可视区域水平居中
                                    return (
                                      <div style={{
                                        position: 'sticky',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        display: 'inline-block',
                                        color: '#999',
                                        fontSize: 12,
                                        whiteSpace: 'nowrap',
                                      }}>
                                        加载中...
                                      </div>
                                    );
                                  }
                                  return col.render ? col.render(text, record, index) : (text ?? '');
                                }
                              : col.render,
                        }));
                      }

                      return (
                        <Table
                          size="small"
                          pagination={false}
                          tableLayout="fixed"
                          rowKey={(record) => record?.__rk ?? record?.key}
                          columns={displayCols}
                          dataSource={displayData}
                          scroll={{
                            // y 设得小于 pageSize 条数据的自然高度，确保内部一定出现滚动条，
                            // 这样鼠标在表格内滚动时才能触发 onStaffTableScroll 加载下一页
                            y: 300,
                            // 用列宽之和代替 "max-content"，让 thead/tbody/summary 三者宽度完全一致，防止横滚到底错位
                            x: totalX || "max-content",
                          }}
                          summary={() => {
                            const s = this.state.queryStaffStat.summary;
                            const cols = this.state.queryStaffStat.table_columnName || [];
                            if (!s || !cols.length) return null;
                            return (
                              <Table.Summary fixed>
                                <Table.Summary.Row>
                                  {cols.map((col, idx) => (
                                    <Table.Summary.Cell
                                      index={idx}
                                      key={col.dataIndex ?? idx}
                                      align="left"
                                      style={col.width ? { width: col.width, minWidth: col.width, maxWidth: col.width } : undefined}
                                    >
                                      {s[col.dataIndex] ?? ''}
                                    </Table.Summary.Cell>
                                  ))}
                                </Table.Summary.Row>
                              </Table.Summary>
                            );
                          }}
                        />
                      );
                    })()}
                  </div>
                </div>
              </div>
              </div>
            </Spin>
          ) : (
            <Spin spinning={this.state.loading}>
              <div className="management-content">
              <div className="content-top">
                <div className="content-top-box">
                  <div className="box-left">
                    <FileTextOutlined className="icon" />
                    <span>工作项</span>
                  </div>
                  <div className="box-right">
                    {this.state.querySelfStat.workItemSum}
                  </div>
                </div>
                <div className="flex-box"></div>
                <div className="content-top-box">
                  <div className="box-left">
                    <BarChartOutlined className="icon" />
                    <span>总计登记工时</span>
                  </div>
                  <div className="box-right">
                    {this.state.querySelfStat.workHourSum}
                  </div>
                </div>
              </div>
              <div className="content-body">
                <div className="content-table">
                  <div className="content-table-header">
                    <div className="header-title">工作项登记工时</div>
                    <Space className="header-box">
                      {/* 个人统计的级联选择器：无论什么模式都保留三级结构（空间/工作项/工作项实例） */}
                      <SpaceCascader
                        size="small"
                        style={{ width: 360 }}
                        maxLevel={3}
                        value={this.state.selfCascaderValue}
                        placeholder="空间 / 工作项 / 工作项实例"
                        onChange={(ids, names, selectedOptions) => {
                          const newIds = ids || [];
                          this.setState(
                            {
                              selfCascaderValue: selectedOptions ? selectedOptions.map(o => o.value) : [],
                              selfCascaderIds: newIds,
                              selfCascaderNames: names || {},
                            },
                            () => {
                              this.fetchQuerySelfStatData();
                            }
                          );
                        }}
                      />
                      <Input
                        size="small"
                        placeholder="输入工作项实例名称"
                        value={this.state.selfSearchValue}
                        onChange={this.onQuerySelfStatSearch}
                        style={{
                          width: 180,
                        }}
                        suffix={<SearchOutlined style={{ color: "#BBBBBB" }} />}
                      />
                      <Select
                        size="small"
                        defaultValue={this.state.currRangeType}
                        style={{
                          width: 80,
                        }}
                        onChange={this.handleRangeTypeChange}
                        options={rangeTypeOptions}
                      />
                      <Button size="small" onClick={this.onQuerySelfStatExport}>
                        导出
                      </Button>
                      <RegBtn
                        loginUser={this.props?.loginUser}
                        type="web"
                        getRegStatus={this.onRegistrationOk}
                        getRegistrationValue={this.onRegistrationOk}
                        setRegistrationValue={false}
                      />
                    </Space>
                  </div>
                  <div className={`content-table-body${this.state.selfNarrow ? ' is-narrow' : ''}`} ref={this.selfTableRef}>
                    <Table
                      size="small"
                      pagination={false}
                      tableLayout="fixed"
                      columns={this.state.querySelfStat.table_columnName}
                      dataSource={this.state.querySelfStatTableData}
                      scroll={{
                        y: "70vh",
                        x: "max-content",
                      }}
                    />
                  </div>
                </div>
              </div>
              </div>
            </Spin>
          )}
        </div>
        <MemberSelectModal
          open={this.state.isSelectedUserOpen}
          initialValue={this.state.memberSelectInitial}
          onCancel={this.handleSelectedUserCancel}
          onConfirm={this.handleMemberSelectConfirm}
          queryType={1}
        />
        <Modal
          destroyOnHidden
          title="登记工时"
          open={this.state.isRegistrationOpen}
          onCancel={() => this.setState({ isRegistrationOpen: false })}
          width={745}
          footer={null}
        >
          <RegWorkHour
            loginUser={this.props?.loginUser}
            type="web"
            getRegistrationValue={this.onRegistrationOk}
            setRegistrationValue={false}
          />
        </Modal>
        <SeatPermissionsModal
          open={this.state.modalOpen}
          code={this.state.modalCode}
          responseData={this.state.modalResponseData}
          chatUrl={this.state.chatUrl} // 可以从父组件传递，也可以在子组件固定
          onClose={() => {
            this.setState({
              modalOpen: false,
              modalCode: undefined,
              modalResponseData: undefined,
            });
          }}
        />
      </div>
    );
  }
}

export default Management;
