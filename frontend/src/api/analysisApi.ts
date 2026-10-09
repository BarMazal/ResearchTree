import { api } from "./client";

export type ProfileData = {
  id: string;
  username: string;
  display_name: string | null;
  is_qa: boolean;
  created_at: string;
  updated_at: string;
};

export type EventData = {
  id: string;
  profile_id: string;
  event_class: string;
  category: string | null;
  goal_type: string;
  goal_description: string | null;
  status: string;
  player_white: string | null;
  player_black: string | null;
  initial_fen: string | null;
  created_at: string;
};

export type NodeAnalysisData = {
  id: string;
  node_id: string;
  status: string;
  stockfish_eval: number | null;
  eval_delta: number | null;
  category_class: string | null;
  sub_category: string | null;
  quality_score: number | null;
  reasoning: string | null;
  opportunity_created: boolean;
  opportunity_executed: boolean;
  material_yield: number;
  opponent_threat_created: boolean;
  defensive_failure: boolean;
  material_damage: number;
  phase: string | null;
  analyzed_at: string | null;
};

export type DAGNodeData = {
  id: string;
  event_id: string;
  profile_id: string;
  parent_id: string | null;
  move_san: string | null;
  move_uci: string | null;
  fen: string;
  move_index: number;
  is_leaf: boolean;
  leaf_termination: string | null;
  clock_remaining_sec: number | null;
  move_time_sec: number | null;
  blunder_count_so_far: number;
  missed_opportunity_count_so_far: number;
  blunder_frequency: number;
  missed_opportunity_frequency: number;
  created_at: string;
  analysis?: NodeAnalysisData | null;
};

export type EventDAGResponse = {
  event: EventData;
  node_count: number;
  leaf_hash: Record<string, { move_index: number; termination: string | null; fen: string; blunder_frequency: number }>;
  nodes: DAGNodeData[];
};

export type SavedFilterData = {
  id: string;
  profile_id: string;
  name: string;
  filter_config: Record<string, unknown>;
  created_at: string;
};

export type CategorySettingData = {
  id: string;
  profile_id: string;
  category_key: string;
  is_custom: boolean;
  status: string;
  occurrence_count: number;
  created_at: string;
  updated_at: string;
};

export type EloHistoryItem = {
  event_id: string;
  event_number: number;
  created_at: string | null;
  event_class: string;
  category: string | null;
  opponent_name: string;
  opponent_type: "human" | "bot";
  opponent_elo: number;
  player_elo_before: number;
  player_elo_after: number;
  result_score: number;
  wins: number;
  draws: number;
  losses: number;
  win_rate: number;
};

export type EloHistoryResponse = {
  profile_id: string;
  username: string;
  total_events: number;
  current_elo: number;
  overall_win_rate: number;
  history: EloHistoryItem[];
};

export const analysisApi = {
  // Profiles
  getProfiles: () => api.get<ProfileData[]>("/profiles"),
  createProfile: (data: { username: string; display_name?: string; is_qa?: boolean }) =>
    api.post<ProfileData>("/profiles", data),
  getEloHistory: (profileId: string) => api.get<EloHistoryResponse>(`/profiles/${profileId}/analytics/elo-history`),

  // Events
  getEvents: (profileId?: string, eventClass?: string) => {
    const params = new URLSearchParams();
    if (profileId) params.set("profile_id", profileId);
    if (eventClass) params.set("event_class", eventClass);
    return api.get<EventData[]>(`/events?${params.toString()}`);
  },
  createEvent: (data: Partial<EventData>) => api.post<EventData>("/events", data),
  getEventDAG: (eventId: string) => api.get<EventDAGResponse>(`/events/${eventId}/dag`),
  recordMove: (eventId: string, move: { move_san: string; move_uci?: string; fen: string; clock_remaining_sec?: number; move_time_sec?: number }) =>
    api.post<DAGNodeData>(`/events/${eventId}/moves`, move),
  undoMove: (eventId: string, targetNodeId?: string) =>
    api.post<DAGNodeData>(`/events/${eventId}/undo`, { target_node_id: targetNodeId }),
  restartEvent: (eventId: string) =>
    api.post<DAGNodeData>(`/events/${eventId}/restart`, {}),

  // Saved Filters
  getSavedFilters: (profileId: string) => api.get<SavedFilterData[]>(`/saved-filters?profile_id=${profileId}`),
  createSavedFilter: (data: { profile_id: string; name: string; filter_config: Record<string, unknown> }) =>
    api.post<SavedFilterData>("/saved-filters", data),
  deleteSavedFilter: (id: string) => api.delete(`/saved-filters/${id}`),

  // Category Settings
  getCategorySettings: (profileId: string) => api.get<CategorySettingData[]>(`/category-settings?profile_id=${profileId}`),
  updateCategorySetting: (id: string, status: string) =>
    api.put<CategorySettingData>(`/category-settings/${id}`, { status }),
  createCategorySetting: (data: { profile_id: string; category_key: string; is_custom?: boolean; status?: string }) =>
    api.post<CategorySettingData>("/category-settings", data),

  // Lichess Explorer & Import
  exploreLichessUser: (username: string, maxGames = 10) =>
    api.get<{ username: string; count: number; games: any[] }>(`/lichess/user/${username}/games?max_games=${maxGames}`),
  importLichessGames: (profile_id: string, username: string, max_games = 5) =>
    api.post<EventData[]>("/lichess/import", { profile_id, username, max_games }),
};
