import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Cascader, Spin, Typography } from 'antd';
import {
  getProjectList,
  getLevelWorkItemOption,
  getLevelItemEntityOption,
  getLevelNodeAndTaskOption,
} from '../../api/api';
import noDataImg from '../../assets/images/no-data.png';
import CustomFieldCascaderOption, {
  getCascaderOptionLabel,
} from '../custom-field-cascader-option/CustomFieldCascaderOption';
import { useTenantCustomFieldConfig } from '../../hooks/useTenantCustomFieldConfig';
import './SpaceCascader.less';

const { Text } = Typography;

/**
 * 五级级联选择器：空间 → 工作项 → 工作项实例 → 节点 → 任务
 *
 * 数据源（4 个后端接口）：
 *   空间         GET /project/list
 *   工作项       GET /level/getWorkItemOption           入参: projectKey
 *   工作项实例   GET /level/getItemEntityOption          入参: projectKey, workItemId, pageNum?
 *   节点+任务    GET /level/getNodeAndTaskOption         入参: projectKey, workItemId, workItemEntityId, pageNum
 *
 * 也支持自定义各层级获取函数（用于单项登记场景）：
 *   - fetchSpaceOptions         自定义空间拉取函数 () => Promise<{result,data}>
 *   - fetchWorkItemOptions      自定义工作项拉取函数 (projectKey) => Promise<{result,data}>
 *   - fetchEntityOptions        自定义实例拉取函数 (projectKey, workItemId, pageNum) => Promise<{result,data, hasMore}>
 *   - fetchNodeOptions          自定义节点任务拉取函数 (projectKey, workItemId, workItemEntityId, pageNum) => Promise<{result,data}>
 *
 * value 结构（受控）：[spaceId, workItemId, workItemEntityId, nodeId, taskId]
 * onChange(ids, names, selectedOptions)
 *   - ids:   同 value 结构
 *   - names: { spaceName, workItemName, workItemEntityName, nodeName, taskName }
 *
 * Props:
 *   - value / defaultValue      受控/非受控值
 *   - disabled                  禁用
 *   - placeholder               占位
 *   - pageSize                  实例分页大小，默认 20
 *   - changeOnSelect            是否允许任意层级选中，默认 true
 *   - maxLevel                  最大可下钻层级（1=空间, 2=工作项, 3=实例, 4=节点, 5=任务）；默认 5
 *   - rootProjectKey            可选：固定空间 projectKey；传入后跳过"空间"层，面板直接从工作项开始
 *   - spaceOptions              可选：静态空间列表（传了则不调 /project/list）
 *   - fetchSpaceOptions         可选：自定义空间拉取函数 () => Promise<{result,data}>
 *   - fetchWorkItemOptions      可选：自定义工作项拉取函数
 *   - fetchEntityOptions        可选：自定义实例拉取函数
 *   - fetchNodeOptions          可选：自定义节点任务拉取函数
 *   - onChange                  见上
 *
 * Ref 方法：
 *   - reset()                   清空选择与缓存
 *   - reloadSpace()             重新拉取空间列表
 */
const LEVEL_SPACE = 1;
const LEVEL_WORK_ITEM = 2;
const LEVEL_ENTITY = 3;
const LEVEL_NODE = 4;
const LEVEL_TASK = 5;

const joinKey = (...parts) => parts.filter((v) => v !== undefined && v !== null && v !== '').join('::');
const lastSeg = (key) => String(key || '').split('::').pop();

// 统一的成功判断：兼容 { result:true } / { code:200 } / { code:0 } / { success:true } / { msg:'success' }
const isOk = (res) => {
  if (!res) return false;
  if (res.result === true) return true;
  if (res.success === true) return true;
  if (res.code === 200 || res.code === 0 || res.code === '200' || res.code === '0') return true;
  if (typeof res.msg === 'string' && res.msg.toLowerCase() === 'success') return true;
  return false;
};

