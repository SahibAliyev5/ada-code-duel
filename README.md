# ADA Code Race

A local, offline-capable 1v1 programming arena for the ADA University Competitive Programming Club. Two visitors join a room, solve the same problem in five minutes, and race for the first accepted solution. No accounts or cloud services are used.

## Features

- React + Vite + TypeScript + Tailwind, dark responsive interface, Lucide icons, locally bundled Monaco editor and workers.
- Express + Socket.IO, two-player rooms, independent language choices, token reconnection, authoritative timer, private code/results, rematches and station resets.
- Exactly **C++17, Python 3 and Java 17**. Java submissions use `public class Main`.
- 26 modular beginner problem folders with Markdown statements, starters, samples, hidden tests and reference solutions in all three languages.
- Authenticated organizer dashboard, Club Fair defaults, problem selection and recent match history.
- Independent local judge service. Every test executes in a fresh Docker container. There is no simulated judge or host execution fallback.

## Prerequisites

Install Node.js 22+, npm, and Docker Engine (Linux) or Docker Desktop with **Linux containers** (Windows). On Windows, enable WSL2 for Docker Desktop. Docker must be running and your account must be able to run `docker`.

Install dependencies and build the sandbox **before the event**, while internet is available. After this preparation and problem validation, the application needs only the local network. No CDN, external fonts, remote editor workers, or online judge APIs are used at runtime.

## Start locally — recommended

Run commands from the repository root. On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

```sh
npm install
```

Copy `.env.example` to `.env` (`Copy-Item .env.example .env` on PowerShell; `cp .env.example .env` on Linux). Generate **two different secrets**, each at least 24 characters, with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Put them in `JUDGE_SECRET` and `ORGANIZER_SECRET`. Keep `.env` private. Then build the execution image:

```sh
docker build -t ada-code-race-sandbox:local ./judge
```

In terminal 1, start the judge. It listens on loopback port 4001 by default:

```sh
npm run judge
```

In terminal 2, validate the library. This compiles/runs all reference solutions **inside the same Docker isolation as visitor submissions**, then writes content-fingerprint readiness certificates. Initial validation may take several minutes because each reference/test uses a fresh container.

```sh
npm run problems:validate
npm run problems:list
npm run build
npm start
```

Open **http://localhost:3000**. The backend serves the production frontend on port 3000. Only validated problems appear in live selection. Changes to a statement, configuration, template, solution or test invalidate its certificate; validate again and restart the app.

For development, use `npm run dev`: frontend port 5173 proxies API and Socket.IO to backend port 3000. Use port **3000 after building** for the fair.

## Connect two laptops

1. Connect the host and both player laptops to the same trusted Wi-Fi or Ethernet LAN.
2. Find the host computer's actual LAN IPv4 address with `ipconfig` on Windows or `hostname -I` / `ip addr` on Linux.
3. Both players open `http://HOST_LAN_IP:3000`, for example `http://192.168.1.10:3000` (replace the example IP).
4. The first player enters a temporary name and selects **Create Room**. The other selects **Join Room** and enters the displayed six-character code.
5. Each chooses a language; the host selects difficulty / random or specific problem and starts the race.

Allow inbound **TCP 3000** from your private LAN in the host firewall. On Windows, create a private-network inbound rule for TCP 3000 in Windows Defender Firewall. On Linux with ufw, for example: `sudo ufw allow from 192.168.1.0/24 to any port 3000 proto tcp` (use your actual subnet). No inbound port 4001 is needed for the recommended native app setup. Guest Wi-Fi with client isolation can prevent players reaching the host; use a network that allows device-to-device connections.

The app works on LAN HTTP: it does not require the secure-context-only `crypto.randomUUID()` browser API. Room-code copying falls back to displaying the code when clipboard access is unavailable.

## Docker Compose option

The app can run in Compose. The judge controller intentionally runs as a separate trusted process **on the Docker host**. No application or execution container mounts the Docker socket. This avoids granting Docker control to a network-facing application container.

