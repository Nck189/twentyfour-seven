export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      animals: {
        Row: {
          created_at: string;
          fed_until: string | null;
          id: string;
          last_produced: string | null;
          love: number;
          name: string | null;
          species: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          fed_until?: string | null;
          id?: string;
          last_produced?: string | null;
          love?: number;
          name?: string | null;
          species: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          fed_until?: string | null;
          id?: string;
          last_produced?: string | null;
          love?: number;
          name?: string | null;
          species?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      backlog_items: {
        Row: {
          block: string | null;
          carry_count: number;
          checklist: NonNullable<Json>;
          created_at: string;
          deadline: string | null;
          done_at: string | null;
          estimate_min: number | null;
          id: string;
          priority: string;
          scheduled_date: string | null;
          status: string;
          tag: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          block?: string | null;
          carry_count?: number;
          checklist?: NonNullable<Json>;
          created_at?: string;
          deadline?: string | null;
          done_at?: string | null;
          estimate_min?: number | null;
          id?: string;
          priority?: string;
          scheduled_date?: string | null;
          status?: string;
          tag?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          block?: string | null;
          carry_count?: number;
          checklist?: NonNullable<Json>;
          created_at?: string;
          deadline?: string | null;
          done_at?: string | null;
          estimate_min?: number | null;
          id?: string;
          priority?: string;
          scheduled_date?: string | null;
          status?: string;
          tag?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      block_logs: {
        Row: {
          backfilled: boolean;
          block: string;
          closed_at: string | null;
          created_at: string;
          date: string;
          energy: number | null;
          first10_at: string | null;
          id: string;
          items_done: NonNullable<Json>;
          items_planned: number;
          location: string | null;
          miss_reason: string | null;
          mood: number | null;
          planned_deviation: boolean;
          planned_start: string | null;
          started_at: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          backfilled?: boolean;
          block: string;
          closed_at?: string | null;
          created_at?: string;
          date: string;
          energy?: number | null;
          first10_at?: string | null;
          id?: string;
          items_done?: NonNullable<Json>;
          items_planned?: number;
          location?: string | null;
          miss_reason?: string | null;
          mood?: number | null;
          planned_deviation?: boolean;
          planned_start?: string | null;
          started_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          backfilled?: boolean;
          block?: string;
          closed_at?: string | null;
          created_at?: string;
          date?: string;
          energy?: number | null;
          first10_at?: string | null;
          id?: string;
          items_done?: NonNullable<Json>;
          items_planned?: number;
          location?: string | null;
          miss_reason?: string | null;
          mood?: number | null;
          planned_deviation?: boolean;
          planned_start?: string | null;
          started_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      day_plans: {
        Row: {
          attending: boolean | null;
          bedtime_override: string | null;
          created_at: string;
          date: string;
          id: string;
          late_night: Json | null;
          late_night_set_at: string | null;
          mode: string;
          overrides: NonNullable<Json>;
          planned: Json | null;
          template_id: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          attending?: boolean | null;
          bedtime_override?: string | null;
          created_at?: string;
          date: string;
          id?: string;
          late_night?: Json | null;
          late_night_set_at?: string | null;
          mode?: string;
          overrides?: NonNullable<Json>;
          planned?: Json | null;
          template_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          attending?: boolean | null;
          bedtime_override?: string | null;
          created_at?: string;
          date?: string;
          id?: string;
          late_night?: Json | null;
          late_night_set_at?: string | null;
          mode?: string;
          overrides?: NonNullable<Json>;
          planned?: Json | null;
          template_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "day_plans_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "templates";
            referencedColumns: ["id"];
          },
        ];
      };
      decor: {
        Row: {
          created_at: string;
          id: string;
          item_id: string;
          user_id: string;
          x: number;
          y: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          item_id: string;
          user_id: string;
          x?: number;
          y?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          item_id?: string;
          user_id?: string;
          x?: number;
          y?: number;
        };
        Relationships: [];
      };
      events: {
        Row: {
          at: string;
          id: number;
          payload: NonNullable<Json>;
          type: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          at?: string;
          id?: never;
          payload?: NonNullable<Json>;
          type: string;
          user_id: string;
        };
        Update: {
          at?: string;
          id?: never;
          payload?: NonNullable<Json>;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      exercise_logs: {
        Row: {
          at: string;
          created_at: string;
          id: string;
          minutes: number;
          type: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          at?: string;
          created_at?: string;
          id?: string;
          minutes: number;
          type: string;
          user_id: string;
        };
        Update: {
          at?: string;
          created_at?: string;
          id?: string;
          minutes?: number;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      gacha_pulls: {
        Row: {
          at: string;
          banner: string;
          id: string;
          idempotency_key: string | null;
          pity_before: NonNullable<Json>;
          rarity: string;
          result: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          at?: string;
          banner: string;
          id?: string;
          idempotency_key?: string | null;
          pity_before: NonNullable<Json>;
          rarity: string;
          result: string;
          user_id: string;
        };
        Update: {
          at?: string;
          banner?: string;
          id?: string;
          idempotency_key?: string | null;
          pity_before?: NonNullable<Json>;
          rarity?: string;
          result?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      game_state: {
        Row: {
          best_streak: number;
          coins: number;
          essence: NonNullable<Json>;
          freezes: number;
          pity: NonNullable<Json>;
          season: string | null;
          streak: number;
          tickets: number;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          best_streak?: number;
          coins?: number;
          essence?: NonNullable<Json>;
          freezes?: number;
          pity?: NonNullable<Json>;
          season?: string | null;
          streak?: number;
          tickets?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          best_streak?: number;
          coins?: number;
          essence?: NonNullable<Json>;
          freezes?: number;
          pity?: NonNullable<Json>;
          season?: string | null;
          streak?: number;
          tickets?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      inventory: {
        Row: {
          item_id: string;
          qty: number;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          item_id: string;
          qty?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          item_id?: string;
          qty?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      plots: {
        Row: {
          crop_id: string | null;
          growth_days: number;
          id: string;
          mutations: string[];
          planted_on: string | null;
          quality: string;
          slot: string;
          star: number;
          state: string;
          updated_at: string;
          user_id: string;
          weeds: boolean;
          wilt_level: number;
        };
        ComputedFields: never;
        Insert: {
          crop_id?: string | null;
          growth_days?: number;
          id?: string;
          mutations?: string[];
          planted_on?: string | null;
          quality?: string;
          slot: string;
          star?: number;
          state?: string;
          updated_at?: string;
          user_id: string;
          weeds?: boolean;
          wilt_level?: number;
        };
        Update: {
          crop_id?: string | null;
          growth_days?: number;
          id?: string;
          mutations?: string[];
          planted_on?: string | null;
          quality?: string;
          slot?: string;
          star?: number;
          state?: string;
          updated_at?: string;
          user_id?: string;
          weeds?: boolean;
          wilt_level?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          locale: string;
          onboarding: NonNullable<Json>;
          sound_on: boolean;
          timezone: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          display_name?: string | null;
          locale?: string;
          onboarding?: NonNullable<Json>;
          sound_on?: boolean;
          timezone?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          locale?: string;
          onboarding?: NonNullable<Json>;
          sound_on?: boolean;
          timezone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      seed_dex: {
        Row: {
          count: number;
          crop_id: string;
          first_seen: string;
          star: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          count?: number;
          crop_id: string;
          first_seen?: string;
          star?: number;
          user_id: string;
        };
        Update: {
          count?: number;
          crop_id?: string;
          first_seen?: string;
          star?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          blocks: NonNullable<Json>;
          gym_close_time: string;
          kaizen: NonNullable<Json>;
          tags: NonNullable<Json>;
          updated_at: string;
          user_id: string;
          wake_window_min: number;
          weekly_exercise_goal: number;
        };
        ComputedFields: never;
        Insert: {
          blocks: NonNullable<Json>;
          gym_close_time?: string;
          kaizen?: NonNullable<Json>;
          tags?: NonNullable<Json>;
          updated_at?: string;
          user_id: string;
          wake_window_min?: number;
          weekly_exercise_goal?: number;
        };
        Update: {
          blocks?: NonNullable<Json>;
          gym_close_time?: string;
          kaizen?: NonNullable<Json>;
          tags?: NonNullable<Json>;
          updated_at?: string;
          user_id?: string;
          wake_window_min?: number;
          weekly_exercise_goal?: number;
        };
        Relationships: [];
      };
      templates: {
        Row: {
          auto_apply: boolean;
          blocks: NonNullable<Json>;
          created_at: string;
          fixed_events: NonNullable<Json>;
          id: string;
          key: string;
          name: string | null;
          options: NonNullable<Json>;
          sort: number;
          target_wake: string;
          updated_at: string;
          user_id: string;
          weekdays: number[];
        };
        ComputedFields: never;
        Insert: {
          auto_apply?: boolean;
          blocks?: NonNullable<Json>;
          created_at?: string;
          fixed_events?: NonNullable<Json>;
          id?: string;
          key: string;
          name?: string | null;
          options?: NonNullable<Json>;
          sort?: number;
          target_wake: string;
          updated_at?: string;
          user_id: string;
          weekdays?: number[];
        };
        Update: {
          auto_apply?: boolean;
          blocks?: NonNullable<Json>;
          created_at?: string;
          fixed_events?: NonNullable<Json>;
          id?: string;
          key?: string;
          name?: string | null;
          options?: NonNullable<Json>;
          sort?: number;
          target_wake?: string;
          updated_at?: string;
          user_id?: string;
          weekdays?: number[];
        };
        Relationships: [];
      };
      ticket_grants: {
        Row: {
          amount: number;
          at: string;
          reason: string;
          ref_date: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          at?: string;
          reason: string;
          ref_date: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          at?: string;
          reason?: string;
          ref_date?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      wake_events: {
        Row: {
          backfilled: boolean;
          created_at: string;
          date: string;
          id: string;
          in_window: boolean;
          pressed_at: string;
          target_wake: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          backfilled?: boolean;
          created_at?: string;
          date: string;
          id?: string;
          in_window: boolean;
          pressed_at: string;
          target_wake: string;
          user_id: string;
        };
        Update: {
          backfilled?: boolean;
          created_at?: string;
          date?: string;
          id?: string;
          in_window?: boolean;
          pressed_at?: string;
          target_wake?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      _grant_once: {
        Args: { p_amount: number; p_date: string; p_reason: string; uid: string };
        Returns: boolean;
      };
      _grant_tickets: {
        Args: { amount: number; meta?: Json; reason: string; uid: string };
        Returns: undefined;
      };
      _target_wake: { Args: { d: string; uid: string }; Returns: string };
      backfill_wake: {
        Args: { p_date: string; p_pressed_at: string };
        Returns: {
          backfilled: boolean;
          created_at: string;
          date: string;
          id: string;
          in_window: boolean;
          pressed_at: string;
          target_wake: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "wake_events";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      complete_night_ritual: { Args: { p_date: string }; Returns: Json };
      keepalive: { Args: Record<PropertyKey, never>; Returns: string };
      press_wake: {
        Args: Record<PropertyKey, never>;
        Returns: {
          backfilled: boolean;
          created_at: string;
          date: string;
          id: string;
          in_window: boolean;
          pressed_at: string;
          target_wake: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "wake_events";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      seed_user_defaults: { Args: { uid: string }; Returns: undefined };
      set_block_item: {
        Args: {
          p_block: string;
          p_date: string;
          p_done: boolean;
          p_item: string;
          p_items_planned: number;
          p_planned_start: string;
        };
        Returns: {
          backfilled: boolean;
          block: string;
          closed_at: string | null;
          created_at: string;
          date: string;
          energy: number | null;
          first10_at: string | null;
          id: string;
          items_done: NonNullable<Json>;
          items_planned: number;
          location: string | null;
          miss_reason: string | null;
          mood: number | null;
          planned_deviation: boolean;
          planned_start: string | null;
          started_at: string | null;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "block_logs";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      [_ in never]: never;
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
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
