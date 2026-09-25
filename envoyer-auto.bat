@echo off
REM ============================================================================
REM  envoyer-auto.bat - Envoi automatique sur GitHub, sans aucune question
REM
REM  Double-clic : tout part sur GitHub. Aucune saisie, aucune confirmation.
REM  Le message de commit est genere seul : date, heure et fichiers touches.
REM
REM  A placer a la racine du projet, a cote des fichiers .html.
REM
REM  A SAVOIR : les messages generes automatiquement sont moins parlants
REM  qu'un texte ecrit. Si vous cherchez plus tard QUAND une modification
REM  precise a ete faite, utilisez plutot envoyer.bat, qui demande une
REM  description. Les deux scripts peuvent cohabiter.
REM ============================================================================

chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo   AC SAT CAMPAGNE - envoi automatique
echo   --------------------------------
echo.

git --version >nul 2>&1
if errorlevel 1 (
    echo   [ERREUR] Git n'est pas installe.
    timeout /t 6 >nul
    exit /b 1
)

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo   [ERREUR] Ce dossier n'est pas un depot Git : %CD%
    timeout /t 6 >nul
    exit /b 1
)

REM --- Rien a envoyer : on s'arrete la ---
for /f %%i in ('git status --porcelain 2^>nul ^| find /c /v ""') do set NB=%%i
if "!NB!"=="0" (
    echo   Rien a envoyer, tout est deja sur GitHub.
    timeout /t 4 >nul
    exit /b 0
)

echo   !NB! fichier^(s^) modifie^(s^)
echo.

REM --- Message automatique : date, heure et principaux fichiers ---
for /f "tokens=1-3 delims=/ " %%a in ("%date%") do set "JOUR=%%a/%%b/%%c"
for /f "tokens=1-2 delims=:" %%a in ("%time%") do set "HEURE=%%a:%%b"
set "HEURE=!HEURE: =!"

set "FICHIERS="
set /a COMPTE=0
for /f "tokens=2*" %%f in ('git status --porcelain') do (
    if !COMPTE! lss 3 (
        for %%n in (%%f) do set "NOM=%%~nxn"
        if "!FICHIERS!"=="" (set "FICHIERS=!NOM!") else (set "FICHIERS=!FICHIERS!, !NOM!")
        set /a COMPTE+=1
    )
)
if !NB! gtr 3 set "FICHIERS=!FICHIERS! et !NB! fichiers au total"

set "MSG=Mise a jour !JOUR! !HEURE! - !FICHIERS!"

REM --- Recuperer d'abord ce qui existe sur GitHub, sinon le push echoue ---
git pull --rebase --autostash >nul 2>&1

git add . >nul 2>&1
if errorlevel 1 goto :echec

git commit -m "!MSG!" >nul 2>&1
if errorlevel 1 goto :echec

git push >nul 2>&1
if errorlevel 1 goto :echec

echo   Envoye sur GitHub.
echo   !MSG!
echo.
timeout /t 4 >nul
exit /b 0

:echec
echo.
echo   ECHEC - rien n'a ete envoye.
echo   Relancez envoyer.bat pour voir le detail de l'erreur.
echo.
pause
exit /b 1
