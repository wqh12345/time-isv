import { get, post, del } from "../config/request"


// 获取token
export function apiAuth(data) {
  return post('auth/token/access', data)
}

// 获取请求code试需要添加的scope
export function getCodeScope() {
  return get('platform/lark_permission')
}
// 用户活跃（埋点接口）
export function postUserActive(data) {
  // activeType (ConfigurationPage: 配置页, TablePage: table页, PluginInternal: 插件内, RegistrationWorkingHours: 登记工时)
  // return post('operation/management/user/active', data)
}

// 模糊搜索人员
export function postSearchMember(data) {
  // query
  // 自动注入 projectKey：优先使用调用方传入；否则取当前空间的 projectKey
  const projectKey =
    (data && data.projectKey) ||
    sessionStorage.getItem('adminCurrentProjectKey') ||
    sessionStorage.getItem('jwtMeegoTeamworkProjectKey') ||
    ''
  return post('noAuth/queryUserList', { ...(data || {}), projectKey })
}

// 查询空间所有成员（普通成员权限）
export function getProjectAllStaffUser() {
  return get('admin/new/getProjectAllStaff')
}


// 查询当前空间角色
export function getUserRole() {
  return get('user/getUserRole')
}

// 获取选项：工作项
export function getWorkItemOption() {
  return get('workHour/getWorkItemOption')
}

// 获取选项：工作项实例
export function getItemEntityOption(data) {
  // workItemKey
  return get('workHour/getItemEntityOption', data)
}

// 获取选项：工作项实例节点
export function getEntityNodeOption(data) {
  // workItemKey
  // entityId
  return get('workHour/getEntityNodeOption', data)
}

// 获取套餐到期消息
export function getPlanMessage() {
  return get('/api/isv/message')
}

// 弹窗登记展示逻辑及判断是不是标品（海外日本版专有）
export function getDisplayLogic() {
  return get('config/registration')
}

// 同步飞书项目信息(节点模式)
export function getSyncMeego() {
  return get('entityInstance/synWorkInstance')
}

// 同步飞书项目信息(状态模式)
export function getSyncStateMeego() {
  return get('entityInstance/synStateFlowInstance')
}

// 判断是否有插件管理员
export function getJudgeProjectHasAdmin() {
  return get('entityInstance/judgeProjectHasAdmin')
}

// 获取管理员级别配置
export function getProjectConfig(data) {
  // type type类型说明, 后面为类型说明于类型值说明
  /**
   * ALLOW_ADMINISTRATORS_TO_REGISTER_OTHERS_WORKING_HOURS - 允许管理员登记他人工时(0 - 不允许, 1 - 允许)
   * 
   */
  return get('config/getProjectConfig', data)
}
// 获取项目用户团队所有信息
export function getProjectUserTeamAll(flag) {
  // flag
  return get(`admin/projectUserTeamAll/${flag}`)
}


export function getreTeam(projectId, data = {}) {
  const params = { ...data }
  if (projectId !== undefined && projectId !== null) {
    params.projectId = projectId
  }
  return get('/team/reTeam', params)
}
// 变更管理员级别配置
export function postProjectConfig(data) {
  // value
  // id
  // type type类型说明, 后面为类型说明于类型值说明
  /**
   * ALLOW_ADMINISTRATORS_TO_REGISTER_OTHERS_WORKING_HOURS - 允许管理员登记他人工时(0 - 不允许, 1 - 允许)
   * 
   */
  return post('config/updateProjectNumeralConfig', data)
}


// 获取用户级别配置
export function getUserNumeralConfig(data) {
  // type type类型说明, 后面为类型说明于类型值说明
  /**
   * ONLY_CALCULATE_WORKING_DAYS - 仅计算工作日(0 - 不允许, 1 - 允许)
   * 
   */
  return get('config/getUserConfig', data)
}

// 变更用户级别配置
export function postUserNumeralConfig(data) {
  // value
  // id
  // type type类型说明, 后面为类型说明于类型值说明
  /**
   * ONLY_CALCULATE_WORKING_DAYS - 仅计算工作日(0 - 不允许, 1 - 允许)
   * 
   */
  return post('config/updateUserNumeralConfig', data)
}

// 根据type获取度量开启信息以及度量项目名称信息
export function getMeasureProjectConfig(data) {
  // type type类型说明, 后面为类型说明于类型值说明
  /**
   * ALLOW_MEASUREMENT
   * 
   */
  return get('measurement/getMeasureProjectConfig', data)
}

// 获取绑定项目和度量项目下拉列表
export function getUnlockedWorkItemInfo(data) {
  return get('measurement/getUnlockedWorkItemInfo', data)
}

// 判断承载度量的工时统计工作项是不是为空
export function getCheckIsEmptyWorkItem(data) {
  // measureWorkItemId
  return get('measurement/checkIsEmptyWorkItem', data)
}

// 绑定项目和度量项目
export function postBindMeasurementProject(data) {
  // workItemId
  // measureWorkItemId
  // measureWorkItemName
  // confirmUpdate
  return post('measurement/bindMeasurementProject', data)
}

// 获取已绑定的项目和度量项目
export function getMeasureEditParam(data) {
  // type "ALLOW_MEASUREMENT"
  return get('measurement/getMeasureEditParam', data)
}

// 获取【插件设置】工时审批文案信息
export function getApproveConfig() {
  return get('approve/getApproveConfig')
}

// 获取已设置的工时审批
export function getApproveEditParam() {
  return get('approve/getApproveEditParam')
}

// 设置的工时审批
export function postApproveEdit(data) {
  // id
  // type（ALLOW_APPROVE:开启审批）
  // value（1：开启；0：关闭）
  // approvalList: [
  //   {
  //     id,
  //     approvalStageName,
  //     processingUserIds,
  //     approvalRule,
  //     teamIds
  //   }
  // ]
  return post('approve/approveEdit', data)
}

// 查询团队列表
export function getTeam(data) {
  // teamName
  // 自动注入 projectKey：优先使用调用方传入；否则取当前空间的 projectKey
  const projectKey =
    (data && data.projectKey) ||
    sessionStorage.getItem('adminCurrentProjectKey') ||
    sessionStorage.getItem('jwtMeegoTeamworkProjectKey') ||
    ''
  return get('team/list', { ...(data || {}), projectKey })
}

// 刷新团队成员
export function getRefreshTeam(data) {
  // projectKey
  return get('team/refresh', data)
}

// 分页查询空间成员接口
export function getSelectProjectUserList(data) {
  // pageNum
  // pageSize
  // userName
  return get('projectUser/selectProjectUserList', data)
}

// 同步空间成员(已废弃)
export function postSysProjectUser(data) {
  // userKey
  return post('projectUser/sysProjectUser', data)
}

// 实例下所有人工时统计
export function getWorkHourStatistics(data) {
  // workItemId
  // workItemEntityId
  // nodeId
  // taskId
  // flowType
  // projectKey
  return get('hour/statistics/node/all/user', data)
}

