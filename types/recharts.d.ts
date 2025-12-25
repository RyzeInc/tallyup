// Minimal declaration for the subset of Recharts used in this repo.
// Install `recharts` for full types; this file avoids TypeScript errors until then.

declare module "recharts" {
  import type { ComponentType } from "react";

  export const ResponsiveContainer: ComponentType<any>;
  export const BarChart: ComponentType<any>;
  export const Bar: ComponentType<any>;
  export const XAxis: ComponentType<any>;
  export const YAxis: ComponentType<any>;
  export const Tooltip: ComponentType<any>;
  export const Legend: ComponentType<any>;
  export const CartesianGrid: ComponentType<any>;

  // fallback
  const _default: any;
  export default _default;
}
