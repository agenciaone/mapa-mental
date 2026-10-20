@echo off
rem Inicia o servidor local do Mapas Mentais e abre o navegador.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor.ps1" -Port 8080
