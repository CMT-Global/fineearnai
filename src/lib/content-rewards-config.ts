import { supabase } from "@/integrations/supabase/client";

export interface ContentRewardsConfig {
  enabled: boolean;
  landing_page: {
    title: string;
    description: string;
    hero_text: string;
    cta_text: string;
  };
  wizard_steps?: {
    step1_welcome: { title: string; description: string };
    step2_what_to_post: { title: string; examples: string[] };
    step3_how_earnings_work: { title: string; description: string };
    step4_goal_setting: { title: string; message: string };
    step5_get_link: { title: string; description: string };
    step6_posting_checklist: { title: string; dos: string[]; donts: string[]; compliant_language: string };
    step7_finish: { title: string; message: string };
  };
  share_captions: {
    tiktok: string;
    youtube: string;
    instagram: string;
    whatsapp: string;
    telegram: string;
    facebook: string;
    twitter: string;
  };
  media_kit: { assets: string[] };
  goal_messaging: string;
  disclaimer: string;
}

const DEFAULT_CONFIG: ContentRewardsConfig = {
  enabled: false,
  landing_page: {
    title: "Get Paid to Post About ProfitChips",
    description: "Create tutorials, share your link, and earn commissions when your referrals upgrade their subscription.",
    hero_text: "Turn your content into earnings",
    cta_text: "Apply & Start Posting",
  },
  wizard_steps: undefined,
  share_captions: {
    tiktok: "Check out ProfitChips! Earn money by training AI. Use my link: {link}",
    youtube: "Learn how to earn online doing AI tasks with ProfitChips. Sign up using my referral link: {link}",
    instagram: "Discover ProfitChips - earn by training AI! Use my link: {link}",
    whatsapp: "Hey! Check out ProfitChips - you can earn money by training AI. Sign up here: {link}",
    telegram: "Join ProfitChips and start earning! Use my link: {link}",
    facebook: "Learn about ProfitChips - a platform where you earn by training AI. Sign up: {link}",
    twitter: "Earn money training AI with ProfitChips! Sign up using my link: {link}",
  },
  media_kit: { assets: [] },
  goal_messaging: "Many creators set a goal of $250/week (~$1,000/month) depending on performance and referrals.",
  disclaimer: "Earnings vary based on referrals, upgrades, and plan settings. No guaranteed earnings.",
};

export async function fetchContentRewardsConfig(): Promise<ContentRewardsConfig> {
  const { data, error } = await supabase
    .from("platform_config")
    .select("value")
    .eq("key", "content_rewards_config")
    .maybeSingle();
  if (error) throw error;
  const raw = data?.value as Partial<ContentRewardsConfig> | null;
  return { ...DEFAULT_CONFIG, ...raw } as ContentRewardsConfig;
}

export const CONTENT_REWARDS_QUERY_KEY = ["content-rewards-config-public"];
