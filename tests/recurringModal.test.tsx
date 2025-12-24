import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import RecurringModal from "@/components/RecurringModal";

// Basic smoke test for auto-apply confirmation
describe("RecurringModal", () => {
  const entry = { _id: "e1", amountCents: 1000, type: "expense", bucket: "Personal" };
  it("requires confirmation when auto-apply is enabled", async () => {
    const onClose = vi.fn();
    render(<RecurringModal entry={entry as any} onClose={onClose} /> as any);

    // enable auto-apply checkbox
    const autoApplyToggle = await screen.findByLabelText(/Auto-apply to future entries/i);
    fireEvent.click(autoApplyToggle);

    // Try to save without ticking confirmation
    const saveBtn = screen.getByText(/Save pattern/i);
    fireEvent.click(saveBtn);

    const err = await screen.findByText(/Please confirm/i);
    expect(err).toBeInTheDocument();
  });
});
