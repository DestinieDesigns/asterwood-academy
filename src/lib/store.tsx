import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, type Learner, type Meta, type User } from "./api";

type Toast = { id: number; message: string; tone: "info" | "good" | "warn"; items?: { icon: string; name: string }[] };

type AppState = {
  ready: boolean;
  meta: Meta | null;
  user: User | null;
  learners: Learner[];
  learner: Learner | null;
  version: number;
  aiEnabled: boolean;
  serverOffline: boolean;
  refreshAuth: () => Promise<void>;
  refreshLearner: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  signup: (payload: { username?: string; email?: string | null; password: string; name?: string; age?: number | null; role?: string }) => Promise<void>;
  guest: () => Promise<void>;
  logout: () => Promise<void>;
  switchLearner: (id: string) => Promise<void>;
  patchLearner: (patch: Record<string, unknown>) => Promise<void>;
  bump: () => void;
  toast: (message: string, tone?: Toast["tone"], items?: Toast["items"]) => void;
};

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [version, setVersion] = useState(0);
  const [serverOffline, setServerOffline] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const toast = useCallback((message: string, tone: Toast["tone"] = "info", items?: Toast["items"]) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message, tone, items }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  const loadAuth = useCallback(async () => {
    const data = await api<{ user: User | null; learners: Learner[] }>("/auth/me");
    setUser(data.user);
    setLearners(data.learners || []);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [m] = await Promise.all([api<Meta>("/meta"), loadAuth()]);
        if (!alive) return;
        setMeta(m);
        setServerOffline(false);
      } catch {
        if (alive) {
          setServerOffline(true);
          toast("Could not reach the Asterwood server. Is it running?", "warn");
        }
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => { alive = false; };
  }, [loadAuth, toast]);

  const learner = useMemo(() => {
    if (!user) return null;
    return learners.find((l) => l.id === user.activeLearnerId) || learners[0] || null;
  }, [learners, user]);

  const patchLearner = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!learner) return;
      const data = await api<{ learner: Learner }>(`/learners/${learner.id}`, { method: "PATCH", json: patch });
      setLearners((list) => list.map((l) => (l.id === data.learner.id ? data.learner : l)));
      setVersion((v) => v + 1);
    },
    [learner],
  );

  const refreshLearner = useCallback(async () => {
    if (!learner) return;
    const data = await api<{ learners: Learner[] }>("/learners");
    setLearners(data.learners);
    setVersion((v) => v + 1);
  }, [learner]);

  const login = useCallback(async (identifier: string, password: string) => {
    await api("/auth/login", { method: "POST", json: { identifier, password } });
    await loadAuth();
    setVersion((v) => v + 1);
  }, [loadAuth]);

  const signup = useCallback(
    async (payload: { username?: string; email?: string | null; password: string; name?: string; age?: number | null; role?: string }) => {
      await api("/auth/signup", { method: "POST", json: payload });
      await loadAuth();
      setVersion((v) => v + 1);
    },
    [loadAuth],
  );

  const guest = useCallback(async () => {
    await api("/auth/guest", { method: "POST", json: {} });
    await loadAuth();
    setVersion((v) => v + 1);
  }, [loadAuth]);

  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST", json: {} });
    setUser(null);
    setLearners([]);
  }, []);

  const switchLearner = useCallback(async (id: string) => {
    await api("/auth/active", { method: "POST", json: { learnerId: id } });
    await loadAuth();
    setVersion((v) => v + 1);
  }, [loadAuth]);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const value: AppState = {
    ready,
    meta,
    user,
    learners,
    learner,
    version,
    aiEnabled: Boolean(meta?.ai?.enabled),
    serverOffline,
    refreshAuth: loadAuth,
    refreshLearner,
    login,
    signup,
    guest,
    logout,
    switchLearner,
    patchLearner,
    bump,
    toast,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            <span>{t.message}</span>
            {t.items?.length ? (
              <div className="toast__items">
                {t.items.map((i) => (
                  <span key={i.name}>{i.icon} {i.name}</span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
