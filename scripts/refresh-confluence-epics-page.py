#!/usr/bin/env python3
"""Refresh the Confluence "FHS — Epics & Tickets" page from live Jira state.

Runs after every ticket close (CLAUDE.md "Closing tickets (post-merge)" rule).
Pulls every FHS epic + its children, groups by Fix Version (Sprint cluster),
renders a Confluence storage-format page body with status lozenges and per-epic
progress, then PUTs version+1 to page id 3079340034.

Usage:
    # From repo root, after .env.local is sourced:
    python3 scripts/refresh-confluence-epics-page.py
    python3 scripts/refresh-confluence-epics-page.py --reason "FHS-158 close"

Reads env vars: EMAIL, JIRA_API_TOKEN, URL (Atlassian instance base URL).
Standard library only — no third-party deps.
"""

import argparse
import base64
import html
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

PAGE_ID = "3079340034"
CONFLUENCE_API = "https://qualicion2.atlassian.net/wiki/api/v2"

# Sprint-cluster Fix Versions, in launch order. Anything not in this list
# is rendered after these, in alphabetical order.
FIX_VERSION_ORDER = [
    "0.0-bootstrap",
    "0.1-tenant-foundation",
    "0.2-signup-custom-url",
    "0.3-modules-gating",
    "0.4-stripe-billing",
    "0.5-invites-roles",
    "1.0-white-label-launch",
]

STATUS_COLOURS = {
    "Done": "Green",
    "In Progress": "Blue",
    "To Do": "Medium-Gray",
    "Cancelled": "Gray",
    "Won't Do": "Gray",
}


