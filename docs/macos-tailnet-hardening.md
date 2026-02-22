# macOS + Tailnet Hardening Guide

This guide is for running Bob on a Mac and accessing it from trusted devices (for example, your phone) over Tailscale.

Goal: keep Bob reachable for authorized users while reducing accidental LAN/public exposure.

## 1) Join Mac and Phone to the Same Tailnet

1. Install Tailscale on macOS.
2. Install Tailscale on iPhone.
3. Sign in to the same tailnet account on both devices.
4. Verify both devices are online in the Tailscale admin panel.
5. Record the Mac Tailnet IPv4 (usually `100.x.y.z`):

```bash
tailscale ip -4
```

## 2) Configure Bob Environment for Tailnet Access

In `.env`:

```bash
# API bind
BOB_HOST=0.0.0.0
BOB_PORT=4000

# Frontend origin used by CORS/cookies
BOB_WEB_ORIGIN=http://<mac_tailnet_ipv4>:5173

# Optional dynamic origin policy (numeric prefixes only)
# Example: allow Tailnet IPv4 origins only
BOB_WEB_ORIGIN_HOST_PREFIXES=100

# Keep app-server loopback-only
BOB_CODEX_APP_SERVER_LISTEN=ws://127.0.0.1:8787
```

Important:

- Keep `BOB_CODEX_APP_SERVER_LISTEN` on `127.0.0.1`. Do not expose it to the network.
- Use a long random `BOB_SHARED_PASSWORD` and rotate it periodically.
- Restrict `BOB_WORKSPACES` to only directories you want Bob to touch.

## 3) Configure macOS PF Firewall with an Anchor

Use your own anchor name. Do not rely on environment-specific names.

### 3.1 Update `/etc/pf.conf`

Keep Apple anchors, then load your custom anchor:

```pf
scrub-anchor "com.apple/*"
nat-anchor "com.apple/*"
rdr-anchor "com.apple/*"
dummynet-anchor "com.apple/*"

anchor "bob_mgmt"
load anchor "bob_mgmt" from "/etc/pf.anchors/bob_mgmt"

anchor "com.apple/*"
load anchor "com.apple" from "/etc/pf.anchors/com.apple"
```

### 3.2 Create `/etc/pf.anchors/bob_mgmt`

Use exact trusted Tailnet IPs.

```pf
# Trusted operator devices on Tailnet
allowed_mgmt = "{ <trusted_tailnet_ip_1>, <trusted_tailnet_ip_2> }"

# Bob UI/API ports
pass  in quick proto tcp from $allowed_mgmt to any port { 5173, 4000, 4173 } keep state
block in quick proto tcp from any          to any port { 5173, 4000, 4173 }

# Remote admin ports (optional, if you need SSH/VNC)
pass  in quick proto tcp from $allowed_mgmt to any port { 22, 5800, 5900, 5901, 5902 } keep state
block in quick proto tcp from any          to any port { 22, 5800, 5900, 5901, 5902 }

# Always keep Codex app-server local-only
block in quick proto tcp from any to any port 8787
```

### 3.3 Validate and Load Rules

```bash
# syntax check
sudo pfctl -nf /etc/pf.conf

# load rules
sudo pfctl -f /etc/pf.conf

# enable pf if needed
sudo pfctl -e

# inspect custom anchor
sudo pfctl -a bob_mgmt -sr
```

Recovery command (if you lock yourself out during testing):

```bash
sudo pfctl -d
```

## 4) Start Bob and Test from Phone

1. Start Bob:

```bash
npm run dev
```

2. Open on iPhone Safari:

`http://<mac_tailnet_ipv4>:5173`

3. Confirm:
- login works with shared password
- session create/run works
- websocket updates stream correctly

## 5) Recommended Extra Hardening

- Enable macOS Application Firewall.
- Keep Bob reachable through Tailnet only; avoid exposing Bob ports to general LAN/WAN.
- Prefer production-style serving (built assets) over long-lived dev server for daily use.
- Keep `BOB_RATE_LIMIT_MAX_REQUESTS` and `BOB_AUTH_RATE_LIMIT_MAX_REQUESTS` conservative.
- Rotate `BOB_SHARED_PASSWORD` after sharing with additional users.

## 6) Common Security Mistakes

- Allowing broad CORS hostname patterns.
- Exposing port `8787` externally.
- Using an overly broad `BOB_WORKSPACES` scope.
- Running with weak shared password.
- Leaving stale operator devices in Tailnet without review/removal.

## References

- [Tailscale: Install on Mac](https://tailscale.com/kb/1025/install-macos)
- [Tailscale: iOS setup](https://tailscale.com/kb/1020/install-ios)
- [Tailscale: Serve](https://tailscale.com/kb/1312/serve)
- [Tailscale: ACLs](https://tailscale.com/kb/1018/acls)
