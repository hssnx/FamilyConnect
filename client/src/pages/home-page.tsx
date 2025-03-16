import { useQuery } from "@tanstack/react-query";
import { Task, User } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import TaskCard from "@/components/task-card";
import Leaderboard from "@/components/leaderboard";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { User2, Star, Flame } from "lucide-react";
import { Loader2, Users, Calendar, History, Clock } from "lucide-react";
import { format, parseISO, isAfter, isBefore, isEqual, startOfDay } from "date-fns";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type TaskView = 'past' | 'current' | 'future';

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const [taskView, setTaskView] = useState<TaskView>('current');

  // Fetch tasks
  const { data: tasks, isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  if (tasksLoading || usersLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  // Filter tasks by date for current user only
  const filterTasksByDate = (tasks: Task[] = []) => {
    const today = startOfDay(new Date());
    const userTasks = tasks.filter(task => task.userId === user?.id);

    return {
      pastTasks: userTasks.filter(task => {
        const taskDate = startOfDay(parseISO(task.dueDate));
        return isBefore(taskDate, today);
      }),
      currentTasks: userTasks.filter(task => {
        const taskDate = startOfDay(parseISO(task.dueDate));
        return isEqual(taskDate, today);
      }),
      futureTasks: userTasks.filter(task => {
        const taskDate = startOfDay(parseISO(task.dueDate));
        return isAfter(taskDate, today);
      })
    };
  };

  // Filter family tasks by date (excluding current user's tasks)
  const filterFamilyTasksByDate = (tasks: Task[] = []) => {
    const today = startOfDay(new Date());
    // Filter out current user's tasks
    const familyTasks = tasks.filter(task => task.userId !== user?.id);

    return {
      pastTasks: familyTasks.filter(task => {
        const taskDate = startOfDay(parseISO(task.dueDate));
        return isBefore(taskDate, today);
      }),
      currentTasks: familyTasks.filter(task => {
        const taskDate = startOfDay(parseISO(task.dueDate));
        return isEqual(taskDate, today);
      }),
      futureTasks: familyTasks.filter(task => {
        const taskDate = startOfDay(parseISO(task.dueDate));
        return isAfter(taskDate, today);
      })
    };
  };

  const myTasksByDate = filterTasksByDate(tasks);
  const familyTasksByDate = filterFamilyTasksByDate(tasks);

  // Get tasks based on current view
  const getDisplayTasks = () => {
    switch (taskView) {
      case 'past':
        return myTasksByDate.pastTasks;
      case 'future':
        return myTasksByDate.futureTasks;
      default:
        return myTasksByDate.currentTasks;
    }
  };

  // Get family tasks based on current view
  const getDisplayFamilyTasks = () => {
    switch (taskView) {
      case 'past':
        return familyTasksByDate.pastTasks;
      case 'future':
        return familyTasksByDate.futureTasks;
      default:
        return familyTasksByDate.currentTasks;
    }
  };

  const getUsername = (userId: number) => {
    return users?.find((u) => u.id === userId)?.username || "Unknown";
  };

  const getViewTitle = () => {
    switch (taskView) {
      case 'past':
        return 'Past Tasks';
      case 'future':
        return 'Future Tasks';
      default:
        return "Today's Tasks";
    }
  };

  const getFamilyViewTitle = () => {
    switch (taskView) {
      case 'past':
        return 'Past Family Tasks';
      case 'future':
        return 'Future Family Tasks';
      default:
        return "Today's Family Tasks";
    }
  };

  const displayTasks = getDisplayTasks();
  const displayFamilyTasks = getDisplayFamilyTasks();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">ShahirConnect</h1>
            <div className="flex items-center gap-2">
              {user?.isAdmin && (
                <Link href="/admin">
                  <Button variant="outline">Admin Dashboard</Button>
                </Link>
              )}
              <Link href="/members">
                <Button variant="outline" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Members
                </Button>
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href={`/profile/${user?.id}`} className="text-sm text-muted-foreground hover:text-foreground">
              <div className="flex items-center gap-2">
                <User2 className="h-4 w-4" />
                <span className="font-medium text-foreground">User: {user?.username}</span>
              </div>
              <div className="flex items-center gap-4 mt-1">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span>{user?.points} points</span>
                </div>
                <div className="flex items-center gap-1">
                  <Flame className="h-4 w-4 text-orange-500" />
                  <span>{user?.streak} streak</span>
                </div>
              </div>
            </Link>
            <Button
              variant="ghost"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              {logoutMutation.isPending ? "Logging out..." : "Logout"}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            <div className="flex items-center justify-between mb-6">
              <motion.h2
                className="text-xl font-semibold"
                layout
              >
                {getViewTitle()}
              </motion.h2>
              <div className="flex items-center gap-2">
                <Button
                  variant={taskView === 'past' ? 'default' : 'outline'}
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={() => setTaskView('past')}
                >
                  <History className="h-4 w-4" />
                </Button>
                <Button
                  variant={taskView === 'current' ? 'default' : 'outline'}
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={() => setTaskView('current')}
                >
                  <Clock className="h-4 w-4" />
                </Button>
                <Button
                  variant={taskView === 'future' ? 'default' : 'outline'}
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={() => setTaskView('future')}
                >
                  <Calendar className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <motion.div layout>
              <AnimatePresence mode="wait">
                <motion.div
                  key={taskView}
                  initial={{ opacity: 0, x: taskView === 'future' ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: taskView === 'future' ? -20 : 20 }}
                  transition={{ duration: 0.2 }}
                  className="grid gap-4"
                >
                  {displayTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                  {displayTasks.length === 0 && (
                    <motion.p
                      className="text-muted-foreground"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {taskView === 'future'
                        ? `No future tasks as of ${format(new Date(), 'MMM d, yyyy')}`
                        : taskView === 'past'
                          ? `No past tasks as of ${format(new Date(), 'MMM d, yyyy')}`
                          : `No tasks due today (${format(new Date(), 'MMM d, yyyy')})`}
                    </motion.p>
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>

            <div>
              <motion.h2
                className="text-xl font-semibold mb-4"
                layout
              >
                {getFamilyViewTitle()}
              </motion.h2>
              <motion.div layout>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${taskView}-family`}
                    initial={{ opacity: 0, x: taskView === 'future' ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: taskView === 'future' ? -20 : 20 }}
                    transition={{ duration: 0.2 }}
                    className="grid gap-4"
                  >
                    {displayFamilyTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        showAssignee
                        assigneeName={getUsername(task.userId)}
                      />
                    ))}
                    {displayFamilyTasks.length === 0 && (
                      <motion.p
                        className="text-muted-foreground"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        {taskView === 'future'
                          ? `No future family tasks as of ${format(new Date(), 'MMM d, yyyy')}`
                          : taskView === 'past'
                            ? `No past family tasks as of ${format(new Date(), 'MMM d, yyyy')}`
                            : `No family tasks due today (${format(new Date(), 'MMM d, yyyy')})`}
                      </motion.p>
                    )}
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-6">Leaderboard</h2>
            <Leaderboard users={users || []} />
          </div>
        </div>
      </main>
    </div>
  );
}