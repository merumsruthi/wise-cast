import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";

const TeacherResults = () => {
  const [selectedElection, setSelectedElection] = useState("");

  const { data: elections } = useQuery({
    queryKey: ["cr-elections"],
    queryFn: async () => {
      const { data } = await supabase.from("elections").select("*").eq("election_type", "cr").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: results } = useQuery({
    queryKey: ["results", selectedElection],
    queryFn: async () => {
      if (!selectedElection) return [];
      const { data } = await supabase.rpc("get_election_results", { p_election_id: selectedElection });
      return data ?? [];
    },
    enabled: !!selectedElection,
  });

  const maxVotes = Math.max(...(results?.map((r) => Number(r.vote_count)) ?? [0]), 1);

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="font-heading text-2xl font-bold text-foreground">Class-wise Results</h1>

      <Select value={selectedElection} onValueChange={setSelectedElection}>
        <SelectTrigger className="w-full max-w-sm">
          <SelectValue placeholder="Select a CR election..." />
        </SelectTrigger>
        <SelectContent>
          {elections?.map((e) => (
            <SelectItem key={e.id} value={e.id}>{e.title} ({e.class})</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedElection && results && (
        <div className="space-y-3">
          {results.map((r, i) => (
            <Card key={r.candidate_id} className="glass-card">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 shrink-0">
                  {i === 0 ? <Trophy className="h-5 w-5 text-warning" /> : <span className="font-heading font-bold text-muted-foreground">{i + 1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{r.candidate_name}</p>
                  <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full gradient-primary transition-all duration-500" style={{ width: `${(Number(r.vote_count) / maxVotes) * 100}%` }} />
                  </div>
                </div>
                <Badge variant="secondary" className="font-heading text-lg">{String(r.vote_count)}</Badge>
              </CardContent>
            </Card>
          ))}
          {results.length === 0 && <p className="text-muted-foreground text-center py-8">No votes yet.</p>}
        </div>
      )}
    </div>
  );
};

export default TeacherResults;
