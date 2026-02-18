import { useInviteOnlyConfig } from "@/hooks/useInviteOnlyConfig";

export default function LandingInviteOnlyBanner() {
  const { config, isInviteOnly } = useInviteOnlyConfig();
  if (!isInviteOnly) return null;
  const title = config.landing_banner_title?.trim() || "We are now invite-only";
  const description = config.landing_banner_description?.trim() || "Request an invite to get started.";
  return (
    <section className="pt-20 relative z-10">
      <div className="bg-primary/10 border-b border-primary/20 py-3 px-4">
        <div className="container-custom">
          <p className="text-center text-sm text-foreground">
            <span className="font-semibold">{title}</span>
            {" — "}
            <span className="text-muted-foreground">{description}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
