import React, { useEffect, useRef, useState } from "react";
import { Space, Divider, Checkbox } from "antd";
import { DragOutlined } from "@ant-design/icons";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const isColumnDisabled = (item) => Boolean(item?.disable || item?.disabled);

const TableColumnsSet = (props) => {
  const [columnsSet, setColumnsSet] = useState(props.columnsSet);
  const [activeId, setActiveId] = useState(null);
  const dragStartedRef = useRef(false);
  const dragClickResetTimerRef = useRef(null);

  useEffect(() => {
    setColumnsSet(props.columnsSet);
  }, [props.columnsSet]);

  useEffect(() => () => {
    if (dragClickResetTimerRef.current) {
      clearTimeout(dragClickResetTimerRef.current);
    }
  }, []);

  const deferDragClickReset = () => {
    if (dragClickResetTimerRef.current) {
      clearTimeout(dragClickResetTimerRef.current);
    }
    dragClickResetTimerRef.current = setTimeout(() => {
      dragStartedRef.current = false;
      dragClickResetTimerRef.current = null;
    }, 0);
  };

  // 设置传感器以支持鼠标和键盘拖拽
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 处理拖拽结束事件
  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    deferDragClickReset();
    if (!active?.id || !over?.id || active.id === over.id) return;

    const oldIndex = columnsSet.findIndex((item) => item.value === active.id);
    const newIndex = columnsSet.findIndex((item) => item.value === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newColumns = [...columnsSet];
    newColumns.splice(newIndex, 0, newColumns.splice(oldIndex, 1)[0]);
    setColumnsSet(newColumns);
    props.setColumnsSet(newColumns);
  };

  const handleCheckboxChange = (value) => {
    const newColumns = columnsSet.map((item) =>
      item.value === value
        ? { ...item, checked: isColumnDisabled(item) ? item.checked : !item?.checked }
        : item
    );
    setColumnsSet(newColumns);
    props.setColumnsSet(newColumns);
  };

  const SortableItem = ({ item, onCheckboxChange }) => {
    const disabled = isColumnDisabled(item);

    if (item.value === "workItemEntityName") {
      return (
        <div style={{ cursor: "no-drop" }}>
          <Checkbox 
            disabled={disabled}
            checked={item?.checked} 
          />
          <span style={{ marginLeft: 5 }}>{item.label}</span>
        </div>
      );
    }
    if (item.value === "regDate") {
      return (
        <div style={{ cursor: "no-drop" }}>
          <Checkbox 
            disabled={disabled}
            checked={item?.checked} 
          />
          <span style={{ marginLeft: 5 }}>{item.label}</span>
        </div>
      );
    }
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({
        id: item.value,
        disabled,
      });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "6px 0",
      cursor: disabled || item.value === "workItemEntityName" ? "no-drop" : "move",
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            position: "relative",
            zIndex: 10,
          }}
          onClick={(e) => {
            if (dragStartedRef.current) {
              dragStartedRef.current = false;
              return;
            }
            if (e.target.type !== "checkbox") {
              e.stopPropagation();
              if (!disabled) onCheckboxChange(item.value, !item.checked);
            }
          }}
        >
          <span
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <Checkbox
              disabled={disabled}
              checked={item?.checked}
              onChange={(e) => {
                e.stopPropagation(); // 添加此行
                if (!disabled) onCheckboxChange(item.value, e.target.checked);
              }}
            />
          </span>
          <span style={{ marginLeft: 5 }}>{item.label}</span>
        </div>
        {item.value === "workItemEntityName" ? null : (
          <DragOutlined style={{ color: "#999" }} />
        )}
      </div>
    );
  };

  const activeItem = columnsSet.find((item) => item.value === activeId);

  return (
    <Space direction="vertical" style={{ width: 150 }}>
      <div style={{ fontWeight: "bold" }}>字段配置</div>
      <Divider style={{ margin: "0" }} />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={({ active }) => {
          dragStartedRef.current = true;
          setActiveId(active.id);
        }}
        onDragCancel={() => {
          setActiveId(null);
          deferDragClickReset();
        }}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={columnsSet.map((item) => item.value)}
          strategy={verticalListSortingStrategy}
        >
          {columnsSet.map((item, index) => (
            <SortableItem
              key={item.value}
              item={item}
              index={index}
              onCheckboxChange={handleCheckboxChange}
            />
          ))}
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activeItem ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                boxSizing: "border-box",
                width: 150,
                padding: "6px 0",
                background: "#fff",
              }}
            >
              <div style={{ display: "flex", alignItems: "center" }}>
                <Checkbox checked={activeItem.checked} />
                <span style={{ marginLeft: 5 }}>{activeItem.label}</span>
              </div>
              <DragOutlined style={{ color: "#999" }} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </Space>
  );
};
export default TableColumnsSet;
