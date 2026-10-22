@echo off
REM ---------------------------------------------------------------
REM  SpeekBetter local server
REM  The word-by-word pronunciation compare needs to read the demo
REM  audio files. Browsers block that on file:// URLs, so run this
REM  script and open the printed http:// address instead.
REM
REM  The port is picked automatically: 8000 is often held by the
REM  C-Lodop print service on this machine. Node finds a free port
REM  and opens the browser by itself; the Python fallback probes one.
REM ---------------------------------------------------------------
setlocal
cd /d "%~dp0"

echo.
echo   SpeekBetter - starting local server
echo   ------------------------------------------------
echo   The address will be printed below and opened in your browser.
echo   (The pronunciation compare feature needs this address;
echo    opening index.html directly falls back to self-scoring.)
echo   Press Ctrl+C to stop.
echo.

REM ---- Node first: it finds a free port and opens the browser ------
where node >nul 2>nul
if %errorlevel%==0 (
  node server.mjs 8730
  goto :done
)

REM ---- Python fallback: probe a free port and open the browser -----
REM  NOTE: Python's http.server does not answer HTTP Range requests,
REM  so the demo audio cannot be positioned (duration shows as unknown)
REM  on this path. The Node server above does support Range.
set "PORT=8730"
for /f "usebackq delims=" %%p in (`powershell -NoProfile -Command "$p=8730; while(Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue){$p++}; $p"`) do set "PORT=%%p"

where python >nul 2>nul
if %errorlevel%==0 (
  start "" "http://127.0.0.1:%PORT%"
  python -m http.server %PORT% --bind 127.0.0.1
  goto :done
)

where py >nul 2>nul
if %errorlevel%==0 (
  start "" "http://127.0.0.1:%PORT%"
  py -3 -m http.server %PORT% --bind 127.0.0.1
  goto :done
)

echo   No node / python / py found. Please install Node.js or
echo   Python 3, then run this script again.
pause

:done
endlocal
