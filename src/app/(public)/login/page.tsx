"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";

type AuthMode = "signin" | "signup" | "magic_link";

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const supabase = createClient();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (mode === "magic_link") {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setError(error.message);
      } else {
        setSuccess("Check your email for the magic link!");
      }
    } else if (mode === "signup") {
      if (password.length < 8) {
        setError("Password must be at least 8 characters");
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setError(error.message);
      } else {
        setSuccess("Check your email to confirm your account!");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        window.location.href = "/dashboard";
      }
    }

    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0A1628] px-4">
      <motion.div
        className="w-full max-w-sm space-y-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Splat<span className="text-[#00D4AA]">Afrika</span>
          </h1>
          <p className="mt-2 text-sm text-[#8FA3B1]">
            {mode === "signup"
              ? "Create your account"
              : "Sign in to your account"}
          </p>
        </div>

        {/* Google Sign In */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 text-[#1C2B36] font-medium text-sm rounded-xl transition-all duration-200 disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-[#8FA3B1]">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Email form */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-white/80 tracking-wide">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-[#0F2040] border border-white/10 hover:border-white/20 focus:border-[#00D4AA] rounded-xl text-white placeholder:text-[#8FA3B1] outline-none transition-colors duration-150 focus:ring-2 focus:ring-[#00D4AA]/20 text-base"
              placeholder="you@example.com"
            />
          </div>

          {mode !== "magic_link" && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-white/80 tracking-wide">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-3 bg-[#0F2040] border border-white/10 hover:border-white/20 focus:border-[#00D4AA] rounded-xl text-white placeholder:text-[#8FA3B1] outline-none transition-colors duration-150 focus:ring-2 focus:ring-[#00D4AA]/20 text-base"
                placeholder="Min. 8 characters"
              />
            </div>
          )}

          {/* Error / Success messages */}
          {error && (
            <p className="text-sm text-[#EF4444] bg-[#EF4444]/10 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-[#10B981] bg-[#10B981]/10 px-3 py-2 rounded-lg">
              {success}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-8 py-4 bg-[#00D4AA] hover:bg-[#33DDBB] active:bg-[#00BF97] text-[#003D30] font-semibold text-base rounded-2xl transition-all duration-200 ease-out hover:shadow-[0_8px_24px_rgba(0,212,170,0.35)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4AA] focus-visible:ring-offset-2"
          >
            {loading
              ? "Loading..."
              : mode === "magic_link"
                ? "Send Magic Link"
                : mode === "signup"
                  ? "Create Account"
                  : "Sign In"}
          </button>
        </form>

        {/* Mode switchers */}
        <div className="space-y-2 text-center">
          {mode === "signin" && (
            <>
              <button
                onClick={() => setMode("magic_link")}
                className="text-sm text-[#00D4AA] hover:text-[#33DDBB] transition-colors"
              >
                Sign in with magic link instead
              </button>
              <p className="text-sm text-[#8FA3B1]">
                Don&apos;t have an account?{" "}
                <button
                  onClick={() => setMode("signup")}
                  className="text-[#00D4AA] hover:text-[#33DDBB] font-medium transition-colors"
                >
                  Sign up
                </button>
              </p>
            </>
          )}
          {mode === "signup" && (
            <p className="text-sm text-[#8FA3B1]">
              Already have an account?{" "}
              <button
                onClick={() => setMode("signin")}
                className="text-[#00D4AA] hover:text-[#33DDBB] font-medium transition-colors"
              >
                Sign in
              </button>
            </p>
          )}
          {mode === "magic_link" && (
            <button
              onClick={() => setMode("signin")}
              className="text-sm text-[#8FA3B1] hover:text-white transition-colors"
            >
              ← Back to password sign in
            </button>
          )}
        </div>
      </motion.div>
    </main>
  );
}
