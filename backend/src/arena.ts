import { randomBytes, randomUUID } from "node:crypto";
import type {
  Difficulty,
  Language,
  Problem,
  RoomView,
  PlayerView,
  Submission,
  JudgeResult,
} from "../../shared/types";
import { publicProblem, type ProblemRegistry } from "./problems/registry";
import type { Judge } from "./judge";
interface Player extends PlayerView {
  token: string;
  socketId?: string;
  expiresAt: number;
  busy: boolean;
}
interface Entry {
  seq: number;
  playerId: string;
  language: Language;
  receivedAt: number;
  result?: JudgeResult;
}
interface Match {
  id: string;
  status: "active" | "settling" | "finished";
  startedAt: number;
  deadline: number;
  problem: Problem;
  entries: Entry[];
  winnerId?: string;
  winningLanguage?: Language;
  elapsedMs?: number;
  requests: Set<string>;
}
interface Room {
  code: string;
  hostId: string;
  players: Player[];
  difficulty: Difficulty;
  problemId?: string;
  durationSeconds: number;
  clubFairMode: boolean;
  match?: Match;
  lastProblems: string[];
  updatedAt: number;
}
export class Arena {
  rooms = new Map<string, Room>();
  recent: RoomView[] = [];
  constructor(
    public registry: ProblemRegistry,
    private judge: Judge,
    private broadcast: (code: string, event: string, data: unknown) => void,
    private privateEmit: (
      socketId: string,
      event: string,
      data: unknown,
    ) => void,
    private now = () => Date.now(),
  ) {}
  view(r: Room): RoomView {
    return {
      code: r.code,
      hostId: r.hostId,
      players: r.players.map(
        ({ id, name, connected, language, submissions }) => ({
          id,
          name,
          connected,
          language,
          submissions,
        }),
      ),
      difficulty: r.difficulty,
      problemId: r.problemId,
      durationSeconds: r.durationSeconds,
      clubFairMode: r.clubFairMode,
      match: r.match
        ? {
            id: r.match.id,
            status: r.match.status,
            startedAt: r.match.startedAt,
            deadline: r.match.deadline,
            serverNow: this.now(),
            problem: publicProblem(r.match.problem),
            winnerId: r.match.winnerId,
            winningLanguage: r.match.winningLanguage,
            elapsedMs: r.match.elapsedMs,
          }
        : undefined,
    };
  }
  update(r: Room) {
    r.updatedAt = this.now();
    this.broadcast(r.code, "room:updated", this.view(r));
  }
  player(name: string, socketId: string): Player {
    if (typeof name !== "string" || !name.trim() || name.trim().length > 24)
      throw Error("Enter a name between 1 and 24 characters.");
    return {
      id: randomUUID(),
      token: randomBytes(32).toString("hex"),
      name: name.trim(),
      socketId,
      connected: true,
      language: "cpp17",
      submissions: 0,
      expiresAt: this.now() + 2 * 3600000,
      busy: false,
    };
  }
  find(socketId: string) {
    for (const room of this.rooms.values()) {
      const player = room.players.find((p) => p.socketId === socketId);
      if (player) return { room, player };
    }
    throw Error("Join a room first.");
  }
  create(name: string, socketId: string) {
    try {
      this.find(socketId);
      throw Error("Leave your current room first.");
    } catch (e) {
      if ((e as Error).message !== "Join a room first.") throw e;
    }
    if (this.rooms.size >= 100)
      throw Error(
        "Too many rooms. Ask the organizer to reset unused stations.",
      );
    let code: string;
    do {
      code = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
    } while (this.rooms.has(code));
    const player = this.player(name, socketId);
    const room: Room = {
      code,
      hostId: player.id,
      players: [player],
      difficulty: "very-easy",
      durationSeconds: 300,
      clubFairMode: process.env.CLUB_FAIR_MODE !== "false",
      lastProblems: [],
      updatedAt: this.now(),
    };
    this.rooms.set(code, room);
    return { room: this.view(room), token: player.token, playerId: player.id };
  }
  join(code: string, name: string, socketId: string) {
    try {
      this.find(socketId);
      throw Error("Leave your current room first.");
    } catch (e) {
      if ((e as Error).message !== "Join a room first.") throw e;
    }
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw Error("Room not found or expired.");
    if (room.players.length >= 2)
      throw Error("This room already has two players.");
    if (room.match) throw Error("This room is in a match.");
    const player = this.player(name, socketId);
    room.players.push(player);
    this.update(room);
    return { room: this.view(room), token: player.token, playerId: player.id };
  }
  resume(token: string, socketId: string) {
    for (const room of this.rooms.values()) {
      const player = room.players.find(
        (p) => p.token === token && p.expiresAt > this.now(),
      );
      if (player) {
        if (player.connected && player.socketId !== socketId)
          throw Error("This player is already connected in another tab.");
        player.socketId = socketId;
        player.connected = true;
        player.expiresAt = this.now() + 2 * 3600000;
        this.broadcast(room.code, "player:reconnected", {
          playerId: player.id,
        });
        this.update(room);
        return {
          room: this.view(room),
          playerId: player.id,
          token: player.token,
        };
      }
    }
    throw Error("Your session expired. Create or join a room again.");
  }
  disconnect(socketId: string) {
    try {
      const { room, player } = this.find(socketId);
      player.connected = false;
      player.socketId = undefined;
      this.broadcast(room.code, "player:disconnected", { playerId: player.id });
      this.update(room);
    } catch {}
  }
  leave(socketId: string) {
    const { room, player } = this.find(socketId);
    if (room.match && room.match.status !== "finished") {
      player.token = "";
      player.expiresAt = 0;
      this.disconnect(socketId);
      return;
    }
    room.players = room.players.filter((p) => p.id !== player.id);
    if (!room.players.length) this.rooms.delete(room.code);
    else {
      room.hostId = room.players[0].id;
      this.update(room);
    }
  }
  configure(
    socketId: string,
    data: {
      difficulty?: Difficulty;
      problemId?: string;
      durationSeconds?: number;
      language?: Language;
      clubFairMode?: boolean;
    },
  ) {
    const { room, player } = this.find(socketId);
    if (room.match) throw Error("Reset the match before changing settings.");
    if (data.language) player.language = data.language;
    const hostSetting = Object.keys(data).some((k) => k !== "language");
    if (hostSetting && room.hostId !== player.id)
      throw Error("Only the host can change match settings.");
    if (data.difficulty) {
      room.difficulty = data.difficulty;
      room.problemId = undefined;
    }
    if (data.problemId !== undefined) {
      if (
        data.problemId &&
        !this.registry
          .eligible()
          .some(
            (p) => p.id === data.problemId && p.difficulty === room.difficulty,
          )
      )
        throw Error("Problem is unavailable or not validated.");
      room.problemId = data.problemId || undefined;
    }
    if (data.durationSeconds !== undefined)
      room.durationSeconds = data.durationSeconds;
    if (data.clubFairMode !== undefined) {
      room.clubFairMode = data.clubFairMode;
      if (data.clubFairMode) {
        room.durationSeconds = 300;
        room.difficulty = "very-easy";
        room.problemId = undefined;
      }
    }
    this.update(room);
  }
  start(socketId: string) {
    const { room, player } = this.find(socketId);
    if (room.hostId !== player.id) throw Error("Only the host can start.");
    if (room.players.length !== 2 || room.players.some((p) => !p.connected))
      throw Error("Both players must be connected.");
    if (room.match) throw Error("Reset the previous match first.");
    let eligible = this.registry
      .eligible()
      .filter(
        (p) =>
          p.difficulty === room.difficulty &&
          (!room.problemId || p.id === room.problemId),
      );
    if (!eligible.length)
      throw Error(
        "No validated problems available. Ask the organizer to run problems:validate.",
      );
    const fresh = eligible.filter((p) => !room.lastProblems.includes(p.id));
    if (fresh.length) eligible = fresh;
    const problem = structuredClone(
      eligible[Math.floor(Math.random() * eligible.length)],
    );
    room.lastProblems = [...room.lastProblems, problem.id].slice(-5);
    const now = this.now();
    room.match = {
      id: randomUUID(),
      status: "active",
      startedAt: now,
      deadline: now + room.durationSeconds * 1000,
      problem,
      entries: [],
      requests: new Set(),
    };
    room.players.forEach((p) => {
      p.submissions = 0;
      p.busy = false;
    });
    this.broadcast(room.code, "match:started", this.view(room));
    this.update(room);
  }
  finish(room: Room, entry?: Entry) {
    const m = room.match!;
    if (m.status === "finished") return;
    m.status = "finished";
    if (entry) {
      m.winnerId = entry.playerId;
      m.winningLanguage = entry.language;
      m.elapsedMs = entry.receivedAt - m.startedAt;
    } else m.elapsedMs = m.deadline - m.startedAt;
    const view = this.view(room);
    this.recent.unshift(view);
    this.recent = this.recent.slice(0, 50);
    this.broadcast(room.code, "match:finished", view);
    this.update(room);
  }
  settle(room: Room) {
    const m = room.match!;
    if (m.status === "finished") return;
    for (const entry of m.entries) {
      if (!entry.result) return;
      if (entry.result.status === "accepted") {
        this.finish(room, entry);
        return;
      }
    }
    if (this.now() >= m.deadline) this.finish(room);
  }
  async submit(socketId: string, data: Submission) {
    const receivedAt = this.now();
    const { room, player } = this.find(socketId);
    const m = room.match;
    if (!m || m.status !== "active" || receivedAt >= m.deadline)
      throw Error("The submission window has closed.");
    if (player.busy) throw Error("Wait for your current evaluation.");
    if (!data.source.trim()) throw Error("Write a solution first.");
    if (m.requests.has(data.requestId)) throw Error("Duplicate request.");
    if (m.requests.size >= 200) throw Error("Match submission limit reached.");
    m.requests.add(data.requestId);
    player.busy = true;
    player.language = data.language;
    const entry: Entry = {
      seq: m.entries.length,
      playerId: player.id,
      language: data.language,
      receivedAt,
    };
    if (data.mode === "submit") {
      m.entries.push(entry);
      player.submissions++;
    }
    this.privateEmit(socketId, "submission:started", {
      requestId: data.requestId,
    });
    this.update(room);
    let result: JudgeResult;
    try {
      result = await this.judge(
        m.problem,
        data.language,
        data.source,
        data.mode,
      );
    } catch {
      result = {
        status: "judging-error",
        passedTests: 0,
        totalTests: 0,
        executionTimeMs: 0,
        message: "The local judge failed. Please retry.",
      };
    }
    if (room.match !== m) return;
    player.busy = false;
    if (data.mode === "submit") entry.result = result;
    // Hidden inputs, expected output and stderr must never reach visitors.
    const safe: JudgeResult = {
      status: result.status,
      passedTests: result.passedTests,
      totalTests: result.totalTests,
      executionTimeMs: result.executionTimeMs,
    };
    if (data.mode === "run") {
      safe.samples = result.samples;
      safe.message = result.message;
    } else if (result.status === "compilation-error")
      safe.message = result.message;
    else if (result.status === "judging-error")
      safe.message =
        "The local judge could not evaluate your solution. Please retry.";
    if (player.socketId)
      this.privateEmit(player.socketId, "submission:result", {
        requestId: data.requestId,
        matchId: m.id,
        mode: data.mode,
        result: safe,
      });
    if (data.mode === "submit") this.settle(room);
    this.update(room);
  }
  reset(socketId: string, newPlayers = false) {
    const { room, player } = this.find(socketId);
    if (room.hostId !== player.id) throw Error("Only the host can reset.");
    this.forceReset(room.code, newPlayers);
  }
  forceReset(code: string, newPlayers = true) {
    const room = this.rooms.get(code);
    if (!room) throw Error("Room not found.");
    if (newPlayers) {
      this.broadcast(code, "match:reset", {});
      this.rooms.delete(code);
    } else {
      room.match = undefined;
      room.problemId = undefined;
      room.players.forEach((p) => {
        p.busy = false;
        p.submissions = 0;
      });
      this.update(room);
    }
  }
  tick() {
    for (const room of this.rooms.values()) {
      const m = room.match;
      if (m && m.status !== "finished") {
        const wasActive = m.status === "active";
        if (this.now() >= m.deadline) {
          m.status = "settling";
          this.settle(room);
        }
        if (room.match?.status !== "finished")
          this.broadcast(room.code, "match:tick", {
            matchId: m.id,
            serverNow: this.now(),
            deadline: m.deadline,
          });
        if (wasActive && m.status !== "active") this.update(room);
      }
      if (
        !room.players.some((p) => p.connected) &&
        this.now() - room.updatedAt > 2 * 3600000
      )
        this.rooms.delete(room.code);
    }
  }
}
