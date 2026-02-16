# Project Guidelines

## Git Branching Workflow

All feature work MUST use a branch-based workflow. This overrides default superpowers skill behavior:

### Branch Creation (before any commits)

When the brainstorming skill produces a design doc, do NOT commit it to main. Instead:

1. Create a feature branch from main BEFORE committing anything:
   ```bash
   git checkout -b <feature-branch-name>
   ```
2. Commit the design doc to the feature branch
3. All subsequent work (plans, implementation) stays on this branch

The branch name should be descriptive of the feature (e.g., `add-rotation-controls`, `fix-camera-alignment`).

### Parallel Feature Work (worktrees)

When multiple features need to be developed simultaneously (e.g., two brainstorms running in parallel), use git worktrees to avoid branch conflicts. A single directory can only have one branch checked out at a time, so parallel work requires separate worktrees.

Instead of `git checkout -b`, create a worktree:

```bash
git worktree add ../<repo>-<feature-name> -b <feature-branch-name>
```

For example, from `/Users/francis/src/chaos-merkaba-viz`:
```bash
git worktree add ../chaos-merkaba-viz-rotation-controls -b add-rotation-controls
```

Then do all work (design doc, plan, implementation) inside that worktree directory. When merging back, return to the main worktree:

```bash
cd /Users/francis/src/chaos-merkaba-viz
git merge --no-ff <feature-branch> -m "<conceptual description>"
git branch -d <feature-branch>
git worktree remove ../<repo>-<feature-name>
```

Use the `superpowers:using-git-worktrees` skill to handle worktree creation with safety checks.

### Commits During Work

Commit iteratively to the feature branch as work proceeds. This is the expected behavior — frequent, small commits on the branch are good.

### Merging to Main (no fast-forward)

When using the finishing-a-development-branch skill and choosing to merge locally, ALWAYS use `--no-ff`:

```bash
git checkout main
git pull
git merge --no-ff <feature-branch> -m "<conceptual description of the feature>"
git branch -d <feature-branch>
```

This ensures:
- A single merge commit on main with the high-level description
- The branch history (individual commits) is preserved and visible
- `git log --first-parent main` shows a clean feature-by-feature history
