var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __rest =
  (this && this.__rest) ||
  function (s, e) {
    var t = {};
    for (var p in s)
      if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
      for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
        if (
          e.indexOf(p[i]) < 0 &&
          Object.prototype.propertyIsEnumerable.call(s, p[i])
        )
          t[p[i]] = s[p[i]];
      }
    return t;
  };
import React, { useState, useEffect, useMemo, useRef } from "react";
import { UserOutlined, SearchOutlined, TeamOutlined } from "@ant-design/icons";
import {
  Avatar,
  Spin,
  Select,
  Tooltip,
  Input,
  Divider,
  Space,
  Empty,
} from "antd";
import {
  getWebhookUserList,
  postSearchMember,
  getProjectAllStaffUser,
  getSelectProjectUserList,
  getProjectConfig,
} from '../../api/api';
import debounce from "lodash/debounce";
import noDataTable from "../../assets/images/no-data-table.png";
import "./UserPicker.less";

const UserPicker = (props) => {
  // console.log('[UP mount] props.value=', props?.value, typeof props?.value, 'props.registrantUserKey=', props?.registrantUserKey, typeof props?.registrantUserKey, 'props.loginUser=', props?.loginUser, 'props.allowClear=', props?.allowClear);
  const [userId, setUserId] = useState([]);
  const [user, setUser] = useState([]);

  /** 工时记录人员筛选 */
  const onUserSelectChange = (value) => {
    setUser(value);
    if (props.mode === "multiple") {
      const userId = [];
      for (const item of value) {
        userId.push(item.value);
      }
      setUserId(userId);
      props?.getUserIds(userId);
      return;
    }
    setUserId(value);
    props?.getUserIds(value);
  };

  // 标记调用方是否显式传了 value（受控模式，如批量登记）。
  // 受控模式下清空交由父组件回传新的 value 驱动；非受控模式（如单项登记）下组件内部自行回退到自己。
  const isControlled = props.hasOwnProperty('value');

  return (
    <DebounceSelect
      {...props}
      __isControlled={isControlled}
      mode={props.mode}
      placeholder={props.placeholder}
      style={{ minWidth: "200px" }}
    />
  );
};
export default UserPicker;

