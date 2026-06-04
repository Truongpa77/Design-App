@echo off
echo [*] Dang kiem tra loi Git...
git push origin main > git_error.txt 2>&1
echo [XONG] Da kiem tra xong. Bạn có the tat cua so nay.
