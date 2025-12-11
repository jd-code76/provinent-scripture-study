#!/usr/bin/env python3
"""
CSS Concatenator and Minifier for Provinent Scripture Study
Usage: python3 build_css.py [--no-minify]
"""

import os
import sys
import argparse
import shutil
from datetime import datetime
import re

def remove_css_comments(css_content):
    """Remove CSS comments from content"""
    # Remove block comments /* */
    css_content = re.sub(r'/\*.*?\*/', '', css_content, flags=re.DOTALL)

    # Remove line comments //
    css_content = re.sub(r'//.*', '', css_content)

    return css_content

def minify_css(css_content):
    """Minify CSS content"""
    # Remove all comments first
    css_content = remove_css_comments(css_content)

    # Remove all newlines and replace with space
    css_content = re.sub(r'[\r\n]+', ' ', css_content)

    # Remove all tabs
    css_content = re.sub(r'\t', ' ', css_content)

    # Remove spaces around special characters
    css_content = re.sub(r'\s*{\s*', '{', css_content)
    css_content = re.sub(r'\s*}\s*', '}', css_content)
    css_content = re.sub(r'\s*:\s*', ':', css_content)
    css_content = re.sub(r'\s*;\s*', ';', css_content)
    css_content = re.sub(r'\s*,\s*', ',', css_content)
    css_content = re.sub(r'\s*>\s*', '>', css_content)
    css_content = re.sub(r'\s*\+\s*', '+', css_content)
    css_content = re.sub(r'\s*~\s*', '~', css_content)
    css_content = re.sub(r'\s*\(\s*', '(', css_content)
    css_content = re.sub(r'\s*\)\s*', ')', css_content)
    css_content = re.sub(r'\s*\[\s*', '[', css_content)
    css_content = re.sub(r'\s*\]\s*', ']', css_content)

    # Remove space before !important but keep one space after
    css_content = re.sub(r'\s*!\s*important', '!important', css_content)

    # Remove trailing semicolons before closing braces
    css_content = re.sub(r';}', '}', css_content)

    # Remove multiple consecutive spaces
    css_content = re.sub(r'\s+', ' ', css_content)

    # Remove leading and trailing whitespace
    css_content = css_content.strip()

    # Add newline after closing braces for slight readability
    css_content = re.sub(r'}', '}\n', css_content)

    # Remove space at the beginning of lines
    css_content = re.sub(r'(?m)^\s+', '', css_content)

    # Remove empty lines
    css_content = re.sub(r'(?m)^\s*$\n', '', css_content)

    return css_content

def get_file_size_stats(original_content, minified_content, file_name):
    """Calculate file size statistics"""
    original_size = len(original_content.encode('utf-8'))
    minified_size = len(minified_content.encode('utf-8'))

    if original_size > 0:
        savings_percent = round((1 - minified_size / original_size) * 100, 1)
    else:
        savings_percent = 0

    return {
        'original_size': original_size,
        'minified_size': minified_size,
        'savings_percent': savings_percent,
        'file_name': file_name
    }

def main():
    parser = argparse.ArgumentParser(description='CSS Concatenator and Minifier')
    parser.add_argument('--no-minify', action='store_true', help='Skip minification')
    args = parser.parse_args()

    # Define the proper concatenation order
    file_order = [
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
    ]

    source_dir = "../src/css"
    output_dir = "../www"
    output_file = "styles.css"
    output_path = os.path.join(output_dir, output_file)

    # Check if CSS files exist
    print("\033[33mChecking file dependencies...\033[0m")

    missing_files = []
    for file in file_order:
        full_path = os.path.join(source_dir, file)
        if not os.path.isfile(full_path):
            missing_files.append(file)

    if missing_files:
        print("\033[31mMissing files:\033[0m")
        for file in missing_files:
            print(f"  - {file}")
        sys.exit(1)

    print("\033[32mAll files found\033[0m")

    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)

    # Backup existing file if it exists
    if os.path.exists(output_path):
        backup_dir = os.path.join(source_dir, "backups")
        os.makedirs(backup_dir, exist_ok=True)

        backup_file_name = f"styles.css.backup.{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        backup_path = os.path.join(backup_dir, backup_file_name)
        shutil.copy2(output_path, backup_path)
        print(f"\033[33mBacked up existing file to: {backup_path}\033[0m")

    # Track statistics
    total_original_size = 0
    total_minified_size = 0
    file_stats = []

    print("\033[33mProcessing CSS files...\033[0m")

    # Collect all content
    all_content = []

    for file in file_order:
        full_path = os.path.join(source_dir, file)

        # Read file content with UTF-8 encoding
        with open(full_path, 'r', encoding='utf-8') as f:
            original_content = f.read()

        processed_content = original_content

        if not args.no_minify:
            # Full minification
            processed_content = minify_css(processed_content)

        # Get file statistics
        stats = get_file_size_stats(original_content, processed_content, file)
        total_original_size += stats['original_size']
        total_minified_size += stats['minified_size']
        file_stats.append(stats)

        if not args.no_minify:
            original_kb = round(stats['original_size'] / 1024, 1)
            minified_kb = round(stats['minified_size'] / 1024, 1)
            print(f"\033[36m  Processed: {file} - {original_kb}KB -> {minified_kb}KB ({stats['savings_percent']}%)\033[0m")
        else:
            original_kb = round(stats['original_size'] / 1024, 1)
            print(f"\033[36m  Added: {file} - {original_kb}KB\033[0m")

        # Add file separator comment (only visible if not fully minified)
        if args.no_minify:
            all_content.append(f"/* ===== {file} ===== */")

        all_content.append(processed_content)

        if not args.no_minify:
            # Add a single newline between files for minimal separation
            all_content.append("")

    # Join all content with newlines
    final_content = '\n'.join(all_content)

    # Write the final content
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(final_content)

    # Calculate total savings
    if total_original_size > 0:
        total_savings = round((1 - total_minified_size / total_original_size) * 100, 1)
    else:
        total_savings = 0

    print("\n\033[32mProcessing complete!\033[0m")

    # Display statistics
    final_size = os.path.getsize(output_path)
    final_kb = round(final_size / 1024, 1)
    original_kb = round(total_original_size / 1024, 1)

    print("\033[33mFile size statistics:\033[0m")
    print(f"\033[90m  Original total: {original_kb} KB\033[0m")
    print(f"\033[32m  Final size:     {final_kb} KB\033[0m")

    if not args.no_minify:
        saved_kb = round((total_original_size - total_minified_size) / 1024, 1)
        print(f"\033[32m  Space saved:    {total_savings}% ({saved_kb} KB)\033[0m")

    print(f"\033[33mOutput file: {output_path}\033[0m")

    # Usage examples
    print("\n\033[90mUsage examples:\033[0m")
    print("  python3 build_css.py           # Full minification")
    print("  python3 build_css.py --no-minify # Concatenate only (no minification)")

if __name__ == "__main__":
    main()
