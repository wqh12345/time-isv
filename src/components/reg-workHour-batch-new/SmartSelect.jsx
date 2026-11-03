import React, { useState, useEffect, useRef, useMemo } from "react";
import { Select, Spin, Empty, Input } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import debounce from "lodash/debounce";
import noDataTable from "../../assets/images/no-data-table.png";
import CustomFieldCascaderOption from "../custom-field-cascader-option/CustomFieldCascaderOption";

/**
 * 工作项实例 value 串的唯一序列化入口。
 * rc-select 以 value 字符串“全等”判定选中态，所有生成该串的地方
 * （搜索 options / 记忆恢复 / 其他回写路径）必须共用此函数，
 * 字段集与顺序固定：workItemId, label, value, customFieldValue。
 */
export const buildEntityValue = ({ workItemId, label, value, customFieldValue }) =>
  JSON.stringify({ workItemId, label, value, customFieldValue });

/**
 * value 串 → option 的统一反解（回显重建共用）。
 * customFieldValue 从串内解析（旧实现误写为 item?.customFieldValue，
 * item 是字符串恒取不到，重建后自定义字段展示丢失，这里一并修正）。
 */
export const parseEntityValue = (raw) => {
  const parsed = JSON.parse(raw);
  return {
    label: parsed?.label,
    value: raw,
    customFieldValue: parsed?.customFieldValue,
  };
};

/**
 * 工作项实例主键：串内 value 字段（`${projectKey}-${workItemId}-${entityId}`）。
 * 选中态/去重一律按主键匹配，不依赖整串全等——记忆恢复串与搜索串
 * 在 label/customFieldValue 等字段上可能存在细微差异，整串比较无法根治重复添加。
 */
const getEntityKey = (raw) => {
  try {
    return JSON.parse(raw)?.value ?? raw;
  } catch {
    return raw;
  }
};

