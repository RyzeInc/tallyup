"use client";

import { TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

import Card, { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/Card";
import { centsToDollars } from "@/components/utils";

// Sample data: timeline (date) with amounts per category (stacked)
const chartData = [
  { date: "2025-06-01", groceries: 12000, transport: 3000, entertainment: 2500 },
  { date: "2025-06-08", groceries: 8000, transport: 2000, entertainment: 1200 },
  { date: "2025-06-15", groceries: 15000, transport: 2500, entertainment: 4000 },
  { date: "2025-06-22", groceries: 6000, transport: 1500, entertainment: 900 },
  { date: "2025-06-29", groceries: 9000, transport: 3200, entertainment: 1800 },
];

export default function ChartBarStacked() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending by Category</CardTitle>
        <CardDescription>Timeline (weeks) — amounts in USD</CardDescription>
      </CardHeader>

      <CardContent>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 12 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.06} />

              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickFormatter={(d: string) => {
                  try {
                    const dt = new Date(d);
                    return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
                  } catch {
                    return d;
                  }
                }}
                style={{ fontSize: 12 }}
              />

              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => {
                  return `$${(v / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
                }}
                style={{ fontSize: 12 }}
              />

              <Tooltip
                formatter={(value: number) => `$${(value / 100).toFixed(2)}`}
                labelFormatter={(label: string) => {
                  try {
                    const dt = new Date(label);
                    return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
                  } catch {
                    return label;
                  }
                }}
              />

              <Legend verticalAlign="top" height={36} />

              <Bar dataKey="groceries" stackId="a" fill="var(--chart-1)" name="Groceries" />
              <Bar dataKey="transport" stackId="a" fill="var(--chart-2)" name="Transport" />
              <Bar dataKey="entertainment" stackId="a" fill="var(--chart-3)" name="Entertainment" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>

      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Trending this month <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-[var(--text-secondary)] leading-none">Amounts shown in USD (cents stored as integers)</div>
      </CardFooter>
    </Card>
  );
}
