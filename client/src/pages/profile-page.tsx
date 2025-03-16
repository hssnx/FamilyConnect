import { useQuery, useMutation } from "@tanstack/react-query";
import { User, Task } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "wouter";
import { Loader2, User2, Star, Flame, ArrowLeft, ThumbsUp, ThumbsDown, CheckCircle2, XCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useAuth();

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/users", id],
    queryFn: async () => {
      const res = await fetch(`/api/users/${id}`);
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json();
    },
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: interactions } = useQuery({
    queryKey: ["/api/users", id, "interactions"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${id}/interactions`);
      if (!res.ok) throw new Error("Failed to fetch interactions");
      return res.json();
    },
  });

  const interactionCounts = {
    likes: interactions?.filter(i => i.type === 'like' && i.approved).length || 0,
    dislikes: interactions?.filter(i => i.type === 'dislike' && i.approved).length || 0,
  };

  const interactionMutation = useMutation({
    mutationFn: async (type: 'like' | 'dislike') => {
      const res = await apiRequest("POST", "/api/interactions", {
        receiverId: parseInt(id),
        type: type,
      });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", id, "interactions"] });
      toast({
        title: "Success",
        description: data.message,
      });
    },
    onError: (error: any) => {
      console.error("Failed to submit interaction:", error);
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to submit interaction",
        variant: "destructive",
      });
    },
  });

  const userTasks = tasks?.filter((task) => 
    task.userId === parseInt(id) || task.completedBy === parseInt(id)
  ) || [];

  const completedTasks = userTasks.filter((task) => 
    task.completed && (
      task.userId === parseInt(id) || 
      task.completedBy === parseInt(id)
    )
  );

  const incompleteTasks = userTasks.filter((task) => 
    !task.completed && task.userId === parseInt(id)
  );

  if (userLoading || tasksLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!user) {
    return <div>User not found</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/members" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Back to Members
            </Link>
          </div>
          <div className="text-sm text-muted-foreground">
            Logged in as {currentUser?.username}
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-8">
        <div className="space-y-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-6">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <User2 className="h-10 w-10 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold">{user.username}</h1>
                    {currentUser?.id !== parseInt(id) && (
                      <div className="flex items-center gap-4">
                        <motion.button
                          onClick={() => interactionMutation.mutate('like')}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 disabled:opacity-50"
                          disabled={interactionMutation.isPending}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <ThumbsUp className="h-5 w-5" />
                          <AnimatePresence mode="wait">
                            <motion.span
                              key={interactionCounts.likes}
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              className="font-medium"
                            >
                              {interactionCounts.likes}
                            </motion.span>
                          </AnimatePresence>
                        </motion.button>
                        <motion.button
                          onClick={() => interactionMutation.mutate('dislike')}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 disabled:opacity-50"
                          disabled={interactionMutation.isPending}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <ThumbsDown className="h-5 w-5" />
                          <AnimatePresence mode="wait">
                            <motion.span
                              key={interactionCounts.dislikes}
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              className="font-medium"
                            >
                              {interactionCounts.dislikes}
                            </motion.span>
                          </AnimatePresence>
                        </motion.button>
                      </div>
                    )}
                  </div>
                  <p className="text-lg text-muted-foreground">
                    {user.isAdmin ? "Administrator" : "Family Member"}
                  </p>
                  <div className="flex items-center gap-6 mt-4">
                    <div className="flex items-center gap-2">
                      <Star className="h-6 w-6 text-yellow-500" />
                      <div>
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={user.points}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="font-semibold"
                          >
                            {user.points}
                          </motion.div>
                        </AnimatePresence>
                        <div className="text-sm text-muted-foreground">Points</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Flame className="h-6 w-6 text-orange-500" />
                      <div>
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={user.streak}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="font-semibold"
                          >
                            {user.streak}
                          </motion.div>
                        </AnimatePresence>
                        <div className="text-sm text-muted-foreground">Day Streak</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  Completed Tasks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {completedTasks.map((task) => (
                    <Link key={task.id} href={`/task/${task.id}`}>
                      <div className="p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/5 transition-colors cursor-pointer">
                        <div className="font-medium">{task.title}</div>
                        <div className="text-sm text-muted-foreground flex items-center justify-between">
                          <span>{task.category}</span>
                          {task.userId !== parseInt(id) && (
                            <span className="text-primary">(Completed for another user)</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                  {completedTasks.length === 0 && (
                    <p className="text-sm text-muted-foreground">No completed tasks yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-5 w-5" />
                  Incomplete Tasks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {incompleteTasks.map((task) => (
                    <Link key={task.id} href={`/task/${task.id}`}>
                      <div className="p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/5 transition-colors cursor-pointer">
                        <div className="font-medium">{task.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {task.category}
                        </div>
                      </div>
                    </Link>
                  ))}
                  {incompleteTasks.length === 0 && (
                    <p className="text-sm text-muted-foreground">No incomplete tasks.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}