/** 公告管理 */

// 获取滚动公告
export function getRollingAnnouncement() {
  return get('/api/isv/getRollingAnnouncement')
}

// 关闭滚动公告
export function getCloseRollingAnnouncement(id) {
  return get(`/api/isv/confirmRollingAnnouncement/${id}`)
}

// 获取全屏弹框公告
export function getFullScreenAnnouncement() {
  return get('/api/isv/getFullScreenAnnouncement')
}

// 确认全屏弹框公告
export function getConfirmFullScreenAnnouncement(id) {
  return get(`/api/isv/confirmFullScreenAnnouncement/${id}`)
}

/** 客户留资 */

// 校验用户是否已经登记留资信息
export function getJudgeHasRecord() {
  return get('/api/isv/judgeHasRecord')
}

// 新增留资客户信息
export function postAddRetainPropertyInfo(data) {
  // linkman
  // linkmanPhone
  // companyName
  // position
  // code
  return post('/api/isv/addRetainPropertyInfo', data)
}

// 发送验证码短信
export function getSendSms(data) {
  return get('sms/sendSms', data)
}

// 验证验证码是否正确
export function getVerifySms(data) {
  return get('sms/checkCode', data)
}

/** 资源管理 */

// 获取用户自定义展示字段
export function getUserCustomField(data) {
  // type
  /** 
   * WORKING_HOURS_RESOURCES_GANTT_CHART - 工时资源甘特图自定义字段配置
   */
  return get('config/getUserCustomField', data)
}

// 编辑用户自定义展示字段
export function postUserCustomField(data) {
  // [{
  //   id,
  //   configType,
  //   configKey,
  //   sort,
  //   checked,
  // }]
  return post('config/updateUserCustomField', data)
}

// 查询工作甘特图
export function postWorkGanttChart(data) {
  // userIdList
  // statisticType
  // startDate
  // endDate
  // isSynchronous
  // queryUserId
  return post('resourceManagement/queryWorkGanttChart', data)
}

// 查询工作甘特图_V2.3版本以后使用
export function postWorkGanttChartNew(data) {
  // userIdList
  // statisticType
  // startDate
  // endDate
  // isSynchronous
  // queryUserId
  return post('resourceManagement/queryWorkGanttChartNew', data)
}

// 查询当前用户代填的用户信息
export function getRegistrantUser(data) {
  // startDate
  // endDate
  return post('resourceManagement/getRegistrantUser', data)
}

// 查询当前空间当前用户资源管理选择的条件
export function getResourceCondition() {
  return get('resourceManagement/queryResourceCondition')
}
/** 工时日志 */

// 获取导出工时日志的uuid
export function postExportNodeWorkHour(data) {
  /// workItemId
  // workItemEntityId
  // nodeId
  // startDate
  // endDate
  // isSynchronous
  // statisticType
  // userIdList
  return post('log/export', data)
}

// 轮询获取导出工时日志url
export function getExportNodeWorkHourResult(data) {
  /// uuid
  return get('log/exportNodeWorkHourResult', data)
}

// 查询工时登记
export function postQueryNodeWorkHour(data) {
  // workItemId
  // workItemEntityId
  // nodeId
  // startDate
  // endDate
  // pageNo
  // pageSize
  // isSynchronous
  // statisticType
  // userIdList
  return post('workHour/queryNodeWorkHour', data)
}

// 查询工时日志列表（新） POST /log/queryNodeWorkHour
export function postLogQueryNodeWorkHour(data) {
  // projectKey
  // workItemId
  // workItemEntityId
  // nodeId
  // taskId
  // startDate
  // endDate
  // pageNum
  // pageSize
  // approvalNo
  return post('log/queryNodeWorkHour', data)
}

// 删除工时记录（新） POST /isv/admin/delLog
export function postIsvAdminDelLog(data) {
  // id
  return del(`log/deletedById/${data.id}/${data.projectKey}`)
}

// 批量删除工时日志 POST log/deleteNodeWorkHourBatch
// 入参：{ items: [ { projectKey, ids: [id...] }, ... ] }（按 projectKey 分组，支持多空间/多对象）
export function postLogDeleteNodeWorkHourBatch(data) {
  return post('log/deleteNodeWorkHourBatch', data)
}

// 查询工时登记 节点总和
export function postQueryNodeWorkHourSum(data) {
  // workItemId
  // workItemEntityId
  // nodeId
  // taskId
  // id
  // taskHourId
  // userKey
  return post('workHour/queryNodeWorkHourSum', data)
}

// 查询工时登记 节点下个人工时统计
export function postQueryNodeWorkHourSumByUser(data) {
  // workItemId
  // workItemEntityId
  // nodeId
  // taskId
  // registrantUseKey
  // flowType
  return get('hour/statistics/node/person', data)
}

// 个人工作饱和度提示框
export function getWorkSaturationTips(data) {
  // workDate
  // registrantUseKey
  return get('hour/statistics/saturation/person', data)
}

// 查询工时登记 查看明细
export function postQueryNodeWorkHourDetail(data) {
  // workItemId
  // workItemEntityId
  // nodeId
  // userKey
  return post('workHour/queryNodeWorkHourDetail', data)
}

// 新增工时登记
export function postInsertNodeWorkHour(data) {
  // projectKey
  // workItemId
  // workItemEntityId
  // nodeId
  // actWorkHour
  // workDesc
  // workDate
  return post('api/register/insertNodeWorkHour', data)
}

// 更新工时登记
export function postUpdateNodeWorkHour(data) {
  // id
  // workItemId
  // workItemEntityId
  // nodeId
  // actWorkHour
  // workDesc
  // workDate
  return post('workHour/updateNodeWorkHour', data)
}

// 删除工时登记
export function postDeleteNodeWorkHour(data) {
  // id
  return post('workHour/deleteNodeWorkHour', data)
}

// 批量新增工时登记
export function postBatchInsertNodeWorkHour(data) {
  return post('work/hour/v2/registration/batch', data)
}

// 批量新增工时登记(新版)
export function postBatchInsertNodeWorkHourNew(data) {
  return post('work/hour/v2/registration/batch/date', data)
}

// 再次发起汇总审批(新版) 
export function postBatchApprovalAgain(data) {
  return post('collect/approval/handle/batch/again', data)
}

// 批量登记-配置表格展示排序获取
export function getBatchRegTableSortConfig() {
  return get('user/config/registration/head')
}

// 批量登记-配置表格展示排序配置
export function postBatchRegTableSortConfig(data) {
  return post('user/config/registration/head', data)
}

// 分页查询工作实例
export function getWorkInstance(data) {
  // pageNum
  // pageSize
  // startTime
  // endTime
  // workTime
  return get('entityInstance/selectWorkInstanceAndNodeAndTaskByProjectKey', data)
}

