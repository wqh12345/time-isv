import React from "react";
import { Modal, Form, Cascader, Button, Space, Select, Empty } from "antd";
import SmartSelect2 from "../SmartSelect2";

/** 添加工作项实例/节点/任务 Modal */
const AddWorkItemModal = ({
  isAddWorkItemOpen,
  setIsAddWorkItemOpen,
  addWorkItemForm,
  onAddWorkItemValuesChange,
  onAddWorkItemFinish,
  isAddWorkItemLoading,
  nodeTaskOptions,
  fetchOptions2,
  spaceOptions,
  spaceLoading,
  isCustomFieldEnabled,
  clearNodeTaskOptions,
}) => {
  // 监听已选空间（多选）与工作项实例，用于字段联动
  const selectedSpaceKeys = Form.useWatch("projectKey", addWorkItemForm);
  const selectedWorkItemEntityId = Form.useWatch("workItemEntityId", addWorkItemForm);
  const hasSpace = selectedSpaceKeys?.length > 0;
  const hasWorkItem = !!selectedWorkItemEntityId;
  return (
    <Modal
      open={isAddWorkItemOpen}
      onCancel={() => {
        setIsAddWorkItemOpen(false);
      }}
      footer={null}
    >
      <Form
        form={addWorkItemForm}
        layout="vertical"
        onValuesChange={onAddWorkItemValuesChange}
        onFinish={onAddWorkItemFinish}
      >
        <Form.Item
          label="选择所属空间"
          rules={[{ required: true, message: "请选择所属空间" }]}
          name="projectKey"
        >
          <Select
            mode="multiple"
            showSearch
            allowClear
            maxCount={3}
            placeholder="请选择空间，最多选择3个"
            style={{ width: "100%" }}
            options={spaceOptions}
            loading={spaceLoading}
            maxTagCount="responsive"
            filterOption={(input, option) =>
              (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
            }
            onChange={() => {
              // 切换空间时：清空已选工作项实例、节点/任务，并清空节点/任务下拉数据
              addWorkItemForm.setFieldsValue({
                workItemEntityId: undefined,
                workItemInstanceIds: undefined,
              });
              clearNodeTaskOptions?.();
            }}
          />
        </Form.Item>
        <Form.Item
          label="选择所属工作项实例"
          rules={[{ required: true, message: "请选择工作项实例" }]}
          name="workItemEntityId"
        >
          <SmartSelect2
            key={hasSpace ? selectedSpaceKeys.join(",") : "empty"}
            workItemIds={[]}
            projectKeys={selectedSpaceKeys}
            fetchOptions={fetchOptions2}
            isCustomFieldEnabled={isCustomFieldEnabled}
            disabled={!hasSpace}
            placeholder={hasSpace ? "请搜索选择工作项实例" : "请先选择所属空间"}
            style={{ width: "100%" }}
            onChange={(value) => {
              addWorkItemForm.setFieldValue("workItemEntityId", value);
              // 切换工作项实例时：清空已选节点/任务，并清空节点/任务下拉数据
              addWorkItemForm.setFieldValue("workItemInstanceIds", undefined);
              clearNodeTaskOptions?.();
            }}
          />
        </Form.Item>
        <Form.Item
          label="选择所属工作项实例节点/任务"
          name="workItemInstanceIds"
        >
          <Cascader
            options={nodeTaskOptions}
            multiple
            disabled={!hasWorkItem}
            placeholder={hasWorkItem ? "请选择工作项实例节点/任务" : "请先选择所属工作项实例"}
            maxTagCount="responsive"
          />
        </Form.Item>
        <div style={{ textAlign: "right" }}>
          <Space>
            <Button
              htmlType="reset"
              onClick={() => { setIsAddWorkItemOpen(false); }}
            >
              取消
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={isAddWorkItemLoading}
            >
              确定
            </Button>
          </Space>
        </div>
      </Form>
    </Modal>
  );
};

export default AddWorkItemModal;