Prepare `.env`, install dependencies, build the sandbox and validate the problem library as above. To let the app container reach the host judge, start the judge with `JUDGE_BIND=0.0.0.0` (PowerShell: `$env:JUDGE_BIND='0.0.0.0'; npm.cmd run judge`; Linux: `JUDGE_BIND=0.0.0.0 npm run judge`). Configure the firewall so **4001 is accessible only from the Docker bridge**, never ordinary LAN clients. It also requires the shared `JUDGE_SECRET` for every job. Then:

```sh
docker compose up --build -d
docker compose logs -f app
```

Compose exposes only app port 3000, mounts the problems directory read-only, drops capabilities and makes the app filesystem read-only. Readiness certificates must already exist on the host. `docker compose down` stops the app; stop the host judge separately. On Docker Desktop, `host.docker.internal` routes to the host; on Linux, Compose uses `host-gateway`. If host firewall routing is awkward, use the recommended native app setup with the judge on loopback.

## Judging and fairness policy

The app sends a validated, immutable match snapshot to the authenticated judge over local HTTP. Visitors cannot specify test paths or expected output. **Run Code** checks visible samples. **Submit Solution** checks all tests, including hidden ones. Hidden inputs/outputs and reference solutions are never served by the app; hidden runtime stderr and individual outputs are also withheld from players.

Each test starts a fresh container with no network, read-only root filesystem, no host mounts, no secrets, no Docker socket, a 32 MB working tmpfs, 16 MB temporary tmpfs, one CPU, configured memory/swap limit, 64-process limit, file descriptor limits, no core dumps, and no new privileges. A trusted Python supervisor compiles C++ with `g++ -std=c++17`, Java with `javac`, or runs `python3`. It launches submitted code as UID 1001, separate from the supervisor, applies a wall timeout and CPU limit, and caps each output stream at 64 KiB. Containers are force-removed in `finally`, including error cases. Expected outputs stay outside execution containers.

Compilation has a 15-second wall limit; runtime uses the problem's time limit. The Java heap is half of the problem memory budget to reserve space for the JVM; the container enforces the whole memory budget. Verdicts distinguish accepted, wrong answer, compilation/runtime error, time/memory/output limits and infrastructure errors. Execution time is reported; **memory usage telemetry is not currently reported**. An unavailable Docker daemon or image returns Judging Error, never a false acceptance.

Output comparison converts CRLF to LF, ignores trailing whitespace on each line and trailing blank lines, and preserves leading whitespace, letter case and interior spacing. Floating-point problems request a precise output format rather than tolerance comparison.

The server assigns submission sequence numbers as requests arrive. The earliest **eligible accepted submission in receipt order** wins; later results wait for earlier pending submissions. A request received at or after the deadline is ineligible. Eligible requests received before the deadline may finish afterward; the screen shows a settling phase until they are resolved. Match completion is emitted once. Judge jobs have a backend 180-second timeout and bounded worker concurrency; capacity failures are infrastructure errors. Run requests cannot win. Only one evaluation per player may be in flight. Match-wide request IDs prevent duplicates; source is bounded to 64 KiB.

Docker shares the host kernel. Use a patched, dedicated event machine on a trusted LAN; the sandbox has **not been independently security audited**. The architecture is designed for the university fair, not a public internet judge. Host-controlling processes remain trusted. If a host power failure leaves containers behind, inspect `docker ps -a --filter name=ada-exec-` and remove the listed execution containers. The app and judge never mount host secrets into execution sandboxes.

## Add a problem without source changes

```sh
npm run problems:new -- --id=my-new-problem
```

This creates a disabled example folder with configuration, Markdown statement, all three starter templates, sample and hidden test pairs, and TODO reference solution files. Alternatively copy any existing problem folder and change its ID.

```text
problems/my-new-problem/
  problem.json
  statement.md
  starter/main.cpp
  starter/main.py
  starter/Main.java
  tests/sample1.in
  tests/sample1.out
  tests/test01.in
  tests/test01.out
  solution/main.cpp
  solution/main.py
  solution/Main.java
```

Edit the statement, code templates, references and tests. Every `.in` must have a matching `.out`; unlisted tests are hidden. Include boundary cases. Metadata follows this schema:

