import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import OnboardingForm from "@/components/OnboardingForm";

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (profile) redirect("/");
  const { data: kingdoms } = await supabase.from("kingdoms").select("id,name,visibility").eq("visibility","open").order("name");

  return <main className="prod-shell prod-onboarding">
    <div className="prod-wordmark">GO<br/>PRIMAL</div>
    <p className="prod-kicker">PRODUCTION ALPHA 0.1</p>
    <h1>Create what your real life will build.</h1>
    <p className="prod-lead">One Gorilla. One Village. A persistent world.</p>
    <OnboardingForm kingdoms={kingdoms ?? []} />
  </main>;
}
