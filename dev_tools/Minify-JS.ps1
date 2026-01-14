param([switch]$NoMinify)

$files = @(
    "../src/main.js",
    "../src/sw.js",
    "../src/modules/api.js",
    "../src/modules/highlights.js", 
    "../src/modules/hotkeys.js",
    "../src/modules/navigation.js",
    "../src/modules/passage.js",
    "../src/modules/settings.js",
    "../src/modules/state.js",
    "../src/modules/strongs.js",
    "../src/modules/sync.js",
    "../src/modules/ui.js",
    "../src/sw.js"
)

Write-Host "Checking files..." -ForegroundColor Yellow

Write-Host "Checking files..." -ForegroundColor Yellow

$missing = @()
foreach ($file in $files) {
    if (!(Test-Path $file)) {
        $missing += [System.IO.Path]::GetFileName($file)
    }
}

if ($missing.Count -gt 0) {
    Write-Host "Missing:" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}

Write-Host "All files found" -ForegroundColor Green

function Remove-Comments([string]$Content) {
    $lines = $Content -split "`r?`n"
    $result = @()
    $inBlock = $false
    
    foreach ($line in $lines) {
        $current = $line
        
        if ($inBlock) {
            $end = $current.IndexOf('*/')
            if ($end -ge 0) {
                $current = $current.Substring($end + 2)
                $inBlock = $false
                if ([string]::IsNullOrWhiteSpace($current)) { continue }
            } else {
                continue
            }
        }
        
        $blockStart = $current.IndexOf('/*')
        if ($blockStart -ge 0) {
            $blockEnd = $current.IndexOf('*/', $blockStart + 2)
            if ($blockEnd -ge 0) {
                $before = $current.Substring(0, $blockStart)
                $after = $current.Substring($blockEnd + 2)
                $current = $before + $after
                if ([string]::IsNullOrWhiteSpace($current)) { continue }
            } else {
                $current = $current.Substring(0, $blockStart)
                if ([string]::IsNullOrWhiteSpace($current)) { $current = '' }
                $inBlock = $true
            }
        }
        
        if (!$inBlock -and ![string]::IsNullOrEmpty($current)) {
            $commentPos = $current.IndexOf('//')
            if ($commentPos -ge 0) {
                $before = $current.Substring(0, $commentPos)
                $isSpecial = $before -match 'https?:$|://$|["'']$' -or 
                            $current -match '"[^"]*//[^"]*"' -or 
                            $current -match "'[^']*//[^']*'" -or
                            $current -match '\/[^\/]*\/[gmiyus]*\s*//'
                if (!$isSpecial) { $current = $before }
            }
        }
        
        if (![string]::IsNullOrEmpty($current.Trim())) {
            $result += $current
        }
    }
    
    return $result -join "`r`n"
}

New-Item "../src/modules" -ItemType Directory -Force | Out-Null
$totalOrigSize = 0
$totalProcSize = 0
$totalOrigLines = 0
$totalProcLines = 0

Write-Host "Processing files..." -ForegroundColor Yellow

foreach ($src in $files) {
    $file = [System.IO.Path]::GetFileName($src)
    $dst = $src -replace '^\.\./src', '../www'
    
    Write-Host "  $file" -ForegroundColor Cyan
    
    if (Test-Path $dst) {
        $backup = "../src/modules/$file.backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
        Write-Host "    Backup: $backup" -ForegroundColor Yellow
        Copy-Item $dst $backup -Force
    }
    
    $orig = [System.IO.File]::ReadAllText($src, [System.Text.Encoding]::UTF8)
    $proc = if ($NoMinify) { $orig } else { Remove-Comments $orig }
    
    $origSize = [System.Text.Encoding]::UTF8.GetByteCount($orig)
    $procSize = [System.Text.Encoding]::UTF8.GetByteCount($proc)
    $origLines = ($orig -split "`r`n").Count
    $procLines = ($proc -split "`r`n").Count
    
    $totalOrigSize += $origSize
    $totalProcSize += $procSize
    $totalOrigLines += $origLines
    $totalProcLines += $procLines
    
    if (!$NoMinify) {
        $savings = if ($origSize -gt 0) { [math]::Round((1 - $procSize / $origSize) * 100, 1) } else { 0 }
        $lineReduction = if ($origLines -gt 0) { [math]::Round((1 - $procLines / $origLines) * 100, 1) } else { 0 }
        Write-Host "    Size: $([math]::Round($origSize/1KB,1))KB -> $([math]::Round($procSize/1KB,1))KB ($savings%)" -ForegroundColor White
        Write-Host "    Lines: $origLines -> $procLines ($lineReduction%)" -ForegroundColor Gray
    } else {
        Write-Host "    Copied: $([math]::Round($origSize/1KB,1))KB, $origLines lines" -ForegroundColor White
    }
    
    $dstDir = [System.IO.Path]::GetDirectoryName($dst)
    if (!(Test-Path $dstDir)) { New-Item $dstDir -ItemType Directory -Force | Out-Null }
    [System.IO.File]::WriteAllText($dst, $proc, [System.Text.Encoding]::UTF8)
}

Write-Host "`nComplete!" -ForegroundColor Green

$origKB = [math]::Round($totalOrigSize / 1KB, 1)
$procKB = [math]::Round($totalProcSize / 1KB, 1)

Write-Host "Totals:" -ForegroundColor Yellow
Write-Host "  Original: $origKB KB" -ForegroundColor Gray
Write-Host "  Final: $procKB KB" -ForegroundColor Green

if (!$NoMinify) {
    $savedKB = [math]::Round(($totalOrigSize - $totalProcSize) / 1KB, 1)
    $savedPct = if ($totalOrigSize -gt 0) { [math]::Round((1 - $totalProcSize / $totalOrigSize) * 100, 1) } else { 0 }
    $linesPct = if ($totalOrigLines -gt 0) { [math]::Round((1 - $totalProcLines / $totalOrigLines) * 100, 1) } else { 0 }
    Write-Host "  Saved: $savedPct% ($savedKB KB)" -ForegroundColor Green
    Write-Host "  Lines: $totalOrigLines -> $totalProcLines ($linesPct%)" -ForegroundColor Cyan
}

Write-Host "`nBackups: ../src/modules/" -ForegroundColor Gray
Write-Host "UTF-8 preserved" -ForegroundColor Green

Write-Host "`nUse: .\Build-JS.ps1 [-NoMinify]" -ForegroundColor Gray
