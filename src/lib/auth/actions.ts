"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const isMockMode = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

export async function signIn(formData: { email: string; password: string }) {
  if (isMockMode) {
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.email,
    password: formData.password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOut() {
  if (isMockMode) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
