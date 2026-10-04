package com.jcbbillgenerator.app;

import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "GalleryPlugin")
public class GalleryPlugin extends Plugin {

    @PluginMethod
    public void saveImageToGallery(PluginCall call) {
        String base64Data = call.getString("base64Data");
        String fileName = call.getString("fileName", "JCB-Bill.png");

        if (base64Data == null || base64Data.isEmpty()) {
            call.reject("Image base64 data is required.");
            return;
        }

        // Clean base64 data URL prefix if present (e.g. "data:image/png;base64,")
        if (base64Data.contains(",")) {
            base64Data = base64Data.substring(base64Data.indexOf(",") + 1);
        }

        try {
            byte[] imageBytes = Base64.decode(base64Data, Base64.DEFAULT);
            Context context = getContext();

            Uri imageUri = null;
            String relativeSubDir = "Pictures" + File.separator + "JCB Bills";

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Modern Android 10+ (API 29 - 36): Scoped storage via MediaStore
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
                values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + File.separator + "JCB Bills");
                values.put(MediaStore.Images.Media.IS_PENDING, 1);

                imageUri = context.getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);

                if (imageUri == null) {
                    call.reject("Failed to create MediaStore entry.");
                    return;
                }

                try (OutputStream out = context.getContentResolver().openOutputStream(imageUri)) {
                    if (out != null) {
                        out.write(imageBytes);
                        out.flush();
                    } else {
                        call.reject("Failed to open MediaStore output stream.");
                        return;
                    }
                }

                // Mark image ready so it appears immediately in Gallery/Photos
                values.clear();
                values.put(MediaStore.Images.Media.IS_PENDING, 0);
                context.getContentResolver().update(imageUri, values, null, null);

            } else {
                // Legacy Android 7.0 - 9.0 (API 24 - 28)
                File picturesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES);
                File jcbDir = new File(picturesDir, "JCB Bills");
                if (!jcbDir.exists()) {
                    jcbDir.mkdirs();
                }

                File imageFile = new File(jcbDir, fileName);
                // Handle duplicate filenames safely without crashing or overwriting
                if (imageFile.exists()) {
                    String baseName = fileName.endsWith(".png") ? fileName.substring(0, fileName.length() - 4) : fileName;
                    int counter = 1;
                    while (imageFile.exists()) {
                        imageFile = new File(jcbDir, baseName + "-" + counter + ".png");
                        counter++;
                    }
                }

                try (FileOutputStream fos = new FileOutputStream(imageFile)) {
                    fos.write(imageBytes);
                    fos.flush();
                }

                // Notify MediaScanner to index image into Gallery
                android.media.MediaScannerConnection.scanFile(
                    context,
                    new String[]{imageFile.getAbsolutePath()},
                    new String[]{"image/png"},
                    null
                );

                imageUri = Uri.fromFile(imageFile);
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("uri", imageUri != null ? imageUri.toString() : "");
            ret.put("filePath", relativeSubDir + File.separator + fileName);
            ret.put("message", "Bill image saved to Gallery");
            call.resolve(ret);

        } catch (Exception e) {
            call.reject("Unable to save bill image to Gallery. Please try again: " + e.getMessage(), e);
        }
    }
}
