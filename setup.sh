#!/bin/bash
set -e
cd "$HOME/Documents/git-projects/Library system"
git fetch origin main
git reset --hard origin/main
echo "Git cloned successfully"
