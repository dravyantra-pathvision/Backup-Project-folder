import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'theme.dart';

class DialogUtils {
  static Future<void> showSuccessAnimation(BuildContext context, String message) async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.white,
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(LucideIcons.checkCircle, color: AppTheme.success, size: 64),
            const SizedBox(height: 16),
            Text(message, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18), textAlign: TextAlign.center),
          ],
        ),
      ),
    );
    await Future.delayed(const Duration(seconds: 2));
    if (context.mounted) {
      Navigator.of(context, rootNavigator: true).pop(); // close dialog
    }
  }
}
