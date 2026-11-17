"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CircleAlert, Loader2, LogIn, MailCheck } from "lucide-react";
import { BrandBar } from "@/components/brand/brand-bar";
import { Logo, Tagline } from "@/components/brand/logo";
import { useSession } from "@/components/auth/session-provider";
import { Button, Field, Input, buttonVariants } from "@/components/ui";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";

/**
 * Where the invitation email's "Join Practise360" button lands. Public: the token in the URL is the proof they own the
 * invited mailbox. Joining creates their account, applies the role they were invited to and signs them in.
 */
export default function InvitePage() {
  const { token } = useParams();
  const router = useRouter();
  const { me, signIn } = useSession();
  const [invite, setInvite] = useState(null);
  const [devLogin, setDevLogin] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    api(`/invites/${encodeURIComponent(token)}`)
      .then((data) => {
        setInvite(data);
        setName(data.suggestedName);
      })
      .catch((err) => setLoadError(err.message));
    api("/auth/config")
      .then((c) => setDevLogin(!!c.devLogin))
      .catch(() => setDevLogin(false));
  }, [token]);

  async function join(e) {
    e.preventDefault();
    if (!invite.hasAccount && !name.trim()) return setError("Tell us your name");
    setError("");
    setJoining(true);
    try {
      const result = await api(`/invites/${encodeURIComponent(token)}/accept`, { method: "POST", body: { displayName: name } });
      await signIn(result.token);
      router.replace(`/practices/${result.practiceId}`);
    } catch (err) {
      setError(err.message);
      setJoining(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <BrandBar />
      <div className="grid flex-1 md:grid-cols-2">
        <section className="flex flex-col justify-between bg-nu-dark p-8 text-white md:p-12">
          <Logo onDark className="h-9 self-start" />
          <div className="my-10">
            <h1 className="text-3xl font-extrabold text-white md:text-4xl">Practise360</h1>
            <p className="mt-3 max-w-md text-sm text-gray-300">
              One portal for practices, certifications and AI initiatives — you see the apps your roles give you.
            </p>
          </div>
          <Tagline className="text-nu-light-purple" />
        </section>

        <section className="flex items-center justify-center p-6 md:p-12">
          <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
            {!invite && !loadError ? (
              <p className="flex items-center justify-center py-8 text-sm text-nu-muted-teal" role="status">
                <Loader2 className="mr-2 size-5 animate-spin" aria-hidden="true" /> Checking your invitation…
              </p>
            ) : loadError ? (
              <div role="alert">
                <CircleAlert className="mb-3 size-8 text-nu-red-orange" aria-hidden="true" />
                <h2 className="text-2xl font-extrabold">Can't use this invitation</h2>
                <p className="mb-6 mt-2 text-sm text-nu-dark-teal">{loadError}</p>
                <Link href="/login" className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "w-full")}>
                  <LogIn aria-hidden="true" /> Go to sign in
                </Link>
              </div>
            ) : (
              <>
                <MailCheck className="mb-3 size-8 text-nu-purple" aria-hidden="true" />
                <h2 className="text-2xl font-extrabold">You're invited</h2>
                <p className="mb-6 mt-2 text-sm text-nu-dark-teal">
                  <strong>{invite.invitedBy}</strong> invited you to join Practise360 as <strong className="text-nu-purple">{invite.role}</strong>.
                </p>
                <form onSubmit={join} className="space-y-4" noValidate>
                  <Field id="invite-email" label="Email">
                    <Input id="invite-email" type="email" readOnly value={invite.email} className="bg-gray-50" />
                  </Field>
                  {!invite.hasAccount && (
                    <Field id="invite-name" label="Your name" hint="How colleagues see you in Practise360">
                      {(a11y) => <Input {...a11y} autoComplete="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />}
                    </Field>
                  )}
                  {me && (
                    <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                      You're signed in as {me.displayName}. Joining signs you in as {invite.email} instead.
                    </p>
                  )}
                  {error && <p className="text-xs text-rose-600" role="alert">{error}</p>}
                  <Button type="submit" size="lg" className="w-full" disabled={joining}>
                    {joining ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogIn aria-hidden="true" />}{" "}
                    {joining ? "Joining…" : invite.hasAccount ? "Accept and sign in" : "Join Practise360"}
                  </Button>
                </form>
                <p className="mt-4 text-[11px] text-gray-400">
                  This link works once and expires on {formatDate(invite.expiresAt)}.
                  {devLogin && <> Next time, sign in with your email and the dev password <code className="font-mono">password</code>.</>}
                </p>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
