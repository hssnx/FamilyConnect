import { useQuery, useMutation } from "@tanstack/react-query";
import {
  User,
  Task,
  insertTaskSchema,
  insertUserSchema,
  insertTaskGenerationSchema,
} from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { Calendar, Target, Sparkles, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { z } from "zod";

const passwordResetSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

type PasswordResetForm = z.infer<typeof passwordResetSchema>;

interface InsertTaskGeneration {
  userId: number;
  days: number;
  numberOfSessions: number;
  problemsPerSession: number;
  goal: string;
}

export default function AdminPage() {
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const taskForm = useForm({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      userId: 0,
      title: "",
      description: "",
      category: "",
      dueDate: format(new Date(), "yyyy-MM-dd"),
    },
  });

  const userForm = useForm({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
      isAdmin: false,
    },
  });

  const passwordResetForm = useForm<PasswordResetForm>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: {
      newPassword: "",
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: Task) => {
      const res = await apiRequest("POST", "/api/tasks", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      taskForm.reset();
      toast({
        title: "Task created",
        description: "The task has been assigned successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create task",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/register", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      userForm.reset();
      toast({
        title: "User created",
        description: "The account has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      await apiRequest("DELETE", `/api/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Task deleted",
        description: "The task has been removed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete task",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const taskGenerationForm = useForm({
    resolver: zodResolver(insertTaskGenerationSchema),
    defaultValues: {
      userId: 0,
      days: 30,
      numberOfSessions: 3,
      problemsPerSession: 2,
      goal: "", // This will now serve as our detailed prompt field
    },
  });

  const [generatedTasks, setGeneratedTasks] = useState<{
    tasks: Array<{
      title: string;
      description: string;
      category: string;
      dayNumber: number;
    }>;
    generationId: number;
  } | null>(null);

  const generateTasksMutation = useMutation({
    mutationFn: async (data: InsertTaskGeneration) => {
      const res = await apiRequest("POST", "/api/tasks/generate", data);
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedTasks(data);
      toast({
        title: "Tasks Generated",
        description: "Review the generated tasks and approve them.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to generate tasks",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const approveTasksMutation = useMutation({
    mutationFn: async () => {
      if (generatedTasks) {
        const selectedUserId = taskGenerationForm.getValues("userId");
        const tasksWithUserId = generatedTasks.tasks.map((task) => ({
          ...task,
          userId: selectedUserId,
          goal: taskGenerationForm.getValues("goal"),
        }));

        const res = await apiRequest("POST", "/api/tasks/approve", {
          tasks: tasksWithUserId,
          generationId: generatedTasks.generationId,
        });
        return res.json();
      } else {
        throw new Error("No tasks to approve");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setGeneratedTasks(null);
      taskGenerationForm.reset();
      toast({
        title: "Tasks Approved",
        description: "The tasks have been assigned successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to approve tasks",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({
      userId,
      newPassword,
    }: {
      userId: number;
      newPassword: string;
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/users/${userId}/reset-password`,
        { newPassword },
      );
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Password reset",
        description: "The user's password has been updated successfully.",
      });
      passwordResetForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to reset password",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [enhancedTask, setEnhancedTask] = useState<{
    title: string;
    description: string;
    category: string;
  } | null>(null);

  const enhanceTaskMutation = useMutation({
    mutationFn: async (description: string) => {
      const res = await apiRequest("POST", "/api/tasks/enhance", { description });
      return res.json();
    },
    onSuccess: (data) => {
      setEnhancedTask(data);
      taskForm.setValue("title", data.title);
      taskForm.setValue("category", data.category);
      taskForm.setValue("description", data.description);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to enhance task",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (usersLoading || tasksLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  const getUsernameById = (userId: number) => {
    const foundUser = users?.find((u) => u.id === userId);
    return foundUser ? foundUser.username : "Unknown";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <Link href="/">
              <Button variant="outline">Back to Home</Button>
            </Link>
          </div>
          <div className="text-sm text-muted-foreground">
            Logged in as {user?.username} (Admin)
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="tasks">
          <TabsList className="w-full">
            <TabsTrigger value="tasks">Task Management</TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="generate">AI Task Generator</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Assign New Task
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...taskForm}>
                  <form
                    onSubmit={taskForm.handleSubmit((data) =>
                      createTaskMutation.mutate(data as Task),
                    )}
                    className="space-y-4"
                  >
                    <FormField
                      control={taskForm.control}
                      name="userId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assign To</FormLabel>
                          <FormControl>
                            <select
                              className="w-full rounded-md border border-input bg-background px-3 py-2"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value))
                              }
                            >
                              <option value="">Select family member</option>
                              {users?.map((user) => (
                                <option key={user.id} value={user.id}>
                                  {user.username}
                                </option>
                              ))}
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={taskForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Task Description</FormLabel>
                          <FormControl>
                            <div className="space-y-2">
                              <Textarea
                                {...field}
                                placeholder="Describe the task in detail"
                              />
                              {!enhancedTask && field.value && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="w-full"
                                  onClick={() => enhanceTaskMutation.mutate(field.value)}
                                  disabled={enhanceTaskMutation.isPending}
                                >
                                  {enhanceTaskMutation.isPending ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Enhancing...
                                    </>
                                  ) : (
                                    "Enhance with AI"
                                  )}
                                </Button>
                              )}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {enhancedTask && (
                      <>
                        <FormField
                          control={taskForm.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Generated Title</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={taskForm.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Suggested Category</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    <FormField
                      control={taskForm.control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Due Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={createTaskMutation.isPending}
                    >
                      {createTaskMutation.isPending
                        ? "Creating task..."
                        : "Create Task"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card className="mt-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Assigned Tasks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tasks?.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{task.title}</p>
                        <p className="text-sm text-muted-foreground">
                          Category: {task.category} • Assigned to:{" "}
                          {getUsernameById(task.userId)}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteTaskMutation.mutate(task.id)}
                        disabled={deleteTaskMutation.isPending}
                      >
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Create New User
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...userForm}>
                    <form
                      onSubmit={userForm.handleSubmit((data) =>
                        createUserMutation.mutate(data),
                      )}
                      className="space-y-4"
                    >
                      <FormField
                        control={userForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={userForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={userForm.control}
                        name="isAdmin"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-2">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={(e) =>
                                  field.onChange(e.target.checked)
                                }
                                className="h-4 w-4"
                              />
                            </FormControl>
                            <FormLabel className="!mt-0">Admin User</FormLabel>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={createUserMutation.isPending}
                      >
                        {createUserMutation.isPending
                          ? "Creating user..."
                          : "Create User"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Family Members
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {users?.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{user.username}</p>
                          <p className="text-sm text-muted-foreground">
                            {user.isAdmin
                              ? "Administrator"
                              : user.username === "visitor"
                                ? "Just Visiting the Site"
                                : "Family Member"}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-sm text-right">
                            <p>Points: {user.points}</p>
                            <p>Streak: {user.streak}</p>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                Reset Password
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Reset Password
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Enter a new password for {user.username}. This
                                  action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <Form {...passwordResetForm}>
                                <form
                                  onSubmit={passwordResetForm.handleSubmit(
                                    (data) => {
                                      resetPasswordMutation.mutate({
                                        userId: user.id,
                                        newPassword: data.newPassword,
                                      });
                                    },
                                  )}
                                  className="space-y-4"
                                >
                                  <FormField
                                    control={passwordResetForm.control}
                                    name="newPassword"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>New Password</FormLabel>
                                        <FormControl>
                                          <Input
                                            type="password"
                                            placeholder="Enter new password"
                                            {...field}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction type="submit">
                                      Reset Password
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </form>
                              </Form>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="generate" className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Generate Task Series
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...taskGenerationForm}>
                  <form
                    onSubmit={taskGenerationForm.handleSubmit((data) =>
                      generateTasksMutation.mutate(data),
                    )}
                    className="space-y-4"
                  >
                    <FormField
                      control={taskGenerationForm.control}
                      name="userId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assign To</FormLabel>
                          <FormControl>
                            <Select
                              value={field.value?.toString()}
                              onValueChange={(value) =>
                                field.onChange(parseInt(value))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select family member" />
                              </SelectTrigger>
                              <SelectContent>
                                {users?.map((user) => (
                                  <SelectItem
                                    key={user.id}
                                    value={user.id.toString()}
                                  >
                                    {user.username}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={taskGenerationForm.control}
                        name="numberOfSessions"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Number of Sessions (per month)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                max="3"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(Number(e.target.value))
                                }
                                value={field.value}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={taskGenerationForm.control}
                        name="problemsPerSession"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Problems Per Session</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                max="5"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(Number(e.target.value))
                                }
                                value={field.value}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={taskGenerationForm.control}
                      name="goal"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Detailed Prompt</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              className="min-h-[150px]"
                              placeholder="Specify the learning goals, difficulty level, and any other customization details. The tasks will be distributed across multiple sessions throughout the month. For example: 'Create a series of advanced mathematics problems focusing on algebra and calculus. Include word problems and theoretical concepts.'"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={generateTasksMutation.isPending}
                    >
                      {generateTasksMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating Tasks...
                        </>
                      ) : (
                        "Generate Tasks"
                      )}
                    </Button>
                  </form>
                </Form>

                {generatedTasks && (
                  <div className="mt-8 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Generated Tasks</h3>
                      <Button
                        onClick={() => approveTasksMutation.mutate()}
                        disabled={approveTasksMutation.isPending}
                      >
                        {approveTasksMutation.isPending
                          ? "Approving..."
                          : "Approve & Assign"}
                      </Button>
                    </div>
                    <div className="space-y-4">
                      {generatedTasks.tasks.map((task, index) => (
                        <Card key={index}>
                          <CardContent className="p-4">
                            <div className="space-y-2">
                              <h4 className="font-medium">{task.title}</h4>
                              <p className="text-sm text-muted-foreground">
                                {task.description}
                              </p>
                              <div className="text-sm text-muted-foreground">
                                Category: {task.category} • Due: Day{" "}
                                {task.dayNumber} • Assigned to:{" "}
                                {getUsernameById(
                                  taskGenerationForm.getValues("userId"),
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}