// 按主键去重：同一实例保留首个出现的串
const dedupeByEntityKey = (list) => {
  const seen = new Set();
  return (list || []).filter((raw) => {
    const key = getEntityKey(raw);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const SmartSelect = ({
  fetchOptions,
  workItemIds,
  workItemEntityIds,
  debounceTimeout = 800,
  pageSize = 50,
  isCustomFieldEnabled,
  getWorkItemIdsFilter,
  ...props
}) => {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const requestId = useRef(0);
  const containerRef = useRef(null);
  // 稳定化防抖后，debounce 实例只建一次、闭包会捕获旧的 workItemIds；
  // 用 ref 始终指向最新定义的 loadData，供防抖回调调用
  const loadDataRef = useRef(null);
  // 记录组件自己最近一次 emit 给父组件的选中值：
  // workItemEntityIds 回流若与它相等，说明是“用户刚选中/取消”的回声，
  // 不应重建 options（否则搜索结果列表会塌缩成只剩已选项，无法继续多选）
  const lastEmittedRef = useRef(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  // 下拉顶部内嵌搜索框的即时输入值（searchKeyword 防抖 800ms 后才更新，不能直绑）
  const [searchText, setSearchText] = useState("");
  const [value, setValue] = useState(null);
  // loadData 在 debounce/异步回调里拿不到最新 value state，用 ref 镜像供选项回显
  const valueRef = useRef(value);
  valueRef.current = value;
useEffect(() => {
    try {
      if (props?.type !== "search") return;
      if (workItemIds?.length) {
        if (value && value?.length) {
          const filterArr = value.filter((item) =>
            workItemIds.includes(JSON.parse(item)?.workItemId)
          );
          setValue(filterArr?.length ? filterArr : null);
        }
      } else {
        setValue(null);
      }
    } catch (error) {
      console.log(error);
    }
  }, [workItemIds]);


  useEffect(() => {
     // 主键去重：同一实例的多个串（记忆串/搜索串）只保留一个，
     // 避免重复串流入 value/options/tag 区及回写给父组件
     const deduped = dedupeByEntityKey(workItemEntityIds);
     setValue(deduped);
     const isEcho =
       lastEmittedRef.current !== null &&
       JSON.stringify(deduped) === JSON.stringify(lastEmittedRef.current);
     // 用户在下拉里选中/取消触发的回流：只同步 value，保留当前搜索结果列表
     if (isEcho) return;
      //if (!options.length) {
        setOptions(deduped?.map(parseEntityValue));
      //}
    if (deduped?.length) {
      setHasMore(false);
    }
   }, [JSON.stringify(workItemEntityIds)]);

  const loadData = async (page = 1, keyword = "") => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    try {
      const { data } = await fetchOptions({
        pageNum: page,
        pageSize,
        workItemEntityName: keyword,
        workItemIds,
      });
      if (currentRequest !== requestId.current) return;

      // 已选实例的选项回显为 value 里的原串：与 value 全等后 rc-select
      // 才能正确打勾，点击时走“取消选中”而不是再追加一条重复选中
      const selectedKeyMap = new Map(
        (valueRef.current || []).map((raw) => [getEntityKey(raw), raw])
      );
      const newOptions = data?.data?.map((item) => {
        const built = buildEntityValue({
          workItemId: item.workItemId,
          label: item.label,
          value: item.value,
          customFieldValue: item?.customFieldValue,
        });
        return {
          label: item.label,
          customFieldValue: item?.customFieldValue,
          value: selectedKeyMap.get(getEntityKey(built)) ?? built,
        };
      });

      if (page === 1) {
        setOptions(newOptions || []);
      } else {
        setOptions((prev) => [...(prev || []), ...(newOptions || [])]);
      }
      setHasMore(data?.hasMore ?? false);
    } finally {
      setLoading(false);
    }
  };

  // 每次渲染把 ref 指向最新的 loadData（其闭包里是最新的 workItemIds / fetchOptions）
  loadDataRef.current = loadData;

  /**
   * 稳定化搜索防抖：整个生命周期只创建一个 debounce 实例。
   * 旧写法写在组件函数体内，每敲一个字都会随重渲染重建 debounce，
   * 旧实例已排定的定时器不会被新实例取消 → 连续输入累积成多次接口调用，
   * 防抖形同失效。useMemo 收敛后，连续输入停止 debounceTimeout 后才触发一次请求。
   */
  const debouncedSearch = useMemo(
    () =>
      debounce(
        (keyword) => {
          // 关键字去空白后为空：不发远程搜索，避免空串/空格打到接口
          const kw = (keyword || "").trim();
          setSearchKeyword(kw);
          setCurrentPage(1);
          if (!kw) {
            setLoading(false);
            return;
          }
          loadDataRef.current(1, kw);
        },
        debounceTimeout,
      ),
    [debounceTimeout],
  );

  // 卸载时取消未执行的防抖，避免组件销毁后仍触发请求 / 状态更新
  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  // 处理下拉滚动：滚动到接近底部时再加载下一页
  const handlePopupScroll = debounce((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    // 留出 60px 提前量，且需有更多数据、非加载中
    if (scrollHeight - scrollTop - clientHeight < 60 && hasMore && !loading) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      loadData(nextPage, searchKeyword);
    }
  }, 200);

  return (
    <Select
      {...props}
      // 禁用内联搜索，只用下拉顶部内嵌搜索框（搜索仍走原有远程防抖接口）
      showSearch={false}
      className="workItemEntity-select"
      classNames={{
        ...props.classNames,
        popup: {
          ...props.classNames?.popup,
          root: [
            props.classNames?.popup?.root,
            "batch-work-item-entity-dropdown",
          ].filter(Boolean).join(" "),
        },
      }}
      filterOption={false}
      onSearch={debouncedSearch}
      onPopupScroll={handlePopupScroll}
      options={options}
      loading={loading}
      value={value}
      onBlur={() => {
        // 失焦不再清空列表：有已选实例则回显为已选项（带勾选态，可点击取消），
        // 无已选时 options 为空数组，保持“请输入工作项实例名称”空态 UI
        setOptions(dedupeByEntityKey(workItemEntityIds).map(parseEntityValue));
        // 与反显 effect 同语义：有已选项时关掉滚动加载，
        // 避免无搜索词时混入全量数据；后续搜索第一页会重新置位
        if (workItemEntityIds?.length) {
          setHasMore(false);
        }
        setSearchKeyword("");
        setSearchText("");
        if (props?.onBlur) props.onBlur();
      }}
      onChange={(value, option) => {
        // 主键去重兜底：即使不同来源串不相等，同一实例也只会保留一条；
        // option 与 value 同索引对应，同步过滤
        const seen = new Set();
        const dedupedValue = [];
        const dedupedOption = [];
        (value || []).forEach((raw, i) => {
          const key = getEntityKey(raw);
          if (seen.has(key)) return;
          seen.add(key);
          dedupedValue.push(raw);
          if (option?.[i]) dedupedOption.push(option[i]);
        });
        setValue(dedupedValue);
        lastEmittedRef.current = dedupedValue;
        // 无搜索词时，当前列表是“已选回显快照”：随选中增删即时同步，
        // 避免已删除/取消的实例残留在列表里；
        // 有搜索词时列表是候选集，保持不动以支持连续多选
        if (!searchKeyword && !searchText) {
          setOptions(dedupedValue.map(parseEntityValue));
        }
        if (props?.onChange) props.onChange(dedupedValue);
        if (getWorkItemIdsFilter) getWorkItemIdsFilter(dedupedOption);
      }}
      optionRender={(option) => (
        <div className="batch-work-item-entity-option">
          <CustomFieldCascaderOption
            label={option.label}
            customFieldValue={option.data?.customFieldValue ?? option.customFieldValue}
            isCustomFieldEnabled={isCustomFieldEnabled}
          />
        </div>
      )}
      notFoundContent={
        (searchText?.trim() || searchKeyword)?.length ? (
          loading ? (
            <div
              style={{
                width: "100%",
                height: "200px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Spin tip="数据加载中..." />
              <span
                style={{ color: "#727272", fontSize: "12px", marginTop: 10 }}
              >
                数据加载中...
              </span>
            </div>
          ) : (
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
                  没有找到匹配的工作项实例
                </span>
              }
            ></Empty>
          )
        ) : (
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
                请输入工作项实例名称
              </span>
            }
          ></Empty>
        )
      }
      popupRender={(menu) => (
        <>
          {/* 下拉顶部内嵌搜索框：输入即触发既有 debouncedSearch 远程模糊搜索 */}
          <div style={{ padding: "8px 8px 4px", borderBottom: "1px solid #f0f0f0" }}>
            <Input
              size="small"
              allowClear
              placeholder="搜索"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => {
                const v = e.target.value;
                setSearchText(v);
                const kw = v.trim();
                // 空 / 纯空白：取消待发防抖、不发接口，列表回退到已选回显快照（同失焦行为）
                if (!kw) {
                  debouncedSearch.cancel();
                  setSearchKeyword("");
                  setLoading(false);
                  setOptions(dedupeByEntityKey(workItemEntityIds).map(parseEntityValue));
                  if (workItemEntityIds?.length) setHasMore(false);
                  return;
                }
                // 有关键字：输入即刻进入 loading（覆盖 800ms 防抖空窗），并透传去空白后的词
                setLoading(true);
                debouncedSearch(kw);
              }}
              // 阻止冒泡：点搜索框不关闭下拉
              onMouseDown={(e) => e.stopPropagation()}
              // 阻止键盘事件冒泡给 Select（Portal 沿组件树冒泡），
              // 避免 Backspace/Enter 被 rc-select 拦截误删已选工作项实例
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <div
            ref={containerRef}
            style={{
              maxHeight: "400px",
              overflowY: "auto",
              boxSizing: "border-box",
            }}
          >
            {menu}
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              {loading && currentPage > 1 && (
                <Spin tip="数据加载中..." size="small" />
              )}
              {!loading && hasMore && options?.length > 0 && (
                <span style={{ color: "#727272", fontSize: "12px" }}>
                  继续滚动加载更多...
                </span>
              )}
            </div>
          </div>
        </>
      )}
    />
  );
};

export default SmartSelect;
