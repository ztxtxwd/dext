interface ReactMarkdownProps {
  children: string;
  className?: string;
  remarkPlugins?: unknown[];
}

const ReactMarkdown = ({ children, className }: ReactMarkdownProps) => {
  return <div className={className}>{children}</div>;
};

export default ReactMarkdown;
