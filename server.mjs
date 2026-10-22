/**
 * Zero-dependency local static server (a stand-in for `python -m http.server`).
 *
 * Usage: node server.mjs [port] [--no-open]
 *
 * Port policy:
 *   If the port is taken, move forward to the next free one instead of
 *   failing. Port 8000 is often held by the C-Lodop print service on this
 *   machine, so hard-coding 8000 would open someone else's page.
 *
 * Opens the browser automatically (pass --no-open to skip) and prints the
 * URL that is actually in use.
 *
 * NOTE: console messages are deliberately ASCII-only. The Windows console
 * codepage here is GBK, and non-ASCII output comes out as mojibake.
 */
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const openBrowser = !args.includes("--no-open");
const requested = Number(args.find((a) => /^\d+$/.test(a))) || 8730;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8"
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const relative = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const target = path.join(ROOT, relative);

  // never serve outside the project directory.
  // Compare resolved paths on both sides: path.join() normalises separators
  // to backslashes on Windows, so a plain startsWith() on a forward-slash
  // ROOT would reject every request.
  if (!path.resolve(target).startsWith(path.resolve(ROOT))) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  fs.stat(target, (statErr, stat) => {
    if (statErr || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not Found");
      return;
    }

    const total = stat.size;
    const type = TYPES[path.extname(target).toLowerCase()] || "application/octet-stream";
    const baseHeaders = {
      "Content-Type": type,
      "Cache-Control": "no-cache",
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*"
    };

    // Range support. Without it the browser cannot tell how long a media file
    // is (duration shows up as Infinity) and cannot seek inside it, so the
    // model audio never plays and "listen to this word only" stays silent.
    const rangeHeader = req.headers.range;
    const match = rangeHeader ? /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader).trim()) : null;
    if (match) {
      let start = match[1] === "" ? null : Number(match[1]);
      let end = match[2] === "" ? null : Number(match[2]);
      if (start === null && end !== null) {
        // suffix form: bytes=-500 means "the last 500 bytes"
        start = Math.max(0, total - end);
        end = total - 1;
      } else {
        if (start === null) start = 0;
        if (end === null || end >= total) end = total - 1;
      }
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= total) {
        res.writeHead(416, { "Content-Range": `bytes */${total}`, "Accept-Ranges": "bytes" }).end();
        return;
      }
      res.writeHead(206, {
        ...baseHeaders,
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Content-Length": end - start + 1
      });
      if (req.method === "HEAD") { res.end(); return; }
      fs.createReadStream(target, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, { ...baseHeaders, "Content-Length": total });
    if (req.method === "HEAD") { res.end(); return; }
    fs.createReadStream(target).pipe(res);
  });
});

function openInBrowser(url) {
  const platform = process.platform;
  let cmd = null;
  let cmdArgs = [];
  if (platform === "win32") {
    cmd = "cmd";
    cmdArgs = ["/c", "start", "", url];
  } else if (platform === "darwin") {
    cmd = "open";
    cmdArgs = [url];
  } else {
    cmd = "xdg-open";
    cmdArgs = [url];
  }
  try {
    const child = spawn(cmd, cmdArgs, { stdio: "ignore", detached: true, shell: false });
    child.on("error", () => {});
    child.unref();
  } catch {
    /* not fatal: the URL is printed to the console */
  }
}

/**
 * Probe whether a port is really free.
 *
 * Why not just rely on EADDRINUSE? Because Windows does not give it to us:
 *   - with another service on 0.0.0.0:P, binding `::` (IPv6) does NOT fail;
 *   - with another service on 0.0.0.0:P, binding 127.0.0.1:P does NOT fail.
 *   (Both verified on this machine, where C-Lodop holds 0.0.0.0:8000.)
 * The two services then silently share the port, and the browser hits
 * whichever one the address family resolution picks.
 *
 * So: connect first. If something answers, the port is taken - move on.
 * Both 127.0.0.1 and ::1 are probed to cover IPv4 and IPv6 wildcards.
 */
function probePort(port) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (busy) => {
      if (settled) return;
      settled = true;
      resolve(busy);
    };
    const hosts = ["127.0.0.1", "::1"];
    let pending = hosts.length;
    for (const host of hosts) {
      const socket = net.connect({ port, host });
      socket.setTimeout(600);
      socket.once("connect", () => {
        socket.destroy();
        finish(true);
      });
      socket.once("timeout", () => {
        socket.destroy();
        if (--pending === 0) finish(false);
      });
      socket.once("error", () => {
        if (--pending === 0) finish(false);
      });
    }
  });
}

function tryBind(port) {
  return new Promise((resolve) => {
    const onError = (err) => {
      server.removeListener("listening", onListening);
      if (err.code === "EADDRINUSE") {
        resolve(false);
        return;
      }
      console.error(`SpeekBetter: cannot use port ${port} (${err.code || err.message}).`);
      console.error("Try another one: node server.mjs 8848");
      process.exit(1);
    };
    const onListening = () => {
      server.removeListener("error", onError);
      const url = `http://127.0.0.1:${port}/`;
      console.log(`SpeekBetter running at ${url}`);
      console.log(`(http://localhost:${port} works too)`);
      if (port !== requested) {
        console.log(`Port ${requested} was busy (common cause: the C-Lodop print service), switched to ${port}.`);
      }
      if (openBrowser) openInBrowser(url);
      resolve(true);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "127.0.0.1");
  });
}

/** Walk forward from startPort until a port is genuinely free. */
async function listenOnFirstFreePort(startPort, attempts = 50) {
  let port = startPort;
  for (let i = 0; i < attempts; i += 1) {
    const busy = await probePort(port);
    if (!busy) {
      const bound = await tryBind(port);
      if (bound) return port;
    }
    port += 1;
  }
  console.error(`SpeekBetter: all ${attempts} ports from ${startPort} onward are busy.`);
  console.error("Pick one explicitly: node server.mjs 8848");
  process.exit(1);
}

listenOnFirstFreePort(requested);