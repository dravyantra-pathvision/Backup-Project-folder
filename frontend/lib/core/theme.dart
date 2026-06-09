import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static const Color primaryBlue = Color(0xFF1d4ed8); // Brand
  static const Color background = Color(0xFFf1f5f9); // Body BG
  static const Color surface = Colors.white; // Card BG
  static const Color textPrimary = Color(0xFF0f172a); // Text Primary
  static const Color textSecondary = Color(0xFF475569); // Text Secondary
  static const Color success = Color(0xFF16a34a); // Success
  static const Color warning = Color(0xFFd97706); // Warning
  static const Color danger = Color(0xFFdc2626); // Danger
  
  // Aliases for backward compatibility to prevent build errors
  static const Color ecoGreen = success;
  static const Color accentLeaf = Color(0xFFbfdbfe); // Info border

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primaryBlue,
        primary: primaryBlue,
        secondary: accentLeaf,
        surface: surface,
      ),
      scaffoldBackgroundColor: background,
      textTheme: GoogleFonts.outfitTextTheme().copyWith(
        displayLarge: GoogleFonts.outfit(color: textPrimary, fontWeight: FontWeight.w700),
        displayMedium: GoogleFonts.outfit(color: textPrimary, fontWeight: FontWeight.w600),
        bodyLarge: GoogleFonts.outfit(color: textPrimary),
        bodyMedium: GoogleFonts.outfit(color: textSecondary),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: surface,
        foregroundColor: textPrimary,
        elevation: 0,
        centerTitle: false,
      ),
      cardTheme: CardTheme(
        color: surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: Color(0xFFe2e8f0)), // --border
        ),
      ),
    );
  }
}
