import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Loader2, User2, Star, Flame, ThumbsUp, ThumbsDown } from "lucide-react";

export default function MembersPage() {
  const { user } = useAuth();

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Use the new endpoint for each user's interaction counts
  const getInteractionCounts = async (userId: number) => {
    const res = await fetch(`/api/users/${userId}/interaction-counts`);
    if (!res.ok) throw new Error('Failed to fetch interaction counts');
    return res.json();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Family Members</h1>
            <Link href="/">
              <Button variant="outline">Back to Home</Button>
            </Link>
          </div>
          <div className="text-sm text-muted-foreground">
            Logged in as {user?.username}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users?.map((member) => {
            // Use React Query for interaction counts
            const { data: interactionCounts = { likes: 0, dislikes: 0 }, isLoading: countsLoading } = useQuery({
              queryKey: ['/api/users', member.id, 'interaction-counts'],
              queryFn: () => getInteractionCounts(member.id),
              enabled: !!member.id,
            });

            return (
              <Link key={member.id} href={`/profile/${member.id}`}>
                <Card className="hover:bg-accent/5 transition-colors cursor-pointer">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User2 className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h2 className="font-semibold text-lg">{member.username}</h2>
                        <p className="text-sm text-muted-foreground">
                          {member.username === "visitor" 
                            ? "Just Visiting the Site"
                            : member.isAdmin 
                              ? "Administrator" 
                              : "Family Member"}
                        </p>
                        <div className="grid grid-cols-2 gap-4 mt-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-sm">
                              <Star className="h-4 w-4 text-yellow-500" />
                              <span>{member.points} points</span>
                            </div>
                            <div className="flex items-center gap-1 text-sm">
                              <Flame className="h-4 w-4 text-orange-500" />
                              <span>{member.streak} streak</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-sm">
                              <ThumbsUp className="h-4 w-4 text-green-500" />
                              <span>{interactionCounts.likes} likes</span>
                            </div>
                            <div className="flex items-center gap-1 text-sm">
                              <ThumbsDown className="h-4 w-4 text-red-500" />
                              <span>{interactionCounts.dislikes} dislikes</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}