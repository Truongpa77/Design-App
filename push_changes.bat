@echo off
title Day code sua loi database len Github
:: Thu tim Git qua lenh where
where git >nul 2>nul
if %errorlevel% EQU 0 (
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
echo [*] Dang luu va day cac thay doi len Github...
"%GIT_CMD%" add .
"%GIT_CMD%" commit -m "Sua loi ket noi database va tu dong khoi tao schema"
"%GIT_CMD%" push origin main
if %errorlevel% EQU 0 (
    echo [THANH CONG] Da day code sua loi len Github! Vui long doi 1-2 phut de Vercel cap nhat tu dong.
) else (
    echo [LOI] Khong the push len Github.
)
pause
