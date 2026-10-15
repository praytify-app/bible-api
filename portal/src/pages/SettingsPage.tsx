import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppWindow, Gauge, ShieldCheck, UserRound } from "lucide-react";
import { Alert, Button, Card, CardHeader, PageHeader, SkeletonText } from "@/components/ds";
import { SectionNav, type SectionLink } from "@/features/docs/SectionNav";
import { AccountSummary } from "@/features/settings/AccountSummary";
import { DataRights } from "@/features/settings/DataRights";
import { PlanSummary } from "@/features/settings/PlanSummary";
import { ProfileForm } from "@/features/settings/ProfileForm";
import { profile } from "@/lib/api";

const sections = [
  { id: "profile", title: "App profile", description: "What you are building", icon: <AppWindow /> },
  { id: "plan", title: "Plan", description: "Tier and rate limits", icon: <Gauge /> },
  { id: "account", title: "Account", description: "Name, email, sign out", icon: <UserRound /> },
  { id: "your-data", title: "Your data", description: "Download or delete", icon: <ShieldCheck /> },
] satisfies SectionLink[];

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <Card as="section" id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      <CardHeader title={<span id={`${id}-title`}>{title}</span>} description={description} />
      {children}
    </Card>
  );
}

export function SettingsPage() {
  const stored = useQuery({ queryKey: ["profile"], queryFn: profile.get });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Settings" description="Your app profile, your plan, and your account." />

      <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <SectionNav label="Settings sections" sections={sections} />

        <div className="flex min-w-0 flex-col gap-6">
          <Section id="profile" title="App profile" description="Tell us what you are building with the API.">
            {stored.isError ? (
              // No form over a failed load: saving it would blank the stored profile (AUDIT finding 2).
              <Alert
                tone="danger"
                title="Your profile could not be loaded."
                action={
                  <Button variant="secondary" size="sm" loading={stored.isFetching} onClick={() => stored.refetch()}>
                    Try again
                  </Button>
                }
              >
                The form stays hidden until it loads, so nothing you have saved can be overwritten.
              </Alert>
            ) : stored.isPending ? (
              <div aria-busy className="flex flex-col gap-3">
                <SkeletonText lines={5} />
                <p className="sr-only">Loading your profile</p>
              </div>
            ) : (
              <ProfileForm profile={stored.data} />
            )}
          </Section>

          <Section id="plan" title="Plan" description="Your tier and the limits that come with it.">
            <PlanSummary />
          </Section>

          <Section id="account" title="Account" description="The account you signed in with.">
            <AccountSummary />
          </Section>

          <Section id="your-data" title="Your data" description="A copy of everything we hold, or deletion.">
            <DataRights />
          </Section>
        </div>
      </div>
    </div>
  );
}