// 根据工作项和工作实例id获取节点和任务信息
export function getWorkInstanceDetail(data) {
  // workItemKey
  // entityId
  return get('entityInstance/getEntityNodeOptionAndNodeSchedule', data)
}

// 分页查询工作节点以及节点下的任务
export function getNodeInstanceAndTask(data) {
  // pageNum
  // pageSize
  // startTime
  // endTime
  // workTime
  // workItemId
  // workItemEntityId
  return get('entityInstance/selectNodeInstanceAndTask', data)
}

// 查询工作节点登记工时明细
export function getNodeUserList(data) {
  // pageNum
  // pageSize
  // startTime
  // endTime
  // workItemId
  // workItemEntityId
  // nodeId
  // userId
  return get('entityInstance/selectNodeUserList', data)
}

// 获取审批详情
export function getApproveDetailList(data) {
  // id
  return get(`/approve/log/info/${data.id}`)
}

// 获取汇总审批详情
// 响应新增：approvalType(1:自研审批 2:飞书审批)、instanceCode(飞书审批跳转 URL)
export function getCollectApproveDetailList(data) {
  // id
  return get(`collect/approval/detail/${data.id}`)
}

/** 工时管理 */

// 查询空间所有成员（管理员权限）
export function getProjectAllStaff(data) {
  return get('admin/getProjectAllStaff', data)
}

// 部门统计-获取以往查询条件
export function getLastStatCondition(data) {
  // flag
  return get('admin/getLastStatCondition', data)
}

// isv-资源管理/工时管理/工时日志-查询设置数据（统一接口）
// locationType: 0 资源管理 1 工时管理 2 工时日志
export function getStatConditionDetail(data) {
  return get('api/statcondition/detail', data)
}

// 部门统计-工作项登记工时
export function postAdminQueryEntityStat(data) {
  // userId
  // startDate
  // endDate
  return post('admin/queryEntityStat', data)
}

// 导出-部门统计-工作项登记工时
export function postAdminExportEntityStat(data) {
  // userId
  // startDate
  // endDate
  return post('admin/exportEntityStat', data)
}

// 部门统计-成员登记工时
export function postAdminQueryStaffStat(data) {
  // userId
  // startDate
  // endDate
  // rangeType
  return post('admin/queryStaffStat', data)
}

// 导出-部门统计-成员登记工时
export function postAdminExportStaffStat(data) {
  // userId
  // startDate
  // endDate
  // rangeType
  return post('admin/exportStaffStat', data)
}

// 个人统计-实际工时统计
export function postWorkHourQuerySelfStat(data) {
  // startDate
  // endDate
  // rangeType
  return post('workHour/querySelfStat', data)
}

// 导出-个人统计-实际工时统计
export function postWorkHourExportSelfStat(data) {
  // startDate
  // endDate
  // rangeType
  return post('workHour/exportSelfStat', data)
}

/** 插件设置 */

// 查询组织标准工时
export function getStandWorkHour() {
  return get('workHour/getStandWorkHour')
}

// 更新组织标准工时
export function postUpdateStandWorkHour(data) {
  // standWorkHour
  // dayUp
  // onceDown
  return post('workHour/updateStandWorkHour', data)
}

// 查询当前空间管理员
export function getProjectAdminList(data) {
  return get('admin/getProjectAdmin', data)
}

// 查询当前空间普通成员
export function getProjectMemberList(data) {
  return get('user/getProjectSimpleStaff', data)
}

// 设置空间管理员
export function postSetProjectAdmin(data) {
  // userId[]
  return post('admin/setProjectAdmin', data)
}

// 设置当前空间普通成员
export function postSetProjectMember(data) {
  // userId[]
  return post('admin/setProjectSimpleStaff', data)
}

/** 批量填报Table接口汇总 */

// 批量登记-查询登记对象
export function postQueryBatch(data) {
  // workItemId
  // workItemEntityId
  // scheduleStartDate
  // scheduleEndDate
  // personInCharge
  // pageSize
  // pageNum
  return post('work/hour/v2/query/batch', data)
}

// 分页查询工作实例
export function getSelectWorkInstance(data) {
  // pageNum
  // pageSize
  // startTime
  // endTime
  // workItemEntityId
  // workItemId
  // registrantUseKey
  return get('entityInstance/new/selectWorkInstance', data)
}

// 查询工作实例实例下的节点
export function getEntityNode(data) {
  // workItemEntityId
  // workItemId
  // workTime
  // startTime
  // endTime
  return get('entityInstance/new/getEntityNode', data)
}

// 查询工作实例实例下的节点的任务
export function getEntityNodeSchedule(data) {
  // workItemEntityId
  // workItemId
  // nodeId
  // workTime
  // startTime
  // endTime
  return get('entityInstance/new/getEntityNodeSchedule', data)
}

// 获取工指定实例下的节点和任务
export function postEntityNodeTask(data) {
  // workItemEntityId
  // workItemId
  // registerUserKey
  // personInCharge
  // scheduleStart
  // scheduleEnd
  return post('work/hour/v2/query/node', data)
}

// 查询指定实例下节点的任务
export function postEntityNodeTaskSchedule(data) {
  // workItemEntityId
  // workItemId
  // nodeId
  return post('work/hour/v2/query/task', data)
}

/** 工作节点Cascader接口汇总 */

// 获取选项：空间列表（空间 → 工作项 → 工作项实例 → 节点 → 任务 级联首层）
export function getSpaceOptionNew(params) {
  return get('/project/list')
}

/** ===================== 级联组件 SpaceCascader 专用（4 个 /level 接口） ===================== */

// 查询全部空间
export function getProjectList() {
  return get('project/list')
}

// 根据 projectKey 查工作项
export function getLevelWorkItemOption(params) {
  // params: { projectKey }
  // 自动注入 projectKey：优先使用调用方传入；否则取当前空间的 projectKey
  const projectKey =
    (params && params.projectKey) ||
    sessionStorage.getItem('adminCurrentProjectKey') ||
    sessionStorage.getItem('jwtMeegoTeamworkProjectKey') ||
    ''
  return get('level/getWorkItemOption', { ...(params || {}), projectKey })
}

// 根据 projectKey + workItemId 查工作项实例
export function getLevelItemEntityOption(params) {
  // params: { projectKey, workItemId, pageNum?, pageSize? }
  return get('level/getItemEntityOption', params)
}

// 根据 projectKey + workItemId + workItemEntityId 查节点及任务
export function getLevelNodeAndTaskOption(params) {
  // params: { projectKey, workItemId, workItemEntityId, pageNum }
  return get('level/getNodeAndTaskOption', params)
}

// 获取选项：工作项
export function getWorkItemOptionNew(params) {
  // 自动注入 projectKey：优先使用调用方传入；否则取当前空间的 projectKey
  const projectKey =
    (params && params.projectKey) ||
    sessionStorage.getItem('adminCurrentProjectKey') ||
    sessionStorage.getItem('jwtMeegoTeamworkProjectKey') ||
    ''
  return get('level/getWorkItemOption', { ...(params || {}), projectKey })
}

