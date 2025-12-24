"use client";

import React from "react";

export default React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(props, ref) {
  const style = { borderColor: "var(--border)", backgroundColor: "var(--input)", color: "var(--text)" } as const;
  return <textarea ref={ref} {...props} className={["w-full rounded-xl border px-3 py-2 text-sm", props.className ?? ""].join(" ")} style={style} />;
});
