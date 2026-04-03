export type ProjectType = 'pdf' | 'ppt' | 'image' | 'logo'
export type ProjectStatus = 'draft' | 'in_progress' | 'in_review' | 'published'
export type WorkspaceType = 'team' | 'personal' | 'publication'

export interface Project {
  id: string
  name: string
  type: ProjectType
  status: ProjectStatus
  workspace: WorkspaceType
  created_by: string
  team_id?: string
  file_url?: string
  thumbnail_url?: string
  briefing?: string
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  role: 'admin' | 'editor' | 'viewer'
  created_at: string
}

export interface Team {
  id: string
  name: string
  members: Profile[]
  created_at: string
}
