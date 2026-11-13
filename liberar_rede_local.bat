@echo off
title Liberando Node.js e Portas no Firewall do Windows
echo ==============================================================
echo   LIBERANDO ACESSO DE REDE LOCAL COMPLETO NO FIREWALL
echo ==============================================================
echo.
echo Liberando node.exe e portas 5173 / 5500...
netsh advfirewall firewall delete rule name="Treinador Node" >nul 2>&1
netsh advfirewall firewall delete rule name="Treinador Portas" >nul 2>&1

netsh advfirewall firewall add rule name="Treinador Node" dir=in action=allow program="C:\Program Files\nodejs\node.exe" enable=yes profile=any
netsh advfirewall firewall add rule name="Treinador Portas" dir=in action=allow protocol=TCP localport=5173,5500 enable=yes profile=any

echo.
echo [SUCESSO] Firewall configurado com sucesso!
echo.
pause
