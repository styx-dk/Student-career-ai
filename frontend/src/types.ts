export type Profile = {
  id: string;
  full_name: string;
  headline: string;
  email?: string;
  phone?: string;
  location?: string;
  preferred_domains: string[];
  target_role?: string;
  preferred_llm_provider?: "ollama" | "gemini";
  summary?: string;
};
export type CareerRecord = {
  id: string;
  record_type: string;
  title: string;
  organization?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  credential_id?: string;
  skills: string[];
  evidence_state: string;
  source_document_id?: string;
  created_at: string;
};
export type DocumentItem = {
  id: string;
  original_filename: string;
  display_name: string;
  mime_type: string;
  file_size: number;
  category: string;
  processing_status: string;
  extraction_error?: string;
  extraction?: Record<string, unknown>;
  confirmed_result?: Record<string, unknown>;
  is_confirmed: boolean;
  created_at: string;
};
export type JD = {
  id: string;
  name: string;
  job_title?: string;
  company?: string;
  domain?: string;
  raw_text: string;
  analysis?: { general_competencies?: string[]; requirement_method?: string; responsibilities?: string[]; qualifications?: string[] };
  requirements: Array<{ skill: string; importance: string; weight: number; category?: string; evidence_expectation?: string; source_excerpt?: string | null }>;
  created_at: string;
};
export type Match = {
  score: number;
  skill_coverage: number;
  semantic_relevance: number;
  evidence_coverage: number;
  requirements: Array<{
    skill: string;
    classification: string;
    similarity: number;
    evidence: Array<{ title: string; type: string }>;
    weight: number;
    importance?: string;
    category?: string;
    evidence_expectation?: string;
    source_excerpt?: string | null;
  }>;
  disclaimer: string;
};
export type Action = {
  id: string;
  action_name: string;
  action_type: string;
  skills_gained: string[];
  related_domain?: string;
  effort_cost: number;
  description: string;
};
