import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ToolInfo } from "@/lib/api";
import { useToast } from "@/lib/hooks/useToast";
import Markdown from "@/components/ui/markdown";
import { Wrench, Info, Copy } from "lucide-react";

interface ToolListDialogProps {
  serverName: string;
  tools: ToolInfo[];
  children: React.ReactNode;
}

// Copy icon component
const CopyIcon = () => (
  <Copy
    className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity"
    aria-label="Copy to clipboard"
  />
);

const ToolListDialog = ({ serverName, tools, children }: ToolListDialogProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            {serverName} Tools
          </DialogTitle>
          <DialogDescription>
            This server provides {tools.length} tool{tools.length !== 1 ? 's' : ''}.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-3">
            {tools.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No tools available for this server.</p>
              </div>
            ) : (
              tools.map((tool) => (
                <ToolHoverCard key={tool.tool_md5} tool={tool} />
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

// ToolHoverCard component for showing tool descriptions
interface ToolHoverCardProps {
  tool: ToolInfo;
}

const ToolHoverCard = ({ tool }: ToolHoverCardProps) => {
  const { toast } = useToast();

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Show success toast notification
      toast({
        title: "Copied!",
        description: "Tool ID copied to clipboard",
        duration: 2000,
      });
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Show error toast notification
      toast({
        title: "Copy Failed",
        description: "Failed to copy Tool ID to clipboard",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Badge
                  variant="secondary"
                  className="text-xs truncate block"
                  title={tool.display_name.length > 15 ? tool.display_name : undefined}
                >
                  {tool.display_name}
                </Badge>
                {tool.description && (
                  <Info className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                )}
              </div>
            </div>
          </div>
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        className="w-fit max-w-xs z-50"
        side="top"
        align="center"
        sideOffset={8}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4
              className="font-semibold text-sm truncate pr-2"
              title={tool.display_name.length > 20 ? tool.display_name : undefined}
            >
              {tool.display_name}
            </h4>
            <Badge variant="outline" className="text-xs flex-shrink-0">
              Tool
            </Badge>
          </div>

          {tool.description ? (
            <div className="relative">
              <div className="w-full max-w-72 max-h-24 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400">
                <Markdown
                  content={tool.description}
                  className="prose-p:text-muted-foreground prose-strong:text-foreground prose-em:text-foreground prose-code:text-xs prose-pre:text-xs prose-p:break-words pb-4"
                />
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none -mb-px"></div>
            </div>
          ) : (
            <div className="w-full max-w-72 flex items-center min-h-24">
              <p className="text-sm text-muted-foreground italic">
                No description available
              </p>
            </div>
          )}

          <div className="space-y-2 pt-3 border-t text-xs">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="font-medium text-xs">Tool ID</span>
                <button
                  onClick={() => copyToClipboard(tool.tool_md5)}
                  className="bg-muted hover:bg-muted/80 transition-colors px-1.5 py-0.5 rounded text-xs font-mono cursor-pointer flex items-center gap-1 group"
                  title="Click to copy full ID"
                >
                  <span>{tool.tool_md5.substring(0, 12)}...</span>
                  <CopyIcon />
                </button>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="font-medium text-xs">Added</span>
                <span className="text-xs">{new Date(tool.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}</span>
              </div>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export default ToolListDialog;