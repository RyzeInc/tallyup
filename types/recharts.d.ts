// Minimal declaration for the subset of Recharts used in this repo.
// Install `recharts` for full types; this file avoids TypeScript errors until then.

declare module "recharts" {
  import type { ComponentType } from "react";

  type Props = Record<string, unknown>;

  export const ResponsiveContainer: ComponentType<Props>;
  export const BarChart: ComponentType<Props>;
  export const Bar: ComponentType<Props>;
  export const LineChart: ComponentType<Props>;
  export const Line: ComponentType<Props>;
  export const PieChart: ComponentType<Props>;
  export const Pie: ComponentType<Props>;
  export const Cell: ComponentType<Props>;
  export const XAxis: ComponentType<Props>;
  export const YAxis: ComponentType<Props>;
  export const Tooltip: ComponentType<Props>;
  export const Legend: ComponentType<Props>;
  export const CartesianGrid: ComponentType<Props>;

  const _default: Record<string, ComponentType<Props>>;
  export default _default;
}
