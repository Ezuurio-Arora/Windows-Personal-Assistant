import { createPowerpointPresentation, createWordDocument, createExcelSpreadsheet } from '../server/tools/documents.js';
import fs from 'fs';
import path from 'path';

async function verifyAllSuite() {
  console.log('====================================================');
  console.log('  Testing Full Suite of Document & App Creation     ');
  console.log('====================================================\n');

  const results = {};

  // 1. PowerPoint Test
  console.log('[1/3] Testing Professional PowerPoint Generation (.pptx)...');
  const t0 = Date.now();
  try {
    const pptRes = await createPowerpointPresentation({
      title: 'Renewable Energy Revolution',
      subtitle: 'Technological Advancements & Global Economic Transition',
      theme: 'emerald_nature',
      slides: [
        {
          title: 'Solar Photovoltaic Scaling & Breakthroughs',
          bullets: [
            'Perovskite-Silicon Tandem Cells: Achieving lab efficiencies exceeding 33.9%, breaking theoretical Shockley-Queisser single-junction limits.',
            'Unprecedented LCOE Plunge: Solar generation costs have declined by 88% since 2010, establishing utility-scale solar as the cheapest electricity in history.',
            'Global Manufacturing Volume: Global annual module shipments exceed 500 GW, propelled by gigawatt-scale automated fabrication facilities.'
          ],
          keyTakeaway: 'Utility-scale solar now offers the lowest levelized cost of energy across more than 85% of worldwide jurisdictions.',
          imageKeyword: 'solar photovoltaic panel'
        },
        {
          title: 'Wind Power Engineering & Offshore Potential',
          bullets: [
            'Turbine Generator Capacity: Modern offshore nacelles now scale beyond 16 MW with rotor diameters exceeding 260 meters.',
            'High Capacity Factors: Offshore wind farms regularly record capacity factors of 45-55%, providing predictable baseload generation.',
            'Floating Platform Expansion: Deep-water floating foundations unlock deep maritime territory previously inaccessible to fixed-bottom turbines.'
          ],
          keyTakeaway: 'Offshore wind delivers high capacity factor baseload power directly to dense coastal population centers.',
          imageKeyword: 'wind turbine offshore'
        }
      ],
      openInPowerpoint: false
    });

    const pptDuration = Date.now() - t0;
    if (pptRes.success && pptRes.filePath && fs.existsSync(pptRes.filePath)) {
      const size = fs.statSync(pptRes.filePath).size;
      results.ppt = { status: 'PASSED', path: pptRes.filePath, size, duration: pptDuration };
      console.log(`  -> SUCCESS! PowerPoint created (${size} bytes) in ${pptDuration}ms at: ${pptRes.filePath}`);
      try { fs.unlinkSync(pptRes.filePath); } catch {}
    } else {
      results.ppt = { status: 'FAILED', error: pptRes.error, duration: pptDuration };
      console.error('  -> FAILED:', pptRes.error);
    }
  } catch (e) {
    results.ppt = { status: 'ERROR', error: e.message };
    console.error('  -> ERROR:', e);
  }

  // 2. Word Test
  console.log('\n[2/3] Testing Executive Word Document Generation (.docx)...');
  const t1 = Date.now();
  try {
    const wordRes = await createWordDocument({
      title: 'Global Energy Transition Assessment',
      subtitle: 'Executive Strategic Assessment & 2030 Roadmap',
      summary: 'Electrification and grid modernization are driving unprecedented capital deployment into clean generation assets, yielding structural reductions in wholesale energy volatility.',
      sections: [
        {
          heading: '1. Macroeconomic Drivers and Parity Metrics',
          content: 'The rapid decline in renewable energy capital expenditure has fundamentally decoupled economic expansion from fossil carbon emissions. Grid-scale batteries and intelligent demand-response software now enable resilient 24/7 clean power supply.',
          bullets: [
            'Levelized cost parity reached in over 85% of primary global markets.',
            'Battery storage module manufacturing costs decreased by 78% over 8 years.',
            'Institutional infrastructure allocation toward clean power exceeded $1.8 trillion in 2025.'
          ]
        },
        {
          heading: '2. Strategic Grid Modernization Imperatives',
          content: 'Interconnection delays and transmission bottlenecks remain the foremost operational constraints. Accelerated permitting for high-voltage direct current (HVDC) lines is imperative to transport remote generation to urban demand centers.',
          bullets: [
            'Implementation of dynamic line rating to increase existing transmission throughput by up to 25%.',
            'Synchronous condensers and grid-forming inverters ensuring system inertia and frequency stability.'
          ]
        }
      ],
      imageKeyword: 'renewable energy solar wind',
      openInWord: false
    });

    const wordDuration = Date.now() - t1;
    if (wordRes.success && wordRes.filePath && fs.existsSync(wordRes.filePath)) {
      const size = fs.statSync(wordRes.filePath).size;
      results.word = { status: 'PASSED', path: wordRes.filePath, size, duration: wordDuration };
      console.log(`  -> SUCCESS! Word document created (${size} bytes) in ${wordDuration}ms at: ${wordRes.filePath}`);
      try { fs.unlinkSync(wordRes.filePath); } catch {}
    } else {
      results.word = { status: 'FAILED', error: wordRes.error, duration: wordDuration };
      console.error('  -> FAILED:', wordRes.error);
    }
  } catch (e) {
    results.word = { status: 'ERROR', error: e.message };
    console.error('  -> ERROR:', e);
  }

  // 3. Excel Test
  console.log('\n[3/3] Testing Native Excel Spreadsheet Generation (.xlsx)...');
  const t2 = Date.now();
  try {
    const excelRes = await createExcelSpreadsheet({
      title: 'Renewable Energy Economics 2026',
      sheetName: 'LCOE Benchmarks',
      headers: ['Energy Technology', '2010 LCOE ($/MWh)', '2024 LCOE ($/MWh)', 'Cost Reduction (%)', 'Global Capacity (GW)'],
      rows: [
        ['Solar Photovoltaic', 359, 43, 0.88, 1420],
        ['Onshore Wind', 102, 31, 0.70, 980],
        ['Offshore Wind', 197, 72, 0.63, 115],
        ['Battery Storage (4-Hour)', 420, 95, 0.77, 450],
        ['Advanced Geothermal', 145, 88, 0.39, 35]
      ],
      currencyColumns: [1, 2],
      percentColumns: [3],
      includeTotals: true,
      openInExcel: false
    });

    const excelDuration = Date.now() - t2;
    if (excelRes.success && excelRes.filePath && fs.existsSync(excelRes.filePath)) {
      const size = fs.statSync(excelRes.filePath).size;
      results.excel = { status: 'PASSED', path: excelRes.filePath, size, duration: excelDuration };
      console.log(`  -> SUCCESS! Excel spreadsheet created (${size} bytes) in ${excelDuration}ms at: ${excelRes.filePath}`);
      try { fs.unlinkSync(excelRes.filePath); } catch {}
    } else {
      results.excel = { status: 'FAILED', error: excelRes.error, duration: excelDuration };
      console.error('  -> FAILED:', excelRes.error);
    }
  } catch (e) {
    results.excel = { status: 'ERROR', error: e.message };
    console.error('  -> ERROR:', e);
  }

  console.log('\n====================================================');
  console.log('  Document Suite Verification Complete              ');
  console.log('====================================================');
  console.log(JSON.stringify(results, null, 2));
}

verifyAllSuite();
