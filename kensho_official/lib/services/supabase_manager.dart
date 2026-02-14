import 'dart:io';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:image/image.dart' as img;
import 'package:path/path.dart' as p;

class SupabaseManager {
  static final client = Supabase.instance.client;

  /// Compresses and Resizes image before upload (Target ~200KB)
  static Future<File> compressImage(File file) async {
    final bytes = await file.readAsBytes();
    img.Image? image = img.decodeImage(bytes);
    
    if (image == null) return file;

    // Resize to max 800px width/height while maintaining aspect ratio
    if (image.width > 800 || image.height > 800) {
      if (image.width > image.height) {
        image = img.copyResize(image, width: 800);
      } else {
        image = img.copyResize(image, height: 800);
      }
    }

    // Encode as JPG with 80% quality
    final compressedBytes = img.encodeJpg(image, quality: 80);
    
    final tempDir = file.parent;
    final tempFile = File(p.join(tempDir.path, 'temp_upload.jpg'));
    await tempFile.writeAsBytes(compressedBytes);
    
    return tempFile;
  }

  /// Uploads athlete photo to 'athlete-photos' bucket
  static Future<String?> uploadAthletePhoto(File file, String athleteName) async {
    try {
      // 1. Compress
      final compressedFile = await compressImage(file);
      
      // 2. Generate unique filename
      final fileName = '${DateTime.now().millisecondsSinceEpoch}_${athleteName.replaceAll(' ', '_')}.jpg';
      
      // 3. Upload to Supabase Storage
      await client.storage.from('athlete-photos').upload(
        fileName,
        compressedFile,
        fileOptions: const FileOptions(cacheControl: '3600', upsert: false),
      );

      // 4. Get Public URL
      final publicUrl = client.storage.from('athlete-photos').getPublicUrl(fileName);
      
      return publicUrl;
    } catch (e) {
      print('Error uploading to Supabase: $e');
      return null;
    }
  }
}
