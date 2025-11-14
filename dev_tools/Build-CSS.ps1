# CSS Concatenator and Minifier for Provinent Scripture Study
# Usage: .\Build-CSS.ps1

param(
    [switch]$NoMinify = $false  # Optional: skip minification
)

# Define the proper concatenation order
$FileOrder = @(
    "variables.css",
    "reset.css",
    "layout.css",
    "sidebar.css",
    "reference-panel.css",
    "resize-handles.css",
    "header.css",
    "scripture.css",
    "color-picker.css",
    "highlights-popup.css",
    "strongs-popup.css",
    "notes.css",
    "settings.css",
    "loading.css",
    "error.css",
    "responsive.css",
    "scrollbars.css",
    "hotkeys.css"
)

$SourceDir = "../src/css"
$outputDir = "../www"
$outputFile = "styles.css"
$outputPath = Join-Path -Path $outputDir -ChildPath $outputFile

# Check if CSS files exist
Write-Host "Checking file dependencies..." -ForegroundColor Yellow

$missingFiles = @()
foreach ($file in $FileOrder) {
    $fullPath = Join-Path $SourceDir $file
    if (-not (Test-Path $fullPath)) {
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "Missing files:" -ForegroundColor Red
    $missingFiles | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}

Write-Host "All files found" -ForegroundColor Green

function Remove-Css-Comments {
    param([string]$cssContent)
    
    # Remove block comments /* */
    $cssContent = $cssContent -replace '(?s)/\*.*?\*/', ''
    
    # Remove line comments //
    $cssContent = $cssContent -replace '//.*', ''
    
    return $cssContent
}

function Minify-Css {
    param([string]$cssContent)
    
    # Remove all comments first
    $cssContent = Remove-Css-Comments $cssContent
    
    # Remove all newlines and replace with space
    $cssContent = $cssContent -replace '[\r\n]+', ' '
    
    # Remove all tabs
    $cssContent = $cssContent -replace '\t', ' '
    
    # Remove spaces around special characters
    $cssContent = $cssContent -replace '\s*{\s*', '{'
    $cssContent = $cssContent -replace '\s*}\s*', '}'
    $cssContent = $cssContent -replace '\s*:\s*', ':'
    $cssContent = $cssContent -replace '\s*;\s*', ';'
    $cssContent = $cssContent -replace '\s*,\s*', ','
    $cssContent = $cssContent -replace '\s*>\s*', '>'
    $cssContent = $cssContent -replace '\s*\+\s*', '+'
    $cssContent = $cssContent -replace '\s*~\s*', '~'
    $cssContent = $cssContent -replace '\s*\(\s*', '('
    $cssContent = $cssContent -replace '\s*\)\s*', ')'
    $cssContent = $cssContent -replace '\s*\[\s*', '['
    $cssContent = $cssContent -replace '\s*\]\s*', ']'
    
    # Remove space before !important but keep one space after
    $cssContent = $cssContent -replace '\s*!\s*important', '!important'
    
    # Remove trailing semicolons before closing braces
    $cssContent = $cssContent -replace ';}', '}'
    
    # Remove multiple consecutive spaces
    $cssContent = $cssContent -replace '\s+', ' '
    
    # Remove leading and trailing whitespace
    $cssContent = $cssContent.Trim()
    
    # Add newline after closing braces for slight readability (optional - remove if you want one-line)
    $cssContent = $cssContent -replace '}', "}`n"
    
    # Remove space at the beginning of lines
    $cssContent = $cssContent -replace '(?m)^\s+', ''
    
    # Remove empty lines
    $cssContent = $cssContent -replace '(?m)^\s*$\n', ''
    
    return $cssContent
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

# Create header with timestamp
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$minifiedStatus = if (-not $NoMinify) { "Yes (full minification)" } else { "No" }

# Ensure output directory exists
if (-Not (Test-Path -Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# Backup existing file if it exists (save to source directory)
if (Test-Path $outputPath) {
    # Create backups directory in source folder if it doesn't exist
    $backupDir = Join-Path $SourceDir "backups"
    if (-Not (Test-Path -Path $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    }
    
    $backupFileName = "styles.css.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    $backupPath = Join-Path $backupDir $backupFileName
    Copy-Item $outputPath $backupPath
    Write-Host "Backed up existing file to: $backupPath" -ForegroundColor Yellow
}

# Track statistics
$totalOriginalSize = 0
$totalMinifiedSize = 0
$fileStats = @()

Write-Host "Processing CSS files..." -ForegroundColor Yellow

# Collect all content first
$allContent = New-Object System.Text.StringBuilder

foreach ($file in $FileOrder) {
    $fullPath = Join-Path $SourceDir $file
    
    # Use .NET StreamReader to read with proper encoding
    $reader = [System.IO.StreamReader]::new($fullPath, [System.Text.Encoding]::UTF8)
    $originalContent = $reader.ReadToEnd()
    $reader.Close()
    
    $processedContent = $originalContent
    
    if (-not $NoMinify) {
        # Full minification
        $processedContent = Minify-Css $processedContent
    }
    
    # Get file statistics
    $stats = Get-File-Size-Stats -originalContent $originalContent -minifiedContent $processedContent -fileName $file
    $totalOriginalSize += $stats.OriginalSize
    $totalMinifiedSize += $stats.MinifiedSize
    $fileStats += $stats
    
    if (-not $NoMinify) {
        Write-Host "  Processed: $file - $([math]::Round($stats.OriginalSize/1KB,1))KB -> $([math]::Round($stats.MinifiedSize/1KB,1))KB ($($stats.SavingsPercent)%)" -ForegroundColor Cyan
    } else {
        Write-Host "  Added: $file - $([math]::Round($stats.OriginalSize/1KB,1))KB" -ForegroundColor Cyan
    }
    
    # Add file separator comment (only visible if not fully minified)
    if ($NoMinify) {
        [void]$allContent.AppendLine("/* ===== $file ===== */")
    }
    [void]$allContent.Append($processedContent)
    
    if (-not $NoMinify) {
        # Add a single newline between files for minimal separation
        [void]$allContent.AppendLine()
    }
}

# Write the final content
[System.IO.File]::WriteAllText($outputPath, $allContent.ToString(), [System.Text.Encoding]::UTF8)

# Calculate total savings
$totalSavings = if ($totalOriginalSize -gt 0) { [math]::Round((1 - $totalMinifiedSize / $totalOriginalSize) * 100, 1) } else { 0 }

Write-Host "`nProcessing complete!" -ForegroundColor Green

# Display statistics
$finalSizeKB = [math]::Round((Get-Item $outputPath).Length / 1KB, 1)
$originalSizeKB = [math]::Round($totalOriginalSize / 1KB, 1)

Write-Host "File size statistics:" -ForegroundColor Yellow
Write-Host "  Original total: $originalSizeKB KB" -ForegroundColor Gray
Write-Host "  Final size:     $finalSizeKB KB" -ForegroundColor Green

if (-not $NoMinify) {
    $savedKB = [math]::Round(($totalOriginalSize - $totalMinifiedSize) / 1KB, 1)
    Write-Host "  Space saved:    $totalSavings% ($savedKB KB)" -ForegroundColor Green
}

Write-Host "Output file: $outputPath" -ForegroundColor Yellow

# Usage examples
Write-Host "`nUsage examples:" -ForegroundColor Gray
Write-Host "  .\Build-CSS.ps1           # Full minification"
Write-Host "  .\Build-CSS.ps1 -NoMinify # Concatenate only (no minification)"
