import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  Dropdown,
  Empty,
  Input,
  Modal,
  Select,
  Spin,
  Switch,
  Tag,
  Tooltip,
} from 'antd'
import {
  DownOutlined,
  ExclamationCircleFilled,
  InfoCircleFilled,
  PlusCircleFilled,
  CaretDownFilled,
  CaretRightFilled,
} from '@ant-design/icons'
import {
  getCustomFieldWorkItemTypes,
  getProjectList,
  getInstallList,
  getTenantCustomFieldConfig,
  getTenantCustomFieldOptions,
  saveTenantCustomFieldConfig,
} from '../../../api/api'
import JSSDK from '../../../jssdk-adapter'
import noDataImg from '../../../assets/images/no-data.png'
import deleteSpaceIcon from '../../../assets/delete-space.png'
import './CustomFieldSettings.less'

const FIELD_NAME_LIMIT = 10
const SUPPORTED_FIELD_TYPES = new Set([
  'text',
  'single_text',
  'singleline_text',
  'single_line_text',
  'textarea',
  'multi_text',
  'multiline_text',
  'multi_line_text',
  'select',
  'single_select',
  'single_option',
  'work_item',
  'workitem',
  'single_work_item',
  'single_related_work_item',
  '单行文本',
  '多行文本',
  '单选',
  '单选关联工作项',
])
const FALLBACK_WORK_ITEM_FIELDS = [
  {
    fieldKey: 'field_xxx',
    fieldName: '所属模块',
    fieldType: 'single_select',
  },
  {
    fieldKey: 'field_xxx2',
    fieldName: '所属模块2',
    fieldType: 'text',
  },
]
const FALLBACK_CUSTOM_FIELD_CONFIG = {
  data: {
    fieldId: 1,
    fieldName: '所属项目',
    isEnabled: false,
    spaceCount: 2,
    workItemCount: 5,
    spaceConfigs: [
      {
        scopeId: 1,
        projectKey: '6886eb366e2da312cbe71d7f',
        projectName: 'wqh-dev',
        workItemMappings: [
          {
            mappingId: 1,
            workItemTypeKey: 'story',
            workItemTypeName: '需求',
            feishuFieldKey: 'field_xxx3',
            feishuFieldName: '所属模块1',
          },
        ],
      },
    ],
  },
}

let rowSeed = 0

const nextRowId = () => {
  rowSeed += 1
  return `custom-field-row-${Date.now()}-${rowSeed}`
}

const isSuccess = (res) => !!res?.result || res?.code === 0 || res?.code === 200

const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null)

const getList = (value, keys = []) => {
  if (Array.isArray(value)) return value
  for (const key of keys) {
    if (Array.isArray(value?.[key])) return value[key]
  }
  return []
}

const normalizeEnabled = (value) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'enabled'
  return Number(value) === 1
}

const normalizeWorkItem = (item = {}) => ({
  clientId: nextRowId(),
  workItemId: String(firstDefined(item.workItemTypeKey, item.workItemId, item.workItemKey, item.value, item.id, '') || ''),
  workItemName: firstDefined(item.workItemTypeName, item.workItemName, item.label, item.level, item.name, '') || '',
  fieldKey: String(firstDefined(
    item.feishuFieldKey,
    item.feishu_field_key,
    item.fieldKey,
    item.field_key,
    item.fieldId,
    item.customFieldKey,
    item.valueFieldKey,
    '',
  ) || ''),
  fieldName: firstDefined(
    item.feishuFieldName,
    item.feishu_field_name,
    item.fieldName,
    item.field_name,
    item.customFieldName,
    item.valueFieldName,
    item.fieldLabel,
    '',
  ) || '',
  relationId: firstDefined(item.relation_id, item.relationId, '') || '',
})

const normalizeScope = (item = {}) => {
  const rawWorkItems = getList(item, [
    'workItems',
    'workItemConfigs',
    'workItemConfigList',
    'workItemConfigVos',
    'workItemMappings',
    'customFieldWorkItemConfigVoList',
  ])
  return {
    projectKey: String(firstDefined(item.projectKey, item.spaceKey, item.projectId, item.value, item.id, '') || ''),
    projectName: firstDefined(item.projectName, item.spaceName, item.label, item.level, item.name, '') || '',
    workItems: rawWorkItems.map(normalizeWorkItem),
  }
}

