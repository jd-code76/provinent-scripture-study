# JavaScript Minifier for Provinent Scripture Study
# Conservative approach: removes comments only, preserves code structure and UTF-8 encoding

param(
    [switch]$NoMinify = $false  # Optional: skip processing
)

# Define file mappings
$fileMappings = @(
    @{ Source = "../src/main.js"; Destination = "../www/main.js" },
    @{ Source = "../src/modules/api.js"; Destination = "../www/modules/api.js" },
    @{ Source = "../src/modules/navigation.js"; Destination = "../www/modules/navigation.js" },
    @{ Source = "../src/modules/passage.js"; Destination = "../www/modules/passage.js" },
    @{ Source = "../src/modules/pdf.js"; Destination = "../www/modules/pdf.js" },
    @{ Source = "../src/modules/settings.js"; Destination = "../www/modules/settings.js" },
    @{ Source = "../src/modules/state.js"; Destination = "../www/modules/state.js" },
    @{ Source = "../src/modules/strongs.js"; Destination = "../www/modules/strongs.js" },
    @{ Source = "../src/modules/ui.js"; Destination = "../www/modules/ui.js" },
    @{ Source = "../src/sw.js"; Destination = "../www/sw.js" }
)

# Check if JS files exist
Write-Host "Checking file dependencies..." -ForegroundColor Yellow

