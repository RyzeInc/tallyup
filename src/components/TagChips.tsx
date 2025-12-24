"use client";

export default function TagChips({
  value,
  onChange,
  options,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  options: string[];
}) {
  function toggle(tag: string) {
    const has = value.some((t) => t.toLowerCase() === tag.toLowerCase());
    if (has) onChange(value.filter((t) => t.toLowerCase() !== tag.toLowerCase()));
    else onChange([tag, ...value]);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((tag) => {
        const active = value.some((t) => t.toLowerCase() === tag.toLowerCase());
        return (
          <button
            type="button"
            key={tag}
            onClick={() => toggle(tag)}
            className={[
              "rounded-full px-3 py-1 text-xs border",
              active
                ? "bg-neutral-900/40 text-neutral-200 border-neutral-800"
                : "bg-neutral-900/40 text-neutral-200 border-neutral-800 hover:border-neutral-600",
            ].join(" ")}
            style={active ? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)", borderColor: "var(--primary)" } : undefined}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}