// 获取选项：工作项实例(备注分页)
export function getItemEntityOptionNew(data) {
  // workItemId
  // pageNum
  // pageSize
  // workItemEntityName
  return get('entityInstance/new/getItemEntityOption', data)
}

export function postItemEntityOptionNew(data) {
  // workItemIds
  // pageNum
  // pageSize
  // workItemEntityName
  return post('entityInstance/new/getItemEntityOption', data)
}

// 获取选项：工作项实例节点
export function getEntityNodeOptionNew(data) {
  // workItemId
  // workItemEntityId
  return get('entityInstance/new/getEntityNodeOption', data)
}

// 单项登记 - 获取预估工时
// 接口地址：GET /api/register/statistics/node/person
// 仅在"单项登记弹窗"内的级联选择器选中后调用，其他级联组件不复用
// 入参（query 字符串）：
//   - workItemId        工作项 ID
//   - workItemEntityId  工作项实例 ID
//   - nodeId            节点 ID
//   - taskId            任务 ID（可选）
//   - registrantUseKey  登记人标识（必填）
//   - projectKey        空间标识（必填，备注要带上空间 key）
//   - workDate          工作日期 yyyy-MM-dd（必填）
export function getNodePersonStatistics(data) {
  return get('api/register/statistics/node/person', data)
}

// 单项登记 - 个人工作饱和度提示
// 接口地址：GET /api/register/statistics/saturation/person
// 入参（query 字符串）：
//   - workDate          工作日期 yyyy-MM-dd（必填）
//   - registrantUseKey  登记人标识（必填）
//   - projectKey        空间标识（必填）
export function getRegisterPersonSaturation(data) {
  return get('api/register/statistics/saturation/person', data)
}

// 获取选项：工作项实例节点下的任务
export function getEntityTaskOptionNew(data) {
  // workItemId
  // workItemEntityId
  // nodeId
  return get('entityInstance/new/getEntityTaskOption', data)
}

/**  
 * 工时审批
 */

// 获取是否存在“待审批”提示
export function getHasApprove() {
  return get('approve/hasApprove')
}

// 获取全部审批、我的工时、我审批的的数据值
export function getApproveCount() {
  return get('approve/getApproveCount')
}

// 获取工时审批表单数据-全部审批(单项)
export function postApproveAllList(data) {
  // staffIds
  // approvalNo
  // startTime
  // endTime
  // approvalStatus
  // workItemId
  // workItemEntityId
  // nodeId
  // taskId
  // pageSize
  // pageNum
  return post('approve/list/all', data)
}

// 获取工时审批表单数据-我发起的(单项)
export function postApproveSelfInitiatedList(data) {
  // staffIds
  // approvalNo
  // startTime
  // endTime
  // approvalStatus
  // workItemId
  // workItemEntityId
  // nodeId
  // taskId
  // pageSize
  // pageNum
  return post('approve/list/self/initiated', data)
}

// 获取工时审批表单数据-我的待办(单项)
// 待办固定查「待审批」：approvalStatus = 1
export function postApproveSelfTodoList(data) {
  // staffIds
  // approvalNo
  // startTime
  // endTime
  // approvalStatus
  // workItemId
  // workItemEntityId
  // nodeId
  // taskId
  // pageSize
  // pageNum
  return post('approve/list/self/todo', data)
}

// 获取工时审批表单数据-我的已办(单项)
// 已办-全部：不传状态；已办-已通过/已拒绝：approvalStatus = 2 / 3
export function postApproveSelfDoneList(data) {
  // staffIds
  // approvalNo
  // startTime
  // endTime
  // approvalStatus
  // workItemId
  // workItemEntityId
  // nodeId
  // taskId
  // pageSize
  // pageNum
  return post('approve/list/self/done', data)
}

// 获取工时审批表单数据-全部审批(批量)
export function postBatchApproveAllList(data) {
  // staffIds
  // approvalNo
  // startTime
  // endTime
  // approvalStatus
  // workItemId
  // workItemEntityId
  // nodeId
  // taskId
  // pageSize
  // pageNum
  return post('collect/approval/list/all', data)
}

// 获取工时审批表单数据-我发起的(批量)
export function postBatchApproveSelfInitiatedList(data) {
  // staffIds
  // approvalNo
  // startTime
  // endTime
  // approvalStatus
  // workItemId
  // workItemEntityId
  // nodeId
  // taskId
  // pageSize
  // pageNum
  return post('collect/approval/list/self/initiated', data)
}

// 获取工时审批表单数据-我的待办(批量)
// 待办固定查「待审批」：status = 1
export function postBatchApproveSelfTodoList(data) {
  // staffIds
  // approvalNo
  // startTime
  // endTime
  // approvalStatus
  // workItemId
  // workItemEntityId
  // nodeId
  // taskId
  // pageSize
  // pageNum
  return post('collect/approval/list/self/todo', data)
}

// 获取工时审批表单数据-我的已办(批量)
// 已办-全部：不传状态；已办-已通过/已拒绝：status = 2 / 3
export function postBatchApproveSelfDoneList(data) {
  // staffIds
  // approvalNo
  // startTime
  // endTime
  // approvalStatus
  // workItemId
  // workItemEntityId
  // nodeId
  // taskId
  // pageSize
  // pageNum
  return post('collect/approval/list/self/done', data)
}

// 获取批量审批的下拉数据
export function postBatchApproveSelectData(data) {
  return get(`collect/approval/getDetail/${data.id}`)
}

// 汇总审批-批量操作
export function postBatchApprove(data) {
  // approvalCollects:{
  //   collectId 汇总审批的id
  //   approvalIds 单项审批id
  // }
  // reason
  // type (pass:通过  refuse:拒绝 cancel:撤回    again_launch:再次发起)
  return post('collect/approval/handle/batch', data)
}

// 单项审批-页面数量
// tabType: 1=全部审批 2=我发起的 4=待办 5=已办（见 approvalMenuConfig.TAB_TYPE_MAP）
// tabType=5(已办) 时额外返回 doneApproveNum，并复用 passApproveNum / refuseApproveNum
export function postSinglePageCount(data) {
  // tabType
  return post(`approve/total/num`, data)
}

// 汇总审批-页面数量
// tabType: 1=全部审批 2=我发起的 4=待办 5=已办（见 approvalMenuConfig.TAB_TYPE_MAP）
// tabType=5(已办) 时额外返回 doneApproveNum，并复用 passApproveNum / refuseApproveNum
export function postBatchPageCount(data) {
  // tabType
  return post(`collect/approval/total/num`, data)
}

// 获取跳转工作项实例及节点的链接
export function getWorkItemUrl(data) {
  // workItemId
  // workItemEntityId
  // nodeId
  return get('approve/work/url', data)
}

// 批量审批/批量拒绝
export function postBatchApproveHandle(data) {
  // ids
  // reason
  // type (pass:通过  refuse:拒绝)
  return post('approve/batchHandle', data)
}

