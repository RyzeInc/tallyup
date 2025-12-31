"use client";

import GlobalDateRangePicker from "./GlobalDateRangePicker";

export default function TimeRangeControl({ showAllPresets = false }: { showAllPresets?: boolean }) {
  return <GlobalDateRangePicker showAllPresets={showAllPresets} />;
}
