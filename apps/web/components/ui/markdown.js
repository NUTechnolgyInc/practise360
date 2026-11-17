import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/cn";

// Element styles live here (no typography plugin) so rendered Markdown uses the same tokens as the kit.
// Each renderer drops react-markdown's `node` prop so it isn't written onto the DOM element.
// react-markdown ignores raw HTML by default, which keeps user-written content from injecting markup.
const COMPONENTS = {
  h1: ({ node, ...p }) => <h2 className="mb-2 mt-5 text-xl font-extrabold text-nu-lapis first:mt-0" {...p} />,
  h2: ({ node, ...p }) => <h3 className="mb-2 mt-4 text-lg font-bold text-nu-lapis first:mt-0" {...p} />,
  h3: ({ node, ...p }) => <h4 className="mb-1 mt-3 text-base font-bold text-nu-navy first:mt-0" {...p} />,
  h4: ({ node, ...p }) => <h5 className="mb-1 mt-3 text-sm font-bold text-nu-navy first:mt-0" {...p} />,
  p: ({ node, ...p }) => <p className="my-2 leading-relaxed" {...p} />,
  a: ({ node, href, ...p }) => <a href={href} target="_blank" rel="noreferrer noopener" className="font-semibold text-nu-purple underline-offset-2 hover:underline" {...p} />,
  ul: ({ node, ...p }) => <ul className="my-2 list-disc space-y-1 pl-5" {...p} />,
  ol: ({ node, ...p }) => <ol className="my-2 list-decimal space-y-1 pl-5" {...p} />,
  blockquote: ({ node, ...p }) => <blockquote className="my-3 border-l-4 border-nu-light-purple bg-purple-50/50 py-1 pl-4 text-nu-muted-teal" {...p} />,
  code: ({ node, className, ...p }) =>
    /language-/.test(className || "") ? <code className={cn("block", className)} {...p} /> : <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[0.85em]" {...p} />,
  pre: ({ node, ...p }) => <pre className="my-3 overflow-x-auto rounded-xl bg-nu-near-white p-4 font-mono text-xs" {...p} />,
  table: ({ node, ...p }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs" {...p} />
    </div>
  ),
  th: ({ node, ...p }) => <th className="border border-gray-200 bg-gray-50 p-2 font-bold" {...p} />,
  td: ({ node, ...p }) => <td className="border border-gray-200 p-2 align-top" {...p} />,
  hr: () => <hr className="my-4 border-gray-200" />,
  img: ({ alt }) => <span className="text-gray-400">[image: {alt || "not shown"}]</span>,
};

/** Renders user-written Markdown (GitHub flavour: tables, task lists, strikethrough). */
export function Markdown({ children, className }) {
  return (
    <div className={cn("min-w-0 break-words text-sm text-nu-dark-teal", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {children || ""}
      </ReactMarkdown>
    </div>
  );
}
