/**
 * test/test_docs_files_vision.js
 * Exhaustive test suite for Documents, Files & Vision modules:
 * 1. createWordDocument (server/tools/documents.js)
 * 2. createDocument (server/tools/documents.js)
 * 3. writeFile & readFile (server/tools/files.js)
 * 4. searchFiles & listDirectory (server/tools/files.js)
 * 5. captureDesktopScreenshot (server/tools/vision.js)
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

import { createWordDocument, createDocument } from '../server/tools/documents.js';
import { writeFile, readFile, searchFiles, listDirectory } from '../server/tools/files.js';
import { captureDesktopScreenshot } from '../server/tools/vision.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const results = [];
const cleanupFiles = new Set();
const cleanupDirs = new Set();

function recordResult(feature, funcName, success, latencyMs, details) {
  results.push({
    'Feature': feature,
    'Function': funcName,
    'Status': success ? 'PASSED' : 'FAILED',
    'Latency (ms)': Math.round(latencyMs),
    'Details': typeof details === 'object' ? JSON.stringify(details) : String(details || '')
  });
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log(' STARTING EXHAUSTIVE VERIFICATION: DOCUMENTS, FILES & VISION MODULES');
  console.log('========================================================================\n');

  const suiteStartTime = performance.now();

  // Temporary folder for files tests
  const testDir = path.join(os.tmpdir(), `pa_test_files_${Date.now()}`);
  cleanupDirs.add(testDir);

  try {
    // =========================================================================
    // 1. Test createWordDocument
    // =========================================================================
    console.log('[Test 1] Testing createWordDocument...');
    const t0 = performance.now();
    const wordOptions = {
      title: 'Full Verification Test',
      content: 'Testing Word COM automation...',
      bullets: ['Item 1', 'Item 2'],
      openInWord: false
    };

    const wordRes = await createWordDocument(wordOptions);
    const tWord = performance.now() - t0;

    let wordPassed = false;
    let wordDetails = '';

    if (wordRes && wordRes.success === true && wordRes.filePath) {
      cleanupFiles.add(wordRes.filePath);
      if (fs.existsSync(wordRes.filePath)) {
        const stats = fs.statSync(wordRes.filePath);
        if (stats.size > 0) {
          wordPassed = true;
          wordDetails = `File created at ${wordRes.filePath} (${stats.size} bytes, opened: ${wordRes.opened})`;
        } else {
          wordDetails = `File exists but is empty (0 bytes): ${wordRes.filePath}`;
        }
      } else {
        wordDetails = `File path returned does not exist on disk: ${wordRes.filePath}`;
      }
    } else {
      wordDetails = `Operation returned failure: ${JSON.stringify(wordRes)}`;
    }

    console.log(`  -> Result: ${wordPassed ? 'SUCCESS' : 'FAILED'} (${Math.round(tWord)}ms)`);
    console.log(`     Details: ${wordDetails}`);
    recordResult('Documents', 'createWordDocument', wordPassed, tWord, wordDetails);

    // =========================================================================
    // 2. Test createDocument (type: 'txt')
    // =========================================================================
    console.log('\n[Test 2] Testing createDocument (type: "txt")...');
    const t1 = performance.now();
    const docOptions = {
      type: 'txt',
      title: 'TestDoc',
      content: 'Sample text',
      openInApp: false
    };

    const docRes = await createDocument(docOptions);
    const tDoc = performance.now() - t1;

    let docPassed = false;
    let docDetails = '';

    if (docRes && docRes.success === true && docRes.filePath) {
      cleanupFiles.add(docRes.filePath);
      if (fs.existsSync(docRes.filePath)) {
        const stats = fs.statSync(docRes.filePath);
        const diskContent = fs.readFileSync(docRes.filePath, 'utf8');
        if (stats.size > 0 && diskContent.includes('Sample text')) {
          docPassed = true;
          docDetails = `File created at ${docRes.filePath} (${stats.size} bytes, content verified)`;
        } else {
          docDetails = `File content mismatch or empty: size=${stats.size}, content="${diskContent}"`;
        }
      } else {
        docDetails = `File does not exist: ${docRes.filePath}`;
      }
    } else {
      docDetails = `Operation failed: ${JSON.stringify(docRes)}`;
    }

    console.log(`  -> Result: ${docPassed ? 'SUCCESS' : 'FAILED'} (${Math.round(tDoc)}ms)`);
    console.log(`     Details: ${docDetails}`);
    recordResult('Documents', 'createDocument', docPassed, tDoc, docDetails);

    // =========================================================================
    // 3. Test writeFile & readFile
    // =========================================================================
    console.log('\n[Test 3] Testing writeFile and readFile...');
    const testFilePath = path.join(testDir, 'sample_rw_test.txt');
    const testContent = 'Hello World from Personal Assistant!\nLine 2 of testing content.\nLine 3: Verified.';
    
    // 3a. writeFile
    const tWrite0 = performance.now();
    const writeRes = await writeFile(testFilePath, testContent);
    const tWrite = performance.now() - tWrite0;

    let writePassed = false;
    let writeDetails = '';
    if (writeRes && writeRes.success === true && fs.existsSync(testFilePath)) {
      const stats = fs.statSync(testFilePath);
      if (stats.size === Buffer.byteLength(testContent, 'utf-8')) {
        writePassed = true;
        writeDetails = `Wrote ${writeRes.bytesWritten} bytes to ${writeRes.path}`;
      } else {
        writeDetails = `Size mismatch: expected ${Buffer.byteLength(testContent, 'utf-8')}, got ${stats.size}`;
      }
    } else {
      writeDetails = `Write failed: ${JSON.stringify(writeRes)}`;
    }

    console.log(`  -> writeFile: ${writePassed ? 'SUCCESS' : 'FAILED'} (${Math.round(tWrite)}ms)`);
    console.log(`     Details: ${writeDetails}`);
    recordResult('Files', 'writeFile', writePassed, tWrite, writeDetails);

    // 3b. readFile
    const tRead0 = performance.now();
    const readRes = await readFile(testFilePath);
    const tRead = performance.now() - tRead0;

    let readPassed = false;
    let readDetails = '';
    if (readRes && !readRes.error && readRes.content === testContent) {
      readPassed = true;
      readDetails = `Read ${readRes.totalLines} lines (${readRes.content.length} chars) successfully without truncation`;
    } else {
      readDetails = `Read failed or content mismatch: ${JSON.stringify(readRes)}`;
    }

    console.log(`  -> readFile: ${readPassed ? 'SUCCESS' : 'FAILED'} (${Math.round(tRead)}ms)`);
    console.log(`     Details: ${readDetails}`);
    recordResult('Files', 'readFile', readPassed, tRead, readDetails);

    // =========================================================================
    // 4. Test searchFiles & listDirectory
    // =========================================================================
    console.log('\n[Test 4] Testing searchFiles and listDirectory...');
    // Create additional files and nested subfolder in testDir for comprehensive listing & search testing
    const subDir = path.join(testDir, 'nested_folder');
    const fileA = path.join(testDir, 'search_target_alpha.json');
    const fileB = path.join(subDir, 'nested_search_beta.log');
    await writeFile(fileA, JSON.stringify({ name: 'alpha', active: true }));
    await writeFile(fileB, 'Sample nested log entry timestamp ' + new Date().toISOString());

    // 4a. listDirectory
    const tList0 = performance.now();
    const listRes = await listDirectory(testDir);
    const tList = performance.now() - tList0;

    let listPassed = false;
    let listDetails = '';
    if (listRes && !listRes.error && Array.isArray(listRes.items)) {
      const names = listRes.items.map(i => i.name);
      const hasSampleTxt = names.includes('sample_rw_test.txt');
      const hasAlpha = names.includes('search_target_alpha.json');
      const hasNested = names.includes('nested_folder');
      if (hasSampleTxt && hasAlpha && hasNested) {
        listPassed = true;
        listDetails = `Listed ${listRes.totalItems} items (${names.join(', ')}) with full metadata`;
      } else {
        listDetails = `Missing expected items in directory list: ${names.join(', ')}`;
      }
    } else {
      listDetails = `listDirectory returned error: ${listRes?.error}`;
    }

    console.log(`  -> listDirectory: ${listPassed ? 'SUCCESS' : 'FAILED'} (${Math.round(tList)}ms)`);
    console.log(`     Details: ${listDetails}`);
    recordResult('Files', 'listDirectory', listPassed, tList, listDetails);

    // 4b. searchFiles (direct & recursive)
    const tSearch0 = performance.now();
    const searchRes = await searchFiles(testDir, 'search_target');
    const tSearch = performance.now() - tSearch0;

    // Also search nested
    const searchNestedRes = await searchFiles(testDir, 'nested_search');

    let searchPassed = false;
    let searchDetails = '';
    if (searchRes && searchRes.totalMatches >= 1 && searchNestedRes && searchNestedRes.totalMatches >= 1) {
      searchPassed = true;
      searchDetails = `Found ${searchRes.totalMatches} match(es) for 'search_target' & ${searchNestedRes.totalMatches} recursive match(es) for 'nested_search'`;
    } else {
      searchDetails = `Search results incomplete: direct=${searchRes?.totalMatches}, nested=${searchNestedRes?.totalMatches}`;
    }

    console.log(`  -> searchFiles: ${searchPassed ? 'SUCCESS' : 'FAILED'} (${Math.round(tSearch)}ms)`);
    console.log(`     Details: ${searchDetails}`);
    recordResult('Files', 'searchFiles', searchPassed, tSearch, searchDetails);

    // =========================================================================
    // 5. Test captureDesktopScreenshot
    // =========================================================================
    console.log('\n[Test 5] Testing captureDesktopScreenshot(70)...');
    const tVision0 = performance.now();
    const screenRes = await captureDesktopScreenshot(70);
    const tVision = performance.now() - tVision0;

    let visionPassed = false;
    let visionDetails = '';

    if (screenRes && screenRes.success === true && screenRes.dataUrl) {
      const dataUrlPrefix = 'data:image/jpeg;base64,';
      if (screenRes.dataUrl.startsWith(dataUrlPrefix)) {
        const base64Data = screenRes.dataUrl.slice(dataUrlPrefix.length);
        const imgBuffer = Buffer.from(base64Data, 'base64');

        // Check JPEG magic bytes 0xFF 0xD8 0xFF
        const isJpegHeader = imgBuffer.length > 3 &&
          imgBuffer[0] === 0xFF &&
          imgBuffer[1] === 0xD8 &&
          imgBuffer[2] === 0xFF;

        if (imgBuffer.length > 0 && imgBuffer.length === screenRes.sizeBytes && isJpegHeader) {
          visionPassed = true;
          visionDetails = `Valid JPEG data URL generated (${imgBuffer.length} bytes, MIME: ${screenRes.mimeType}, Header: Valid JPEG)`;
        } else {
          visionDetails = `Invalid JPEG buffer or size mismatch: bufferLength=${imgBuffer.length}, reportedSize=${screenRes.sizeBytes}, isJpegHeader=${isJpegHeader}`;
        }
      } else {
        visionDetails = `DataUrl does not have required prefix "${dataUrlPrefix}"`;
      }
    } else {
      visionDetails = `Screenshot capture failed: ${screenRes?.error || JSON.stringify(screenRes)}`;
    }

    console.log(`  -> captureDesktopScreenshot: ${visionPassed ? 'SUCCESS' : 'FAILED'} (${Math.round(tVision)}ms)`);
    console.log(`     Details: ${visionDetails}`);
    recordResult('Vision', 'captureDesktopScreenshot(70)', visionPassed, tVision, visionDetails);

  } catch (err) {
    console.error('Fatal unexpected error during test suite:', err);
    recordResult('System', 'Test Suite Execution', false, 0, err.message);
  } finally {
    // =========================================================================
    // Cleanup of temporary files and directories
    // =========================================================================
    console.log('\n========================================================================');
    console.log(' CLEANUP PHASE');
    console.log('========================================================================');

    for (const filePath of cleanupFiles) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`  ✓ Removed test file: ${filePath}`);
        }
      } catch (err) {
        console.warn(`  ! Warning: could not delete ${filePath}: ${err.message}`);
      }
    }

    for (const dirPath of cleanupDirs) {
      try {
        if (fs.existsSync(dirPath)) {
          fs.rmSync(dirPath, { recursive: true, force: true });
          console.log(`  ✓ Removed test directory: ${dirPath}`);
        }
      } catch (err) {
        console.warn(`  ! Warning: could not delete directory ${dirPath}: ${err.message}`);
      }
    }
  }

  // =========================================================================
  // Report Summary Table
  // =========================================================================
  const totalSuiteDuration = performance.now() - suiteStartTime;
  console.log('\n========================================================================');
  console.log('                     EXHAUSTIVE TEST RESULTS TABLE                      ');
  console.log('========================================================================');
  console.table(results);

  const allPassed = results.length > 0 && results.every(r => r.Status === 'PASSED');
  console.log(`Total Operations Tested : ${results.length}`);
  console.log(`All Succeeded           : ${allPassed ? 'YES (100% PASS)' : 'NO'}`);
  console.log(`Total Duration          : ${Math.round(totalSuiteDuration)} ms`);
  console.log('========================================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Unhandled rejection:', err);
  process.exit(1);
});
