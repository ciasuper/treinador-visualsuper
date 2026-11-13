@echo off
title Super Treinador SDR - Visual Super (Com Link para Celular)
cd /d "%~dp0"
echo ==============================================================
echo    INICIANDO SUPER TREINADOR SDR - VISUAL SUPER
echo ==============================================================
echo.
echo 1. Abrindo no computador: http://localhost:5173
start "" "http://localhost:5173"
echo.
echo 2. Iniciando servidor e gerando link para o Celular...
start /b node ./node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5173
timeout /t 2 /nobreak >nul
echo.
echo ==============================================================
echo    SEU LINK PARA CELULAR / REDE EXTERNA:
echo ==============================================================
node ./node_modules/localtunnel/bin/lt.js --port 5173
pause

