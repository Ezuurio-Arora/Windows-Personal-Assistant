import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:personal_assistant/theme/gemini_theme.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;
  group('Gemini 2.0 Theme Tests', () {
    test('Gemini 2.0 Color Tokens match exact hex values', () {
      expect(GeminiColors.canvas.value, equals(0xFF131314));
      expect(GeminiColors.surfaceContainer.value, equals(0xFF1E1F20));
      expect(GeminiColors.elevatedCard.value, equals(0xFF282A2C));
      expect(GeminiColors.border.value, equals(0xFF3C4043));
      expect(GeminiColors.primary.value, equals(0xFF7DACF8));
      expect(GeminiColors.purpleProgress.value, equals(0xFFB87CF8));
      expect(GeminiColors.emergencyDanger.value, equals(0xFFF28B82));
      expect(GeminiColors.success.value, equals(0xFF81C995));
      expect(GeminiColors.textPrimary.value, equals(0xFFE3E3E3));
      expect(GeminiColors.textMuted.value, equals(0xFF8E918F));
    });

    test('Gemini Corner Radii match specifications', () {
      expect(GeminiRadii.rChatBubble, equals(18.0));
      expect(GeminiRadii.rCard, equals(24.0));
      expect(GeminiRadii.rPill, equals(32.0));
      expect(GeminiTheme.bubbleRadius, equals(18.0));
      expect(GeminiTheme.cardRadius, equals(24.0));
      expect(GeminiTheme.pillRadius, equals(32.0));
    });

    test('GeminiTheme.darkTheme generates valid Material 3 theme', () {
      final theme = GeminiTheme.darkTheme;
      expect(theme.useMaterial3, isTrue);
      expect(theme.brightness, equals(Brightness.dark));
      expect(theme.scaffoldBackgroundColor, equals(GeminiColors.canvas));
      expect(theme.colorScheme.primary, equals(GeminiColors.primary));
      expect(theme.cardTheme.color, equals(GeminiColors.elevatedCard));
      expect(theme.extension<GeminiThemeExtension>(), isNotNull);
    });
  });
}
