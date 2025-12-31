"use client";

import TransactionSheet from "@/components/transactions/TransactionSheet";
import type { Id } from "convex/_generated/dataModel";

interface Entry {
  _id: Id<"entries">;
  type: "expense" | "income" | "transfer";
  amountCents: number;
  date: number;
  category?: string;
  bucket?: string;
  note?: string;
  merchant?: string;
  methodOrAccount?: string;
  accountId?: Id<"accounts">;
  contextTags?: string[];
  intentTags?: string[];
  transferId?: Id<"transfers">;
  isTransferSource?: boolean;
  reviewReason?: string;
  needsReview?: boolean;
  createdAt?: number;
}

export default function EditEntryModal({
  entry,
  onClose,
  onSaved,
  onDeleted,
}: {
  entry: Entry;
  onClose: () => void;
  onSaved?: () => void;
  onDeleted?: () => void;
}) {
  return (
    <TransactionSheet
      mode="edit"
      entry={entry}
      onClose={onClose}
      onSaved={() => onSaved?.()}
      onDeleted={() => onDeleted?.()}
    />
  );
}
