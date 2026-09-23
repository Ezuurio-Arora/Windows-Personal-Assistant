import { executeCommand } from '../server/tools/shell.js';
import { fetchTopicImage } from '../server/tools/images.js';
import path from 'path';
import os from 'os';
import fs from 'fs';

async function testWord() {
  console.log('Fetching test image for Word...');
  const imgPath = await fetchTopicImage('artificial intelligence technology');
  console.log('Image fetched at:', imgPath);

  const outputPath = path.join(os.tmpdir(), 'test_executive_report.docx');
  const escImg = (imgPath || '').replace(/'/g, "''");
  const escOut = outputPath.replace(/'/g, "''");

  const psScript = `
    $ErrorActionPreference = 'Stop'
    Add-Type -AssemblyName System.Drawing
    try {
      $word = New-Object -ComObject Word.Application
      $word.Visible = $false
      $doc = $word.Documents.Add()
      $sel = $word.Selection

      # Configure Page Margins (1 inch = 72 pt)
      $doc.PageSetup.TopMargin = 54
      $doc.PageSetup.BottomMargin = 54
      $doc.PageSetup.LeftMargin = 54
      $doc.PageSetup.RightMargin = 54

      # Color Constants
      $cNavy = 0x8A3A1E     # BGR for #1E3A8A Dark Navy
      $cSky = 0xE9A50E      # BGR for #0EA5E9 Sky Blue
      $cTextDark = 0x0F172A # BGR for Slate 900
      $cTextMuted = 0x64748B# BGR for Slate 500

      # ----------------------------------------------------
      # Header Banner / Title Block
      # ----------------------------------------------------
      $sel.Font.Name = 'Segoe UI'
      $sel.Font.Size = 24
      $sel.Font.Bold = 1
      $sel.Font.Color = $cNavy
      $sel.TypeText('Artificial Intelligence Strategic Assessment')
      $sel.TypeParagraph()

      $sel.Font.Size = 11
      $sel.Font.Bold = 0
      $sel.Font.Italic = 1
      $sel.Font.Color = $cTextMuted
      $sel.TypeText('Executive Intelligence Report | Prepared by Autonomous Personal Assistant | ' + (Get-Date -Format 'MMMM yyyy'))
      $sel.TypeParagraph()
      $sel.TypeParagraph()
      $sel.Font.Italic = 0

      # ----------------------------------------------------
      # Callout Box (Single Cell Table for Executive Summary)
      # ----------------------------------------------------
      $calloutTable = $doc.Tables.Add($sel.Range, 1, 1)
      $calloutTable.Borders.Enable = $true
      $calloutTable.Borders.OutsideColor = $cSky
      $calloutTable.Borders.OutsideLineWidth = 12 # 1.5 pt
      $calloutCell = $calloutTable.Cell(1, 1)
      $calloutCell.Shading.BackgroundPatternColor = 0xF8FAFC # Light Slate
      $calloutCell.Range.Font.Name = 'Segoe UI'
      $calloutCell.Range.Font.Size = 11
      $calloutCell.Range.Font.Italic = 1
      $calloutCell.Range.Font.Color = $cTextDark
      $calloutCell.Range.Text = "EXECUTIVE SUMMARY: Generative and agentic AI architectures are accelerating enterprise automation, reducing multi-step workflow latency from hours to seconds while demanding rigorous multi-modal tool safety standards."
      
      # Move cursor past table
      $doc.Characters.Last.Select()
      $sel = $word.Selection
      $sel.TypeParagraph()

      # ----------------------------------------------------
      # Section 1: Detailed Findings
      # ----------------------------------------------------
      $sel.Font.Size = 16
      $sel.Font.Bold = 1
      $sel.Font.Color = $cNavy
      $sel.TypeText('1. Architectural Paradigm Shifts')
      $sel.TypeParagraph()

      $sel.Font.Size = 11
      $sel.Font.Bold = 0
      $sel.Font.Color = $cTextDark
      $sel.TypeText("The transition from single-turn retrieval systems to autonomous multi-agent swarms represents a generational leap in computing. By orchestrating specialized worker agents across distinct domains—such as native OS automation, data extraction, and visual document composition—tasks are resolved concurrently rather than sequentially.")
      $sel.TypeParagraph()
      $sel.TypeParagraph()

      # ----------------------------------------------------
      # Embedded Photo (if available)
      # ----------------------------------------------------
      if ('${escImg}' -ne '' -and (Test-Path '${escImg}')) {
        $shape = $sel.InlineShapes.AddPicture('${escImg}')
        $shape.Width = 420
        $shape.Height = 240
        $sel.TypeParagraph()
        $sel.Font.Size = 9
        $sel.Font.Italic = 1
        $sel.Font.Color = $cTextMuted
        $sel.ParagraphFormat.Alignment = 1 # Center
        $sel.TypeText('Figure 1: High-Performance Computing and Neural Network Acceleration')
        $sel.TypeParagraph()
        $sel.ParagraphFormat.Alignment = 0 # Left
        $sel.Font.Italic = 0
        $sel.TypeParagraph()
      }

      # ----------------------------------------------------
      # Section 2: Comparative Metrics Table
      # ----------------------------------------------------
      $sel.Font.Size = 16
      $sel.Font.Bold = 1
      $sel.Font.Color = $cNavy
      $sel.TypeText('2. Performance & Benchmark Evaluation')
      $sel.TypeParagraph()

      $table = $doc.Tables.Add($sel.Range, 4, 3)
      $table.Borders.Enable = $true
      $table.Borders.OutsideColor = 0xCBD5E1
      $table.Borders.InsideColor = 0xE2E8F0

      # Header Row
      $headers = @('Evaluation Metric', 'Legacy Systems', 'Agentic Personal Assistant')
      for ($c = 1; $c -le 3; $c++) {
        $cell = $table.Cell(1, $c)
        $cell.Range.Text = $headers[$c - 1]
        $cell.Range.Font.Name = 'Segoe UI'
        $cell.Range.Font.Bold = 1
        $cell.Range.Font.Size = 10
        $cell.Range.Font.Color = 0xFFFFFF
        $cell.Shading.BackgroundPatternColor = $cNavy
      }

      # Row Data
      $rows = @(
        @('Workflow Latency', '15 - 45 Minutes', 'Sub-3 Seconds'),
        @('Native Windows Integration', 'None (Browser Only)', 'Full COM & GUI Automation'),
        @('Multi-Tool Concurrency', 'Sequential Blocking', 'Parallel Sub-Agent Execution')
      )
      for ($r = 0; $r -lt $rows.Length; $r++) {
        for ($c = 0; $c -lt 3; $c++) {
          $cell = $table.Cell($r + 2, $c + 1)
          $cell.Range.Text = $rows[$r][$c]
          $cell.Range.Font.Name = 'Segoe UI'
          $cell.Range.Font.Size = 10
          $cell.Range.Font.Color = $cTextDark
          if ($r % 2 -eq 1) {
            $cell.Shading.BackgroundPatternColor = 0xF1F5F9
          }
        }
      }

      $doc.Characters.Last.Select()
      $sel = $word.Selection
      $sel.TypeParagraph()

      # Save Document
      $doc.SaveAs('${escOut}')
      $doc.Close([ref]0)
      $word.Quit()

      [PSCustomObject]@{
        success = $true
        file = '${escOut}'
      } | ConvertTo-Json
    } catch {
      if ($word) {
        try { $doc.Close([ref]0) } catch {}
        try { $word.Quit() } catch {}
      }
      [PSCustomObject]@{
        success = $false
        line = $_.InvocationInfo.ScriptLineNumber
        error = $_.Exception.Message
      } | ConvertTo-Json
    }
  `;

  console.log('Testing Word COM automation with tables and photos...');
  const res = await executeCommand(psScript, 'powershell', 35000);
  console.log('Word Result:', res.stdout || res.stderr);
  try {
    const stat = fs.statSync(outputPath);
    console.log('Word document generated, size:', stat.size);
    fs.unlinkSync(outputPath);
  } catch (e) {
    console.log('Error verifying file:', e.message);
  }
}

testWord();
