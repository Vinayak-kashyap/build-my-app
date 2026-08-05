import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Permanently removes the caller's account and all rows that cascade from auth.users. */
export async function deleteUserAccount(userId: string) {
  await supabaseAdmin.from("reports").delete().eq("user_id", userId);
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
  return { deleted: true } as const;
}