$missingFiles = @()
foreach ($mapping in $fileMappings) {
    if (-not (Test-Path $mapping.Source)) {
        $missingFiles += (Split-Path $mapping.Source -Leaf)
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "Missing files:" -ForegroundColor Red
    $missingFiles | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}

Write-Host "All files found" -ForegroundColor Green

function Remove-JSComments {
    param([string]$Content)
    
    # Process line by line to avoid encoding issues
    $lines = $Content -split "`r?`n"
    $processedLines = @()
    
    $inBlockComment = $false
    
    foreach ($line in $lines) {
        $currentLine = $line
        
        # Handle block comments spanning multiple lines
        if ($inBlockComment) {
            $endIndex = $currentLine.IndexOf('*/')
            if ($endIndex -ge 0) {
                # End of block comment found
                $currentLine = $currentLine.Substring($endIndex + 2)
                $inBlockComment = $false
                # Don't add the line if it only contained the comment end
                if (-not [string]::IsNullOrWhiteSpace($currentLine)) {
                    $processedLines += $currentLine
                }
                continue
            } else {
                # Still inside block comment, skip this line
                continue
            }
        }
        
        # Check for block comments
        $blockStartIndex = $currentLine.IndexOf('/*')
        if ($blockStartIndex -ge 0) {
            $blockEndIndex = $currentLine.IndexOf('*/', $blockStartIndex + 2)
            if ($blockEndIndex -ge 0) {
                # Block comment starts and ends on same line
                $beforeComment = $currentLine.Substring(0, $blockStartIndex)
                $afterComment = $currentLine.Substring($blockEndIndex + 2)
                $currentLine = $beforeComment + $afterComment
                # Check if line is now empty
                if ([string]::IsNullOrWhiteSpace($currentLine)) {
                    continue
                }
            } else {
                # Block comment starts on this line but continues
                $beforeComment = $currentLine.Substring(0, $blockStartIndex)
                # Only keep content before comment if it's not just whitespace
                if (-not [string]::IsNullOrWhiteSpace($beforeComment)) {
                    $currentLine = $beforeComment
                } else {
                    $currentLine = ''
                }
                $inBlockComment = $true
            }
        }
        
        # Handle single-line comments only if not in block comment
        if (-not $inBlockComment -and -not [string]::IsNullOrEmpty($currentLine)) {
            $commentIndex = $currentLine.IndexOf('//')
            
            if ($commentIndex -ge 0) {
                # Check if it's likely a URL or special pattern that should be preserved
                $beforeComment = $currentLine.Substring(0, $commentIndex)
                
                # Skip if it's a URL, regex, or quoted string containing //
                $isUrl = $beforeComment -match 'https?:$|://$|["'']$' -or 
                         $currentLine -match '"[^"]*//[^"]*"' -or 
                         $currentLine -match "'[^']*//[^']*'" -or
                         $currentLine -match '\/[^\/]*\/[gmiyus]*\s*//'  # regex pattern followed by comment
                
                if (-not $isUrl) {
                    # Remove the single-line comment and everything after it
                    $currentLine = $beforeComment
                }
            }
        }
        
        # Only add non-empty lines (or lines that only had trailing whitespace before comment)
        $trimmedLine = $currentLine.Trim()
        if (-not [string]::IsNullOrEmpty($trimmedLine)) {
            $processedLines += $currentLine
        }
    }
    
    # Rejoin with original line endings
    return $processedLines -join "`r`n"
}

function Get-File-Size-Stats {
    param(
        [string]$originalContent,
        [string]$processedContent,
        [string]$fileName
    )
    
    $originalSize = [System.Text.Encoding]::UTF8.GetByteCount($originalContent)
    $processedSize = [System.Text.Encoding]::UTF8.GetByteCount($processedContent)
    $savings = if ($originalSize -gt 0) { [math]::Round((1 - $processedSize / $originalSize) * 100, 1) } else { 0 }
    
    # Count lines
    $originalLines = ($originalContent -split "`r`n").Count
    $processedLines = ($processedContent -split "`r`n").Count
    $linesReduction = if ($originalLines -gt 0) { [math]::Round((1 - $processedLines / $originalLines) * 100, 1) } else { 0 }
    
    return @{
        OriginalSize = $originalSize
        ProcessedSize = $processedSize
        SavingsPercent = $savings
        OriginalLines = $originalLines
        ProcessedLines = $processedLines
        LinesReduction = $linesReduction
        FileName = $fileName
    }
}

# Track statistics
$totalOriginalSize = 0
$totalProcessedSize = 0
$totalOriginalLines = 0
$totalProcessedLines = 0
$fileStats = @()

# Ensure backup directory exists
$backupDir = "../src/modules"
if (!(Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force
}

Write-Host "Processing JavaScript files..." -ForegroundColor Yellow

# Process each file
foreach ($mapping in $fileMappings) {
    $sourceFile = $mapping.Source
    $destFile = $mapping.Destination
    $fileName = Split-Path $sourceFile -Leaf
    
    Write-Host "  Processing: $fileName" -ForegroundColor Cyan
    
    if (Test-Path $sourceFile) {
        # Backup destination file if it exists
        if (Test-Path $destFile) {
            $backupPath = Join-Path $backupDir "$fileName.backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
            Write-Host "    Backing up existing file to: $backupPath" -ForegroundColor Yellow
            Copy-Item $destFile $backupPath -Force
        }
        
        # Read source file with proper UTF-8 encoding using .NET methods
        $originalContent = [System.IO.File]::ReadAllText($sourceFile, [System.Text.Encoding]::UTF8)
        $processedContent = $originalContent
        
        if (-not $NoMinify) {
            # Remove comments only (conservative approach)
            $processedContent = Remove-JSComments -Content $processedContent
        }
        
        # Get file statistics
        $stats = Get-File-Size-Stats -originalContent $originalContent -processedContent $processedContent -fileName $fileName
        $totalOriginalSize += $stats.OriginalSize
        $totalProcessedSize += $stats.ProcessedSize
        $totalOriginalLines += $stats.OriginalLines
        $totalProcessedLines += $stats.ProcessedLines
        $fileStats += $stats
        
        if (-not $NoMinify) {
            Write-Host "    Processed: $([math]::Round($stats.OriginalSize/1KB,1))KB -> $([math]::Round($stats.ProcessedSize/1KB,1))KB ($($stats.SavingsPercent)%)" -ForegroundColor White
            Write-Host "    Lines: $($stats.OriginalLines) -> $($stats.ProcessedLines) ($($stats.LinesReduction)%)" -ForegroundColor Gray
        } else {
            Write-Host "    Copied: $([math]::Round($stats.OriginalSize/1KB,1))KB, $($stats.OriginalLines) lines" -ForegroundColor White
        }
        
        # Ensure destination directory exists
        $destDir = Split-Path $destFile -Parent
        if (!(Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force
        }
        
        # Write processed content with proper UTF-8 encoding using .NET methods
        [System.IO.File]::WriteAllText($destFile, $processedContent, [System.Text.Encoding]::UTF8)
    }
}

# Calculate total savings
$totalSavings = if ($totalOriginalSize -gt 0) { [math]::Round((1 - $totalProcessedSize / $totalOriginalSize) * 100, 1) } else { 0 }
$totalLinesReduction = if ($totalOriginalLines -gt 0) { [math]::Round((1 - $totalProcessedLines / $totalOriginalLines) * 100, 1) } else { 0 }

Write-Host "`nProcessing complete!" -ForegroundColor Green

# Display statistics
$finalSizeKB = [math]::Round($totalProcessedSize / 1KB, 1)
$originalSizeKB = [math]::Round($totalOriginalSize / 1KB, 1)

Write-Host "File size statistics:" -ForegroundColor Yellow
Write-Host "  Original total: $originalSizeKB KB" -ForegroundColor Gray
Write-Host "  Final size:     $finalSizeKB KB" -ForegroundColor Green

if (-not $NoMinify) {
    $savedKB = [math]::Round(($totalOriginalSize - $totalProcessedSize) / 1KB, 1)
    Write-Host "  Space saved:    $totalSavings% ($savedKB KB)" -ForegroundColor Green
    Write-Host "  Lines reduced:  $totalOriginalLines -> $totalProcessedLines ($totalLinesReduction%)" -ForegroundColor Cyan
}

Write-Host "`nBackups stored in: $backupDir" -ForegroundColor Gray
Write-Host "UTF-8 encoding preserved for all special characters" -ForegroundColor Green

# Usage examples
Write-Host "`nUsage examples:" -ForegroundColor Gray
Write-Host "  .\Build-JS.ps1           # Remove comments only (conservative)"
Write-Host "  .\Build-JS.ps1 -NoMinify # Copy files only (no modification)"

if (-not $NoMinify) {
    Write-Host "`nNote: Conservative minification - only comments removed, UTF-8 and code structure preserved" -ForegroundColor Yellow
    Write-Host "Removes: // single-line comments, /* */ block comments, preserves URLs and special patterns" -ForegroundColor Gray
}
