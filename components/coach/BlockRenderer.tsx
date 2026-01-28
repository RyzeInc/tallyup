"use client";

import React from "react";
import type { ResponseBlocks } from "@/lib/llm/blockSchema";

export default function BlockRenderer({ blocks }: { blocks: ResponseBlocks }) {
  return (
    <div className="space-y-3">
      {blocks.title && (
        <h2 style={{ fontSize: "var(--text-body)", fontWeight: 700 }}>{blocks.title}</h2>
      )}
      {blocks.blocks.map((b, idx) => {
        switch (b.type) {
          case "heading":
            return (
              <div key={idx}>
                {b.level === 1 ? (
                  <h2 style={{ fontSize: "var(--text-body)", fontWeight: 700 }}>{b.text}</h2>
                ) : (
                  <h3 style={{ fontSize: "var(--text-meta)", fontWeight: 600 }}>{b.text}</h3>
                )}
              </div>
            );
          case "paragraph":
            return (
              <p key={idx} style={{ fontSize: "var(--text-body)", color: "var(--text)" }}>{b.text}</p>
            );
          case "callout":
            return (
              <div key={idx} style={{ borderLeft: "3px solid var(--primary)", padding: "8px 12px", background: "var(--surface)" }}>
                {b.title && <div style={{ fontWeight: 700 }}>{b.title}</div>}
                <div style={{ fontSize: "var(--text-body)" }}>{b.text}</div>
              </div>
            );
          case "unordered_list":
            return (
              <ul key={idx} className="list-disc pl-6 space-y-1">
                {b.items.map((it, i) => (
                  <li key={i}><span style={{ fontWeight: it.title ? 700 : 400 }}>{it.title ? it.title + ': ' : ''}</span>{it.text}</li>
                ))}
              </ul>
            );
          case "ordered_list":
            return (
              <ol key={idx} start={b.start ?? 1} className="list-decimal pl-6 space-y-1">
                {b.items.map((it, i) => (
                  <li key={i}><span style={{ fontWeight: it.title ? 700 : 400 }}>{it.title ? it.title + ': ' : ''}</span>{it.text}</li>
                ))}
              </ol>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
