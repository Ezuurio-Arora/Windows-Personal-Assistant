class WindowItem {
  final String title;
  final String process;
  final int pid;
  final String hwnd;
  final bool isActive;

  const WindowItem({
    required this.title,
    required this.process,
    required this.pid,
    required this.hwnd,
    this.isActive = false,
  });

  factory WindowItem.fromJson(Map<String, dynamic> json, {bool isActive = false}) {
    return WindowItem(
      title: json['title'] as String? ?? 'Untitled Window',
      process: json['process'] as String? ?? 'Unknown',
      pid: json['pid'] as int? ?? 0,
      hwnd: json['hwnd']?.toString() ?? '0x00000000',
      isActive: isActive || (json['isActive'] as bool? ?? false),
    );
  }

  Map<String, dynamic> toJson() => {
    'title': title,
    'process': process,
    'pid': pid,
    'hwnd': hwnd,
    'isActive': isActive,
  };
}

class WindowListResponse {
  final WindowItem? activeWindow;
  final List<WindowItem> windows;

  const WindowListResponse({
    this.activeWindow,
    required this.windows,
  });

  factory WindowListResponse.fromJson(Map<String, dynamic> json) {
    final activeJson = json['activeWindow'] as Map<String, dynamic>?;
    final active = activeJson != null
        ? WindowItem.fromJson(activeJson, isActive: true)
        : null;

    final rawList = json['windows'] as List<dynamic>? ?? [];
    final list = rawList
        .map((w) => WindowItem.fromJson(w as Map<String, dynamic>))
        .toList();

    return WindowListResponse(activeWindow: active, windows: list);
  }

  Map<String, dynamic> toJson() => {
    if (activeWindow != null) 'activeWindow': activeWindow!.toJson(),
    'windows': windows.map((w) => w.toJson()).toList(),
  };
}
