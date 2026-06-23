import { useCallback, useEffect, useMemo, useState } from 'react';
import { Gift, Star } from 'lucide-react';
import { Button } from '@familyhub/ui';
import { useAuth } from '../../lib/auth-context';
import { useTenantSlug } from '../../lib/tenant-context';
import { API_BASE } from '../../lib/api';

// FHS-376 — parent "Reward requests" inbox. A kid asks for a reward; this lists
// the family's PENDING requests so a parent can approve or decline. Approval is
// admin-only AND server-enforced (the API returns 403 for non-admins); here we
// also hide the buttons for non-admins and show a gentle note instead.
// Renders nothing until there's at least one pending request — so it only
// surfaces on the parent's screen when a child is actually waiting.

interface RequestItem {
  id: string;
  memberId: string;
  memberName: string;
  rewardId: string;
  rewardName: string;
  rewardIcon: string | null;
  starCost: number;
  status: 'pending' | 'approved' | 'declined';
  requestedAt: string;
}

export function RewardRequestsPanel() {
  const { session } = useAuth();
  const slug = useTenantSlug();
  const accessToken = session?.access_token ?? null;
  const headers = useMemo(
    () => (accessToken ? { Authorization: `Bearer ${accessToken}`, 'x-tenant-slug': slug } : null),
    [accessToken, slug],
  );

  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; msg: string } | null>(null);

  useEffect(() => {
    if (!headers) return;
    const ac = new AbortController();
    fetch(`${API_BASE}/api/members`, { headers, signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((b: { callerRole?: string }) => setIsAdmin(b.callerRole === 'admin'))
      .catch(() => {});
    fetch(`${API_BASE}/api/mw/redemption-requests?status=pending`, { headers, signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((b: { requests?: RequestItem[] }) => setRequests(b.requests ?? []))
      .catch(() => {});
    return () => ac.abort();
  }, [headers]);

  const decide = useCallback(
    async (id: string, action: 'approve' | 'decline') => {
      if (!headers || busyId) return;
      setBusyId(id);
      setRowError(null);
      try {
        const res = await fetch(`${API_BASE}/api/mw/redemption-requests/${id}/${action}`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
        if (res.ok || res.status === 409) {
          // 409 = already decided by someone else; drop it either way.
          setRequests((prev) => prev.filter((r) => r.id !== id));
          return;
        }
        if (res.status === 400) {
          setRowError({ id, msg: 'Not enough savings to approve yet.' });
          return;
        }
        setRowError({ id, msg: "Couldn't update — try again." });
      } catch {
        setRowError({ id, msg: "Couldn't update — try again." });
      } finally {
        setBusyId(null);
      }
    },
    [headers, busyId],
  );

  if (requests.length === 0) return null;

  return (
    <section
      data-testid="reward-requests-panel"
      aria-labelledby="reward-requests-heading"
      className="mb-6 rounded-2xl border-2 border-black bg-white p-4 shadow-neo sm:border-3 md:p-6"
    >
      <h2
        id="reward-requests-heading"
        className="mb-3 flex items-center gap-2 font-heading text-xl text-black"
      >
        <span
          aria-hidden="true"
          className="grid h-8 w-8 place-items-center rounded-lg border-2 border-black bg-pink-400"
        >
          <Gift className="h-4 w-4" />
        </span>
        Reward requests
        <span
          data-testid="reward-requests-count"
          className="rounded-full border-2 border-black bg-yellow-300 px-2 py-0.5 text-xs font-black text-black"
        >
          {requests.length}
        </span>
      </h2>

      {!isAdmin && (
        <p className="mb-3 text-sm font-bold text-gray-500" data-testid="reward-requests-readonly">
          Only a parent with admin rights can approve these.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {requests.map((r) => (
          <li
            key={r.id}
            data-testid={`reward-request-${r.id}`}
            className="flex flex-col gap-2 rounded-xl border-2 border-black bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-black">
                {r.memberName} wants {r.rewardIcon ? `${r.rewardIcon} ` : ''}
                {r.rewardName}
              </p>
              <p className="flex items-center gap-1 text-xs font-bold text-purple-700">
                <Star size={12} className="fill-yellow-500" aria-hidden="true" /> {r.starCost} stars
                · from savings
              </p>
              {rowError?.id === r.id && (
                <p
                  data-testid={`reward-request-error-${r.id}`}
                  className="text-xs font-bold text-red-500"
                >
                  {rowError.msg}
                </p>
              )}
            </div>
            {isAdmin && (
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => void decide(r.id, 'approve')}
                  disabled={busyId === r.id}
                  testId={`reward-request-approve-${r.id}`}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void decide(r.id, 'decline')}
                  disabled={busyId === r.id}
                  testId={`reward-request-decline-${r.id}`}
                >
                  Decline
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