def env(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        sys.exit(f"error: env var {name} is required (source .env.local first)")
    return v


def auth_headers() -> dict:
    token = base64.b64encode(f"{env('EMAIL')}:{env('JIRA_API_TOKEN')}".encode()).decode()
    return {
        "Authorization": f"Basic {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "family-hub-app/refresh-confluence-epics-page",
    }


class HttpError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


def http(method: str, url: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=auth_headers())
    try:
        with urllib.request.urlopen(req) as r:
            text = r.read().decode()
            return json.loads(text) if text else {}
    except urllib.error.HTTPError as e:
        raise HttpError(e.code, f"HTTP {e.code} on {method} {url}\n{e.read().decode()}") from e


def jql(query: str, fields: str = "summary,status") -> list[dict]:
    base = env("URL").rstrip("/")
    issues: list[dict] = []
    next_token: str | None = None
    while True:
        params = {"jql": query, "fields": fields, "maxResults": 100}
        if next_token:
            params["nextPageToken"] = next_token
        url = f"{base}/rest/api/3/search/jql?" + urllib.parse.urlencode(params)
        page = http("GET", url)
        issues.extend(page.get("issues", []))
        next_token = page.get("nextPageToken")
        if not next_token or page.get("isLast"):
            break
    return issues


def esc(s: str | None) -> str:
    return html.escape(s or "", quote=True)


def jira_macro(key: str) -> str:
    return (
        '<ac:structured-macro ac:name="jira" ac:schema-version="1">'
        f'<ac:parameter ac:name="key">{esc(key)}</ac:parameter>'
        "</ac:structured-macro>"
    )


def status_lozenge(name: str) -> str:
    colour = STATUS_COLOURS.get(name, "Medium-Gray")
    return (
        '<ac:structured-macro ac:name="status">'
        f'<ac:parameter ac:name="title">{esc(name)}</ac:parameter>'
        f'<ac:parameter ac:name="colour">{colour}</ac:parameter>'
        "</ac:structured-macro>"
    )


def progress(children: list[dict]) -> str:
    total = len(children)
    if total == 0:
        return "0/0"
    done = sum(1 for c in children if c["fields"]["status"]["name"] == "Done")
    return f"{done}/{total}"


def render_body(epics: list[dict], epic_children: dict[str, list[dict]]) -> str:
    groups: dict[str, list[dict]] = {}
    for e in epics:
        fvs = [v["name"] for v in e["fields"].get("fixVersions", [])]
        key = fvs[0] if fvs else "(no fix version)"
        groups.setdefault(key, []).append(e)

    ordered = [k for k in FIX_VERSION_ORDER if k in groups]
    ordered += sorted(k for k in groups if k not in FIX_VERSION_ORDER)

    parts: list[str] = [
        "<p>Auto-generated from Jira by "
        '<code>scripts/refresh-confluence-epics-page.py</code>. '
        "Refreshes after every ticket close per the CLAUDE.md "
        '"Closing tickets (post-merge)" rule. Children rolled up under '
        "each epic with status lozenges.</p>",
        "<h2>Epics</h2>",
    ]

    for fv in ordered:
        parts.append(f"<h3>{esc(fv)}</h3>")
        parts.append("<table><tbody>")
        parts.append(
            "<tr><th>Epic</th><th>Status</th><th>Progress</th>"
            "<th>Summary</th><th>Children</th></tr>"
        )
        for e in groups[fv]:
            children = epic_children[e["key"]]
            children_html = "<br/>".join(
                f'{jira_macro(c["key"])} '
                f'{status_lozenge(c["fields"]["status"]["name"])} '
                f'{esc(c["fields"]["summary"])}'
                for c in children
            ) or "<em>no children</em>"
            parts.append(
                "<tr>"
                f"<td>{jira_macro(e['key'])}</td>"
                f"<td>{status_lozenge(e['fields']['status']['name'])}</td>"
                f"<td>{progress(children)}</td>"
                f"<td>{esc(e['fields']['summary'])}</td>"
                f"<td>{children_html}</td>"
                "</tr>"
            )
        parts.append("</tbody></table>")

    return "\n".join(parts)


def get_page() -> dict:
    return http("GET", f"{CONFLUENCE_API}/pages/{PAGE_ID}?body-format=storage")


def put_page(version: int, title: str, body: str, message: str) -> dict:
    return http(
        "PUT",
        f"{CONFLUENCE_API}/pages/{PAGE_ID}",
        body={
            "id": PAGE_ID,
            "status": "current",
            "title": title,
            "body": {"representation": "storage", "value": body},
            "version": {"number": version, "message": message},
        },
    )


def put_with_retry(title: str, body: str, reason: str) -> dict:
    """PUT the page, retrying once on 409 Conflict (someone edited the page
    in-browser between our fetch and PUT). One retry is enough — if a second
    409 fires, it's a sign of contention worth investigating manually."""
    for attempt in (1, 2):
        page = get_page()
        current_version = page["version"]["number"]
        new_version = current_version + 1
        msg = f"{reason} (v{new_version})"
        try:
            return put_page(new_version, title, body, msg)
        except HttpError as e:
            if e.status == 409 and attempt == 1:
                print(f"  v{current_version} was stale (page edited externally) — refetching and retrying...")
                continue
            raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--reason",
        default="Auto-refresh",
        help="Version-history message (e.g. 'FHS-158 close'). Defaults to 'Auto-refresh'.",
    )
    args = parser.parse_args()

    print("Fetching epics...")
    epics = jql(
        "project = FHS AND issuetype = Epic ORDER BY Rank ASC",
        fields="summary,status,fixVersions",
    )
    print(f"  {len(epics)} epics")
    if not epics:
        sys.exit("error: Jira returned 0 epics — refusing to overwrite the page with an empty body")

    print("Fetching children per epic...")
    epic_children: dict[str, list[dict]] = {}
    for e in epics:
        children = jql(f'parent = {e["key"]} ORDER BY Rank ASC', fields="summary,status")
        epic_children[e["key"]] = children

    body = render_body(epics, epic_children)
    title = get_page()["title"]
    print(f"Updating page {PAGE_ID} ({title!r})...")

    try:
        result = put_with_retry(title, body, args.reason)
    except HttpError as e:
        sys.exit(str(e))
    print(f"OK — refreshed to v{result['version']['number']}: {args.reason}")


if __name__ == "__main__":
    main()
