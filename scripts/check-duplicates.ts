#!/usr/bin/env tsx

/**
 * 代码重复检测脚本
 * 自动检测项目中的重复代码模式，帮助维护代码质量
 */

import { execSync } from 'child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'

interface DuplicatePattern {
  pattern: string
  files: string[]
  lines: number
  hash: string
}

interface DuplicateReport {
  totalFiles: number
  duplicatePatterns: DuplicatePattern[]
  summary: {
    totalDuplicates: number
    totalLinesAffected: number
    severityHigh: number
    severityMedium: number
    severityLow: number
  }
}

class DuplicateDetector {
  private readonly projectRoot: string
  private readonly excludePatterns: string[] = [
    'node_modules',
    '.git',
    'target',
    'dist',
    'build',
    '.cache',
    'coverage',
    '.next',
    '.nuxt',
    '.output'
  ]

  private readonly includeExtensions: string[] = [
    '.ts', '.tsx', '.js', '.jsx', '.rs', '.json', '.yaml', '.yml'
  ]

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
  }

  /**
   * 检测环境检测代码模式
   */
  private detectEnvironmentChecks(): DuplicatePattern[] {
    const patterns: DuplicatePattern[] = []
    
    // 检查遗留的环境检测代码
    const envCheckPattern = /typeof window !== 'undefined' && '__TAURI__' in window/g
    const files = this.findFilesWithPattern(envCheckPattern)
    
    if (files.length > 1) {
      patterns.push({
        pattern: 'Environment detection code (isInTauri)',
        files,
        lines: files.length,
        hash: this.generateHash('env-check')
      })
    }

    return patterns
  }

  /**
   * 检测重复的导入语句
   */
  private detectDuplicateImports(): DuplicatePattern[] {
    const patterns: DuplicatePattern[] = []
    const importMap = new Map<string, string[]>()

    const files = this.getAllSourceFiles()
    
    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf-8')
        const imports = content.match(/^import.*from.*$/gm) || []
        
        for (const importLine of imports) {
          const normalized = importLine.trim()
          if (!importMap.has(normalized)) {
            importMap.set(normalized, [])
          }
          importMap.get(normalized)!.push(file)
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    // Find imports that appear in multiple files
    for (const [importLine, fileList] of importMap.entries()) {
      if (fileList.length > 3) { // Only report if appears in 4+ files
        patterns.push({
          pattern: `Duplicate import: ${importLine}`,
          files: fileList,
          lines: fileList.length,
          hash: this.generateHash(importLine)
        })
      }
    }

    return patterns
  }

  /**
   * 检测重复的类型定义
   */
  private detectDuplicateTypes(): DuplicatePattern[] {
    const patterns: DuplicatePattern[] = []
    const typeMap = new Map<string, string[]>()

    const files = this.getAllSourceFiles().filter(f => f.endsWith('.ts') || f.endsWith('.tsx'))
    
    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf-8')
        const types = content.match(/^(export\s+)?(interface|type|enum)\s+\w+/gm) || []
        
        for (const typeLine of types) {
          const normalized = typeLine.replace(/^export\s+/, '').trim()
          if (!typeMap.has(normalized)) {
            typeMap.set(normalized, [])
          }
          typeMap.get(normalized)!.push(file)
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    // Find types that appear in multiple files
    for (const [typeLine, fileList] of typeMap.entries()) {
      if (fileList.length > 1) {
        patterns.push({
          pattern: `Duplicate type definition: ${typeLine}`,
          files: fileList,
          lines: fileList.length,
          hash: this.generateHash(typeLine)
        })
      }
    }

    return patterns
  }

  /**
   * 检测重复的配置文件内容
   */
  private detectDuplicateConfigs(): DuplicatePattern[] {
    const patterns: DuplicatePattern[] = []
    const configFiles = this.getAllSourceFiles().filter(f => 
      f.includes('config') || f.endsWith('.json') || f.endsWith('.yml') || f.endsWith('.yaml')
    )

    const contentMap = new Map<string, string[]>()

    for (const file of configFiles) {
      try {
        const content = readFileSync(file, 'utf-8')
        const hash = this.generateHash(content)
        
        if (!contentMap.has(hash)) {
          contentMap.set(hash, [])
        }
        contentMap.get(hash)!.push(file)
      } catch (error) {
        // Skip files that can't be read
      }
    }

    // Find identical config files
    for (const [hash, fileList] of contentMap.entries()) {
      if (fileList.length > 1) {
        patterns.push({
          pattern: 'Identical configuration files',
          files: fileList,
          lines: fileList.length,
          hash
        })
      }
    }

    return patterns
  }

  /**
   * 查找包含特定模式的文件
   */
  private findFilesWithPattern(pattern: RegExp): string[] {
    const files: string[] = []
    const sourceFiles = this.getAllSourceFiles()

    for (const file of sourceFiles) {
      try {
        const content = readFileSync(file, 'utf-8')
        if (pattern.test(content)) {
          files.push(file)
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    return files
  }

  /**
   * 获取所有源文件
   */
  private getAllSourceFiles(): string[] {
    const files: string[] = []
    
    const traverse = (dir: string): void => {
      try {
        const entries = readdirSync(dir)
        
        for (const entry of entries) {
          const fullPath = join(dir, entry)
          
          if (this.excludePatterns.some(pattern => fullPath.includes(pattern))) {
            continue
          }
          
          const stat = statSync(fullPath)
          
          if (stat.isDirectory()) {
            traverse(fullPath)
          } else if (this.includeExtensions.some(ext => fullPath.endsWith(ext))) {
            files.push(fullPath)
          }
        }
      } catch (error) {
        // Skip directories that can't be read
      }
    }

    traverse(this.projectRoot)
    return files
  }

  /**
   * 生成内容哈希
   */
  private generateHash(content: string): string {
    return createHash('md5').update(content).digest('hex').substring(0, 8)
  }

  /**
   * 执行完整的重复检测
   */
  public detect(): DuplicateReport {
    console.log('🔍 Starting duplicate code detection...')
    
    const allPatterns: DuplicatePattern[] = [
      ...this.detectEnvironmentChecks(),
      ...this.detectDuplicateImports(),
      ...this.detectDuplicateTypes(),
      ...this.detectDuplicateConfigs(),
    ]

    const totalFiles = this.getAllSourceFiles().length
    const totalLinesAffected = allPatterns.reduce((sum, p) => sum + p.lines, 0)

    // Classify severity
    let severityHigh = 0
    let severityMedium = 0
    let severityLow = 0

    for (const pattern of allPatterns) {
      if (pattern.files.length >= 10) {
        severityHigh++
      } else if (pattern.files.length >= 5) {
        severityMedium++
      } else {
        severityLow++
      }
    }

    return {
      totalFiles,
      duplicatePatterns: allPatterns,
      summary: {
        totalDuplicates: allPatterns.length,
        totalLinesAffected,
        severityHigh,
        severityMedium,
        severityLow
      }
    }
  }

  /**
   * 生成报告
   */
  public generateReport(report: DuplicateReport): string {
    let output = '\n🎯 Duplicate Code Detection Report\n'
    output += '=' .repeat(50) + '\n\n'

    output += `📊 Summary:\n`
    output += `  • Total files scanned: ${report.totalFiles}\n`
    output += `  • Duplicate patterns found: ${report.summary.totalDuplicates}\n`
    output += `  • Total lines affected: ${report.summary.totalLinesAffected}\n`
    output += `  • High severity (10+ occurrences): ${report.summary.severityHigh}\n`
    output += `  • Medium severity (5-9 occurrences): ${report.summary.severityMedium}\n`
    output += `  • Low severity (2-4 occurrences): ${report.summary.severityLow}\n\n`

    if (report.duplicatePatterns.length === 0) {
      output += '✅ No significant duplicate code patterns detected!\n\n'
      return output
    }

    output += '🔍 Detected Patterns:\n\n'

    for (const pattern of report.duplicatePatterns) {
      const severity = pattern.files.length >= 10 ? '🚨 HIGH' : 
                      pattern.files.length >= 5 ? '⚠️ MEDIUM' : 'ℹ️ LOW'
      
      output += `${severity} ${pattern.pattern} (${pattern.files.length} occurrences)\n`
      output += `  Hash: ${pattern.hash}\n`
      output += `  Files:\n`
      
      for (const file of pattern.files.slice(0, 10)) { // Show max 10 files
        output += `    • ${file.replace(this.projectRoot, '.')}\n`
      }
      
      if (pattern.files.length > 10) {
        output += `    • ... and ${pattern.files.length - 10} more files\n`
      }
      
      output += '\n'
    }

    return output
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const projectRoot = process.cwd()
  const detector = new DuplicateDetector(projectRoot)
  
  const report = detector.detect()
  const reportText = detector.generateReport(report)
  
  console.log(reportText)
  
  // Exit with error code if duplicates found
  if (report.summary.totalDuplicates > 0) {
    process.exit(1)
  }
}
