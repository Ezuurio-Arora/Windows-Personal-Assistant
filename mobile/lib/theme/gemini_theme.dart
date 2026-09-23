import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Authoritative Google Gemini 2.0 Dark Aesthetic Color Tokens
abstract class GeminiColors {
  // Canvases & Surfaces
  static const Color canvas = Color(0xFF131314);
  static const Color surfaceContainer = Color(0xFF1E1F20);
  static const Color elevatedCard = Color(0xFF282A2C);
  static const Color hover = Color(0xFF333538);
  static const Color border = Color(0xFF3C4043);

  // Gemini Signature Accents
  static const Color primary = Color(0xFF7DACF8);       // Gemini Blue
  static const Color primaryDark = Color(0xFF4182EB);   // Active Tap
  static const Color sparkleSecondary = Color(0xFFA8C7FA);
  static const Color sparklePale = Color(0xFFD3E3FD);
  static const Color lavenderMid = Color(0xFF9FA8DA);
  static const Color purpleProgress = Color(0xFFB87CF8); // Gemini Purple

  // Aliases for cross-spec compatibility
  static const Color accentBlue = primary;
  static const Color accentPurple = purpleProgress;

  // Status & Safety Accents
  static const Color emergencyDanger = Color(0xFFF28B82); // Killswitch & Error
  static const Color dangerRed = emergencyDanger;
  static const Color success = Color(0xFF81C995);          // Connected / Healthy
  static const Color successGreen = success;
  static const Color warning = Color(0xFFFDD663);          // Reconnecting / Tiered Alert
  static const Color warningYellow = warning;

  // Typography Tokens
  static const Color textPrimary = Color(0xFFE3E3E3);
  static const Color textMuted = Color(0xFF8E918F);

  // Gradient Signatures
  static const LinearGradient geminiGradient = LinearGradient(
    colors: [primary, lavenderMid, purpleProgress],
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
  );

  static const LinearGradient shimmerGradient = LinearGradient(
    colors: [
      Colors.transparent,
      Color(0x66FFFFFF),
      Colors.transparent,
    ],
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
  );
}

/// Geometric Corner Radii conforming to Gemini 2.0 Specifications
abstract class GeminiRadii {
  static const double rChatBubble = 18.0;
  static const double rCard = 24.0;
  static const double rPill = 32.0;
  static const double rControl = 14.0;

  static const BorderRadius chatBubble = BorderRadius.all(Radius.circular(rChatBubble));
  static const BorderRadius userChatBubble = BorderRadius.only(
    topLeft: Radius.circular(rChatBubble),
    topRight: Radius.circular(4.0),
    bottomLeft: Radius.circular(rChatBubble),
    bottomRight: Radius.circular(rChatBubble),
  );
  static const BorderRadius assistantChatBubble = BorderRadius.only(
    topLeft: Radius.circular(4.0),
    topRight: Radius.circular(rChatBubble),
    bottomLeft: Radius.circular(rChatBubble),
    bottomRight: Radius.circular(rChatBubble),
  );

  static const BorderRadius card = BorderRadius.all(Radius.circular(rCard));
  static const BorderRadius sheet = BorderRadius.only(
    topLeft: Radius.circular(rCard),
    topRight: Radius.circular(rCard),
  );
  static const BorderRadius pill = BorderRadius.all(Radius.circular(rPill));
  static const BorderRadius control = BorderRadius.all(Radius.circular(rControl));
}

/// ThemeExtension providing type-safe access to Gemini-specific tokens
@immutable
class GeminiThemeExtension extends ThemeExtension<GeminiThemeExtension> {
  final Color canvas;
  final Color surfaceContainer;
  final Color elevatedCard;
  final Color border;
  final Color primary;
  final Color purpleProgress;
  final Color emergencyDanger;
  final Color success;
  final Color warning;
  final Color textPrimary;
  final Color textMuted;
  final LinearGradient geminiGradient;

  const GeminiThemeExtension({
    required this.canvas,
    required this.surfaceContainer,
    required this.elevatedCard,
    required this.border,
    required this.primary,
    required this.purpleProgress,
    required this.emergencyDanger,
    required this.success,
    required this.warning,
    required this.textPrimary,
    required this.textMuted,
    required this.geminiGradient,
  });

