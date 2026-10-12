@echo off
cd /d "%~dp0"
title Pokemon Arena V3
where node >nul 2>&1
if errorlevel 1 (
  echo Instale o Node.js 20 ou superior em https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules" (
  echo Instalando as dependencias...
  call npm install
  if errorlevel 1 (echo Falha ao instalar dependencias.& pause & exit /b 1)
)
echo Preparando a arena e os sprites...
echo Abra http://localhost:4321/ no navegador.
start "" "http://localhost:4321/"
call npm run dev
pause
