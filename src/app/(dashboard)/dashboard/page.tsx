import { createClient } from "@/lib/supabase/server";
import { getDashboardMetrics } from "@/lib/queries/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, GitBranch, Users, Calendar } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";

export default async function DashboardPage() {
  const supabase = await createClient();
  const metrics = await getDashboardMetrics(supabase);

  const cards = [
    {
      title: "Companies",
      value: metrics.totalCompanies,
      description: "Active companies in your group",
      icon: Building2,
    },
    {
      title: "Branches",
      value: metrics.totalBranches,
      description: "Active branches across all companies",
      icon: GitBranch,
    },
    {
      title: "Users",
      value: metrics.totalUsers,
      description: "Active system users",
      icon: Users,
    },
    {
      title: "Financial Year",
      value: metrics.currentFY,
      description: metrics.fyLocked ? "Locked" : "Active",
      icon: Calendar,
      isText: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your enterprise platform
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {card.title === "Financial Year" && metrics.fyLocked ? (
                  <StatusBadge status="locked" />
                ) : (
                  card.description
                )}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
