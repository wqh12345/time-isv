import JSSDK from '../../jssdk-adapter'
import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  Alert,
  DatePicker,
  InputNumber,
  Table,
  Input,
  Space,
  Tooltip,
  Modal,
  message,
  Radio,
  Select,
  Popover,
  Form,
  Button,
  Spin,
  Cascader,
  Divider,
  Checkbox,
  Tree
} from "antd";
import {
  InfoCircleFilled,
  CloseOutlined,
  ExclamationCircleFilled,
  PlusOutlined,
  SearchOutlined,
  SettingOutlined,
  DragOutlined,
  DeleteOutlined
} from "@ant-design/icons";
import {
  getWeekStartAndEnd,
  getLastWeekRange,
  getLastMonthRange,
  getQuarterStartAndEnd,
  getFirstDayOfNaturalMonth,
  getLastDayOfNaturalMonth,
  validateDecimalPlaces,
  getDatesInRange,
} from '../../util/util';
import {
  getStandWorkHour,
  getUserRole,
  getProjectConfig,
  getWorkSaturationTips,
  postBatchInsertNodeWorkHourNew,
  postUserActive,
  getWorkItemOptionNew,
  postQueryBatch,
  postItemEntityOptionNew,
  getEntityNodeOptionNew,
  postEntityNodeTaskSchedule,
  postEntityNodeTask,
  getDisplayLogic,
  getBatchRegTableSortConfig,
  postBatchRegTableSortConfig,
  postBatchApprovalAgain,
  getWorkItemOptionForRegister,
  saveRegisterCache,
  getRegisterCache,
  clearRegisterCache,
  getRegistrationSettings,
  queryExpandLevelNode,
  queryWorkHoursTotalDetail,
  getUserStandWorkHour
} from '../../api/api';
import "../reg-workHour-batch-new/RegWorkHourBatchNew.less";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import UserPicker from "../user-picker/UserPicker";
import Decimal from "decimal.js";
import RegisterWorkItemTable from "../reg-workHour-batch-new/RegisterWorkItemTable";
import debounce from "lodash/debounce";

dayjs.extend(customParseFormat);

const { RangePicker } = DatePicker;
const { TextArea } = Input;

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

