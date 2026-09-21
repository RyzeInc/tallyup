# Repository owner rename: OpenAisleApp → RyzeInc

What I changed locally:

- Updated your local git `origin` remote to use the new owner `RyzeInc` (SSH):
  - `git remote set-url origin git@github.com:RyzeInc/tallyup.git`

What I checked for:

- Searched the repository for references to the old username (`OpenAisleApp`, `OpenAisle`, `openaisle`) — no matches found in tracked files.

Recommended next steps (manual checks you may want to run):

1. External services / integrations
   - Verify and update references in: Vercel/Netlify, CI providers, Docker Hub, package registries, webhooks, deployment scripts, and any other services that referenced the old organization.

2. GitHub settings
   - Check repository-level settings (webhooks, secrets, collaborators, actions permissions) for org-specific configs that may reference the old owner.

3. Documentation / badges
   - Search README, docs, badges, or other artifacts for owner-specific URLs and update them if found.

4. Package metadata (if applicable)
   - Add or update a `repository` field in `package.json` if you want explicit repository metadata (e.g., `"repository": { "type": "git", "url": "git@github.com:RyzeInc/tallyup.git" }`).

5. Update local clones
   - If others have local clones, ask them to run:
     - `git remote -v` to inspect remotes
     - `git remote set-url origin git@github.com:RyzeInc/tallyup.git` (or the HTTPS URL you prefer)

If you'd like, I can also:
- Search for more subtle references (e.g., badges, raw.githubusercontent.com links) and update them.
- Add the `repository` field to `package.json` and open a small commit.
- Scan `.github/workflows` and other CI config files for owner-specific steps (I already searched for `OpenAisleApp` and found nothing).

---

If you'd like me to push this documentation change, say "Push it" and I'll commit and push to `origin`.