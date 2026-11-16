@echo off
rem Double-click (or put a shortcut in shell:startup) to run the dashboard server.
cd /d "%~dp0"
node src\server.js
