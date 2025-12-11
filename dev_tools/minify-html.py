#!/usr/bin/env python3
"""
HTML Minifier for Provinent Scripture Study
Revised: Only removes comments and newlines, preserves GPL license comments
Usage: python3 minify_html.py [--no-minify]
"""

import os
import sys
import argparse
import shutil
import re
from datetime import datetime

def remove_html_comments(html_content):
    """Remove HTML comments but preserve the specific GPL license comment format"""
    # First, extract the specific GPL license comment if it exists at the beginning
    gpl_pattern = r'^(<!--\s*\n// Provinent Scripture Study - Bible study web application\n// Copyright \(C\) 2025 Jordan DiPasquale\n//\n// This program is free software: you can redistribute it and/or modify\n// it under the terms of the GNU General Public License version 3 as \n// published by the Free Software Foundation\.\n//\n// This program is distributed in the hope that it will be useful,\n// but WITHOUT ANY WARRANTY; without even the implied warranty of\n// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE\.  See the\n// GNU General Public License for more details\.\n-->)(.*)'

    gpl_comment_match = re.match(gpl_pattern, html_content, re.DOTALL)
    gpl_comment = ""
    remaining_content = html_content

    if gpl_comment_match:
        gpl_comment = gpl_comment_match.group(1)
        remaining_content = gpl_comment_match.group(2)
    else:
        # Try a more flexible pattern if the exact one doesn't match
        flexible_gpl_pattern = r'^(<!--\s*[\s\S]*?Provinent Scripture Study[\s\S]*?GNU General Public License[\s\S]*?-->)(.*)'
        flexible_match = re.match(flexible_gpl_pattern, html_content, re.DOTALL | re.IGNORECASE)
        if flexible_match:
            gpl_comment = flexible_match.group(1)
            remaining_content = flexible_match.group(2)

    # Remove standard HTML comments but preserve IE conditional comments
    # This regex matches <!-- --> but not <!--[if ...]> or <![endif]-->
    pattern = r'<!--(?!\[if.*?\]>|<!\[endif]).*?-->'
    remaining_content = re.sub(pattern, '', remaining_content, flags=re.DOTALL)

    # Return the content with GPL comment preserved at the beginning
    return gpl_comment + remaining_content

