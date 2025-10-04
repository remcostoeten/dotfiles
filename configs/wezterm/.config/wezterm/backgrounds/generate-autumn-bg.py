#!/usr/bin/env python3
"""
Generate a beautiful autumn/pumpkin themed background image for WezTerm
"""
import random
from PIL import Image, ImageDraw
import numpy as np

def create_autumn_background(width=1920, height=1080):
    # Create base image with dark gradient
    img = Image.new('RGB', (width, height))
    draw = ImageDraw.Draw(img)
    
    # Create dark gradient background
    for y in range(height):
        # Gradient from very dark brown to slightly lighter
        progress = y / height
        r = int(13 + progress * 20)  # 13 -> 33
        g = int(8 + progress * 24)   # 8 -> 32  
        b = int(4 + progress * 8)    # 4 -> 12
        
        color = (r, g, b)
        draw.line([(0, y), (width, y)], fill=color)
    
    # Add subtle texture with scattered dots/particles
    for _ in range(800):
        x = random.randint(0, width)
        y = random.randint(0, height)
        
        # Pumpkin spice colors for particles
        colors = [
            (255, 107, 26, 20),   # Pumpkin orange, very transparent
            (184, 134, 91, 15),   # Warm tan, very transparent  
            (139, 105, 20, 10),   # Dark goldenrod, very transparent
            (160, 82, 45, 8),     # sienna, very transparent
        ]
        
        color = random.choice(colors)
        size = random.randint(1, 3)
        
        # Create small circles/dots
        draw.ellipse([x-size, y-size, x+size, y+size], fill=color[:3])
    
    return img

if __name__ == "__main__":
    try:
        bg = create_autumn_background()
        bg.save('/home/remco-stoeten/.config/dotfiles/configs/wezterm/.config/wezterm/backgrounds/autumn-pattern.png')
        print("✅ Generated autumn background successfully!")
    except ImportError:
        print("❌ PIL not available, creating simple pattern instead")
        # Create a simple text-based pattern file
        with open('/home/remco-stoeten/.config/dotfiles/configs/wezterm/.config/wezterm/backgrounds/pattern.txt', 'w') as f:
            f.write("# Autumn pattern placeholder\n")
            f.write("# Install PIL/Pillow to generate actual background image\n")
            f.write("# pip install Pillow\n")