```json
{
  "id": "my-new-problem",
  "title": "My New Problem",
  "difficulty": "very-easy",
  "estimatedMinutes": 1,
  "timeLimitMs": 2000,
  "memoryLimitMb": 256,
  "enabled": true,
  "tags": ["beginner"],
  "samples": ["sample1"],
  "supportedLanguages": ["cpp17", "python3", "java17"]
}
```

Difficulty is `very-easy` or `easy`; estimated duration is 1–5 minutes. IDs and test stems use letters, numbers, underscores or hyphens. Memory is 64–512 MB; runtime is 100–5000 ms. All three languages and at least one sample and hidden case are required. Markdown is rendered without raw HTML; references are never public. File realpaths must stay inside the configured problems root, including symlink targets.

Set `enabled=true`, start the judge, run `npm run problems:validate`, then restart the backend. The validated new folder automatically appears in the host's **Problem** dropdown. No imports, routes, frontend changes or central arrays need editing. Set `enabled=false` or remove the folder and restart to disable it. Active matches keep their own snapshot.

## Organizer and reset

Select **Organizer** on the home screen and enter the secret from `.env`. It shows active rooms, connected participants, match states, recent winners and problem diagnostics. **Force reset** invalidates participant tokens and clears the room. Ordinary visitors cannot invoke organizer APIs without the secret. The browser holds the secret only in component memory.

After a match, the host can **Play Again** (same players, another eligible problem where possible) or **New Players** (delete the room and clear both browser sessions; visitors create a new room). Identities are temporary. Results are held in memory (last 50 matches) and are lost when the server restarts. No accounts, sensitive personal data or permanent analytics are stored.

Reconnection uses a random 256-bit token in sessionStorage, with a two-hour expiry. Reloads reuse the slot; a concurrent active tab cannot claim it. Disconnects are displayed to the other participant. The match clock continues during disconnects. If somebody leaves an active match, the organizer can reset the station.

## Verification

```sh
npm test             # Registry, real HTTP/Socket.IO APIs, rooms and match-state unit tests
npm run build        # TypeScript + production assets
npm run test:ui      # Browser rendering / multiplayer flows with controlled test verdicts
npm run test:judge    # Real Docker isolation and all reference solutions
npm run problems:validate
npx playwright install chromium  # Install before the event
npm run test:e2e      # Two browser contexts with the actual local judge
```

Backend winner-ordering unit tests inject a controllable judge to test race conditions; they do not substitute for real judging acceptance. The Docker tests and Playwright race test use real execution. Browser acceptance requires a running judge, validated problems and a built frontend. The production app refuses unvalidated problems instead of silently simulating execution.

`test:ui` uses a separate test-only server on loopback port 3100 with controlled verdicts. It checks the actual frontend and Socket.IO room flow, private drafts, refresh recovery, language switching, verdict rendering, winner screens, rematches, identity clearing and absence of outbound browser requests. It does **not** evaluate programs or validate the real judge. The production server has no switch for simulated judging.

Verified during implementation: production TypeScript/Vite build, backend/API/registry test suite, and both Playwright UI-flow tests. Docker-dependent checks below remain pending on a Docker-equipped host.

Manual event rehearsal: disconnect internet (keep LAN connected), load from both laptops, try all three languages, run samples, submit wrong/correct programs, refresh one browser during a match, check the countdown and private results, play again, and reset for new visitors. Confirm no outbound requests in browser developer tools. LAN connectivity depends on the event network and must be rehearsed there.

### Current verification limitations

This repository was authored on a machine without Docker. Problem definitions, reference solutions and sandbox tests are provided, but **the full reference library and actual Docker isolation must be validated on a Docker-equipped host before use**. No readiness certificates are fabricated or checked in. The app will initially report zero ready problems until validation succeeds. Real judging, Docker Compose, browser racing with real execution, offline rehearsal and multi-laptop LAN connectivity need that host/event setup.

## Structure

`frontend/src`: interface and offline Monaco integration. `backend/src`: room/match authority, problem registry and private judge client. `shared/types.ts`: event and result contracts. `judge`: authenticated controller and isolated execution image. `problems`: complete file-based library. `scripts/problems.ts`: organizer commands. `tests`: state/API/registry tests, Docker tests and Playwright race.
