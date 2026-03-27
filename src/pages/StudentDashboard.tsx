import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Vote, Clock, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const StudentDashboard = () => {
  const { profile } = useAuth();

  const { data: elections } = useQuery({
    queryKey: ["elections"],
    queryFn: async () => {
      const { data } = await supabase.from("elections").select("*");
      return data ?? [];
    },
  });

  const { data: myVotes } = useQuery({
    queryKey: ["my-votes"],
    queryFn: async () => {
      const { data } = await supabase.from("votes").select("election_id");
      return data ?? [];
    },
  });

  const activeCount = elections?.filter((e) => e.status === "active").length ?? 0;
  const votedCount = myVotes?.length ?? 0;
  const totalCount = elections?.length ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Welcome, {profile?.full_name ?? "Student"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Your voting dashboard overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Elections</CardTitle>
            <Vote className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-heading font-bold text-foreground">{activeCount}</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Votes Cast</CardTitle>
            <CheckCircle className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-heading font-bold text-foreground">{votedCount}</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Elections</CardTitle>
            <Clock className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-heading font-bold text-foreground">{totalCount}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudentDashboard;
