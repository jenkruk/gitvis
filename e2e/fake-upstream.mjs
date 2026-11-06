/**
 * Fake GitHub GraphQL + GitLab calendar upstream for E2E tests.
 * GitVis points at it via GITVIS_GITHUB_GRAPHQL_URL / GITVIS_GITLAB_ORIGIN.
 *
 * Per-username behaviour is controlled over HTTP:
 *   POST /__control {"user":"name","mode":"ok"|"fail"|"notfound","count":3}
 *   GET  /__hits?user=name  → {"github":n,"gitlab":n}
 *
 * Avatars (GITVIS_GITHUB_AVATAR_ORIGIN / GitLab users API): users whose name
 * contains "noavatar" get a 404, so the monogram fallback can be exercised.
 */
import { createServer } from "node:http";

const PORT = Number(process.env.FAKE_UPSTREAM_PORT ?? 4010);
const users = new Map(); // user → { mode, count, hits: { github, gitlab } }

function state(user) {
  if (!users.has(user)) users.set(user, { mode: "ok", count: 3, hits: { github: 0, gitlab: 0 } });
  return users.get(user);
}

// 1×1 transparent PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const today = () => new Date().toISOString().slice(0, 10);

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  if (req.method === "POST" && url.pathname === "/__control") {
    const { user, mode, count } = await readBody(req);
    const s = state(user);
    if (mode) s.mode = mode;
    if (typeof count === "number") s.count = count;
    return json(res, 200, { ok: true });
  }
  if (url.pathname === "/__hits") return json(res, 200, state(url.searchParams.get("user")).hits);
  if (url.pathname === "/__health") return json(res, 200, { ok: true });

  const avatar = /^\/avatars\/([^/]+)$/.exec(url.pathname);
  if (req.method === "GET" && avatar) {
    if (avatar[1].includes("noavatar")) return json(res, 404, { message: "not found" });
    res.writeHead(200, { "Content-Type": "image/png", "Content-Length": PNG.length });
    return res.end(PNG);
  }
  if (req.method === "GET" && url.pathname === "/api/v4/users") {
    const user = url.searchParams.get("username") ?? "";
    if (user.includes("noavatar")) return json(res, 200, []);
    return json(res, 200, [{ username: user, avatar_url: `http://${req.headers.host}/avatars/${user}` }]);
  }

  const gitlab = /^\/users\/([^/]+)\/calendar\.json$/.exec(url.pathname);
  if (req.method === "GET" && gitlab) {
    const s = state(decodeURIComponent(gitlab[1]));
    s.hits.gitlab += 1;
    if (s.mode === "fail") return json(res, 503, { message: "maintenance" });
    if (s.mode === "notfound") {
      res.writeHead(302, { Location: "/users/sign_in" });
      return res.end();
    }
    return json(res, 200, { [today()]: s.count });
  }

  if (req.method === "POST" && url.pathname === "/graphql") {
    const { variables } = await readBody(req);
    const s = state(variables?.login);
    s.hits.github += 1;
    if (s.mode === "fail") return json(res, 502, { message: "bad gateway" });
    if (s.mode === "notfound") {
      return json(res, 200, { data: { user: null }, errors: [{ type: "NOT_FOUND", message: "Could not resolve" }] });
    }
    return json(res, 200, {
      data: {
        user: {
          contributionsCollection: {
            restrictedContributionsCount: 0,
            contributionCalendar: {
              totalContributions: s.count,
              weeks: [{ contributionDays: [{ date: today(), contributionCount: s.count }] }],
            },
          },
        },
      },
    });
  }

  json(res, 404, { message: "not found" });
}).listen(PORT, "127.0.0.1", () => console.log(`fake upstream on http://127.0.0.1:${PORT}`));
