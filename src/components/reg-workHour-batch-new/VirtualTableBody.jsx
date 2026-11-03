import React, { useRef, useState, useEffect } from "react";

/** 虚拟滚动表格组件 - 大数据量表格性能优化 */
const VirtualTableBody = ({ children, ...props }) => {
  const tbodyRef = useRef();
  const [visibleRange, setVisibleRange] = useState([0, 50]);
  const rowHeight = 40;
  const scrollPositionRef = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!tbodyRef.current) return;
      const tableContainer = tbodyRef.current.closest('.ant-table-body');
      if (!tableContainer) return;

      const scrollTop = tableContainer.scrollTop;
      const containerHeight = tableContainer.clientHeight;
      scrollPositionRef.current = scrollTop;

      const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 10);
      const endIndex = Math.min(
        React.Children.count(children) - 1,
        startIndex + Math.ceil(containerHeight / rowHeight) + 20
      );
      setVisibleRange([startIndex, endIndex]);
    };

    const restoreScrollPosition = () => {
      const tableContainer = tbodyRef.current?.closest('.ant-table-body');
      if (tableContainer && scrollPositionRef.current > 0) {
        tableContainer.scrollTop = scrollPositionRef.current;
      }
    };

    const setupScrollListener = () => {
      const tableContainer = tbodyRef.current?.closest('.ant-table-body');
      if (tableContainer) {
        tableContainer.addEventListener('scroll', handleScroll);
        handleScroll();
        setTimeout(() => { restoreScrollPosition(); }, 50);
      }
    };

    const timer = setTimeout(setupScrollListener, 0);
    return () => {
      clearTimeout(timer);
      const tableContainer = tbodyRef.current?.closest('.ant-table-body');
      if (tableContainer) {
        tableContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, [children]);

  if (!children || React.Children.count(children) <= 0) {
    return <tbody {...props} ref={tbodyRef}>{children}</tbody>;
  }

  if (React.Children.count(children) <= 50) {
    return <tbody {...props} ref={tbodyRef}>{children}</tbody>;
  }

  const [startIndex, endIndex] = visibleRange;
  const totalRows = React.Children.count(children);
  const topPlaceholderHeight = startIndex * rowHeight;
  const bottomPlaceholderHeight = Math.max(0, (totalRows - endIndex - 1) * rowHeight);

  return (
    <tbody {...props} ref={tbodyRef}>
      {topPlaceholderHeight > 0 && (
        <tr>
          <td
            colSpan={props.columns?.length || 1}
            style={{ height: topPlaceholderHeight, padding: 0, border: 'none' }}
          />
        </tr>
      )}
      {React.Children.toArray(children).slice(startIndex, endIndex + 1)}
      {bottomPlaceholderHeight > 0 && (
        <tr>
          <td
            colSpan={props.columns?.length || 1}
            style={{ height: bottomPlaceholderHeight, padding: 0, border: 'none' }}
          />
        </tr>
      )}
    </tbody>
  );
};

export default VirtualTableBody;
