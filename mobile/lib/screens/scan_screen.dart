import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';
import '../providers/connection_provider.dart';
import '../theme/gemini_theme.dart';

class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  final TextEditingController _pinController = TextEditingController();
  late final TextEditingController _ipController;
  final MobileScannerController _scannerController = MobileScannerController();
  bool _isProcessing = false;

  @override
  void initState() {
    super.initState();
    final defaultIp = context.read<ConnectionProvider>().targetHostIp;
    _ipController = TextEditingController(text: defaultIp.isNotEmpty ? defaultIp : '192.168.10.139');
  }

  @override
  void dispose() {
    _pinController.dispose();
    _ipController.dispose();
    _scannerController.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) async {
    if (_isProcessing) return;
    final conn = context.read<ConnectionProvider>();
    if (conn.status == ConnectionStatus.pairing || conn.status == ConnectionStatus.connecting) {
      return;
    }

    final barcodes = capture.barcodes;
    if (barcodes.isEmpty) return;

    final rawValue = barcodes.first.rawValue;
    if (rawValue == null || rawValue.trim().isEmpty) return;

    setState(() => _isProcessing = true);
    await HapticFeedback.mediumImpact();

    final success = await conn.pairWithQr(rawValue);
    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Row(
            children: [
              Icon(Icons.check_circle, color: Colors.white, size: 20),
              SizedBox(width: 10),
              Text('Successfully paired with Desktop Hub!'),
            ],
          ),
          backgroundColor: GeminiColors.success,
          duration: Duration(seconds: 2),
        ),
      );
      Navigator.of(context).maybePop();
    } else {
      setState(() => _isProcessing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.error_outline, color: Colors.white, size: 20),
              const SizedBox(width: 10),
              Expanded(child: Text(conn.errorMessage ?? 'Pairing failed.')),
            ],
          ),
          backgroundColor: GeminiColors.emergencyDanger,
          duration: const Duration(seconds: 4),
        ),
      );
    }
  }

  Future<void> _submitPin() async {
    final pin = _pinController.text.trim();
    if (pin.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a full 6-digit PIN.'),
          backgroundColor: GeminiColors.emergencyDanger,
        ),
      );
      return;
    }

    if (_isProcessing) return;
    final conn = context.read<ConnectionProvider>();
    if (conn.status == ConnectionStatus.pairing || conn.status == ConnectionStatus.connecting) {
      return;
    }

    setState(() => _isProcessing = true);
    await HapticFeedback.mediumImpact();
    FocusScope.of(context).unfocus();

    final customIp = _ipController.text.trim();
    final targetIp = customIp.isNotEmpty ? customIp : null;
    if (customIp.isNotEmpty) {
      conn.setTargetHostIp(customIp);
    }

    final success = await conn.pairWithPin(pin, targetIp: targetIp);
    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Row(
            children: [
              Icon(Icons.check_circle, color: Colors.white, size: 20),
              SizedBox(width: 10),
              Text('Successfully paired with Desktop Hub!'),
            ],
          ),
          backgroundColor: GeminiColors.success,
          duration: Duration(seconds: 2),
        ),
      );
      Navigator.of(context).maybePop();
    } else {
      setState(() => _isProcessing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.error_outline, color: Colors.white, size: 20),
              const SizedBox(width: 10),
              Expanded(child: Text(conn.errorMessage ?? 'PIN pairing failed.')),
            ],
          ),
          backgroundColor: GeminiColors.emergencyDanger,
          duration: const Duration(seconds: 4),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final conn = context.watch<ConnectionProvider>();

    return Scaffold(
      backgroundColor: GeminiColors.canvas,
      appBar: AppBar(
        title: const Text('Pair with Desktop Hub'),
        backgroundColor: GeminiColors.surfaceContainer,
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const SizedBox(height: 6),
              const Text(
                'Scan the QR code displayed on your Personal Assistant desktop window.',
                textAlign: TextAlign.center,
                style: TextStyle(color: GeminiColors.textMuted, fontSize: 13),
              ),
              const SizedBox(height: 16),

              // Camera Scanner Viewport
              Container(
                width: 250,
                height: 250,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: GeminiColors.primary, width: 2),
                  boxShadow: [
                    BoxShadow(
                      color: GeminiColors.primary.withOpacity(0.15),
                      blurRadius: 20,
                      spreadRadius: 2,
                    ),
                  ],
                ),
                clipBehavior: Clip.antiAlias,
                child: MobileScanner(
                  controller: _scannerController,
                  onDetect: _onDetect,
                ),
              ),
              const SizedBox(height: 20),

              // Target Host IP Configuration
              Container(
                width: 320,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                decoration: BoxDecoration(
                  color: GeminiColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: GeminiColors.border),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.dns_outlined, size: 20, color: GeminiColors.primary),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: _ipController,
                        style: const TextStyle(
                          color: GeminiColors.textPrimary,
                          fontSize: 14,
                          fontFamily: 'monospace',
                        ),
                        decoration: const InputDecoration(
                          isDense: true,
                          border: InputBorder.none,
                          labelText: 'Desktop Host IP',
                          labelStyle: TextStyle(color: GeminiColors.textMuted, fontSize: 11),
                          hintText: '192.168.10.139',
                          hintStyle: TextStyle(color: GeminiColors.textMuted),
                        ),
                        keyboardType: TextInputType.url,
                      ),
                    ),
                    const Tooltip(
                      message: 'Edit target host IP',
                      child: Icon(Icons.edit, size: 16, color: GeminiColors.textMuted),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // 6-Digit PIN fallback
              const Row(
                children: [
                  Expanded(child: Divider(color: GeminiColors.border)),
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: 12),
                    child: Text(
                      'OR USE 6-DIGIT PIN',
                      style: TextStyle(color: GeminiColors.textMuted, fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                  ),
                  Expanded(child: Divider(color: GeminiColors.border)),
                ],
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: 220,
                child: TextField(
                  controller: _pinController,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: GeminiColors.textPrimary,
                    fontSize: 26,
                    letterSpacing: 8,
                    fontWeight: FontWeight.bold,
                  ),
                  decoration: const InputDecoration(
                    counterText: '',
                    hintText: '000000',
                  ),
                  onChanged: (val) {
                    setState(() {});
                    if (val.trim().length == 6 && !_isProcessing) {
                      _submitPin();
                    }
                  },
                ),
              ),
              const SizedBox(height: 16),

              // Prominent "Connect with PIN" Button
              SizedBox(
                width: 240,
                height: 48,
                child: ElevatedButton.icon(
                  onPressed: (_isProcessing ||
                          conn.status == ConnectionStatus.pairing ||
                          _pinController.text.trim().length != 6)
                      ? null
                      : _submitPin,
                  icon: _isProcessing
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.link, size: 20),
                  label: Text(
                    _isProcessing ? 'Connecting...' : 'Connect with PIN',
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: GeminiColors.primary,
                    foregroundColor: Colors.black,
                    disabledBackgroundColor: GeminiColors.surfaceContainer,
                    disabledForegroundColor: GeminiColors.textMuted,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    elevation: 2,
                  ),
                ),
              ),

              if (conn.status == ConnectionStatus.pairing || _isProcessing) ...[
                const SizedBox(height: 20),
                const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(color: GeminiColors.primary, strokeWidth: 2),
                    ),
                    SizedBox(width: 10),
                    Text(
                      'Authenticating with Desktop Hub...',
                      style: TextStyle(color: GeminiColors.textMuted, fontSize: 13),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

