import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/lib/hooks/useToast";
import { mcpServersApi, MCPServer, ApiError } from "@/lib/api";
import AddMCPServerDialog from "@/components/AddMCPServerDialog";
import ToolListDialog from "@/components/ToolListDialog";
import {
  Server,
  Trash2,
  Plus,
  RefreshCw,
  Globe,
  Terminal,
  CheckCircle,
  XCircle,
  AlertCircle,
  Wrench,
} from "lucide-react";

const MCPServersList = () => {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const { toast } = useToast();

  const fetchServers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await mcpServersApi.getServers({ include_tools: true });
      console.log("Fetched servers:", response.data);
      // Check for servers with undefined server_type
      const problematicServers = response.data.filter((s) => !s.server_type);
      if (problematicServers.length > 0) {
        console.warn("Servers with undefined server_type:", problematicServers);
      }
      setServers(response.data);
    } catch (error) {
      console.error("Failed to fetch MCP servers:", error);
      const errorMessage =
        error instanceof ApiError
          ? error.message
          : "Failed to fetch servers. Please try again.";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Fetch servers on component mount
  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  // Listen for custom event to open Add Server dialog
  useEffect(() => {
    const handleOpenDialog = (event: Event) => {
      console.log("open-add-server-dialog event received", event);
      event.preventDefault();
      event.stopPropagation();
      setShowAddDialog(true);
    };

    window.addEventListener("open-add-server-dialog", handleOpenDialog);

    return () => {
      window.removeEventListener("open-add-server-dialog", handleOpenDialog);
    };
  }, []);

  const handleServerAdded = (newServer: MCPServer) => {
    // Add the new server to the current list immediately for instant feedback
    setServers((prev) => [...prev, newServer]);
    setShowAddDialog(false);

    // Refresh the servers list to get the most up-to-date data from the server
    fetchServers();
  };

  const getStatusIcon = (enabled: boolean) => {
    return enabled ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-gray-400" />
    );
  };

  const getStatusBadge = (enabled: boolean) => {
    return (
      <Badge variant={enabled ? "default" : "secondary"}>
        {enabled ? "Enabled" : "Disabled"}
      </Badge>
    );
  };

  const handleToggleServer = async (serverId: number, enabled: boolean) => {
    try {
      const updatedServer = await mcpServersApi.updateServer(serverId, {
        enabled,
      });
      setServers((prev) =>
        prev.map((server) => (server.id === serverId ? updatedServer : server)),
      );

      toast({
        title: "Success",
        description: `${updatedServer.server_name} has been ${enabled ? "enabled" : "disabled"}.`,
      });
    } catch (error) {
      console.error("Failed to toggle server:", error);
      const errorMessage =
        error instanceof ApiError
          ? error.message
          : "Failed to update server status.";

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });

      // Revert the change locally
      setServers((prev) =>
        prev.map((server) =>
          server.id === serverId ? { ...server, enabled: !enabled } : server,
        ),
      );
    }
  };

  const handleRefresh = async () => {
    await fetchServers();
    toast({
      title: "Success",
      description: "Server list has been updated.",
    });
  };

  const handleDeleteServer = async (serverId: number) => {
    const server = servers.find((s) => s.id === serverId);
    if (!server) return;

    try {
      await mcpServersApi.deleteServer(serverId);
      setServers((prev) => prev.filter((s) => s.id !== serverId));

      toast({
        title: "Success",
        description: `${server.server_name} has been removed.`,
      });
    } catch (error) {
      console.error("Failed to delete server:", error);
      const errorMessage =
        error instanceof ApiError
          ? error.message
          : "Failed to delete server. Please try again.";

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  if (isLoading && servers.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900 mx-auto mb-4"></div>
            <h2 className="text-lg font-semibold">Loading MCP Servers...</h2>
            <p className="text-muted-foreground">
              Please wait while we fetch your servers.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">MCP Servers</h1>
          <p className="text-muted-foreground">
            Manage and monitor your Model Context Protocol servers
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")}
            />
            Refresh
          </Button>
          <AddMCPServerDialog
            open={showAddDialog}
            onOpenChange={setShowAddDialog}
            onServerAdded={handleServerAdded}
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchServers}
              className="ml-4"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Server List */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {servers.map((server) => (
          <Card
            key={server.id}
            className={cn(
              !server.enabled && "opacity-50",
              "h-full flex flex-col",
            )}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    {server.server_type === "http" ||
                    server.server_type === "sse" ? (
                      <Globe className="h-5 w-5 text-blue-500" />
                    ) : (
                      <Terminal className="h-5 w-5 text-green-500" />
                    )}
                    <CardTitle className="text-lg">
                      {server.server_name}
                    </CardTitle>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(server.enabled)}
                    {getStatusBadge(server.enabled)}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={server.enabled}
                    onCheckedChange={(checked) =>
                      handleToggleServer(server.id, checked)
                    }
                  />
                  {/* <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button> */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteServer(server.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col h-full">
              <div className="flex-1">
                {server.description && (
                  <CardDescription className="mb-3">
                    {server.description}
                  </CardDescription>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-auto pt-3">
                <div className="flex items-center space-x-1">
                  <Badge variant="outline" className="text-xs">
                    {server.server_type?.toUpperCase() || "UNKNOWN"}
                  </Badge>
                </div>

                {/* Tool count display */}
                {server.tools && (
                  <ToolListDialog
                    serverName={server.server_name}
                    tools={server.tools}
                  >
                    <div className="flex items-center space-x-1 hover:text-foreground cursor-pointer transition-colors">
                      <Wrench className="h-3 w-3" />
                      <span className="text-xs underline">
                        {server.tools.length} tool
                        {server.tools.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </ToolListDialog>
                )}

                {server.server_type === "http" ||
                server.server_type === "sse" ? (
                  <div className="flex items-center space-x-1 min-w-0 flex-1">
                    <Globe className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{server.url}</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1 min-w-0 flex-1">
                    <Terminal className="h-3 w-3 flex-shrink-0" />
                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded truncate">
                      {server.command}
                      {server.args && server.args.length > 0 && (
                        <>
                          {" "}
                          {Array.isArray(server.args)
                            ? server.args.join(" ")
                            : JSON.stringify(server.args)}
                        </>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {servers.length === 0 && (
        <Card className="p-8 text-center">
          <Server className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            No MCP servers configured
          </h3>
          <p className="text-muted-foreground mb-4">
            Get started by adding your first Model Context Protocol server.
          </p>
          <AddMCPServerDialog
            trigger={
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Server
              </Button>
            }
            open={showAddDialog}
            onOpenChange={setShowAddDialog}
            onServerAdded={handleServerAdded}
          />
        </Card>
      )}
    </div>
  );
};

export default MCPServersList;
