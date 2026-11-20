@echo off
rem Fetch the bank rates and publish the site once (double-click to run by hand).
cd /d "%~dp0"
node --env-file=.env publish.mjs
pause
