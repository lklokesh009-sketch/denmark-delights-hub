<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project rules

- Permissions live in `public.user_roles` (owner / branch_manager with branch); RLS uses `has_role` and `can_manage_branch` — never trust client checks.
- First signed-up user becomes owner via DB trigger; owner grants branch access through a server function using the admin client.
- Customers order anonymously (insert-only on `orders`); bank details are owner-only by RLS and never queried on public pages.
- Staff notifications use Realtime on `orders`, filtered per branch.