export const normalizeCustomFieldConfig = (response) => {
  const responseData = response?.data ?? response ?? {}
  const source = responseData?.customFieldConfig || responseData?.config || responseData
  const rawScopes = getList(source, [
    'projectConfigs',
    'projectConfigList',
    'projectConfigVos',
    'scopeConfigs',
    'spaceConfigs',
    'customFieldProjectConfigVoList',
  ])
  const enabledSource = firstDefined(source.isEnabled, source.enabled, source.enable, source.enableStatus, source.status, source.value)
  const fieldName = firstDefined(source.fieldName, source.customFieldName, source.name, '') || ''
  const scopes = rawScopes.map(normalizeScope).filter((item) => item.projectKey)
  return {
    id: firstDefined(source.fieldId, source.id, source.configId, null),
    configured: !!firstDefined(source.fieldId, source.id, source.configId, fieldName, rawScopes.length ? true : undefined, enabledSource),
    enabled: normalizeEnabled(enabledSource),
    fieldName,
    scopes,
    spaceCount: Number.isFinite(Number(source.spaceCount)) ? Number(source.spaceCount) : scopes.length,
    workItemCount: Number.isFinite(Number(source.workItemCount))
      ? Number(source.workItemCount)
      : scopes.reduce((total, scope) => total + scope.workItems.filter((item) => item.workItemId && item.fieldKey).length, 0),
  }
}

const normalizeSpaceOptions = (response) => {
  const list = getList(response?.data, ['list', 'records'])
  return list.map((item) => ({
    value: String(firstDefined(item.value, item.projectKey, item.spaceKey, item.id, '') || ''),
    label: firstDefined(item.projectName, item.level, item.label, item.spaceName, item.name, '') || '',
  })).filter((item) => item.value)
}

const normalizeWorkItemOptions = (response) => {
  const list = getList(response?.data, ['list', 'records', 'workItems', 'workItemList'])
  return list.map((item) => ({
    value: String(firstDefined(item.workItemTypeKey, item.value, item.workItemId, item.workItemKey, item.id, '') || ''),
    label: firstDefined(item.workItemTypeName, item.level, item.label, item.workItemName, item.name, item.value, '') || '',
  })).filter((item) => item.value)
}

const normalizeFieldOptions = (response) => {
  const list = getList(response?.data, ['list', 'records', 'fields', 'fieldList', 'fieldOptions'])
  return list.filter((item) => {
    const type = firstDefined(item.field_type, item.fieldType, item.type, item.typeName, item.fieldTypeName)
    return !type || SUPPORTED_FIELD_TYPES.has(String(type).toLowerCase()) || SUPPORTED_FIELD_TYPES.has(String(type))
  }).map((item) => {
    const value = String(firstDefined(item.field_key, item.fieldKey, item.fieldId, item.value, item.id, '') || '')
    const label = firstDefined(item.field_name, item.fieldName, item.label, item.name, item.value, value) || value
    return {
      value,
      label,
      relationId: firstDefined(item.relation_id, item.relationId, '') || '',
    }
  }).filter((item) => item.value)
}

const countConfiguredWorkItems = (scopes = []) => scopes.reduce(
  (total, scope) => total + (scope.workItems || []).filter((item) => item.workItemId && item.fieldKey).length,
  0,
)

