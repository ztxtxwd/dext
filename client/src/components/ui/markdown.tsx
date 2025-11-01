import { marked } from "marked";
import { cn } from "@/lib/utils";

interface MarkdownProps {
  content: string;
  className?: string;
}

const Markdown = ({ content, className }: MarkdownProps) => {
  if (!content) {
    return null;
  }

  const configureMarked = () => {
    marked.setOptions({
      breaks: true,
      gfm: true,
    });
  };

  configureMarked();

  const htmlContent = marked(content);

  return (
    <div
      className={cn(
        "prose prose-sm max-w-none text-sm leading-relaxed",
        "prose-headings:font-semibold prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-code:text-foreground prose-code:before:bg-muted prose-code:after:bg-muted",
        "[&_a]:text-blue-600 [&_a:hover]:text-blue-800 dark:[&_a]:text-blue-400 dark:[&_a:hover]:text-blue-300",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};

export default Markdown;
