#!/usr/bin/env python3
"""Script para corrigir automaticamente problemas comuns do flake8"""

import os
import re

def fix_file(filepath):
    """Corrige problemas comuns em um arquivo Python"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Remove trailing whitespace
    lines = content.split('\n')
    lines = [line.rstrip() for line in lines]
    content = '\n'.join(lines)
    
    # Remove blank lines at end (W391)
    content = content.rstrip('\n')
    
    # Add newline at end (W292)
    if content and not content.endswith('\n'):
        content += '\n'
    
    # Fix E302: Add blank lines before class/function definitions
    # This is complex, so we'll do it manually for specific cases
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed: {filepath}")
        return True
    return False

def main():
    """Processa todos os arquivos Python em app/"""
    python_files = []
    for root, dirs, files in os.walk('app'):
        # Skip __pycache__
        if '__pycache__' in root:
            continue
        for file in files:
            if file.endswith('.py'):
                python_files.append(os.path.join(root, file))
    
    fixed_count = 0
    for filepath in python_files:
        if fix_file(filepath):
            fixed_count += 1
    
    print(f"\nFixed {fixed_count} files")

if __name__ == '__main__':
    main()

