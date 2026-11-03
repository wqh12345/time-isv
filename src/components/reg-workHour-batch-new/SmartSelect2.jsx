import React, { useState, useEffect, useRef } from "react";
import { Select, Spin, Empty } from "antd";
import debounce from "lodash/debounce";
import noDataTable from "../../assets/images/no-data-table.png";
import CustomFieldCascaderOption from "../custom-field-cascader-option/CustomFieldCascaderOption";
const SmartSelect = ({
  fetchOptions,
  workItemIds,
  workItemEntityIds,
  projectKeys,
  debounceTimeout = 800,
  pageSize = 50,
  isCustomFieldEnabled,
  ...props
}) => {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const requestId = useRef(0);
  const containerRef = useRef(null);
  const customFieldValueMapRef = useRef(new Map());
  const [searchKeyword, setSearchKeyword] = useState("");
  const [value, setValue] = useState(null);

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
     setValue(workItemEntityIds);
      //if (!options.length) {
        setOptions(
          workItemEntityIds?.map((item) => ({
            label: JSON.parse(item)?.label,
            value: item,
          }))
        );
      //}
    if (workItemEntityIds?.length) {
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
        projectKeys,
      });
      if (currentRequest !== requestId.current) return;

      if (page === 1) customFieldValueMapRef.current.clear();
      const newOptions = data?.data?.map((item) => {
        const optionValue = JSON.stringify({
          workItemId: item.workItemId,
          label: item.label,
          value: item.value,
          projectKey: item.projectKey,
        });
        customFieldValueMapRef.current.set(optionValue, item.customFieldValue);
        return {
          label: item.label,
          value: optionValue,
        };
      });

      if (page === 1) {
        setOptions(newOptions || []);
      } else {
        setOptions((prev) => [...(prev || []), ...(newOptions || [])]);
      }

      setHasMore(data?.hasNext);
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = debounce((value) => {
    setSearchKeyword(value);
    setCurrentPage(1);
    // 搜索关键字为空时不调用接口，仅清空已有选项
    if (!value?.trim()) {
      setOptions([]);
      setHasMore(false);
      return;
    }
    loadData(1, value);
  }, debounceTimeout);
  // --- 新增：处理滚动事件 --- 使用防抖确保只触发一次
  const handlePopupScroll = debounce((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    
    // 计算是否滚动到了底部（留出 60px 的提前量，让加载更平滑）
    // 只有在有更多数据、不在加载中、且滚动到接近底部时才加载
    if (scrollHeight - scrollTop - clientHeight < 60 && hasMore && !loading) {
      const nextPage = currentPage + 1;
      //console.log('滚动加载下一页:', nextPage);
      setCurrentPage(nextPage);
      loadData(nextPage, searchKeyword);
    }
  }, 200);
  // 移除IntersectionObserver，使用onPopupScroll统一处理滚动加载

  return (
    <Select
      {...props}
      showSearch
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
      options={options}
      loading={loading}
      value={value}
      onBlur={() => {
        setOptions([]);
        setSearchKeyword("");
        if (props?.onBlur) props.onBlur();
      }}
       // --- 使用 onPopupScroll 属性 ---
      onPopupScroll={handlePopupScroll}
      onChange={(value, option) => {
        setValue(value);
        if (props?.onChange) props.onChange(value);
        if (props?.getWorkItemIdsFilter) props.getWorkItemIdsFilter(option);
      }}
      optionRender={(option) => (
        <div className="batch-work-item-entity-option">
          <CustomFieldCascaderOption
            label={option.label}
            customFieldValue={customFieldValueMapRef.current.get(option.data?.value ?? option.value)}
            isCustomFieldEnabled={isCustomFieldEnabled}
          />
        </div>
      )}
      notFoundContent={
        searchKeyword?.length ? (
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
      )}
    />
  );
};

export default SmartSelect;
