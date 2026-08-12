import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';
import '../core/theme.dart';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:provider/provider.dart';
import '../models/engine.dart';
import '../core/dialogs.dart';

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _pass = TextEditingController();
  final _confirmPass = TextEditingController();
  bool _isLoading = false;
  bool _obscurePass = true;
  bool _obscureConfirmPass = true;
  bool _agreedToTerms = false; // Checkbox state for terms & privacy policy

  bool _hasMinLength = false;
  bool _hasUppercase = false;
  bool _hasLowercase = false;
  bool _hasSpecial = false;
  bool _hasNumber = false;

  void _validatePassword(String value) {
    setState(() {
      _hasMinLength = value.length >= 8;
      _hasUppercase = value.contains(RegExp(r'[A-Z]'));
      _hasLowercase = value.contains(RegExp(r'[a-z]'));
      _hasSpecial = value.contains(RegExp(r'[!@#\$%^&*(),.?":{}|<>]'));
      _hasNumber = value.contains(RegExp(r'[0-9]'));
    });
  }

  bool get _isPasswordValid => _hasMinLength && _hasUppercase && _hasLowercase && _hasSpecial && _hasNumber;

  Widget _buildChecklistItem(String title, bool isChecked) {
    return Row(
      children: [
        Icon(
          isChecked ? Icons.check_circle : Icons.circle_outlined,
          color: isChecked ? Colors.green : Colors.grey,
          size: 16,
        ),
        const SizedBox(width: 8),
        Text(title, style: TextStyle(color: isChecked ? Colors.green : Colors.grey, fontSize: 12)),
      ],
    );
  }

  // Opens external web browser to launch full legal HTML documents from GitHub Pages
  Future<void> _openWebLegalDocument(String docType) async {
    final String urlString = docType == 'terms'
        ? 'https://dravyantra-pathvision.github.io/DravYantra-Website/terms.html'
        : 'https://dravyantra-pathvision.github.io/DravYantra-Website/privacy.html';
    final Uri url = Uri.parse(urlString);

    try {
      if (await canLaunchUrl(url)) {
        await launchUrl(url, mode: LaunchMode.externalApplication);
      } else {
        await launchUrl(url, mode: LaunchMode.platformDefault);
      }
    } catch (e) {
      debugPrint('Error launching legal web page: $e');
    }
  Future<void> _showVerificationPopupCard(String userEmail) async {
    return showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext dialogContext) {
        return Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          child: Container(
            width: 420,
            padding: const EdgeInsets.all(28),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppTheme.primaryBlue.withOpacity(0.1),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.mark_email_read_outlined, size: 36, color: AppTheme.primaryBlue),
                    ),
                    const SizedBox(width: 16),
                    const Expanded(
                      child: Text(
                        'Verify Your Email',
                        style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppTheme.primaryBlue),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                RichText(
                  text: TextSpan(
                    style: const TextStyle(fontSize: 15, color: Colors.black87, height: 1.5),
                    children: [
                      const TextSpan(text: 'A verification email has been sent to '),
                      TextSpan(
                        text: userEmail,
                        style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primaryBlue),
                      ),
                      const TextSpan(text: '. Please verify your email to create account.'),
                    ],
                  ),
                ),
                const SizedBox(height: 28),
                Align(
                  alignment: Alignment.bottomRight,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primaryBlue,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      elevation: 2,
                    ),
                    onPressed: () async {
                      await FirebaseAuth.instance.signOut();
                      if (dialogContext.mounted) {
                        Navigator.of(dialogContext).pop();
                      }
                      if (mounted) {
                        context.go('/login');
                      }
                    },
                    icon: const Icon(Icons.arrow_back, size: 18),
                    label: const Text('Go back to Login', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _handleSignup() async {
    if (!_agreedToTerms) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please accept the Terms and Conditions & Privacy Policy to proceed.')));
      return;
    }
    if (_name.text.isEmpty || _email.text.isEmpty || _pass.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please fill all fields')));
      return;
    }
    if (!_isPasswordValid) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please meet all password requirements')));
      return;
    }
    if (_pass.text != _confirmPass.text) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Passwords do not match')));
      return;
    }

    setState(() => _isLoading = true);
    try {
      final cred = await FirebaseAuth.instance.createUserWithEmailAndPassword(
        email: _email.text.trim(),
        password: _pass.text,
      );
      
      final user = cred.user;
      if (user != null) {
        // 1. Send native Firebase verification email
        try {
          await user.sendEmailVerification();
          debugPrint('Native Firebase email verification sent successfully.');
        } catch (e) {
          debugPrint('Failed to send native Firebase email verification: $e');
        }

        // 2. Set display name
        try {
          await user.updateDisplayName(_name.text.trim());
        } catch (e) {
          debugPrint('Failed to set display name: $e');
        }

        // 3. Immediately sync user into PostgreSQL database (AWS RDS)
        try {
          final token = await user.getIdToken();
          if (mounted) {
            final baseUrl = Provider.of<DataEngine>(context, listen: false).baseUrl;
            await http.post(
              Uri.parse('$baseUrl/api/users/sync'),
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer $token',
              },
              body: jsonEncode({
                'full_name': _name.text.trim(),
                'role': 'fleet_owner',
              }),
            ).timeout(const Duration(seconds: 10));
            debugPrint('User successfully synced to PostgreSQL database in AWS RDS.');
          }
        } catch (e) {
          debugPrint('Failed to sync user to PostgreSQL during signup: $e');
        }

        // 4. Custom backend verification email via SMTP
        // Wait 2 seconds for Firebase to propagate the new user record
        // before generating the verification link on the backend
        await Future.delayed(const Duration(seconds: 2));
        try {
          if (mounted) {
            final freshToken = await user.getIdToken(true); // force refresh
            final baseUrl = Provider.of<DataEngine>(context, listen: false).baseUrl;
            final verifyResp = await http.post(
              Uri.parse('$baseUrl/api/auth/send-verification'),
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer $freshToken',
              },
              body: jsonEncode({'email': _email.text.trim()}),
            ).timeout(const Duration(seconds: 15));
            debugPrint('Verification email response: ${verifyResp.statusCode} ${verifyResp.body}');
          }
        } catch (e) {
          debugPrint('Custom verification email fallback (native Firebase used instead): $e');
        }

        if (mounted) {
          await _showVerificationPopupCard(_email.text.trim());
        }
      }
    } on FirebaseAuthException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message ?? 'Signup failed')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleGoogleSignIn() async {
    if (!_agreedToTerms) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please accept the Terms and Conditions & Privacy Policy to proceed.')));
      return;
    }
    setState(() => _isLoading = true);
    try {
      if (kIsWeb) {
        final GoogleAuthProvider googleProvider = GoogleAuthProvider();
        final cred = await FirebaseAuth.instance.signInWithPopup(googleProvider);
        final user = cred.user;
        if (user != null) {
          final token = await user.getIdToken();
          final engine = Provider.of<DataEngine>(context, listen: false);
          await http.post(
            Uri.parse('${engine.baseUrl}/api/users/sync'),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode({'full_name': user.displayName ?? 'User', 'role': 'fleet_owner'}),
          );

          if (mounted) {
            await DialogUtils.showSuccessAnimation(context, 'Account Created!');
            if (mounted) context.go('/dashboard');
          }
        }
        return;
      }

      final GoogleSignInAccount? googleUser = await GoogleSignIn().signIn();
      if (googleUser == null) {
        setState(() => _isLoading = false);
        return; // User canceled
      }

      final GoogleSignInAuthentication googleAuth = await googleUser.authentication;
      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      final cred = await FirebaseAuth.instance.signInWithCredential(credential);
      final user = cred.user;
      if (user != null) {
        final token = await user.getIdToken();
        final engine = Provider.of<DataEngine>(context, listen: false);
        await http.post(
          Uri.parse('${engine.baseUrl}/api/users/sync'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
          },
          body: jsonEncode({'full_name': user.displayName ?? 'User', 'role': 'fleet_owner'}),
        );

        if (mounted) {
          await DialogUtils.showSuccessAnimation(context, 'Account Created!');
          if (mounted) context.go('/dashboard');
        }
      }
    } on FirebaseAuthException catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message ?? 'Google Sign-In failed')));
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: Center(
        child: SingleChildScrollView(
          child: Container(
            width: 400,
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 20)],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.person_add_alt_1, size: 48, color: AppTheme.primaryBlue),
                const SizedBox(height: 16),
                const Text('Create Account', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppTheme.primaryBlue)),
                const Text('Join DravYantra platform', style: TextStyle(color: AppTheme.textSecondary)),
                const SizedBox(height: 32),
                TextField(
                  controller: _name,
                  decoration: const InputDecoration(
                    labelText: 'Full Name', 
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _email,
                  decoration: const InputDecoration(
                    labelText: 'Email Address', 
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.email_outlined),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _pass,
                  obscureText: _obscurePass,
                  onChanged: _validatePassword,
                  decoration: InputDecoration(
                    labelText: 'Password', 
                    border: const OutlineInputBorder(),
                    prefixIcon: const Icon(Icons.lock_outline),
                    suffixIcon: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (_isPasswordValid)
                          const Padding(
                            padding: EdgeInsets.only(right: 8.0),
                            child: Icon(Icons.check_circle, color: Colors.green),
                          ),
                        IconButton(
                          icon: Icon(_obscurePass ? Icons.visibility_off : Icons.visibility),
                          onPressed: () => setState(() => _obscurePass = !_obscurePass),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Column(
                  children: [
                    Row(
                      children: [
                        Expanded(child: _buildChecklistItem('Min 8 chars', _hasMinLength)),
                        Expanded(child: _buildChecklistItem('1 Capital', _hasUppercase)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Expanded(child: _buildChecklistItem('1 Small', _hasLowercase)),
                        Expanded(child: _buildChecklistItem('1 Number', _hasNumber)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Expanded(child: _buildChecklistItem('1 Symbol', _hasSpecial)),
                        const Spacer(),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _confirmPass,
                  obscureText: _obscureConfirmPass,
                  decoration: InputDecoration(
                    labelText: 'Confirm Password', 
                    border: const OutlineInputBorder(),
                    prefixIcon: const Icon(Icons.lock_outline),
                    suffixIcon: IconButton(
                      icon: Icon(_obscureConfirmPass ? Icons.visibility_off : Icons.visibility),
                      onPressed: () => setState(() => _obscureConfirmPass = !_obscureConfirmPass),
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                // ── Terms & Privacy Checkbox (Opens Full Legal HTML Web Pages) ──
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 24,
                      height: 24,
                      child: Checkbox(
                        value: _agreedToTerms,
                        activeColor: AppTheme.primaryBlue,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                        onChanged: (val) {
                          setState(() {
                            _agreedToTerms = val ?? false;
                          });
                        },
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: GestureDetector(
                        onTap: () {
                          setState(() {
                            _agreedToTerms = !_agreedToTerms;
                          });
                        },
                        child: RichText(
                          text: TextSpan(
                            style: const TextStyle(fontSize: 13, color: Colors.black87, height: 1.4),
                            children: [
                              const TextSpan(text: 'I agree to the '),
                              WidgetSpan(
                                child: GestureTapCallbackWidget(
                                  onTap: () => _openWebLegalDocument('terms'),
                                  child: const Text(
                                    'Terms and Conditions',
                                    style: TextStyle(
                                      decoration: TextDecoration.underline,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.black87,
                                    ),
                                  ),
                                ),
                              ),
                              const TextSpan(text: ' and\n'),
                              WidgetSpan(
                                child: GestureTapCallbackWidget(
                                  onTap: () => _openWebLegalDocument('privacy'),
                                  child: const Text(
                                    'Privacy Policy',
                                    style: TextStyle(
                                      decoration: TextDecoration.underline,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.black87,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // ── Sign Up Button with Dynamic Opacity & Enable State ──
                AnimatedOpacity(
                  duration: const Duration(milliseconds: 200),
                  opacity: _agreedToTerms ? 1.0 : 0.45,
                  child: SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primaryBlue, 
                        foregroundColor: Colors.white,
                        disabledBackgroundColor: AppTheme.primaryBlue.withOpacity(0.5),
                        disabledForegroundColor: Colors.white70,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: (_isLoading || !_agreedToTerms) ? null : _handleSignup,
                      child: _isLoading 
                          ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white))
                          : const Text('Sign Up', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const Row(
                  children: [
                    Expanded(child: Divider()),
                    Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: Text("OR", style: TextStyle(color: Colors.grey))),
                    Expanded(child: Divider()),
                  ],
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    onPressed: _isLoading ? null : _handleGoogleSignIn,
                    icon: Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.grey.shade300),
                      ),
                      alignment: Alignment.center,
                      child: const Text('G', style: TextStyle(color: Colors.blue, fontWeight: FontWeight.bold, fontSize: 16)),
                    ),
                    label: const Text('Continue with Google', style: TextStyle(fontSize: 16, color: Colors.black87, fontWeight: FontWeight.w600)),
                  ),
                ),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: () {
                    context.go('/login');
                  },
                  child: const Text('Already have an account? Login', style: TextStyle(color: AppTheme.primaryBlue)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// Helper widget for clickable text spans inside RichText
class GestureTapCallbackWidget extends StatelessWidget {
  final VoidCallback onTap;
  final Widget child;
  const GestureTapCallbackWidget({super.key, required this.onTap, required this.child});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: child,
    );
  }
}
