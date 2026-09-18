"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

// Tabel markdown yang rapi (dipindahkan dari halaman ScorpioAI lama):
// rounded container, header gradient, zebra stripes, hover effect.
const defaultComponents = {
  table: ({ children, ...props }: any) => (
    <div className="my-4 w-full overflow-x-auto rounded-2xl border border-slate-200/80 shadow-sm dark:border-slate-700/60">
      <table className="w-full border-collapse text-sm" {...props}>{children}</table>
    </div>
  ),
  thead: ({ children, ...props }: any) => (
    <thead className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 dark:border-slate-700 dark:from-blue-900/40 dark:to-indigo-900/30" {...props}>{children}</thead>
  ),
  th: ({ children, ...props }: any) => (
    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300" {...props}>{children}</th>
  ),
  td: ({ children, ...props }: any) => (
    <td className="border-t border-slate-100 px-4 py-3 text-sm text-slate-700 dark:border-slate-800/60 dark:text-slate-300" {...props}>{children}</td>
  ),
  tr: ({ children, ...props }: any) => (
    <tr className="transition-colors even:bg-blue-50/30 hover:bg-blue-50/60 dark:even:bg-blue-900/10 dark:hover:bg-blue-900/20" {...props}>{children}</tr>
  ),
};

const kidsComponents = {
  table: ({ children, ...props }: any) => (
    <div className="my-4 w-full overflow-x-auto rounded-2xl border-2 border-orange-200 shadow-md shadow-orange-100">
      <table className="w-full border-collapse text-sm" {...props}>{children}</table>
    </div>
  ),
  thead: ({ children, ...props }: any) => (
    <thead className="border-b-2 border-orange-200 bg-gradient-to-r from-orange-100 to-yellow-50" {...props}>{children}</thead>
  ),
  th: ({ children, ...props }: any) => (
    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-orange-700" {...props}>{children}</th>
  ),
  td: ({ children, ...props }: any) => (
    <td className="border-t border-orange-100 px-4 py-3 text-sm font-medium text-slate-700" {...props}>{children}</td>
  ),
  tr: ({ children, ...props }: any) => (
    <tr className="transition-colors even:bg-orange-50/50 hover:bg-orange-50/80" {...props}>{children}</tr>
  ),
};

const defaultProse = `prose prose-sm md:prose-base dark:prose-invert max-w-none
  prose-p:leading-relaxed prose-p:my-2
  prose-headings:font-bold prose-headings:tracking-tight
  prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
  prose-strong:font-bold
  prose-a:text-edu-blue dark:prose-a:text-sky-300 prose-a:no-underline hover:prose-a:underline
  prose-ul:list-disc prose-ul:my-2 prose-ol:list-decimal prose-ol:my-2 prose-li:my-0.5 prose-li:marker:text-edu-blue
  prose-blockquote:border-l-4 prose-blockquote:border-edu-blue prose-blockquote:bg-blue-50/50 dark:prose-blockquote:bg-white/5 prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:rounded-r-xl prose-blockquote:not-italic
  prose-code:text-edu-blue dark:prose-code:text-sky-300 prose-code:bg-blue-50/80 dark:prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:font-semibold prose-code:before:content-none prose-code:after:content-none
  prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-xl`;

const kidsProse = `prose prose-sm sm:prose-base max-w-none
  prose-p:leading-relaxed prose-p:font-medium prose-p:my-2
  prose-headings:text-kids-coral prose-headings:font-black
  prose-strong:text-kids-coral prose-strong:font-black
  prose-a:text-edu-blue prose-a:font-bold
  prose-ul:list-disc prose-ol:list-decimal prose-li:marker:text-kids-coral
  prose-code:text-kids-coral prose-code:bg-kids-cream prose-code:px-2 prose-code:py-0.5 prose-code:rounded-lg prose-code:before:content-none prose-code:after:content-none
  prose-pre:bg-slate-800 prose-pre:text-slate-100 prose-pre:rounded-2xl`;

export function AiMarkdown({ children, variant = "default" }: { children: string; variant?: "default" | "kids" }) {
  const kids = variant === "kids";
  return (
    <div className={kids ? kidsProse : defaultProse}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={kids ? kidsComponents : defaultComponents}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
