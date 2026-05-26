export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Role = 'essa_admin' | 'school_admin' | 'teacher' | 'referee'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          sport_activity_id: string
          id: string
          full_name: string
          email: string
          role: Role
          school_id: string | null
          phone: string
          must_change_password: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          email: string
          role: Role
          school_id?: string | null
          phone?: string
          must_change_password?: boolean
        }
        Update: {
          id?: string
          full_name?: string
          email?: string
          role?: Role
          school_id?: string | null
          phone?: string
          must_change_password?: boolean
        }
      }
      schools: {
        Row: {
          id: string
          name: string
          code: string
          region: string
          address: string
          phone: string
          email: string
          admin_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['schools']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['schools']['Insert']>
      }
      sport_activities: {
        Row: {
          coach_id: string
          id: string
          school_id: string
          name: string
          category: 'team' | 'individual'
          teacher_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['sport_activities']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['sport_activities']['Insert']>
      }
      players: {
        Row: {
          id: string
          school_id: string
          first_name: string
          last_name: string
          date_of_birth: string
          student_id: string
          enrollment_year: number
          grade: string
          parent_name: string
          parent_phone: string
          photo_url: string
          id_document_url: string
          is_verified: boolean
          verification_code: string | null
          bank_receipt_url: string
          school_receipt_url: string
          essa_verification_status: 'pending' | 'verified' | 'rejected'
          essa_rejection_reason: string
          essa_verified_by: string | null
          essa_verified_at: string | null
          registered_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['players']['Row'], 'id' | 'created_at' | 'updated_at' | 'bank_receipt_url' | 'school_receipt_url' | 'essa_verification_status' | 'essa_rejection_reason' | 'essa_verified_by' | 'essa_verified_at'> & {
          bank_receipt_url?: string
          school_receipt_url?: string
          essa_verification_status?: 'pending' | 'verified' | 'rejected'
          essa_rejection_reason?: string
          essa_verified_by?: string | null
          essa_verified_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['players']['Insert']>
      }
      player_updates: {
        Row: {
          id: string
          player_id: string
          updated_by: string
          update_reason: string
          old_data: Json
          new_data: Json
          verification_code_used: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['player_updates']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['player_updates']['Insert']>
      }
      player_activity: {
        Row: {
          id: string
          player_id: string
          activity_id: string
          joined_at: string
        }
        Insert: Omit<Database['public']['Tables']['player_activity']['Row'], 'id' | 'joined_at'>
        Update: Partial<Database['public']['Tables']['player_activity']['Insert']>
      }
      draws: {
        Row: {
          id: string
          title: string
          sport: string
          stage: 1 | 2 | 3
          season: string
          description: string
          is_published: boolean
          starts_at: string | null
          ends_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['draws']['Row'], 'id' | 'created_at' | 'updated_at' | 'starts_at' | 'ends_at'> & {
          starts_at?: string | null
          ends_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['draws']['Insert']>
      }
      draw_matches: {
        Row: {
          id: string
          draw_id: string
          home_school_id: string
          away_school_id: string
          match_date: string
          venue: string
          match_number: number | null
          status: 'draft' | 'published' | 'completed' | 'cancelled'
          notes: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['draw_matches']['Row'], 'id' | 'created_at' | 'status'> & {
          status?: 'draft' | 'published' | 'completed' | 'cancelled'
        }
        Update: Partial<Database['public']['Tables']['draw_matches']['Insert']>
      }
      squads: {
        Row: {
          id: string
          draw_match_id: string
          school_id: string
          activity_id: string
          selected_by: string | null
          squad_barcode: string
          is_finalized: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['squads']['Row'], 'id' | 'squad_barcode' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['squads']['Insert']>
      }
      squad_players: {
        Row: {
          id: string
          squad_id: string
          player_id: string
          position: string
          jersey_number: number | null
          is_captain: boolean
          school_verified: boolean
          added_by: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['squad_players']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['squad_players']['Insert']>
      }
      announcements: {
        Row: {
          id: string
          title: string
          content: string
          is_published: boolean
          target_schools: string[]
          starts_at: string | null
          expires_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['announcements']['Row'], 'id' | 'created_at' | 'updated_at' | 'starts_at' | 'expires_at'> & {
          starts_at?: string | null
          expires_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['announcements']['Insert']>
      }
    }
    Views: Record<string, unknown>
    Functions: Record<string, unknown>
    Enums: Record<string, unknown>
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type School = Database['public']['Tables']['schools']['Row']
export type SportActivity = Database['public']['Tables']['sport_activities']['Row']
export type Player = Database['public']['Tables']['players']['Row']
export type PlayerUpdate = Database['public']['Tables']['player_updates']['Row']
export type Draw = Database['public']['Tables']['draws']['Row']
export type DrawMatch = Database['public']['Tables']['draw_matches']['Row']
export type Squad = Database['public']['Tables']['squads']['Row']
export type SquadPlayer = Database['public']['Tables']['squad_players']['Row']
export type Announcement = Database['public']['Tables']['announcements']['Row']