  static const GeminiThemeExtension dark = GeminiThemeExtension(
    canvas: GeminiColors.canvas,
    surfaceContainer: GeminiColors.surfaceContainer,
    elevatedCard: GeminiColors.elevatedCard,
    border: GeminiColors.border,
    primary: GeminiColors.primary,
    purpleProgress: GeminiColors.purpleProgress,
    emergencyDanger: GeminiColors.emergencyDanger,
    success: GeminiColors.success,
    warning: GeminiColors.warning,
    textPrimary: GeminiColors.textPrimary,
    textMuted: GeminiColors.textMuted,
    geminiGradient: GeminiColors.geminiGradient,
  );

  @override
  GeminiThemeExtension copyWith({
    Color? canvas,
    Color? surfaceContainer,
    Color? elevatedCard,
    Color? border,
    Color? primary,
    Color? purpleProgress,
    Color? emergencyDanger,
    Color? success,
    Color? warning,
    Color? textPrimary,
    Color? textMuted,
    LinearGradient? geminiGradient,
  }) {
    return GeminiThemeExtension(
      canvas: canvas ?? this.canvas,
      surfaceContainer: surfaceContainer ?? this.surfaceContainer,
      elevatedCard: elevatedCard ?? this.elevatedCard,
      border: border ?? this.border,
      primary: primary ?? this.primary,
      purpleProgress: purpleProgress ?? this.purpleProgress,
      emergencyDanger: emergencyDanger ?? this.emergencyDanger,
      success: success ?? this.success,
      warning: warning ?? this.warning,
      textPrimary: textPrimary ?? this.textPrimary,
      textMuted: textMuted ?? this.textMuted,
      geminiGradient: geminiGradient ?? this.geminiGradient,
    );
  }

  @override
  GeminiThemeExtension lerp(ThemeExtension<GeminiThemeExtension>? other, double t) {
    if (other is! GeminiThemeExtension) return this;
    return GeminiThemeExtension(
      canvas: Color.lerp(canvas, other.canvas, t) ?? canvas,
      surfaceContainer: Color.lerp(surfaceContainer, other.surfaceContainer, t) ?? surfaceContainer,
      elevatedCard: Color.lerp(elevatedCard, other.elevatedCard, t) ?? elevatedCard,
      border: Color.lerp(border, other.border, t) ?? border,
      primary: Color.lerp(primary, other.primary, t) ?? primary,
      purpleProgress: Color.lerp(purpleProgress, other.purpleProgress, t) ?? purpleProgress,
      emergencyDanger: Color.lerp(emergencyDanger, other.emergencyDanger, t) ?? emergencyDanger,
      success: Color.lerp(success, other.success, t) ?? success,
      warning: Color.lerp(warning, other.warning, t) ?? warning,
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t) ?? textPrimary,
      textMuted: Color.lerp(textMuted, other.textMuted, t) ?? textMuted,
      geminiGradient: t < 0.5 ? geminiGradient : other.geminiGradient,
    );
  }
}

/// Convenience context extension for accessing Gemini tokens
extension GeminiThemeContext on BuildContext {
  GeminiThemeExtension get gemini =>
      Theme.of(this).extension<GeminiThemeExtension>() ?? GeminiThemeExtension.dark;
}

/// GeminiTheme master class
abstract class GeminiTheme {
  // Corner radii getters
  static const double bubbleRadius = GeminiRadii.rChatBubble;
  static const double cardRadius = GeminiRadii.rCard;
  static const double pillRadius = GeminiRadii.rPill;

