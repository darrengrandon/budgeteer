# Putting Budgeteer online with GitHub Pages

Budgeteer is plain files, so GitHub Pages can host it for free. If you name the repository
`budgeteer`, the address will be:

    https://<your-github-name>.github.io/budgeteer/

Everything in the repository becomes public: the code, docs and tests. No personal data is in
it. Each person's money info stays on their own phone and is never uploaded.

## Before you start

1. You need a GitHub account.
2. GitHub Pages will publish `master`. The changes that make the app work from
   `/budgeteer/` are on the `hosting` branch, so merge it into `master` first:

       git switch master
       git merge hosting
       ./check.sh

   `./check.sh` must end with `check passed`. (The `lazy-v3` work is not in `master` yet
   either. Merge it the same way when you're happy with it.)

## 1. Create an empty public repository

1. On github.com, click **+** (top right), then **New repository**.
2. Repository name: `budgeteer`.
3. Choose **Public**.
4. Leave "Add a README", ".gitignore" and "license" off, so the repository starts empty.
5. Click **Create repository**.

## 2. Add the remote and push master

In the project folder:

    git remote add origin https://github.com/<your-github-name>/budgeteer.git
    git push -u origin master

If GitHub asks you to sign in, follow its prompt. Over HTTPS the password is a personal access
token, not your GitHub password.

## 3. Turn on GitHub Pages

1. In the repository on github.com, open **Settings**, then **Pages** (in the left column).
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Set **Branch** to **master** and the folder to **/ (root)**. Click **Save**.
4. Wait a minute or two, then reload the page. It shows "Your site is live at
   `https://<your-github-name>.github.io/budgeteer/`".

The `.nojekyll` file in the project tells GitHub Pages to serve the files as they are.

## 4. Open it and add it to the Home Screen

Open the address once while online. After that it also works offline.

**iPhone (Safari):**
1. Open the address in Safari.
2. Tap the **Share** button (the square with an arrow).
3. Tap **Add to Home Screen**, then **Add**.
4. From now on, open Budgeteer from its icon. It opens like an app, and Safari won't clear its
   info after a week without a visit.

**Android (Chrome):**
1. Open the address in Chrome.
2. Tap the **⋮** menu.
3. Tap **Add to Home screen** or **Install app**, then confirm.

## How to update it

1. Make the change on a branch and run `./check.sh` (it must pass).
2. Merge the branch into `master`, then publish:

       git switch master
       git merge <branch>
       git push

3. GitHub Pages republishes in a minute or two. The **Actions** tab shows the
   "pages build and deployment" run. When it's green, the new version is live.
4. On a phone, open Budgeteer while online. It always fetches the newest files first, so the
   update arrives on its own. If a phone still shows the old version, close Budgeteer
   completely and open it again.

Nobody loses their info in an update. It is stored on each phone, not in the repository.

## Good to know

- **One address, several sites.** All project sites of one GitHub account share
  `<your-github-name>.github.io`. Budgeteer names its offline copy after its own folder, and it
  never deletes another site's files. Two copies of Budgeteer under the same account (say
  `/budgeteer/` and `/budgeteer-test/`) would share one set of saved info, so use a separate
  account or browser for testing.
- **Renaming the repository** changes the address. People then need to add the new address to
  their Home Screen again. Their saved info stays, because the account's address is the same.
- **Never push secrets.** There are none in the project now. `.gitignore` keeps packages,
  browser caches, test output and the overnight review out of the repository.
