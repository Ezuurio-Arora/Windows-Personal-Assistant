import { executeCommand } from './tools/shell.js';
import { searchFiles, readFile, writeFile, listDirectory } from './tools/files.js';
import { getSystemMetrics, getHardwareProfile, setVolume, powerAction, getActiveWindow } from './tools/system.js';
import { captureDesktopScreenshot } from './tools/vision.js';
import { mouseMove, mouseClick, typeText, sendKeyPress, focusWindow, automateGui } from './tools/gui.js';
import { createWordDocument, createDocument, createPowerpointPresentation, createExcelSpreadsheet } from './tools/documents.js';
import { searchWeb, fetchWebContent } from './tools/web.js';
import { launchApp, listProcesses, killProcess, getListeningPorts, resolveWebDestination } from './tools/apps.js';
import { getClipboard, setClipboard } from './tools/clipboard.js';
import { showNotification, speakText } from './tools/notifications.js';
import { pingHost, getNetworkConfig } from './tools/network.js';

export const TOOL_DEFINITIONS = [
  // Shell & Execution
  {
    name: 'run_command',
    description: 'Execute a PowerShell or CMD command on the Windows host machine.',
    sensitive: true,
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The exact PowerShell/CMD command line.' },
        shellType: { type: 'string', enum: ['powershell', 'cmd'], description: 'Default is powershell' }
      },
      required: ['command']
    }
  },

  // Applications & Processes
  {
    name: 'launch_app',
    description: 'Launch an application, document, or URL on Windows (e.g., notepad, chrome, code, calc, or full executable path). For browser navigation (e.g. "open chrome and navigate to apple store", "go to youtube"), pass the browser in appOrPath and the destination URL in args (e.g. appOrPath: "chrome", args: "https://www.apple.com/store"), or pass the full URL directly as appOrPath.',
    sensitive: true,
    parameters: {
      type: 'object',
      properties: {
        appOrPath: { type: 'string', description: 'Application name, executable, or full URL (e.g. "chrome", "notepad", "calc", "https://...").' },
        args: { type: 'string', description: 'Optional command-line arguments or destination URL (e.g. "https://www.apple.com/store").' }
      },
      required: ['appOrPath']
    }
  },
  {
    name: 'list_processes',
    description: 'List running Windows processes sorted by memory or CPU usage.',
    sensitive: false,
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of top processes to return (default 15).' },
        sortBy: { type: 'string', enum: ['memory', 'cpu'], description: 'Sort criteria.' }
      }
    }
  },
  {
    name: 'kill_process',
    description: 'Terminate a process by Process ID (PID) or Process Name.',
    sensitive: true,
    parameters: {
      type: 'object',
      properties: {
        processIdOrName: { type: 'string', description: 'PID number or process name (e.g. notepad).' }
      },
      required: ['processIdOrName']
    }
  },
  {
    name: 'get_listening_ports',
    description: 'Inspect active network ports listening on this machine and their owning processes.',
    sensitive: false,
    parameters: { type: 'object', properties: {} }
  },

  // Clipboard
  {
    name: 'get_clipboard',
    description: 'Read the current text content from the Windows clipboard.',
    sensitive: false,
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'set_clipboard',
    description: 'Copy text to the Windows clipboard.',
    sensitive: true,
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to place on clipboard.' }
      },
      required: ['text']
    }
  },

  // Notifications & Voice Speech
  {
    name: 'show_notification',
    description: 'Display a native Windows notification toast banner.',
    sensitive: false,
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Notification title.' },
        message: { type: 'string', description: 'Notification message.' }
      },
      required: ['title', 'message']
    }
  },
  {
    name: 'speak_text',
    description: 'Speak text aloud through the Windows PC speakers using Text-To-Speech (TTS).',
    sensitive: false,
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The text to speak.' },
        rate: { type: 'number', description: 'Speech rate (-10 to 10, default 0).' }
      },
      required: ['text']
    }
  },

  // Filesystem
  {
    name: 'search_files',
    description: 'Recursively search for files matching a pattern in a directory.',
    sensitive: false,
    parameters: {
      type: 'object',
      properties: {
        dir: { type: 'string', description: 'Directory path to search in.' },
        pattern: { type: 'string', description: 'File name pattern or extension.' },
        maxResults: { type: 'number', description: 'Max matching results to return (default 30).' }
      },
      required: ['pattern']
    }
  },
  {
    name: 'read_file',
    description: 'Read the contents of a local file on the computer.',
    sensitive: false,
    parameters: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Absolute or relative file path.' },
        maxLines: { type: 'number', description: 'Maximum lines to return (default 500).' }
      },
      required: ['filePath']
    }
  },
  {
    name: 'write_file',
    description: 'Create or overwrite a file on the computer with new content.',
    sensitive: true,
    parameters: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Target file path.' },
        content: { type: 'string', description: 'Content to write.' }
      },
      required: ['filePath', 'content']
    }
  },
  {
    name: 'list_directory',
    description: 'List files and subfolders in a specific Windows directory.',
    sensitive: false,
    parameters: {
      type: 'object',
      properties: {
        dirPath: { type: 'string', description: 'Directory path to list.' }
      }
    }
  },

  // System & Power
  {
    name: 'get_system_metrics',
    description: 'Get live Windows system health stats: CPU load, RAM usage, Disks, Battery, and Uptime.',
    sensitive: false,
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'set_volume',
    description: 'Adjust or mute the Windows master audio volume.',
    sensitive: false,
    parameters: {
      type: 'object',
      properties: {
        level: { type: 'string', description: '0 to 100, or "mute" / "unmute".' }
      },
      required: ['level']
    }
  },
  {
    name: 'power_action',
    description: 'Lock the workstation or put the PC into sleep mode.',
    sensitive: true,
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['lock', 'sleep'], description: 'Power action to take.' }
      },
      required: ['action']
    }
  },
  {
    name: 'get_active_window',
    description: 'Inspect the title and process of the currently active Windows application window.',
    sensitive: false,
    parameters: { type: 'object', properties: {} }
  },

  // Network & Diagnostics
  {
    name: 'ping_host',
    description: 'Ping a host or IP to measure latency and test network reachability.',
    sensitive: false,
    parameters: {
      type: 'object',
      properties: {
        host: { type: 'string', description: 'Hostname or IP (default 8.8.8.8).' }
      }
    }
  },
  {
    name: 'get_network_config',
    description: 'Inspect active network adapter IP addresses, gateways, and DNS servers.',
    sensitive: false,
    parameters: { type: 'object', properties: {} }
  },

  // Vision & GUI
  {
    name: 'capture_screen',
    description: 'Capture a live screenshot of the Windows desktop and return an image preview.',
    sensitive: false,
    parameters: {
      type: 'object',
      properties: {
        quality: { type: 'number', description: 'JPEG quality (default 75).' }
      }
    }
  },
  {
    name: 'mouse_click',
    description: 'Perform a mouse click or double click on the Windows screen.',
    sensitive: true,
    parameters: {
      type: 'object',
      properties: {
        button: { type: 'string', enum: ['left', 'right', 'double'], description: 'Mouse button to click.' },
        x: { type: 'number', description: 'X screen coordinate (optional).' },
        y: { type: 'number', description: 'Y screen coordinate (optional).' }
      }
    }
  },
  {
    name: 'type_text',
    description: 'Simulate typing text or sending keystrokes into the active Windows window.',
    sensitive: true,
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text or keys to type.' }
      },
      required: ['text']
    }
  },

  // Web
  {
    name: 'search_web',
    description: 'Search the live web using DuckDuckGo.',
    sensitive: false,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term.' },
        maxResults: { type: 'number', description: 'Max search results (default 5).' }
      },
      required: ['query']
    }
  },
  {
    name: 'fetch_web_content',
    description: 'Fetch and read clean text content from a web URL.',
    sensitive: false,
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Webpage URL to fetch.' }
      },
      required: ['url']
    }
  },

  // Documents & Office
  {
    name: 'create_word_document',
    description: 'Create an executive, professionally formatted Microsoft Word document (.docx) with cover styling, executive summary callout box, structured sections, embedded topic photos, and tables, and open it in Word.',
    sensitive: false,
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Document headline title' },
        subtitle: { type: 'string', description: 'Subtitle, domain, or classification' },
        summary: { type: 'string', description: 'Executive summary text placed in a highlighted callout box' },
        sections: {
          type: 'array',
          description: 'Detailed content sections',
          items: {
            type: 'object',
            properties: {
              heading: { type: 'string', description: 'Section heading title' },
              content: { type: 'string', description: 'Detailed paragraphs with facts, analysis, and data' },
              bullets: { type: 'array', items: { type: 'string' }, description: 'Substantive bullet points' }
            },
            required: ['heading', 'content']
          }
        },
        imageKeyword: { type: 'string', description: 'Topic keyword to automatically fetch and embed a relevant high-res photo' },
        content: { type: 'string', description: 'Fallback text content if sections not used' },
        filename: { type: 'string', description: 'Optional filename (e.g. Report.docx)' },
        openInWord: { type: 'boolean', description: 'Whether to open Word immediately (default true)' }
      },
      required: ['title']
    }
  },
  {
    name: 'create_powerpoint_presentation',
    description: 'Create an executive, professionally styled Microsoft PowerPoint presentation (.pptx) with 16:9 widescreen layout, custom color themes, automated topic photos, card containers, and structured key takeaways, and open it in PowerPoint.',
    sensitive: false,
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Main presentation title (e.g. Renewable Energy Revolution)' },
        subtitle: { type: 'string', description: 'Presentation subtitle or strategic focus' },
        theme: {
          type: 'string',
          enum: ['modern_dark', 'emerald_nature', 'corporate_blue', 'clean_light'],
          description: 'Visual color theme (modern_dark for tech/AI, emerald_nature for energy/sustainability, corporate_blue for business, clean_light for academic)'
        },
        slides: {
          type: 'array',
          description: 'List of 4 to 7 content slides with rich detail and mechanisms',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Slide header title' },
              bullets: {
                type: 'array',
                items: { type: 'string' },
                description: '3 to 5 substantive bullet points. Each bullet should include a bold lead-in followed by explanatory sentences with real-world mechanisms and data.'
              },
              keyTakeaway: { type: 'string', description: 'Highlighted summary sentence for the bottom takeaway banner' },
              imageKeyword: { type: 'string', description: 'Topic keyword to fetch and embed a relevant high-res photo on this slide' }
            },
            required: ['title', 'bullets']
          }
        },
        filename: { type: 'string', description: 'Optional filename (e.g. Presentation.pptx)' },
        openInPowerpoint: { type: 'boolean', description: 'Whether to launch PowerPoint immediately (default true)' }
      },
      required: ['title', 'slides']
    }
  },
  {
    name: 'create_excel_spreadsheet',
    description: 'Create a formatted Microsoft Excel spreadsheet (.xlsx) with styled header rows, calculated formula totals (SUM, AVERAGE), auto-fitted columns, and number formatting, and open it in Excel.',
    sensitive: false,
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Spreadsheet title' },
        sheetName: { type: 'string', description: 'Worksheet name (e.g. Financials, Performance)' },
        headers: { type: 'array', items: { type: 'string' }, description: 'Column header titles' },
        rows: {
          type: 'array',
          items: { type: 'array', items: {} },
          description: '2D array of data rows matching headers. Numeric values should be numbers, text as strings.'
        },
        includeTotals: { type: 'boolean', description: 'Whether to append an automated SUM/AVERAGE formula summary row (default true)' },
        currencyColumns: { type: 'array', items: { type: 'number' }, description: '0-indexed column indices to format as currency ($#,##0)' },
        percentColumns: { type: 'array', items: { type: 'number' }, description: '0-indexed column indices to format as percentage (0.0%)' },
        filename: { type: 'string', description: 'Optional filename (e.g. Budget.xlsx)' },
        openInExcel: { type: 'boolean', description: 'Whether to launch Excel immediately (default true)' }
      },
      required: ['title', 'headers', 'rows']
    }
  },
  {
    name: 'create_document',
    description: 'Create any document or file (.docx, .pptx, .xlsx, .txt, .csv, .md) and open it in its associated application.',
    sensitive: false,
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['pptx', 'docx', 'xlsx', 'txt', 'csv', 'md', 'html'], description: 'Document format' },
        title: { type: 'string', description: 'Title or subject' },
        content: { type: 'string', description: 'Document contents' },
        filename: { type: 'string', description: 'Filename' },
        openInApp: { type: 'boolean', description: 'Whether to open in the app immediately (default true)' }
      },
      required: ['title', 'content']
    }
  },

  // GUI & Third-Party App Automation
  {
    name: 'focus_window',
    description: 'Bring any application window to the active foreground by name or title (e.g. Notepad, Word, Chrome, Excel).',
    sensitive: false,
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Application name or window title to focus' }
      },
      required: ['target']
    }
  },
  {
    name: 'mouse_move',
    description: 'Move the mouse cursor to specific (x, y) coordinates on the screen.',
    sensitive: false,
    parameters: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X screen coordinate' },
        y: { type: 'number', description: 'Y screen coordinate' }
      },
      required: ['x', 'y']
    }
  },
  {
    name: 'send_key_press',
    description: 'Send hotkey combinations or special keys to the active window (e.g. ^s, ^c, ^v, {ENTER}, %{F4}, {ESC}, %{TAB}).',
    sensitive: true,
    parameters: {
      type: 'object',
      properties: {
        keyString: { type: 'string', description: 'Special key or hotkey syntax' }
      },
      required: ['keyString']
    }
  },
  {
    name: 'automate_gui',
    description: 'Execute an atomic sequence of GUI actions (focus window, move cursor, click, type text, press hotkeys) in a single ultra-fast execution on any third-party app.',
    sensitive: true,
    parameters: {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          description: 'Ordered list of actions to execute at superhuman speed',
          items: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['focus', 'move', 'click', 'type', 'press', 'wait'] },
              target: { type: 'string', description: 'Target window name for focus' },
              x: { type: 'number', description: 'X coordinate' },
              y: { type: 'number', description: 'Y coordinate' },
              button: { type: 'string', enum: ['left', 'right', 'double'] },
              text: { type: 'string', description: 'Text to type/paste' },
              key: { type: 'string', description: 'Hotkey to press' },
              ms: { type: 'number', description: 'Wait duration in ms' }
            },
            required: ['action']
          }
        }
      },
      required: ['steps']
    }
  }
];

