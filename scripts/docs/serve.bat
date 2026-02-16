@echo off
set PORT=%1
if "%PORT%"=="" set PORT=4173
set HOST=%2
if "%HOST%"=="" set HOST=127.0.0.1

python -m http.server %PORT% --bind %HOST% --directory docs\site
