import { useQuery, useMutation } from "@tanstack/react-query";
import { Task, Submission } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { Loader2, ArrowLeft, Calendar, Target, FileText, History } from "lucide-react";
import { Link, useParams } from "wouter";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { format, parseISO, startOfDay, isAfter, isBefore } from "date-fns";

export default function TaskPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    explanation: string;
    hint?: string;
  } | null>(null);

  // Fetch task data
  const { data: task, isLoading: taskLoading } = useQuery<Task>({
    queryKey: ["/api/tasks", id],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${id}`);
      if (!res.ok) {
        throw new Error("Failed to fetch task");
      }
      return res.json();
    }
  });

  // Fetch all submissions for the task
  const { data: submissions, isLoading: submissionsLoading } = useQuery<(Submission & { submitterName: string | null })[]>({
    queryKey: ["/api/tasks", id, "submissions"],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${id}/submissions`);
      if (!res.ok) throw new Error("Failed to fetch submissions");
      return res.json();
    },
  });

  // Format and categorize the date
  const getDateInfo = () => {
    if (!task) return { formattedDate: "", status: "" };

    const today = startOfDay(new Date());
    const taskDate = startOfDay(parseISO(task.dueDate));

    const isFutureTask = isAfter(taskDate, today);
    const isPastTask = isBefore(taskDate, today);

    const formattedDate = format(taskDate, "MMMM d, yyyy");
    let status = "";

    if (isFutureTask) {
      status = "Upcoming";
    } else if (isPastTask) {
      status = "Past due";
    } else {
      status = "Due today";
    }

    return { formattedDate, status };
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/tasks/${id}/submit`, {
        answer,
      });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", id, "submissions"] });
      setFeedback({
        correct: data.verification.correct,
        explanation: data.verification.explanation,
        hint: data.verification.hint,
      });
      setAnswer("");
    },
  });

  if (taskLoading || submissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!task) {
    return <div>Task not found</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </div>
          <div className="text-sm text-muted-foreground">
            {user?.username} • {task.category}
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-8">
        <Card className="mb-8">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl mb-2">{task.title}</CardTitle>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {getDateInfo().status}: {getDateInfo().formattedDate}
                  </div>
                  <div className="flex items-center gap-1">
                    <Target className="h-4 w-4" />
                    {task.category}
                  </div>
                </div>
              </div>
              {task.completed && (
                <div className="px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-sm">
                  Completed
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Task Description
                </h3>
                <div className="pl-7">
                  <p className="text-muted-foreground whitespace-pre-wrap">{task.description}</p>
                </div>
              </div>
            </div>

            {!task.completed && (
              <div className="space-y-4 pt-4 border-t">
                <Textarea
                  placeholder="Enter your answer..."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  className="min-h-[200px]"
                />
                <Button
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending || !answer.trim()}
                  className="w-full"
                >
                  {submitMutation.isPending ? "Submitting..." : "Submit Answer"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              All Submissions ({submissions?.length || 0} total)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {submissions?.map((submission) => (
                <div
                  key={submission.id}
                  className={`p-4 rounded-lg border ${
                    submission.correct
                      ? "border-green-500/20 bg-green-500/5"
                      : "border-red-500/20 bg-red-500/5"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">
                      Submitted by: {submission.submitterName || "Unknown"}
                      {submission.userId === user?.id && " (You)"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(parseISO(submission.submittedAt), "MMM d, yyyy 'at' h:mm a")}
                    </div>
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{submission.answer}</div>
                  {submission.aiFeedback && (
                    <div className="mt-2 p-3 rounded bg-muted/50 text-sm">
                      <div className="font-medium mb-1">AI Feedback:</div>
                      <div className="text-muted-foreground">{submission.aiFeedback}</div>
                    </div>
                  )}
                </div>
              ))}
              {(!submissions || submissions.length === 0) && (
                <p className="text-muted-foreground text-sm">No submissions yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <AlertDialog open={feedback !== null} onOpenChange={() => setFeedback(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {feedback?.correct ? "Great thinking! 🎉" : "Keep going! 💡"}
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-4">
                <p>{feedback?.explanation}</p>
                {feedback?.hint && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium">Hint:</p>
                    <p className="text-sm text-muted-foreground">{feedback.hint}</p>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction>Continue</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}