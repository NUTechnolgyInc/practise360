"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { Badge, Button, Field, Input, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useSession } from "./session-provider";
import { DemoUsers } from "./demo-users";

export function LoginForm() {
  const router = useRouter();
  const toast = useToast();
  const { signIn } = useSession();
  const [config, setConfig] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api("/auth/config").then(setConfig).catch((err) => setError(err.message));
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { token } = await api("/auth/login", { method: "POST", body: { username, password } });
      await signIn(token);
      router.replace("/");
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  async function onGoogle() {
    try {
      await api("/auth/google", { method: "POST" });
    } catch (err) {
      toast(err.message, "info");
    }
  }

  const pick = (u) => {
    setUsername(u);
    setPassword("password");
    setError("");
  };

  return (
    <div>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field id="username" label="Username">
          <Input id="username" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. de.lead" />
        </Field>
        <Field id="password" label="Password" error={error || undefined}>
          {(a11y) => (
            <Input {...a11y} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={submitting || !username || !password}>
          <LogIn aria-hidden="true" /> {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-gray-400">
        <span className="h-px flex-1 bg-gray-200" /> or <span className="h-px flex-1 bg-gray-200" />
      </div>
      <Button variant="secondary" size="lg" className="w-full" onClick={onGoogle}>
        Continue with Google <Badge variant="neutral" className="text-[10px]">Coming soon</Badge>
      </Button>

      {config?.devLogin && config.demoUsers?.length > 0 && <DemoUsers users={config.demoUsers} onPick={pick} />}
    </div>
  );
}
