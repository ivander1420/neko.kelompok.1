@echo off
chcp 65001 >nul
title NEKO Server
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto NODE_MISSING
echo.
echo  NEKO - Belajar TJKT Sambil Bermain
echo  Server lokal berjalan di http://localhost:3000
echo  Biarkan jendela ini tetap terbuka selama dipakai.
echo  Tekan Ctrl+C untuk menghentikan server.
echo.
echo  Kelas Langsung, chat, dan akun lintas perangkat:
echo  buka alamat jaringan yang tampil di bawah dari HP atau laptop teman
echo  (semua perangkat harus memakai WiFi yang sama).
echo.
start "" /min cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000/"
node server\server.js
echo.
echo  Server berhenti.
pause
exit /b 0

:NODE_MISSING
echo  [NEKO] Node.js tidak ditemukan di komputer ini.
echo  Unduh dari https://nodejs.org lalu jalankan Mulai-NEKO.bat lagi.
pause
