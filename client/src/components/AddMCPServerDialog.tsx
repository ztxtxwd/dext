import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/lib/hooks/useToast";
import {
  mcpServersApi,
  MCPServerCreateRequest,
  MCPServer,
  ApiError,
} from "@/lib/api";
import CustomHeaders from "@/components/CustomHeaders";
import {
  CustomHeaders as CustomHeadersType,
  headersToRecord,
} from "@/lib/types/customHeaders";
import { Plus, ChevronDown, ChevronRight, Eye, EyeOff } from "lucide-react";

interface AddMCPServerDialogProps {
  onServerAdded?: (server: MCPServer) => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const AddMCPServerDialog = ({
  onServerAdded,
  trigger,
  open,
  onOpenChange,
}: AddMCPServerDialogProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(open || false);
  const { toast } = useToast();

  const [newServer, setNewServer] = useState<MCPServerCreateRequest>({
    server_name: "",
    server_type: "http",
    url: "",
    command: "",
    args: [],
    headers: {},
    env: {},
    description: "",
    enabled: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Environment variables state
  const [showEnvVars, setShowEnvVars] = useState(false);
  const [shownEnvVars, setShownEnvVars] = useState<Set<string>>(new Set());

  // Custom headers state
  const [customHeaders, setCustomHeaders] = useState<CustomHeadersType>([]);
  const [showAuthConfig, setShowAuthConfig] = useState(false);

  const handleDialogOpenChange = (newOpen: boolean) => {
    setIsDialogOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  // Environment variables handlers
  const updateEnvVar = useCallback((key: string, value: string) => {
    setNewServer((prev) => ({
      ...prev,
      env: { ...prev.env, [key]: value },
    }));
  }, []);

  const removeEnvVar = useCallback(
    (key: string) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [key]: _removed, ...rest } = newServer.env || {};
      setNewServer((prev) => ({ ...prev, env: rest }));
      setShownEnvVars((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    },
    [newServer.env],
  );

  const addEnvVar = useCallback(() => {
    const key = "";
    setNewServer((prev) => ({
      ...prev,
      env: { ...prev.env, [key]: "" },
    }));
  }, []);

  const toggleEnvVarVisibility = useCallback((key: string) => {
    setShownEnvVars((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleAddServer = async () => {
    if (!newServer.server_name.trim()) {
      toast({
        title: "Error",
        description: "Server name is required.",
        variant: "destructive",
      });
      return;
    }

    if (
      (newServer.server_type === "http" || newServer.server_type === "sse") &&
      !newServer.url?.trim()
    ) {
      toast({
        title: "Error",
        description: `URL is required for ${newServer.server_type.toUpperCase()} servers.`,
        variant: "destructive",
      });
      return;
    }

    if (newServer.server_type === "stdio" && !newServer.command?.trim()) {
      toast({
        title: "Error",
        description: "Command is required for STDIO servers.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const serverData = {
        server_name: newServer.server_name.trim(),
        server_type: newServer.server_type,
        url: newServer.url?.trim() || undefined,
        command: newServer.command?.trim() || undefined,
        args:
          newServer.args && newServer.args.length > 0
            ? newServer.args
            : undefined,
        headers: headersToRecord(customHeaders),
        env:
          newServer.env && Object.keys(newServer.env).length > 0
            ? newServer.env
            : undefined,
        description: newServer.description?.trim() || undefined,
        enabled: newServer.enabled,
      };

      const createdServer = await mcpServersApi.createServer(serverData);

      // Reset form
      setNewServer({
        server_name: "",
        server_type: "http",
        url: "",
        command: "",
        args: [],
        headers: {},
        env: {},
        description: "",
        enabled: true,
      });
      setCustomHeaders([]);
      setShowEnvVars(false);
      setShowAuthConfig(false);
      setShownEnvVars(new Set());

      // Close dialog
      handleDialogOpenChange(false);

      // Call callback
      onServerAdded?.(createdServer);

      // Show success toast
      toast({
        title: "Success",
        description: `${createdServer.server_name} has been added successfully.`,
      });
    } catch (error) {
      console.error("Failed to add server:", error);
      const errorMessage =
        error instanceof ApiError
          ? error.message
          : "Failed to add server. Please try again.";

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const defaultTrigger = (
    <Button>
      <Plus className="mr-2 h-4 w-4" />
      Add Server
    </Button>
  );

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add MCP Server</DialogTitle>
          <DialogDescription>
            Configure a new Model Context Protocol server.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="server-name-input">
              Server Name
            </label>
            <Input
              id="server-name-input"
              value={newServer.server_name}
              onChange={(e) =>
                setNewServer((prev) => ({
                  ...prev,
                  server_name: e.target.value,
                }))
              }
              placeholder="My MCP Server"
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="server-type-select">
              Server Type
            </label>
            <Select
              value={newServer.server_type}
              onValueChange={(value: "http" | "stdio" | "sse") =>
                setNewServer((prev) => ({ ...prev, server_type: value }))
              }
            >
              <SelectTrigger className="w-full" id="server-type-select">
                <SelectValue placeholder="Select server type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="http">HTTP</SelectItem>
                <SelectItem value="sse">SSE</SelectItem>
                <SelectItem value="stdio">STDIO</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {newServer.server_type === "http" ||
          newServer.server_type === "sse" ? (
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="server-url-input">
                URL
              </label>
              <Input
                id="server-url-input"
                value={newServer.url}
                onChange={(e) =>
                  setNewServer((prev) => ({ ...prev, url: e.target.value }))
                }
                placeholder="https://api.example.com/mcp"
                className="font-mono"
              />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="command-input">
                  Command
                </label>
                <Input
                  id="command-input"
                  value={newServer.command}
                  onChange={(e) =>
                    setNewServer((prev) => ({
                      ...prev,
                      command: e.target.value,
                    }))
                  }
                  placeholder="./mcp-server"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="args-input">
                  Arguments
                </label>
                <Input
                  id="args-input"
                  placeholder="Arguments (space-separated)"
                  value={newServer.args?.join(" ") || ""}
                  onChange={(e) => {
                    const argsText = e.target.value;
                    if (!argsText) {
                      setNewServer((prev) => ({ ...prev, args: [] }));
                      return;
                    }

                    // Split by spaces, but keep empty strings if the input ends with space
                    const parts = argsText.split(/\s+/);
                    const args = parts.filter((arg) => arg.length > 0);

                    // If the original text ends with a space, add an empty string argument
                    if (argsText.endsWith(" ") && parts.length > 0) {
                      args.push("");
                    }

                    setNewServer((prev) => ({ ...prev, args }));
                  }}
                  className="font-mono"
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="description-input">
              Description
            </label>
            <Textarea
              id="description-input"
              value={newServer.description}
              onChange={(e) =>
                setNewServer((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Optional description of the server"
              rows={2}
              className="font-mono"
            />
          </div>

          {/* Environment Variables Section - only for STDIO */}
          {newServer.server_type === "stdio" && (
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={() => setShowEnvVars(!showEnvVars)}
                className="flex items-center w-full"
                aria-expanded={showEnvVars}
              >
                {showEnvVars ? (
                  <ChevronDown className="w-4 h-4 mr-2" />
                ) : (
                  <ChevronRight className="w-4 h-4 mr-2" />
                )}
                Environment Variables
              </Button>
              {showEnvVars && (
                <div className="space-y-2">
                  {Object.entries(newServer.env || {}).map(
                    ([key, value], idx) => (
                      <div key={idx} className="space-y-2 pb-4">
                        <div className="flex gap-2">
                          <Input
                            aria-label={`Environment variable key ${idx + 1}`}
                            placeholder="Key"
                            value={key}
                            onChange={(e) => {
                              const newKey = e.target.value;
                              const newEnv = Object.entries(
                                newServer.env || {},
                              ).reduce(
                                (acc, [k, v]) => {
                                  if (k === key) {
                                    acc[newKey] = value;
                                  } else {
                                    acc[k] = v;
                                  }
                                  return acc;
                                },
                                {} as Record<string, string>,
                              );
                              setNewServer((prev) => ({
                                ...prev,
                                env: newEnv,
                              }));
                              setShownEnvVars((prev) => {
                                const next = new Set(prev);
                                if (next.has(key)) {
                                  next.delete(key);
                                  next.add(newKey);
                                }
                                return next;
                              });
                            }}
                            className="font-mono"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-9 w-9 p-0 shrink-0"
                            onClick={() => removeEnvVar(key)}
                          >
                            ×
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <Input
                            aria-label={`Environment variable value ${idx + 1}`}
                            type={shownEnvVars.has(key) ? "text" : "password"}
                            placeholder="Value"
                            value={value}
                            onChange={(e) => updateEnvVar(key, e.target.value)}
                            className="font-mono"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 p-0 shrink-0"
                            onClick={() => toggleEnvVarVisibility(key)}
                            aria-label={
                              shownEnvVars.has(key)
                                ? "Hide value"
                                : "Show value"
                            }
                            aria-pressed={shownEnvVars.has(key)}
                            title={
                              shownEnvVars.has(key)
                                ? "Hide value"
                                : "Show value"
                            }
                          >
                            {shownEnvVars.has(key) ? (
                              <Eye className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <EyeOff className="h-4 w-4" aria-hidden="true" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ),
                  )}
                  <Button
                    variant="outline"
                    className="w-full mt-2"
                    onClick={addEnvVar}
                  >
                    Add Environment Variable
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Authentication Section - only for HTTP and SSE */}
          {(newServer.server_type === "http" ||
            newServer.server_type === "sse") && (
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={() => setShowAuthConfig(!showAuthConfig)}
                className="flex items-center w-full"
                aria-expanded={showAuthConfig}
              >
                {showAuthConfig ? (
                  <ChevronDown className="w-4 h-4 mr-2" />
                ) : (
                  <ChevronRight className="w-4 h-4 mr-2" />
                )}
                Authentication
              </Button>
              {showAuthConfig && (
                <div className="p-3 rounded border overflow-hidden">
                  <CustomHeaders
                    headers={customHeaders}
                    onChange={setCustomHeaders}
                  />
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end space-x-2">
          <Button
            variant="outline"
            onClick={() => handleDialogOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleAddServer} disabled={isSubmitting}>
            {isSubmitting ? "Adding..." : "Add Server"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddMCPServerDialog;
