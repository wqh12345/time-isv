import React, { useEffect, useRef } from "react";
import {
  Tooltip,
  Popover,
  Form,
  InputNumber,
  Input,
} from "antd";
import RegisterWorkItemTable from "../RegisterWorkItemTable";
import { isGranularityViolated } from "../../../util/util";
import {
  getAttendanceUpperLimit,
  normalizeAttendanceNumber,
  isDateInSchedule,
} from "../utils";

/** 日期列 Popover - 包含工时登记表单 */
const DateColumnPopover = ({
  record,
  item,
  index,
  regBatchForm,
  curRecord,
  setCurRecord,
  setWorkDate,
  dayUpFlag,
  workHourInputNumRef,
  workDescReq,
  granularity,
  projectKey,
  attendanceConfig,
  capacitySnapshot,
  onOpenDate,
}) => {
  const _ = record?.[item.date];
  // 动态"单天填报上限"：跟随考勤场景取值（未开启考勤时回退固定 dayUp）
  const _snapEnabled = normalizeAttendanceNumber(capacitySnapshot?.attendanceEnabled) ?? 0;
  const _snapHours = normalizeAttendanceNumber(capacitySnapshot?.attendanceHours);
  const _snapPolicy = normalizeAttendanceNumber(capacitySnapshot?.missPunchPolicy) ?? 1;
  const _snapCustomLimit = normalizeAttendanceNumber(capacitySnapshot?.missPunchCustomLimit);
  const hasAttendanceHours = _snapHours !== null && _snapHours > 0;
  const fallbackDayUp = Number(record?.dayUp);
  const dynamicDayUp = getAttendanceUpperLimit({
    enabled: _snapEnabled,
    hours: _snapHours,
    policy: _snapPolicy,
    customLimit: _snapCustomLimit,
    dayUp: fallbackDayUp,
  });
  const rawCurrentWorkHour = _?.actWorkHour;
  const currentWorkHour = Number(rawCurrentWorkHour);
  const hasCurrentWorkHour = rawCurrentWorkHour !== null
    && rawCurrentWorkHour !== undefined
    && rawCurrentWorkHour !== ''
    && Number.isFinite(currentWorkHour);
  const rawRemainingWork = capacitySnapshot?.remainingWork;
  const hasRemainingWork = rawRemainingWork !== null
    && rawRemainingWork !== undefined
    && Number.isFinite(Number(rawRemainingWork));
  const remainingWork = hasRemainingWork ? Number(rawRemainingWork) : null;
  const isOverLimit = hasCurrentWorkHour && (
    currentWorkHour > dynamicDayUp
    || (hasRemainingWork && currentWorkHour > remainingWork)
  );
  

  const isBelowMinimum = hasCurrentWorkHour
    && currentWorkHour < Number(record?.onceDown);
  // 工时颗粒度：当前行所属空间开启后，填报工时不是颗粒度值的整数倍时视为异常
  const isGranularityInvalid = isGranularityViolated(rawCurrentWorkHour, granularity);
  const isInvalidWorkHour = isBelowMinimum || isOverLimit || Boolean(_?.flag) || isGranularityInvalid;
  useEffect(() => {
    if (!_?.isRegFormOpen) return undefined;

    const value = regBatchForm.getFieldValue("realActWorkHour");
    if (value === null || value === undefined || value === "") return undefined;

    const timer = setTimeout(() => {
      regBatchForm.validateFields(["realActWorkHour"]).catch(() => {});
    }, 0);

    return () => clearTimeout(timer);
  }, [
    _?.isRegFormOpen,
    _?.flag,
    capacitySnapshot?.remainingWork,
    capacitySnapshot?.attendanceEnabled,
    capacitySnapshot?.attendanceHours,
    capacitySnapshot?.missPunchPolicy,
    capacitySnapshot?.missPunchCustomLimit,
    granularity?.enabled,
    granularity?.hour,
    regBatchForm,
  ]);

  const cellBorderColor = _?.isRegFormOpen
    ? "#4247f6"
    : isInvalidWorkHour
      ? "#f0f0f0"
      : _?.flag || record.canRegisterLevel === false
        ? "#f0f0f0"
        : "transparent";

  const renderCellContent = () => {
    let name = "--";
    let icon = null;
    if (record?.workItemEntityName) {
      name = record?.workItemEntityName;
    } else if (record?.nodeName) {
      name = record?.nodeName;
    } else if (record?.taskName) {
      name = record?.taskName;
    }
    return name;
  };

  return (
    <>
      <Tooltip
        title={record.canRegisterLevel === false ? "该层级禁止登记" : ""}
        placement="top"
      >
        <Popover
          style={{ display: "block", width: "100%", height: "100%" }}
          placement="bottom"
          trigger="click"
          content={
            <>
              <Form
                form={regBatchForm}
                className="regBatchNew-form"
                onValuesChange={(values, allValues) => {
                  const updatedRecord = {
                    ...record,
                    [`${item.date}`]: {
                      ...record[`${item.date}`],
                      ...allValues,
                      actWorkHour: allValues.realActWorkHour
                    },
                    timestamp: Date.now()
                  };
                  setCurRecord(updatedRecord);
                }}
              >
                <Form.Item label={<span style={{ marginLeft: 8 }}>登记日期</span>}>
                  {record?.date}（{item?.dayOfWeek}）
                </Form.Item>
                <div style={{ height: 30, overflow: "hidden", width: '300px' }}>
                  <RegisterWorkItemTable
                    registerDate={item.date}
                    key={curRecord?.id ? `${curRecord.id}-${Date.now()}` : `table-${Date.now()}`}
                    dataSource={record}
                  />
                </div>
                <Form.Item
                  label={
                    <div>
                      <span style={{ color: "#df000e", fontSize: 14 }}>* </span>
                      登记工时
                    </div>
                  }
                  name="realActWorkHour"
                  // 单字段只保留一条错误，优先级即下面规则的顺序：
                  // 无考勤 > 上限/下限 > 工时颗粒度（与 Web 批量、H5 单项登记一致）
                  validateFirst
                  rules={[
                    // 考勤记录校验
                    {
                      validator: (rule, value) => {
                        // 使用快照中的考勤配置值
                        // 条件：考勤开启 && 无考勤记录 && 缺卡策略为不允许提交
                        if (_snapEnabled === 1 && !hasAttendanceHours && _snapPolicy === 1) {
                          return Promise.reject(new Error('当天无考勤记录，不可登记工时'));
                        }
                        return Promise.resolve();
                      },
                    },
                    // 工时范围校验
                    {
                      validator: (rule, value) => {
                        const isMissPunchRegistrationBlocked = _snapEnabled === 1
                          && !hasAttendanceHours
                          && _snapPolicy === 1;

                        if (isMissPunchRegistrationBlocked) {
                          return Promise.resolve();
                        }

                        // 合计超限：当天所有登记对象拟提交工时之和已超过可登记上限。
                        // flag 由 computeAlertDetail 按「上限-已登记-待审批 < 拟提交合计」写入当前日期单元格，
                        // 与顶部 banner「剩余可登记工时」口径一致，补齐单格校验无法感知合计超限的问题。
                        if (_?.flag) {
                          return Promise.reject(
                            `当天填报工时超过上限工时 ${dynamicDayUp} 小时`
                          );
                        }

                        if (typeof value === "number") {
                          // 下限校验
                          if (value < record?.onceDown) {
                            return Promise.reject(`低于单次填报工时下限${record?.onceDown}小时`);
                          }

                          // 上限校验（使用考勤配置）
                          const rawRemainingWork = capacitySnapshot?.remainingWork;
                          const hasRemainingWork = rawRemainingWork !== null
                            && rawRemainingWork !== undefined
                            && Number.isFinite(Number(rawRemainingWork));
                          const snapRemaining = hasRemainingWork
                            ? Number(rawRemainingWork)
                            : dynamicDayUp;

                          // 单天上限与单元格展示保持一致，均使用当前日期的动态上限。
                          const upperLimit = dynamicDayUp;

                          // 提交后剩余工时小于 0 时，显示现有超限提示文案。
                          const remainingAfterSubmit = snapRemaining - value;
                          if (remainingAfterSubmit < 0 || value > upperLimit) {
                            return Promise.reject(`当天填报工时超过上限工时 ${dynamicDayUp} 小时`);
                          }
                        }
                        return Promise.resolve();
                      },
                    },
                    // 工时颗粒度整数倍校验（优先级最低，未开启或空值均放行）
                    {
                      validator: (rule, value) => {
                        if (isGranularityViolated(value, granularity)) {
                          return Promise.reject(new Error(`填报工时必须是 ${granularity?.hour} 的整数倍`));
                        }
                        return Promise.resolve();
                      },
                    },
                  ]}
                >
                  <InputNumber
                    size="small"
                    style={{
                      width: "100%",
                      borderColor: dayUpFlag.current && workHourInputNumRef.current?.value ? '#F0144A' : undefined
                    }}
                    placeholder="请输入"
                    precision={2}
                    max={9999}
                    formatter={(value) => {
                      if (value === null || value === undefined) return value;
                      let stringValue = value.toString().replace('。', '.');
                      if (stringValue.includes('.')) {
                        const parts = stringValue.split('.');
                        if (parts[1] && parts[1].length > 2) {
                          return `${parts[0]}.${parts[1].slice(0, 2)}`;
                        }
                      }
                      return stringValue;
                    }}
                    parser={(value) => {
                      if (value === null || value === undefined) return null;
                      if (typeof value === 'string') {
                        value = value.replace('。', '.');
                        if (value.includes('.')) {
                          const parts = value.split('.');
                          if (parts[1] && parts[1].length > 2) {
                            return parseFloat(`${parts[0]}.${parts[1].slice(0, 2)}`);
                          }
                        }
                      }
                      return value === '' ? null : parseFloat(value) || value;
                    }}
                    onChange={(value) => {
                      if (value && value.toString().includes('.')) {
                        const parts = value.toString().split('.');
                        if (parts[1] && parts[1].length > 2) {
                          const newValue = parseFloat(`${parts[0]}.${parts[1].slice(0, 2)}`);
                          regBatchForm.setFieldsValue({ actWorkHour: newValue });
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      if (!e || !e.target) return;
                      const target = e.target;
                      let value = target.value || '';
                      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'ArrowLeft' ||
                        e.key === 'ArrowRight' || e.key === 'Tab' || e.key === 'Enter' ||
                        e.ctrlKey || e.metaKey || e.altKey) {
                        return;
                      }
                      if (e.key === '。') {
                        e.preventDefault();
                        if (value.includes('.') || value.includes('。')) return;
                        const normalizedValue = value.replace('。', '.');
                        const cursorPosition = target.selectionStart;
                        const newValue = normalizedValue.slice(0, cursorPosition) + '.' + normalizedValue.slice(cursorPosition);
                        target.value = newValue;
                        const newCursorPosition = cursorPosition + 1;
                        target.setSelectionRange(newCursorPosition, newCursorPosition);
                        regBatchForm.setFieldsValue({ actWorkHour: parseFloat(newValue) || newValue });
                        return;
                      }
                      if ((e.key >= '0' && e.key <= '9') || e.key === '.') {
                        if (e.key === '.') {
                          if (value.includes('.') || value.includes('。')) {
                            e.preventDefault();
                            return;
                          }
                        }
                        const normalizedValue = value.replace('。', '.');
                        if (normalizedValue.includes('.')) {
                          const parts = normalizedValue.split('.');
                          const cursorPosition = target.selectionStart;
                          const decimalPosition = normalizedValue.indexOf('.') + 1;
                          if (parts[1] && parts[1].length >= 2 && cursorPosition > decimalPosition) {
                            e.preventDefault();
                            return;
                          }
                        }
                      } else {
                        e.preventDefault();
                      }
                    }}
                    onCompositionStart={() => {}}
                    onCompositionEnd={(e) => {
                      const target = e.target;
                      let value = target.value;
                      let filteredValue = value.replace(/[^\d.。]/g, '');
                      const dotIndex = filteredValue.indexOf('.');
                      const fullDotIndex = filteredValue.indexOf('。');
                      if (dotIndex !== -1 && fullDotIndex !== -1) {
                        const firstDotPos = Math.min(dotIndex, fullDotIndex);
                        const firstDot = dotIndex < fullDotIndex ? '.' : '。';
                        const remainingPart = filteredValue.substring(firstDotPos + 1);
                        const remainingWithoutDots = remainingPart.replace(/[.。]/g, '');
                        filteredValue = filteredValue.substring(0, firstDotPos + 1) + firstDot + remainingWithoutDots;
                      }
                      if (filteredValue && filteredValue.includes('。')) {
                        filteredValue = filteredValue.replace('。', '.');
                      }
                      if (filteredValue && filteredValue.includes('.')) {
                        const [integerPart, decimalPart] = filteredValue.split('.');
                        if (integerPart && integerPart.length > 4) {
                          filteredValue = integerPart.substring(0, 4) + '.' + decimalPart;
                        }
                        if (decimalPart && decimalPart.length > 2) {
                          filteredValue = (filteredValue.split('.')[0]) + '.' + decimalPart.substring(0, 2);
                        }
                      } else if (filteredValue && filteredValue.length > 4) {
                        filteredValue = filteredValue.substring(0, 4);
                      }
                      if (value !== filteredValue) {
                        target.value = filteredValue;
                        regBatchForm.setFieldsValue({ actWorkHour: parseFloat(filteredValue) || filteredValue });
                      }
                    }}
                    onInput={(e) => {
                      if (!e || !e.target) return;
                      console.log("e.target", e.target);
                      const target = e.target;
                      let value = target.value;
                      let filteredValue = value.replace(/[^\d.。]/g, '');
                      const dotIndex = filteredValue.indexOf('.');
                      const fullDotIndex = filteredValue.indexOf('。');
                      if (dotIndex !== -1 && fullDotIndex !== -1) {
                        const firstDotPos = Math.min(dotIndex, fullDotIndex);
                        const firstDot = dotIndex < fullDotIndex ? '.' : '。';
                        const remainingPart = filteredValue.substring(firstDotPos + 1);
                        const remainingWithoutDots = remainingPart.replace(/[.。]/g, '');
                        filteredValue = filteredValue.substring(0, firstDotPos + 1) + firstDot + remainingWithoutDots;
                      }
                      if (filteredValue && filteredValue.includes('。')) {
                        filteredValue = filteredValue.replace('。', '.');
                      }
                      if (filteredValue && filteredValue.includes('.')) {
                        const [integerPart, decimalPart] = filteredValue.split('.');
                        if (integerPart && integerPart.length > 4) {
                          filteredValue = integerPart.substring(0, 4) + '.' + decimalPart;
                        }
                        if (decimalPart && decimalPart.length > 2) {
                          filteredValue = integerPart + '.' + decimalPart.substring(0, 2);
                        }
                      } else if (filteredValue && filteredValue.length > 4) {
                        filteredValue = filteredValue.substring(0, 4);
                      }
                      if (value !== filteredValue) {
                        target.value = filteredValue;
                        regBatchForm.setFieldsValue({ actWorkHour: parseFloat(filteredValue) || filteredValue });
                      }
                    }}

                    ref={workHourInputNumRef}
                  />
                </Form.Item>
                <Form.Item
                  label={
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', width: '100%' }}>
                      {workDescReq === true && <span style={{ color: "#df000e", fontSize: 14, marginRight: 4 }}>*</span>}
                      {workDescReq === false && <span style={{ marginLeft: 8 }}></span>}
                      <span>工作描述</span>
                    </div>
                  }
                  name="workDesc"
                  rules={[
                    {
                      validator: (rule, value) => {
                        if (workDescReq === true && (!value || value.trim() === '') && record[item.date]?.realActWorkHour > 0 && record[item.date]?.isRegFormOpen) {
                          return Promise.reject('请填写工作描述');
                        }
                        return Promise.resolve();
                      },
                    },
                  ]}
                >
                  <Input.TextArea
                    size="small"
                    style={{ resize: "none", margin: "5px 0" }}
                    showCount
                    maxLength={200}
                    placeholder="请输入"
                    rows={3}
                  />
                </Form.Item>
              </Form>
            </>
          }
          onOpenChange={(newOpen) => {
            if (record.canRegisterLevel === false && newOpen) return;
            record.date = item.date;
            record.dayOfWeek = item.dayOfWeek;
            record.index = index;
            record[item.date] = {
              ...record[item.date],
              isRegFormOpen: newOpen,
            };
            regBatchForm.setFieldsValue(_);
            setWorkDate(item.date);
            setCurRecord({ ...record });
            const attendanceRequest = newOpen ? onOpenDate?.() : null;
            if (newOpen) {
              setTimeout(() => {
                regBatchForm.validateFields(["realActWorkHour"]).catch(() => {});
                workHourInputNumRef.current?.focus();
              }, 100);
              if (attendanceRequest?.then) {
                attendanceRequest.then(() => {
                  if (record[item.date]?.isRegFormOpen) {
                    regBatchForm.validateFields(["realActWorkHour"]).catch(() => {});
                  }
                }).catch(() => {});
              }
            } else {
              const workHour = record[item.date]?.actWorkHour || record[item.date]?.realActWorkHour;
              const workDesc = record[item.date]?.workDesc;
              if ((!workHour || workHour === 0) && (!workDesc || workDesc.trim() === '')) {
                regBatchForm.setFields([{ name: 'workDesc', errors: [] }]);
              }
            }
          }}
          open={_?.isRegFormOpen}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              display: "inline-block",
              width: "100%",
              height: _?.isRegFormOpen ? 39 : 40,
              padding: "8px",
              boxSizing: "border-box",
              color: record.canRegisterLevel === false
                ? "#999"
                : isInvalidWorkHour
                  ? "#F0144A" : "#1C1C24",
              borderTop: `1px solid ${cellBorderColor}`,
              borderLeft: `1px solid ${cellBorderColor}`,
              borderBottom: `1px solid ${cellBorderColor}`,
              backgroundColor: record.canRegisterLevel === false
                ? "#F8F9FA"
                : isBelowMinimum || isOverLimit || isGranularityInvalid
                  ? "#FEF1F4"
                  : (_?.flag)
                    ? "#FEF1F4"
                    : (workDescReq === true && _?.realActWorkHour && (!_?.workDesc || _?.workDesc?.trim() === '') && _?.isRegFormOpen == false)
                      ? "#FEF1F4"
                      : isDateInSchedule(`${item.date}`, record)
                        ? "#F4F4FE"
                        : "transparent",
              cursor: record.canRegisterLevel === false ? "not-allowed" : "pointer",
              borderRight: record.canRegisterLevel === false
                ? "none"
                : `1px solid ${cellBorderColor}`,
            }}
          >
            {_?.actWorkHour !== null && _?.actWorkHour !== undefined ? _?.actWorkHour : ""}
          </div>
        </Popover>
      </Tooltip>
    </>
  );
};

export default DateColumnPopover;