  static ThemeData get darkTheme {
    TextTheme baseTextTheme;
    try {
      baseTextTheme = GoogleFonts.interTextTheme();
    } catch (_) {
      baseTextTheme = ThemeData.dark().textTheme;
    }

    final textTheme = baseTextTheme.copyWith(
      displayLarge: baseTextTheme.displayLarge?.copyWith(
        fontSize: 32.0,
        fontWeight: FontWeight.w700,
        color: GeminiColors.textPrimary,
      ),
      headlineMedium: baseTextTheme.headlineMedium?.copyWith(
        fontSize: 24.0,
        fontWeight: FontWeight.w600,
        color: GeminiColors.textPrimary,
      ),
      titleLarge: baseTextTheme.titleLarge?.copyWith(
        fontSize: 20.0,
        fontWeight: FontWeight.w600,
        color: GeminiColors.textPrimary,
      ),
      titleMedium: baseTextTheme.titleMedium?.copyWith(
        fontSize: 16.0,
        fontWeight: FontWeight.w600,
        color: GeminiColors.textPrimary,
      ),
      bodyLarge: baseTextTheme.bodyLarge?.copyWith(
        fontSize: 16.0,
        fontWeight: FontWeight.w400,
        color: GeminiColors.textPrimary,
      ),
      bodyMedium: baseTextTheme.bodyMedium?.copyWith(
        fontSize: 14.0,
        fontWeight: FontWeight.w400,
        color: GeminiColors.textPrimary,
      ),
      bodySmall: baseTextTheme.bodySmall?.copyWith(
        fontSize: 12.0,
        fontWeight: FontWeight.w400,
        color: GeminiColors.textMuted,
      ),
      labelLarge: baseTextTheme.labelLarge?.copyWith(
        fontSize: 14.0,
        fontWeight: FontWeight.w600,
        color: GeminiColors.textPrimary,
      ),
      labelMedium: baseTextTheme.labelMedium?.copyWith(
        fontSize: 12.0,
        fontWeight: FontWeight.w500,
        color: GeminiColors.textMuted,
      ),
      labelSmall: baseTextTheme.labelSmall?.copyWith(
        fontSize: 10.0,
        fontWeight: FontWeight.w500,
        color: GeminiColors.textMuted,
      ),
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: GeminiColors.canvas,
      colorScheme: const ColorScheme.dark(
        surface: GeminiColors.surfaceContainer,
        surfaceContainer: GeminiColors.surfaceContainer,
        surfaceContainerHigh: GeminiColors.elevatedCard,
        surfaceContainerHighest: GeminiColors.hover,
        primary: GeminiColors.primary,
        onPrimary: GeminiColors.canvas,
        primaryContainer: GeminiColors.primaryDark,
        secondary: GeminiColors.sparkleSecondary,
        secondaryContainer: GeminiColors.sparklePale,
        tertiary: GeminiColors.purpleProgress,
        tertiaryContainer: GeminiColors.lavenderMid,
        error: GeminiColors.emergencyDanger,
        onError: GeminiColors.canvas,
        outline: GeminiColors.border,
        outlineVariant: GeminiColors.border,
        onSurface: GeminiColors.textPrimary,
        onSurfaceVariant: GeminiColors.textMuted,
      ),
      cardTheme: CardThemeData(
        color: GeminiColors.elevatedCard,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: GeminiRadii.card,
          side: const BorderSide(color: GeminiColors.border, width: 1),
        ),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: GeminiColors.surfaceContainer,
        elevation: 0,
        scrolledUnderElevation: 0,
        iconTheme: IconThemeData(color: GeminiColors.textPrimary),
        titleTextStyle: TextStyle(
          color: GeminiColors.textPrimary,
          fontSize: 18.0,
          fontWeight: FontWeight.w600,
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: GeminiColors.surfaceContainer,
        indicatorColor: const Color(0x287DACF8), // Subtle #7DACF8 tint
        indicatorShape: const StadiumBorder(),
        labelTextStyle: MaterialStateProperty.resolveWith((states) {
          if (states.contains(MaterialState.selected)) {
            return const TextStyle(
              color: GeminiColors.primary,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            );
          }
          return const TextStyle(
            color: GeminiColors.textMuted,
            fontSize: 12,
            fontWeight: FontWeight.w400,
          );
        }),
        iconTheme: MaterialStateProperty.resolveWith((states) {
          if (states.contains(MaterialState.selected)) {
            return const IconThemeData(color: GeminiColors.primary);
          }
          return const IconThemeData(color: GeminiColors.textMuted);
        }),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: GeminiColors.surfaceContainer,
        border: OutlineInputBorder(
          borderRadius: GeminiRadii.pill,
          borderSide: const BorderSide(color: GeminiColors.border, width: 1),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: GeminiRadii.pill,
          borderSide: const BorderSide(color: GeminiColors.border, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: GeminiRadii.pill,
          borderSide: const BorderSide(color: GeminiColors.primary, width: 1.5),
        ),
        hintStyle: const TextStyle(color: GeminiColors.textMuted, fontSize: 14),
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      ),
      textTheme: textTheme,
      extensions: const <ThemeExtension<dynamic>>[
        GeminiThemeExtension.dark,
      ],
    );
  }
}
