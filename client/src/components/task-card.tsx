import { Task } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Clock, User2, Calendar, AlertTriangle, Pencil } from "lucide-react";
import { format, parseISO, isAfter, isBefore, isEqual, startOfDay } from "date-fns";
import { Link } from "wouter";
import { motion } from "framer-motion";

interface TaskCardProps {
  task: Task;
  showAssignee?: boolean;
  assigneeName?: string;
}

export default function TaskCard({ task, showAssignee, assigneeName }: TaskCardProps) {
  const today = startOfDay(new Date());
  const taskDate = startOfDay(parseISO(task.dueDate));

  const isFutureTask = isAfter(taskDate, today);
  const isPastTask = isBefore(taskDate, today);
  const isCurrentTask = isEqual(taskDate, today);
  const hasAttempts = task.attempts > 0;

  const getTaskStatusColor = () => {
    if (task.completed) return "text-green-500";
    if (hasAttempts) return "text-yellow-500";
    if (isPastTask) return "text-red-500";
    if (isFutureTask) return "text-blue-500";
    return "text-yellow-500";
  };

  const getTaskStatusIcon = () => {
    if (task.completed) return <CheckCircle2 className={`h-4 w-4 ${getTaskStatusColor()} flex-shrink-0`} />;
    if (hasAttempts) return <Pencil className={`h-4 w-4 ${getTaskStatusColor()} flex-shrink-0`} />;
    if (isPastTask) return <XCircle className={`h-4 w-4 ${getTaskStatusColor()} flex-shrink-0`} />;
    return <Clock className={`h-4 w-4 ${getTaskStatusColor()} flex-shrink-0`} />;
  };

  const formattedDate = format(taskDate, "MMM d, yyyy");
  const dateLabel = isFutureTask ? "Due" : isPastTask ? "Was due" : "Due today";

  const getCompletionIcon = () => {
    if (!task.completed && !hasAttempts) {
      return <Clock className="h-3 w-3 text-yellow-500" />;
    }
    if (!task.completed && hasAttempts) {
      return <Pencil className="h-3 w-3 text-yellow-500" />;
    }
    return task.completedBy === task.userId 
      ? <CheckCircle2 className="h-3 w-3 text-green-500" />
      : <AlertTriangle className="h-3 w-3 text-red-500" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      layout
    >
      <Card className="overflow-hidden transition-all duration-200 hover:shadow-md">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <motion.h3 
                  className="text-lg font-semibold truncate"
                  layout="position"
                >
                  {task.title}
                </motion.h3>
                <motion.div layout>
                  {getTaskStatusIcon()}
                </motion.div>
              </div>
              <motion.div 
                className="text-sm text-muted-foreground mt-1 flex items-center gap-2"
                layout="position"
              >
                <span>{task.category}</span>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{dateLabel}: {formattedDate}</span>
                </div>
              </motion.div>
              {showAssignee && (
                <motion.div 
                  className="flex items-center gap-4 mt-1 text-sm text-muted-foreground"
                  layout="position"
                >
                  <div className="flex items-center gap-1">
                    <User2 className="h-3 w-3" />
                    <span>Assigned to: {assigneeName}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {getCompletionIcon()}
                    <span>
                      {!task.completed && !hasAttempts && "Not started"}
                      {!task.completed && hasAttempts && `Attempted (${task.attempts} ${task.attempts === 1 ? 'try' : 'tries'})`}
                      {task.completed && task.completedBy === task.userId && "Completed by assignee"}
                      {task.completed && task.completedBy !== task.userId && `Completed by ${task.completedByName || 'Another user'}`}
                    </span>
                  </div>
                </motion.div>
              )}
            </div>
            <Link href={`/task/${task.id}`}>
              <Button variant="outline" size="sm">
                {task.completed ? "View" : hasAttempts ? "Continue" : "Start"}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}