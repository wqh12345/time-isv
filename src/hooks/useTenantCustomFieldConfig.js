import { useEffect, useState } from "react";
import { getTenantCustomFieldConfig,getCommonCcustomField } from "../api/api";

const EMPTY_CUSTOM_FIELD_CONFIG = {
  enabled: false,
  fieldName: "",
};

let customFieldConfigRequest = null;

const normalizeCustomFieldConfig = (res) => {
  const configData = res?.result && res?.data ? res.data : null;
  return {
    isEnabled: configData?.enabled,
    fieldName: typeof configData?.fieldName === "string" ? configData.fieldName : "",
  };
};

export const fetchTenantCustomFieldConfig = () => {
  if (!customFieldConfigRequest) {
    customFieldConfigRequest = Promise.resolve()
      .then(() => getCommonCcustomField())
      .then(normalizeCustomFieldConfig)
      .catch((error) => {
        return { ...EMPTY_CUSTOM_FIELD_CONFIG };
      })
      .finally(() => {
        customFieldConfigRequest = null;
      });
  }
  return customFieldConfigRequest;
};

export const formatCustomFieldValue = (value) => {
  if (value === null || value === undefined) return "--";
  if (typeof value === "string" && value.trim() === "") return "--";
  return value;
};

export const useTenantCustomFieldConfig = () => {
  const [customFieldConfig, setCustomFieldConfig] = useState(EMPTY_CUSTOM_FIELD_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetchTenantCustomFieldConfig()
      .then((config) => {
        if (isMounted) setCustomFieldConfig(config);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return {
    ...customFieldConfig,
    loading,
    showCustomField:
      customFieldConfig.isEnabled && Boolean(customFieldConfig.fieldName),
  };
};
