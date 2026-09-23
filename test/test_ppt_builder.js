import { executeCommand } from '../server/tools/shell.js';
import { fetchTopicImage } from '../server/tools/images.js';
import path from 'path';
import fs from 'fs';
import os from 'os';

async function testRichPpt() {
  console.log('Fetching test image for solar power...');
  const imgPath = await fetchTopicImage('solar photovoltaic panel');
  console.log('Image fetched at:', imgPath);

  const outputPath = path.join(os.tmpdir(), 'test_rich_deck.pptx');
  const escImg = (imgPath || '').replace(/'/g, "''");
  const escOut = outputPath.replace(/'/g, "''");

  const psScript = `
    $ErrorActionPreference = 'Stop'
    Add-Type -AssemblyName System.Drawing
    try {
      $ppt = New-Object -ComObject PowerPoint.Application
      $pres = $ppt.Presentations.Add([Microsoft.Office.Core.MsoTriState]::msoFalse)
      $pres.PageSetup.SlideWidth = 960
      $pres.PageSetup.SlideHeight = 540

      # Helper for OLE colors
      function Get-OleColor($r, $g, $b) {
        return [System.Drawing.ColorTranslator]::ToOle([System.Drawing.Color]::FromArgb($r, $g, $b))
      }

      $cBgDark = Get-OleColor 15 23 42        # #0F172A Slate 900
      $cCardDark = Get-OleColor 30 41 59      # #1E293B Slate 800
      $cAccent = Get-OleColor 14 165 233      # #0EA5E9 Sky Blue
      $cAccentGlow = Get-OleColor 168 85 247  # #A855F7 Purple
      $cTextWhite = Get-OleColor 248 250 252  # #F8FAFC
      $cTextMuted = Get-OleColor 203 213 225  # #CBD5E1

      # ----------------------------------------------------
      # Slide 1: Hero Title Slide
      # ----------------------------------------------------
      $slide1 = $pres.Slides.Add(1, 12) # 12 = ppLayoutBlank
      $slide1.FollowMasterBackground = [Microsoft.Office.Core.MsoTriState]::msoFalse
      $slide1.Background.Fill.Solid()
      $slide1.Background.Fill.ForeColor.RGB = $cBgDark

      # Card backdrop
      $heroCard = $slide1.Shapes.AddShape(1, 80, 70, 800, 400) # msoShapeRectangle
      $heroCard.Fill.Solid()
      $heroCard.Fill.ForeColor.RGB = $cCardDark
      $heroCard.Line.ForeColor.RGB = $cAccent
      $heroCard.Line.Weight = 2

      # Category pill badge
      $badge = $slide1.Shapes.AddShape(1, 130, 120, 220, 36)
      $badge.Fill.Solid()
      $badge.Fill.ForeColor.RGB = $cAccent
      $badge.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
      $badge.TextFrame.TextRange.Text = 'EXECUTIVE BRIEFING'
      $badge.TextFrame.TextRange.Font.Name = 'Segoe UI'
      $badge.TextFrame.TextRange.Font.Size = 12
      $badge.TextFrame.TextRange.Font.Bold = 1
      $badge.TextFrame.TextRange.Font.Color.RGB = $cTextWhite

      # Main Title
      $titleBox = $slide1.Shapes.AddTextbox(1, 130, 180, 700, 120)
      $titleBox.TextFrame.WordWrap = [Microsoft.Office.Core.MsoTriState]::msoTrue
      $titleBox.TextFrame.TextRange.Text = 'The Renewable Energy Revolution'
      $titleBox.TextFrame.TextRange.Font.Name = 'Segoe UI'
      $titleBox.TextFrame.TextRange.Font.Size = 36
      $titleBox.TextFrame.TextRange.Font.Bold = 1
      $titleBox.TextFrame.TextRange.Font.Color.RGB = $cTextWhite

      # Subtitle
      $subBox = $slide1.Shapes.AddTextbox(1, 130, 310, 700, 60)
      $subBox.TextFrame.WordWrap = [Microsoft.Office.Core.MsoTriState]::msoTrue
      $subBox.TextFrame.TextRange.Text = 'Strategic Transition, Technological Breakthroughs, and Global Economics'
      $subBox.TextFrame.TextRange.Font.Name = 'Segoe UI'
      $subBox.TextFrame.TextRange.Font.Size = 16
      $subBox.TextFrame.TextRange.Font.Color.RGB = $cTextMuted

      # ----------------------------------------------------
      # Slide 2: Split Content Slide with Image
      # ----------------------------------------------------
      $slide2 = $pres.Slides.Add(2, 12)
      $slide2.FollowMasterBackground = [Microsoft.Office.Core.MsoTriState]::msoFalse
      $slide2.Background.Fill.Solid()
      $slide2.Background.Fill.ForeColor.RGB = $cBgDark

      # Slide Header Title
      $s2Title = $slide2.Shapes.AddTextbox(1, 60, 40, 540, 50)
      $s2Title.TextFrame.TextRange.Text = 'Solar Photovoltaic Scaling & Efficiency'
      $s2Title.TextFrame.TextRange.Font.Name = 'Segoe UI'
      $s2Title.TextFrame.TextRange.Font.Size = 26
      $s2Title.TextFrame.TextRange.Font.Bold = 1
      $s2Title.TextFrame.TextRange.Font.Color.RGB = $cTextWhite

      # Content Card on Left
      $contentCard = $slide2.Shapes.AddShape(1, 60, 100, 500, 310)
      $contentCard.Fill.Solid()
      $contentCard.Fill.ForeColor.RGB = $cCardDark
      $contentCard.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse

      $textBox = $slide2.Shapes.AddTextbox(1, 80, 115, 460, 280)
      $tbFrame = $textBox.TextFrame
      $tbFrame.WordWrap = [Microsoft.Office.Core.MsoTriState]::msoTrue
      $bulletsText = @'
• Perovskite-Silicon Tandem Cells: Efficiency benchmarks exceeding 33%, breaking past traditional silicon limits.

• Plunging Levelized Cost (LCOE): Solar electricity costs dropped over 88% over the past decade, making solar the cheapest power source in history.

• Decentralized Grid Resilience: Microgrids and distributed rooftop arrays empower local community energy independence.
'@
      $tbFrame.TextRange.Text = $bulletsText
      $tbFrame.TextRange.Font.Name = 'Segoe UI'
      $tbFrame.TextRange.Font.Size = 14
      $tbFrame.TextRange.Font.Color.RGB = $cTextMuted

      # Right Column Image
      if ('${escImg}' -ne '' -and (Test-Path '${escImg}')) {
        $pic = $slide2.Shapes.AddPicture('${escImg}', 0, -1, 580, 100, 320, 310)
        $pic.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoTrue
        $pic.Line.ForeColor.RGB = $cAccent
        $pic.Line.Weight = 2
      }

      # Bottom Takeaway Bar
      $takeaway = $slide2.Shapes.AddShape(1, 60, 430, 840, 65)
      $takeaway.Fill.Solid()
      $takeaway.Fill.ForeColor.RGB = $cAccent
      $takeaway.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
      $takeaway.TextFrame.TextRange.Text = 'KEY TAKEAWAY: Solar installation capacity is growing exponentially, driven by rapid battery storage parity and manufacturing scale.'
      $takeaway.TextFrame.TextRange.Font.Name = 'Segoe UI'
      $takeaway.TextFrame.TextRange.Font.Size = 12
      $takeaway.TextFrame.TextRange.Font.Bold = 1
      $takeaway.TextFrame.TextRange.Font.Color.RGB = $cTextWhite

      # Save and exit
      $pres.SaveAs('${escOut}')
      $pres.Close()
      $ppt.Quit()

      [PSCustomObject]@{
        success = $true
        file = '${escOut}'
      } | ConvertTo-Json
    } catch {
      if ($ppt) {
        try { $pres.Close() } catch {}
        try { $ppt.Quit() } catch {}
      }
      [PSCustomObject]@{
        success = $false
        error = $_.Exception.Message
      } | ConvertTo-Json
    }
  `;

  console.log('Executing PowerPoint COM automation script...');
  const res = await executeCommand(psScript, 'powershell', 35000);
  console.log('Execution result:', res.stdout || res.stderr);
}

testRichPpt();
