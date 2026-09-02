import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import type { User } from "@supabase/supabase-js";

export type AuthState = "loading" | "authenticated" | "unauthenticated";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [authState, setAuthState] = useState<AuthState>("loading");

  useEffect(() => {
    let mounted = true;

    // Get initial session
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session?.user) {
        setUser(data.session.user);
        setAuthState("authenticated");
      } else {
        setAuthState("unauthenticated");
      }
    });

    // Listen for auth changes
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
        setAuthState("authenticated");
      } else {
        setUser(null);
        setAuthState("unauthenticated");
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAuthState("unauthenticated");
  }, []);

  return { user, authState, signOut };
}