// 处理审批/拒绝/撤回/删除的接口
export function postApproveHandle(data) {
  // id
  // reason
  // type (pass:通过  refuse:拒绝 cancel：撤销 delete：删除 again_launch:再次发起)
  // actWorkHour
  // workDate
  // workDesc
  return post('approve/handle', data)
}

// 获取审批详情
// 响应新增：approvalType(1:自研审批 2:飞书审批)、instanceCode(飞书审批跳转 URL)
export function getApproveInfo(data) {
  // id
  return get(`approve/info/${data?.id}`)
}

// 获取审批明细
export function getApprovalLog(data) {
  // id
  return get(`approve/log/${data?.id}`)
}

//查询甘特图_V2.4版本的数据
export function postWorkGanttChartNewV2(data) {
  // userIdList
  // statisticType
  // startDate
  // endDate
  // isSynchronous
  // queryUserId
  return post('resourceManagementV2/queryWorkGanttChartV2', data)
}


// //查询V2.4版本甘特图左边树结构点击工作项实例节点获取下级全部节点的数据
export function queryWorkItemEntityNodeAndTaskV2(data) {
  return post('resourceManagementV2/queryWorkItemEntityNodeAndTaskV2', data)
}
//查询V2.7.0版本资源管理-成员工时汇总
export function postWorkHoursTotalDetail(data) {
  return post('resourceManagement/user/workHours/total', data)
}

/** 方案中心 */

// 是否显示【领取 7 天免费权益】按钮
export function getHasFree() {
  return get(`plan/tenant/has/free`)
}

// 领取 7 天免费权益
export function getReceiveSevenDaysFree() {
  return get(`plan/tenant/receive/seven/days/free`)
}

// 获取当前租户启用的套餐
export function getTenantPlan() {
  return get(`plan/tenant/plan`)
}

// 获取购买记录
export function getPurchaseRecord() {
  return get(`plan/order/list/self`)
}

// 获取套餐权益列表
export function getPlanBenefitList() {
  return get(`plan/list`)
}
// 获取联系客服url
export function getFsChatUrl(){
  return get(`/api/isv/chat/url`)
}
// 获取套餐立即缴费设置uuid
export function setJumpPayUuid(data){
  return post('config/in/the/plan',data)
}
export function getPayJumpInfo(data){
  return get(`config/in/the/plan/${data?.uuid}`)
}
//获取审批设置
export function getApprovalSettings(data){
  return get(`approval/config/info`, data)
}
//获取审批设置
export function getWorkitemRole(data){
  return get(`approval/config/workitem/roles`, data)
}
// 保存审批设置
export function postApprovalConfigInfo(data){
  return post('approval/config/info',data)
}
// 获取飞书审批规则列表
export function getFeishuApprovalRuleList(data){
  return get('approval/feishu/rule/list', data)
}
// 获取飞书审批规则详情（编辑弹窗回显）
export function getFeishuApprovalRuleDetail(id){
  return get(`approval/feishu/rule/${id}`)
}
// 飞书审批规则保存前 / 打开弹窗前校验（替代旧 approval/feishu/template/check）
// 非 200 返回 {code, msg} 由全局请求层弹提示；全部通过返回 200、data=null
export function postFeishuCheckTemplate(data){
  return post('approval/feishu/checkTemplate', data)
}
// 拉取飞书审批模板控件列表
export function getFeishuTemplateFields(data){
  return get('approval/feishu/template/fields', data)
}
// 飞书审批字段映射来源选项
export function getFeishuMappingSources(data){
  return get('approval/feishu/mapping/sources', data)
}
// 飞书审批规则-工作项类型列表（含是否已被规则占用 → 置灰）
export function getFeishuWorkItemTypes(data){
  return get('approval/config/getWorkItemTypes', data)
}
// 保存审批配置（飞书审批）
export function postApprovalConfigSave(data){
  return post('approval/config/save', data)
}
// 保存登记设置
export function saveRegistrationSettings(data){
  return post('config/saveRegistrationSettings',data)
}
// 获取登记设置
export function getRegistrationSettings(data){
  return get('config/getRegistrationSettings', data)
}
// 飞书项目-登记设置-删除特殊节点流配置
export function deleteSpecialNodeFlowConfig(data) {
  return del(`config/deletedById/${data.id}`)
}
//登记查询登记工作项类型
export function getWorkItemOptionForRegister(params){
   return get('entityInstance/new/getWorkItemOptionForRegister', params)  
}

// 查询团队下的用户列表
export function queryTeamUserList(data){
  return get('team/queryTeamList',data)
}
//获取登记缓存
export function getRegisterCache(data){
   return get(`work/hour/v2/register/cache?point=${data?.type}`)  
}
//保存缓存
export function saveRegisterCache(data){
   return post(`work/hour/v2/register/cache`,data)  
}
//缓存
export function clearRegisterCache(data){
   return post(`work/hour/v2/clear/register/cache?point=${data?.point}`)  
}

// 查询登记工作项实例类型
export function getItemEntityOptions(params){
   return get('entityInstance/new/getItemEntityOption', params)  
}
//批量登记对象查询节点
export function queryExpandLevelNode(data){
   return post('/work/hour/v2/query/node/batch',data)  
}
//查询甘特图_V3.4版本的数据
export function postWorkGanttChartNewV3(data) {
  // userIdList
  // statisticType
  // startDate
  // endDate
  // isSynchronous
  // queryUserId
  return post('resourceManagementV3/queryWorkGanttChartV3', data)
}
//甘特图查询层级（已屏蔽）
export function queryGanttLevel(data){
  // return get('level/query',data)
  return Promise.resolve({ result: true, data: {} })
}
//甘特图保存查询层级
export function saveGanttLevel(data){
   return post('level/save',data)  
}
//配置席位获取人员
export function querySeatAllUser(data){
  let url='seat/getSeat'
  if(data?.teamName)
  {url+=`?teamName=${data.teamName}`}
  return get(url)  
}
//配置席位获取团队/人员
export function querySeatAllTeam(data){
   return get('seat/team/all',data)  
}
//获取租户的席位数
export function saveSeat(data){
   return post('seat/save',data)  
}
//当前用户是否有使用权限
export function querySeatUserPermission(){
   return get('seat/check/self')  
}
//查询区间日期的登记工时情况
export function queryWorkHoursTotalDetail(data) {
  return post('hour/statistics/saturation/person/batch', data)
}
//是否需要展示团队配置（ISV 租户模式）
export function queryNeedShowTeamConfig(){
   return get('isv/data/auth/show/team/configuration')  
}
//获取数据权限配置
export function getDataAuthConfig(data){
   return get('data/auth/getConfig', data)
}
//ISV租户模式-获取数据权限配置
export function getIsvDataAuthConfig(data){
   return get('isv/data/auth/getConfig', data)
}
//权限设置-搜索用户可查询的用户
export function searchAuthUser(data){
   return post('noAuth/queryUserList',data)  
}
//保存数据权限配置
export function saveDataAuthConfig(data){
   return post('data/auth/saveConfig',data)  
}
//ISV租户模式-保存数据权限配置
export function saveIsvDataAuthConfig(data){
   return post('isv/data/auth/saveConfig',data)  
}
//查询配置数量
export function queryDataAuthConfigCount(data){
   return get('data/auth/getCount', data)  
}
//ISV租户模式-查询数据权限配置数量
export function queryIsvDataAuthConfigCount(data){
   return get('isv/data/auth/getCount', data)  
}
//权限设置-查询全部人员
export function queryAuthAllUser(data){
   return get('data/auth/getAllUser', data)  
}
//ISV租户模式-搜索人员
export function searchIsvUser(data){
   return get('api/user/search', data)  
}
//权限设置-查询团队
export function queryAuthTeamList(data){
   return get('data/auth/getTeamList',data)  
}
//ISV租户模式-搜索团队
export function searchIsvTeam(data){
   return get('api/team/search', data)  
}
//ISV租户模式-获取组织架构树
export function getIsvOrgTree(){
   return get('org/tree')  
}
//获取可登记的层级映射（已屏蔽）
export function getRegisterableLevelMap(data){
  return get('register/level/query',data)
  //return Promise.resolve({ result: true, data: {} })
}

