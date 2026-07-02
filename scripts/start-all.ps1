Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class ConsoleModeNative {
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr GetStdHandle(int nStdHandle);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool GetConsoleMode(IntPtr hConsoleHandle, out int lpMode);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool SetConsoleMode(IntPtr hConsoleHandle, int dwMode);
}
"@

function Get-ConsoleModes {
	$STD_INPUT_HANDLE = -10
	$STD_OUTPUT_HANDLE = -11
	$inHandle = [ConsoleModeNative]::GetStdHandle($STD_INPUT_HANDLE)
	$outHandle = [ConsoleModeNative]::GetStdHandle($STD_OUTPUT_HANDLE)
	$inMode = 0
	$outMode = 0
	[void][ConsoleModeNative]::GetConsoleMode($inHandle, [ref]$inMode)
	[void][ConsoleModeNative]::GetConsoleMode($outHandle, [ref]$outMode)
	return @{
		InHandle = $inHandle
		OutHandle = $outHandle
		InMode = $inMode
		OutMode = $outMode
	}
}

$originalModes = Get-ConsoleModes

Write-Host "=== Starting Research Tree ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/2] Starting backend..." -ForegroundColor Yellow
$backendProc = & "$PSScriptRoot\start-backend.ps1" -NoWait

Write-Host "Waiting for backend health..." -ForegroundColor DarkGray
$backendReady = $false
for ($i = 0; $i -lt 40; $i++) {
	try {
		$resp = Invoke-RestMethod -Uri "http://127.0.0.1:8010/api/health" -TimeoutSec 1
		if ($resp.status -eq "ok") {
			$backendReady = $true
			break
		}
	} catch {
		# backend still starting
	}
	Start-Sleep -Milliseconds 250
}

if (-not $backendReady) {
	Write-Host "Backend is still starting; frontend will retry data loading automatically." -ForegroundColor DarkYellow
}

Write-Host "[2/2] Starting frontend..." -ForegroundColor Yellow
$frontendProc = & "$PSScriptRoot\start-frontend.ps1" -NoWait

Write-Host ""
Write-Host "=== Both servers started ===" -ForegroundColor Green
Write-Host "  Backend:  http://127.0.0.1:8010"
Write-Host "  Frontend: http://127.0.0.1:5173"
Write-Host ""
Write-Host "Live output is attached to this console." -ForegroundColor DarkGray
Write-Host "Press Ctrl+C to stop both servers and return to prompt." -ForegroundColor DarkGray
Write-Host "Open http://127.0.0.1:5173 in your browser." -ForegroundColor Cyan

$backendCrashNotified = $false
$frontendCrashNotified = $false
try {
	while ($true) {
		if ($backendProc -and -not $backendCrashNotified) {
			$backendProc.Refresh()
			if ($backendProc.HasExited) {
				$backendCrashNotified = $true
				Write-Host "[backend] Process exited with code $($backendProc.ExitCode). Check traceback above." -ForegroundColor Red
			}
		}

		if ($frontendProc -and -not $frontendCrashNotified) {
			$frontendProc.Refresh()
			if ($frontendProc.HasExited) {
				$frontendCrashNotified = $true
				Write-Host "[frontend] Process exited with code $($frontendProc.ExitCode). Check logs above." -ForegroundColor Red
			}
		}

		Start-Sleep -Milliseconds 500
	}
} finally {
	Write-Host ""
	Write-Host "Stopping servers..." -ForegroundColor Yellow
	& "$PSScriptRoot\stop-all.ps1"

	# Restore exact console modes so parent PowerShell keeps normal editing/history behavior.
	if ($originalModes) {
		[void][ConsoleModeNative]::SetConsoleMode($originalModes.InHandle, $originalModes.InMode)
		[void][ConsoleModeNative]::SetConsoleMode($originalModes.OutHandle, $originalModes.OutMode)
	}
}
