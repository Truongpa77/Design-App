@echo off
title Reset tai khoan Git ve Truongpa77
:: Thu tim Git qua lenh where
where git >nul 2>nul
if %errorlevel% eq 0 (
    set "GIT_CMD=git"
    goto git_found
)
if exist "C:\Program Files\Git\cmd\git.exe" (
    set "GIT_CMD=C:\Program Files\Git\cmd\git.exe"
    goto git_found
)
if exist "C:\Program Files\Git\bin\git.exe" (
    set "GIT_CMD=C:\Program Files\Git\bin\git.exe"
    goto git_found
)
if exist "%LocalAppData%\Programs\Git\cmd\git.exe" (
    set "GIT_CMD=%LocalAppData%\Programs\Git\cmd\git.exe"
    goto git_found
)
echo [LOI] Khong tim thay Git!
pause
exit /b

:git_found
:: 1. Cau hinh user local
"%GIT_CMD%" config --local user.name "Truongpa77"
"%GIT_CMD%" config --local user.email "pat300477@gmail.com"
echo [*] Da cau hinh Git Local User ve: Truongpa77 (pat300477@gmail.com)

:: 2. Xoa thong tin xac thuc cu khoi Git Credential Manager
echo url=https://github.com | "%GIT_CMD%" credential reject
echo [*] Da xoa thong tin dang nhap cu cua NinhQuangHuy18 khoi may tinh.

echo.
echo ==================================================
echo [THANH CONG] Thiet lap tai khoan Git moi hoan tat!
echo ==================================================
echo Lan toi khi ban day code (push_changes.bat), Windows se hien thi mot cua so dang nhap nho.
echo Ban chi can dang nhap tai khoan Github cua chinh ban (Truongpa77) la xong.
echo.
pause
