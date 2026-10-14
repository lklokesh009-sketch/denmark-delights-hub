import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Owner assigns a registered user (by email) as manager of a branch.
export const assignBranchManager = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; branch: number }) => {
    if (![1, 2, 3].includes(input.branch)) throw new Error("Invalid branch");
    return { email: String(input.email).trim().toLowerCase(), branch: input.branch };
  })
  .handler(async ({ data, context }) => {
    const { data: isOwner } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "owner",
    });
    if (!isOwner) throw new Error("Only the owner can assign branch managers");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let found: { id: string } | undefined;
    for (let page = 1; page <= 10 && !found; page++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      found = list.users.find((u) => u.email?.toLowerCase() === data.email);
      if (list.users.length < 200) break;
    }
    if (!found) throw new Error("No account with that email. Ask them to sign up on the Owner page first.");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: found.id, role: "branch_manager", branch: data.branch });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });
