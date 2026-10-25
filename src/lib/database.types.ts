// Hand-maintained mirror of supabase/migrations. Regenerate with
//   npx supabase gen types typescript --local > src/lib/database.types.ts
// once a Supabase project is linked.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "inactive";
export type SubscriptionTier = "starter" | "pro" | "agency";
export type LookupStatus = "PENDING" | "SUCCESS" | "FAILED_REFUNDED" | "NOT_FOUND_REFUNDED";
export type CreditBucket = "SUBSCRIPTION" | "TOPUP";
export type TransactionType =
  | "SUBSCRIPTION_CREDIT"
  | "SUBSCRIPTION_EXPIRY"
  | "TOPUP_PURCHASE"
  | "LOOKUP_DEDUCTION"
  | "LOOKUP_REFUND"
  | "ADMIN_ADJUSTMENT";
export type RefundReason = "API_NO_DATA" | "API_ERROR" | "STALE_PENDING";

type UsersRow = {
  id: string;
  email: string;
  full_name: string | null;
  stripe_customer_id: string | null;
  credit_balance: number;
  subscription_credits: number;
  subscription_status: SubscriptionStatus;
  subscription_tier: SubscriptionTier | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};

type CreditTransactionsRow = {
  id: string;
  user_id: string;
  amount: number;
  balance_after: number;
  transaction_type: TransactionType;
  credit_bucket: CreditBucket;
  stripe_event_id: string | null;
  reference_lookup_id: string | null;
  description: string | null;
  created_at: string;
};

type VehicleLookupsRow = {
  id: string;
  user_id: string;
  vrm_normalized: string;
  api_provider: string;
  status: LookupStatus;
  paint_code: string | null;
  paint_name: string | null;
  paint_finish: string | null;
  code_location_hint: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  registered_color: string | null;
  vin_partial: string | null;
  raw_api_response: Json | null;
  failure_reason: string | null;
  cost_credits: number;
  deducted_bucket: CreditBucket | null;
  created_at: string;
  completed_at: string | null;
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "12" };
  public: {
    Tables: {
      users: {
        Row: UsersRow;
        Insert: Partial<UsersRow> & { id: string; email: string };
        Update: Partial<UsersRow>;
        Relationships: [];
      };
      credit_transactions: {
        Row: CreditTransactionsRow;
        Insert: Partial<CreditTransactionsRow> & Pick<CreditTransactionsRow, "user_id" | "amount" | "balance_after" | "transaction_type">;
        Update: Partial<CreditTransactionsRow>;
        Relationships: [];
      };
      vehicle_lookups: {
        Row: VehicleLookupsRow;
        Insert: Partial<VehicleLookupsRow> & Pick<VehicleLookupsRow, "user_id" | "vrm_normalized" | "api_provider" | "status">;
        Update: Partial<VehicleLookupsRow>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      deduct_credit_for_lookup: {
        Args: { p_user_id: string; p_vrm: string; p_provider: string };
        Returns: string;
      };
      complete_lookup: {
        Args: {
          p_lookup_id: string;
          p_provider: string;
          p_paint_code: string;
          p_paint_name: string | null;
          p_paint_finish: string | null;
          p_code_location_hint: string | null;
          p_make: string | null;
          p_model: string | null;
          p_year: number | null;
          p_registered_color: string | null;
          p_vin_partial: string | null;
          p_raw: Json | null;
        };
        Returns: boolean;
      };
      refund_lookup: {
        Args: { p_lookup_id: string; p_reason: RefundReason; p_provider?: string | null; p_raw?: Json | null };
        Returns: number | null;
      };
      refund_stale_pending_lookups: {
        Args: { p_user_id?: string | null; p_older_than?: string };
        Returns: number;
      };
      grant_credits: {
        Args: {
          p_user_id: string;
          p_amount: number;
          p_type: "TOPUP_PURCHASE" | "ADMIN_ADJUSTMENT";
          p_stripe_event_id: string | null;
          p_description: string;
        };
        Returns: boolean;
      };
      grant_subscription_credits: {
        Args: {
          p_user_id: string;
          p_amount: number;
          p_stripe_event_id: string;
          p_tier: SubscriptionTier;
          p_period_end: string | null;
          p_rollover: boolean;
          p_description: string;
        };
        Returns: boolean;
      };
      expire_subscription_credits: {
        Args: { p_user_id: string; p_description: string };
        Returns: number;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type UserProfile = UsersRow;
export type CreditTransaction = CreditTransactionsRow;
export type VehicleLookup = VehicleLookupsRow;
