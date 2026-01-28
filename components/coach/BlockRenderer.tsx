"use client";

import React, { useMemo } from "react";
import type { Block, BlockResponse, ListItem } from "@/lib/llm/blocks";

/**
 * BlockRenderer - Renders structured block responses from the coach.
 * 
 * This component handles the block-based JSON format, providing:
 * - Type-safe rendering for each block type
 * - Consistent styling with the coach design system
 * - Support for ordered list continuation (start number)
 * - Inline markdown in text (bold, italic, links)
 */

/**
 * Parse simple inline markdown (bold, italic, links) in text.
 * Returns React nodes.
 */
function parseInlineMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let key = 0;

  // Pattern to match **bold**, *italic*, or [link](url)
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;

  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = pattern.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const matched = match[0];
    
    if (matched.startsWith("**") && matched.endsWith("**")) {
      // Bold
      nodes.push(
        <strong key={key++} style={{ fontWeight: 600 }}>
          {matched.slice(2, -2)}
        </strong>
      );
    } else if (matched.startsWith("*") && matched.endsWith("*")) {
      // Italic
      nodes.push(
        <em key={key++} style={{ fontStyle: "italic" }}>
          {matched.slice(1, -1)}
        </em>
      );
    } else if (matched.startsWith("[")) {
      // Link
      const linkMatch = matched.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        nodes.push(
          <a
            key={key++}
            href={linkMatch[2]}
            className="underline"
            style={{ color: "var(--primary)" }}
            target="_blank"
            rel="noopener noreferrer"
          >
            {linkMatch[1]}
          </a>
        );
      }
    }

    lastIndex = match.index + matched.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

/**
 * Render a heading block
 */
function HeadingBlock({ level, text }: { level: 1 | 2 | 3; text: string }) {
  const styles: Record<1 | 2 | 3, React.CSSProperties> = {
    1: { fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.75rem" },
    2: { fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.5rem" },
    3: { fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem" },
  };

  const Tag = `h${level}` as const;

  return (
    <Tag style={{ ...styles[level], color: "var(--text)" }}>
      {parseInlineMarkdown(text)}
    </Tag>
  );
}

/**
 * Render a paragraph block
 */
function ParagraphBlock({ text }: { text: string }) {
  return (
    <p 
      className="mb-3 last:mb-0"
      style={{ fontSize: "var(--text-body)", lineHeight: 1.6, color: "var(--text)" }}
    >
      {parseInlineMarkdown(text)}
    </p>
  );
}

/**
 * Render a callout block
 */
function CalloutBlock({ 
  tone, 
  title, 
  text 
}: { 
  tone: "tip" | "warning" | "note"; 
  title?: string;
  text: string;
}) {
  const toneStyles: Record<"tip" | "warning" | "note", { bg: string; border: string; icon: string }> = {
    tip: { 
      bg: "rgba(34, 197, 94, 0.1)", 
      border: "rgba(34, 197, 94, 0.3)",
      icon: "💡"
    },
    warning: { 
      bg: "rgba(234, 179, 8, 0.1)", 
      border: "rgba(234, 179, 8, 0.3)",
      icon: "⚠️"
    },
    note: { 
      bg: "rgba(59, 130, 246, 0.1)", 
      border: "rgba(59, 130, 246, 0.3)",
      icon: "📝"
    },
  };

  const style = toneStyles[tone];

  return (
    <div 
      className="rounded-lg px-4 py-3 mb-3 last:mb-0"
      style={{ 
        backgroundColor: style.bg, 
        border: `1px solid ${style.border}`,
      }}
    >
      {title && (
        <div 
          className="font-medium mb-1"
          style={{ fontSize: "var(--text-body)", color: "var(--text)" }}
        >
          {style.icon} {title}
        </div>
      )}
      <div style={{ fontSize: "var(--text-body)", color: "var(--text)" }}>
        {!title && <span className="mr-1">{style.icon}</span>}
        {parseInlineMarkdown(text)}
      </div>
    </div>
  );
}

/**
 * Render a list item with optional sub-items
 */
function ListItemRenderer({ item }: { item: ListItem }) {
  return (
    <>
      <span>{parseInlineMarkdown(item.text)}</span>
      {item.subItems && item.subItems.length > 0 && (
        <ul className="list-disc pl-5 mt-1 space-y-0.5">
          {item.subItems.map((subItem, idx) => (
            <li 
              key={idx} 
              style={{ fontSize: "var(--text-body)", color: "var(--text)" }}
            >
              {parseInlineMarkdown(subItem)}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * Render an unordered list block
 */
function UnorderedListBlock({ items }: { items: ListItem[] }) {
  return (
    <ul 
      className="list-disc pl-5 mb-3 last:mb-0 space-y-1.5"
      style={{ color: "var(--text)" }}
    >
      {items.map((item, idx) => (
        <li 
          key={idx} 
          className="pl-1" 
          style={{ fontSize: "var(--text-body)" }}
        >
          <ListItemRenderer item={item} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Render an ordered list block
 */
function OrderedListBlock({ 
  items, 
  start = 1 
}: { 
  items: ListItem[]; 
  start?: number;
}) {
  return (
    <ol 
      className="list-decimal pl-5 mb-3 last:mb-0 space-y-1.5"
      style={{ color: "var(--text)" }}
      start={start}
    >
      {items.map((item, idx) => (
        <li 
          key={idx} 
          className="pl-1" 
          style={{ fontSize: "var(--text-body)" }}
        >
          <ListItemRenderer item={item} />
        </li>
      ))}
    </ol>
  );
}

/**
 * Render a single block
 */
function renderBlock(block: Block, key: number): React.ReactNode {
  switch (block.type) {
    case "heading":
      return <HeadingBlock key={key} level={block.level} text={block.text} />;
    case "paragraph":
      return <ParagraphBlock key={key} text={block.text} />;
    case "callout":
      return <CalloutBlock key={key} tone={block.tone} title={block.title} text={block.text} />;
    case "unordered_list":
      return <UnorderedListBlock key={key} items={block.items} />;
    case "ordered_list":
      return <OrderedListBlock key={key} items={block.items} start={block.start} />;
    default:
      // TypeScript exhaustive check - variable unused intentionally
      block satisfies never;
      return null;
  }
}

interface BlockRendererProps {
  /** The blocks to render */
  blocks: Block[];
  /** Optional className for the container */
  className?: string;
}

/**
 * Main BlockRenderer component
 */
export default function BlockRenderer({ blocks, className = "" }: BlockRendererProps) {
  const renderedBlocks = useMemo(() => {
    return blocks.map((block, idx) => renderBlock(block, idx));
  }, [blocks]);

  return (
    <div className={`block-renderer ${className}`}>
      {renderedBlocks}
    </div>
  );
}

/**
 * Convenience wrapper that takes a full BlockResponse
 */
export function BlockResponseRenderer({ 
  response, 
  className = "" 
}: { 
  response: BlockResponse; 
  className?: string;
}) {
  return (
    <div className={className}>
      {response.title && (
        <HeadingBlock level={1} text={response.title} />
      )}
      <BlockRenderer blocks={response.blocks} />
    </div>
  );
}
