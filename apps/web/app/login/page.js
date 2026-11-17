"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BrandBar } from "@/components/brand/brand-bar";
import { Logo, Tagline } from "@/components/brand/logo";
import { LoginForm } from "@/components/auth/login-form";
import { useSession } from "@/components/auth/session-provider";

export default function LoginPage() {
  const router = useRouter();
  const { me } = useSession();

  useEffect(() => {
    if (me) router.replace("/");
  }, [me, router]);

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
            <h2 className="text-2xl font-extrabold">Sign in</h2>
            <p className="mb-6 mt-1 text-xs text-nu-muted-teal">Continue with your Google account.</p>
            <LoginForm />
          </div>
        </section>
      </div>
    </div>
  );
}
