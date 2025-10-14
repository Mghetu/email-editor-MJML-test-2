# Committing your changes

Follow these steps to record your work in Git:

1. Review your pending edits:
   ```bash
   git status
   ```
2. Stage the files you want to include in the commit:
   ```bash
   git add <file1> <file2>
   # or stage everything:
   git add .
   ```
3. Double-check what will be committed:
   ```bash
   git status
   git diff --staged
   ```
4. Create the commit with a concise, descriptive message:
   ```bash
   git commit -m "Describe the changes"
   ```
5. Push the commit to the remote branch (if needed):
   ```bash
   git push
   ```
