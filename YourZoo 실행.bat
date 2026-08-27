@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title YourZoo

echo.
echo   ==========================================
echo     Y O U R   Z O O
echo   ==========================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo   [!] Node.js 가 필요합니다.
  echo       https://nodejs.org 에서 설치한 뒤 다시 실행하세요.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo   처음 실행이라 준비물을 내려받습니다. 몇 분 걸립니다...
  echo.
  call npm install
  if errorlevel 1 goto fail
  echo.
)

echo   빌드 중입니다...
call npm run build
if errorlevel 1 goto fail

echo.
echo   ==========================================
echo    접속 주소
echo   ------------------------------------------
echo     이 PC          http://localhost:29876
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  for /f "tokens=*" %%b in ("%%a") do echo     같은 와이파이   http://%%b:29876
)
echo   ==========================================
echo.
echo   * 처음 실행하면 Windows 방화벽 창이 뜹니다.
echo     [개인 네트워크] 를 체크하고 허용해야 다른 기기에서 접속됩니다.
echo.
echo   이 창을 닫으면 서버가 꺼집니다.
echo.

call npm run preview
goto end

:fail
echo.
echo   [!] 실패했습니다. 위 메시지를 확인하세요.
echo.
pause

:end
