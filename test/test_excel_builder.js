import { executeCommand } from '../server/tools/shell.js';
import path from 'path';
import os from 'os';
import fs from 'fs';

async function testExcel() {
  const outputPath = path.join(os.tmpdir(), 'test_financials.xlsx');
  const escOut = outputPath.replace(/'/g, "''");

  const psScript = `
    $ErrorActionPreference = 'Stop'
    Add-Type -AssemblyName System.Drawing
    try {
      $excel = New-Object -ComObject Excel.Application
      $excel.Visible = $false
      $excel.DisplayAlerts = $false
      $wb = $excel.Workbooks.Add()
      $sheet = $wb.Sheets.Item(1)
      $sheet.Name = 'Q3 Performance'

      function Get-OleColor($r, $g, $b) {
        return [System.Drawing.ColorTranslator]::ToOle([System.Drawing.Color]::FromArgb($r, $g, $b))
      }

      $cHeaderBg = Get-OleColor 30 58 138     # Dark Navy
      $cHeaderText = Get-OleColor 255 255 255 # White
      $cBorder = Get-OleColor 203 213 225     # Slate 300
      $cTotalBg = Get-OleColor 241 245 249    # Slate 100

      # Headers
      $headers = @('Category', 'Q1 Revenue', 'Q2 Revenue', 'Q3 Revenue', 'YoY Growth')
      for ($i = 0; $i -lt $headers.Length; $i++) {
        $cell = $sheet.Cells.Item(1, $i + 1)
        $cell.Value2 = $headers[$i]
        $cell.Font.Name = 'Segoe UI'
        $cell.Font.Bold = $true
        $cell.Font.Size = 11
        $cell.Font.Color = $cHeaderText
        $cell.Interior.Color = $cHeaderBg
      }

      # Data
      $data = @(
        @('Solar Systems', 1250000, 1420000, 1680000, 0.34),
        @('Wind Turbines', 980000, 1150000, 1310000, 0.22),
        @('Battery Storage', 450000, 620000, 890000, 0.78),
        @('Grid Software', 220000, 270000, 310000, 0.15)
      )

      for ($r = 0; $r -lt $data.Length; $r++) {
        $rowNum = $r + 2
        $row = $data[$r]
        for ($c = 0; $c -lt $row.Length; $c++) {
          $val = $row[$c]
          $cell = $sheet.Cells.Item($rowNum, $c + 1)
          if ($val -is [int] -or $val -is [double] -or $val -is [long] -or $val -is [decimal]) {
            $cell.Value2 = [double]$val
          } else {
            $cell.Value2 = [string]$val
          }
          $cell.Font.Name = 'Segoe UI'
          $cell.Font.Size = 10
        }
      }

      # Format Currency Columns (B, C, D)
      $sheet.Range('B2:D6').NumberFormat = '$#,##0'
      # Format Percentage Column (E)
      $sheet.Range('E2:E6').NumberFormat = '0.0%'

      # Total Row
      $totalRow = $data.Length + 2
      $sheet.Cells.Item($totalRow, 1).Value2 = 'Total / Average'
      $sheet.Cells.Item($totalRow, 1).Font.Bold = $true

      $sheet.Cells.Item($totalRow, 2).Formula = '=SUM(B2:B5)'
      $sheet.Cells.Item($totalRow, 3).Formula = '=SUM(C2:C5)'
      $sheet.Cells.Item($totalRow, 4).Formula = '=SUM(D2:D5)'
      $sheet.Cells.Item($totalRow, 5).Formula = '=AVERAGE(E2:E5)'

      for ($c = 1; $c -le 5; $c++) {
        $cell = $sheet.Cells.Item($totalRow, $c)
        $cell.Font.Bold = $true
        $cell.Interior.Color = $cTotalBg
      }

      # Auto-fit columns
      $sheet.UsedRange.Columns.AutoFit() | Out-Null

      # Save as xlsx (51 = xlOpenXMLWorkbook)
      $wb.SaveAs('${escOut}', 51)
      $wb.Close($false)
      $excel.Quit()

      [PSCustomObject]@{
        success = $true
        file = '${escOut}'
      } | ConvertTo-Json
    } catch {
      if ($excel) {
        try { $wb.Close($false) } catch {}
        try { $excel.Quit() } catch {}
      }
      $errLine = $_.InvocationInfo.Line
      [PSCustomObject]@{
        success = $false
        line = $_.InvocationInfo.ScriptLineNumber
        lineText = $errLine
        error = $_.Exception.Message
        trace = $_.ScriptStackTrace
      } | ConvertTo-Json
    }
  `;

  console.log('Testing Excel COM automation...');
  const res = await executeCommand(psScript, 'powershell', 25000);
  console.log('Excel Result:', res.stdout || res.stderr);
  try {
    const stat = fs.statSync(outputPath);
    console.log('Excel file generated, size:', stat.size);
    fs.unlinkSync(outputPath);
  } catch (e) {
    console.log('Error verifying file:', e.message);
  }
}

testExcel();