def lightly_minify_html(html_content):
    """Light minification: only remove comments and newlines, preserve GPL license"""
    # Remove HTML comments (except the specific GPL license comment and IE conditionals)
    html_content = remove_html_comments(html_content)

    # Remove newlines and carriage returns (but preserve the GPL comment if it exists)
    gpl_pattern = r'^(<!--\s*\n// Provinent Scripture Study[\s\S]*?-->)(.*)'
    gpl_match = re.match(gpl_pattern, html_content, re.DOTALL)

    if gpl_match:
        gpl_comment = gpl_match.group(1)
        remaining_content = gpl_match.group(2)
        # Only minify the content after the GPL comment
        remaining_content = re.sub(r'[\r\n]+', ' ', remaining_content)
        remaining_content = re.sub(r'\s+', ' ', remaining_content)
        remaining_content = remaining_content.strip()
        html_content = gpl_comment + remaining_content
    else:
        # Minify the entire content
        html_content = re.sub(r'[\r\n]+', ' ', html_content)
        html_content = re.sub(r'\s+', ' ', html_content)
        html_content = html_content.strip()

    return html_content

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
    parser = argparse.ArgumentParser(description='HTML Minifier - Comments and Newlines Only (Preserves GPL License)')
    parser.add_argument('--no-minify', action='store_true', help='Skip minification')
    args = parser.parse_args()

    # Simplified file processing - single source file
    source_file = "../src/index.html"
    output_base = "../www"
    files_to_process = ["index.html"]
    source_dir = os.path.dirname(source_file)

    # Check if source files exist
    print("\033[33mChecking source files...\033[0m")

    missing_files = []
    for file in files_to_process:
        source_path = os.path.join(source_dir, file)
        if not os.path.isfile(source_path):
            missing_files.append(file)

    if missing_files:
        print("\033[31mMissing files:\033[0m")
        for file in missing_files:
            print(f"  - {file}")
        sys.exit(1)

    print("\033[32mAll source files found\033[0m")

    # Ensure output directories exist
    os.makedirs(output_base, exist_ok=True)
    if not os.path.exists(output_base):
        print(f"\033[32mCreated output directory: {output_base}\033[0m")

    # Track statistics
    total_original_size = 0
    total_minified_size = 0
    file_stats = []

    print("\n\033[33mProcessing HTML files...\033[0m")

    for file in files_to_process:
        source_path = os.path.join(source_dir, file)
        dest_path = os.path.join(output_base, file)

        print(f"\n  \033[36mProcessing: {file}\033[0m")

        # Backup existing file if it exists
        if os.path.exists(dest_path):
            backup_dir = os.path.join(source_dir, "backups")
            os.makedirs(backup_dir, exist_ok=True)

            backup_file_name = f"{file.replace('/', '_').replace('\\', '_')}.backup.{datetime.now().strftime('%Y%m%d-%H%M%S')}"
            backup_path = os.path.join(backup_dir, backup_file_name)
            shutil.copy2(dest_path, backup_path)
            print(f"    \033[33mBacked up to: {backup_path}\033[0m")

        # Read source file with proper encoding
        with open(source_path, 'r', encoding='utf-8') as f:
            original_content = f.read()

        processed_content = original_content

        if not args.no_minify:
            # Light minification: only remove comments and newlines
            processed_content = lightly_minify_html(processed_content)

        # Get statistics
        stats = get_file_size_stats(original_content, processed_content, file)
        total_original_size += stats['original_size']
        total_minified_size += stats['minified_size']
        file_stats.append(stats)

        if not args.no_minify:
            original_kb = round(stats['original_size'] / 1024, 1)
            minified_kb = round(stats['minified_size'] / 1024, 1)
            saved_kb = round((stats['original_size'] - stats['minified_size']) / 1024, 1)
            print(f"    \033[90mOriginal: {original_kb} KB\033[0m")
            print(f"    \033[32mMinified: {minified_kb} KB\033[0m")
            print(f"    \033[32mSaved: {stats['savings_percent']}% ({saved_kb} KB)\033[0m")
        else:
            original_kb = round(stats['original_size'] / 1024, 1)
            print(f"    \033[90mSize: {original_kb} KB (no minification)\033[0m")

        # Write the processed content
        with open(dest_path, 'w', encoding='utf-8') as f:
            f.write(processed_content)
        print(f"    \033[36mWritten to: {dest_path}\033[0m")

    # Calculate total savings
    if total_original_size > 0:
        total_savings = round((1 - total_minified_size / total_original_size) * 100, 1)
    else:
        total_savings = 0

    print("\n" + "=" * 64)
    print("\033[32mProcessing complete!\033[0m")
    print("=" * 64)

    # Display overall statistics
    original_kb = round(total_original_size / 1024, 1)
    minified_kb = round(total_minified_size / 1024, 1)
    saved_kb = round((total_original_size - total_minified_size) / 1024, 1)

    print("\n\033[33mOverall Statistics:\033[0m")
    print(f"  \033[36mFiles processed: {len(files_to_process)}\033[0m")
    print(f"  \033[90mOriginal total:  {original_kb} KB\033[0m")
    print(f"  \033[32mFinal total:     {minified_kb} KB\033[0m")

    if not args.no_minify:
        print(f"  \033[32mSpace saved:     {total_savings}% ({saved_kb} KB)\033[0m")

    method = "Light minification (comments/newlines only, preserves GPL license and formatting)"
    if args.no_minify:
        method = "Copy without minification"
    print(f"  \033[90mMethod:          {method}\033[0m")

    # Usage examples
    print("\n\033[90mUsage examples:\033[0m")
    print("  python3 minify_html.py           # Light minification (comments/newlines only)")
    print("  python3 minify_html.py --no-minify # Copy without minification")

if __name__ == "__main__":
    main()
