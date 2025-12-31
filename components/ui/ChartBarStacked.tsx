"use client";

import * as Lucide from "lucide-react";
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

// Sample data: timeline (date) with INCOME amounts per category (stacked)
const chartData = [
  { date: "2025-06-01", salary: 450000, freelance: 85000, dividends: 15000 },
  { date: "2025-06-08", salary: 0, freelance: 120000, dividends: 0 },
  { date: "2025-06-15", salary: 450000, freelance: 45000, dividends: 25000 },
  { date: "2025-06-22", salary: 0, freelance: 95000, dividends: 0 },
  { date: "2025-06-29", salary: 0, freelance: 60000, dividends: 12000 },
];

export default function ChartBarStacked() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Income by Source</CardTitle>
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

              <Bar dataKey="salary" stackId="a" fill="var(--chart-1)" name="Salary" />
              <Bar dataKey="freelance" stackId="a" fill="var(--chart-2)" name="Freelance" />
              <Bar dataKey="dividends" stackId="a" fill="var(--chart-3)" name="Dividends" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>

      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Income trends <Lucide.TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-[var(--text-secondary)] leading-none">Amounts shown in USD (cents stored as integers)</div>
      </CardFooter>
    </Card>
  );
}
