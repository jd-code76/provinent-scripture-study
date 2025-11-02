# HTML Minifier for Provinent Scripture Study
# Revised: Only removes comments and newlines
# Usage: .\Minify-HTML.ps1

param(
    [switch]$NoMinify = $false  # Optional: skip minification
)

# Simplified file processing - single source file
$SourceFile = "../src/index.html"
$OutputBase = "../public"
$FilesToProcess = @("index.html")

# Check if source files exist
Write-Host "Checking source files..." -ForegroundColor Yellow

$missingFiles = @()
foreach ($file in $FilesToProcess) {
    $sourcePath = Join-Path (Split-Path $SourceFile -Parent) $file
    if (-not (Test-Path $sourcePath)) {
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "Missing files:" -ForegroundColor Red
    $missingFiles | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}

Write-Host "All source files found" -ForegroundColor Green

function Remove-Html-Comments {
    param([string]$htmlContent)
    
    # Remove standard HTML comments but preserve IE conditional comments
    $htmlContent = $htmlContent -replace '<!--(?!\[if.*?\]>|<!\[endif).*?-->', ''
    
    return $htmlContent
}

function Lightly-Minify-Html {
    param([string]$htmlContent)
    
    # Remove HTML comments (except IE conditional comments)
    $htmlContent = Remove-Html-Comments $htmlContent
    
    # Remove newlines and carriage returns
    $htmlContent = $htmlContent -replace '[\r\n]+', ' '
    
    # Collapse multiple spaces into one (to clean up after newline removal)
    $htmlContent = $htmlContent -replace '\s+', ' '
    
    # Trim the entire content
    $htmlContent = $htmlContent.Trim()
    
    return $htmlContent
}

function Get-File-Size-Stats {
    param(
        [string]$originalContent,
        [string]$minifiedContent,
        [string]$fileName
    )
    
    $originalSize = [System.Text.Encoding]::UTF8.GetByteCount($originalContent)
    $minifiedSize = [System.Text.Encoding]::UTF8.GetByteCount($minifiedContent)
    $savings = if ($originalSize -gt 0) { [math]::Round((1 - $minifiedSize / $originalSize) * 100, 1) } else { 0 }
    
    return @{
        OriginalSize = $originalSize
        MinifiedSize = $minifiedSize
        SavingsPercent = $savings
        FileName = $fileName
    }
}

# Ensure output directories exist
if (-Not (Test-Path -Path $OutputBase)) {
    New-Item -ItemType Directory -Path $OutputBase -Force | Out-Null
    Write-Host "Created output directory: $OutputBase" -ForegroundColor Green
}

# Track statistics
$totalOriginalSize = 0
$totalMinifiedSize = 0
$fileStats = @()

Write-Host "`nProcessing HTML files..." -ForegroundColor Yellow

foreach ($file in $FilesToProcess) {
    $sourcePath = Join-Path (Split-Path $SourceFile -Parent) $file
    $destPath = Join-Path $OutputBase $file
    
    Write-Host "`n  Processing: $file" -ForegroundColor Cyan
    
    # Backup existing file if it exists
    if (Test-Path $destPath) {
        $backupDir = Join-Path (Split-Path $SourceFile -Parent) "backups"
        if (-Not (Test-Path $backupDir)) {
            New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        }
        
        $backupFileName = "$($file -replace '[/\\]', '_').backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        $backupPath = Join-Path $backupDir $backupFileName
        Copy-Item $destPath $backupPath
        Write-Host "    Backed up to: $backupPath" -ForegroundColor Yellow
    }
    
    # Read source file with proper encoding
    $originalContent = [System.IO.File]::ReadAllText($sourcePath, [System.Text.Encoding]::UTF8)
    
    $processedContent = $originalContent
    
    if (-not $NoMinify) {
        # Light minification: only remove comments and newlines
        $processedContent = Lightly-Minify-Html $processedContent
    }
    
    # Get statistics
    $stats = Get-File-Size-Stats -originalContent $originalContent -minifiedContent $processedContent -fileName $file
    $totalOriginalSize += $stats.OriginalSize
    $totalMinifiedSize += $stats.MinifiedSize
    $fileStats += $stats
    
    if (-not $NoMinify) {
        Write-Host "    Original: $([math]::Round($stats.OriginalSize/1KB,1)) KB" -ForegroundColor Gray
        Write-Host "    Minified: $([math]::Round($stats.MinifiedSize/1KB,1)) KB" -ForegroundColor Green
        Write-Host "    Saved: $($stats.SavingsPercent)% ($([math]::Round(($stats.OriginalSize - $stats.MinifiedSize)/1KB,1)) KB)" -ForegroundColor Green
    } else {
        Write-Host "    Size: $([math]::Round($stats.OriginalSize/1KB,1)) KB (no minification)" -ForegroundColor Gray
    }
    
    # Write the processed content
    [System.IO.File]::WriteAllText($destPath, $processedContent, [System.Text.Encoding]::UTF8)
    Write-Host "    Written to: $destPath" -ForegroundColor Cyan
}

# Calculate total savings
$totalSavings = if ($totalOriginalSize -gt 0) { [math]::Round((1 - $totalMinifiedSize / $totalOriginalSize) * 100, 1) } else { 0 }

Write-Host "`n================================================================" -ForegroundColor Yellow
Write-Host "Processing complete!" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Yellow

# Display overall statistics
$originalSizeKB = [math]::Round($totalOriginalSize / 1KB, 1)
$minifiedSizeKB = [math]::Round($totalMinifiedSize / 1KB, 1)
$savedKB = [math]::Round(($totalOriginalSize - $totalMinifiedSize) / 1KB, 1)

Write-Host "`nOverall Statistics:" -ForegroundColor Yellow
Write-Host "  Files processed: $($FilesToProcess.Count)" -ForegroundColor Cyan
Write-Host "  Original total:  $originalSizeKB KB" -ForegroundColor Gray
Write-Host "  Final total:     $minifiedSizeKB KB" -ForegroundColor Green

if (-not $NoMinify) {
    Write-Host "  Space saved:     $totalSavings% ($savedKB KB)" -ForegroundColor Green
}
Write-Host "  Method:          Comments and newlines only (preserves formatting)" -ForegroundColor Gray

# Usage examples
Write-Host "`nUsage examples:" -ForegroundColor Gray
Write-Host "  .\Minify-HTML.ps1           # Light minification (comments/newlines only)"
Write-Host "  .\Minify-HTML.ps1 -NoMinify # Copy without minification"
