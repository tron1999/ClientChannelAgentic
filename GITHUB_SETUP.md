# GitHub Setup Guide for Cursor

## Step 1: Install Git (if not already installed)

1. Download Git for Windows from: https://git-scm.com/download/win
2. Run the installer with default settings
3. **Important**: During installation, make sure to select "Git from the command line and also from 3rd-party software"
4. Restart Cursor after installation

## Step 2: Configure Git (if not already configured)

Open a terminal in Cursor and run:

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

## Step 3: Set up GitHub Authentication in Cursor

### Option A: Using Cursor's Built-in GitHub Integration

1. In Cursor, click on the **Source Control** icon in the left sidebar (or press `Ctrl+Shift+G`)
2. Click on the **...** menu at the top of the Source Control panel
3. Select **"Clone Repository"** or **"Initialize Repository"**
4. If prompted, sign in to GitHub through Cursor's authentication flow

### Option B: Using GitHub Personal Access Token

1. Go to GitHub.com → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate a new token with `repo` scope
3. In Cursor, when prompted for credentials, use your GitHub username and the token as password

## Step 4: Initialize Repository and Commit Changes

After Git is installed and configured, run these commands in Cursor's terminal:

```bash
# Initialize git repository (if not already initialized)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Add comprehensive service execution logging system

- Added structured logging utility with service, action, and level tracking
- Implemented logging for all API endpoints (messages, webhook, config, ping)
- Added logging to all DMS callback handlers
- Created service logs API endpoints (GET /api/logs, DELETE /api/logs)
- Added UI panel for real-time service execution log viewing
- Implemented log filtering by service type and level
- Added auto-refresh and clear logs functionality"

# Add GitHub remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/client-channel-api-playground.git

# Push to GitHub
git push -u origin main
```

## Step 5: Create Repository on GitHub (if it doesn't exist)

1. Go to https://github.com/new
2. Repository name: `client-channel-api-playground`
3. Choose Public or Private
4. **DO NOT** initialize with README, .gitignore, or license (since we already have files)
5. Click "Create repository"

## Troubleshooting

### Git command not found
- Make sure Git is installed and added to PATH
- Restart Cursor after installing Git
- Try running `git --version` in Cursor's terminal to verify

### Authentication issues
- Use Personal Access Token instead of password
- Make sure token has `repo` scope
- Check GitHub account settings for token permissions

### Push rejected
- If repository already exists on GitHub, you may need to pull first:
  ```bash
  git pull origin main --allow-unrelated-histories
  git push -u origin main
  ```

