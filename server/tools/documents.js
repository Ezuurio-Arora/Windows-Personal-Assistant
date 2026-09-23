import { executeCommand } from './shell.js';
import { fetchTopicImage } from './images.js';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Determine primary save directory (Desktop or OneDrive Desktop)
 */
function getDesktopDirectory() {
  const userHome = os.homedir();
  const onedriveDesktop = path.join(userHome, 'OneDrive', 'Desktop');
  const standardDesktop = path.join(userHome, 'Desktop');
  return fs.existsSync(onedriveDesktop) ? onedriveDesktop : standardDesktop;
}

/**
 * Color themes for presentations and documents
 */
const THEME_PALETTES = {
  modern_dark: {
    bgR: 15, bgG: 23, bgB: 42,          // #0F172A Slate 900
    cardR: 30, cardG: 41, cardB: 59,     // #1E293B Slate 800
    accentR: 14, accentG: 165, accentB: 233, // #0EA5E9 Sky Blue
    accentGlowR: 168, accentGlowG: 85, accentGlowB: 247, // #A855F7 Purple
    textWhiteR: 248, textWhiteG: 250, textWhiteB: 252, // #F8FAFC
    textMutedR: 203, textMutedG: 213, textMutedB: 225  // #CBD5E1
  },
  emerald_nature: {
    bgR: 6, bgG: 40, bgB: 30,           // #06281E Dark Forest Green
    cardR: 10, cardG: 60, cardB: 45,     // #0A3C2D Deep Emerald Card
    accentR: 16, accentG: 185, accentB: 129, // #10B981 Mint / Emerald Accent
    accentGlowR: 52, accentGlowG: 211, accentGlowB: 153, // #34D399
    textWhiteR: 240, textWhiteG: 253, textWhiteB: 244, // #F0FDF4
    textMutedR: 167, textMutedG: 243, textMutedB: 208  // #A7F3D0
  },
  corporate_blue: {
    bgR: 15, bgG: 39, bgB: 68,          // #0F2744 Deep Navy
    cardR: 24, cardG: 55, cardB: 93,     // #18375D Navy Card
    accentR: 37, accentG: 99, accentB: 235,  // #2563EB Royal Blue
    accentGlowR: 96, accentGlowG: 165, accentGlowB: 250, // #60A5FA
    textWhiteR: 255, textWhiteG: 255, textWhiteB: 255,
    textMutedR: 226, textMutedG: 232, textMutedB: 240
  },
  clean_light: {
    bgR: 248, bgG: 250, bgB: 252,       // #F8FAFC Off-white
    cardR: 255, cardG: 255, cardB: 255,  // #FFFFFF Pure White
    accentR: 79, accentG: 70, accentB: 229,  // #4F46E5 Indigo
    accentGlowR: 99, accentGlowG: 102, accentGlowB: 241,
    textWhiteR: 15, textWhiteG: 23, textWhiteB: 42,   // Dark text for light mode
    textMutedR: 71, textMutedG: 85, textMutedB: 105   // Slate 600
  }
};

/**
 * Creates an executive, professionally formatted Microsoft PowerPoint presentation (.pptx).
 * Features 16:9 widescreen, custom color themes, automated topic photography, card containers,
 * fixed bullet formatting, and high-impact key takeaway banners.
 */
