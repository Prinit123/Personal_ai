// src/types/index.ts — Shared TypeScript types for Nilesh (MyPersonalAI)

export type MessageRole = 'user' | 'assistant' | 'system' | 'error';

// ─── Navigation ──────────────────────────────────────────────────────────────

export type AppView =
  | 'dashboard'
  | 'chat'
  | 'speak'
  | 'correct-english'
  | 'write-message'
  | 'special-wishes'
  | 'teacher-messages'
  | 'translate'
  | 'english-practice'
  | 'saved-templates'
  | 'learning'
  | 'projects'
  | 'project-manager'
  | 'builder'
  | 'files'
  | 'research'
  | 'knowledge'
  | 'settings';

// ─── Communication & Language Types ──────────────────────────────────────────

export interface EnglishCorrectionResult {
  isAlreadyCorrect: boolean;
  corrected: string;
  explanation: string;
  grammarRule: string;
  variations: {
    conversational: string;
    polite: string;
    professional: string;
    formal: string;
    friendly: string;
    short: string;
  };
  hindiMeaning: string;
  gujaratiMeaning: string;
}

export interface GeneratedMessage {
  message: string;
  subject?: string;
  hindiVersion: string;
  gujaratiVersion: string;
  etiquetteTip: string;
}

export interface TranslationResult {
  detectedSource: string;
  translation: string;
  romanized: string;
  notes: string;
}

export interface PracticeTurnResult {
  feedback: string;
  betterWay: string | null;
  reply: string;
  questionForUser: string;
}

export interface SavedTemplate {
  id: string;
  title: string;
  category: string;
  recipient?: string;
  tone?: string;
  content: string;
  created_at: number;
}

// ─── Files ───────────────────────────────────────────────────────────────────

export interface ParsedFile {
  path:     string;
  content:  string;
  language: string;
}

