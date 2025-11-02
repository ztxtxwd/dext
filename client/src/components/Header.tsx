import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import useTheme from "@/lib/hooks/useTheme";
import { mcpServersApi, MCPServer } from "@/lib/api";
import {
  Search,
  Github,
  Sun,
  Moon,
  Globe,
  Terminal,
  Server,
} from "lucide-react";

const Header = () => {
  const [currentTheme, setTheme] = useTheme();
  const [commandOpen, setCommandOpen] = useState(false);
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch servers when component mounts or when popover opens
  useEffect(() => {
    if (commandOpen && servers.length === 0) {
      fetchServers();
    }
  }, [commandOpen]);

  const fetchServers = async () => {
    setIsLoading(true);
    try {
      const response = await mcpServersApi.getServers({
        enabled: true,
        limit: 20,
      });
      setServers(response.data);
    } catch (error) {
      console.error("Failed to fetch MCP servers:", error);
      // Don't show error in header, just log it
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = () => {
    // Since the API doesn't provide real-time status, we'll show a neutral indicator
    // In a real implementation, you might have a separate endpoint for server status
    return <Server className="h-4 w-4 text-blue-500" />;
  };

  const getFilteredServers = () => {
    if (!searchQuery) return servers.slice(0, 5); // Limit to 5 results in dropdown

    return servers
      .filter(
        (server) =>
          server.server_name
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          server.description
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          server.server_type.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      .slice(0, 5);
  };

  const handleServerSelect = (server: MCPServer) => {
    // Navigate to server details or perform action
    console.log("Selected server:", server);
    setCommandOpen(false);
  };

  const toggleTheme = () => {
    setTheme(currentTheme === "light" ? "dark" : "light");
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto h-14 flex items-center px-6">
        {/* Logo - Left */}
        <div className="flex items-center">
          <a
            className="flex items-center space-x-2 text-black hover:text-black"
            href="/"
          >
            <span className="font-bold text-xl">Dext</span>
          </a>
        </div>

        {/* Spacer - Pushes right content to the right */}
        <div className="flex-1"></div>

        {/* Right side content - Command + Controls */}
        <div className="flex items-center space-x-3">
          {/* Command Palette - Controlled width */}
          <div className="w-64 hidden">
            <Popover open={commandOpen} onOpenChange={setCommandOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={commandOpen}
                  className="relative h-8 w-full justify-start text-sm text-muted-foreground"
                >
                  <Search className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Search...</span>
                  <span className="sm:hidden">...</span>
                  <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                    <span className="text-xs">⌘</span>K
                  </kbd>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search MCP servers..."
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                  />
                  <CommandList>
                    {isLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-gray-900"></div>
                        <span className="ml-2 text-sm text-muted-foreground">
                          Loading servers...
                        </span>
                      </div>
                    ) : (
                      <>
                        <CommandEmpty>
                          {searchQuery
                            ? "No servers found matching your search."
                            : "No MCP servers configured."}
                        </CommandEmpty>

                        {getFilteredServers().length > 0 && (
                          <CommandGroup heading="Available Servers">
                            {getFilteredServers().map((server) => (
                              <CommandItem
                                key={server.id}
                                onSelect={() => handleServerSelect(server)}
                                className="flex items-center justify-between"
                              >
                                <div className="flex items-center flex-1 min-w-0">
                                  {server.server_type === "http" ? (
                                    <Globe className="mr-2 h-4 w-4 text-blue-500 shrink-0" />
                                  ) : (
                                    <Terminal className="mr-2 h-4 w-4 text-green-500 shrink-0" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">
                                      {server.server_name}
                                    </div>
                                    {server.description && (
                                      <div className="text-xs text-muted-foreground truncate">
                                        {server.description}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center ml-2">
                                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground mr-2">
                                    {server.server_type.toUpperCase()}
                                  </span>
                                  {getStatusIcon()}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}

                        <CommandGroup heading="Quick Actions">
                          <CommandItem
                            onSelect={() => {
                              // Directly open dialog without navigation
                              console.log("Opening add server dialog directly");
                              // For now, use a simple approach
                              const addServerButton = document.querySelector(
                                '[data-testid="add-server-button"]',
                              ) as HTMLButtonElement;
                              if (addServerButton) {
                                addServerButton.click();
                              } else {
                                // Fallback to custom event
                                window.dispatchEvent(
                                  new CustomEvent("open-add-server-dialog"),
                                );
                              }
                            }}
                          >
                            <span className="mr-2">➕</span>
                            <span>Add new server</span>
                          </CommandItem>
                          <CommandItem onSelect={() => fetchServers()}>
                            <span className="mr-2">🔄</span>
                            <span>Refresh servers</span>
                          </CommandItem>
                          {servers.length > 5 && (
                            <CommandItem
                              onSelect={() => {
                                // Scroll to servers list
                                document
                                  .querySelector(".container")
                                  ?.scrollIntoView({ behavior: "smooth" });
                              }}
                            >
                              <span className="mr-2">📋</span>
                              <span>View all servers ({servers.length})</span>
                            </CommandItem>
                          )}
                        </CommandGroup>
                      </>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* GitHub Link */}
          <Button variant="ghost" size="sm" asChild>
            <a
              href="https://github.com/ztxtxwd/dext"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <Github className="h-4 w-4" />
              <span className="sr-only">GitHub</span>
            </a>
          </Button>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="text-muted-foreground hover:text-foreground hidden"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
