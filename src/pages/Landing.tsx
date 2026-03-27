import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Vote, Shield, Users, CheckCircle } from "lucide-react";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Vote className="h-7 w-7 text-primary" />
          <span className="font-heading text-xl font-bold text-foreground">CampusVote</span>
        </div>
        <Link to="/login">
          <Button>Login</Button>
        </Link>
      </nav>

      {/* Hero */}
      <section className="gradient-hero text-primary-foreground py-24 px-6">
        <div className="max-w-4xl mx-auto text-center animate-fade-in">
          <h1 className="font-heading text-4xl md:text-6xl font-bold mb-6 leading-tight">
            College Elections,<br />Made Digital
          </h1>
          <p className="text-lg md:text-xl opacity-80 mb-8 max-w-2xl mx-auto">
            A secure, transparent, and efficient online voting system for Student Council and Class Representative elections.
          </p>
          <Link to="/login">
            <Button size="lg" className="gradient-accent text-accent-foreground border-0 text-base px-8 py-6 rounded-xl font-semibold shadow-lg hover:opacity-90 transition-opacity">
              Get Started
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-heading text-3xl font-bold text-center mb-12 text-foreground">
            Why CampusVote?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Shield,
                title: "Secure Voting",
                desc: "One vote per student per election. Tamper-proof with database-level constraints.",
              },
              {
                icon: Users,
                title: "Role-Based Access",
                desc: "Separate dashboards for Students, Admins, and Class Teachers with specific controls.",
              },
              {
                icon: CheckCircle,
                title: "Real-Time Results",
                desc: "Live vote counts and instant result tallying once elections conclude.",
              },
            ].map((f) => (
              <div key={f.title} className="glass-card rounded-xl p-6 animate-fade-in">
                <f.icon className="h-10 w-10 text-primary mb-4" />
                <h3 className="font-heading text-lg font-semibold mb-2 text-foreground">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-6 text-center text-muted-foreground text-sm">
        <p>© 2026 CampusVote — Online Voting System for College Elections</p>
      </footer>
    </div>
  );
};

export default Landing;
