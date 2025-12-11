#!/usr/bin/env python3
"""
JavaScript Builder for Provinent Scripture Study
Usage: python3 build_js.py [--no-minify]
"""

import os
import sys
import argparse
import shutil
import re
from datetime import datetime

def remove_comments(content):
    """Remove comments from JavaScript code while preserving special cases"""
    lines = content.splitlines()
    result = []
    in_block_comment = False

    for line in lines:
        current = line

        if in_block_comment:
            end_pos = current.find('*/')
            if end_pos >= 0:
                current = current[end_pos + 2:]
                in_block_comment = False
                if not current.strip():
                    continue
            else:
                continue

        block_start = current.find('/*')
        if block_start >= 0:
            block_end = current.find('*/', block_start + 2)
            if block_end >= 0:
                before = current[:block_start]
                after = current[block_end + 2:]
                current = before + after
                if not current.strip():
                    current = ''
            else:
                current = current[:block_start]
                in_block_comment = True

        if not in_block_comment and current.strip():
            comment_pos = current.find('//')
            if comment_pos >= 0:
                before = current[:comment_pos]
                # Check for special cases where // should be preserved
                is_special_case = (
                    re.search(r'https?:$', before) or  # http:// or https:// at end
                    re.search(r'://$', before) or      # any :// at end
                    re.search(r'["\']$', before) or    # quote at end
                    re.search(r'"[^"]*//[^"]*"', current) or  # // inside double quotes
                    re.search(r"'[^']*//[^']*'", current) or  # // inside single quotes
                    re.search(r'\/[^\/]*\/[gmiyus]*\s*//', current)  # regex literal followed by //
                )
                if not is_special_case:
                    current = before

        if current.strip():
            result.append(current)

    return '\n'.join(result)

def main():
    parser = argparse.ArgumentParser(description='JavaScript Builder')
    parser.add_argument('--no-minify', action='store_true', help='Skip comment removal')
    args = parser.parse_args()

    files = [
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
        "../src/modules/ui.js"
    ]

    print("\033[33mChecking files...\033[0m")

    missing = []
    for file in files:
        if not os.path.isfile(file):
            missing.append(os.path.basename(file))

    if missing:
        print("\033[31mMissing:\033[0m")
        for file in missing:
            print(f"  - {file}")
        sys.exit(1)

    print("\033[32mAll files found\033[0m")

    # Ensure modules directory exists for backups
    os.makedirs("../src/modules", exist_ok=True)

    total_orig_size = 0
    total_proc_size = 0
    total_orig_lines = 0
    total_proc_lines = 0

    print("\033[33mProcessing files...\033[0m")

    for src_file in files:
        file_name = os.path.basename(src_file)
        dst_file = src_file.replace('../src/', '../www/')

        print(f"  \033[36m{file_name}\033[0m")

        # Create backup if destination exists
        if os.path.exists(dst_file):
            backup_name = f"{file_name}.backup_{datetime.now().strftime('%Y%m%d_%H%m%S')}"
            backup_path = os.path.join("../src/modules", backup_name)
            shutil.copy2(dst_file, backup_path)
            print(f"    \033[33mBackup: {backup_path}\033[0m")

        # Read source file
        with open(src_file, 'r', encoding='utf-8') as f:
            orig_content = f.read()

        # Process content
        if args.no_minify:
            proc_content = orig_content
        else:
            proc_content = remove_comments(orig_content)

        # Calculate statistics
        orig_size = len(orig_content.encode('utf-8'))
        proc_size = len(proc_content.encode('utf-8'))
        orig_lines = len(orig_content.splitlines())
        proc_lines = len(proc_content.splitlines())

        total_orig_size += orig_size
        total_proc_size += proc_size
        total_orig_lines += orig_lines
        total_proc_lines += proc_lines

        if not args.no_minify:
            savings = 0
            if orig_size > 0:
                savings = round((1 - proc_size / orig_size) * 100, 1)

            line_reduction = 0
            if orig_lines > 0:
                line_reduction = round((1 - proc_lines / orig_lines) * 100, 1)

            orig_kb = round(orig_size / 1024, 1)
            proc_kb = round(proc_size / 1024, 1)
            print(f"    \033[37mSize: {orig_kb}KB -> {proc_kb}KB ({savings}%)\033[0m")
            print(f"    \033[90mLines: {orig_lines} -> {proc_lines} ({line_reduction}%)\033[0m")
        else:
            orig_kb = round(orig_size / 1024, 1)
            print(f"    \033[37mCopied: {orig_kb}KB, {orig_lines} lines\033[0m")

        # Ensure destination directory exists
        os.makedirs(os.path.dirname(dst_file), exist_ok=True)

        # Write processed content
        with open(dst_file, 'w', encoding='utf-8') as f:
            f.write(proc_content)

    print("\n\033[32mComplete!\033[0m")

    # Calculate totals
    orig_kb = round(total_orig_size / 1024, 1)
    proc_kb = round(total_proc_size / 1024, 1)

    print("\033[33mTotals:\033[0m")
    print(f"  \033[90mOriginal: {orig_kb} KB\033[0m")
    print(f"  \033[32mFinal: {proc_kb} KB\033[0m")

    if not args.no_minify:
        saved_kb = round((total_orig_size - total_proc_size) / 1024, 1)
        saved_pct = 0
        if total_orig_size > 0:
            saved_pct = round((1 - total_proc_size / total_orig_size) * 100, 1)

        lines_pct = 0
        if total_orig_lines > 0:
            lines_pct = round((1 - total_proc_lines / total_orig_lines) * 100, 1)

        print(f"  \033[32mSaved: {saved_pct}% ({saved_kb} KB)\033[0m")
        print(f"  \033[36mLines: {total_orig_lines} -> {total_proc_lines} ({lines_pct}%)\033[0m")

    print(f"\n\033[90mBackups: ../src/modules/\033[0m")
    print("\033[32mUTF-8 preserved\033[0m")

    print("\n\033[90mUse: python3 build_js.py [--no-minify]\033[0m")

if __name__ == "__main__":
    main()
