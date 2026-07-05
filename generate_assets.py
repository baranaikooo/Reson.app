import os
from PIL import Image, ImageDraw

def main():
    # Source image paths
    source_img_path = r"C:\Users\baran\.gemini\antigravity\brain\cf911ff9-11a9-474d-87f9-1d746fe760cf\media__1783073032289.png"
    
    if not os.path.exists(source_img_path):
        print(f"Error: Source image not found at {source_img_path}")
        return
        
    print(f"Loading source image from {source_img_path}")
    source_img = Image.open(source_img_path)
    
    # 1. Create Master Standard Image (Solid black background, white line)
    # Convert to RGB to discard alpha, ensure background is pure black
    master_std = Image.new("RGBA", source_img.size, (0, 0, 0, 255))
    # Threshold source image to ensure line is pure white and background is pure black
    source_rgba = source_img.convert("RGBA")
    r, g, b, _ = source_rgba.split()
    
    # Create clean white-on-black mask
    clean_mask = r.point(lambda p: 255 if p > 120 else 0)
    # Paste pure white onto solid black using mask
    white_layer = Image.new("RGBA", source_img.size, (255, 255, 255, 255))
    master_std.paste(white_layer, (0, 0), mask=clean_mask)
    
    # 2. Create Master Foreground Image (Transparent background, white line with original antialiasing)
    # The clean_mask or red channel with smooth thresholding works as alpha
    smooth_alpha = r.point(lambda p: p if p > 50 else 0)
    master_fg = Image.merge("RGBA", (white_layer.split()[0], white_layer.split()[1], white_layer.split()[2], smooth_alpha))
    
    # 3. Scale down the wave and center it to ensure it fits perfectly in Android's round safe zone
    w, h = source_img.size
    scale_factor = 0.55  # Wave will occupy 55% of the canvas size
    new_w = int(w * scale_factor)
    new_h = int(h * scale_factor)
    offset_x = (w - new_w) // 2
    offset_y = (h - new_h) // 2

    # Scale and center the Standard Image
    std_resized = master_std.resize((new_w, new_h), Image.Resampling.LANCZOS)
    final_std = Image.new("RGBA", (w, h), (0, 0, 0, 255))
    final_std.paste(std_resized, (offset_x, offset_y))
    master_std = final_std

    # Scale and center the Foreground Image
    fg_resized = master_fg.resize((new_w, new_h), Image.Resampling.LANCZOS)
    final_fg = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    final_fg.paste(fg_resized, (offset_x, offset_y), mask=fg_resized.split()[3])
    master_fg = final_fg

    # Save source images for `@capacitor/assets` tool config
    assets_dir = "assets"
    os.makedirs(assets_dir, exist_ok=True)
    
    # Save standard source icon (1024x1024)
    icon_1024 = master_std.resize((1024, 1024), Image.Resampling.LANCZOS)
    icon_1024.save(os.path.join(assets_dir, "icon.png"), "PNG")
    
    # Save adaptive foreground source icon (1024x1024)
    fg_1024 = master_fg.resize((1024, 1024), Image.Resampling.LANCZOS)
    fg_1024.save(os.path.join(assets_dir, "icon-foreground.png"), "PNG")
    
    # Save adaptive background source icon (1024x1024 solid black)
    bg_1024 = Image.new("RGBA", (1024, 1024), (0, 0, 0, 255))
    bg_1024.save(os.path.join(assets_dir, "icon-background.png"), "PNG")
    
    print("Saved source icon assets in assets/ folder for `@capacitor/assets` configuration.")
    
    # Android Res directory
    res_dir = r"android\app\src\main\res"
    
    # Densities and sizes mapping
    # Density -> (Standard size, Adaptive Foreground size)
    densities = {
        "mipmap-mdpi": (48, 108),
        "mipmap-hdpi": (72, 162),
        "mipmap-xhdpi": (96, 216),
        "mipmap-xxhdpi": (144, 324),
        "mipmap-xxxhdpi": (192, 432)
    }
    
    def make_round(img):
        size = img.size
        mask = Image.new("L", size, 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0) + size, fill=255)
        round_img = Image.new("RGBA", size, (0, 0, 0, 0))
        round_img.paste(img, (0, 0), mask=mask)
        return round_img
        
    for density, (std_size, fg_size) in densities.items():
        density_path = os.path.join(res_dir, density)
        os.makedirs(density_path, exist_ok=True)
        
        # A. ic_launcher.png (Standard square launcher icon: Solid black background, white line)
        std_img = master_std.resize((std_size, std_size), Image.Resampling.LANCZOS)
        std_img.save(os.path.join(density_path, "ic_launcher.png"), "PNG")
        print(f"Generated standard icon in {density}: {std_size}x{std_size}")
        
        # B. ic_launcher_round.png (Circular launcher icon)
        round_img = make_round(std_img)
        round_img.save(os.path.join(density_path, "ic_launcher_round.png"), "PNG")
        print(f"Generated round icon in {density}: {std_size}x{std_size}")
        
        # C. ic_launcher_foreground.png (Adaptive launcher icon foreground: Transparent background, white line)
        # Resize foreground. Adaptive icon safe-zone expects center alignment.
        fg_img = master_fg.resize((fg_size, fg_size), Image.Resampling.LANCZOS)
        fg_img.save(os.path.join(density_path, "ic_launcher_foreground.png"), "PNG")
        print(f"Generated adaptive foreground in {density}: {fg_size}x{fg_size}")
        
    print("\nAssets generation completed successfully!")

if __name__ == "__main__":
    main()
