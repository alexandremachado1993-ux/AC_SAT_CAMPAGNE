@echo off
REM ============================================================================
REM  envoyer.bat - Envoie les modifications sur GitHub en un double-clic
REM
REM  Remplace la suite : git status / git add . / git commit / git push
REM
REM  A placer a la racine du projet, a cote des fichiers .html.
REM  Se lance par double-clic depuis l'explorateur Windows.
REM
REM  Un message de commit est demande : c'est ce qui rend l'historique
REM  utile. Laisser vide met la date et l'heure, mais un message ecrit
REM  vaut toujours mieux.
REM ============================================================================

chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo ========================================================
echo   AC SAT CAMPAGNE - Envoi des modifications sur GitHub
echo ========================================================
echo.

REM --- Git est-il installe ? ---
git --version >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Git n'est pas installe ou pas accessible.
    echo Telechargez-le sur git-scm.com puis rouvrez cette fenetre.
    echo.
    pause
    exit /b 1
)

REM --- Sommes-nous bien dans un depot ? ---
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Ce dossier n'est pas un depot Git.
    echo Placez ce fichier a la racine de AC-SAT-FIELD-git.
    echo Dossier actuel : %CD%
    echo.
    pause
    exit /b 1
)

REM --- Y a-t-il quelque chose a envoyer ? ---
for /f %%i in ('git status --porcelain 2^>nul ^| find /c /v ""') do set NB=%%i
if "!NB!"=="0" (
    echo Aucune modification a envoyer. Tout est deja sur GitHub.
    echo.
    pause
    exit /b 0
)

echo !NB! fichier^(s^) modifie^(s^) :
echo.
git status --short
echo.
echo --------------------------------------------------------

REM --- Message de commit ---
set "MSG="
set /p MSG="Decrivez la modification (Entree = date du jour) : "
if "!MSG!"=="" (
    for /f "tokens=1-3 delims=/ " %%a in ("%date%") do set JOUR=%%a/%%b/%%c
    for /f "tokens=1-2 delims=: " %%a in ("%time%") do set HEURE=%%a h%%b
    set "MSG=Mise a jour du !JOUR! a !HEURE!"
)

echo.
echo --------------------------------------------------------
echo Envoi en cours...
echo.

git add .
if errorlevel 1 goto :echec

git commit -m "!MSG!"
if errorlevel 1 goto :echec

git push
if errorlevel 1 goto :echec

echo.
echo ========================================================
echo   TERMINE - vos fichiers sont sur GitHub
echo ========================================================
echo.
echo Message enregistre : !MSG!
echo.
echo Verification :
git status --short --branch
echo.
pause
exit /b 0

:echec
echo.
echo ========================================================
echo   ECHEC - rien n'a ete envoye
echo ========================================================
echo.
echo Causes frequentes :
echo   - pas de connexion a GitHub
echo   - identifiants a ressaisir
echo   - modifications faites aussi sur GitHub : tapez d'abord "git pull"
echo.
pause
exit /b 1
