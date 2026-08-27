@echo off
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
  goto done
)

REM 이미 켜져 있는 서버가 있으면 포트를 못 잡고 그대로 끝나 버린다.
REM 조용히 죽는 대신 먼저 물어본다.
netstat -ano | findstr ":29876 " | findstr LISTENING >nul 2>nul
if not errorlevel 1 (
  echo   [!] 포트 29876 을 이미 쓰고 있습니다.
  echo       먼저 열어 둔 YourZoo 창이 있는지 확인하세요.
  echo.
  choice /c YN /n /m "   기존 서버를 끄고 계속할까요? [Y/N] "
  if errorlevel 2 goto done
  echo.
  echo   기존 서버를 종료합니다...
  taskkill /F /IM node.exe >nul 2>nul
  ping -n 3 127.0.0.1 >nul
)

if not exist node_modules (
  echo   처음 실행이라 준비물을 내려받습니다. 몇 분 걸립니다...
  echo.
  call npm install
  if errorlevel 1 goto done
  echo.
)

echo   빌드 중입니다...
call npm run build
if errorlevel 1 (
  echo.
  echo   [!] 빌드에 실패했습니다. 위 메시지를 확인하세요.
  goto done
)

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

echo.
echo   서버가 종료되었습니다.

:done
echo.
pause
