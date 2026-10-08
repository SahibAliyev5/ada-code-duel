import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import Markdown from "react-markdown";
import {
  ArrowRight,
  Code2,
  Copy,
  Flag,
  HelpCircle,
  LogOut,
  Play,
  RotateCcw,
  Shield,
  Swords,
  Terminal,
  Trophy,
  Users,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import {
  languages,
  type ClientEvents,
  type ServerEvents,
  type RoomView,
  type Reply,
  type Language,
  type JudgeResult,
  type Difficulty,
} from "../../shared/types";
const CodeEditor = lazy(() => import("./editor"));
const labels: Record<Language, string> = {
  cpp17: "C++17",
  python3: "Python 3",
  java17: "Java 17",
};
export function formatTime(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}
const verdictLabel = (s: string) =>
  s
    .split("-")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
export default function App() {
  const socketRef = useRef<Socket<ServerEvents, ClientEvents> | null>(null);
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState<RoomView>();
  const [playerId, setPlayerId] = useState(
    sessionStorage.getItem("ada-player") || "",
  );
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [help, setHelp] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [language, setLanguage] = useState<Language>("cpp17");
  const [drafts, setDrafts] = useState<Partial<Record<Language, string>>>({});
  const [result, setResult] = useState<JudgeResult>();
  const [resultMode, setResultMode] = useState("");
  const [clock, setClock] = useState(Date.now());
  const offset = useRef(0);
  const [problemList, setProblemList] = useState<
    { id: string; title: string; difficulty: Difficulty }[]
  >([]);
  const [organizer, setOrganizer] = useState(false);
  const [readyCount, setReadyCount] = useState<number>();
  const roomRef = useRef<RoomView | undefined>(undefined);
  roomRef.current = room;
  const clear = () => {
    sessionStorage.removeItem("ada-token");
    sessionStorage.removeItem("ada-player");
    sessionStorage.removeItem("ada-draft");
    setRoom(undefined);
    setPlayerId("");
    setResult(undefined);
    setDrafts({});
    setBusy(false);
    setName("");
    setCode("");
    setError("");
  };
  useEffect(() => {
    const s: Socket<ServerEvents, ClientEvents> = io({ autoConnect: false });
    socketRef.current = s;
    const update = (r: RoomView) => {
      setRoom(r);
      if (r.match) offset.current = r.match.serverNow - Date.now();
    };
    s.on("connect", () => {
      setConnected(true);
      const token = sessionStorage.getItem("ada-token");
      if (token)
        s.emit("room:resume", { token }, (r) => {
          if (r.error) {
            clear();
            setError(r.error);
          } else {
            update(r.room!);
            setPlayerId(r.playerId!);
            setLanguage(
              r.room!.players.find((p) => p.id === r.playerId)?.language ||
                "cpp17",
            );
            sessionStorage.setItem("ada-player", r.playerId!);
          }
        });
    });
    s.on("disconnect", () => {
      setConnected(false);
      setBusy(false);
      setPending(false);
    });
    s.on("room:updated", update);
    s.on("match:started", (r) => {
      setDrafts({});
      setResult(undefined);
      setBusy(false);
      update(r);
    });
    s.on("match:finished", update);
    s.on("match:reset", () => clear());
    s.on("match:tick", (t) => {
      if (roomRef.current?.match?.id === t.matchId) {
        offset.current = t.serverNow - Date.now();
        setClock(Date.now());
      }
    });
    s.on("submission:started", () => setBusy(true));
    s.on("submission:result", (data) => {
      if (roomRef.current?.match?.id !== data.matchId) return;
      setBusy(false);
      setResult(data.result);
      setResultMode(data.mode);
    });
    s.connect();
    const timer = setInterval(() => setClock(Date.now()), 250);
    fetch("/api/problems")
      .then((r) => r.json())
      .then(setProblemList)
      .catch(() => {});
    fetch("/api/health")
      .then((r) => r.json())
      .then((r) => setReadyCount(r.readyProblems))
      .catch(() => {});
    return () => {
      clearInterval(timer);
      s.disconnect();
      socketRef.current = null;
    };
  }, []);
  useEffect(() => {
    let restored: Partial<Record<Language, string>> = {};
    try {
      const saved = JSON.parse(sessionStorage.getItem("ada-draft") || "null");
      if (saved?.matchId === room?.match?.id) restored = saved.drafts;
    } catch {}
    setDrafts(restored);
    setResult(undefined);
    setBusy(false);
  }, [room?.match?.id]);
  const updateDraft = (value: string) => {
    const next = { ...drafts, [language]: value };
    setDrafts(next);
    try {
      sessionStorage.setItem(
        "ada-draft",
        JSON.stringify({ matchId: room?.match?.id, drafts: next }),
      );
    } catch {}
  };
  const ack = (reply: Reply) => {
    setPending(false);
    if (reply.error) {
      setError(reply.error);
      setBusy(false);
      return;
    }
    setError("");
    if (reply.room) setRoom(reply.room);
    if (reply.token) {
      sessionStorage.setItem("ada-token", reply.token);
      sessionStorage.setItem("ada-player", reply.playerId!);
      setPlayerId(reply.playerId!);
    }
  };
  const enter = () => {
    if (!connected) return;
    setPending(true);
    if (joining) socketRef.current!.emit("room:join", { name, code }, ack);
    else socketRef.current!.emit("room:create", { name }, ack);
  };
  const leave = () =>
    socketRef.current?.emit("room:leave", (r) => {
      if (r.error) setError(r.error);
      else clear();
    });
  const configure = (data: Parameters<ClientEvents["room:configure"]>[0]) =>
    socketRef.current?.emit("room:configure", data, ack);
  const me = room?.players.find((p) => p.id === playerId);
  const host = room?.hostId === playerId;
  const startBlocker = !connected
    ? "Reconnecting to the arena. Wait for the connection to return."
    : !host
      ? "The room host will start the race once both players are ready."
      : room &&
          (room.players.length !== 2 || room.players.some((p) => !p.connected))
        ? "Waiting for a second connected player. Open this website on another laptop and join with the room code."
        : readyCount !== undefined &&
            !problemList.some((p) => p.difficulty === room?.difficulty)
          ? "No validated problems are available for this difficulty. The organizer must start the Docker judge, run npm run problems:validate, then restart the app and refresh this page."
          : "";
  const startRace = () => {
    if (startBlocker || pending) return;
    setPending(true);
    setError("");
    socketRef.current
      ?.timeout(5000)
      .emit("match:start", (timeoutError, reply) => {
        if (timeoutError) {
          setPending(false);
          setError(
            "The server did not respond. Check your connection and try again.",
          );
        } else ack(reply);
      });
  };
  const match = room?.match;
  const source = drafts[language] ?? match?.problem.starters[language] ?? "";
  const remaining = match
    ? match.status === "finished"
      ? 0
      : Math.max(0, match.deadline - clock - offset.current)
    : 300000;
  // UUID generation works on LAN HTTP addresses as well as localhost.
  const newRequestId = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
      "",
    );
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  };
  const evaluate = (mode: "run" | "submit") => {
    setError("");
    setBusy(true);
    setResult(undefined);
    socketRef.current?.emit(
      "submission:create",
      { requestId: newRequestId(), source, language, mode },
      ack,
    );
  };
  return (
    <div
      className={`app ${match && match.status !== "finished" ? "arena-app" : ""}`}
    >
      <header className="nav">
        <button className="brand" onClick={() => !room && setOrganizer(false)}>
          <span className="brand-icon">
            <Code2 size={22} />
          </span>
          <span>
            ADA <b>CODE RACE</b>
            <small>COMPETITIVE PROGRAMMING CLUB</small>
          </span>
        </button>
        <div className="nav-right">
          <span className={`connection ${connected ? "online" : ""}`}>
            {connected ? <Wifi size={14} /> : <WifiOff size={14} />}{" "}
            {connected ? "Local arena online" : "Connecting…"}
          </span>
          {room ? (
            <button className="quiet" onClick={leave}>
              <LogOut size={16} /> Leave room
            </button>
          ) : (
            <button className="quiet" onClick={() => setOrganizer(!organizer)}>
              <Shield size={16} /> Organizer
            </button>
          )}
        </div>
      </header>
      {!connected && room && (
        <div className="banner">
          Connection lost. Reconnecting to your match… The server timer
          continues.
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}
      {organizer && !room ? (
        <Organizer onBack={() => setOrganizer(false)} />
      ) : !room ? (
        <main className="home">
          <div className="eyebrow">
            <span className="dot" /> ADA UNIVERSITY · CLUB FAIR ARENA
          </div>
          <h1>
            A little code.
            <br />A friendly <span>rivalry.</span>
          </h1>
          <p className="subtitle">
            Challenge a friend. Solve the problem. Win the race.
          </p>
          <div className="entry-grid">
            <section className="card create-card">
              <div className="card-icon">
                <Swords />
              </div>
              <h2>{joining ? "Join the race" : "Ready, set, code."}</h2>
              <p>
                {joining
                  ? "Enter your friend’s room code and take your seat."
                  : "Create a room and invite a friend. Your next five-minute challenge starts here."}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  enter();
                }}
              >
                <label htmlFor="name">Your display name</label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={24}
                  required
                  placeholder="e.g. Ada"
                  autoComplete="off"
                />
                {joining && (
                  <>
                    <label htmlFor="room-code">Room code</label>
                    <input
                      id="room-code"
                      className="code-input"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      minLength={6}
                      maxLength={6}
                      required
                      placeholder="A1B2C3"
                      autoComplete="off"
                    />
                  </>
                )}
                <button
                  className="primary full"
                  disabled={!connected || pending}
                >
                  {pending
                    ? "Connecting…"
                    : joining
                      ? "Join Room"
                      : "Create Room"}
                  <ArrowRight size={18} />
                </button>
              </form>
              <button
                className="switch-entry"
                onClick={() => {
                  setJoining(!joining);
                  setError("");
                }}
              >
                {joining
                  ? "Want to host? Create a room"
                  : "Have a room code? Join Room"}
                <ArrowRight size={14} />
              </button>
            </section>
            <section className="card race-card">
              <div className="race-graphic">
                <div className="code-tile">
                  <Code2 size={48} />
                </div>
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <span className="graphic-tag">FIRST ACCEPTED WINS</span>
                <span className="graphic-clock">05:00</span>
              </div>
              <div className="race-details">
                <div>
                  <span className="mini-icon">
                    <Users size={18} />
                  </span>
                  <b>Two players. One problem.</b>
                  <p>Same challenge, your language of choice.</p>
                </div>
                <div>
                  <span className="mini-icon">
                    <Zap size={18} />
                  </span>
                  <b>Five minutes to make it count.</b>
                  <p>Beginner-friendly problems. Instant feedback.</p>
                </div>
              </div>
              <div className="language-pills">
                <span>C++17</span>
                <span>Python 3</span>
                <span>Java 17</span>
              </div>
            </section>
          </div>
          <button className="how-button" onClick={() => setHelp(true)}>
            <HelpCircle size={17} /> First time here? How to Play
          </button>
          {readyCount === 0 && (
            <p className="setup-note">
              The organizer needs to validate the problem library before matches
              can start.
            </p>
          )}
        </main>
      ) : !match ? (
        <main className="lobby">
          <div className="eyebrow">THE STARTING LINE</div>
          <h1>Your opponent awaits.</h1>
          <p className="subtitle">
            Open this website on a second laptop and enter the room code.
          </p>
          <section className="card room-code-card">
            <span>ROOM CODE</span>
            <div>
              {room.code}
              <button
                className="quiet"
                aria-label="Copy room code"
                onClick={() => {
                  if (navigator.clipboard)
                    void navigator.clipboard
                      .writeText(room.code)
                      .catch(() => setError(`Room code: ${room.code}`));
                  else setError(`Room code: ${room.code}`);
                }}
              >
                <Copy size={20} />
              </button>
            </div>
            <small>
              {room.players.length}/2 players connected · Share this code with
              your friend
            </small>
          </section>
          <div className="lobby-grid">
            <section className="card">
              <h2>
                <Users size={20} /> The competitors
              </h2>
              {[0, 1].map((i) => {
                const p = room.players[i];
                return (
                  <div className="player-slot" key={i}>
                    <span className="avatar">
                      {p?.name.charAt(0).toUpperCase() || "?"}
                    </span>
                    <div>
                      <b>
                        {p?.name || "Waiting for a friend…"}{" "}
                        {p?.id === playerId && <small>(you)</small>}
                      </b>
                      <p>
                        {p
                          ? `${p.id === room.hostId ? "Host · " : ""}${p.connected ? "Connected" : "Disconnected"}`
                          : "Ask them to join using your room code"}
                      </p>
                    </div>
                    <span className={`dot ${p?.connected ? "" : "muted"}`} />
                  </div>
                );
              })}
              <label htmlFor="lobby-language">Your language</label>
              <select
                id="lobby-language"
                value={language}
                onChange={(e) => {
                  const l = e.target.value as Language;
                  setLanguage(l);
                  configure({ language: l });
                }}
              >
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {labels[l]}
                  </option>
                ))}
              </select>
            </section>
            <section className="card">
              <h2>
                <Flag size={20} /> Match setup
              </h2>
              <label htmlFor="difficulty">Difficulty</label>
              <select
                id="difficulty"
                disabled={!host}
                value={room.difficulty}
                onChange={(e) =>
                  configure({ difficulty: e.target.value as Difficulty })
                }
              >
                <option value="very-easy">
                  Very Easy · A great place to start
                </option>
                <option value="easy">Easy · A little more thinking</option>
              </select>
              <label htmlFor="problem">Problem</label>
              <select
                id="problem"
                disabled={!host}
                value={room.problemId || ""}
                onChange={(e) => configure({ problemId: e.target.value })}
              >
                <option value="">Surprise me · Random problem</option>
                {problemList
                  .filter((p) => p.difficulty === room.difficulty)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
              </select>
              <div className="setting-row">
                <span>Match duration</span>
                <b>{room.durationSeconds / 60} minutes</b>
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={room.clubFairMode}
                  disabled={!host}
                  onChange={(e) =>
                    configure({ clubFairMode: e.target.checked })
                  }
                />{" "}
                Club Fair Mode <small>Quick, beginner-friendly matches</small>
              </label>
            </section>
          </div>
          <button
            className="primary start-button"
            disabled={Boolean(startBlocker) || pending}
            onClick={startRace}
            aria-describedby="start-feedback"
          >
            <Play size={18} />
            {pending
              ? "Starting…"
              : host
                ? "Start the Race"
                : "Waiting for the host to start"}
          </button>
          <p
            id="start-feedback"
            role="status"
            className={
              error ? "failure start-feedback" : "muted-text start-feedback"
            }
          >
            {error || startBlocker}
          </p>
          <p className="muted-text">
            Both players get the same problem. The first accepted solution wins.
          </p>
        </main>
      ) : match.status === "finished" ? (
        <main className="results">
          <div className="trophy">
            <Trophy size={56} />
          </div>
          <div className="eyebrow">
            {match.winnerId
              ? "FIRST ACCEPTED SOLUTION"
              : "THE CLOCK HAS RUN OUT"}
          </div>
          <h1>
            {match.winnerId ? (
              <>
                {room.players.find((p) => p.id === match.winnerId)?.name}{" "}
                <span>wins!</span>
              </>
            ) : (
              <>
                Time’s up.
                <br />
                <span>It’s a draw.</span>
              </>
            )}
          </h1>
          <p className="subtitle">
            {match.winnerId
              ? "Well played. Every race makes you a better programmer."
              : "A good challenge deserves another try."}
          </p>
          <section className="card results-card">
            <div className="result-stats">
              <div>
                <small>PROBLEM</small>
                <b>{match.problem.title}</b>
              </div>
              <div>
                <small>TIME TAKEN</small>
                <b>{formatTime(match.elapsedMs || 0)}</b>
              </div>
              <div>
                <small>WINNING LANGUAGE</small>
                <b>
                  {match.winningLanguage ? labels[match.winningLanguage] : "—"}
                </b>
              </div>
              <div>
                <small>MATCH DURATION</small>
                <b>{room.durationSeconds / 60} min</b>
              </div>
            </div>
            {room.players.map((p) => (
              <div className="result-player" key={p.id}>
                <span>
                  {p.name}
                  {p.id === playerId ? " (you)" : ""}
                </span>
                <span>
                  {p.submissions} submission{p.submissions === 1 ? "" : "s"}
                </span>
                {p.id === match.winnerId && <Trophy size={18} />}
              </div>
            ))}
          </section>
          <div className="result-actions">
            <button
              className="primary"
              disabled={!host || !connected}
              onClick={() =>
                socketRef.current?.emit("match:reset", {}, (r) => {
                  ack(r);
                  if (!r.error) socketRef.current?.emit("match:start", ack);
                })
              }
            >
              <RotateCcw size={18} /> Play Again
            </button>
            <button
              className="secondary"
              disabled={!host || !connected}
              onClick={() =>
                socketRef.current?.emit(
                  "match:reset",
                  { newPlayers: true },
                  ack,
                )
              }
            >
              <Users size={18} /> New Players
            </button>
            <button className="quiet" onClick={leave}>
              Return to Home
            </button>
          </div>
          {!host && (
            <p className="muted-text">
              Your host can start another race or reset for new players.
            </p>
          )}
        </main>
      ) : (
        <main className="battle">
          <div className="battle-header">
            <div className="versus">
              {room.players.map((p, i) => (
                <span key={p.id}>
                  {i === 1 && <em>VS</em>}
                  <span className={`dot ${p.connected ? "" : "muted"}`} />
                  <b>{p.name}</b>
                  {p.id === playerId && <small>YOU</small>}
                </span>
              ))}
            </div>
            <div className={`countdown ${remaining < 30000 ? "warning" : ""}`}>
              <small>
                {match.status === "settling"
                  ? "FINISHING SUBMISSIONS"
                  : "TIME REMAINING"}
              </small>
              <strong>{formatTime(remaining)}</strong>
            </div>
            <span className="match-state">
              <span className="dot" />
              {match.status === "settling"
                ? "Judging final submissions"
                : "Race in progress"}
            </span>
          </div>
          <div className="battle-grid">
            <section className="card problem-panel">
              <div className="panel-heading">
                <Flag size={17} /> THE CHALLENGE{" "}
                <span className="badge">
                  {match.problem.difficulty === "very-easy"
                    ? "Very Easy"
                    : "Easy"}
                </span>
              </div>
              <div className="problem-content">
                <Markdown>{match.problem.statement}</Markdown>
                <h2>Sample test</h2>
                {match.problem.samples.map((s, i) => (
                  <div className="sample" key={i}>
                    <div>
                      <label>INPUT</label>
                      <pre>{s.input}</pre>
                    </div>
                    <div>
                      <label>EXPECTED OUTPUT</label>
                      <pre>{s.output}</pre>
                    </div>
                  </div>
                ))}
                <div className="limits">
                  {match.problem.timeLimitMs / 1000}s time limit ·{" "}
                  {match.problem.memoryLimitMb} MB memory
                  <br />
                  Read from standard input. Print to standard output.
                </div>
              </div>
            </section>
            <section className="card editor-panel">
              <div className="editor-toolbar">
                <span>
                  <Code2 size={18} /> Your solution
                </span>
                <div>
                  <select
                    aria-label="Programming language"
                    value={language}
                    disabled={busy}
                    onChange={(e) => setLanguage(e.target.value as Language)}
                  >
                    {languages.map((l) => (
                      <option key={l} value={l}>
                        {labels[l]}
                      </option>
                    ))}
                  </select>
                  <button
                    className="quiet"
                    aria-label="Reset Code"
                    onClick={() => {
                      if (window.confirm("Reset your code for this language?"))
                        updateDraft(match.problem.starters[language]);
                    }}
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>
              </div>
              <div className="editor-area">
                <Suspense
                  fallback={<div className="loading">Opening your editor…</div>}
                >
                  <CodeEditor
                    language={language}
                    value={source}
                    onChange={updateDraft}
                    disabled={busy || match.status !== "active"}
                  />
                </Suspense>
              </div>
              <div className="editor-actions">
                <small>Your code is private to you.</small>
                <button
                  className="secondary"
                  disabled={
                    busy ||
                    !connected ||
                    remaining === 0 ||
                    match.status !== "active"
                  }
                  onClick={() => evaluate("run")}
                >
                  <Play size={16} /> Run Code
                </button>
                <button
                  className="primary"
                  disabled={
                    busy ||
                    !connected ||
                    remaining === 0 ||
                    match.status !== "active"
                  }
                  onClick={() => evaluate("submit")}
                >
                  <Zap size={16} />
                  {busy ? "Evaluating…" : "Submit Solution"}
                </button>
              </div>
              <section className="output-panel" aria-live="polite">
                <div className="panel-heading">
                  <Terminal size={16} /> OUTPUT{" "}
                  {result && (
                    <span
                      className={`verdict ${result.status === "accepted" ? "success" : "failure"}`}
                    >
                      {verdictLabel(result.status)}
                    </span>
                  )}
                </div>
                {busy ? (
                  <p className="muted-text">
                    Evaluating your code in the local judge…
                  </p>
                ) : result ? (
                  <>
                    <p>
                      {result.passedTests}/{result.totalTests} tests passed ·{" "}
                      {result.executionTimeMs} ms{" "}
                      {resultMode === "run" ? "· Sample tests only" : ""}
                    </p>
                    {result.message && (
                      <pre className="error-output">{result.message}</pre>
                    )}
                    {result.samples?.map((s, i) => (
                      <div key={i} className="sample output-sample">
                        <div>
                          <label>EXPECTED</label>
                          <pre>{s.expected}</pre>
                        </div>
                        <div>
                          <label>ACTUAL · {verdictLabel(s.status)}</label>
                          <pre>{s.actual || "(no output)"}</pre>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <p className="muted-text">
                    Run your code to check the samples, then submit when you’re
                    ready.
                  </p>
                )}
              </section>
            </section>
          </div>
        </main>
      )}
      {!match && (
        <footer>
          <span>Made for curious minds at ADA University.</span>
          <span>
            <Shield size={13} /> Local network · No accounts needed
          </span>
        </footer>
      )}
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            className="card modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              aria-label="Close instructions"
              onClick={() => setHelp(false)}
            >
              ×
            </button>
            <div className="card-icon">
              <Swords />
            </div>
            <h2 id="help-title">Your first code race</h2>
            <ol>
              <li>
                <b>Find a friend.</b> Create a room, then share the
                six-character code.
              </li>
              <li>
                <b>Pick your language.</b> Choose C++17, Python 3, or Java 17.
                The host starts the race.
              </li>
              <li>
                <b>Solve the challenge.</b> Read the input, write your code, and
                run the sample tests.
              </li>
              <li>
                <b>Submit to win.</b> The first solution to pass every test
                wins. You have five minutes.
              </li>
            </ol>
            <p>
              Use standard input and output. In Java, use{" "}
              <code>public class Main</code>. You can change languages without
              losing your work.
            </p>
            <button className="primary full" onClick={() => setHelp(false)}>
              Let’s race <ArrowRight size={18} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
function Organizer({ onBack }: { onBack: () => void }) {
  const [secret, setSecret] = useState("");
  const [data, setData] = useState<{
    rooms: RoomView[];
    recent: RoomView[];
    diagnostics: string[];
    unvalidated: string[];
  }>();
  const [error, setError] = useState("");
  const load = async () => {
    try {
      const r = await fetch("/api/organizer", {
        headers: { Authorization: `Bearer ${secret}` },
      });
      const body = await r.json();
      if (!r.ok) throw Error(body.error);
      setData(body);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <main className="organizer">
      <div className="eyebrow">CLUB FAIR CONTROL</div>
      <h1>Organizer station</h1>
      <p className="subtitle">
        Keep the races moving. Your secret stays in memory and is cleared when
        you leave.
      </p>
      <section className="card">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <label htmlFor="secret">Local organizer secret</label>
          <div className="inline-form">
            <input
              id="secret"
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              required
              autoComplete="off"
            />
            <button className="primary">
              {data ? "Refresh" : "Unlock dashboard"}
            </button>
          </div>
        </form>
        {error && (
          <p role="alert" className="failure">
            {error}
          </p>
        )}
      </section>
      {data && (
        <>
          <div className="dashboard-stats">
            <section className="card">
              <b>{data.rooms.length}</b>
              <p>Active rooms</p>
            </section>
            <section className="card">
              <b>
                {data.rooms.reduce(
                  (n, r) => n + r.players.filter((p) => p.connected).length,
                  0,
                )}
              </b>
              <p>Connected participants</p>
            </section>
            <section className="card">
              <b>{data.recent.length}</b>
              <p>Recent completed matches</p>
            </section>
          </div>
          <section className="card">
            <h2>Active rooms</h2>
            {data.rooms.length === 0 ? (
              <p className="muted-text">
                No rooms yet. The arena is ready for visitors.
              </p>
            ) : (
              data.rooms.map((r) => (
                <div className="dashboard-row" key={r.code}>
                  <b>{r.code}</b>
                  <span>{r.players.map((p) => p.name).join(" vs ")}</span>
                  <span>{r.match?.status || "Lobby"}</span>
                  <button
                    className="secondary"
                    onClick={async () => {
                      if (
                        !window.confirm(
                          `Clear room ${r.code} and disconnect its participants?`,
                        )
                      )
                        return;
                      const res = await fetch("/api/organizer/reset", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${secret}`,
                        },
                        body: JSON.stringify({ code: r.code }),
                      });
                      if (!res.ok) {
                        setError("Reset failed. Refresh and try again.");
                        return;
                      }
                      void load();
                    }}
                  >
                    Force reset
                  </button>
                </div>
              ))
            )}
          </section>
          <section className="card">
            <h2>Recent winners</h2>
            {data.recent.length === 0 ? (
              <p>No completed matches yet.</p>
            ) : (
              data.recent.map((r, i) => (
                <div className="dashboard-row" key={i}>
                  <span>{r.match?.problem.title}</span>
                  <b>
                    {r.players.find((p) => p.id === r.match?.winnerId)?.name ||
                      "Draw"}
                  </b>
                  <span>{formatTime(r.match?.elapsedMs || 0)}</span>
                </div>
              ))
            )}
          </section>
          {(data.diagnostics.length > 0 || data.unvalidated.length > 0) && (
            <section className="card">
              <h2>Problem library needs attention</h2>
              {data.diagnostics.map((d, i) => (
                <p key={i}>{d}</p>
              ))}
              <p>
                {data.unvalidated.length} problems require reference validation.
                Run <code>npm run problems:validate</code> on the host.
              </p>
            </section>
          )}
        </>
      )}
      <button className="quiet" onClick={onBack}>
        Return to Home
      </button>
    </main>
  );
}
