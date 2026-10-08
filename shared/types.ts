export const languages = ["cpp17", "python3", "java17"] as const;
export type Language = (typeof languages)[number];
export type Difficulty = "very-easy" | "easy";
export interface TestCase {
  name: string;
  input: string;
  output: string;
}
export interface PublicProblem {
  id: string;
  title: string;
  difficulty: Difficulty;
  statement: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  starters: Record<Language, string>;
  samples: TestCase[];
}
export interface Problem extends PublicProblem {
  tests: TestCase[];
  solutions: Record<Language, string>;
  estimatedMinutes: number;
  fingerprint: string;
  ready: boolean;
}
export type Verdict =
  | "accepted"
  | "wrong-answer"
  | "compilation-error"
  | "runtime-error"
  | "time-limit-exceeded"
  | "memory-limit-exceeded"
  | "output-limit-exceeded"
  | "judging-error";
export interface JudgeResult {
  status: Verdict;
  passedTests: number;
  totalTests: number;
  executionTimeMs: number;
  message?: string;
  samples?: {
    input: string;
    expected: string;
    actual: string;
    status: Verdict;
  }[];
}
export interface PlayerView {
  id: string;
  name: string;
  connected: boolean;
  language: Language;
  submissions: number;
}
export interface MatchView {
  id: string;
  status: "active" | "settling" | "finished";
  startedAt: number;
  deadline: number;
  serverNow: number;
  problem: PublicProblem;
  winnerId?: string;
  winningLanguage?: Language;
  elapsedMs?: number;
}
export interface RoomView {
  code: string;
  hostId: string;
  players: PlayerView[];
  difficulty: Difficulty;
  problemId?: string;
  durationSeconds: number;
  clubFairMode: boolean;
  match?: MatchView;
}
export interface Reply {
  error?: string;
  room?: RoomView;
  token?: string;
  playerId?: string;
}
export interface Submission {
  requestId: string;
  source: string;
  language: Language;
  mode: "run" | "submit";
}
export interface ClientEvents {
  "room:create": (data: { name: string }, ack: (reply: Reply) => void) => void;
  "room:join": (
    data: { code: string; name: string },
    ack: (reply: Reply) => void,
  ) => void;
  "room:resume": (data: { token: string }, ack: (reply: Reply) => void) => void;
  "room:leave": (ack: (reply: Reply) => void) => void;
  "room:configure": (
    data: {
      difficulty?: Difficulty;
      problemId?: string;
      durationSeconds?: number;
      language?: Language;
      clubFairMode?: boolean;
    },
    ack: (reply: Reply) => void,
  ) => void;
  "match:start": (ack: (reply: Reply) => void) => void;
  "match:reset": (
    data: { newPlayers?: boolean },
    ack: (reply: Reply) => void,
  ) => void;
  "submission:create": (data: Submission, ack: (reply: Reply) => void) => void;
}
export interface ServerEvents {
  "room:updated": (room: RoomView) => void;
  "match:started": (room: RoomView) => void;
  "match:tick": (data: {
    matchId: string;
    serverNow: number;
    deadline: number;
  }) => void;
  "submission:started": (data: { requestId: string }) => void;
  "submission:result": (data: {
    requestId: string;
    matchId: string;
    mode: "run" | "submit";
    result: JudgeResult;
  }) => void;
  "match:finished": (room: RoomView) => void;
  "match:reset": () => void;
  "player:disconnected": (data: { playerId: string }) => void;
  "player:reconnected": (data: { playerId: string }) => void;
}
