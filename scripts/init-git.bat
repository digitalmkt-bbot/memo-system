@echo off
REM Run on Windows to create the repo and push to GitHub.
REM Usage: scripts\init-git.bat https://github.com/<you>/memo-system.git
cd /d "%~dp0.."
git init
git add .
git commit -m "MEMO Management System"
git branch -M main
if not "%~1"=="" (
  git remote add origin %1
  git push -u origin main
  echo Pushed to %1
) else (
  echo Repo ready. Add a remote and push:
  echo   git remote add origin https://github.com/^<you^>/memo-system.git
  echo   git push -u origin main
)
