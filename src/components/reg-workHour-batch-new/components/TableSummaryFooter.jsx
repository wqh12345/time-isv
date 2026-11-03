import React, { useRef } from "react";
import { Spin } from "antd";
import Decimal from "decimal.js";
import { getDatesInRange } from '../../../util/util';

/** 表格底部汇总区域 */
const TableSummaryFooter = ({
  workInstanceDataSource,
  beginWorkDate,
  endWorkDate,
  regTableColumns,
  workHoursTotalDetail,
  summaryRef,
  loading,
  hasMore,
}) => {
  if (!workInstanceDataSource?.entities?.length) return null;

  const rangeDates = getDatesInRange(beginWorkDate, endWorkDate);
  const columnTotals = {};
  rangeDates?.forEach(item => {
    columnTotals[item.date] = new Decimal(0);
  });

  workInstanceDataSource?.entities?.forEach(record => {
    rangeDates?.forEach(item => {
      if (record[item.date]?.actWorkHour) {
        columnTotals[item.date] = columnTotals[item.date].plus(
          new Decimal(record[item.date].actWorkHour || 0)
        );
      }
    });
  });

  const visibleColumns = regTableColumns.filter(column => !column.hidden);
  const tableTotalWidth = visibleColumns.reduce((total, column) => {
    return total + (column.width || 120);
  }, 0);

  return (
    <>
      <div
        ref={summaryRef}
        style={{
          width: '100%',
          backgroundColor: '#F8F9FA',
          borderTop: '1px solid #f0f0f0',
          overflow: 'hidden',
          position: 'relative',
          maxHeight: '60px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          fontWeight: '400'
        }}
        className="summary-container"
      >
        <div
          style={{
            width: `${tableTotalWidth}px`,
            minWidth: '100%',
            transform: 'translateX(0px)'
          }}
          className="summary-content"
        >
          <table
            style={{
              width: `${tableTotalWidth}px`,
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
              minWidth: '100%'
            }}
          >
            <colgroup>
              {visibleColumns.map((column, index) => (
                <col
                  key={column.key || column.dataIndex || index}
                  style={{ width: column.width ? `${column.width}px` : '120px' }}
                />
              ))}
            </colgroup>
            <tbody>
              <tr>
                {(() => {
                  const nonDateColumns = visibleColumns.filter(col => {
                    const isDate = /^\d{4}-\d{2}-\d{2}$/.test(col.dataIndex);
                    const isTotal = col.dataIndex === 'total';
                    return !isDate && !isTotal;
                  });

                  const dateAndTotalColumns = visibleColumns.filter(col => {
                    const isDate = /^\d{4}-\d{2}-\d{2}$/.test(col.dataIndex);
                    const isTotal = col.dataIndex === 'total';
                    return isDate || isTotal;
                  });

                  const mergedColumns = [];

                  if (nonDateColumns.length > 0) {
                    mergedColumns.push({
                      key: 'merged-column',
                      dataIndex: 'merged',
                      colSpan: nonDateColumns.length,
                      content: `每日工时登记数据（${rangeDates?.[0]?.date}至${rangeDates?.[rangeDates?.length - 1]?.date}）：`,
                      isMerged: true
                    });
                  }

                  dateAndTotalColumns.forEach(col => {
                    const isDate = /^\d{4}-\d{2}-\d{2}$/.test(col.dataIndex);
                    const isTotal = col.dataIndex === 'total';
                    let content = '';
                    if (isDate) {
                      const registeredHours = workHoursTotalDetail?.[col.dataIndex]?.registeredWorkingHours;
                      const approvalHours = workHoursTotalDetail?.[col.dataIndex]?.approvalingWorkHours;
                      content = (
                        <div style={{ display: 'inline-block', lineHeight: '1.5', color: '#646A73', fontSize: '12px', textAlign: 'left' }}>
                          <div>已登记：{registeredHours != null ? registeredHours : '--'}h</div>
                          <div>待审批：{approvalHours != null ? approvalHours : '--'}h</div>
                        </div>
                      );
                    } else if (isTotal) {
                      content = '';
                    }
                    mergedColumns.push({
                      key: col.key || col.dataIndex,
                      dataIndex: col.dataIndex,
                      colSpan: 1,
                      content,
                      isDate,
                      isTotal,
                      width: col.width
                    });
                  });

                  return mergedColumns.map((col) => (
                    <td
                      key={col.key}
                      colSpan={col.colSpan}
                      style={{
                        fontSize: '12px',
                        color: '#646A73',
                        padding: '5px 16px',
                        textAlign: col.isDate || col.isTotal ? 'center' : 'left',
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                        textOverflow: col.isMerged ? 'unset' : 'ellipsis',
                        whiteSpace: col.isMerged ? 'normal' : 'nowrap',
                        width: col.isMerged ? 'auto' : (col.width ? `${col.width}px` : '120px'),
                        minWidth: col.isMerged ? 'auto' : (col.width ? `${col.width}px` : '120px'),
                        maxWidth: col.isMerged ? 'none' : (col.width ? `${col.width}px` : '120px')
                      }}
                    >
                      {col.content}
                    </td>
                  ));
                })()}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        {loading && <Spin size="small" />}
        {!loading && hasMore ? (
          <span style={{ color: "#727272" }}>滚动加载更多...</span>
        ) : null}
      </div>
    </>
  );
};

export default TableSummaryFooter;
