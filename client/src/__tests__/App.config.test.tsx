import { render, waitFor } from "@testing-library/react";
import App from "../App";
import { DEFAULT_DEXT_CONFIG } from "../lib/constants";
import { DextConfig } from "../lib/configurationTypes";
import * as configUtils from "../utils/configUtils";

// Mock auth dependencies first
jest.mock("@modelcontextprotocol/sdk/client/auth.js", () => ({
  auth: jest.fn(),
}));

jest.mock("../lib/oauth-state-machine", () => ({
  OAuthStateMachine: jest.fn(),
}));

jest.mock("../lib/auth", () => ({
  DextOAuthClientProvider: jest.fn().mockImplementation(() => ({
    tokens: jest.fn().mockResolvedValue(null),
    clear: jest.fn(),
  })),
  DebugDextOAuthClientProvider: jest.fn(),
}));

// Mock the config utils
jest.mock("../utils/configUtils", () => ({
  ...jest.requireActual("../utils/configUtils"),
  getMCPProxyAddress: jest.fn(() => "http://localhost:6277"),
  getMCPProxyAuthToken: jest.fn((config: DextConfig) => ({
    token: config.MCP_PROXY_AUTH_TOKEN.value,
    header: "X-MCP-Proxy-Auth",
  })),
  getInitialTransportType: jest.fn(() => "stdio"),
  getInitialSseUrl: jest.fn(() => "http://localhost:3001/sse"),
  getInitialCommand: jest.fn(() => "mcp-server-everything"),
  getInitialArgs: jest.fn(() => ""),
  initializeDextConfig: jest.fn(() => DEFAULT_DEXT_CONFIG),
  saveDextConfig: jest.fn(),
}));

// Get references to the mocked functions
const mockGetMCPProxyAuthToken = configUtils.getMCPProxyAuthToken as jest.Mock;
const mockInitializeDextConfig = configUtils.initializeDextConfig as jest.Mock;

// Mock other dependencies
jest.mock("../lib/hooks/useConnection", () => ({
  useConnection: () => ({
    connectionStatus: "disconnected",
    serverCapabilities: null,
    mcpClient: null,
    requestHistory: [],
    clearRequestHistory: jest.fn(),
    makeRequest: jest.fn(),
    sendNotification: jest.fn(),
    handleCompletion: jest.fn(),
    completionsSupported: false,
    connect: jest.fn(),
    disconnect: jest.fn(),
  }),
}));

jest.mock("../lib/hooks/useDraggablePane", () => ({
  useDraggablePane: () => ({
    height: 300,
    handleDragStart: jest.fn(),
  }),
  useDraggableSidebar: () => ({
    width: 320,
    isDragging: false,
    handleDragStart: jest.fn(),
  }),
}));

jest.mock("../components/Sidebar", () => ({
  __esModule: true,
  default: () => <div>Sidebar</div>,
}));

// Mock fetch
global.fetch = jest.fn();

describe("App - Config Endpoint", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () =>
        Promise.resolve({
          defaultEnvironment: { TEST_ENV: "test" },
          defaultCommand: "test-command",
          defaultArgs: "test-args",
        }),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();

    // Reset getMCPProxyAuthToken to default behavior
    mockGetMCPProxyAuthToken.mockImplementation((config: DextConfig) => ({
      token: config.MCP_PROXY_AUTH_TOKEN.value,
      header: "X-MCP-Proxy-Auth",
    }));
  });

  test("sends X-MCP-Proxy-Auth header when fetching config with proxy auth token", async () => {
    const mockConfig = {
      ...DEFAULT_DEXT_CONFIG,
      MCP_PROXY_AUTH_TOKEN: {
        ...DEFAULT_DEXT_CONFIG.MCP_PROXY_AUTH_TOKEN,
        value: "test-proxy-token",
      },
    };

    // Mock initializeDextConfig to return our test config
    mockInitializeDextConfig.mockReturnValue(mockConfig);

    render(<App />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:6277/config",
        {
          headers: {
            "X-MCP-Proxy-Auth": "Bearer test-proxy-token",
          },
        },
      );
    });
  });

  test("does not send auth header when proxy auth token is empty", async () => {
    const mockConfig = {
      ...DEFAULT_DEXT_CONFIG,
      MCP_PROXY_AUTH_TOKEN: {
        ...DEFAULT_DEXT_CONFIG.MCP_PROXY_AUTH_TOKEN,
        value: "",
      },
    };

    // Mock initializeDextConfig to return our test config
    mockInitializeDextConfig.mockReturnValue(mockConfig);

    render(<App />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:6277/config",
        {
          headers: {},
        },
      );
    });
  });

  test("uses custom header name if getMCPProxyAuthToken returns different header", async () => {
    const mockConfig = {
      ...DEFAULT_DEXT_CONFIG,
      MCP_PROXY_AUTH_TOKEN: {
        ...DEFAULT_DEXT_CONFIG.MCP_PROXY_AUTH_TOKEN,
        value: "test-proxy-token",
      },
    };

    // Mock to return a custom header name
    mockGetMCPProxyAuthToken.mockReturnValue({
      token: "test-proxy-token",
      header: "X-Custom-Auth",
    });
    mockInitializeDextConfig.mockReturnValue(mockConfig);

    render(<App />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:6277/config",
        {
          headers: {
            "X-Custom-Auth": "Bearer test-proxy-token",
          },
        },
      );
    });
  });

  test("config endpoint response updates app state", async () => {
    const mockConfig = {
      ...DEFAULT_DEXT_CONFIG,
      MCP_PROXY_AUTH_TOKEN: {
        ...DEFAULT_DEXT_CONFIG.MCP_PROXY_AUTH_TOKEN,
        value: "test-proxy-token",
      },
    };

    mockInitializeDextConfig.mockReturnValue(mockConfig);

    render(<App />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // Verify the fetch was called with correct parameters
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:6277/config",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-MCP-Proxy-Auth": "Bearer test-proxy-token",
        }),
      }),
    );
  });

  test("handles config endpoint errors gracefully", async () => {
    const mockConfig = {
      ...DEFAULT_DEXT_CONFIG,
      MCP_PROXY_AUTH_TOKEN: {
        ...DEFAULT_DEXT_CONFIG.MCP_PROXY_AUTH_TOKEN,
        value: "test-proxy-token",
      },
    };

    mockInitializeDextConfig.mockReturnValue(mockConfig);

    // Mock fetch to reject
    (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

    // Spy on console.error
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    render(<App />);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error fetching default environment:",
        expect.any(Error),
      );
    });

    consoleErrorSpy.mockRestore();
  });
});
