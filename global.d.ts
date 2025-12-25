// Global minimal module declaration to silence TypeScript for lucide-react
declare module "lucide-react" {
  const content: any;
  export default content;
}

// Minimal global declaration for recharts when types are not installed.
declare module "recharts" {
  const content: any;
  export const ResponsiveContainer: any;
  export const BarChart: any;
  export const Bar: any;
  export const XAxis: any;
  export const YAxis: any;
  export const Tooltip: any;
  export const Legend: any;
  export const CartesianGrid: any;
  export default content;
}
