export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	graphql_public: {
		Tables: {
			[_ in never]: never;
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			graphql: {
				Args: {
					extensions?: Json;
					operationName?: string;
					query?: string;
					variables?: Json;
				};
				Returns: Json;
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
	public: {
		Tables: {
			account: {
				Row: {
					balance_centavos: number;
					created_at: string;
					credit_limit_centavos: number | null;
					group_id: string | null;
					id: string;
					initial_balance_centavos: number;
					installment_limit_centavos: number | null;
					interest_posting_interval: Database["public"]["Enums"]["posting_interval"] | null;
					interest_rate_bps: number | null;
					is_archived: boolean;
					is_matured: boolean;
					maturity_date: string | null;
					name: string;
					principal_centavos: number | null;
					type: Database["public"]["Enums"]["account_type"];
					updated_at: string;
					user_id: string;
				};
				Insert: {
					balance_centavos?: number;
					created_at?: string;
					credit_limit_centavos?: number | null;
					group_id?: string | null;
					id?: string;
					initial_balance_centavos: number;
					installment_limit_centavos?: number | null;
					interest_posting_interval?: Database["public"]["Enums"]["posting_interval"] | null;
					interest_rate_bps?: number | null;
					is_archived?: boolean;
					is_matured?: boolean;
					maturity_date?: string | null;
					name: string;
					principal_centavos?: number | null;
					type: Database["public"]["Enums"]["account_type"];
					updated_at?: string;
					user_id: string;
				};
				Update: {
					balance_centavos?: number;
					created_at?: string;
					credit_limit_centavos?: number | null;
					group_id?: string | null;
					id?: string;
					initial_balance_centavos?: number;
					installment_limit_centavos?: number | null;
					interest_posting_interval?: Database["public"]["Enums"]["posting_interval"] | null;
					interest_rate_bps?: number | null;
					is_archived?: boolean;
					is_matured?: boolean;
					maturity_date?: string | null;
					name?: string;
					principal_centavos?: number | null;
					type?: Database["public"]["Enums"]["account_type"];
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "account_group_id_fkey";
						columns: ["group_id"];
						isOneToOne: false;
						referencedRelation: "account_group";
						referencedColumns: ["id"];
					},
				];
			};
			account_group: {
				Row: {
					created_at: string;
					id: string;
					name: string;
					updated_at: string;
					user_id: string;
				};
				Insert: {
					created_at?: string;
					id?: string;
					name: string;
					updated_at?: string;
					user_id: string;
				};
				Update: {
					created_at?: string;
					id?: string;
					name?: string;
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [];
			};
			budget_allocation: {
				Row: {
					amount_centavos: number;
					created_at: string;
					id: string;
					month: string;
					tag_id: string;
					updated_at: string;
					user_id: string;
				};
				Insert: {
					amount_centavos: number;
					created_at?: string;
					id?: string;
					month: string;
					tag_id: string;
					updated_at?: string;
					user_id: string;
				};
				Update: {
					amount_centavos?: number;
					created_at?: string;
					id?: string;
					month?: string;
					tag_id?: string;
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "budget_allocation_tag_id_fkey";
						columns: ["tag_id"];
						isOneToOne: false;
						referencedRelation: "tag";
						referencedColumns: ["id"];
					},
				];
			};
			budget_config: {
				Row: {
					created_at: string;
					id: string;
					month: string;
					overall_centavos: number;
					updated_at: string;
					user_id: string;
				};
				Insert: {
					created_at?: string;
					id?: string;
					month: string;
					overall_centavos?: number;
					updated_at?: string;
					user_id: string;
				};
				Update: {
					created_at?: string;
					id?: string;
					month?: string;
					overall_centavos?: number;
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [];
			};
			recurring: {
				Row: {
					amount_centavos: number;
					completed_at: string | null;
					created_at: string;
					description: string | null;
					fee_centavos: number | null;
					first_occurrence_date: string;
					from_account_id: string | null;
					id: string;
					interval: Database["public"]["Enums"]["recurring_interval"];
					is_completed: boolean;
					is_paused: boolean;
					next_occurrence_at: string;
					remaining_occurrences: number | null;
					service: string;
					tag_id: string | null;
					to_account_id: string | null;
					type: Database["public"]["Enums"]["transaction_type"];
					updated_at: string;
					user_id: string;
				};
				Insert: {
					amount_centavos: number;
					completed_at?: string | null;
					created_at?: string;
					description?: string | null;
					fee_centavos?: number | null;
					first_occurrence_date: string;
					from_account_id?: string | null;
					id?: string;
					interval: Database["public"]["Enums"]["recurring_interval"];
					is_completed?: boolean;
					is_paused?: boolean;
					next_occurrence_at: string;
					remaining_occurrences?: number | null;
					service: string;
					tag_id?: string | null;
					to_account_id?: string | null;
					type: Database["public"]["Enums"]["transaction_type"];
					updated_at?: string;
					user_id: string;
				};
				Update: {
					amount_centavos?: number;
					completed_at?: string | null;
					created_at?: string;
					description?: string | null;
					fee_centavos?: number | null;
					first_occurrence_date?: string;
					from_account_id?: string | null;
					id?: string;
					interval?: Database["public"]["Enums"]["recurring_interval"];
					is_completed?: boolean;
					is_paused?: boolean;
					next_occurrence_at?: string;
					remaining_occurrences?: number | null;
					service?: string;
					tag_id?: string | null;
					to_account_id?: string | null;
					type?: Database["public"]["Enums"]["transaction_type"];
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "recurring_from_account_id_fkey";
						columns: ["from_account_id"];
						isOneToOne: false;
						referencedRelation: "account";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "recurring_tag_id_fkey";
						columns: ["tag_id"];
						isOneToOne: false;
						referencedRelation: "tag";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "recurring_to_account_id_fkey";
						columns: ["to_account_id"];
						isOneToOne: false;
						referencedRelation: "account";
						referencedColumns: ["id"];
					},
				];
			};
			tag: {
				Row: {
					created_at: string;
					id: string;
					is_system: boolean;
					name: string;
					type: Database["public"]["Enums"]["tag_type"];
					user_id: string;
				};
				Insert: {
					created_at?: string;
					id?: string;
					is_system?: boolean;
					name: string;
					type: Database["public"]["Enums"]["tag_type"];
					user_id: string;
				};
				Update: {
					created_at?: string;
					id?: string;
					is_system?: boolean;
					name?: string;
					type?: Database["public"]["Enums"]["tag_type"];
					user_id?: string;
				};
				Relationships: [];
			};
			transaction: {
				Row: {
					amount_centavos: number;
					created_at: string;
					date: string;
					description: string | null;
					fee_centavos: number | null;
					from_account_id: string | null;
					id: string;
					parent_transaction_id: string | null;
					recurring_id: string | null;
					tag_id: string | null;
					to_account_id: string | null;
					type: Database["public"]["Enums"]["transaction_type"];
					updated_at: string;
					user_id: string;
				};
				Insert: {
					amount_centavos: number;
					created_at?: string;
					date: string;
					description?: string | null;
					fee_centavos?: number | null;
					from_account_id?: string | null;
					id?: string;
					parent_transaction_id?: string | null;
					recurring_id?: string | null;
					tag_id?: string | null;
					to_account_id?: string | null;
					type: Database["public"]["Enums"]["transaction_type"];
					updated_at?: string;
					user_id: string;
				};
				Update: {
					amount_centavos?: number;
					created_at?: string;
					date?: string;
					description?: string | null;
					fee_centavos?: number | null;
					from_account_id?: string | null;
					id?: string;
					parent_transaction_id?: string | null;
					recurring_id?: string | null;
					tag_id?: string | null;
					to_account_id?: string | null;
					type?: Database["public"]["Enums"]["transaction_type"];
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "transaction_from_account_id_fkey";
						columns: ["from_account_id"];
						isOneToOne: false;
						referencedRelation: "account";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "transaction_parent_transaction_id_fkey";
						columns: ["parent_transaction_id"];
						isOneToOne: false;
						referencedRelation: "transaction";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "transaction_recurring_id_fkey";
						columns: ["recurring_id"];
						isOneToOne: false;
						referencedRelation: "recurring";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "transaction_tag_id_fkey";
						columns: ["tag_id"];
						isOneToOne: false;
						referencedRelation: "tag";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "transaction_to_account_id_fkey";
						columns: ["to_account_id"];
						isOneToOne: false;
						referencedRelation: "account";
						referencedColumns: ["id"];
					},
				];
			};
			user_profile: {
				Row: {
					created_at: string;
					display_name: string;
					id: string;
					theme: string;
					timezone: string;
					updated_at: string;
				};
				Insert: {
					created_at?: string;
					display_name: string;
					id: string;
					theme?: string;
					timezone?: string;
					updated_at?: string;
				};
				Update: {
					created_at?: string;
					display_name?: string;
					id?: string;
					theme?: string;
					timezone?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			advance_recurring_next: {
				Args: {
					p_anchor: string;
					p_current_next: string;
					p_interval: Database["public"]["Enums"]["recurring_interval"];
					p_tz: string;
				};
				Returns: string;
			};
			apply_account_delta: {
				Args: {
					p_account_id: string;
					p_amount_centavos: number;
					p_money_in: boolean;
				};
				Returns: undefined;
			};
			enforce_budget_cap: {
				Args: { p_month: string; p_user_id: string };
				Returns: undefined;
			};
			recurring_fire_due: { Args: never; Returns: number };
			recurring_initial_next_at: {
				Args: {
					p_anchor: string;
					p_interval: Database["public"]["Enums"]["recurring_interval"];
					p_tz: string;
				};
				Returns: string;
			};
		};
		Enums: {
			account_type: "cash" | "e-wallet" | "savings" | "credit" | "time-deposit";
			posting_interval: "monthly" | "quarterly" | "semi-annual" | "annual" | "at-maturity";
			recurring_interval: "weekly" | "monthly" | "quarterly" | "semi_annual" | "annual";
			tag_type: "expense" | "income" | "transfer" | "any";
			transaction_type: "expense" | "income" | "transfer";
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
				DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
			Row: infer R;
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
		? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R;
			}
			? R
			: never
		: never;

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema["Tables"]
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
			Insert: infer I;
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
		? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I;
			}
			? I
			: never
		: never;

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema["Tables"]
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
			Update: infer U;
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
		? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U;
			}
			? U
			: never
		: never;

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		| keyof DefaultSchema["Enums"]
		| { schema: keyof DatabaseWithoutInternals },
	EnumName extends DefaultSchemaEnumNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
		: never = never,
> = DefaultSchemaEnumNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
		? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
		: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		| keyof DefaultSchema["CompositeTypes"]
		| { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
		: never = never,
> = PublicCompositeTypeNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
		? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
		: never;

export const Constants = {
	graphql_public: {
		Enums: {},
	},
	public: {
		Enums: {
			account_type: ["cash", "e-wallet", "savings", "credit", "time-deposit"],
			posting_interval: ["monthly", "quarterly", "semi-annual", "annual", "at-maturity"],
			recurring_interval: ["weekly", "monthly", "quarterly", "semi_annual", "annual"],
			tag_type: ["expense", "income", "transfer", "any"],
			transaction_type: ["expense", "income", "transfer"],
		},
	},
} as const;