/**
 * Intelligently select relevant tools based on the user's prompt to avoid
 * overwhelming local LLMs with 20+ schemas at once.
 */
export function selectRelevantTools(prompt = '', allTools = TOOL_DEFINITIONS) {
  const p = (prompt || '').toLowerCase();
  const selected = new Set();

  // Screen capture
  if (p.match(/\b(screen|screenshot|capture|snapshot|display|monitor)\b/)) {
    selected.add('capture_screen');
  }

  // Presentations & PowerPoint (PPT, PPTX, Slides, Decks)
  if (p.match(/\b(ppt|pptx|powerpoint|presentation|slide|slides|deck|slideshow)\b/)) {
    selected.add('create_powerpoint_presentation');
    selected.add('create_document');
    selected.add('launch_app');
  }

  // Documents & Office (MS Word, Docs, Reports)
  if (p.match(/\b(word|docx|doc|document|documents|report|essay|letter|memo|write-up|writeup|notes|create.*doc)\b/)) {
    selected.add('create_word_document');
    selected.add('create_document');
    selected.add('launch_app');
  }

  // Spreadsheets & Excel (XLSX, Sheets, Financials, Tables, Budget)
  if (p.match(/\b(excel|xlsx|spreadsheet|spreadsheets|sheet|sheets|tabular|table|budget|financials|ledger|balance sheet)\b/)) {
    selected.add('create_excel_spreadsheet');
    selected.add('create_document');
    selected.add('launch_app');
  }

  // GUI, Cursor, Keyboard & Automation
  if (p.match(/\b(mouse|cursor|pointer|click|type|typing|press|keyboard|key|keys|hotkey|shortcut|automate|gui)\b/)) {
    selected.add('mouse_click');
    selected.add('mouse_move');
    selected.add('type_text');
    selected.add('send_key_press');
    selected.add('focus_window');
    selected.add('automate_gui');
  }

  // Third-party applications, Browsers & Window management
  if (p.match(/\b(app|apps|application|program|third party|third-party|software|window|windows|switch to|open|launch|start|notepad|calc|calculator|chrome|word|excel|vscode|vlc|edge|msedge|firefox|brave|browser|navigate|go to|browse|website|site|store|apple|google|youtube|amazon|github)\b/)) {
    selected.add('launch_app');
    selected.add('focus_window');
    selected.add('automate_gui');
    selected.add('type_text');
    selected.add('mouse_click');
    selected.add('send_key_press');
  }

  // Hardware & Specs
  if (p.match(/\b(specs|hardware|laptop|pc|computer|model|brand|manufacturer|device|machine|cpu|processor|ram|memory|windows|os|version|disk|storage|drive|battery|uptime|spec)\b/)) {
    selected.add('get_system_metrics');
    selected.add('run_command');
  }

  // Shell & Commands
  if (p.match(/\b(command|powershell|cmd|terminal|script|run|execute|wmic|dir|echo)\b/)) {
    selected.add('run_command');
  }

  // Processes & Tasks
  if (p.match(/\b(process|processes|task|tasks|kill|running|terminate|pid)\b/)) {
    selected.add('list_processes');
    selected.add('kill_process');
  }

  // Clipboard
  if (p.match(/\b(clipboard|copy|paste)\b/)) {
    selected.add('get_clipboard');
    selected.add('set_clipboard');
  }

  // Notifications & Speech
  if (p.match(/\b(notify|notification|toast|alert)\b/)) {
    selected.add('show_notification');
  }
  if (p.match(/\b(speak|tts|voice|say aloud|read aloud)\b/)) {
    selected.add('speak_text');
  }

  // Files & Directories
  if (p.match(/\b(file|files|folder|dir|search file|find file|read file|write file)\b/)) {
    selected.add('search_files');
    selected.add('read_file');
    selected.add('write_file');
    selected.add('list_directory');
  }

  // Web search
  if (p.match(/\b(web|search|google|internet|browse|latest|newest|price|weather|who is|what is|news|today|release)\b/)) {
    selected.add('search_web');
    selected.add('fetch_web_content');
  }

  // System controls
  if (p.match(/\b(volume|sound|audio|mute|unmute)\b/)) {
    selected.add('set_volume');
  }
  if (p.match(/\b(ip|network|ping|adapter|port|ports|connection|reach)\b/)) {
    selected.add('ping_host');
    selected.add('get_network_config');
    selected.add('get_listening_ports');
  }
  if (p.match(/\b(lock|sleep|shutdown)\b/)) {
    selected.add('power_action');
  }

  // If specific matches found, return only those tools
  if (selected.size > 0) {
    return allTools.filter((t) => selected.has(t.name));
  }

  // Otherwise default to 5 core versatile tools
  const coreTools = ['run_command', 'search_web', 'get_system_metrics', 'launch_app', 'create_document'];
  return allTools.filter((t) => coreTools.includes(t.name));
}