export const CustomFieldSummary = ({ onSetting }) => {
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState(() => normalizeCustomFieldConfig({}))

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const res = await getTenantCustomFieldConfig()
        if (active) {
          setConfig(normalizeCustomFieldConfig(isSuccess(res) ? res : {}))
        }
      } catch (error) {
        console.error('加载自定义字段配置失败:', error)
        if (active) setConfig(normalizeCustomFieldConfig({}))
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  const spaceCount = config.spaceCount ?? config.scopes.length
  const workItemCount = config.workItemCount ?? countConfiguredWorkItems(config.scopes)

  return (
    <div className="admin-placeholder custom-field-summary-page">
      <div className="custom-field-summary-card">
        <div className="custom-field-summary-header">
          <div>
            <div className="custom-field-summary-title">
              <div className="admin-page-title">自定义字段设置</div>
              {!loading && (
                <Tag color={config.enabled ? 'green' : 'orange'} className="admin-status-tag">
                  {config.enabled ? '已启用' : '未启用'}
                </Tag>
              )}
            </div>
            {!loading && (
              <div className="admin-page-desc" style={{ marginTop: '4px' }}>设置自定义字段，用于更准确地识别登记对象。</div>
            )}
          </div>
          <Button onClick={onSetting}>设置</Button>
        </div>
        {loading ? (
          <div className="custom-field-summary-loading"><Spin size="small" /></div>
        ) : config.enabled ? (
          <>
            <div className="custom-field-divider" />
            <div className="custom-field-summary-values">
              <div><span>字段名称：</span><strong>{config.fieldName || '--'}</strong></div>
              <div><span>配置取值范围：</span><strong>{spaceCount} 个空间 / {workItemCount} 个工作项</strong></div>
            </div>
          </>
        ) : (
          <>
            <div className="custom-field-divider" />
            <div className="custom-field-summary-empty">
              <Empty
                image={noDataImg}
                description="自定义字段未启用，请先在设置里面开启自定义字段设置"
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const confirmDelete = ({ title, content, onConfirm }) => {
  Modal.confirm({
    title,
    content,
    icon: <ExclamationCircleFilled />,
    centered: true,
    closable: true,
    okText: '确认',
    cancelText: '取消',
    width: 520,
    className: 'custom-field-delete-modal',
    onOk: onConfirm,
  })
}

export const CustomFieldSettings = ({ onCancel, onSaved }) => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [fieldName, setFieldName] = useState('')
  const [scopes, setScopes] = useState([])
  const [spaceOptions, setSpaceOptions] = useState([])
  const [expandedKeys, setExpandedKeys] = useState(() => new Set())
  const [workItemOptions, setWorkItemOptions] = useState({})
  const [workItemLoading, setWorkItemLoading] = useState({})
  const [fieldOptions, setFieldOptions] = useState({})
  const [fieldLoading, setFieldLoading] = useState({})
  const [validateTriggered, setValidateTriggered] = useState(false)
  const [scopeLoadStatuses, setScopeLoadStatuses] = useState({})
  const loadedWorkItemKeysRef = useRef(new Set())
  const workItemRequestsRef = useRef({})
  const fieldOptionsCacheRef = useRef({})
  const fieldRequestsRef = useRef({})

  const loadWorkItems = async (projectKey) => {
    if (!projectKey) return []
    if (loadedWorkItemKeysRef.current.has(projectKey)) {
      return workItemOptions[projectKey] || []
    }
    if (workItemRequestsRef.current[projectKey]) {
      return workItemRequestsRef.current[projectKey]
    }
    setWorkItemLoading((prev) => ({ ...prev, [projectKey]: true }))
    const request = (async () => {
      try {
        const res = await getCustomFieldWorkItemTypes({ projectKey, needDisable: true })
        const options = isSuccess(res) ? normalizeWorkItemOptions(res) : []
        if (isSuccess(res)) loadedWorkItemKeysRef.current.add(projectKey)
        setWorkItemOptions((prev) => ({ ...prev, [projectKey]: options }))
        return options
      } catch (error) {
        console.error('加载工作项列表失败:', error)
        setWorkItemOptions((prev) => ({ ...prev, [projectKey]: [] }))
        return []
      } finally {
        delete workItemRequestsRef.current[projectKey]
        setWorkItemLoading((prev) => ({ ...prev, [projectKey]: false }))
      }
    })()
    workItemRequestsRef.current[projectKey] = request
    return request
  }

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      try {
        const [configResult, spacesResult] = await Promise.allSettled([
          getTenantCustomFieldConfig(),
          getInstallList(),
        ])
        if (!active) return
        const configRes = configResult.status === 'fulfilled' ? configResult.value : null
        const spacesRes = spacesResult.status === 'fulfilled' ? spacesResult.value : null
        const normalized = normalizeCustomFieldConfig(
          isSuccess(configRes) ? configRes : FALLBACK_CUSTOM_FIELD_CONFIG,
        )
        setEnabled(normalized.enabled)
        setFieldName(normalized.fieldName)
        setScopes(normalized.scopes)
        setSpaceOptions(isSuccess(spacesRes) ? normalizeSpaceOptions(spacesRes) : [])
      } catch (error) {
        console.error('初始化自定义字段设置失败:', error)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  const availableSpaces = useMemo(() => {
    const selected = new Set(scopes.map((scope) => scope.projectKey))
    return spaceOptions.filter((option) => !selected.has(option.value))
  }, [scopes, spaceOptions])

  const updateRow = (projectKey, clientId, patch) => {
    setScopes((prev) => prev.map((scope) => (
      scope.projectKey === projectKey
        ? {
            ...scope,
            workItems: scope.workItems.map((item) => (
              item.clientId === clientId ? { ...item, ...patch } : item
            )),
          }
        : scope
    )))
  }

  const handleAddSpace = async (projectKey) => {
    const option = spaceOptions.find((item) => item.value === projectKey)
    const newScope = {
      projectKey,
      projectName: option?.label || projectKey,
      workItems: [normalizeWorkItem({})],
    }
    setScopes((prev) => [
      ...prev,
      newScope,
    ])
    setExpandedKeys((prev) => new Set([...prev, projectKey]))
    await loadScopeOptions(newScope)
  }

  const handleRemoveSpace = (scope) => {
    confirmDelete({
      title: '确认删除空间配置？',
      content: '删除后，该空间及其下所有工作项配置将一并删除。',
      onConfirm: () => {
        setScopes((prev) => prev.filter((item) => item.projectKey !== scope.projectKey))
        setExpandedKeys((prev) => {
          const next = new Set(prev)
          next.delete(scope.projectKey)
          return next
        })
        setScopeLoadStatuses((prev) => {
          const next = { ...prev }
          delete next[scope.projectKey]
          return next
        })
      },
    })
  }

  const handleAddWorkItem = (projectKey) => {
    setScopes((prev) => prev.map((scope) => (
      scope.projectKey === projectKey
        ? { ...scope, workItems: [...scope.workItems, normalizeWorkItem({})] }
        : scope
    )))
    setExpandedKeys((prev) => new Set([...prev, projectKey]))
  }

  const handleRemoveWorkItem = (projectKey, row) => {
    confirmDelete({
      title: '确认删除工作项配置？',
      content: '删除后，该空间下的该工作项不再按当前取值字段读取自定义字段值。',
      onConfirm: () => {
        setScopes((prev) => prev.map((scope) => (
          scope.projectKey === projectKey
            ? { ...scope, workItems: scope.workItems.filter((item) => item.clientId !== row.clientId) }
            : scope
        )))
      },
    })
  }

  const loadFields = async (projectKey, row) => {
    if (!row.workItemId) return
    const cacheKey = `${row.clientId}:${row.workItemId}`
    if (Object.prototype.hasOwnProperty.call(fieldOptionsCacheRef.current, cacheKey)) {
      const options = fieldOptionsCacheRef.current[cacheKey]
      setFieldOptions((prev) => ({ ...prev, [row.clientId]: options }))
      return options
    }
    if (fieldRequestsRef.current[cacheKey]) {
      return fieldRequestsRef.current[cacheKey]
    }
    setFieldLoading((prev) => ({ ...prev, [row.clientId]: true }))
    const request = (async () => {
      try {
        const res = await getTenantCustomFieldOptions({ projectKey, workItemTypeKey: row.workItemId })
        const options = isSuccess(res)
          ? normalizeFieldOptions(res)
          : normalizeFieldOptions({ data: [] })
        if (isSuccess(res)) fieldOptionsCacheRef.current[cacheKey] = options
        setFieldOptions((prev) => ({ ...prev, [row.clientId]: options }))
        return options
      } catch (error) {
        console.error('加载取值字段失败:', error)
        const options = normalizeFieldOptions({ data: [] })
        setFieldOptions((prev) => ({ ...prev, [row.clientId]: options }))
        return options
      } finally {
        delete fieldRequestsRef.current[cacheKey]
        setFieldLoading((prev) => ({ ...prev, [row.clientId]: false }))
      }
    })()
    fieldRequestsRef.current[cacheKey] = request
    return request
  }

  const markScopeOptionsReady = (scope) => {
    const fieldsLoaded = scope.workItems
      .filter((row) => row.workItemId)
      .every((row) => Object.prototype.hasOwnProperty.call(
        fieldOptionsCacheRef.current,
        `${row.clientId}:${row.workItemId}`,
      ))
    if (!loadedWorkItemKeysRef.current.has(scope.projectKey) || !fieldsLoaded) return false
    setScopeLoadStatuses((prev) => (
      prev[scope.projectKey] === 'ready'
        ? prev
        : { ...prev, [scope.projectKey]: 'ready' }
    ))
    return true
  }

  const loadScopeOptions = async (scope) => {
    if (!scope?.projectKey) return false
    setScopeLoadStatuses((prev) => ({ ...prev, [scope.projectKey]: 'loading' }))
    await Promise.all([
      loadWorkItems(scope.projectKey),
      ...scope.workItems
        .filter((row) => row.workItemId)
        .map((row) => loadFields(scope.projectKey, row)),
    ])
    const ready = markScopeOptionsReady(scope)
    if (!ready) {
      setScopeLoadStatuses((prev) => ({ ...prev, [scope.projectKey]: 'failed' }))
    }
    return ready
  }

  const handleToggleScope = (scope) => {
    const willExpand = !expandedKeys.has(scope.projectKey)
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (willExpand) next.add(scope.projectKey)
      else next.delete(scope.projectKey)
      return next
    })
    if (willExpand && scopeLoadStatuses[scope.projectKey] !== 'ready') {
      void loadScopeOptions(scope)
    }
  }

  const handleSave = async () => {
    setValidateTriggered(true)
    const trimmedName = fieldName.trim()
    const invalidRows = scopes.flatMap((scope) => (
      scope.workItems.filter((item) => !item.workItemId || !item.fieldKey).map(() => scope.projectKey)
    ))
    const invalidScopeKeys = [...new Set(invalidRows)]
    if (!trimmedName || fieldName.length > FIELD_NAME_LIMIT || invalidRows.length) {
      if (invalidRows.length) setExpandedKeys((prev) => new Set([...prev, ...invalidRows]))
      invalidScopeKeys.forEach((projectKey) => {
        const scope = scopes.find((item) => item.projectKey === projectKey)
        if (scope && scopeLoadStatuses[projectKey] !== 'ready') {
          void loadScopeOptions(scope)
        }
      })
      return
    }
    const payload = {
      fieldName: trimmedName,
      isEnabled: enabled,
      spaceConfigs: scopes.map((scope) => {
        const liveSpace = spaceOptions.find((option) => option.value === scope.projectKey)
        const liveWorkItems = workItemOptions[scope.projectKey] || []
        return {
          projectKey: scope.projectKey,
          projectName: liveSpace?.label || scope.projectName || scope.projectKey,
          workItemMappings: scope.workItems.map((item) => {
            const liveWorkItem = liveWorkItems.find((option) => option.value === item.workItemId)
            const liveField = (fieldOptions[item.clientId] || []).find((option) => option.value === item.fieldKey)
            const relationId = liveField?.relationId || item.relationId
            return {
              workItemTypeKey: item.workItemId,
              workItemTypeName: liveWorkItem?.label || item.workItemName || item.workItemId,
              feishuFieldKey: item.fieldKey,
              feishuFieldName: liveField?.label || item.fieldName || item.fieldKey,
              ...(relationId ? { relationId } : {}),
            }
          }),
        }
      }),
    }

    setSaving(true)
    try {
      const res = await saveTenantCustomFieldConfig(payload)
      if (isSuccess(res)) {
        JSSDK.toast.success('保存成功')
        onSaved?.()
      }
    } catch (error) {
      console.error('保存自定义字段配置失败:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="custom-field-page-loading"><Spin /></div>
  }

  const fieldNameError = validateTriggered && (
    !fieldName.trim()
      ? '请输入字段名称'
      : fieldName.length > FIELD_NAME_LIMIT
        ? `字段名称不能超过 ${FIELD_NAME_LIMIT} 字`
        : ''
  )

  return (
    <div className="custom-field-settings">
      <section className="custom-field-enable-section">
        <div className="custom-field-enable-title">
          <span>自定义字段设置</span>
          <Switch checked={enabled} onChange={setEnabled} />
        </div>
        <div className="custom-field-description">
          通过自定义字段关联飞书项目字段，帮助用户在登记、查看和统计工时时更准确地识别登记对象。
        </div>
      </section>

      <div className="custom-field-divider" style={{ margin: '12px 0 12px' }} />

      <section className="custom-field-name-section">
        <div className="custom-field-section-title">字段名称</div>
        <div className={`custom-field-name-input${fieldNameError ? ' has-error' : ''}`}>
          <Input
            value={fieldName}
            placeholder="请输入字段名称，例如：所属项目"
            onChange={(event) => setFieldName(event.target.value)}
            suffix={<span className={fieldName.length > FIELD_NAME_LIMIT ? 'is-over-limit' : ''}>{fieldName.length}/{FIELD_NAME_LIMIT}</span>}
          />
          {fieldNameError && <div className="custom-field-error">{fieldNameError}</div>}
        </div>
      </section>

      <section className="custom-field-range-section">
        <div className="custom-field-range-header">
          <div>
            <div className="custom-field-section-title">配置取值范围</div>
            <div className="custom-field-description">为不同空间配置工作项取值字段，系统将根据工时记录所属空间和工作项读取对应字段值。</div>
          </div>
          <Dropdown
            trigger={['click']}
            placement="bottomRight"
            menu={{
              className: 'custom-field-space-dropdown-menu',
              items: availableSpaces.length
                ? availableSpaces.map((item) => ({ key: item.value, label: item.label }))
                : [{ key: 'empty', label: '暂无可添加空间', disabled: true }],
              onClick: ({ key }) => { if (key !== 'empty') handleAddSpace(key) },
            }}
          >
            {scopes.length >0? (<Button className="custom-field-add-space">+ 添加空间</Button>) : null}
          </Dropdown>
        </div>

        {scopes.length === 0 ? (
          <div className="custom-field-empty">
            <Empty image={noDataImg} description="暂无数据" />
            <Dropdown
              trigger={['click']}
              menu={{
                className: 'custom-field-space-dropdown-menu',
                items: availableSpaces.length
                  ? availableSpaces.map((item) => ({ key: item.value, label: item.label }))
                  : [{ key: 'empty', label: '暂无可添加空间', disabled: true }],
                onClick: ({ key }) => { if (key !== 'empty') handleAddSpace(key) },
              }}
            >
              <Button className="custom-field-add-space">+ 添加空间</Button>
            </Dropdown>
          </div>
        ) : (
          <div className="custom-field-scope-list">
            {scopes.map((scope) => {
              const expanded = expandedKeys.has(scope.projectKey)
              const liveSpace = spaceOptions.find((option) => option.value === scope.projectKey)
              const spaceName =  scope?.projectName || scope.projectKey
              const configuredCount = scope.workItems.length
              const selectedIds = new Set(scope.workItems.map((item) => item.workItemId).filter(Boolean))
              const currentWorkItemOptions = workItemOptions[scope.projectKey] || []
              const scopeLoadStatus = scopeLoadStatuses[scope.projectKey] || 'idle'
              const scopeOptionsReady = scopeLoadStatus === 'ready'
              const showScopeLoading = scopeLoadStatus === 'loading'
              const showScopeContent = scopeLoadStatus === 'ready' || scopeLoadStatus === 'failed'

              return (
                <div className="custom-field-scope-card" key={scope.projectKey}>
                  <div className="custom-field-scope-head">
                    <button
                      type="button"
                      className="custom-field-collapse-button"
                      aria-label={expanded ? '收起空间配置' : '展开空间配置'}
                      onClick={() => handleToggleScope(scope)}
                    >
                      {expanded ? <CaretDownFilled /> : <CaretRightFilled />}
                    </button>
                    <Tooltip title={spaceName}>
                      <span className="custom-field-scope-name">{spaceName}</span>
                    </Tooltip>
                    <span className="custom-field-scope-count">（已配置 {configuredCount} 个工作项）</span>
                    <Tooltip title="删除空间配置">
                      <Button
                        type="text"
                        className="custom-field-delete-space"
                        icon={<img src={deleteSpaceIcon} alt="" className="custom-field-delete-space-icon" />}
                        onClick={() => handleRemoveSpace(scope)}
                      />
                    </Tooltip>
                  </div>

                  {expanded && showScopeLoading && (
                    <div className="custom-field-scope-body">
                      <div className="custom-field-work-item-empty">
                        <Spin />
                      </div>
                    </div>
                  )}

                  {expanded && showScopeContent && (
                    <div className="custom-field-scope-body">
                      <div className="custom-field-table-head">
                        <span>工作项名称</span>
                        <span>
                          取值字段
                          <Tooltip title="取值字段指系统从该工作项实例中读取并展示的飞书项目字段">
                            <InfoCircleFilled />
                          </Tooltip>
                        </span>
                        <span>操作</span>
                      </div>

                      {scope.workItems.length === 0 ? (
                        <div className="custom-field-work-item-empty">
                          <Empty image={noDataImg} description="暂无工作项" />
                        </div>
                      ) : scope.workItems.map((row) => {
                        const rowFieldOptions = fieldOptions[row.clientId] || []
                        const liveSelectedField = rowFieldOptions.find((option) => option.value === row.fieldKey)
                        const selectedFieldLabel = liveSelectedField?.label || row.fieldName || row.fieldKey
                        const selectedWorkItemOptions = row.workItemId
                          ? [{ value: row.workItemId, label: row.workItemName || row.workItemId }]
                          : []
                        const mergedFieldOptions = row.fieldKey
                          ? [
                              { value: row.fieldKey, label: selectedFieldLabel, relationId: row.relationId },
                              ...rowFieldOptions.filter((option) => option.value !== row.fieldKey),
                            ]
                          : rowFieldOptions
                        const displayedWorkItemOptions = scopeOptionsReady
                          ? currentWorkItemOptions
                          : selectedWorkItemOptions
                        const displayedFieldOptions = scopeOptionsReady
                          ? mergedFieldOptions
                          : (row.fieldKey
                            ? [{ value: row.fieldKey, label: selectedFieldLabel, relationId: row.relationId }]
                            : [])
                        const workItemError = validateTriggered && !row.workItemId
                        const fieldError = validateTriggered && !row.fieldKey

                        return (
                          <div className="custom-field-table-row" key={row.clientId}>
                            <div className="custom-field-control">
                              <Select
                                value={row.workItemId || undefined}
                                placeholder="请选择配置的工作项"
                                loading={!!workItemLoading[scope.projectKey]}
                                options={displayedWorkItemOptions.map((option) => ({
                                  ...option,
                                  disabled: selectedIds.has(option.value) && option.value !== row.workItemId,
                                }))}
                                status={workItemError ? 'error' : undefined}
                                onDropdownVisibleChange={(open) => {
                                  if (open && !scopeOptionsReady) void loadScopeOptions(scope)
                                }}
                                onChange={(value) => {
                                  const option = currentWorkItemOptions.find((item) => item.value === value)
                                  updateRow(scope.projectKey, row.clientId, {
                                    workItemId: value,
                                    workItemName: option?.label || value,
                                    fieldKey: '',
                                    fieldName: '',
                                    relationId: '',
                                  })
                                  setFieldOptions((prev) => ({ ...prev, [row.clientId]: [] }))
                                }}
                              />
                              {workItemError && <div className="custom-field-error">请选择工作项</div>}
                            </div>

                            <div className="custom-field-control">
                              <Select
                                value={row.fieldKey || undefined}
                                placeholder={row.workItemId ? '请选择字段' : '请先选择工作项'}
                                disabled={!row.workItemId}
                                loading={!!fieldLoading[row.clientId]}
                                options={displayedFieldOptions}
                                status={fieldError ? 'error' : undefined}
                                onDropdownVisibleChange={(open) => {
                                  if (open) {
                                    void loadFields(scope.projectKey, row).then(() => markScopeOptionsReady(scope))
                                  }
                                }}
                                onChange={(value) => {
                                  const option = rowFieldOptions.find((item) => item.value === value)
                                    || mergedFieldOptions.find((item) => item.value === value)
                                  updateRow(scope.projectKey, row.clientId, {
                                    fieldKey: value,
                                    fieldName: option?.label || value,
                                    relationId: option?.relationId || (value === row.fieldKey ? row.relationId : ''),
                                  })
                                }}
                              />
                              {fieldError && <div className="custom-field-error">请选择字段</div>}
                            </div>

                            <Button type="link" onClick={() => handleRemoveWorkItem(scope.projectKey, row)}>删除</Button>
                          </div>
                        )
                      })}

                      <Button
                        type="text"
                        className="custom-field-add-work-item"
                        icon={<PlusCircleFilled />}
                        onClick={() => handleAddWorkItem(scope.projectKey)}
                      >
                        添加工作项
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <div className="custom-field-actions">
        <Button type="primary" loading={saving} onClick={handleSave}>保存设置</Button>
        {/* <Button disabled={saving} onClick={onCancel}>取消</Button> */}
      </div>
    </div>
  )
}
