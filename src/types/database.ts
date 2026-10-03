export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          avatar_url: string | null
          preferences: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          avatar_url?: string | null
          preferences?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          display_name?: string | null
          avatar_url?: string | null
          preferences?: Json
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          user_id: string
          name: string
          color: "neutral" | "blue" | "green" | "amber" | "red"
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          color?: "neutral" | "blue" | "green" | "amber" | "red"
          created_at?: string
        }
        Update: {
          name?: string
          color?: "neutral" | "blue" | "green" | "amber" | "red"
        }
        Relationships: []
      }
      tags: {
        Row: {
          id: string
          user_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          created_at?: string
        }
        Update: {
          name?: string
        }
        Relationships: []
      }
      videos: {
        Row: {
          id: string
          user_id: string
          category_id: string | null
          title: string
          description: string | null
          source_type: "local" | "upload" | "link"
          source_url: string | null
          source_key: string | null
          storage_path: string | null
          thumbnail_url: string | null
          duration_seconds: number
          status: "processing" | "ready" | "failed"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category_id?: string | null
          title: string
          description?: string | null
          source_type: "local" | "upload" | "link"
          source_url?: string | null
          source_key?: string | null
          storage_path?: string | null
          thumbnail_url?: string | null
          duration_seconds?: number
          status?: "processing" | "ready" | "failed"
          created_at?: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          title?: string
          description?: string | null
          source_url?: string | null
          source_key?: string | null
          storage_path?: string | null
          thumbnail_url?: string | null
          duration_seconds?: number
          status?: "processing" | "ready" | "failed"
          updated_at?: string
        }
        Relationships: []
      }
      video_parse_cache: {
        Row: {
          id: string
          user_id: string
          source_key: string
          source_url: string
          provider: "YouTube" | "Bilibili" | "Vimeo" | "直链视频" | "网页视频"
          title: string
          thumbnail_url: string | null
          duration_seconds: number
          transcript_content: string | null
          transcript_cue_count: number
          transcript_language: string | null
          transcript_generated: boolean
          parsed_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          source_key: string
          source_url: string
          provider: "YouTube" | "Bilibili" | "Vimeo" | "直链视频" | "网页视频"
          title: string
          thumbnail_url?: string | null
          duration_seconds?: number
          transcript_content?: string | null
          transcript_cue_count?: number
          transcript_language?: string | null
          transcript_generated?: boolean
          parsed_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          source_url?: string
          provider?: "YouTube" | "Bilibili" | "Vimeo" | "直链视频" | "网页视频"
          title?: string
          thumbnail_url?: string | null
          duration_seconds?: number
          transcript_content?: string | null
          transcript_cue_count?: number
          transcript_language?: string | null
          transcript_generated?: boolean
          parsed_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      video_tags: {
        Row: {
          video_id: string
          tag_id: string
          user_id: string
        }
        Insert: {
          video_id: string
          tag_id: string
          user_id: string
        }
        Update: never
        Relationships: []
      }
      video_progress: {
        Row: {
          video_id: string
          user_id: string
          position_seconds: number
          completion_percent: number
          completed: boolean
          last_watched_at: string
          updated_at: string
        }
        Insert: {
          video_id: string
          user_id: string
          position_seconds?: number
          completion_percent?: number
          completed?: boolean
          last_watched_at?: string
          updated_at?: string
        }
        Update: {
          position_seconds?: number
          completion_percent?: number
          completed?: boolean
          last_watched_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          id: string
          user_id: string
          video_id: string
          timestamp_seconds: number
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          video_id: string
          timestamp_seconds?: number
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          timestamp_seconds?: number
          content?: string
          updated_at?: string
        }
        Relationships: []
      }
      transcript_cues: {
        Row: {
          id: string
          user_id: string
          video_id: string
          start_seconds: number
          end_seconds: number
          text: string
          translation: string | null
          translation_language: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          video_id: string
          start_seconds: number
          end_seconds: number
          text: string
          translation?: string | null
          translation_language?: string | null
          created_at?: string
        }
        Update: {
          start_seconds?: number
          end_seconds?: number
          text?: string
          translation?: string | null
          translation_language?: string | null
        }
        Relationships: []
      }
      vocabulary_words: {
        Row: {
          id: string
          user_id: string
          video_id: string | null
          word: string
          phonetic: string | null
          phonetic_uk: string | null
          phonetic_us: string | null
          part_of_speech: string | null
          definition: string
          definition_translation: string | null
          examples: Json
          example_translations: Json
          common_phrases: Json
          word_analysis: Json
          dictionary_sources: Json
          ai_analysis: Json
          source_title: string
          source_timestamp_seconds: number
          source_sentence: string | null
          translation: string | null
          mastery: "new" | "learning" | "mastered"
          ease_factor: number
          interval_days: number
          repetitions: number
          due_at: string
          last_reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          video_id?: string | null
          word: string
          phonetic?: string | null
          phonetic_uk?: string | null
          phonetic_us?: string | null
          part_of_speech?: string | null
          definition: string
          definition_translation?: string | null
          examples?: Json
          example_translations?: Json
          common_phrases?: Json
          word_analysis?: Json
          dictionary_sources?: Json
          ai_analysis?: Json
          source_title: string
          source_timestamp_seconds?: number
          source_sentence?: string | null
          translation?: string | null
          mastery?: "new" | "learning" | "mastered"
          ease_factor?: number
          interval_days?: number
          repetitions?: number
          due_at?: string
          last_reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          word?: string
          phonetic?: string | null
          phonetic_uk?: string | null
          phonetic_us?: string | null
          part_of_speech?: string | null
          definition?: string
          definition_translation?: string | null
          examples?: Json
          example_translations?: Json
          common_phrases?: Json
          word_analysis?: Json
          dictionary_sources?: Json
          ai_analysis?: Json
          source_title?: string
          source_timestamp_seconds?: number
          source_sentence?: string | null
          translation?: string | null
          mastery?: "new" | "learning" | "mastered"
          ease_factor?: number
          interval_days?: number
          repetitions?: number
          due_at?: string
          last_reviewed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      vocabulary_tags: {
        Row: {
          vocabulary_id: string
          tag_id: string
          user_id: string
        }
        Insert: {
          vocabulary_id: string
          tag_id: string
          user_id: string
        }
        Update: never
        Relationships: []
      }
      review_logs: {
        Row: {
          id: string
          user_id: string
          vocabulary_id: string
          rating: number
          previous_interval_days: number
          next_interval_days: number
          reviewed_at: string
        }
        Insert: {
          id?: string
          user_id: string
          vocabulary_id: string
          rating: number
          previous_interval_days: number
          next_interval_days: number
          reviewed_at?: string
        }
        Update: never
        Relationships: []
      }
      playlists: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      playlist_items: {
        Row: {
          playlist_id: string
          video_id: string
          user_id: string
          position: number
          added_at: string
        }
        Insert: {
          playlist_id: string
          video_id: string
          user_id: string
          position?: number
          added_at?: string
        }
        Update: {
          position?: number
        }
        Relationships: []
      }
      study_sessions: {
        Row: {
          id: string
          user_id: string
          video_id: string
          started_at: string
          ended_at: string | null
          duration_seconds: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          video_id: string
          started_at?: string
          ended_at?: string | null
          duration_seconds?: number
          created_at?: string
        }
        Update: {
          ended_at?: string | null
          duration_seconds?: number
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