// 单项登记 - 查询可登记的空间
export function getRegisterProjectKeyOption(data) {
  return get('api/register/getProjectKeyOption',data)
}

// 单项登记 - 查询可登记的工作项
export function getRegisterWorkItemOption(data) {
  // projectKey
  return get('api/register/getWorkItemOption', data)
}

// 单项登记 - 查询可登记的工作项下的实例
export function getRegisterItemEntityOption(data) {
  // projectKey, workItemId
  return get('api/register/getItemEntityOption', data)
}

// 单项登记 - 查询可登记的工作项下的实例的节点任务
export function getRegisterEntityNodeOption(data) {
  // projectKey, workItemId, workItemEntityId
  return get('api/register/getEntityNodeOption', data)
}

// 单项登记 - 登记工时明细列表
export function getQueryNodeWorkHourDetail(data) {
  // workItemId, workItemEntityId, nodeId, taskId, projectKey
  return post('api/register/queryNodeWorkHourDetail', data)
}

//获取工时提醒配置
export function getWorkHourReminderConfig(data){
   return get('config/getWorkHourRemind', { isInner: true, ...data }) 
}
//设置工时提醒配置
export function setWorkHourReminderConfig(data){
   return post('config/setWorkHourRemind', data) 
}
//记录规范-获取外部配置
export function getStandardsConfig(data){
   return get('standards/getConfig/out', data) 
}
//记录规范-获取内部配置
export function getStandardsConfigDetail(data){
   // 业务约定：需带 isDefault，由调用方从 getConfig/out 列表项的 isDefault 字段透传
   return get('standards/getConfig/inner', data)
}
//记录规范-保存记录配置
export function saveStandardsConfig(data){
   return post('standards/saveConfig',data) 
}
//记录规范-获取节假日配置
export function getStandardsConfigHoliday(data){
   return get('standards/getConfig/holiday', data) 
}
//记录规范-查询国家的节假日
export function queryCountryHoliday(data){
   return get('standards/getHolidayByCountryCode',data) 
}
//记录规范-重置国家节假日
export function resetStandardsConfigHoliday(data){
   return get('standards/reset',data) 
}
//记录规范-同步未来日历
export function syncFutureCalendar(data){
   return get('standards/syncFutureCalendar',data) 
}
//记录规范-删除记录规范
export function deleteStandardsConfig(data){
   return del(`standards/deletedById/${data.id}`) 
}
//记录规范-成员标准工时
export function getUserStandWorkHour(data){
  // 自动注入 projectKey：优先使用调用方传入；否则取当前空间的 projectKey
  const projectKey =(data && data.projectKey) ||
    ''
  return get(`config/standWorkHour/user`, { ...(data || {}), projectKey })
}

//记录规范-操作日期
export function operationTimeSave(data){
   return post(`standards/uuid/save`,data) 
}
//记录规范
export function standardsClearByUuid(data){
   return post(`standards/clearByUuid`,data) 
}

// ============================================================
// 【ISV 模式】记录规范设置相关接口
// 在老接口基础上 URL 前增加一层 isv/，与上方老接口并存独立使用。
// 调用方在 ISV 模式下使用 *Isv 版本，非 ISV 模式继续使用原函数。
// ============================================================

// 记录规范-获取外部配置（ISV）
export function getStandardsConfigIsv() {
  return get('isv/standards/getConfig/out')
}
// 记录规范-获取内部配置（ISV）
export function getStandardsConfigDetailIsv(data) {
  // 业务约定：需带 isDefault，由调用方从 isv/getConfig/out 列表项的 isDefault 字段透传
  return get('isv/standards/getConfig/inner', data)
}
// 记录规范-保存记录配置（ISV）
export function saveStandardsConfigIsv(data) {
  return post('isv/standards/saveConfig', data)
}
// 记录规范-获取节假日配置（ISV）
export function getStandardsConfigHolidayIsv(data) {
  return get('isv/standards/getConfig/holiday', data)
}
// 记录规范-查询国家的节假日（ISV）
export function queryCountryHolidayIsv(data) {
  return get('isv/standards/getHolidayByCountryCode', data)
}
// 记录规范-重置国家节假日（ISV）
export function resetStandardsConfigHolidayIsv(data) {
  return get('isv/standards/reset', data)
}
// 记录规范-同步未来日历（ISV）
export function syncFutureCalendarIsv(data) {
  return get('isv/standards/syncFutureCalendar', data)
}
// 记录规范-删除记录规范（ISV）
export function deleteStandardsConfigIsv(data) {
  return del(`isv/standards/deletedById/${data.id}`)
}
// 记录规范-成员标准工时（ISV）
export function getUserStandWorkHourIsv(data) {
  return get(`isv/workHour/standWorkHour/user`, data)
}
// 记录规范-操作日期（ISV）
export function operationTimeSaveIsv(data) {
  return post(`isv/standards/uuid/save`, data)
}
// 记录规范-清理（ISV）
export function standardsClearByUuidIsv(data) {
  return post(`isv/standards/clearByUuid`, data)
}

//isv-新接口
// 获取飞书的token
export function feishuApiAuth(data) {
  return post('notAuth/token/access', data)
}

