import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "student" | "admin" | "class_teacher";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  roll_number: string | null;
  phone: string | null;
  class: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  activeRole: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  loginWithRollNumber: (rollNumber: string, phone: string, role: string) => Promise<{ error?: string }>;
  setSessionFromOtp: (session: { access_token: string; refresh_token: string }, role: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  roles: [],
  activeRole: null,
  loading: true,
  signOut: async () => {},
  loginWithRollNumber: async () => ({}),
  setSessionFromOtp: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [activeRole, setActiveRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    if (profileRes.data) setProfile(profileRes.data as Profile);
    if (rolesRes.data) {
      const fetchedRoles = rolesRes.data.map((r) => r.role as AppRole);
      setRoles(fetchedRoles);
      // Restore active role from sessionStorage if available
      const stored = sessionStorage.getItem("campusvote_active_role");
      if (stored && fetchedRoles.includes(stored as AppRole)) {
        setActiveRole(stored as AppRole);
      } else if (fetchedRoles.length > 0 && !activeRole) {
        setActiveRole(fetchedRoles[0]);
      }
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchUserData(session.user.id), 0);
        } else {
          setProfile(null);
          setRoles([]);
          setActiveRole(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loginWithRollNumber = async (rollNumber: string, phone: string, role: string): Promise<{ error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke("auth-login", {
        body: { action: "login", roll_number: rollNumber, phone, role },
      });

      if (error) {
        return { error: "Login failed. Please try again." };
      }

      if (data?.error) {
        return { error: data.error };
      }

      if (data?.session) {
        // Set active role from login selection
        setActiveRole(role as AppRole);
        sessionStorage.setItem("campusvote_active_role", role);

        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        return {};
      }

      return { error: "Unexpected error occurred." };
    } catch (err: any) {
      return { error: err.message || "Login failed." };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setActiveRole(null);
    sessionStorage.removeItem("campusvote_active_role");
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, roles, activeRole, loading, signOut, loginWithRollNumber }}>
      {children}
    </AuthContext.Provider>
  );
}
