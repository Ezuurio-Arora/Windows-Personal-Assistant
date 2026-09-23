import 'package:flutter/material.dart';
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
  final MobileScannerController _scannerController = MobileScannerController();
  bool _isProcessing = false;

  @override
  void dispose() {
    _pinController.dispose();
    _scannerController.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) async {
    if (_isProcessing) return;
    final barcodes = capture.barcodes;
    if (barcodes.isEmpty) return;

    final rawValue = barcodes.first.rawValue;
    if (rawValue == null || rawValue.isEmpty) return;

    setState(() => _isProcessing = true);
    final conn = context.read<ConnectionProvider>();
    final success = await conn.pairWithQr(rawValue);
    if (!mounted) return;

    if (!success) {
      setState(() => _isProcessing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(conn.errorMessage ?? 'Pairing failed.'),
          backgroundColor: GeminiColors.emergencyDanger,
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
              const SizedBox(height: 10),
              const Text(
                'Scan the QR code displayed on your Personal Assistant desktop window.',
                textAlign: TextAlign.center,
                style: TextStyle(color: GeminiColors.textMuted, fontSize: 14),
              ),
              const SizedBox(height: 20),

              // Camera Scanner Viewport
              Container(
                width: 260,
                height: 260,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: GeminiColors.primary, width: 2),
                ),
                clipBehavior: Clip.antiAlias,
                child: MobileScanner(
                  controller: _scannerController,
                  onDetect: _onDetect,
                ),
              ),
              const SizedBox(height: 30),

              // 6-Digit PIN fallback
              const Row(
                children: [
                  Expanded(child: Divider(color: GeminiColors.border)),
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: 12),
                    child: Text('OR USE 6-DIGIT PIN', style: TextStyle(color: GeminiColors.textMuted, fontSize: 12)),
                  ),
                  Expanded(child: Divider(color: GeminiColors.border)),
                ],
              ),
              const SizedBox(height: 20),
              Container(
                width: 220,
                child: TextField(
                  controller: _pinController,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: GeminiColors.textPrimary,
                    fontSize: 24,
                    letterSpacing: 8,
                    fontWeight: FontWeight.bold,
                  ),
                  decoration: const InputDecoration(
                    counterText: '',
                    hintText: '000000',
                  ),
                ),
              ),
              const SizedBox(height: 16),
              if (conn.status == ConnectionStatus.pairing || _isProcessing)
                const CircularProgressIndicator(color: GeminiColors.primary),
            ],
          ),
        ),
      ),
    );
  }
}
