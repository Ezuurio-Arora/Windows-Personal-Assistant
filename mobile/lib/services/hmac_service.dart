import 'dart:convert';
import 'dart:math';
import 'package:crypto/crypto.dart';

abstract class HmacService {
  String generateNonce();
  int getCurrentTimestamp();
  String signHttpRequest({
    required String method,
    required String path,
    required int timestamp,
    required String nonce,
    required String body,
    required String secret,
  });
  Map<String, String> buildAuthHeaders({
    required String method,
    required String path,
    required String sessionToken,
    required String hmacSecret,
    String body = '',
  });
  Map<String, dynamic> buildWebSocketEnvelope({
    required String event,
    required dynamic data,
    required String sessionToken,
    required String hmacSecret,
  });
  bool verifySignature({
    required String signature,
    required String message,
    required String secret,
  });
}

class CryptoHmacService implements HmacService {
  final Random _rng = Random.secure();

  @override
  String generateNonce() {
    final values = List<int>.generate(16, (i) => _rng.nextInt(256));
    return values.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }

  @override
  int getCurrentTimestamp() => DateTime.now().millisecondsSinceEpoch;

  @override
  String signHttpRequest({
    required String method,
    required String path,
    required int timestamp,
    required String nonce,
    required String body,
    required String secret,
  }) {
    final bodyHash = sha256.convert(utf8.encode(body)).toString();
    final canonicalString = '$method\n$path\n$timestamp\n$nonce\n$bodyHash';
    final key = utf8.encode(secret);
    final hmac = Hmac(sha256, key);
    return hmac.convert(utf8.encode(canonicalString)).toString();
  }

  @override
  Map<String, String> buildAuthHeaders({
    required String method,
    required String path,
    required String sessionToken,
    required String hmacSecret,
    String body = '',
  }) {
    final timestamp = getCurrentTimestamp();
    final nonce = generateNonce();
    final signature = signHttpRequest(
      method: method,
      path: path,
      timestamp: timestamp,
      nonce: nonce,
      body: body,
      secret: hmacSecret,
    );

    return {
      'Content-Type': 'application/json',
      'X-Session-Token': sessionToken,
      'X-Timestamp': timestamp.toString(),
      'X-Nonce': nonce,
      'X-Signature': signature,
    };
  }

  @override
  Map<String, dynamic> buildWebSocketEnvelope({
    required String event,
    required dynamic data,
    required String sessionToken,
    required String hmacSecret,
  }) {
    final timestamp = getCurrentTimestamp();
    final nonce = generateNonce();
    final dataString = jsonEncode(data);
    final canonicalString = '$event\n$timestamp\n$nonce\n$dataString';

    final key = utf8.encode(hmacSecret);
    final hmac = Hmac(sha256, key);
    final signature = hmac.convert(utf8.encode(canonicalString)).toString();

    return {
      'event': event,
      'data': data,
      'auth': {
        'sessionToken': sessionToken,
        'timestamp': timestamp,
        'nonce': nonce,
        'signature': signature,
      }
    };
  }

  @override
  bool verifySignature({
    required String signature,
    required String message,
    required String secret,
  }) {
    final key = utf8.encode(secret);
    final hmac = Hmac(sha256, key);
    final calculated = hmac.convert(utf8.encode(message)).toString();
    return calculated == signature;
  }
}