export interface FileNode {
  name:       string;
  path:       string;
  type:       'file' | 'directory';
  children?:  FileNode[];
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export interface ChatAttachment {
  id:               string;
  name:             string;
  url:              string;
  size:             number;
  type:             'image' | 'file';
  mimeType:         string;
  localPreviewUrl?: string;
}

export interface ChatMessage {
  id:              string;
  role:            MessageRole;
  content:         string;
  timestamp:       number;
  isStreaming?:    boolean;
  searchResults?:  SearchResult[];
  tokensUsed?:     number;
  files?:          ParsedFile[];
  attachments?:    ChatAttachment[];
  provider?:       string;
  model?:          string;
  cached?:         boolean;
  loadTimeMs?:     number;
  evalTimeMs?:     number;
  tokensPerSecond?: string;
}

export interface Conversation {
  id:             string;
  title:          string;
  created_at:     number;
  updated_at:     number;
  project_id?:    string;
  model?:         string;
  provider?:      string;
  message_count?: number;
  messages?:      StoredMessage[];
}

export interface StoredMessage {
  id:              string;
  conversation_id: string;
  role:            MessageRole;
  content:         string;
  created_at:      number;
  tokens_used?:    number;
  search_results?: string;
  attachments?:    string; // JSON string in SQLite
}

// ─── Projects ────────────────────────────────────────────────────────────────

export interface Project {
  id:              string;
  name:            string;
  description:     string;
  path:            string;
  createdAt:       number;
  updatedAt:       number;
  status:          'idle' | 'running' | 'error';
  filesCount?:     number;
  generatedFiles?: number;
  category?:       'beginner' | 'mern' | 'datascience' | 'advanced' | 'custom';
  technologies?:   string[];
}

// ─── Project Library Templates ────────────────────────────────────────────────

export interface ProjectTemplate {
  id:            string;
  name:          string;
  description:   string;
  category:      'beginner' | 'mern' | 'datascience' | 'advanced';
  difficulty:    'Beginner' | 'Intermediate' | 'Advanced';
  technologies:  string[];
  icon:          string;
  features:      string[];
  estimatedTime: string;
  prompt:        string;
}

// ─── Builder ─────────────────────────────────────────────────────────────────

export interface BuilderPlan {
  projectName:          string;
  title:                string;
  description:          string;
  pages?:               string[];
  features?:            string[];
  models?:              Array<{ name: string; fields: string[] }>;
  apiEndpoints?:        string[];
  dependencies?:        { frontend?: string[]; backend?: string[] };
  estimatedFiles:       number;
  requiresAuth:         boolean;
  requiresMongoDB:      boolean;
  clarifyingQuestions?: string[];
}

// ─── Search ──────────────────────────────────────────────────────────────────

export interface SearchResult {
  title:   string;
  url:     string;
  snippet: string;
  source:  string;
}

export interface SearchResponse {
  query:        string;
  results:      SearchResult[];
  provider:     string;
  warning?:     string;
  elapsedMs:    number;
  retrievedAt:  string;
}

// ─── Knowledge ───────────────────────────────────────────────────────────────

export interface KnowledgeSource {
  id:         string;
  name:       string;
  type:       'file' | 'url' | 'note';
  path?:      string;
  url?:       string;
  content?:   string;
  tags:       string;
  created_at: number;
  updated_at: number;
}

// ─── System Status & Settings ────────────────────────────────────────────────

export interface SystemStatus {
  backend:             string;
  configuredProvider?: string;
  activeProvider:      string;
  activeModel:         string;
  gemini:              string;
  ollama:              string;
  ollamaModels:        string[];
  internet:            string;
  memoryEnabled?:      boolean;
  cacheEnabled?:       boolean;
  uptime:              number;
  timestamp:           string;
}

export interface AppSettings {
  ai_provider:          string;
  resolved_provider?:   string;
  ai_model:             string;
  theme:                string;
  gemini_configured:    string;
  online_enabled?:      string;
  local_smart_routing?: string;
  ollama_keep_alive?:   string;
  ollama_num_predict?:  string;
  ollama_num_ctx?:      string;
  max_local_history?:   string;
  memory_enabled?:      string;
  memory_ttl_days?:     string;
  cache_enabled?:       string;
  cache_ttl_days?:      string;
  project_rag_enabled?: string;
  ollama_base_url?:     string;
  web_search_enabled?:  string;
  search_provider?:     string;
  explanation_level?:   string;
}

export interface TemporaryMemoryItem {
  id:         string;
  key:        string;
  value:      string;
  category:   string;
  created_at: number;
  expires_at: number;
}

export interface CacheStats {
  count:     number;
  totalHits: number;
}

// ─── Learning System ─────────────────────────────────────────────────────────

export type LearningTopic =
  | 'python' | 'javascript' | 'java' | 'c' | 'cpp' | 'sql' | 'react' | 'nodejs'
  | 'dsa' | 'machine-learning' | 'data-science' | 'mern' | 'html-css' | 'mongodb';

export type Difficulty = 'medium' | 'hard' | 'advanced';

export interface LearningChallenge {
  id:              string;
  topic:           LearningTopic;
  difficulty:      Difficulty;
  title:           string;
  problem:         string;
  examples?:       Array<{ input: string; output: string; explanation?: string }>;
  constraints?:    string[];
  hints:           string[];
  solution:        string;
  explanation:     string;
  timeComplexity?: string;
  spaceComplexity?: string;
  testCases?:      Array<{ input: string; expected: string }>;
  commonMistakes?: string[];
  followUp?:       string[];
}

// ─── File Manager & Scanner Types ──────────────────────────────────────────

export interface FileManagerConfig {
  success: boolean;
  username: string;
  platform: string;
  downloadsDir: string;
  nileshBaseDir: string;
  subFolders: {
    projects: string;
    documents: string;
    mlProjects: string;
    codeExamples: string;
    backups: string;
  };
  workspaceProjectsDir: string;
  downloadsOrgMode: 'organized' | 'direct';
  autoSaveEnabled: boolean;
  saveToDownloads: boolean;
}

export interface ScanResult {
  success: boolean;
  projectPath: string;
  projectName: string;
  totalFiles: number;
  totalBytes: number;
  primaryLanguages: Array<{ ext: string; count: number }>;
  frameworks: string[];
  entryPoints: string[];
  configFiles: string[];
  dependenciesCount: number;
  dependenciesList: string[];
  missingConfigs: string[];
  likelyErrors: string[];
  runInstructions: string[];
  scannedAt: number;
}

export interface FileOperationRecord {
  id: string;
  type: string;
  name: string;
  target_path: string;
  file_count: number;
  size_bytes: number;
  status: string;
  created_at: number;
}