export async function createPowerpointPresentation(options = {}) {
  const {
    title = 'Executive Presentation',
    subtitle = 'Strategic Overview & Analysis',
    theme = 'modern_dark',
    slides = [],
    filename,
    openInPowerpoint = true
  } = options;

  const desktopDir = getDesktopDirectory();
  const rawFilename = (filename || `${title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 35)}.pptx`)
    .replace(/\.pptx$/i, '') + '.pptx';
  const targetPath = path.isAbsolute(rawFilename) ? rawFilename : path.join(desktopDir, rawFilename);
  const safeFilename = path.basename(targetPath);

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  const pal = THEME_PALETTES[theme] || THEME_PALETTES.modern_dark;

  // Pre-fetch relevant high-resolution photos for slides that have image keywords or titles
  const slidesWithImages = await Promise.all(
    (slides || []).map(async (slide) => {
      const searchKey = slide.imageKeyword || slide.title;
      let localImgPath = null;
      if (searchKey) {
        try {
          localImgPath = await fetchTopicImage(searchKey);
        } catch (e) {
          localImgPath = null;
        }
      }
      return { ...slide, localImgPath };
    })
  );

  const escTitle = title.replace(/'/g, "''");
  const escSubtitle = subtitle.replace(/'/g, "''");
  const escTarget = targetPath.replace(/'/g, "''");

  // Build PowerPoint slide creation PowerShell script
  const slideCreationScripts = slidesWithImages.map((slide, idx) => {
    const sIdx = idx + 2;
    const sTitle = (slide.title || `Slide ${sIdx}`).replace(/'/g, "''");
    const sTakeaway = (slide.keyTakeaway || slide.highlight || '').replace(/'/g, "''");
    const hasImage = !!slide.localImgPath && fs.existsSync(slide.localImgPath);
    const escImgPath = hasImage ? slide.localImgPath.replace(/'/g, "''") : '';

    // Format bullet points cleanly: each bullet with bold concept lead-in and text
    const bulletList = (slide.bullets || []).map((b) => {
      let bStr = typeof b === 'string' ? b : JSON.stringify(b);
      // Remove any duplicate bullet characters if model produced them
      bStr = bStr.replace(/^[\s•\-\*]+/, '').trim();
      return bStr.replace(/'/g, "''");
    });

    const bulletsFormattedText = bulletList.map(b => `•  ${b}`).join('\n\n');

    // Layout coordinates: Split if image present, else full card width
    const contentWidth = hasImage ? 490 : 840;
    const textBoxWidth = hasImage ? 450 : 800;

    return `
      # --- Slide ${sIdx}: ${sTitle} ---
      $slide = $pres.Slides.Add(${sIdx}, 12) # 12 = ppLayoutBlank
      $slide.FollowMasterBackground = [Microsoft.Office.Core.MsoTriState]::msoFalse
      $slide.Background.Fill.Solid()
      $slide.Background.Fill.ForeColor.RGB = $cBg

      # Slide Title
      $titleBox = $slide.Shapes.AddTextbox(1, 60, 35, 840, 50)
      $titleBox.TextFrame.WordWrap = [Microsoft.Office.Core.MsoTriState]::msoTrue
      $titleBox.TextFrame.TextRange.Text = '${sTitle}'
      $titleBox.TextFrame.TextRange.Font.Name = 'Segoe UI'
      $titleBox.TextFrame.TextRange.Font.Size = 24
      $titleBox.TextFrame.TextRange.Font.Bold = 1
      $titleBox.TextFrame.TextRange.Font.Color.RGB = $cTextWhite

      # Main Content Card
      $card = $slide.Shapes.AddShape(1, 60, 95, ${contentWidth}, 320)
      $card.Fill.Solid()
      $card.Fill.ForeColor.RGB = $cCard
      $card.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse

      # Bullet Text Box inside Content Card
      $textBox = $slide.Shapes.AddTextbox(1, 80, 110, ${textBoxWidth}, 290)
      $tf = $textBox.TextFrame
      $tf.WordWrap = [Microsoft.Office.Core.MsoTriState]::msoTrue
      $tf.TextRange.Text = @'
${bulletsFormattedText}
'@
      $tf.TextRange.Font.Name = 'Segoe UI'
      $tf.TextRange.Font.Size = 13
      $tf.TextRange.Font.Color.RGB = $cTextMuted

      ${hasImage ? `
      # Embedded Photo on Right Column
      if (Test-Path '${escImgPath}') {
        $pic = $slide.Shapes.AddPicture('${escImgPath}', 0, -1, 575, 95, 325, 320)
        $pic.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoTrue
        $pic.Line.ForeColor.RGB = $cAccent
        $pic.Line.Weight = 2
      }
      ` : ''}

      ${sTakeaway ? `
      # Bottom Highlight / Key Takeaway Banner
      $takeaway = $slide.Shapes.AddShape(1, 60, 430, 840, 60)
      $takeaway.Fill.Solid()
      $takeaway.Fill.ForeColor.RGB = $cAccent
      $takeaway.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
      $takeaway.TextFrame.WordWrap = [Microsoft.Office.Core.MsoTriState]::msoTrue
      $takeaway.TextFrame.TextRange.Text = 'KEY TAKEAWAY: ${sTakeaway}'
      $takeaway.TextFrame.TextRange.Font.Name = 'Segoe UI'
      $takeaway.TextFrame.TextRange.Font.Size = 12
      $takeaway.TextFrame.TextRange.Font.Bold = 1
      $takeaway.TextFrame.TextRange.Font.Color.RGB = $cTextWhite
      ` : ''}
    `;
  }).join('\n');

  const psScript = `
    $ErrorActionPreference = 'Stop'
    Add-Type -AssemblyName System.Drawing

    try {
      $ppt = New-Object -ComObject PowerPoint.Application
      $pres = $ppt.Presentations.Add([Microsoft.Office.Core.MsoTriState]::msoFalse)

      # 16:9 Widescreen Setup (960 x 540 pt)
      $pres.PageSetup.SlideWidth = 960
      $pres.PageSetup.SlideHeight = 540

      function Get-OleColor($r, $g, $b) {
        return [System.Drawing.ColorTranslator]::ToOle([System.Drawing.Color]::FromArgb($r, $g, $b))
      }

      $cBg = Get-OleColor ${pal.bgR} ${pal.bgG} ${pal.bgB}
      $cCard = Get-OleColor ${pal.cardR} ${pal.cardG} ${pal.cardB}
      $cAccent = Get-OleColor ${pal.accentR} ${pal.accentG} ${pal.accentB}
      $cAccentGlow = Get-OleColor ${pal.accentGlowR} ${pal.accentGlowG} ${pal.accentGlowB}
      $cTextWhite = Get-OleColor ${pal.textWhiteR} ${pal.textWhiteG} ${pal.textWhiteB}
      $cTextMuted = Get-OleColor ${pal.textMutedR} ${pal.textMutedG} ${pal.textMutedB}

      # ----------------------------------------------------
      # Slide 1: Hero Cover Slide
      # ----------------------------------------------------
      $slide1 = $pres.Slides.Add(1, 12) # 12 = ppLayoutBlank
      $slide1.FollowMasterBackground = [Microsoft.Office.Core.MsoTriState]::msoFalse
      $slide1.Background.Fill.Solid()
      $slide1.Background.Fill.ForeColor.RGB = $cBg

      # Hero card backdrop
      $heroCard = $slide1.Shapes.AddShape(1, 80, 65, 800, 410)
      $heroCard.Fill.Solid()
      $heroCard.Fill.ForeColor.RGB = $cCard
      $heroCard.Line.ForeColor.RGB = $cAccent
      $heroCard.Line.Weight = 2

      # Category pill badge
      $badge = $slide1.Shapes.AddShape(1, 130, 115, 230, 36)
      $badge.Fill.Solid()
      $badge.Fill.ForeColor.RGB = $cAccent
      $badge.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
      $badge.TextFrame.TextRange.Text = 'EXECUTIVE BRIEFING'
      $badge.TextFrame.TextRange.Font.Name = 'Segoe UI'
      $badge.TextFrame.TextRange.Font.Size = 12
      $badge.TextFrame.TextRange.Font.Bold = 1
      $badge.TextFrame.TextRange.Font.Color.RGB = $cTextWhite

      # Main Presentation Title
      $titleBox = $slide1.Shapes.AddTextbox(1, 130, 175, 700, 120)
      $titleBox.TextFrame.WordWrap = [Microsoft.Office.Core.MsoTriState]::msoTrue
      $titleBox.TextFrame.TextRange.Text = '${escTitle}'
      $titleBox.TextFrame.TextRange.Font.Name = 'Segoe UI'
      $titleBox.TextFrame.TextRange.Font.Size = 34
      $titleBox.TextFrame.TextRange.Font.Bold = 1
      $titleBox.TextFrame.TextRange.Font.Color.RGB = $cTextWhite

      # Subtitle
      $subBox = $slide1.Shapes.AddTextbox(1, 130, 305, 700, 60)
      $subBox.TextFrame.WordWrap = [Microsoft.Office.Core.MsoTriState]::msoTrue
      $subBox.TextFrame.TextRange.Text = '${escSubtitle}'
      $subBox.TextFrame.TextRange.Font.Name = 'Segoe UI'
      $subBox.TextFrame.TextRange.Font.Size = 16
      $subBox.TextFrame.TextRange.Font.Color.RGB = $cTextMuted

      # Metadata Footer
      $metaBox = $slide1.Shapes.AddTextbox(1, 130, 395, 700, 40)
      $metaBox.TextFrame.TextRange.Text = 'Created by Autonomous Personal Assistant | ' + (Get-Date -Format 'MMMM yyyy')
      $metaBox.TextFrame.TextRange.Font.Name = 'Segoe UI'
      $metaBox.TextFrame.TextRange.Font.Size = 11
      $metaBox.TextFrame.TextRange.Font.Color.RGB = $cTextMuted

      # Content Slides
      ${slideCreationScripts}

      # Save presentation
      $savePath = '${escTarget}'
      $pres.SaveAs($savePath)

      if (${openInPowerpoint ? '$true' : '$false'}) {
        $ppt.Visible = [Microsoft.Office.Core.MsoTriState]::msoTrue
        $wsh = New-Object -ComObject WScript.Shell
        $wsh.AppActivate($ppt.Caption) | Out-Null
      } else {
        $pres.Close()
        $ppt.Quit()
      }

      [PSCustomObject]@{
        success = $true
        filePath = $savePath
        filename = '${safeFilename}'
        slideCount = ${1 + slidesWithImages.length}
        opened = ${openInPowerpoint ? '$true' : '$false'}
        message = 'Professional Microsoft PowerPoint presentation generated successfully.'
      } | ConvertTo-Json
    } catch {
      if ($ppt) {
        try { $pres.Close() } catch {}
        try { $ppt.Quit() } catch {}
      }
      [PSCustomObject]@{
        success = $false
        line = $_.InvocationInfo.ScriptLineNumber
        error = $_.Exception.Message
      } | ConvertTo-Json
    }
  `;

  const result = await executeCommand(psScript, 'powershell', 40000);
  if (result.exitCode === 0 && result.stdout) {
    try {
      const parsed = JSON.parse(result.stdout);
      return parsed;
    } catch {}
  }

  return { success: false, error: result.stderr || 'Failed to create professional PowerPoint presentation' };
}

/**
 * Creates an executive Microsoft Word document (.docx) with cover styling,
 * callout summary box, styled section headings, embedded photos, and formatted data tables.
 */
export async function createWordDocument(options = {}) {
  const {
    title = 'Executive Intelligence Report',
    subtitle = 'Comprehensive Analysis & Findings',
    summary = '',
    sections = [],
    bullets = [],
    content = '',
    imageKeyword,
    tableData,
    filename,
    openInWord = true
  } = options;

  const desktopDir = getDesktopDirectory();
  const rawFilename = (filename || `${title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 35)}.docx`)
    .replace(/\.docx$/i, '') + '.docx';
  const targetPath = path.isAbsolute(rawFilename) ? rawFilename : path.join(desktopDir, rawFilename);
  const safeFilename = path.basename(targetPath);

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  // Pre-fetch topic image if requested
  let localImgPath = null;
  const searchKey = imageKeyword || title;
  if (searchKey) {
    try {
      localImgPath = await fetchTopicImage(searchKey);
    } catch (e) {
      localImgPath = null;
    }
  }

  const escTitle = title.replace(/'/g, "''");
  const escSubtitle = subtitle.replace(/'/g, "''");
  const escSummary = (summary || content.substring(0, 250) || 'Comprehensive assessment compiled by Autonomous Personal Assistant.').replace(/'/g, "''");
  const escImg = (localImgPath || '').replace(/'/g, "''");
  const escTarget = targetPath.replace(/'/g, "''");

  // Build section contents
  const sectionsScript = (sections || []).map((sec, sIdx) => {
    const sHead = (sec.heading || `Section ${sIdx + 1}`).replace(/'/g, "''");
    const sBody = (sec.content || '').replace(/'/g, "''");
    const sBullets = (sec.bullets || []).map(b => `•  ${b.replace(/'/g, "''")}`).join('\n');

    return `
      $sel.Font.Name = 'Segoe UI'
      $sel.Font.Size = 16
      $sel.Font.Bold = 1
      $sel.Font.Color = 0x8A3A1E # Dark Navy
      $sel.TypeText('${sHead}')
      $sel.TypeParagraph()

      $sel.Font.Size = 11
      $sel.Font.Bold = 0
      $sel.Font.Color = 0x0F172A # Slate 900
      $sel.TypeText('${sBody}')
      $sel.TypeParagraph()
      $sel.TypeParagraph()

      ${sBullets ? `
      $sel.Font.Size = 11
      $sel.TypeText(@'
${sBullets}
'@)
      $sel.TypeParagraph()
      $sel.TypeParagraph()
      ` : ''}
    `;
  }).join('\n');

  const psScript = `
    $ErrorActionPreference = 'Stop'
    Add-Type -AssemblyName System.Drawing

    try {
      $word = New-Object -ComObject Word.Application
      $word.Visible = ${openInWord ? '$true' : '$false'}
      $doc = $word.Documents.Add()
      $sel = $word.Selection

      # Margins (54 pt = 0.75 in)
      $doc.PageSetup.TopMargin = 54
      $doc.PageSetup.BottomMargin = 54
      $doc.PageSetup.LeftMargin = 54
      $doc.PageSetup.RightMargin = 54

      $cNavy = 0x8A3A1E     # #1E3A8A Dark Navy BGR
      $cSky = 0xE9A50E      # #0EA5E9 Sky Blue BGR
      $cTextDark = 0x0F172A
      $cTextMuted = 0x64748B

      # ----------------------------------------------------
      # Document Title & Metadata
      # ----------------------------------------------------
      $sel.Font.Name = 'Segoe UI'
      $sel.Font.Size = 24
      $sel.Font.Bold = 1
      $sel.Font.Color = $cNavy
      $sel.TypeText('${escTitle}')
      $sel.TypeParagraph()

      $sel.Font.Size = 11
      $sel.Font.Bold = 0
      $sel.Font.Italic = 1
      $sel.Font.Color = $cTextMuted
      $sel.TypeText('${escSubtitle} | Autonomous Personal Assistant | ' + (Get-Date -Format 'MMMM yyyy'))
      $sel.TypeParagraph()
      $sel.TypeParagraph()
      $sel.Font.Italic = 0

      # ----------------------------------------------------
      # Executive Summary Callout Box
      # ----------------------------------------------------
      $calloutTable = $doc.Tables.Add($sel.Range, 1, 1)
      $calloutTable.Borders.Enable = $true
      $calloutTable.Borders.OutsideColor = $cSky
      $calloutTable.Borders.OutsideLineWidth = 12 # 1.5 pt
      $calloutCell = $calloutTable.Cell(1, 1)
      $calloutCell.Shading.BackgroundPatternColor = 0xF8FAFC
      $calloutCell.Range.Font.Name = 'Segoe UI'
      $calloutCell.Range.Font.Size = 11
      $calloutCell.Range.Font.Italic = 1
      $calloutCell.Range.Font.Color = $cTextDark
      $calloutCell.Range.Text = "EXECUTIVE SUMMARY: ${escSummary}"

      $doc.Characters.Last.Select()
      $sel = $word.Selection
      $sel.TypeParagraph()

      # ----------------------------------------------------
      # Inline Topic Image (if available)
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
        $sel.TypeText('Figure 1: Topic Overview and Visual Domain Reference')
        $sel.TypeParagraph()
        $sel.ParagraphFormat.Alignment = 0 # Left
        $sel.Font.Italic = 0
        $sel.TypeParagraph()
      }

      # ----------------------------------------------------
      # Sections
      # ----------------------------------------------------
      ${sectionsScript}

      ${content && !sections.length ? `
      $sel.Font.Name = 'Segoe UI'
      $sel.Font.Size = 11
      $sel.Font.Color = $cTextDark
      $sel.TypeText(@'
${content.replace(/'/g, "''")}
'@)
      $sel.TypeParagraph()
      ` : ''}

      # Save Document
      $savePath = '${escTarget}'
      if ($doc.PSObject.Methods['SaveAs2']) {
        $doc.SaveAs2([ref]$savePath, [ref]16)
      } else {
        $doc.SaveAs([ref]$savePath)
      }

      if (-not ${openInWord ? '$true' : '$false'}) {
        $doc.Close([ref]0)
        $word.Quit()
      } else {
        $wsh = New-Object -ComObject WScript.Shell
        $wsh.AppActivate($word.Caption) | Out-Null
      }

      [PSCustomObject]@{
        success = $true
        filePath = $savePath
        filename = '${safeFilename}'
        opened = ${openInWord ? '$true' : '$false'}
        message = 'Microsoft Word executive report created successfully.'
      } | ConvertTo-Json
    } catch {
      if ($word) {
        try { $doc.Close([ref]0) } catch {}
        try { $word.Quit() } catch {}
      }
      [PSCustomObject]@{
        success = $false
        error = $_.Exception.Message
      } | ConvertTo-Json
    }
  `;

  const result = await executeCommand(psScript, 'powershell', 35000);
  if (result.exitCode === 0 && result.stdout) {
    try {
      const parsed = JSON.parse(result.stdout);
      if (parsed.success) return parsed;
    } catch {}
  }

  return { success: false, error: result.stderr || 'Failed to create professional Word document' };
}

/**
 * Creates a formatted Microsoft Excel spreadsheet (.xlsx) with styled header rows,
 * auto-fit column widths, number formatting, borders, and calculated formula totals.
 */
export async function createExcelSpreadsheet(options = {}) {
  const {
    title = 'Financial Model & Performance',
    sheetName = 'Summary',
    headers = ['Item', 'Q1', 'Q2', 'Q3', 'Q4', 'Total'],
    rows = [],
    includeTotals = true,
    currencyColumns = [],
    percentColumns = [],
    filename,
    openInExcel = true
  } = options;

  const desktopDir = getDesktopDirectory();
  const rawFilename = (filename || `${title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 35)}.xlsx`)
    .replace(/\.xlsx$/i, '') + '.xlsx';
  const targetPath = path.isAbsolute(rawFilename) ? rawFilename : path.join(desktopDir, rawFilename);
  const safeFilename = path.basename(targetPath);

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  const escTarget = targetPath.replace(/'/g, "''");
  const escSheetName = (sheetName || 'Sheet1').replace(/'/g, "''");

  // Serialize headers and rows to JSON for safe injection into PowerShell
  const headersJson = JSON.stringify(headers);
  const rowsJson = JSON.stringify(rows);
  const curColsJson = JSON.stringify(currencyColumns || []);
  const pctColsJson = JSON.stringify(percentColumns || []);

  const psScript = `
    $ErrorActionPreference = 'Stop'
    Add-Type -AssemblyName System.Drawing

    try {
      $excel = New-Object -ComObject Excel.Application
      $excel.Visible = ${openInExcel ? '$true' : '$false'}
      $excel.DisplayAlerts = $false
      $wb = $excel.Workbooks.Add()
      $sheet = $wb.Sheets.Item(1)
      $sheet.Name = '${escSheetName}'

      function Get-OleColor($r, $g, $b) {
        return [System.Drawing.ColorTranslator]::ToOle([System.Drawing.Color]::FromArgb($r, $g, $b))
      }

      $cHeaderBg = Get-OleColor 30 58 138     # Dark Navy #1E3A8A
      $cHeaderText = Get-OleColor 255 255 255 # White
      $cTotalBg = Get-OleColor 241 245 249    # Slate 100

      $headers = ConvertFrom-Json @'
${headersJson}
'@

      $rows = ConvertFrom-Json @'
${rowsJson}
'@

      $curCols = ConvertFrom-Json @'
${curColsJson}
'@

      $pctCols = ConvertFrom-Json @'
${pctColsJson}
'@

      # Populate and style headers
      for ($i = 0; $i -lt $headers.Count; $i++) {
        $cell = $sheet.Cells.Item(1, $i + 1)
        $cell.Value2 = [string]$headers[$i]
        $cell.Font.Name = 'Segoe UI'
        $cell.Font.Bold = $true
        $cell.Font.Size = 11
        $cell.Font.Color = $cHeaderText
        $cell.Interior.Color = $cHeaderBg
      }

      # Populate rows with explicit type conversion
      for ($r = 0; $r -lt $rows.Count; $r++) {
        $rowNum = $r + 2
        $rowArr = $rows[$r]
        for ($c = 0; $c -lt $rowArr.Count; $c++) {
          $val = $rowArr[$c]
          $cell = $sheet.Cells.Item($rowNum, $c + 1)
          if ($val -is [int] -or $val -is [double] -or $val -is [long] -or $val -is [decimal]) {
            $cell.Value2 = [double]$val
          } else {
            # Try parsing numeric strings
            $parsedNum = 0.0
            if ([double]::TryParse([string]$val, [ref]$parsedNum)) {
              $cell.Value2 = $parsedNum
            } else {
              $cell.Value2 = [string]$val
            }
          }
          $cell.Font.Name = 'Segoe UI'
          $cell.Font.Size = 10
        }
      }

      $lastDataRow = $rows.Count + 1

      # Number formats for specific columns
      foreach ($colIdx in $curCols) {
        $colLetter = [char](65 + $colIdx)
        $sheet.Range("\${colLetter}2:\${colLetter}\$lastDataRow").NumberFormat = '$#,##0'
      }
      foreach ($colIdx in $pctCols) {
        $colLetter = [char](65 + $colIdx)
        $sheet.Range("\${colLetter}2:\${colLetter}\$lastDataRow").NumberFormat = '0.0%'
      }

      # Append Total row with formulas if requested
      if (${includeTotals ? '$true' : '$false'} -and $rows.Count -gt 0) {
        $totalRow = $lastDataRow + 1
        $sheet.Cells.Item($totalRow, 1).Value2 = 'Total / Summary'
        $sheet.Cells.Item($totalRow, 1).Font.Bold = $true

        for ($c = 2; $c -le $headers.Count; $c++) {
          $colLetter = [char](64 + $c)
          $sheet.Cells.Item($totalRow, $c).Formula = "=SUM(\${colLetter}2:\${colLetter}\$lastDataRow)"
          $sheet.Cells.Item($totalRow, $c).Font.Bold = $true
          $sheet.Cells.Item($totalRow, $c).Interior.Color = $cTotalBg
        }
        $sheet.Cells.Item($totalRow, 1).Interior.Color = $cTotalBg
      }

      # Auto-fit all columns
      $sheet.UsedRange.Columns.AutoFit() | Out-Null

      # Save workbook as .xlsx (51 = xlOpenXMLWorkbook)
      $savePath = '${escTarget}'
      $wb.SaveAs($savePath, 51)

      if (${openInExcel ? '$true' : '$false'}) {
        $excel.Visible = $true
        $wsh = New-Object -ComObject WScript.Shell
        $wsh.AppActivate($excel.Caption) | Out-Null
      } else {
        $wb.Close($false)
        $excel.Quit()
      }

      [PSCustomObject]@{
        success = $true
        filePath = $savePath
        filename = '${safeFilename}'
        rowCount = $rows.Count
        opened = ${openInExcel ? '$true' : '$false'}
        message = 'Microsoft Excel spreadsheet generated and formatted successfully.'
      } | ConvertTo-Json
    } catch {
      if ($excel) {
        try { $wb.Close($false) } catch {}
        try { $excel.Quit() } catch {}
      }
      [PSCustomObject]@{
        success = $false
        line = $_.InvocationInfo.ScriptLineNumber
        error = $_.Exception.Message
      } | ConvertTo-Json
    }
  `;

  const result = await executeCommand(psScript, 'powershell', 30000);
  if (result.exitCode === 0 && result.stdout) {
    try {
      const parsed = JSON.parse(result.stdout);
      if (parsed.success) return parsed;
    } catch {}
  }

  return { success: false, error: result.stderr || 'Failed to create professional Excel spreadsheet' };
}

/**
 * Universal document router: Creates any document (.pptx, .docx, .xlsx, .html, .md, .csv)
 * and dispatches to the corresponding native engine.
 */
export async function createDocument(options = {}) {
  const { type = 'docx', title = 'Document', content = '', filename, openInApp = true } = options;
  const lowerType = type.toLowerCase();

  if (lowerType === 'pptx' || lowerType === 'powerpoint' || lowerType === 'ppt' || (filename && filename.endsWith('.pptx'))) {
    return await createPowerpointPresentation({ title, filename, openInPowerpoint: openInApp });
  }

  if (lowerType === 'docx' || lowerType === 'word' || (filename && filename.endsWith('.docx'))) {
    return await createWordDocument({ title, content, filename, openInWord: openInApp });
  }

  if (lowerType === 'xlsx' || lowerType === 'excel' || (filename && filename.endsWith('.xlsx'))) {
    return await createExcelSpreadsheet({ title, filename, openInExcel: openInApp });
  }

  // Generic Markdown or HTML report
  const desktopDir = getDesktopDirectory();
  const ext = type.startsWith('.') ? type : `.${type}`;
  const rawFilename = (filename || `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}${ext}`);
  const targetPath = path.isAbsolute(rawFilename) ? rawFilename : path.join(desktopDir, rawFilename);
  const safeFilename = path.basename(targetPath);

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');

  if (openInApp) {
    await executeCommand(`Start-Process -FilePath '${targetPath.replace(/'/g, "''")}'`, 'powershell', 6000);
  }

  return {
    success: true,
    filePath: targetPath,
    filename: safeFilename,
    opened: openInApp,
    message: `Document created and opened at ${targetPath}`
  };
}
