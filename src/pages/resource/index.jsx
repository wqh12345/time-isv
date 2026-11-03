import JSSDK from '../../jssdk-adapter'
import React, { useMemo, useState, useEffect, useRef, Component } from "react";
import {
  Checkbox,
  DatePicker,
  Button,
  Modal,
  Space,
  message,
  Dropdown,
  Divider,
  Switch,
  Popover,
  Tooltip,
  Spin,
  Select,
  Tag
} from "antd";
import {
  SettingOutlined,
  DownOutlined,
  RightCircleOutlined,
  InfoCircleFilled,
} from "@ant-design/icons";
import {
  getWeekStartAndEnd,
  getQuarterStartAndEnd,
  getFirstDayOfNaturalMonth,
  getLastDayOfNaturalMonth,
  urlDownload,
} from '../../util/util';
import {
  getUserRole,
  postWorkGanttChart,
  postWorkGanttChartNew,
  postWorkGanttChartNewV2,
  getStatConditionDetail,
  getUserNumeralConfig,
  postUserNumeralConfig,
  getUserCustomField,
  postUserCustomField,
  getRegistrantUser,
  getRefreshTeam,
  getProjectUserTeamAll,
  getreTeam,
  queryNeedShowTeamConfig,
  getSpaceOptionNew,
  queryMemberAndSpaceInfo,
  getResourceUserAttendanceConfig,
} from '../../api/api';
import "./index.less";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import RegBtn from "../../components/reg-btn/RegBtn";
import SelectedUser from "../../components/team-settings/TeamSettings";
import MemberSelectModal from "../../components/member-select-modal/MemberSelectModal";
import RegWorkHour from "../../components/reg-workHour/RegWorkHour";
import Gantt from "../../components/gantt/Gantt";
import noData from "../../assets/images/no-data-table.png";
import { gantt } from "dhtmlx-gantt";
import UserPicker from "../../components/user-picker/UserPicker";
dayjs.extend(customParseFormat);
const { RangePicker } = DatePicker;
const RESOURCE_DATE_FORMAT = "YYYY-MM-DD";

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

