import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export function MessagesSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div>
            {Array.from({ length: 2 }).map((_, groupIndex) => (
              <div key={groupIndex}>
                <div className="px-4 py-1.5 border-b border-border/80 bg-muted/40">
                  <Skeleton className="h-3 w-24" />
                </div>
                <ul className="divide-y divide-border">
                  {Array.from({ length: 3 }).map((_, itemIndex) => (
                    <li
                      key={`${groupIndex}-${itemIndex}`}
                      className="flex items-start gap-3 px-4 py-3"
                    >
                      <Skeleton className="h-7 w-7 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-44" />
                        <Skeleton className="h-3 w-28" />
                        <Skeleton className="h-3 w-60" />
                      </div>
                      <Skeleton className="h-3 w-10" />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