// 获取飞书请求code试需要添加的scope
export function getFeishuConfigInfo(data) {
  return get('notAuth/web/token/access', data)
}
// 获取飞书项目的token
export function getAuthToken(data) {
  // authorizationCode
  return get('notAuth/token/refresh')
}
//工时管理-导出工作项实例登记工时
export function exportWorkHoursTotalDetail(data){
   return post('admin/exportEntityStat',data)  
}
//工时管理-导出成员登记工时
export function exportMemberWorkHoursTotalDetail(data){
   return post('/admin/exportStaffStat',data)  
}
//资源管理-查询成员和空间信息
export function queryMemberAndSpaceInfo(data){
   return post('resourceManagement/queryWorkGanttChart',data)  
}
//资源管理-查询空间下的工作项和工作项实例
export function queryWorkItemAndWorkItemEntity(data){
   return post('resourceManagement/queryWorkItemAndWorkItemEntity',data)  
}
//资源管理-查询某个空间的工作项下的节点和任务
export function queryWorkItemEntityNodeAndTask(data){
   return post('resourceManagement/queryWorkItemEntityNodeAndTask',data)  
}
// 查询工时详情
export function postWorkingHoursDetails(data) {
  return post('resourceManagement/queryWorkingHoursDetails', data)
}

// ===================== 模式设置 =====================

// 设置管理模式（tenant-租户模式 / space-空间模式）
export function postChangeMode(data) {
  return post('api/tenant/mode/change', data)
}

// 标记引导页已展示
export function postGuideDisplayed() {
  return post('/api/user/guide/displayed', {})
}

// 获取租户已安装空间列表
export function getInstallList() {
  return get('api/tenant/projects/install/list')
}

// 获取用户已安装空间列表
export function getAdminList() {
  return get('/api/tenant/projects/admin/list')
}

//获取已安装插件的项目空间列表
export function getInstalledProjectList() {
  return get('api/tenant/projects/install/list')
}

// ===================== 自定义字段设置（租户级配置） =====================

// 保存自定义字段配置
// data: { fieldName, isEnabled, spaceConfigs: [{ projectKey, workItemMappings }] }
export function postSaveCustomFieldConfig(data) {
  return post('api/customField/saveConfig', data)
}

// 查询自定义字段配置
export function getCustomFieldConfig(data) {
  return get('api/customField/getConfig', data)
}

// 获取已安装 ISV 的可选空间
export function getCustomFieldAvailableSpaces(data) {
  return get('api/customField/getAvailableSpaces', data)
}

// 获取空间下的工作项类型
// data: { projectKey }
export function getCustomFieldWorkItemTypes(data) {
  return get('level/getWorkItemOption', data)
}

// 获取工作项下可作为取值来源的飞书字段
// data: { projectKey, workItemTypeKey }
export function getCustomFieldWorkItemFields(data) {
  return get('api/customField/getAvailableFields', data)
}

// 查询单个工作项实例的自定义字段值
// data: { entityId }
export function getCustomFieldValue(data) {
  return get('api/customField/getFieldValue', data)
}
//自定义字段配置接口
export function getCommonCcustomField() {
  return get('api/customField/getFieldStatus')
}
// 批量查询工作项实例的自定义字段值
// data: { entityIds: [] }
export function postBatchGetCustomFieldValues(data) {
  return post('api/customField/batchGetFieldValues', data)
}

// 兼容自定义字段设置页面已使用的导出名称
export function getTenantCustomFieldConfig(data) {
  return getCustomFieldConfig(data)
}

export function saveTenantCustomFieldConfig(data) {
  return postSaveCustomFieldConfig(data)
}

export function getTenantCustomFieldOptions(data) {
  return getCustomFieldWorkItemFields(data)
}

// ===================== 应用管理员（租户配置） =====================

// 获取应用管理员列表
export function getAppAdminList() {
  return get('api/admin/app/list')
}

// 获取用户列表（用于应用管理员选人）
// needExcludeAdmin: true-排除已是应用管理员的用户 false-全部人员
export function getWebhookUserList(data) {
  return get('api/user/search', data)
}

// 批量添加应用管理员
export function postAddAppAdmin(data) {
  return post('api/admin/app/batch/add', data)
}

// 查询所有团队（isv）
export function getTeamSearch(data) {
  return get('api/team/search', data)
}

// 获取飞书组织架构树（无参数）
export function getOrgTree(data) {
  return get('org/tree',data)
}
//批量删除应用管理员
export function deleteAppAdminByIds(data) {
  return del(`api/admin/app/deletedByIds/${data.id}`)
}
//isv-租户模式-权限设置-删除数据权限
export function deleteDataAuthAppPermission(data) {
  return del(`isv/data/auth/deleteById/${data.id}`)
}
//isv-空间模式-权限设置-删除数据权限
export function deleteDataAuthPermission(data) {
  return del(`data/auth/deleteById/${data.id}`)
}
//获取节点流的工作项 获取飞书组织架构树（无参数）
export function getListWorkItemTypesWithNode(data) {
  return get('config/listWorkItemTypesWithNode',data)
}
//获取用户角色和工时应用管理员模式  isv新
export function getUserRoleInfo() {
  return get('api/user/info')
}
export function getDataAuthRemoveInfo(data) {
  return get('isv/data/auth/getRemoveInfo', data)
}

/** ===================== 飞书任务工时登记 ===================== */

const FEISHU_TASK_WORK_HOUR_BASE_PATH = 'feishu/task/work-hour'

// 实时查询个人有效任务
export function getFeishuTaskWorkHourTasks(data) {
  // pageToken, pageSize
  return get(`${FEISHU_TASK_WORK_HOUR_BASE_PATH}/tasks`, data)
}

// 新增任务工时登记
export function postFeishuTaskWorkHourRecord(data) {
  return post(`${FEISHU_TASK_WORK_HOUR_BASE_PATH}/records`, data)
}

// 编辑任务工时登记
export function postUpdateFeishuTaskWorkHourRecord(data) {
  return post(`${FEISHU_TASK_WORK_HOUR_BASE_PATH}/records/update`, data)
}

// 删除任务工时登记
export function deleteFeishuTaskWorkHourRecord(id) {
  return del(`${FEISHU_TASK_WORK_HOUR_BASE_PATH}/records/${id}`)
}

// 查询任务工时登记列表
export function getFeishuTaskWorkHourRecords(data) {
  return get(`${FEISHU_TASK_WORK_HOUR_BASE_PATH}/records`, data)
}

// 查询当前租户已同步的任务工时多维表格
export function getCurrentTaskWorkHourBitable() {
  return get(`${FEISHU_TASK_WORK_HOUR_BASE_PATH}/bitable/current`)
}

// 创建/同步任务工时多维表格
export function createTaskWorkHourBitable(data) {
  return post(`${FEISHU_TASK_WORK_HOUR_BASE_PATH}/bitable`, data)
}

/** ===================== 批量登记（租户模式 / 空间模式）5.2 新增 ===================== */

// 批量登记-获取空间配置（租户模式）
export function getRegistrationSettingsByProjectKeys(data) {
  // projectKeys
  return get('config/getRegistrationSettingsByProjectKeys', data)
}

// 批量登记-获取代填人员的上限下限（租户/空间）
export function getBatchStandWorkHourUser(data) {
  // userKey, outId, projectKey
  return get('config/standWorkHour/user', data)
}

