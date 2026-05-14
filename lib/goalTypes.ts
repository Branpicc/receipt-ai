// lib/goalTypes.ts
//
// Shared types for the personal-account Goals & Paycheck Splitter
// feature. Mirrors the SQL schema in /sql migrations.

export type GoalCategory =
  | "savings"
  | "investment"
  | "bills"
  | "vacation"
  | "spending"
  | "custom";

export type ResetFrequency =
  | "never"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "per_paycheck"
  | null;

export type PayFrequency =
  | "weekly"
  | "biweekly"
  | "semimonthly"
  | "monthly"
  | "irregular";

export type Goal = {
  id: string;
  client_id: string;
  firm_id: string;
  name: string;
  icon: string | null;
  emoji: string | null;
  category: GoalCategory;
  is_important: boolean;
  target_cents: number;
  target_date: string | null;
  reset_frequency: ResetFrequency;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
};

export type GoalContribution = {
  id: string;
  goal_id: string;
  amount_cents: number;
  note: string | null;
  source: "manual" | "paycheck_split";
  contributed_at: string;
};

// Each row of a paycheck splitter. `kind='%'` means value is a percent
// of the paycheck (0–100); `kind='$'` means value is a fixed dollar
// amount in cents. goal_id is optional — splits can route money to a
// labeled bucket (e.g. "Chequing") that doesn't have a goal record.
export type SplitItem = {
  id: string;
  label: string;
  kind: "%" | "$";
  value: number; // percent (0-100) OR cents
  goal_id: string | null;
};

export type PaycheckSplit = {
  id: string;
  client_id: string;
  firm_id: string;
  name: string;
  pay_frequency: PayFrequency;
  items: SplitItem[];
  is_active: boolean;
  created_at: string;
};

// Derived view: a goal plus its summed contributions, used by GoalCard.
export type GoalWithProgress = Goal & {
  contributed_total_cents: number;       // lifetime
  current_cycle_cents: number;           // since last reset
  cycle_start: string | null;            // for display
};
