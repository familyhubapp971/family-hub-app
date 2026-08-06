#!/usr/bin/env python3
"""Keep every FHS epic's status honest against its children.

Founder rule (2026-08-06): an epic should always say what is actually
happening underneath it, including an epic that was closed and later picked
up again because a new ticket landed under it.

The rule, in order:

  1. Any child In Progress            -> epic In Progress
  2. All children Done or Won't Do    -> epic Done
  3. All children To Do               -> epic To Do
  4. Mixed To Do and Done, none in
     progress                         -> epic In Progress (work has started)

An epic with no children is left alone: there is nothing to infer from.

Usage:
    set -a; source .env.local; set +a
    python3 scripts/sync-epic-status.py            # report only, changes nothing
    python3 scripts/sync-epic-status.py --apply    # actually transition
    python3 scripts/sync-epic-status.py --apply --epic FHS-178

Standard library only, same as the other scripts here.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

DONE_CATEGORIES = {"done"}
IN_PROGRESS_CATEGORY = "indeterminate"
TODO_CATEGORY = "new"


def _env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        sys.exit(f"error: env var {name} is required (source .env.local first)")
    return value


class Jira:
    def __init__(self) -> None:
        self.base = _env("URL").rstrip("/")
        token = f'{_env("EMAIL")}:{_env("JIRA_API_TOKEN")}'.encode()
        self.auth = "Basic " + base64.b64encode(token).decode()

    def _request(self, method: str, path: str, body: dict | None = None) -> dict:
        req = urllib.request.Request(
            self.base + path,
            method=method,
            data=json.dumps(body).encode() if body is not None else None,
            headers={"Authorization": self.auth, "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}

    def search(self, jql: str, fields: list[str]) -> list[dict]:
        out: list[dict] = []
        token = None
        while True:
            params = {"jql": jql, "fields": ",".join(fields), "maxResults": "100"}
            if token:
                params["nextPageToken"] = token
            page = self._request("GET", "/rest/api/3/search/jql?" + urllib.parse.urlencode(params))
            out.extend(page.get("issues", []))
            token = page.get("nextPageToken")
            if not token:
                return out

    def transitions(self, key: str) -> dict[str, str]:
        data = self._request("GET", f"/rest/api/3/issue/{key}/transitions")
        return {t["to"]["name"]: t["id"] for t in data.get("transitions", [])}

    def transition(self, key: str, to_name: str) -> bool:
        available = self.transitions(key)
        tid = available.get(to_name)
        if not tid:
            print(f"    ! no transition to {to_name!r} from here (have: {list(available)})")
            return False
        self._request("POST", f"/rest/api/3/issue/{key}/transitions", {"transition": {"id": tid}})
        return True


def category(issue: dict) -> str:
    return issue["fields"]["status"]["statusCategory"]["key"]


def wanted_status(children: list[dict]) -> str | None:
    """The status this epic should be in, or None to leave it alone."""
    if not children:
        return None

    cats = [category(c) for c in children]
    if IN_PROGRESS_CATEGORY in cats:
        return "In Progress"
    if all(c in DONE_CATEGORIES for c in cats):
        return "Done"
    if all(c == TODO_CATEGORY for c in cats):
        return "To Do"
    # Some done, some still to do, nothing actively moving: work has started.
    return "In Progress"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="actually transition (default: report)")
    ap.add_argument("--epic", help="only this epic, e.g. FHS-178")
    ap.add_argument("--project", default="FHS")
    args = ap.parse_args()

    jira = Jira()

    if args.epic:
        epics = jira.search(f"key = {args.epic}", ["summary", "status"])
    else:
        epics = jira.search(
            f"project = {args.project} AND issuetype = Epic ORDER BY key", ["summary", "status"]
        )
    print(f"checking {len(epics)} epic(s)\n")

    drift = 0
    for epic in epics:
        key = epic["key"]
        now = epic["fields"]["status"]["name"]
        children = jira.search(f"parent = {key}", ["status"])
        want = wanted_status(children)

        if want is None:
            continue
        if want == now:
            continue

        drift += 1
        counts: dict[str, int] = {}
        for c in children:
            name = c["fields"]["status"]["name"]
            counts[name] = counts.get(name, 0) + 1
        summary = epic["fields"]["summary"][:48]
        print(f"  {key}  {now!r} -> {want!r}   {summary}")
        print(f"    children: {counts}")

        if args.apply:
            if jira.transition(key, want):
                print("    moved")

    if drift == 0:
        print("  every epic already matches its children")
    elif not args.apply:
        print(f"\n{drift} epic(s) out of step. Re-run with --apply to fix.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except urllib.error.HTTPError as exc:
        sys.exit(f"error: {exc.code} {exc.reason}: {exc.read().decode()[:300]}")
