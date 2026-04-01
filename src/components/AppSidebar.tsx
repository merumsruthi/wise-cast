import { Vote, LayoutDashboard, Users, Trophy, LogOut, Settings, GraduationCap, Shield, BookOpen, FileText } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const roleLabels: Record<string, string> = {
  student: "Student",
  admin: "Admin",
  class_teacher: "Class Teacher",
};

const roleIcons: Record<string, any> = {
  student: GraduationCap,
  admin: Shield,
  class_teacher: BookOpen,
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { roles, activeRole, profile, signOut } = useAuth();

  const isAdmin = activeRole === "admin";
  const isTeacher = activeRole === "class_teacher";
  const isStudent = activeRole === "student";

  const studentItems = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Elections", url: "/dashboard/elections", icon: Vote },
    { title: "Nominations", url: "/dashboard/nominations", icon: FileText },
  ];

  const adminItems = [
    { title: "Admin Dashboard", url: "/dashboard/admin", icon: Settings },
    { title: "Manage Elections", url: "/dashboard/admin/elections", icon: Vote },
    { title: "Results", url: "/dashboard/admin/results", icon: Trophy },
    { title: "Nominations", url: "/dashboard/admin/nominations", icon: FileText },
  ];

  const teacherItems = [
    { title: "Teacher Dashboard", url: "/dashboard/teacher", icon: Users },
    { title: "CR Elections", url: "/dashboard/teacher/elections", icon: Vote },
    { title: "Class Results", url: "/dashboard/teacher/results", icon: Trophy },
  ];

  const RoleIcon = activeRole ? roleIcons[activeRole] : GraduationCap;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="px-4 py-4 flex items-center gap-2">
          <Vote className="h-6 w-6 text-sidebar-primary shrink-0" />
          {!collapsed && <span className="font-heading text-lg font-bold text-sidebar-foreground">CampusVote</span>}
        </div>

        {/* Active role indicator */}
        {!collapsed && activeRole && (
          <div className="px-4 pb-2">
            <Badge variant="secondary" className="w-full justify-center gap-1 py-1 text-xs">
              <RoleIcon className="h-3 w-3" />
              {roleLabels[activeRole]}
            </Badge>
          </div>
        )}

        {isStudent && (
          <SidebarGroup>
            <SidebarGroupLabel>Student</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {studentItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} end className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} end className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isTeacher && (
          <SidebarGroup>
            <SidebarGroupLabel>Class Teacher</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {teacherItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} end className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed && profile && (
          <div className="px-2 mb-2">
            <p className="text-xs font-medium text-sidebar-foreground truncate">{profile.full_name}</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{profile.roll_number}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={signOut}
          className="w-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sign Out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
