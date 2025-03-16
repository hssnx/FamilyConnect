import { User } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { Trophy, Medal, Flame } from "lucide-react";

interface LeaderboardProps {
  users: User[];
}

export default function Leaderboard({ users }: LeaderboardProps) {
  const getPositionIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 1:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 2:
        return <Medal className="h-5 w-5 text-amber-700" />;
      default:
        return <div className="w-5 h-5 flex items-center justify-center font-medium">{index + 1}</div>;
    }
  };

  // Filter out visitors and sort by points
  const sortedUsers = users
    .filter(user => user.username !== "visitor" && !user.isAdmin)
    .sort((a, b) => b.points - a.points || b.streak - a.streak);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          {sortedUsers.map((user, index) => (
            <div
              key={user.id}
              className="flex items-center gap-4 p-3 rounded-lg bg-accent/5"
            >
              <div className="flex items-center justify-center w-8">
                {getPositionIcon(index)}
              </div>
              <div className="flex-1">
                <p className="font-medium">
                  <Link href={`/profile/${user.id}`} className="text-primary hover:underline">
                    {user.username}
                  </Link>
                </p>
                <p className="text-sm text-muted-foreground">
                  Family Member
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{user.points} pts</p>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Flame className="h-4 w-4 text-orange-500" />
                  <span>{user.streak} days</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}