/**
 * Fallback intent classifier: Detects unambiguous direct system automation commands
 * from the user prompt when a lightweight local LLM fails to emit structured tool JSON.
 */
export function detectActionIntent(prompt = '') {
  let p = (prompt || '').trim();
  // Strip common courtesy prefixes
  p = p.replace(/^(?:please\s+|can\s+you\s+(?:please\s+)?|could\s+you\s+(?:please\s+)?|i\s+want\s+you\s+to\s+|hey\s+(?:assistant\s*)?|assistant\s*,\s*)/i, '').trim();
  const lower = p.toLowerCase();

  // 1. Browser launch & navigation (e.g. "open chrome and navigate to apple store", "launch edge and go to youtube")
  const navMatch =
    lower.match(/(?:open|launch)\s+(chrome|edge|msedge|firefox|brave|browser)\b.*?(?:navigate|go|head)\s+to\s+(.+)/i) ||
    lower.match(/(?:navigate|go)\s+to\s+(.+?)\s+(?:in|on|with|using)\s+(chrome|edge|msedge|firefox|brave|browser)/i);
  if (navMatch) {
    const browser = navMatch[1].toLowerCase() === 'browser' ? 'chrome' : navMatch[1];
    const destination = navMatch[2].trim();
    const url = resolveWebDestination(destination);
    return [{
      name: 'launch_app',
      arguments: {
        appOrPath: browser,
        args: url
      }
    }];
  }

  // Direct website navigation (e.g. "open apple store", "go to youtube", "open amazon")
  const directWebMatch = lower.match(
    /^(?:open|launch|go to|navigate to|browse to)\s+(apple store|youtube|google|amazon|github|reddit|netflix|spotify|twitter|x|wikipedia|chatgpt|openai|claude|gemini|https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.(?:com|org|net|io|edu|gov)(?:\/[^\s]*)?)$/i
  );
  if (directWebMatch) {
    const destination = directWebMatch[1].trim();
    const url = resolveWebDestination(destination);
    return [{
      name: 'launch_app',
      arguments: {
        appOrPath: 'chrome',
        args: url
      }
    }];
  }

  // 1b. Compound app launch + type/write (e.g. "open chrome and type I am AI", "open notepad and type hello")
  const compoundMatch =
    p.match(/^(?:open|launch|start)\s+([a-zA-Z0-9_\-\.]+)\s+(?:and\s+)?(?:type|enter|write)\s+["'“](.+?)["'”]/i) ||
    p.match(/^(?:open|launch|start)\s+([a-zA-Z0-9_\-\.]+)\s+(?:and\s+)?(?:type|enter|write)\s+(.+)$/i);
  if (compoundMatch) {
    let app = compoundMatch[1].toLowerCase();
    if (app === 'calculator') app = 'calc';
    if (app === 'word') app = 'winword';
    const textToType = compoundMatch[2].trim();

    return [
      { name: 'launch_app', arguments: { appOrPath: app } },
      { name: 'focus_window', arguments: { target: app } },
      { name: 'type_text', arguments: { text: textToType } }
    ];
  }

  // 2. Direct desktop app launch: "open notepad", "launch calc", "open calculator"
  const appMatch = lower.match(/^(?:open|launch|start)\s+([a-zA-Z0-9_\-\.]+)(?:\.exe)?$/i);
  if (appMatch) {
    let app = appMatch[1].toLowerCase();
    if (app === 'calculator') app = 'calc';
    if (app === 'word') app = 'winword';
    return [{
      name: 'launch_app',
      arguments: {
        appOrPath: app
      }
    }];
  }

  // 3. Screen capture
  if (lower.match(/\b(take.*screenshot|capture.*screen|screenshot.*desktop|desktop.*snapshot)\b/i)) {
    return [{
      name: 'capture_screen',
      arguments: {}
    }];
  }

  // 4. Volume / Sound
  if (lower.match(/\b(mute\s+(?:audio|sound|pc|volume)|mute)\b/i)) {
    return [{
      name: 'set_volume',
      arguments: { level: 'mute' }
    }];
  }
  if (lower.match(/\b(unmute\s+(?:audio|sound|pc|volume)|unmute)\b/i)) {
    return [{
      name: 'set_volume',
      arguments: { level: 'unmute' }
    }];
  }

  // 5. System metrics / specs
  if (lower.match(/\b(specs|system metrics|hardware specs|pc specs|what are my specs)\b/i)) {
    return [{
      name: 'get_system_metrics',
      arguments: {}
    }];
  }

  return [];
}

export class AgentOrchestrator {
  constructor(options = {}) {
    this.safetyMode = options.safetyMode || 'tiered'; // 'tiered' or 'yolo'
    this.persona = options.persona || 'general';
    this.pendingApprovals = new Map();
  }

  resolveApproval(approvalId, isApproved) {
    const item = this.pendingApprovals.get(approvalId);
    if (!item) return false;
    this.pendingApprovals.delete(approvalId);
    item.resolve(isApproved);
    return true;
  }

  /**
   * Classifies which specialized sub-agent handles this tool.
   */
  classifySubagent(toolName) {
    if (['mouse_click', 'mouse_move', 'type_text', 'send_key_press', 'focus_window', 'automate_gui', 'capture_screen', 'get_active_window'].includes(toolName)) {
      return { id: 'gui_subagent', name: 'GUI & Automation Sub-agent' };
    }
    if (['create_word_document', 'create_powerpoint_presentation', 'create_excel_spreadsheet', 'create_document', 'launch_app', 'list_processes', 'kill_process', 'write_file', 'read_file', 'search_files', 'list_directory'].includes(toolName)) {
      return { id: 'doc_app_subagent', name: 'Document & App Sub-agent' };
    }
    return { id: 'system_subagent', name: 'System & Research Sub-agent' };
  }

  /**
   * Execute multiple tool calls sequentially via specialized sub-agents.
   * Ensures chronological order for app launches, window focusing, and typing.
   */
  async executeSubagentWorkers(toolCalls, onProgress, onApprovalRequired) {
    if (!toolCalls || toolCalls.length === 0) return [];

    const results = [];
    for (let index = 0; index < toolCalls.length; index++) {
      const call = toolCalls[index];
      const subagent = this.classifySubagent(call.name);
      const workerId = `${subagent.id}_${index + 1}`;
      if (onProgress) {
        onProgress({
          workerId,
          subagentName: subagent.name,
          tool: call.name,
          status: 'running'
        });
      }
      const result = await this.executeTool(call.name, call.arguments, onApprovalRequired);
      if (onProgress) {
        onProgress({
          workerId,
          subagentName: subagent.name,
          tool: call.name,
          status: 'completed',
          result
        });
      }
      results.push({
        id: call.id || `call_${Date.now()}_${index}`,
        name: call.name,
        subagentName: subagent.name,
        arguments: call.arguments,
        result
      });

      // If an application was just launched and more actions follow (like typing/hotkey), pause to ensure GUI focus settles
      if (call.name === 'launch_app' && index < toolCalls.length - 1) {
        await new Promise((r) => setTimeout(r, 700));
      }
    }
    return results;
  }

  async executeTool(toolName, input = {}, onApprovalRequired) {
    const toolDef = TOOL_DEFINITIONS.find((t) => t.name === toolName);
    if (!toolDef) {
      return { error: `Tool '${toolName}' not found` };
    }

    // When safetyMode is 'yolo', user has granted every permission; never pause for approval!
    if (toolDef.sensitive && this.safetyMode !== 'yolo') {
      const approvalId = `appr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const approvalPromise = new Promise((resolve) => {
        this.pendingApprovals.set(approvalId, { resolve, tool: toolName, input });
      });

      if (onApprovalRequired) {
        onApprovalRequired({
          approvalId,
          toolName,
          input,
          description: toolDef.description
        });
      }

      const approved = await approvalPromise;
      if (!approved) {
        return {
          cancelled: true,
          message: `User rejected execution of ${toolName}`
        };
      }
    }

    // Tool execution switch
    switch (toolName) {
      // Document & Office tools
      case 'create_word_document':
        return await createWordDocument(input);
      case 'create_powerpoint_presentation':
        return await createPowerpointPresentation(input);
      case 'create_excel_spreadsheet':
        return await createExcelSpreadsheet(input);
      case 'create_document':
        return await createDocument(input);

      // GUI, Cursor, Keyboard & Third-Party App tools
      case 'focus_window':
        return await focusWindow(input.target);
      case 'mouse_move':
        return await mouseMove(input.x, input.y);
      case 'mouse_click':
        return await mouseClick(input.button, input.x, input.y);
      case 'type_text':
        return await typeText(input.text, input.forceKeystrokes);
      case 'send_key_press':
        return await sendKeyPress(input.keyString);
      case 'automate_gui':
        return await automateGui(input.steps);

      // Shell & Execution
      case 'run_command':
        return await executeCommand(input.command, input.shellType || 'powershell');
      case 'launch_app': {
        const app = input.appOrPath || input.app || input.application || input.target || '';
        const args = input.args || input.url || input.arguments || input.destination || '';
        return await launchApp(app, args);
      }
      case 'list_processes':
        return await listProcesses(input.limit, input.sortBy);
      case 'kill_process':
        return await killProcess(input.processIdOrName);
      case 'get_listening_ports':
        return await getListeningPorts();
      case 'get_clipboard':
        return await getClipboard();
      case 'set_clipboard':
        return await setClipboard(input.text);
      case 'show_notification':
        return await showNotification(input.title, input.message);
      case 'speak_text':
        return await speakText(input.text, input.rate);
      case 'search_files':
        return await searchFiles(input.dir, input.pattern, input.maxResults);
      case 'read_file':
        return await readFile(input.filePath, input.maxLines);
      case 'write_file':
        return await writeFile(input.filePath, input.content);
      case 'list_directory':
        return await listDirectory(input.dirPath);
      case 'get_system_metrics':
        return await getSystemMetrics();
      case 'set_volume':
        return await setVolume(input.level);
      case 'power_action':
        return await powerAction(input.action);
      case 'get_active_window':
        return await getActiveWindow();
      case 'ping_host':
        return await pingHost(input.host);
      case 'get_network_config':
        return await getNetworkConfig();
      case 'capture_screen':
        return await captureDesktopScreenshot(input.quality);
      case 'search_web':
        return await searchWeb(input.query, input.maxResults);
      case 'fetch_web_content':
        return await fetchWebContent(input.url);
      default:
        return { error: `Unhandled tool ${toolName}` };
    }
  }

  async getSystemPrompt(persona = this.persona, customHw = null) {
    const hw = customHw || (await getHardwareProfile());

    const personaInstruction =
      persona === 'coder'
        ? 'You are acting as an elite software engineering copilot. Focus on writing clean code, running builds, inspecting git repos, and debugging scripts.'
        : persona === 'admin'
        ? 'You are acting as a Windows system administrator. Focus on hardware health, performance tuning, process management, and network troubleshooting.'
        : persona === 'researcher'
        ? 'You are acting as a deep web intelligence researcher. Focus on multi-query search, fact synthesis, and summarizing webpage content.'
        : 'You are an all-purpose autonomous Personal Assistant operating directly on the user’s Windows workstation with full system automation powers.';

    return `You are "Personal Assistant", an ultra-fast, autonomous AI assistant operating on the user's Windows PC.

HOST WORKSTATION ENVIRONMENT (Dynamically queried from Windows CIM/WMI):
• Operating System: ${hw.os} (Build ${hw.osVersion})
• Computer Hardware: ${hw.manufacturer} - ${hw.model}
• CPU / Processor: ${hw.processor}
• Physical RAM: ${hw.totalRamGB} GB
• Host Computer Name: ${hw.hostName}

${personaInstruction}

CRITICAL ACTION-FIRST DIRECTIVE:
1. When the user asks you to perform an action (e.g. create a PowerPoint presentation, create an MS Word or other document, interact with any third-party app, use the keyboard or mouse cursor, open a program, or inspect PC specs):
   DO NOT JUST GIVE ADVICE, INSTRUCTIONS, OR MANUAL STEPS!
   YOU MUST IMMEDIATELY INVOKE THE CORRESPONDING AUTOMATION TOOL to perform the task directly for the user!
2. Professional Office Suite & Document Creation Standards:
   • You HAVE full native Microsoft Office automation powers on this Windows workstation via COM (PowerPoint, Word, Excel).
   • You CAN directly create:
     - Microsoft PowerPoint presentations (.pptx) via \`create_powerpoint_presentation\`
     - Microsoft Word documents (.docx) via \`create_word_document\`
     - Microsoft Excel spreadsheets (.xlsx) via \`create_excel_spreadsheet\`
   • NEVER say: "I am an AI language model with no graphical user interface capabilities like PowerPoint, I cannot directly create a PPT presentation".
   • NEVER provide manual instructions (e.g. "1. Open PowerPoint, 2. Create blank slide deck...") when the user asks you to create a presentation, document, or spreadsheet!
   • When the user asks to create or make a PPT / presentation:
     - YOU MUST IMMEDIATELY CALL \`create_powerpoint_presentation\`!
     - Pick an appropriate visual theme (\`emerald_nature\` for renewable energy/environment, \`modern_dark\` for tech/AI, \`corporate_blue\` for business/strategy, \`clean_light\` for academic).
     - Provide 4 to 7 comprehensive slides.
     - Each slide MUST feature 3 to 5 substantive, deeply informative bullet points. Each bullet MUST include a **Bold Concept Lead-in** followed by 1 to 2 detailed explanatory sentences with real-world mechanisms, technological breakthroughs, and figures.
     - NEVER write superficial 1-line notes like "What is it?" or "Why it matters".
     - ALWAYS supply an \`imageKeyword\` for content slides so high-resolution topic photos are automatically fetched and embedded.
     - ALWAYS supply a \`keyTakeaway\` for each slide.
   • When the user asks to create a document or report in Word:
     - Call \`create_word_document\` with executive \`title\`, \`summary\`, structured \`sections\` (each with \`heading\`, analytical \`content\`, and \`bullets\`), and \`imageKeyword\`.
   • When the user asks to create a spreadsheet or table in Excel:
     - Call \`create_excel_spreadsheet\` with meaningful \`headers\`, 4-10 populated data \`rows\` with real numbers and text, and appropriate \`currencyColumns\` or \`percentColumns\`.
3. Browser Navigation & Web Launching Standards:
   • When the user asks to open a browser and/or navigate or go to a website or store (e.g. "Open chrome and navigate to apple store", "go to youtube", "open amazon"):
     - YOU MUST CALL \`launch_app\` with \`appOrPath: 'chrome'\` (or the requested browser or URL) and \`args: 'https://www.apple.com/store'\` (or the target website URL).
      - You can also pass the full website URL directly as \`appOrPath\` (e.g. \`launch_app(appOrPath='https://www.apple.com/store')\`), which automatically opens the user's browser directly to the site.
4. Compound Launch & Typing Instructions:
   • When the user asks to open an application and type/enter text (e.g. 'Open chrome and type "I am AI"', 'open notepad and write hello'):
     - YOU MUST emit separate tool calls in sequence:
       1. \`launch_app(appOrPath='chrome')\` (NEVER pass the text to type as the \`args\` parameter of \`launch_app\`!)
       2. \`focus_window(target='chrome')\`
       3. \`type_text(text='I am AI')\`
5. You have full permissions and capabilities to create presentations, documents, and spreadsheets (create_powerpoint_presentation, create_word_document, create_excel_spreadsheet, create_document), launch third-party apps and navigate websites (launch_app), bring windows to the front (focus_window), control keyboard and mouse cursor at superhuman speeds (mouse_move, mouse_click, type_text, send_key_press, automate_gui), and run system commands.
6. Reasoning & Thinking Guidance:
   • Utilize your internal chain-of-thought to thoroughly plan presentation slides, analyze data, and ensure deeply insightful, high-value content.
   • For desktop automation actions (e.g. opening apps, controlling volume, system diagnostics): keep reasoning brief and execute the tool call directly. NEVER debate benchmark graders or evaluation prompts in your response!
7. Conversational Questions: When the user asks a general knowledge question, explanation, or fact without asking to create or perform an action on their PC, answer directly in clean Markdown without tools.
8. Formatting: Never output raw <prompt> tags, never roleplay as the user, and present your answers in clean, well-formatted Markdown with bold highlights, bulleted lists, and formatted code blocks where appropriate.`;
  }
}
