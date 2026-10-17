
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "blocks": {
                  Row: {
                    "blocked_id": string,"blocker_id": string,"created_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked_id": string,"blocker_id"?: string,"created_at"?: string
                  }
                  Update: {
                    "blocked_id"?: string,"blocker_id"?: string,"created_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "blocks_blocker_id_fkey"
      columns: ["blocker_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"comments": {
                  Row: {
                    "alias_id": string,"body": string,"created_at": string,"deleted_at": string | null,"event_id": string,"id": string,"reply_to": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alias_id": string,"body": string,"created_at"?: string,"deleted_at"?: string | null,"event_id": string,"id"?: string,"reply_to"?: string | null
                  }
                  Update: {
                    "alias_id"?: string,"body"?: string,"created_at"?: string,"deleted_at"?: string | null,"event_id"?: string,"id"?: string,"reply_to"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "comments_alias_id_event_id_fkey"
      columns: ["alias_id","event_id"]
isOneToOne: false
      referencedRelation: "event_aliases"
      referencedColumns: ["id","event_id"]
    },{
      foreignKeyName: "comments_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_reply_to_fkey"
      columns: ["reply_to"]
isOneToOne: false
      referencedRelation: "comments"
      referencedColumns: ["id"]
    }
                  ]
                },"event_aliases": {
                  Row: {
                    "alias": string,"created_at": string,"event_id": string,"id": string,"is_organizer": boolean,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alias": string,"created_at"?: string,"event_id": string,"id"?: string,"is_organizer"?: boolean,"user_id": string
                  }
                  Update: {
                    "alias"?: string,"created_at"?: string,"event_id"?: string,"id"?: string,"is_organizer"?: boolean,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_aliases_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_aliases_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"event_invites": {
                  Row: {
                    "created_at": string,"event_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_invites_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_invites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"event_photos": {
                  Row: {
                    "created_at": string,"event_id": string,"id": string,"position": number,"storage_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id": string,"id"?: string,"position"?: number,"storage_path": string
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"id"?: string,"position"?: number,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_photos_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"event_updates": {
                  Row: {
                    "body": string,"created_at": string,"edited_at": string | null,"event_id": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"edited_at"?: string | null,"event_id": string,"id"?: string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"edited_at"?: string | null,"event_id"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_updates_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "address": string,"area_label": string,"cancelled_at": string | null,"category": Database["public"]['Enums']["event_category"],"created_at": string,"description": string,"ends_at": string | null,"id": string,"invite_code": string,"location": unknown,"max_participants": number | null,"organizer_id": string,"starts_at": string,"title": string,"visibility": Database["public"]['Enums']["event_visibility"]
                  }
                  ComputedFields: never
                  Insert: {
                    "address": string,"area_label": string,"cancelled_at"?: string | null,"category"?: Database["public"]['Enums']["event_category"],"created_at"?: string,"description"?: string,"ends_at"?: string | null,"id"?: string,"invite_code"?: string,"location": unknown,"max_participants"?: number | null,"organizer_id"?: string,"starts_at": string,"title": string,"visibility"?: Database["public"]['Enums']["event_visibility"]
                  }
                  Update: {
                    "address"?: string,"area_label"?: string,"cancelled_at"?: string | null,"category"?: Database["public"]['Enums']["event_category"],"created_at"?: string,"description"?: string,"ends_at"?: string | null,"id"?: string,"invite_code"?: string,"location"?: unknown,"max_participants"?: number | null,"organizer_id"?: string,"starts_at"?: string,"title"?: string,"visibility"?: Database["public"]['Enums']["event_visibility"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_organizer_id_fkey"
      columns: ["organizer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"friendships": {
                  Row: {
                    "addressee_id": string,"created_at": string,"requester_id": string,"responded_at": string | null,"status": Database["public"]['Enums']["friendship_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "addressee_id": string,"created_at"?: string,"requester_id"?: string,"responded_at"?: string | null,"status"?: Database["public"]['Enums']["friendship_status"]
                  }
                  Update: {
                    "addressee_id"?: string,"created_at"?: string,"requester_id"?: string,"responded_at"?: string | null,"status"?: Database["public"]['Enums']["friendship_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "friendships_addressee_id_fkey"
      columns: ["addressee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "friendships_requester_id_fkey"
      columns: ["requester_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_songs": {
                  Row: {
                    "artist": string | null,"artwork_url": string | null,"position": number,"profile_id": string,"spotify_url": string,"title": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "artist"?: string | null,"artwork_url"?: string | null,"position": number,"profile_id": string,"spotify_url": string,"title"?: string | null
                  }
                  Update: {
                    "artist"?: string | null,"artwork_url"?: string | null,"position"?: number,"profile_id"?: string,"spotify_url"?: string,"title"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_songs_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"bio": string,"confirmed_minimum_age": boolean,"created_at": string,"id": string,"id_verified_at": string | null,"username": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"bio"?: string,"confirmed_minimum_age"?: boolean,"created_at"?: string,"id": string,"id_verified_at"?: string | null,"username": string
                  }
                  Update: {
                    "avatar_path"?: string | null,"bio"?: string,"confirmed_minimum_age"?: boolean,"created_at"?: string,"id"?: string,"id_verified_at"?: string | null,"username"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"id": string,"reason": string,"reporter_id": string,"resolution": string | null,"resolved_at": string | null,"target_id": string,"target_type": Database["public"]['Enums']["report_target"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"reason": string,"reporter_id"?: string,"resolution"?: string | null,"resolved_at"?: string | null,"target_id": string,"target_type": Database["public"]['Enums']["report_target"]
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"reason"?: string,"reporter_id"?: string,"resolution"?: string | null,"resolved_at"?: string | null,"target_id"?: string,"target_type"?: Database["public"]['Enums']["report_target"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"rsvps": {
                  Row: {
                    "created_at": string,"event_id": string,"status": Database["public"]['Enums']["rsvp_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id": string,"status": Database["public"]['Enums']["rsvp_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"status"?: Database["public"]['Enums']["rsvp_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rsvps_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rsvps_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_settings": {
                  Row: {
                    "default_radius_km": number,"font_scale": number,"locale": string,"share_activity_with_friends": boolean,"share_attendance_with_friends": boolean,"theme": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "default_radius_km"?: number,"font_scale"?: number,"locale"?: string,"share_activity_with_friends"?: boolean,"share_attendance_with_friends"?: boolean,"theme"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "default_radius_km"?: number,"font_scale"?: number,"locale"?: string,"share_activity_with_friends"?: boolean,"share_attendance_with_friends"?: boolean,"theme"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invite":
{ Args: { "p_code": string,"p_event": string }; Returns: boolean
                           },
"admin_reports":
{ Args: Record<PropertyKey, never>; Returns: {
              "author_id": string,"author_is_banned": boolean,"author_username": string,"event_id": string,"event_title": string,"first_reported_at": string,"preview": string,"reasons": (string)[],"report_count": number,"target_id": string,"target_type": Database["public"]['Enums']["report_target"]
            }[]
                           },
"admin_resolve_reports":
{ Args: { "p_resolution": string,"p_target": string,"p_target_type": Database["public"]['Enums']["report_target"] }; Returns: undefined
                           },
"clear_rsvp":
{ Args: { "p_event": string }; Returns: undefined
                           },
"delete_comment":
{ Args: { "p_comment": string }; Returns: undefined
                           },
"event_comments":
{ Args: { "p_event": string }; Returns: {
              "author_avatar_path": string,"author_is_friend": boolean,"author_is_organizer": boolean,"author_is_verified": boolean,"author_name": string,"body": string,"created_at": string,"id": string,"is_deleted": boolean,"is_mine": boolean,"reply_to": string
            }[]
                           },
"event_invite_code":
{ Args: { "p_event": string }; Returns: string
                           },
"event_invitees":
{ Args: { "p_event": string }; Returns: {
              "avatar_path": string,"rsvp": Database["public"]['Enums']["rsvp_status"],"user_id": string,"username": string
            }[]
                           },
"export_my_data":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"for_you_feed":
{ Args: { "p_before"?: string,"p_limit"?: number }; Returns: {
              "body": string,"event_id": string,"event_title": string,"friend_avatar_path": string,"friend_id": string,"friend_username": string,"kind": string,"occurred_at": string,"rsvp_status": Database["public"]['Enums']["rsvp_status"]
            }[]
                           },
"get_event":
{ Args: { "p_event": string }; Returns: {
              "address": string,"area_label": string,"cancelled_at": string,"category": Database["public"]['Enums']["event_category"],"description": string,"ends_at": string,"going_count": number,"id": string,"interested_count": number,"is_organizer": boolean,"latitude": number,"location_is_exact": boolean,"longitude": number,"max_participants": number,"my_rsvp": Database["public"]['Enums']["rsvp_status"],"organizer_is_friend": boolean,"organizer_is_verified": boolean,"organizer_name": string,"photo_paths": (string)[],"starts_at": string,"title": string,"visibility": Database["public"]['Enums']["event_visibility"],"waitlist_count": number
            }[]
                           },
"invite_friends":
{ Args: { "p_event": string,"p_users": (string)[] }; Returns: number
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"my_events":
{ Args: { "p_include_past"?: boolean }; Returns: {
              "area_label": string,"cancelled_at": string,"category": Database["public"]['Enums']["event_category"],"cover_photo_path": string,"ends_at": string,"id": string,"my_role": string,"starts_at": string,"title": string
            }[]
                           },
"nearby_events":
{ Args: { "p_categories"?: (Database["public"]['Enums']["event_category"])[],"p_latitude": number,"p_limit"?: number,"p_longitude": number,"p_radius_km": number,"p_starts_after"?: string,"p_starts_before"?: string }; Returns: {
              "approx_latitude": number,"approx_longitude": number,"area_label": string,"category": Database["public"]['Enums']["event_category"],"cover_photo_path": string,"distance_km": number,"ends_at": string,"going_count": number,"id": string,"max_participants": number,"my_rsvp": Database["public"]['Enums']["rsvp_status"],"organizer_is_verified": boolean,"starts_at": string,"title": string
            }[]
                           },
"post_comment":
{ Args: { "p_body": string,"p_event": string,"p_reply_to"?: string }; Returns: string
                           },
"set_rsvp":
{ Args: { "p_event": string,"p_status": Database["public"]['Enums']["rsvp_status"] }; Returns: Database["public"]['Enums']["rsvp_status"]
                           },
"uninvite":
{ Args: { "p_event": string,"p_user": string }; Returns: undefined
                           }
          }
          Enums: {
            "event_category": "music"|"sport"|"food"|"nightlife"|"culture"|"outdoors"|"learning"|"social"|"other","event_visibility": "public"|"private","friendship_status": "pending"|"accepted"|"declined","report_target": "user"|"event"|"comment"|"event_update","rsvp_status": "yes"|"interested"|"no"|"waitlisted"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "event_category": ["music", "sport", "food", "nightlife", "culture", "outdoors", "learning", "social", "other"],"event_visibility": ["public", "private"],"friendship_status": ["pending", "accepted", "declined"],"report_target": ["user", "event", "comment", "event_update"],"rsvp_status": ["yes", "interested", "no", "waitlisted"]
          }
        }
} as const
