export interface SessionDoc {
  code: string;
  admin_key: string;
  planned_attendee_count: number;
  created_at: Date;
}

export interface MemberDoc {
  id: string;
  session_code: string;
  full_name: string;
  token: string;
  joined_at: Date;
  kicked_at: Date | null;
}

export interface PollDoc {
  id: string;
  session_code: string;
  problem: string;
  started_at: Date;
  ends_at: Date;
  duration_seconds: number;
  closed_at: Date | null;
  status: "open" | "closed";
  anonymous: boolean;
}

export interface VoteDoc {
  id: string;
  poll_id: string;
  session_code: string;
  member_id: string;
  full_name_snapshot: string;
  choice: "approve" | "deny";
  voted_at: Date;
}