const isResourceDateRangeWithinSixMonths = (begin, end) => {
  if (!begin || !end) return false;
  const beginDay = dayjs(begin, RESOURCE_DATE_FORMAT, true);
  const endDay = dayjs(end, RESOURCE_DATE_FORMAT, true);
  if (!beginDay.isValid() || !endDay.isValid()) return false;
  return !endDay.isAfter(beginDay.add(6, "month"), "day");
};
class Resource extends Component {
  constructor(props) {
    super(props);
    this.isPersonal = 1;
    this.hasInitializedRefResource = false;
    this.ganttRequestId = 0;
    // 缓存最近一次 queryMemberAndSpaceInfo 的原始返回，排序时据此重排，无需重新请求接口
    this.ganttRawRes = null;
    this.state = {
      leaveByUserInfo: {},
      statisticType: 1,
      spaceIds: undefined,
      spaceOptions: [],
      beginTime:
        localStorage.getItem("resourceBeginTime") ||
        getFirstDayOfNaturalMonth(),
      endTime:
        localStorage.getItem("resourceEndTime") || getLastDayOfNaturalMonth(),
      currDropdownIndex: 1,
      queryUserId: [],
      isSynchronous: Boolean,
      isSelectedTeamAdmin: false,
      proxyFillingPerson: 0,
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
      ganttData: {
        data: [],
      },
      ganttUser: {
        data: [],
      },
      leaveByUserDate: {},
      spaceData:[],
      userConfig: {},
      userField: [],
      projectId: 0,
      showTeamConfig: false,
      removeTeamIds: [],
      removeUserIds: [],
      loading: false,
      /** 「登记工时」列排序方向：null(默认顺序) | 'asc' | 'desc'，仅在本次会话内生效 */
      registerWorkingHoursSort: null,
    };
  }
  componentDidMount() {
    this.init();
  }
  /** 刷新团队成员 */
  init = async () => {
    // this.checkedUserRole();
    // this.getRefreshTeamMember();
    // this.setState({
    //   loading: true,
    // })
    //const res = await getreTeam();
    // 获取空间选项
    await this.getSpaceOptions();
    this.getUserConfig();
    this.getUserField();
    // 空间模式：默认选中第一个空间后再调用后续接口；租户模式保持原逻辑不变
    // 先执行queryNeedShowTeamConfigData()获取团队配置
    await this.queryNeedShowTeamConfigData();
    // 确保currDropdownIndex值稳定后再执行fetchGanttData()
    this.fetchGanttData();
    // const res = await getreTeam();
    // this.fetchGanttData();
    // console.log('res2025',res)
    // setTimeout(() => {
    //   this.fetchGanttData();
    // }, 3000);
  };
  /** 获取空间选项 */
  getSpaceOptions = async () => {
    try {
      const isSpaceMode = localStorage.getItem('meegoTeamworkAppMode') === 'space';
       if (isSpaceMode) {
        const res = await getSpaceOptionNew();
        if (res?.result && res?.data?.length > 0) {
          const options = res.data.map(item => ({
            label: item.name || item.label,
            value: item.id || item.value
          }));
          this.setState({ spaceOptions: options });
           if (options?.length > 0) {
            let isExist = options.some(item => item.value === localStorage.getItem('resourceSpaceId'));
            if (isExist) {
              await new Promise(resolve => this.setState({ spaceIds: localStorage.getItem('resourceSpaceId') }, resolve));
            } else {
              await new Promise(resolve => this.setState({ spaceIds: options[0].value }, resolve));
            }
          }
        }
      }
    } catch (error) {
      console.error('获取空间数据失败:', error);
    }
  };
  /** 刷新团队成员 */
  getRefreshTeamMember = async () => {
    const projectKey = sessionStorage.getItem('jwtMeegoTeamworkProjectKey');
    const res = await getRefreshTeam({ projectKey });
    if (res?.result) {
    }
  };
  /** 校验管理员权限 */
  checkedUserRole = async () => {
    const res = await getUserRole();
    if (res?.result) {
      sessionStorage.setItem("jwtMeegoTeamworkUserRole", res.data);
    }
  };
  /** 是否显示团队设置 */
  queryNeedShowTeamConfigData = async () => {
    try {
      const res = await queryNeedShowTeamConfig();
      if (res?.result) {
        this.isPersonal = res.data ? 0 : 1;
        this.setState({
          currDropdownIndex: res.data ? 0 : 1,
          showTeamConfig: res.data || false,
        });
      }
    } catch (e) {
      console.error('查询团队设置配置失败:', e);
    }
  };
  /** 获取以往查询条件（统一接口，locationType=0 资源管理） */
  getHistoryState = async () => {
    const { selected } = this.state;
    const res = await getStatConditionDetail({ locationType: 0 });
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
      this.setState({
        selected: next,
        newSelected: next,
        isSynchronous: !!d.isSynchronous,
        isAllUser: !!d.isAllUser,
        isAllTeam: !!d.isAllTeam,
        isSelectedTeamAdmin: !!d.isSelectedTeamAdmin,
        memberSelectInitial: {
          selectUserList: d?.selectUserList || [],
          selectOrgList: d.selectOrgList || [],
          selectTeamList: d.selectTeamList || [],
          isSynchronous: !!d.isSynchronous,
          isSelectedTeamAdmin: !!d.isSelectedTeamAdmin,
          isAllUser: !!d.isAllUser,
          isAllTeam: !!d.isAllTeam,
        },
      });
    }
  };

  /** 将甘特成员行对应日期的请假状态整理为只读映射。 */
  getLeaveFlagMap = async (members, beginTime, endTime, spaceIds, requestId) => {
    const userKeys = [...new Set((members || []).map((item) => item?.userKey).filter(Boolean))];
    if (!userKeys.length) return {};

    const isSpaceMode = localStorage.getItem('meegoTeamworkAppMode') === 'space';
    const params = {
      items: userKeys.map((userKey) => ({
        projectKey: isSpaceMode ? spaceIds : null,
        userKey,
      })),
      startDate: beginTime,
      endDate: endTime,
    };
    
    try {
      const res = await getResourceUserAttendanceConfig(params);
      if (requestId !== this.ganttRequestId) return null;
      const leaveMap = {};
      const projects = res?.result && res?.data ? res.data.projects : [];
      (Array.isArray(projects) ? projects : []).forEach((project) => {
        Object.entries(project?.userKeys || {}).forEach(([userKey, dates]) => {
          Object.entries(dates || {}).forEach(([date, attendance]) => {
            if (attendance?.leaveFlag === true) {
              if (!leaveMap[userKey]) leaveMap[userKey] = {};
              leaveMap[userKey][date] = true;
            }
          });
        });
      });
      return leaveMap;
    } catch (error) {
      if (requestId === this.ganttRequestId) {
        console.error('获取甘特图考勤数据失败:', error);
      }
      return {};
    }
  };

  /** 统一整理并提交甘特图数据，保证甘特查询与考勤查询属于同一请求序列。 */
  applyGanttResponse = async (res, requestId, beginTime, endTime, spaceIds,isSort = false) => {
    const { leaveByUserInfo } = this.state;
    if (requestId !== this.ganttRequestId) return;
    if (!res?.result || !res?.data) {
      console.error('接口返回数据异常:', res);
      return;
    }

    // 缓存原始返回，排序时基于它重新生成成员数据，避免重新请求接口
    if(res?.data){
      this.ganttRawRes = JSON.parse(JSON.stringify(res));
    }
    const rawData = Array.isArray(res.data.data) ? res.data.data : [];
    const controls = {};
    const members = [];
    rawData.forEach((item) => {
      item.projectNo = item.id;
      if (item.isUser === true) {
        members.push(item);
      } else {
        // 非成员行（空间/工作项/工作项实例/节点/任务）保持原始顺序，不影响展开时的顺序
        const parentId = item.parent;
        if (!controls[parentId]) controls[parentId] = [];
        controls[parentId].push(item);
      }
    });
    let leaveByUserDate={};

    if(isSort){
      leaveByUserDate = leaveByUserInfo || {};
    }else{
      leaveByUserDate = await this.getLeaveFlagMap(
        members,
        beginTime,
        endTime,
        spaceIds,
        requestId,
      );
      this.setState({
        leaveByUserInfo: leaveByUserDate || {},
      });
    }
    if (requestId !== this.ganttRequestId) return;

    if (rawData.length === 0) {
      const emptyData = {
        ...res.data,
        data: [{
          projectNo: "-",
          projectName: `<div style="color:#bbb;font-size:24px;margin-left: 50px;height:${window.screen.height - 490}px;"> 暂无数据 </div>`,
        }],
      };
      this.setState({
        ganttData: emptyData,
        ganttUser: JSON.parse(JSON.stringify(emptyData)),
        leaveByUserDate: leaveByUserDate || {},
      });
      return;
    }
    // 按当前排序方向，从缓存的原始数据生成成员数据
    const membersInfo = this.buildGanttMembersInfo(
      res,
      this.state.registerWorkingHoursSort,
    );
    //console.log('leaveByUserDate',leaveByUserDate);
    this.setState({
      spaceData: controls,
      ganttData: membersInfo,
      ganttUser: JSON.parse(JSON.stringify(membersInfo)),
      leaveByUserDate: leaveByUserDate || {},
    });
  };

  /**
   * 依据缓存的 queryMemberAndSpaceInfo 原始返回，生成甘特成员数据。
   * direction 为空时保持原始顺序；为 'asc'/'desc' 时按 registerWorkingHours 升/降序（空值/0 排最后）。
   * 数组 sort 为稳定排序，同值时保持原始相对顺序。
   */
  buildGanttMembersInfo = (res, direction) => {
    const rawData = Array.isArray(res?.data?.data) ? res.data.data : [];
    return {
      data: rawData.filter((item) => item?.isUser === true),
      notWorkingDayCount: res.data.notWorkingDayCount || 0,
      workingDayCount: res.data.workingDayCount || 0,
      totalWorkingDayCount: res.data.totalWorkingDayCount || 0,
      registerWorkingHoursTotal: res.data.registerWorkingHoursTotal || 0,
      standardHumanDaysTotal: res.data.standardHumanDaysTotal || 0,
    };
  };
  /**
   * 等待甘特图完成本次重绘后再隐藏排序 loading。
   * 双 requestAnimationFrame：确保在 React commit 与甘特图 useEffect(gantt.parse/render) 之后、下一帧绘制完成再隐藏。
   */
  hideSortLoading = () => {
    const done = () => this.setState({ loading: false });
    requestAnimationFrame(() => requestAnimationFrame(done));
    // 兜底：后台标签页 rAF 可能不触发，避免 loading 卡住
    setTimeout(done, 500);
  };
  /**
   * 点击「登记工时」列头图标：升序 ↔ 降序 切换。
   * 点击后显示 loading，待排序数据经 applyGanttResponse 更新、甘特图重新渲染完成后再隐藏。
   */
  onRegisterWorkingHoursSortChange = async () => {
    // 点击排序：先显示 loading，甘特图重绘完成后再隐藏
    this.setState({ loading: true });

    const rawRes = this.ganttRawRes;
    // 无缓存/空数据：立即隐藏并返回（同时避免 rawRes.data.data 空指针报错导致 loading 卡住）
    if (!rawRes?.data?.data?.length) {
      this.setState({ loading: false });
      return;
    }

    const nextSort = this.state.registerWorkingHoursSort === "asc" ? "desc" : "asc";

    function sortByField(list, key, order = "desc") {
      if (!Array.isArray(list)) return [];
      const sorted = [...list];
      sorted.sort((a, b) => {
        const valA = Number(a[key]) || 0;
        const valB = Number(b[key]) || 0;
        return order === "asc" ? valA - valB : valB - valA;
      });
      return sorted;
    }

    rawRes.data.data = sortByField(rawRes.data.data, "registerWorkingHours", nextSort);
    this.setState({
      registerWorkingHoursSort: nextSort,
    });

    const requestId = ++this.ganttRequestId;
    const { spaceIds, beginTime, endTime } = this.state;
    try {
      await this.applyGanttResponse(rawRes, requestId, beginTime, endTime, spaceIds,true);
    } finally {
      // 数据 setState 完成后，再等甘特图重绘完成隐藏 loading
      this.hideSortLoading();
    }
  };

  /** 获取甘特图 */
  fetchGanttData = async (n) => {
    const requestId = ++this.ganttRequestId;
    const { spaceIds, beginTime, endTime,statisticType,queryUserId} = this.state;
    const data = {
      statisticType: this.isPersonal,
      projectKeys: spaceIds ? [spaceIds] : [],
      startDate: beginTime + " 00:00:00",
      endDate: endTime + " 23:59:59",
      proxyFillingPerson: this.state.proxyFillingPerson || 0,
    }
   let searchUsers = [];
    if (queryUserId.indexOf("-111") !== -1) {
      const data = {
        startDate: beginTime,
        endDate: endTime,
      };
      const res = await getRegistrantUser(data);
      if (res?.result) {
        searchUsers = res.data || [];
      }
    } else {
      searchUsers = queryUserId;
    }
    data.queryUserId = searchUsers
    this.setState({
      loading: true,
    })
    try {
      const res = await queryMemberAndSpaceInfo(data);
      await this.applyGanttResponse(res, requestId, beginTime, endTime, spaceIds);
    } finally {
      this.setState({
        registerWorkingHoursSort: null,
      })
      if (requestId === this.ganttRequestId) this.setState({ loading: false });
    }
  };

  /** 时间改变 */
  onTimeChange = (date, dateString) => {
    const nextBeginTime = dateString?.[0];
    const nextEndTime = dateString?.[1];
    if (!isResourceDateRangeWithinSixMonths(nextBeginTime, nextEndTime)) {
      JSSDK.toast.warning("选择时间范围不能超过6个月");
      return;
    }
    localStorage.setItem("resourceBeginTime", dateString[0]);
    localStorage.setItem("resourceEndTime", dateString[1]);
    this.setState(
      {
        beginTime: nextBeginTime,
        endTime: nextEndTime,
      },
      () => {
        this.fetchGanttData();
      }
    );
  };

  /** 统计纬度切换 */
  onDropdownChange = (e) => {
    this.isPersonal = e;
    this.setState({ currDropdownIndex: e }, () => {
      this.fetchGanttData();
    });
  };

  /** 人员筛选 */
  onSearchPersonChange = async (user) => {
    user.length
      ? this.setState({ proxyFillingPerson: 1 })
      : this.setState({ proxyFillingPerson: 0 });
    const { beginTime, endTime } = this.state;
    this.setState({ queryUserId: user }, () => {
      this.fetchGanttData();
    });
  };

  /** 打开人员选择器 */
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
      this.fetchGanttData(1);
    });
  };

  /** MemberSelectModal 确认：按 /resourceManagement/queryWorkGanttChart 接口入参构造 payload 并调用接口 */
  handleMemberSelectConfirm = async (data) => {
    const selectedUserIds = (data.selectedMembers || []).map(m => m.id);
    const selectedDepartIds = [
      ...(data.selectedTeams || []).map(t => t.id),
      ...(data.selectedDepartments || []).map(d => d.id),
    ];
    if (!selectedUserIds.length && !selectedDepartIds.length) {
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

    const { beginTime, endTime, currDropdownIndex, queryUserId, proxyFillingPerson, spaceIds } = this.state;
    const requestId = ++this.ganttRequestId;
    const payload = {
      projectKeys: spaceIds ? [spaceIds] : [],
      statisticType: this.isPersonal ? 1 : currDropdownIndex,
      startDate: beginTime+ " 00:00:00",
      endDate: endTime+ " 23:59:59",
      isSynchronous: !!data.isSynchronous,
      queryUserId: queryUserId || [],
      proxyFillingPerson: proxyFillingPerson || 0,
      isAllUser: data.isAllUser || false,
      isAllTeam: data.isAllTeam || false,
      isAllDepartment: data.isAllDepartment || false,
      isSelectedTeamAdmin: !!data.selectTeamAdmin,
      selectUserList,
      selectOrgList,
      selectTeamList,
    };

    const newSelected = {
      ...this.state.selected,
      selectedUserIds,
      selectedDepartIds,
    };

    this.setState({
      isSelectedUserOpen: false,
      newSelected,
      selected: newSelected,
      isSynchronous: !!data.isSynchronous,
      isSelectedTeamAdmin: !!data.selectTeamAdmin,
      loading: true,
    });

    try {
      const res = await queryMemberAndSpaceInfo(payload);
      await this.applyGanttResponse(res, requestId, beginTime, endTime, spaceIds);
    } finally {
      if (requestId === this.ganttRequestId) this.setState({ loading: false });
    }
  };

  getSelectedUser = (e) => {
    this.setState({ selected: e });
  };

  /** 导出Gantt */
  onGanttExport = async () => {
    // const { newSelected, beginTime, endTime, currRangeType } = this.state;
    // const data = {
    //   userId: newSelected.selectedUserIds,
    //   startDate: beginTime + " 00:00:00",
    //   endDate: endTime + " 23:59:59",
    //   rangeType: currRangeType,
    // };
    // const res = await postAdminExportStaffStat(data);
    // if (res?.result) {
    //   urlDownload(res.data.url);
    // }
  };

  /** 提交实际工时 */
  onRegistrationOk = async (result) => {
    if (result) {
      this.fetchGanttData();
    }
    this.setState({ isRegistrationOpen: false });
  };

  onGanttChange = (result) => {
    if (result) {
      this.fetchGanttData();
    }
  };

  /** 获取用户级别配置 */
  getUserConfig = async () => {
    const data = {
      type: "ONLY_CALCULATE_WORKING_DAYS",
      projectKey: this.state.spaceIds,
    };
    const res = await getUserNumeralConfig(data);
    if (res?.result) {
      this.setState({ userConfig: res.data });
    }
  };

  /** 用户级别配置修改 */
  onUserConfigChange = async (val) => {
    const data = {
      type: "ONLY_CALCULATE_WORKING_DAYS",
      id: this.state.userConfig?.id,
      value: val ? 1 : 0,
      projectKey: this.state.spaceIds
    };
    const res = await postUserNumeralConfig(data);
    if (res?.result) {
      this.getUserConfig();
      JSSDK.toast.success("设置成功");
      this.fetchGanttData();
    }
  };

  /** 获取用户自定义展示字段 */
  getUserField = async () => {
    const data = {
      type: "WORKING_HOURS_RESOURCES_GANTT_CHART",
      projectKey: this.state.spaceIds,
    };
    const res = await getUserCustomField(data);
    if (res?.result) {
      this.setState({ userField: res.data });
    }
  };

  /** 用户自定义展示字段修改 */
  onUserFieldChange = async (val, index) => {
    const { userField } = this.state;
    userField[index].checked = val.target.checked;
    const data = userField;
    const res = await postUserCustomField(data);
    if (res?.result) {
      this.getUserField();
      JSSDK.toast.success("设置成功");
    }
  };

  disabledResourceDate = (current, info) => {
    if (!current) return false;

    const fromDate = info?.from;
    if (fromDate) {
      return (
        current.isBefore(fromDate.subtract(6, "month"), "day") ||
        current.isAfter(fromDate.add(6, "month"), "day")
      );
    }

    return false;
  };

  render() {
    return (
      <Spin spinning={this.state.loading}>
      <div className="resource-warp">
        <div className="resource-top">
          <Space className="top-left">
            {this.state.userConfig?.value ? (
              <div>
                工作日/非工作日（天）
                <Tooltip
                  className="user-tooltip"
                  placement="bottom"
                  title={
                    <React.Fragment>
                      <div>此统计基于默认日历（周六日为休息日）计算。不同成员的工作日 / 休息日设置与记录规则设置相关，具体可查看成员行标准人天。</div>
                    </React.Fragment>
                  }
                >
                  <InfoCircleFilled style={{ color: "#bbb" }} />
                </Tooltip>
                ：
                <span style={{ fontWeight: "bold" }}>
                  {this.state.ganttData?.workingDayCount}/
                  {this.state.ganttData?.notWorkingDayCount}
                </span>
              </div>
            ) : (
              <div></div>
            )}
          </Space>
          <Space className="top-right">
            <RangePicker
              className="time-picker"
              size="small"
              allowClear={false}
              presets={rangePresets}
              value={
                this.state.beginTime && this.state.endTime
                  ? [dayjs(this.state.beginTime), dayjs(this.state.endTime)]
                  : []
              }
              disabledDate={this.disabledResourceDate}
              onChange={this.onTimeChange}
            />
            {localStorage.getItem('meegoTeamworkAppMode') === 'space' && (
              <Select
                showSearch
                value={this.state.spaceIds}
                style={{ width: 250 }}
                onChange={(val) => {
                  this.setState({ spaceIds: val }, () => {
                    localStorage.setItem('resourceSpaceId', val);
                    this.getUserConfig();
                    this.getUserField();
                    this.fetchGanttData();
                  });
                }}
                placeholder="请选择空间"
                size="small"
                options={this.state.spaceOptions}
                filterOption={(input, option) => {
                  var _a;
                  return (
                    (_a = option?.label) !== null && _a !== void 0
                      ? _a
                      : ""
                  )
                    .toLowerCase()
                    .includes(input.toLowerCase());
                }}
              />
            )}
            {this.state.showTeamConfig && this.state.dropdownItems[this.state.currDropdownIndex].key === 0 ? (
              <Button
                icon={<RightCircleOutlined />}
                iconPosition="end"
                type="link"
                onClick={this.onSelectedUserOpen}
              >
                团队设置
              </Button>
            ) : null}
            {this.state.showTeamConfig ? (
              <Dropdown
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
            <RegBtn
              loginUser={this.props?.loginUser}
              type="web"
              getRegStatus={this.onRegistrationOk}
              getRegistrationValue={this.onRegistrationOk}
              setRegistrationValue={false}
            />
          </Space>
        </div>
        <div className="resource-content">
          <div className="resource-content-top">
            <div className="resource-content-picker">
              <div
                style={{
                  display:
                    sessionStorage.getItem("meegoTeamworkUserRole") ===
                      "member"
                      ? "none"
                      : "",
                }}
              >
                <UserPicker
                  type="Gantt"
                  mode="multiple"
                  placeholder="搜索成员"
                  getUserIds={this.onSearchPersonChange}
                />
              </div>
            </div>
            <div className="resource-content-set">
              <Popover
                className="popover-config"
                placement="bottom"
                trigger="click"
                style={{ marginTop: -20, marginLeft: -12 }}
                content={
                  <Space direction="vertical">
                    {this.state.userField.map((item, index) => {
                      return (
                        <div key={item.configType}>
                          <Checkbox
                            checked={item.checked}
                            onChange={(val) =>
                              this.onUserFieldChange(val, index)
                            }
                            disabled={true}
                          >
                            {item.configName}
                          </Checkbox>
                        </div>
                      );
                    })}
                    <Divider
                      style={{
                        margin: 0,
                      }}
                    />
                    <Space
                      style={{
                        padding: 0,
                      }}
                    >
                      仅计算工作日
                      <Tooltip title="开启后只合计工作日的数据">
                        <InfoCircleFilled color="#bbb" />
                      </Tooltip>
                      <Switch
                        size="small"
                        checked={this.state.userConfig?.value ? true : false}
                        onChange={this.onUserConfigChange}
                      />
                    </Space>
                  </Space>
                }
              >
                <SettingOutlined
                  className="set-icon"
                  style={{ marginLeft: 5 }}
                />
              </Popover>
            </div>
          </div>
          {/* {this.state.userField.length ? ( */}
          <Gantt
            id="gantt"
            userConfig={this.state.userConfig?.value ? true : false}
            type={this.state.currDropdownIndex}
            userField={this.state.userField}
            time={[this.state.beginTime, this.state.endTime]}
            tasks={this.state.ganttData}
            ganttUser={this.state.ganttUser}
            leaveByUserDate={this.state.leaveByUserDate}
            getDataChange={this.onGanttChange}
            spaceData={this.state.spaceData}
            spaceIds={this.state.spaceIds}
            registerWorkingHoursSort={this.state.registerWorkingHoursSort}
            onRegisterWorkingHoursSortChange={this.onRegisterWorkingHoursSortChange}
          />
          {/* ) : null} */}
        </div>
        <MemberSelectModal
          open={this.state.isSelectedUserOpen}
          initialValue={this.state.memberSelectInitial}
          onCancel={this.handleSelectedUserCancel}
          onConfirm={this.handleMemberSelectConfirm}
          queryType={0}
        />
        <Modal
          destroyOnHidden
          title={"登记工时"}
          open={this.state.isRegistrationOpen}
          onCancel={() => this.setState({ isRegistrationOpen: false })}
          width={745}
          footer={null}
          styles={{ body: { paddingBottom: 16, overflowX: 'hidden' } }}
        >
          <RegWorkHour
            loginUser={this.props?.loginUser}
            type="web"
            getRegistrationValue={this.onRegistrationOk}
            setRegistrationValue={false}
          />
        </Modal>
      </div>
      </Spin>
    );
  }
}

export default Resource;