// 占位项：某一层接口返回空列表时，在子面板展示“暂无数据”缺省图。
// 用 disabled 阻止选中；value 带上父 key 保证全局唯一。
const EMPTY_PREFIX = '__empty__::';
const makeEmptyChild = (parentKey) => ({
  value: `${EMPTY_PREFIX}${parentKey}`,
  label: (
    <div className="space-cascader-empty-item">
      <img src={noDataImg} alt="暂无数据" />
      <span>暂无数据</span>
    </div>
  ),
  disabled: true,
  isLeaf: true,
});
const isEmptyVal = (v) => typeof v === 'string' && v.startsWith(EMPTY_PREFIX);

const SpaceCascaderInner = (props) => {
  const {
    value,
    defaultValue,
    disabled = false,
    placeholder = '请选择空间 / 工作项 / 实例 / 节点 / 任务',
    pageSize = 20,
    changeOnSelect = true,
    maxLevel = LEVEL_TASK,
    rootProjectKey,
    spaceOptions: spaceOptionsProp,
    fetchSpaceOptions,
    fetchWorkItemOptions,
    fetchEntityOptions,
    fetchNodeOptions,
    onChange,
    onDropdownVisibleChange,
    displayNames,
    optionRender: optionRenderProp,
    // 输入框回显所需的最少有效层级数：选中层级数小于此值时输入框不显示文字（仍保留下拉高亮）
    minDisplayValidLen,
    forwardedRef,
    ...restProps
  } = props || {};

  const { isEnabled: isCustomFieldEnabled } = useTenantCustomFieldConfig();

  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [innerValue, setInnerValue] = useState(defaultValue || []);
  // 是否发生过用户手动改选：用于决定回显时是否使用外部 displayNames 兜底
  const userInteractedRef = useRef(false);

  // 实例分页缓存：key = `${spaceKey}::${workItemKey}`，值 = { pageNum, hasMore }
  const entityPagerRef = useRef({});
  // 滚动加载并发锁，防止同一列滚动连续触发
  const loadingMoreRef = useRef(false);
  // onFocus 与 onOpenChange 可能同时触发，避免根列表重复请求导致 Loading 提前结束
  const rootLoadingRef = useRef(false);
  // 当前正在展示的实例列对应的父级 workItemKey，用于滚动加载时定位
  const activeEntityColumnRef = useRef('');

  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : innerValue;

  /* ------------------------------ 工具函数 ------------------------------ */

  const markLeaf = (arr) => {
    arr?.forEach((item) => {
      item.isLeaf = !item.hasNext;
    });
    return arr;
  };

  const filterCanRegister = (arr) => {
    if (!arr?.length) return arr;
    // canRegister 为 false 则不展示
    return arr.filter((it) => it && it.canRegister !== false);
  };

  /** 将子节点合并到树的指定 key 下 */
  const attachChildren = (tree, parentKey, children, mode = 'replace') => {
    const walk = (list) => {
      for (const item of list) {
        if (item.value === parentKey) {
          // 切换父节点时：先清掉同级兄弟节点已展开的深层 children，避免残留旧路径的子列导致多列错位/重叠
          list.forEach((sib) => {
            if (sib !== item && sib.children) {
              sib.children = undefined;
              sib.isLeaf = !sib.hasNext;
            }
          });
          if (mode === 'append') {
            item.children = (item.children || []).concat(children || []);
          } else {
            if (children && children.length > 0) {
              item.children = children;
            } else {
              // 换取“暂无数据”占位项：保留可展开、下一面板显示空态
              item.children = [makeEmptyChild(parentKey)];
              item.isLeaf = false;
            }
          }
          return true;
        }
        if (item.children?.length && walk(item.children)) return true;
      }
      return false;
    };
    walk(tree);
    return [...tree];
  };

  /* --------------------------- 五层数据拉取 ---------------------------- */

  /** 1. 空间列表（优先级：fetchSpaceOptions > spaceOptionsProp > /project/list） */
  const fetchSpaceList = async () => {
    // 1) 自定义接口
    if (typeof fetchSpaceOptions === 'function') {
      const res = await fetchSpaceOptions();
      if (!isOk(res)) return [];
      // 兼容多种响应包装结构，与 fetchEntityList/fetchNodeList 保持一致
      const payload = res.data || {};
      const rawList =
        payload.registrationLevelVoList ||
        payload.registerLevelList ||
        payload.list ||
        payload.records ||
        (Array.isArray(payload) ? payload : payload.data) ||
        [];
      if (!Array.isArray(rawList)) return [];
      return rawList
        .filter((it) => it && (it.value !== undefined && it.value !== null && it.value !== ''))
        .map((it) => ({
          ...it,
          value: String(it.value ?? it.id ?? it.spaceId ?? it.projectKey),
          label: it.label ?? it.level ?? it.name ?? it.spaceName ?? it.projectName,
          isLeaf: false,
          hasNext: it.hasNext !== false,
          raw: it,
        }));
    }

    // 2) 静态传入
    if (Array.isArray(spaceOptionsProp) && spaceOptionsProp.length) {
      return spaceOptionsProp.map((it) => ({
        label: it.label ?? it.level ?? it.name ?? it.spaceName,
        value: String(it.value ?? it.id ?? it.spaceId),
        isLeaf: false,
        hasNext: true,
        raw: it,
      }));
    }

    // 3) 默认走 /project/list
    const res = await getProjectList();
    if (!isOk(res) || !Array.isArray(res.data)) return [];
    return res.data.map((it) => ({
      label: it.label,
      value: String(it.value),
      isLeaf: false,
      hasNext: true,
      raw: it,
    }));
  };

  /** 2. 空间下的工作项列表 GET /level/getWorkItemOption */
  const fetchWorkItemList = async (spaceKey) => {
    const projectKey = lastSeg(spaceKey);
    let res;
    if (typeof fetchWorkItemOptions === 'function') {
      res = await fetchWorkItemOptions(projectKey);
    } else {
      res = await getLevelWorkItemOption({ projectKey });
    }
    if (!isOk(res) || !Array.isArray(res.data)) return [];
    const list = filterCanRegister(res.data) || [];
    return list.map((item) => {
      // 新接口字段：label 取 level/name；hasNext 按节点本身的值判断是否叶子
      // 当 maxLevel <= 工作项 时，强制叶子，避免再下钻
      const rawHasNext = item.hasNext !== undefined ? !!item.hasNext : true;
      const hasNext = maxLevel > LEVEL_WORK_ITEM && rawHasNext;
      return {
        label: item.label ?? item.level ?? item.name,
        value: joinKey(spaceKey, String(item.value)),
        isLeaf: !hasNext,
        hasNext,
        raw: item,
      };
    });
  };

  /** 3. 工作项下的实例列表（分页） GET /level/getItemEntityOption */
  const fetchEntityList = async (workItemKey, pageNum = 1) => {
    const segs = workItemKey.split('::');
    const projectKey = segs[0];
    const workItemId = segs[1];
    let res;
    if (typeof fetchEntityOptions === 'function') {
      res = await fetchEntityOptions(projectKey, workItemId, pageNum);
    } else {
      res = await getLevelItemEntityOption({
        projectKey,
        workItemId,
        pageNum,
        pageSize,
      });
    }
    if (!isOk(res)) return { list: [], hasMore: false };
    const data = res.data || {};
    // 后端新字段：registrationLevelVoList + hasMore + level；旧字段兼容
    // 同时兼容 res.data 直接为数组的情况（如 api/register/getItemEntityOption）
    const rawList = Array.isArray(data)
      ? data
      : data.registrationLevelVoList || data.registerLevelList || data.data || [];
    // 实例层级：canRegister 为 false 的项直接过滤掉不展示
    const rows = filterCanRegister(rawList || []).map((item) => {
      const rawHasNext = item.hasNext !== undefined ? !!item.hasNext : true;
      const hasNext = maxLevel > LEVEL_ENTITY && rawHasNext;
      return {
        customFieldValue:item?.customFieldValue || null,
        label: item.label ?? item.level ?? item.name ?? item.entityName ?? item.workItemEntityName ?? item.title ?? item.text,
        value: joinKey(workItemKey, String(item.value)),
        isLeaf: !hasNext,
        hasNext,
        optionLevel: LEVEL_ENTITY,
        raw: item,
      };
    });
    const hasMore = !!(data.hasMore ?? data.hasNext);
    entityPagerRef.current[workItemKey] = { pageNum, hasMore };
    return { list: rows, hasMore };
  };

  /** 4. 实例下的节点（含任务） GET /level/getNodeAndTaskOption ——节点与任务一次返回 */
  const fetchNodeList = async (entityKey) => {
    const segs = entityKey.split('::'); // [projectKey, workItemId, entityId]
    const projectKey = segs[0];
    const workItemId = segs[1];
    const workItemEntityId = segs[2];
    const pageNum = 1;
    let res;
    if (typeof fetchNodeOptions === 'function') {
      res = await fetchNodeOptions(projectKey, workItemId, workItemEntityId, pageNum);
    } else {
      res = await getLevelNodeAndTaskOption({
        projectKey,
        workItemId,
        workItemEntityId,
        pageNum,
      });
    }
    if (!isOk(res)) return [];
    const data = res.data || {};
    // 同时兼容 res.data 直接为数组的情况（如 api/register/getEntityNodeOption）
    const rawList = Array.isArray(data)
      ? data
      : data.registrationLevelVoList || data.registerLevelList || data.data || [];
    // 节点/任务层：canRegister 为 false 的项直接过滤掉不展示
    const list = filterCanRegister(rawList || []).map((node) => {
      const nodeValue = joinKey(entityKey, String(node.value));
      // 任务子节点同样过滤
      const tasks = filterCanRegister(Array.isArray(node.children) ? node.children : []);
      const children = tasks.map((task) => ({
        label: task.label ?? task.level ?? task.name ?? task.taskName ?? task.title ?? task.text,
        value: joinKey(nodeValue, String(task.value)),
        isLeaf: true,
        raw: task,
      }));
      // 节点的 hasNext：必须同时满足
      //  ① 未达 maxLevel；② 后端声名为有下一层（或未声名时以 children 长度判断）；③ 过滤后 children 非空
      // 过滤后子项为空时强制标记为叶子，避免出现箭头点击后无限 loading
      const rawHasNext = node.hasNext !== undefined ? !!node.hasNext : children.length > 0;
      const hasNext = maxLevel > LEVEL_NODE && rawHasNext && children.length > 0;
      return {
        label: node.label ?? node.level ?? node.name ?? node.nodeName ?? node.title ?? node.text,
        value: nodeValue,
        children: hasNext ? children : undefined,
        isLeaf: !hasNext,
        hasNext,
        raw: node,
      };
    });
    return list;
  };

  /* ------------------------------ 首屏加载 ----------------------------- */

  /** 当 rootProjectKey 存在时：根层直接是"该空间下的工作项列表"，跳过空间层 */
  const loadRootWorkItems = async () => {
    if (options.length || rootLoadingRef.current) return;
    rootLoadingRef.current = true;
    setLoading(true);
    try {
      const rootKey = String(rootProjectKey);
      const list = await fetchWorkItemList(rootKey);
      setOptions(list);
    } catch (error) {
      console.error('加载工作项列表失败:', error);
      setOptions([]);
    } finally {
      rootLoadingRef.current = false;
      setLoading(false);
    }
  };

  const loadSpaces = async () => {
    if (options.length) return;
    if (rootProjectKey) return loadRootWorkItems();
    if (rootLoadingRef.current) return;
    rootLoadingRef.current = true;
    setLoading(true);
    try {
      const list = await fetchSpaceList();
      setOptions(list);
    } catch (error) {
      console.error('加载空间列表失败:', error);
      setOptions([]);
    } finally {
      rootLoadingRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    // rootProjectKey 变化时重置 options，下次打开面板重新加载
    entityPagerRef.current = {};
    activeEntityColumnRef.current = '';
    setOptions([]);
  }, [rootProjectKey]);

  useEffect(() => {
    return () => {
      entityPagerRef.current = {};
      rootLoadingRef.current = false;
    };
  }, []);

  /* ------------------------------ 动态加载 ----------------------------- */

  // 实例列底部的 sentinel 项 value 前缀；滚动到底部时根据它触发分页加载
  const MORE_PREFIX = 'more::';

  /** 在实例列尾部追加一个不可点击的 sentinel 项，作为滚动触发标记（无可见 UI） */
  const appendLoadingSentinel = (list, workItemKey, pageNum) => {
    list.push({
      // 关键：disabled 阻止 cascader 把它当作可选/可下钻项；不参与 onChange 与 hover 触发
      disabled: true,
      isLeaf: true,
      value: `${MORE_PREFIX}${workItemKey}::${pageNum}`,
      label: (
        <div
          className="space-cascader-loading-sentinel"
          style={{ opacity: 0, pointerEvents: 'none', userSelect: 'none' }}
        />
      ),
    });
    return list;
  };

  const loadData = async (selectedOptions) => {
    const target = selectedOptions[selectedOptions.length - 1];
    // rootProjectKey 模式下：根层就是工作项，selectedOptions.length=1 对应工作项层（LEVEL_WORK_ITEM=2）
    const level = rootProjectKey ? selectedOptions.length + 1 : selectedOptions.length;

    // 已达最大层级则不再下钻（兜底，正常情况 isLeaf 已阻止）
    if (level >= maxLevel) return;

    // 在最新 state 中标记 loading，避免 selectedOptions 中的 target 与 options 树引用不同步
    setOptions((prev) => {
      const node = findNodeByValue(prev, target.value);
      if (node) node.loading = true;
      return [...prev];
    });

    try {
      // rootProjectKey 模式下没有 LEVEL_SPACE；根层 selectedOptions.length=1 对应工作项层
      if (!rootProjectKey && level === LEVEL_SPACE) {
        const list = await fetchWorkItemList(target.value);
        setOptions((prev) => attachChildren(prev, target.value, list));
      } else if (level === LEVEL_WORK_ITEM) {
        activeEntityColumnRef.current = target.value;
        const { list, hasMore } = await fetchEntityList(target.value, 1);
        if (hasMore) appendLoadingSentinel(list, target.value, 1);
        setOptions((prev) => attachChildren(prev, target.value, list));
      } else if (level === LEVEL_ENTITY) {
        const list = await fetchNodeList(target.value);
        setOptions((prev) => attachChildren(prev, target.value, list));
      }
      // LEVEL_NODE: 节点的子任务已随 /level/getNodeAndTaskOption 一次返回，无需再拉
    } finally {
      setOptions((prev) => {
        const node = findNodeByValue(prev, target.value);
        if (node) node.loading = false;
        return [...prev];
      });
    }
  };

  /**
   * 实例列滚动到底部时触发下一页加载。
   * 通过检查菜单列最后一个 li 是否包含 sentinel 元素来判断是否需要加载更多，
   * 不再依赖 antd 内部的 data-path-key 属性。
   */
  const handleMenuScroll = async (e) => {
    const menuEl = e.target;
    if (!menuEl || !menuEl.classList || !menuEl.classList.contains('ant-cascader-menu')) return;
    // 触底阈值：距底 <= 8px 即触发
    if (menuEl.scrollTop + menuEl.clientHeight < menuEl.scrollHeight - 8) return;
    if (loadingMoreRef.current) return;

    // 该列最后一个 li 应当是 sentinel（包含 .space-cascader-loading-sentinel）
    const lastItem = menuEl.querySelector('li.ant-cascader-menu-item:last-child');
    if (!lastItem || !lastItem.querySelector('.space-cascader-loading-sentinel')) return;

    const workItemKey = activeEntityColumnRef.current;
    if (!workItemKey) return;
    const pager = entityPagerRef.current[workItemKey];
    if (!pager || !pager.hasMore) return;
    const nextPage = (pager.pageNum || 1) + 1;

    loadingMoreRef.current = true;
    try {
      const { list, hasMore } = await fetchEntityList(workItemKey, nextPage);
      setOptions((prev) => {
        const parent = findNodeByValue(prev, workItemKey);
        if (!parent?.children?.length) return prev;
        // 去掉旧 sentinel，再追加新批次；若仍有更多则补一个新的 sentinel
        const children = parent.children.filter(
          (c) => !(typeof c.value === 'string' && c.value.startsWith(MORE_PREFIX))
        );
        const merged = children.concat(list);
        if (hasMore) appendLoadingSentinel(merged, workItemKey, nextPage);
        parent.children = merged;
        return [...prev];
      });
    } finally {
      loadingMoreRef.current = false;
    }
  };

  const findNodeByValue = (tree, value) => {
    for (const item of tree) {
      if (item.value === value) return item;
      if (item.children?.length) {
        const r = findNodeByValue(item.children, value);
        if (r) return r;
      }
    }
    return null;
  };

  /**
   * 外部传入的 value 形如 [projectKey, workItemId, entityId, nodeId, taskId]（单段 id），
   * 但 options 中每一层的 value 是 `parentKey::id` 拼接 key —— 二者不匹配时 antd Cascader
   * 会直接把 value 文本作为 label 显示（即用户看到的"输入框回显成 value 值"）。
   *
   * 这里把单段 ids 还原成拼接 key 数组：逐层在 options 中查找 `lastSeg(node.value) === id`
   * 的节点，命中则使用其 value，未命中（如尚未拉到子级数据）时按层级拼接出预测 key，
   * 保证后续数据拉到位时 Cascader 仍能正确匹配并回显 label。
   */
  const toDisplayValue = (ids, tree) => {
    if (!Array.isArray(ids) || ids.length === 0) return ids;
    const display = [];
    let level = tree;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (id === undefined || id === null || id === '') break;
      const idStr = String(id);
      const node = Array.isArray(level)
        ? level.find((it) => lastSeg(it.value) === idStr || String(it.value) === idStr)
        : null;
      if (node) {
        display.push(node.value);
        level = node.children;
      } else {
        // 子级尚未加载 —— 按当前已确定的父级 key 拼接出预测 key
        const parentKey = display[display.length - 1];
        display.push(parentKey ? joinKey(parentKey, idStr) : idStr);
        level = null;
      }
    }
    return display;
  };

  /* -------------------------------- 选中 ------------------------------- */

  const handleChange = (val, selectedOptions) => {
    // 忽略 sentinel / 暂无数据占位项引发的“选中”
    if (val && val.some((v) => typeof v === 'string' && (v.startsWith(MORE_PREFIX) || isEmptyVal(v)))) return;

    userInteractedRef.current = true;
    if (!isControlled) setInnerValue(val || []);

    if (typeof onChange !== 'function') return;

    // ids：在 rootProjectKey 模式下，根选项的 value 已经是 "projectKey::workItemId"，
    // lastSeg 会只取最后一段；为保持对外 ids 结构统一为 [projectKey, workItemId, entityId, ...]，
    // root 模式下将 rootProjectKey 补到 ids[0]，后续 id 按原逻辑 lastSeg 提取。
    let ids = (val || []).map((key) => lastSeg(key));
    let names;
    if (rootProjectKey && selectedOptions) {
      ids = [String(rootProjectKey), ...ids];
      names = {
        spaceName: undefined,
        workItemName: selectedOptions?.[0]?.label,
        workItemEntityName: selectedOptions?.[1]?.label,
        nodeName: selectedOptions?.[2]?.label,
        taskName: selectedOptions?.[3]?.label,
      };
    } else {
      names = {
        spaceName: selectedOptions?.[0]?.label,
        workItemName: selectedOptions?.[1]?.label,
        workItemEntityName: selectedOptions?.[2]?.label,
        nodeName: selectedOptions?.[3]?.label,
        taskName: selectedOptions?.[4]?.label,
      };
    }
    onChange(ids, names, selectedOptions);
  };

  /* -------------------------------- Ref -------------------------------- */

  useImperativeHandle(forwardedRef, () => ({
    reset: () => {
      entityPagerRef.current = {};
      activeEntityColumnRef.current = '';
      setOptions([]);
      if (!isControlled) setInnerValue([]);
      if (typeof onChange === 'function') onChange([], {}, []);
    },
    reloadSpace: async () => {
      entityPagerRef.current = {};
      activeEntityColumnRef.current = '';
      setLoading(true);
      try {
        if (rootProjectKey) {
          const list = await fetchWorkItemList(String(rootProjectKey));
          setOptions(list);
        } else {
          const list = await fetchSpaceList();
          setOptions(list);
        }
      } finally {
        setLoading(false);
      }
    },
  }));

  /* -------------------------------- 渲染 ------------------------------- */

  // 把外部传入的"单段 id 数组"转换成 options 中真实使用的"拼接 key 数组"，
  // 否则 antd Cascader 会拿 value 当 label 直接渲染（即用户看到的"回显成 value"）。
  const displayValue = (() => {
    // rootProjectKey 模式下外部 value 仍为 [projectKey, workItemId, entityId, ...]，
    // 但面板根层就是工作项，所以需要剥掉首位 projectKey 再在 options（工作项根层）中匹配
    if (rootProjectKey && Array.isArray(currentValue) && currentValue.length) {
      const rootKey = String(rootProjectKey);
      const tail = currentValue[0] === rootKey ? currentValue.slice(1) : currentValue.slice(1);
      const inner = toDisplayValue(tail, options);
      // 再把拼接 key 的首位加上 rootKey 前缀，使之能与 options 中根层 value（rootKey::workItemId）匹配
      if (inner.length > 0 && !inner[0].startsWith(rootKey + '::')) {
        inner[0] = joinKey(rootKey, lastSeg(inner[0]));
      }
      return inner;
    }
    return toDisplayValue(currentValue, options);
  })();

  // 回显兜底：尚未发生用户改选、且外部提供了名称时，按 value 长度取对应名称展示，
  // 避免 options 未加载时 antd Cascader 把拼接 key 当 label 直接渲染。
  const renderLabels = (labels) => {
    // 选中层级数小于 minDisplayValidLen 时，输入框不回显数据，显示 placeholder 占位样式（仅保留下拉面板高亮）
    if (minDisplayValidLen) {
      const validLen = Array.isArray(currentValue)
        ? currentValue.filter((v) => v !== undefined && v !== null && v !== '').length
        : 0;
      if (validLen < minDisplayValidLen) {
        return (
          <span style={{ color: '#bfbfbf' }}>{placeholder || ''}</span>
        );
      }
    }
    if (
      !userInteractedRef.current &&
      Array.isArray(displayNames) &&
      displayNames.filter(Boolean).length &&
      Array.isArray(currentValue) &&
      currentValue.filter((v) => v !== undefined && v !== null && v !== '').length
    ) {
      const validLen = currentValue.filter((v) => v !== undefined && v !== null && v !== '').length;
      const names = displayNames.slice(0, validLen).filter(Boolean);
      if (names.length) return names.join(' / ');
    }
    return labels.join(' / ');
  };

  return (
    <Cascader
      {...restProps}
      className={`space-cascader ${restProps.className || ''}`}
      disabled={disabled}
      options={options}
      value={displayValue}
      optionRender={(option) => {
        const defaultLabel = getCascaderOptionLabel(option);
        if (option?.__cascader_fix_label__ !== undefined) return defaultLabel;
        const label = typeof optionRenderProp === 'function'
          ? optionRenderProp(option)
          : defaultLabel;
        return option.optionLevel === LEVEL_ENTITY ? (
          <CustomFieldCascaderOption
            label={label}
            customFieldValue={option.raw?.customFieldValue ?? option.customFieldValue}
            isCustomFieldEnabled={isCustomFieldEnabled}
          />
        ) : label;
      }}
      loadData={loadData}
      onChange={handleChange}
      changeOnSelect={changeOnSelect}
      placeholder={placeholder}
      // 禁用虚拟滚动：数据量较大时 antd 默认开启虚拟滚动，可能导致某些选项不渲染
      virtual={false}
      onOpenChange={(open) => {
        if (open) loadSpaces();
        if (typeof onDropdownVisibleChange === 'function') onDropdownVisibleChange(open);
      }}
      onFocus={loadSpaces}
      notFoundContent={loading ? (
        <div className="space-cascader-loading">
          <Spin size="small" />
        </div>
      ) : (
        <div className="space-cascader-empty">
          <img src={noDataImg} alt="暂无数据" />
          <span>暂无数据</span>
        </div>
      )}
      displayRender={(labels) => renderLabels(labels)}
      // 用 onScrollCapture 监听内部各 menu 列的滚动事件（scroll 不冒泡，需要捕获阶段）
      popupRender={(menus) => (
        <div className="space-cascader-dropdown" onScrollCapture={handleMenuScroll}>
          {menus}
        </div>
      )}
    />
  );
};

const SpaceCascader = React.forwardRef((props, ref) => (
  <SpaceCascaderInner {...props} forwardedRef={ref} />
));

SpaceCascader.displayName = 'SpaceCascader';

export default SpaceCascader;