const BatchRegistration = (props) => {
  const [regBatchForm] = Form.useForm();
  const [addWorkItemForm] = Form.useForm();
  const workHourInputNumRef = useRef(null);
  const [isAddWorkItemOpen, setIsAddWorkItemOpen] = useState(false);
  const [point, setPoint] = useState(props.type === 'tab' ? props?.workItemEntityId : '');
  const [registrantUserKey, setRegistrantUserKey] = useState(props?.loginUser?.id);
  const [pickerUser, setPickerUser] = useState({
    userKey: props?.loginUser?.id,
    nameCn: props?.loginUser?.name,
    avatarUrl: props?.loginUser?.avatar,
  });
  const [loading, setLoading] = useState(false);
  const [registerCacheLoading, setRegisterCacheLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [workItemOptions, setWorkItemOptions] = useState([]);
  const [beginWorkDate, setBeginWorkDate] = useState(getWeekStartAndEnd().Monday);
  const [endWorkDate, setEndWorkDate] = useState(getWeekStartAndEnd().Sunday);
  const [beginWorkDateCP, setBeginWorkDateCP] = useState(getWeekStartAndEnd().Monday);
  const [endWorkDateCP, setEndWorkDateCP] = useState(getWeekStartAndEnd().Sunday);
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleEnd, setScheduleEnd] = useState("");
  const [isPersonInCharge, setIsPersonInCharge] = useState(0);
  const [regTableColumns, setRegTableColumns] = useState([]);
  const [workItemIds, setWorkItemIds] = useState([]);
  const [workItemEntityId, setWorkItemEntityId] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [isWorkItemChanged, setIsWorkItemChanged] = useState(false);
  const [workDate, setWorkDate] = useState("");
  const [capacitySet, setCapacitySet] = useState({});
  const [isAllowRegister, setIsAllowRegister] = useState(false);
  const [workInstanceDataSource, setWorkInstanceDataSource] = useState({});
  const [tableDataSource, setTableDataSource] = useState([]);
  const [tableAddDataSource, setTableAddDataSource] = useState([]);
  const [workInstancePagination, setWorkInstancePagination] = useState({
    pageNum: 1,
    pageSize: 10,
  });
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);
  const [alertDetail, setAlertDetail] = useState({});
  const [alertDetailOld, setAlertDetailOld] = useState({});
  const [curRecord, setCurRecord] = useState({});
  const [nodeTaskOptions, setNodeTaskOptions] = useState([]);
  const tableRef = useRef(null);
  const summaryRef = useRef(null);
  const filterRegistrationRef = useRef([]);
  const [isComposing, setIsComposing] = useState(false);
  const workDescReq = useRef(0);

  useEffect(() => {
    const handleTableScroll = () => {
      if (summaryRef.current) {
        const tableScrollContainer = document.querySelector('.table-warp .ant-table-body');
        if (tableScrollContainer && summaryRef.current) {
          const tableScrollLeft = tableScrollContainer.scrollLeft;
          const summaryContent = summaryRef.current.querySelector('.summary-content');
          if (summaryContent) {
            summaryContent.style.transform = `translateX(-${tableScrollLeft}px)`;
          }
        }
      }
    };

    const tableScrollContainer = document.querySelector('.table-warp .ant-table-body');
    if (tableScrollContainer) {
      tableScrollContainer.addEventListener('scroll', handleTableScroll);
      return () => {
        tableScrollContainer.removeEventListener('scroll', handleTableScroll);
      };
    }
  }, []);

  const onSubmit = async () => {
    // 提交批量登记
    props.submitResult && props.submitResult(2);
  };

  const onSave = async () => {
    // 暂存
    props.submitResult && props.submitResult(1);
  };

  const onCancel = () => {
    props.onCancel && props.onCancel();
  };

  return (
    <div
      className="batch-registration-content"
      style={props?.type === "tab" ?
        { height: "675px", position: "relative" } :
        props?.wHeight > 718 ?
          { height: "645px", position: "relative" } :
          { height: "85vh", position: "relative" }
      }
    >
      <div className="batch-registration-form">
        <Form form={regBatchForm} layout="vertical">
          <div className="batch-form-header">
            <Form.Item label="登记人" className="form-item-inline">
              <UserPicker
                type="Gantt"
                mode="multiple"
                placeholder="选择登记人"
                getUserIds={(val) => setRegistrantUserKey(val)}
              />
            </Form.Item>
            <Form.Item label="日期范围" className="form-item-inline">
              <RangePicker
                presets={rangePresets}
                value={[dayjs(beginWorkDate), dayjs(endWorkDate)]}
                onChange={(dates) => {
                  if (dates) {
                    setBeginWorkDate(dates[0].format('YYYY-MM-DD'));
                    setEndWorkDate(dates[1].format('YYYY-MM-DD'));
                  }
                }}
              />
            </Form.Item>
            <Form.Item label="工作项" className="form-item-inline">
              <Select
                mode="multiple"
                placeholder="选择工作项"
                options={workItemOptions}
                value={workItemIds}
                onChange={(val) => setWorkItemIds(val)}
              />
            </Form.Item>
          </div>
          
          <div className="batch-table-container">
            <Table
              ref={tableRef}
              columns={regTableColumns}
              dataSource={tableDataSource}
              loading={loading}
              pagination={{
                ...workInstancePagination,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条`,
              }}
              expandable={{
                expandedRowKeys,
                onExpandedRowsChange: setExpandedRowKeys,
              }}
            />
          </div>
        </Form>
      </div>

      <div
        className="content-footer"
        style={{ position: "absolute", bottom: 0, width: "400px", right: '0' }}
      >
        <Space>
          <Button onClick={onCancel}>取消</Button>
          {props?.openType === "again_launch" ? null : (
            <Button
              loading={props?.saveHourLoadings}
              onClick={onSave}
            >
              暂存
            </Button>
          )}
          <Button
            loading={props?.submitLoadings}
            type="primary"
            onClick={onSubmit}
          >
            {props?.submitBtnTxt || "提交"}
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default BatchRegistration;
