import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { useState } from "react";

export function HowTaskCommissionsWork() {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <Card className="overflow-hidden border-muted bg-muted/30">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between gap-2 px-4 py-4 sm:px-6 sm:py-5 h-auto rounded-none hover:bg-muted/50 hover:text-foreground text-foreground text-left"
            aria-expanded={open}
          >
            <span className="flex items-center gap-2 font-semibold text-base sm:text-lg text-foreground">
              <HelpCircle className="h-5 w-5 shrink-0 text-primary" />
              How Task Commissions Work?
            </span>
            <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
              {open ? "View Less" : "View More"}
              {open ? (
                <ChevronUp className="h-4 w-4 shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0" />
              )}
            </span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6 sm:pt-0 border-t border-border/50">
            <div className="pt-4 space-y-4 text-sm sm:text-base leading-relaxed text-muted-foreground w-full">
              <p>
                Build a team and earn extra commissions from the work your team
                members complete.
              </p>
              <p>
                When you invite friends to ProfitChips, you earn task
                commissions whenever the people you invited to the platform
                complete tasks.
              </p>
              <p>
                When someone joins our platform using your link, upgrades their
                account and completes tasks, you start earning task commissions
                that are automatically added to your Earnings Wallet for every
                task they complete. These can easily exceed $500 weekly in task
                commissions depending on the size of your team.
              </p>

              <p className="font-medium text-foreground pt-1">
                What you need to know:
              </p>
              <ul className="space-y-2 list-disc pl-5 marker:text-primary">
                <li>
                  <strong className="text-foreground">
                    Task Commissions Are Locked On Free Account:
                  </strong>{" "}
                  Task commissions are only available if the person doing the
                  task and the person receiving the task commission have
                  upgraded their accounts. Free accounts do not earn you task
                  commissions due to self-referral fraud and other security
                  policies.
                </li>
                <li>
                  <strong className="text-foreground">
                    Commission is paid per task:
                  </strong>{" "}
                  Each time your team member completes a task, you earn up to
                  10% of the amount they earn per task.
                </li>
                <li>
                  <strong className="text-foreground">
                    Unlimited task commissions:
                  </strong>{" "}
                  There is no limit on how much you can earn from your team — the
                  more active they are on the platform, the more you earn.
                </li>
                <li>
                  <strong className="text-foreground">
                    Your team member is not charged:
                  </strong>{" "}
                  Your commission is extra and does not reduce what your team
                  member earns per task. They still receive their full task
                  reward.
                </li>
              </ul>

              <div className="bg-card border rounded-lg p-4 sm:p-5 space-y-3">
                <p className="font-semibold text-foreground">Real Example</p>
                <p>Here&apos;s what task commissions look like:</p>
                <ul className="space-y-1 list-none pl-0">
                  <li>• If your team member earns $0.40 per task</li>
                  <li>• And they complete 50 tasks per day</li>
                  <li>• They earn $20.00 per day</li>
                </ul>
                <p>
                  Hence with a task commission of 10%, you earn $2 per day from
                  that team member, which amounts to $14 per week from 1 team
                  member. So if you have 20 team members, that amounts to $280
                  weekly in task commissions.
                </p>
              </div>

              <div className="pt-2 space-y-2">
                <p className="font-semibold text-foreground">
                  How Task Commissions work
                </p>
                <ol className="space-y-2 list-decimal pl-5 marker:font-medium marker:text-primary">
                  <li>You share your team invite link.</li>
                  <li>
                    When someone joins using your link, they become part of your
                    team.
                  </li>
                  <li>
                    If you have already upgraded your account, you earn a
                    percentage of what they earn per task.
                  </li>
                  <li>
                    This commission is paid by ProfitChips — it is NOT deducted
                    from your team member&apos;s earnings.
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