function DebounceSelect(_a) {
  var { fetchOptions, debounceTimeout = 800 } = _a,
    props = __rest(_a, ["fetchOptions", "debounceTimeout"]);
  const [fetching, setFetching] = useState(false);
  const [options, setOptions] = useState([]);
  const { getUserIds, getPickerUser, loginUser, registrantUserKey, type, value: _value, __isControlled, ...other } = props;
  const [name, setName] = useState("");
  const [pagination, setPagination] = useState({
    pageNum: 1,
    pageSize: 10,
  });
  const [hasNext, setHasNext] = useState(false);
  const fetchRef = useRef(0);
  const [val, setVal] = useState(props.value || props.registrantUserKey || []);
  const [isAllowRegister, setIsAllowRegister] = useState(false);

  /**
   * 确保特殊选项（全部代填成员 -111、团队管理员 -222）始终置顶
   */
  const pinSpecialItems = (list) => {
    if (!Array.isArray(list)) return list;
    const specialItems = [];
    const normalItems = [];
    list.forEach(item => {
      if (item.staffUserKey === '-111' || item.staffId === '-222') {
        specialItems.push(item);
      } else {
        normalItems.push(item);
      }
    });
    return [...specialItems, ...normalItems];
  };

  const debounceFetcher = useMemo(() => {
    const loadOptions = (value) => {
      fetchRef.current += 1;
      const fetchId = fetchRef.current;
      setOptions([]);
      setFetching(true);
      if (value) {
        searchMember(value).then((newOptions) => {
          if (fetchId !== fetchRef.current) {
            // for fetch callback order
            return;
          }
          setOptions(pinSpecialItems(newOptions));
          setFetching(false);
        });
      } else {
        getMembers().then((newOptions) => {
          if (fetchId !== fetchRef.current) {
            // for fetch callback order
            return;
          }
          if (typeof val === "object" && val.includes("-111")) {
            newOptions.forEach((item) => {
              if (item.staffUserKey !== "-111") {
                item.disabled = true;
              }
            });
          }
          setOptions(pinSpecialItems(newOptions));
          setFetching(false);
        });
      }
    };
    return debounce(loadOptions, debounceTimeout);
  }, [fetchOptions, debounceTimeout]);

  /** 查询是否开启代填工时功能 */
  const getConfig = async () => {
    const data = {
      type: "ALLOW_ADMINISTRATORS_TO_REGISTER_OTHERS_WORKING_HOURS",
    };
    const res = await getProjectConfig(data);
    if (res?.result) {
      setIsAllowRegister(res.data?.value ? true : false);
    }
  };

  useEffect(() => {
    if (props?.type !== "approval") getConfig();
  }, []);

  const searchMember = async (value) => {
    const res = await getWebhookUserList({
      needExcludeAdmin: false,
      name: value.trim(),
    });
    if (res?.result) {
      // 过滤掉 userKey 为空的数据，并为有效数据设置 staffUserKey
      res.data = (res.data || []).filter(item => item.userKey).map(item => ({
        ...item,
        staffUserKey: item.userKey
      }));
      if (!value && isAllowRegister && props?.type === "Gantt")
        res.data.unshift({
          staffUserKey: "-111",
          staffName: "全部代填成员",
        });
      if (props?.type === "approvalSet")
        res.data.unshift({
          staffId: "-222",
          staffName: "团队管理员",
        });
      if (JSON.stringify(val).includes("-111")) {
        res.data.forEach((item) => {
          if (item.staffUserKey !== "-111") {
            item.disabled = false;
          }
        });
      }
      return pinSpecialItems(res.data);
    }
  };

  const getMembers = async () => {
     const res = await getWebhookUserList({
      needExcludeAdmin: false,
      name:''
    });
    if (res?.result) {
      res.data = (res.data || []).filter(item => item.userKey).map(item => ({
        ...item,
        staffUserKey: item.userKey
      }));
      if (
        isAllowRegister &&
        props?.type === "Gantt"
      )
        res.data.unshift({
          staffUserKey: "-111",
          staffName: "全部代填成员",
        });
      if (props?.type === "approvalSet")
        res.data.unshift({
          staffId: "-222",
          staffName: "团队管理员",
        });
      if (val && JSON.stringify(val).includes("-111")) {
        res.data.forEach((item) => {
          if (item.staffUserKey !== "-111") {
            item.disabled = false;
          }
        });
      }
      if (
        typeof val === "object" &&
        val.length &&
        props?.type !== "approval" &&
        props?.type !== "approvalSet"
      ) {
        // 已选项紧跟特殊选项之后，特殊选项始终置顶
        const selectedItems = [];
        const unselectedItems = [];
        res.data.forEach(item => {
          if (item.staffUserKey === '-111' || item.staffId === '-222') {
            return; // 特殊选项由 pinSpecialItems 处理
          }
          if (val.includes(item.staffUserKey)) {
            selectedItems.push(item);
          } else {
            unselectedItems.push(item);
          }
        });
        const specialItems = res.data.filter(item => item.staffUserKey === '-111' || item.staffId === '-222');
        res.data = [...specialItems, ...selectedItems, ...unselectedItems];
      }
      return pinSpecialItems(res.data);
    }
  };

  useEffect(() => {
    if (props.value) {
      const fetchId = fetchRef.current;
      getMembers().then((newOptions) => {
        if (fetchId !== fetchRef.current) {
          // for fetch callback order
          return;
        }
        if (typeof val === "object" && val.includes("-111")) {
          newOptions.forEach((item) => {
            if (item.staffUserKey !== "-111") {
              item.disabled = true;
            }
          });
        }
        setOptions(pinSpecialItems(newOptions));
        setFetching(false);
      });
      setVal(props.value);
    }
  }, [props.value]);

  // 非受控模式（单项登记）：外部 registrantUserKey 变化时同步内部 val
  useEffect(() => {
    if (!__isControlled && props.registrantUserKey) {
      setVal(props.registrantUserKey);
    }
  }, [props.registrantUserKey, __isControlled]);

  const onfocus = () => {
    setName("");
    const fetchId = fetchRef.current;
    getMembers().then((newOptions) => {
      if (fetchId !== fetchRef.current) {
        // for fetch callback order
        return;
      }
      if (typeof val === "object" && val.includes("-111")) {
        newOptions.forEach((item) => {
          if (item.staffUserKey !== "-111") {
            item.disabled = true;
          }
        });
      }
      setOptions(pinSpecialItems(newOptions));
      setFetching(false);
    });
  };

  const onUserSelectChange = (value) => {
    if (typeof value === "object" && value.includes("-111")) {
      value = ["-111"];
      options.forEach((item) => {
        if (item.staffUserKey !== "-111") {
          item.disabled = true;
        }
      });
      setOptions(pinSpecialItems([...options]));
    } else {
      if (
        typeof value === "object" &&
        value.length &&
        props?.type !== "approval" &&
        props?.type !== "approvalSet"
      ) {
        options.forEach((item) => {
          if (item.staffUserKey !== "-111") {
            item.disabled = false;
          }
        });
        // 已选项紧跟特殊选项之后，特殊选项始终置顶
        const specialItems = [];
        const selectedItems = [];
        const unselectedItems = [];
        options.forEach(item => {
          if (item.staffUserKey === '-111' || item.staffId === '-222') {
            specialItems.push(item);
          } else if (value.includes(item.staffUserKey)) {
            selectedItems.push(item);
          } else {
            unselectedItems.push(item);
          }
        });
        setOptions(pinSpecialItems([...specialItems, ...selectedItems, ...unselectedItems]));
      } else {
        options.forEach((item) => {
          if (item.staffUserKey !== "-111") {
            item.disabled = false;
          }
        });
        setOptions(pinSpecialItems([...options]));
      }
    }
    setVal(value);
    props?.getUserIds(value);
    if (props?.getPickerUser) {
      const users = JSON.parse(JSON.stringify(options));
      users.filter((item) => {
        if (item.staffUserKey === value) {
          props?.getPickerUser(item);
        }
      });
    }
    if (!value) {
      // 非受控模式（单项登记，未传 value）：清空后内部自动回退到自己，
      // 并重新加载成员列表确保登录用户在 options 中，否则 Select 无法显示 label。
      // 受控模式（批量登记等）：将 undefined 透传给父组件，由父组件决定后续行为。
      if (!__isControlled) {
        // 兼容多种来源：props.loginUser.userKey / props.loginUser.id / localStorage.feishuUserInfo.userKey
        let fallbackVal = props?.loginUser?.userKey || props?.loginUser?.id;
        if (!fallbackVal) {
          try {
            const raw = localStorage.getItem('feishuUserInfo');
            if (raw) fallbackVal = JSON.parse(raw)?.userKey;
          } catch (_) {}
        }
        setName("");
        setFetching(true);
        getMembers().then((newOptions) => {
          setOptions(pinSpecialItems(newOptions || []));
          setFetching(false);
        });
        setVal(fallbackVal);
      }
      props?.getUserIds(value);
    }
  };

  const onNameChange = (event) => {
    setName(event.target.value);
  };

  useEffect(() => {
    setOptions([]);
    setFetching(true);
    debounceFetcher(name);
  }, [name]);

  return (
    <Select
      onFocus={onfocus}
      filterOption={false}
      maxTagCount={1}
      maxTagPlaceholder={(omittedValues) => (
        <Tooltip
          styles={{
            root: {
              pointerEvents: "none",
            },
          }}
          title={
            <div
              style={{
                maxWidth: "300px",
                maxHeight: "200px",
                overflow: "auto",
              }}
            >
              {omittedValues.map(({ label, value: val }) => (
                <div key={val}>{label}</div>
              ))}
            </div>
          }
        >
          <span>+{omittedValues?.length}</span>
        </Tooltip>
      )}
      allowClear={(() => {
        // 兼容 loginUser 为空时从 localStorage 取当前用户 key
        let selfKey = props?.loginUser?.userKey || props?.loginUser?.id;
        if (!selfKey) {
          try {
            const raw = localStorage.getItem('feishuUserInfo');
            if (raw) selfKey = JSON.parse(raw)?.userKey;
          } catch (_) {}
        }
        const internalAllowClear = selfKey
          ? (String(val) === String(selfKey) ? false : true)
          : typeof val === "object" && val?.length === 1
          ? false
          : true;
        return internalAllowClear;
      })()}
      notFoundContent={
        fetching ? (
          <Spin tip="数据加载中...">
            <div size="small" style={{ width: "100%", height: "100px" }}></div>
          </Spin>
        ) : (
          <div className="empty-data">
            <Empty
              image={noDataTable}
              styles={{
                image: {
                  height: 40,
                  width: 40,
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
        )
      }
      {...other}
      value={val}
      onChange={onUserSelectChange}
      popupRender={(menu) => (
        <>
          <Input
            disabled={val ? JSON.stringify(val).includes("-111") : false}
            prefix={<SearchOutlined style={{ color: "#BBBBBB" }} />}
            placeholder="搜索"
            value={name}
            onChange={onNameChange}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <Divider
            style={{
              margin: "8px 0",
            }}
          />
          {menu}
        </>
      )}
      options={(() => {
        // options 无数据时，若当前选中值是当前登录用户，则追加一条本地用户作为回显项
        let mergedOptions = options || [];
        if ((!mergedOptions || mergedOptions.length === 0) && val) {
          let localUser = null;
          try {
            const raw = localStorage.getItem('feishuUserInfo');
            if (raw) localUser = JSON.parse(raw);
          } catch (_) {}
          if (localUser && String(val) === String(localUser.userKey)) {
            mergedOptions = [{
              staffUserKey: localUser.userKey,
              staffId: localUser.userKey,
              name: localUser.nameCn,
              staffName: localUser.nameCn,
              avatarUrl: localUser.avatarUrl || '',
            }];
          }
        }
        return mergedOptions.map((item) => ({
        key: item.staffUserKey || item.staffId,
        label: (
          <div className="selected-item">
            <Avatar
              className="selected-item-icon"
              size={17}
              src={item?.avatarUrl || item?.staffAvatarUrl}
              icon={
                item.staffId === "-222" ? (
                  <TeamOutlined style={{ fontSize: "14px" }} />
                ) : (
                  <UserOutlined />
                )
              }
            />
            <span className="selected-item-name">{item?.name ||item?.staffName}</span>
          </div>
        ),
        value:
          props?.type === "approval" || props?.type === "approvalSet"
            ? item.staffUserKey
            : item.staffUserKey,
        disabled: item?.disabled,
      }));
      })()}
      showSearch={false}
    />
  );
}