// 批量登记-获取可登记的工作项（租户模式）
export function getBatchRegisterWorkItemOption(data) {
  return get('api/register/batchGetWorkItemOptionForRegister', data)
}

// 批量登记-获取可登记的工作项下的实例（租户模式）
export function getBatchRegisterItemEntityOption(data) {
  return post('api/register/getItemEntityOptionForBatch', data)
}

// 批量登记-点击空间下的工作项查询节点任务（空间模式/租户模式）
export function getBatchRegisterQueryNode(data) {
  // workItemEntityId, workItemId, registerUserKey, scheduleStart, scheduleEnd, personInCharge, isCache, registerTaskIds, registerNodeIds, projectKey
  return get('api/register/query/node', data)
}

// 批量登记-展开层级（空间模式/租户模式）
export function postBatchRegisterNodeBatch(data) {
  // [{ projectKey, registerUserKey, scheduleEnd, scheduleStart, workItems: [{ workItemId, workItemEntityId, workItemEntityName, workItemType }], personInCharge }]
  return post('api/register/node/batch', data)
}

// 批量登记-获取可登记的实例和任务和节点（空间模式/租户模式）
export function getBatchRegisterQueryBatch(data) {
  // level, pageNum, pageSize, scheduleStart, scheduleEnd, workItemIds, registerUserKey, workItemIdsFilter, excludeWorkItemEntityIdList, personInCharge, projectKeys
  return get('api/register/query/batch', data)
}

// 批量登记-添加已有实例工作项/任务/节点（空间模式/租户模式）
export function postBatchRegisterGetItemEntityOption(data) {
  // pageNum, pageSize, workItemEntityName, workItemIds, userKey, projectkey
  return post('api/register/getItemEntityOption', data)
}
// 批量登记-批量查询可登记的数据（空间模式）
export function getBatchRegisterDate(data) {
  return post('api/register/query/batch', data)
}

// 批量登记-获取上次保存的筛选条件
export function getBatchRegisterMemory(data) {
  return get('api/register/memory', data)
}

// 批量登记-获取筛选记忆设置
export function getBatchMemorySetting(data){
   return getUserNumeralConfig(data)
}

// 批量登记-保存筛选记忆设置
export function postBatchMemorySetting(data){
   return postUserNumeralConfig(data)
}

// 批量登记-保存批量登记（空间模式/租户模式）
export function postBatchRegisterSaveData(data) {
  return post('api/register/registration/batch', data)
}
// 批量登记-批量查询区间日期登记工时情况（空间模式/租户模式）
export function getBatchRegisterSaturationPersonBatch(data) {
  return post('api/register/statistics/saturation/person/batch', data)
}
// 个人工作饱和度提示框
export function getBatchWorkSaturationTips(data) {
  // workDate
  // registrantUseKey
  return get('api/register/statistics/saturation/person', data)
}
//批量登记-添加已有实例工作项（空间模式/租户模式）  /任务/节点接口复用
export function postBatchAddGetItemEntityOptionForBatch(data) {
  return post('api/register/addGetItemEntityOptionForBatch', data)
} 
//查询可登记的工作项下的实例的节点任务(单项登记)
export function postBatchGetEntityNodeOption(data) {
  return get('api/register/getEntityNodeOption', data)
} 
//同步成员/团队
export function postTeamRefreshAll(data) {
  return get('team/refreshAll', data)
}
//导出-个人统计-实际工时统计
export function exportPeopleWorkHoursTotalDetail(data) {
  return post('workHour/exportSelfStat', data)
}
// 再次发起-获取空间和工作项是否被删除
export function getBatchRegisterProjectKeyAndWorkItemTypeInfo(data) {
  return get('api/register/getProjectKeyAndWorkItemTypeInfo', data)
}
/** ===================== 飞书考勤 ===================== */
//查询考勤配置状态
const USE_ATTENDANCE_MOCK = false;
const MOCK_PROJECT_OPEN = "7454012189653893148"; // 开启考勤的空间
const MOCK_PROJECT_CLOSE = "671f7d5d69277dfb0b140307"; // 关闭考勤的空间
const MOCK_USER_OPEN = "7454012189653893148"; // 开启考勤空间的成员
const MOCK_USER_CLOSE = "7654300649781267655"; // 关闭考勤空间的成员

export function getAttendanceConfig(data) {
  if (USE_ATTENDANCE_MOCK) {
    return Promise.resolve({
      code: 200,
      msg: "success",
      result: true,
      data: [
        {
          projectKey: MOCK_PROJECT_OPEN,
          isEnable: 1,
          upperLimitSource: 1,
          missPunchPolicy: 1,
          missPunchCustomLimit: null,
        },
        {
          projectKey: MOCK_PROJECT_CLOSE,
          isEnable: 0,
          upperLimitSource: 1,
          missPunchPolicy: 1,
          missPunchCustomLimit: null,
        },
        {
          projectKey:'',
          isEnable: 1,
          upperLimitSource: 1,
          missPunchPolicy: 1,
          missPunchCustomLimit: null,
        },
      ],
    });
  }
  return post('api/attendance/config/status', data)
}

//查询成员考勤数据
export function getUserAttendanceConfig(data) {
  if (USE_ATTENDANCE_MOCK) {
    return Promise.resolve({
      code: 200,
      msg: "success",
      result: true,
      data: {
        projects: [
          {
            projectKey: '',
            isEnable: 1,
            upperLimitSource: 1,
            missPunchPolicy: 1,
            missPunchCustomLimit: null,
            userKeys: {
              [MOCK_USER_OPEN]: {
                "2026-08-24": {
                  attendanceHours: 8,
                  hasAttendance: true,
                  leaveFlag: false,
                  punchRecords: [
                    { time: "09:02:10", type: "ON" },
                    { time: "18:30:55", type: "OFF" },
                  ],
                },
                "2026-08-25": {
                  attendanceHours: 6,
                  hasAttendance: false,
                  leaveFlag: true,
                  punchRecords: [],
                },
              },
            },
          },
          // {
          //   projectKey: MOCK_PROJECT_CLOSE,
          //   isEnable: 0,
          //   upperLimitSource: 1,
          //   missPunchPolicy: 1,
          //   missPunchCustomLimit: null,
          //   userKeys: {
          //     [MOCK_USER_CLOSE]: {
          //       "2026-08-24": {
          //         attendanceHours: null,
          //         hasAttendance: false,
          //         leaveFlag: false,
          //         punchRecords: [],
          //       },
          //     },
          //   },
          // },
        ],
        failList: [],
      },
    });
  }
  return post('api/attendance/data/query', data)
}

//手动同步考勤数据
export function syncAttendanceConfig(data) {
  return post('api/attendance/data/sync', data)
}
//资源管理-查询成员考勤数据
export function getResourceUserAttendanceConfig(data) {
  return post('api/attendance/data/query/parallel', data)
}
