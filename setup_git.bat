@echo off
title Cau hinh Git tu dong - Antigravity AI

:: Thu tim Git qua lenh where
where git >nul 2>nul
if %errorlevel% eq 0 (
    set "GIT_CMD=git"
    goto git_found
)

:: Neu khong tim thay, thu tim o cac duong dan mac dinh cua Windows
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

:: Neu van khong tim thay
echo [LOI] Khong tim thay Git tren may tinh cua ban!
echo Vui loi kiem tra lai xem ban da cai dat Git thanh cong chua.
echo Neu da cai dat, ban hay thu khoi dong lai may tinh de Windows cap nhat duong dan.
pause
exit /b

:git_found
echo ==================================================
echo   CHUONG TRINH TU DONG KHOI TAO VA DAY CODE LEN GITHUB
echo ==================================================
echo.
echo [*] Da tim thay Git tai: %GIT_CMD%
echo.

:: Khoi tao git
echo [*] Dang khoi tao Git trong thu muc du an...
if not exist .git (
    "%GIT_CMD%" init
) else (
    echo [!] Thu muc da duoc khoi tao Git tu truoc.
)
echo.

:: Cau hinh thong tin nguoi dung
echo [*] Cau hinh thong tin tai khoan Github:
set /p github_user="Nhap ten hien thi Github cua ban (vi du: Nguyen Van A):Truongpa77"
set /p github_email="Nhap email Github cua ban:pat300477@gmail.com"
"%GIT_CMD%" config user.name "%github_user%"
"%GIT_CMD%" config user.email "%github_email%"
echo.

:: Add va Commit
echo [*] Dang chuan bi cac file de day len (git add)...
"%GIT_CMD%" add .
echo [*] Dang tao ban commit dau tien...
"%GIT_CMD%" commit -m "Khoi tao du an tu dong bang script"
"%GIT_CMD%" branch -M main
echo.

:: Dat link Repo tu dong
set "repo_url=https://github.com/Truongpa77/Design-App.git"
echo [*] Link Repository tu dong: %repo_url%

:: Xoa remote cu neu co va them remote moi
"%GIT_CMD%" remote remove origin >nul 2>nul
"%GIT_CMD%" remote add origin %repo_url%

echo.
echo [*] Dang tien hanh day code len Github...
echo (Luu y: Mot cua so dang nhap Github nho co the hien len, vui long dang nhap de xac thuc).
echo.
"%GIT_CMD%" push -u origin main

if %errorlevel% eq 0 (
    echo.
    echo ==================================================
    echo [THANH CONG] Da day ma nguon len Github thanh cong!
    echo ==================================================
) else (
    echo.
    echo [THAT BAI] Co loi xay ra trong qua trinh day code len Github.
)
echo.
pause
