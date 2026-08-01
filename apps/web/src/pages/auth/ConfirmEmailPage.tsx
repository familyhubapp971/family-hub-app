import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Loader2, Check, MailX } from 'lucide-react';
import { Button, Card } from '@familyhub/ui';
import { apiFetch } from '../../lib/api';

// FHS-510 — the landing page for an admin-initiated sign-in email change.
// An admin sets a new email for a grown-up on Manage Members; a one-time
// link is emailed to the NEW address; clicking it lands here and applies
// the change. Root-level route (outside ProtectedRoute) — the person
// clicking may not be signed in at all.
//
// Three states:
//   checking — spinner while we call the confirm endpoint.
//   done     — the change applied; shows the new email + a way back in.
//   expired  — the link is missing/used/expired; nothing was changed.

interface ConfirmResponse {
  newEmail: string;
  memberName: string;
  tenantSlug: string | null;
}

type Status =
  | { kind: 'checking' }
  | { kind: 'done'; newEmail: string; memberName: string; tenantSlug: string | null }
  | { kind: 'expired' };

export function ConfirmEmailPage() {
  const { memberId } = useParams<{ memberId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [status, setStatus] = useState<Status>({ kind: 'checking' });

  useEffect(() => {
    const token = params.get('token');
    if (!memberId || !token) {
      setStatus({ kind: 'expired' });
      return;
    }
    let cancelled = false;
    apiFetch<ConfirmResponse>('/api/members/email-change/confirm', {
      method: 'POST',
      anonymous: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, token }),
    })
      .then((body) => {
        if (cancelled) return;
        setStatus({
          kind: 'done',
          newEmail: body.newEmail,
          memberName: body.memberName,
          tenantSlug: body.tenantSlug,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Any failure (410 expired/used, network error, malformed request)
        // renders the same "expired" state — the visitor never needs to
        // know WHY, just that they should ask an admin for a fresh link.
        void err;
        setStatus({ kind: 'expired' });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per mount; memberId/token come from the URL
  }, []);

  function backToFamily() {
    if (status.kind === 'done' && status.tenantSlug) {
      navigate(`/t/${status.tenantSlug}/dashboard`);
    } else {
      navigate('/');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-kingdom-bg p-6 font-body">
      <Card className="flex w-full max-w-md flex-col items-center bg-white p-8 text-center md:p-12">
        {status.kind === 'checking' && (
          <>
            <IconDisc bg="bg-yellow-100" reduceMotion={!!reduceMotion}>
              <Loader2
                className="animate-spin text-black"
                size={32}
                aria-hidden="true"
                data-testid="confirm-email-spinner"
              />
            </IconDisc>
            <h1 className="mb-2 font-heading text-3xl">Checking your link</h1>
            <p className="font-bold text-gray-600">One moment&hellip;</p>
          </>
        )}

        {status.kind === 'done' && (
          <>
            <IconDisc bg="bg-emerald-100" reduceMotion={!!reduceMotion}>
              <Check className="text-black" size={32} aria-hidden="true" />
            </IconDisc>
            <h1 className="mb-4 font-heading text-3xl">Email updated</h1>
            <p className="mb-1 font-bold text-gray-600">{status.memberName} now signs in with</p>
            <p
              className="mb-8 font-heading text-xl text-black"
              data-testid="confirm-email-new-address"
            >
              {status.newEmail}
            </p>
            <Button
              type="button"
              variant="purple"
              size="lg"
              fullWidth
              onClick={backToFamily}
              testId="confirm-email-back"
            >
              Back to the family
            </Button>
          </>
        )}

        {status.kind === 'expired' && (
          <>
            <IconDisc bg="bg-gray-100" reduceMotion={!!reduceMotion}>
              <MailX className="text-gray-500" size={32} aria-hidden="true" />
            </IconDisc>
            <h1 className="mb-4 font-heading text-3xl">This link has expired</h1>
            <p className="mb-8 font-bold text-gray-600">
              It may already have been used, or the change was cancelled. Ask an admin to send a new
              one.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              fullWidth
              onClick={backToFamily}
              testId="confirm-email-back"
            >
              Back to the family
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}

function IconDisc({
  bg,
  reduceMotion,
  children,
}: {
  bg: string;
  reduceMotion: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className={`mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-black shadow-neo-sm ${bg}`}
      aria-hidden="true"
      initial={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
