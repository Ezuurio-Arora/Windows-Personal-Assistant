import fs from 'fs/promises';
import path from 'path';

/**
 * Recursively search for files matching a pattern or substring.
 * @param {string} dir - Directory to search in.
 * @param {string} pattern - Search string or wildcard.
 * @param {number} [maxResults=50] - Maximum matching files to return.
 */
export async function searchFiles(dir, pattern, maxResults = 50) {
  const results = [];
  const lowerPattern = pattern.toLowerCase();
  const searchDir = path.resolve(dir || process.cwd());

  const skipDirs = new Set(['node_modules', '.git', '$recycle.bin', 'system volume information']);

  async function walk(currentDir, depth = 0) {
    if (depth > 8 || results.length >= maxResults) return;

    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return; // Skip folders without read permission
    }

    for (const entry of entries) {
      if (results.length >= maxResults) break;

      const fullPath = path.join(currentDir, entry.name);
      const lowerName = entry.name.toLowerCase();

      if (entry.isDirectory()) {
        if (!skipDirs.has(lowerName) && !entry.name.startsWith('.')) {
          await walk(fullPath, depth + 1);
        }
      } else if (entry.isFile()) {
        if (lowerName.includes(lowerPattern) || pattern === '*' || pattern === '') {
          try {
            const stats = await fs.stat(fullPath);
            results.push({
              name: entry.name,
              path: fullPath,
              sizeBytes: stats.size,
              modified: stats.mtime.toISOString()
            });
          } catch {
            results.push({ name: entry.name, path: fullPath });
          }
        }
      }
    }
  }

  await walk(searchDir);
  return {
    searchedDirectory: searchDir,
    totalMatches: results.length,
    files: results
  };
}

/**
 * Safely read file content with line limit.
 * @param {string} filePath - Path to file.
 * @param {number} [maxLines=1000] - Max lines to return.
 */
export async function readFile(filePath, maxLines = 1000) {
  const resolved = path.resolve(filePath);
  try {
    const content = await fs.readFile(resolved, 'utf-8');
    const lines = content.split(/\r?\n/);
    const truncated = lines.length > maxLines;
    const finalContent = truncated ? lines.slice(0, maxLines).join('\n') : content;

    return {
      path: resolved,
      totalLines: lines.length,
      linesReturned: truncated ? maxLines : lines.length,
      isTruncated: truncated,
      content: finalContent
    };
  } catch (err) {
    return {
      error: `Failed to read file: ${err.message}`,
      path: resolved
    };
  }
}

/**
 * Write or overwrite content to a file.
 * @param {string} filePath - Path to file.
 * @param {string} content - Content to write.
 */
export async function writeFile(filePath, content) {
  const resolved = path.resolve(filePath);
  try {
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, 'utf-8');
    const stats = await fs.stat(resolved);
    return {
      success: true,
      path: resolved,
      bytesWritten: stats.size
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to write file: ${err.message}`,
      path: resolved
    };
  }
}

/**
 * List files and subfolders in a directory.
 * @param {string} dirPath - Directory to list.
 */
export async function listDirectory(dirPath) {
  const resolved = path.resolve(dirPath || process.cwd());
  try {
    const entries = await fs.readdir(resolved, { withFileTypes: true });
    const items = await Promise.all(
      entries.map(async (entry) => {
        const itemPath = path.join(resolved, entry.name);
        try {
          const stats = await fs.stat(itemPath);
          return {
            name: entry.name,
            path: itemPath,
            isDirectory: entry.isDirectory(),
            sizeBytes: stats.size,
            modified: stats.mtime.toISOString()
          };
        } catch {
          return {
            name: entry.name,
            path: itemPath,
            isDirectory: entry.isDirectory()
          };
        }
      })
    );

    return {
      directory: resolved,
      totalItems: items.length,
      items
    };
  } catch (err) {
    return {
      error: `Failed to list directory: ${err.message}`,
      directory: resolved
    };
  }
}
