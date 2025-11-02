import { DextConfig } from "@/lib/configurationTypes";
import {
  DEFAULT_MCP_PROXY_LISTEN_PORT,
  DEFAULT_DEXT_CONFIG,
} from "@/lib/constants";

const getSearchParam = (key: string): string | null => {
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get(key);
  } catch {
    return null;
  }
};

export const getMCPProxyAddress = (config: DextConfig): string => {
  let proxyFullAddress = config.MCP_PROXY_FULL_ADDRESS.value as string;
  if (proxyFullAddress) {
    proxyFullAddress = proxyFullAddress.replace(/\/+$/, "");
    return proxyFullAddress;
  }

  // Check for proxy port from query params, fallback to default
  const proxyPort =
    getSearchParam("MCP_PROXY_PORT") || DEFAULT_MCP_PROXY_LISTEN_PORT;

  return `${window.location.protocol}//${window.location.hostname}:${proxyPort}`;
};

export const getMCPServerRequestTimeout = (config: DextConfig): number => {
  return config.MCP_SERVER_REQUEST_TIMEOUT.value as number;
};

export const resetRequestTimeoutOnProgress = (config: DextConfig): boolean => {
  return config.MCP_REQUEST_TIMEOUT_RESET_ON_PROGRESS.value as boolean;
};

export const getMCPServerRequestMaxTotalTimeout = (
  config: DextConfig,
): number => {
  return config.MCP_REQUEST_MAX_TOTAL_TIMEOUT.value as number;
};

export const getMCPProxyAuthToken = (
  config: DextConfig,
): {
  token: string;
  header: string;
} => {
  return {
    token: config.MCP_PROXY_AUTH_TOKEN.value as string,
    header: "X-MCP-Proxy-Auth",
  };
};

export const getInitialTransportType = ():
  | "stdio"
  | "sse"
  | "streamable-http" => {
  const param = getSearchParam("transport");
  if (param === "stdio" || param === "sse" || param === "streamable-http") {
    return param;
  }
  return (
    (localStorage.getItem("lastTransportType") as
      | "stdio"
      | "sse"
      | "streamable-http") || "stdio"
  );
};

export const getInitialSseUrl = (): string => {
  const param = getSearchParam("serverUrl");
  if (param) return param;
  return localStorage.getItem("lastSseUrl") || "http://localhost:3001/sse";
};

export const getInitialCommand = (): string => {
  const param = getSearchParam("serverCommand");
  if (param) return param;
  return localStorage.getItem("lastCommand") || "mcp-server-everything";
};

export const getInitialArgs = (): string => {
  const param = getSearchParam("serverArgs");
  if (param) return param;
  return localStorage.getItem("lastArgs") || "";
};

// Returns a map of config key -> value from query params if present
export const getConfigOverridesFromQueryParams = (
  defaultConfig: DextConfig,
): Partial<DextConfig> => {
  const url = new URL(window.location.href);
  const overrides: Partial<DextConfig> = {};
  for (const key of Object.keys(defaultConfig)) {
    const param = url.searchParams.get(key);
    if (param !== null) {
      // Try to coerce to correct type based on default value
      const defaultValue = defaultConfig[key as keyof DextConfig].value;
      let value: string | number | boolean = param;
      if (typeof defaultValue === "number") {
        value = Number(param);
      } else if (typeof defaultValue === "boolean") {
        value = param === "true";
      }
      overrides[key as keyof DextConfig] = {
        ...defaultConfig[key as keyof DextConfig],
        value,
      };
    }
  }
  return overrides;
};

export const initializeDextConfig = (localStorageKey: string): DextConfig => {
  // Read persistent config from localStorage
  const savedPersistentConfig = localStorage.getItem(localStorageKey);
  // Read ephemeral config from sessionStorage
  const savedEphemeralConfig = sessionStorage.getItem(
    `${localStorageKey}_ephemeral`,
  );

  // Start with default config
  let baseConfig = { ...DEFAULT_DEXT_CONFIG };

  // Apply saved persistent config
  if (savedPersistentConfig) {
    const parsedPersistentConfig = JSON.parse(savedPersistentConfig);
    baseConfig = { ...baseConfig, ...parsedPersistentConfig };
  }

  // Apply saved ephemeral config
  if (savedEphemeralConfig) {
    const parsedEphemeralConfig = JSON.parse(savedEphemeralConfig);
    baseConfig = { ...baseConfig, ...parsedEphemeralConfig };
  }

  // Ensure all config items have the latest labels/descriptions from defaults
  for (const [key, value] of Object.entries(baseConfig)) {
    baseConfig[key as keyof DextConfig] = {
      ...value,
      label: DEFAULT_DEXT_CONFIG[key as keyof DextConfig].label,
      description: DEFAULT_DEXT_CONFIG[key as keyof DextConfig].description,
      is_session_item:
        DEFAULT_DEXT_CONFIG[key as keyof DextConfig].is_session_item,
    };
  }

  // Apply query param overrides
  const overrides = getConfigOverridesFromQueryParams(DEFAULT_DEXT_CONFIG);
  return { ...baseConfig, ...overrides };
};

export const saveDextConfig = (
  localStorageKey: string,
  config: DextConfig,
): void => {
  const persistentConfig: Partial<DextConfig> = {};
  const ephemeralConfig: Partial<DextConfig> = {};

  // Split config based on is_session_item flag
  for (const [key, value] of Object.entries(config)) {
    if (value.is_session_item) {
      ephemeralConfig[key as keyof DextConfig] = value;
    } else {
      persistentConfig[key as keyof DextConfig] = value;
    }
  }

  // Save persistent config to localStorage
  localStorage.setItem(localStorageKey, JSON.stringify(persistentConfig));

  // Save ephemeral config to sessionStorage
  sessionStorage.setItem(
    `${localStorageKey}_ephemeral`,
    JSON.stringify(ephemeralConfig),
  );
};
