import React, { useState } from "react";
import { DatePicker, Space, Tooltip, Radio, Select, Input } from "antd";
import {
  InfoCircleFilled,
  SearchOutlined,
} from "@ant-design/icons";
import {
  getWeekStartAndEnd,
  getLastWeekRange,
  getLastMonthRange,
} from '../../../util/util';
import UserPicker from "../../user-picker/UserPicker";
import SmartSelect from "../SmartSelect";
import WorkSaturationAlert from "./WorkSaturationAlert";
import { rangePresets } from "../utils";
import dayjs from "dayjs";

const { RangePicker } = DatePicker;

/** 批量登记头部筛选区域 */
const RegWorkHourHeader = ({
  props,
  loginUser,
  type,
  loading,
  tableLoading,
  // registerCacheLoading,  // [注释] 缓存功能
  isAllowRegister,
  registrantUserKey,
  userPickerKey,
  onSearchPersonChange,
  setPickerUser,
  workItemIds,
  setWorkItemIds,
  setSearchWorkItemIds,
  setSearchWorkItemEntityIds,
  workItemEntityIds,
  setWorkItemEntityIds,
  workItemIdsFilter,
  setWorkItemIdsFilter,
  setIsWorkItemChanged,
  workItemOptions,
  workItemOptionsLoading,
  debouncedWorkItemDeselect,
  debouncedWorkItemEntityDeselect,
  onWorkItemChange,
  fetchOptions,
  isModalVisible,
  modalLockRef,
  checkWorkInstanceDataSource,
  // setHasCache,  // [注释] 缓存功能
  // setExcludeWorkItemEntityIdListCache,  // [注释] 缓存功能
  // excludeWorkItemEntityIdListCacheRef,  // [注释] 缓存功能
  // cacheWorkInstanceDataSourceRef,  // [注释] 缓存功能
  beginWorkDate,
  endWorkDate,
  beginWorkDateCP,
  endWorkDateCP,
  onWorkDateChange,
  onWorkDateBtnChange,
  minWorkDate,
  maxWorkDate,
  disabledWorkDate,
  scheduleStart,
  scheduleEnd,
  onScheduleChange,
  showResponsibleFilter,
  isPersonInCharge,
  setIsPersonInCharge,
  showAllResponsibleOptions,
  onResponsibleFilterChange,
  workDate,
  alertDetail,
  attendanceEnabled,
  attendanceHours,
  missPunchPolicy,
  onSyncAttendance,
  setUpdateEditData,
  selectedSpaceKeys,
  spaceOptions,
  spaceLoading,
  onSpaceChange,
  isCustomFieldEnabled,
  debouncedSpaceDeselect,
  handleSpaceBlur,
}) => {
  const isStandardMode = type !== "tab";

  // 工作项下拉顶部内嵌搜索词：按 label 本地模糊过滤（不区分大小写）
  const [workItemSearch, setWorkItemSearch] = useState("");
  const workItemKeyword = workItemSearch.trim().toLowerCase();
  const filteredWorkItemOptions = (workItemOptions || []).filter(
    (item) => !workItemKeyword || (item?.label ?? "").toLowerCase().includes(workItemKeyword),
  );

  return (
    <div
      className={`regWorkHourBatchNew-header${isStandardMode ? " standard-layout" : ""}`}
    >
      <Space className="header-box filter-member">
        <span>当前登记工时成员</span>
        <UserPicker
          key={userPickerKey}
          size="small"
          loginUser={loginUser}
          registrantUserKey={registrantUserKey}
          disabled={
           loading || tableLoading || !isAllowRegister ||
            localStorage.getItem("meegoTeamworkUserRole") == "member" // || registerCacheLoading  // [注释] 缓存功能
          }
          value={registrantUserKey}
          allowClear={loginUser?.userKey === registrantUserKey ? false : true}
          getUserIds={onSearchPersonChange}
          getPickerUser={(val) => {setPickerUser(val); }}
        />
      </Space>

      {type !== "tab" && (
        <>
          <br />
          <Space className="header-box filter-space">
            <span className="title">选择空间</span>
            {localStorage.getItem('meegoTeamworkAppMode') === 'space' ? (
              // 空间模式：单选 + 搜索
              <Select
                showSearch
                allowClear
                value={selectedSpaceKeys?.[0]}
                style={{ width: isStandardMode ? "100%" : 575 }}
                // 单选返回字符串，统一封装为数组传给 onSpaceChange，兼容下游逻辑；清除时返回空数组触发删除
                onChange={(val) => onSpaceChange(val ? [val] : [])}
                size="small"
                options={spaceOptions}
                placeholder="请选择空间"
                loading={spaceLoading}
                disabled={loading || tableLoading || false /* registerCacheLoading */}  // [注释] 缓存功能
                filterOption={(input, option) =>
                  (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                }
              />
            ) : (
              // 租户模式：多选（保持原有逻辑不变）
              <Select
                mode="multiple"
                value={selectedSpaceKeys}
                style={{ width: isStandardMode ? "100%" : 575 }}
                onChange={onSpaceChange}
                size="small"
                options={spaceOptions}
                maxCount={3}
                maxTagCount="responsive"
                maxTagPlaceholder={(omittedValues) => (
                  <Tooltip
                    title={
                      <div style={{ maxWidth: "300px", maxHeight: "200px", overflow: "auto", padding: "4px 0" }}>
                        {omittedValues.map((item) => (
                          <div key={item.value} style={{ padding: '2px 8px' }}>{item.label}</div>
                        ))}
                      </div>
                    }
                  >
                    <span>+{omittedValues?.length}</span>
                  </Tooltip>
                )}
                placeholder="请选择空间"
                loading={spaceLoading}
                disabled={loading || tableLoading || false /* registerCacheLoading */}  // [注释] 缓存功能
                // disabled={loading || tableLoading || registerCacheLoading}  // [original]
                filterOption={(input, option) =>
                  (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                }
              />
            )}
          </Space>
        </>
      )}

      {type === "tab" ? (
        <br />
      ) : (
        <>
          <br />
          <Space className="header-box filter-work-item-type">
            <span className="title">选择工作项类型</span>
            <Select
              mode="multiple"
              value={workItemIds}
              style={{ width: isStandardMode ? "100%" : 575 }}
              // 禁用内联搜索，只用下拉顶部内嵌搜索框
              showSearch={false}
              onOpenChange={(open) => {
                // 收起时清空搜索词，下次打开恢复完整列表
                if (!open) setWorkItemSearch("");
              }}
              popupRender={(menu) => (
                <>
                  <div style={{ padding: "8px 8px 4px", borderBottom: "1px solid #f0f0f0" }}>
                    <Input
                      size="small"
                      allowClear
                      placeholder="搜索"
                      prefix={<SearchOutlined />}
                      value={workItemSearch}
                      onChange={(e) => setWorkItemSearch(e.target.value)}
                      // 阻止冒泡：点搜索框不关闭下拉
                      onMouseDown={(e) => e.stopPropagation()}
                      // 阻止键盘事件冒泡给 Select（Portal 沿组件树冒泡），
                      // 避免 Backspace/Enter 被 rc-select 拦截误删已选工作项
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  {menu}
                </>
              )}
              onChange={(val) => {
                if (modalLockRef.current || isModalVisible) return;
                const isHasContent = checkWorkInstanceDataSource();
                if (!isHasContent) {
                  // setExcludeWorkItemEntityIdListCache([]);  // [注释] 缓存功能
                  // excludeWorkItemEntityIdListCacheRef.current = [];  // [注释] 缓存功能
                  // cacheWorkInstanceDataSourceRef.current = [];  // [注释] 缓存功能
                }
                // setHasCache(false);  // [注释] 缓存功能
                setIsWorkItemChanged(true);
                setWorkItemIds(val);
                setSearchWorkItemIds(val);
                setSearchWorkItemEntityIds(workItemEntityIds);
              }}
              onBlur={onWorkItemChange}
              size="small"
              options={filteredWorkItemOptions}
              maxCount={10}
              maxTagCount="responsive"
              maxTagPlaceholder={(omittedValues) => (
                <Tooltip
                  title={
                    <div style={{ maxWidth: "300px", maxHeight: "200px", overflow: "auto", padding: "4px 0" }}>
                      {omittedValues.map((item, index) => (
                        <div key={index} style={{ padding: '2px 8px' }}>{item.label}</div>
                      ))}
                    </div>
                  }
                >
                  <span>+{omittedValues?.length}</span>
                </Tooltip>
              )}
              disabled={loading || tableLoading || isModalVisible || workItemOptionsLoading || false /* registerCacheLoading */ || !selectedSpaceKeys?.length}  // [注释] 缓存功能
              onDeselect={debouncedWorkItemDeselect}
              placeholder={!selectedSpaceKeys?.length ? "请先选择空间" : "请选择工作项类型"}
              filterOption={(input, option) => {
                var _a;
                return ((_a = option?.label) !== null && _a !== void 0 ? _a : "")
                  .toLowerCase().includes(input.toLowerCase());
              }}
            />
          </Space>
          <br />
          <Space className="header-box filter-work-item-instance">
            <span>工作项实例</span>
            <SmartSelect
              type="search"
              size="small"
              style={{ width: isStandardMode ? "100%" : 605 }}
              mode="multiple"
              isCustomFieldEnabled={isCustomFieldEnabled}
              workItemIds={workItemIds}
              workItemEntityIds={workItemEntityIds}
              disabled={loading || !selectedSpaceKeys?.length || !workItemIds?.length || tableLoading || false /* registerCacheLoading */}  // [注释] 缓存功能
              fetchOptions={fetchOptions}
              onChange={(val) => {
                if (!val?.length) setUpdateEditData([]);
                // setHasCache(false);  // [注释] 缓存功能
                setIsWorkItemChanged(true);
                setWorkItemEntityIds(val);
                setSearchWorkItemEntityIds(val);
                setSearchWorkItemIds(workItemIds);
              }}
              getWorkItemIdsFilter={(val) => {
                const valArr = val.map((item) => ({
                  workItemId: JSON.parse(item.value)?.workItemId,
                  workItemEntityId: JSON.parse(item.value)?.value,
                  workItemEntityName: JSON.parse(item.value)?.label,
                  customFieldValue: JSON.parse(item.value)?.customFieldValue,
                }));
                setIsWorkItemChanged(true);
                setWorkItemIdsFilter(valArr);
                setWorkItemEntityIds(val.map((item) => item.value));
                setSearchWorkItemEntityIds(val.map((item) => item.value));
              }}
              placeholder={!selectedSpaceKeys?.length ? "请先选择空间" : !workItemIds?.length ? "请先选择工作项类型" : "请搜索选择工作项实例"}
              onBlur={onWorkItemChange}
              onDeselect={debouncedWorkItemEntityDeselect}
              maxTagCount="responsive"
              maxTagPlaceholder={(omittedValues) => (
                <Tooltip
                  styles={{ root: { pointerEvents: "none" } }}
                  title={omittedValues.map(({ label }) => label).join("，")}
                >
                  <span>+{omittedValues?.length ? omittedValues?.length : ""}</span>
                </Tooltip>
              )}
            />
          </Space>
          <br />
        </>
      )}

      <Space className="header-box filter-work-date">
        <span className="filter-label-with-tooltip">填报工作日期
          <Tooltip placement="bottom" title="按实际发生工作时间的日期筛选登记日期范围">
            <InfoCircleFilled className="des-icon" />
          </Tooltip>
        </span>
        <RangePicker
          size="small"
          allowClear={false}
          disabled={loading || tableLoading || false /* registerCacheLoading */}  // [注释] 缓存功能
          className="top-item time-picker"
          onChange={onWorkDateChange}
          disabledDate={disabledWorkDate}
          minDate={minWorkDate ? dayjs(minWorkDate) : null}
          maxDate={maxWorkDate ? dayjs(maxWorkDate) : null}
          value={
            beginWorkDateCP && endWorkDateCP
              ? [dayjs(beginWorkDateCP), dayjs(endWorkDateCP)]
              : []
          }
          onOpenChange={() => {
            // Handled by parent - reset min/max dates
          }}
        />
        <Radio.Group
          value={`${beginWorkDate}~${endWorkDate}`}
          size="small"
          onChange={onWorkDateBtnChange}
          disabled={loading || tableLoading || false /* registerCacheLoading */}  // [注释] 缓存功能
        >
          <Radio.Button value={`${dayjs(new Date()).format("YYYY-MM-DD")}~${dayjs(new Date()).format("YYYY-MM-DD")}`}>今天</Radio.Button>
          <Radio.Button value={`${getWeekStartAndEnd().Monday}~${getWeekStartAndEnd().Sunday}`}>本周</Radio.Button>
          <Radio.Button value={`${getLastWeekRange().Monday}~${getLastWeekRange().Sunday}`}>上周</Radio.Button>
          <Radio.Button value={`${getLastMonthRange().start}~${getLastMonthRange().end}`}>上个月</Radio.Button>
        </Radio.Group>
      </Space>
      <br />

      <Space className="header-box filter-schedule">
        <span className="filter-label-with-tooltip">按项目排期筛选
          <Tooltip placement="bottom" title="按登记对象所处的项目排期进行筛选">
            <InfoCircleFilled className="des-icon" />
          </Tooltip>
        </span>
        <RangePicker
          size="small"
          allowClear
          disabled={loading || tableLoading || false /* registerCacheLoading */}  // [注释] 缓存功能
          className="top-item time-picker"
          presets={rangePresets}
          value={
            scheduleStart && scheduleEnd
              ? [dayjs(scheduleStart), dayjs(scheduleEnd)]
              : []
          }
          onChange={onScheduleChange}
        />
      </Space>
      <br />

      <Space className="header-box filter-responsible">
        <span>按登记对象负责人筛选
          <Tooltip placement="bottom" title="因管理员设置，筛选结果按各空间权限生效，部分空间仅展示当前成员负责的对象">
          <InfoCircleFilled className="des-icon" style={{ marginLeft: 3 }} />
        </Tooltip>
        </span>
        {showResponsibleFilter && (
          <Radio.Group
            disabled={loading || tableLoading || false /* registerCacheLoading */}  // [注释] 缓存功能
            onChange={onResponsibleFilterChange || ((e) => setIsPersonInCharge(e.target.value))}
            value={isPersonInCharge}
            options={
              showAllResponsibleOptions === 1
                ? [{ value: 0, label: "当前成员为负责人" }]
                : [
                  { value: 0, label: "当前成员为负责人" },
                  { value: 1, label: "全部负责人" },
                ]
            }
          />
        )}
      </Space>

      <WorkSaturationAlert
        workDate={workDate}
        alertDetail={alertDetail}
        attendanceEnabled={attendanceEnabled}
        attendanceHours={attendanceHours}
        missPunchPolicy={missPunchPolicy}
        onSyncAttendance={onSyncAttendance}
      />
    </div>
  );
};

export default RegWorkHourHeader;
