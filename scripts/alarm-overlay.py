#!/usr/bin/env python3
# DOCSTRING: Creates a fullscreen, always-on-top overlay window for aggressive alarm mode

import gi
gi.require_version('Gtk', '3.0')
gi.require_version('Pango', '1.0')
from gi.repository import Gtk, Gdk, GLib, Pango
import sys
import signal
import os
import subprocess
import time

class AlarmOverlay(Gtk.Window):
    def __init__(self, duration=5):
        super().__init__()
        self.duration = duration  # Duration in seconds
        self.start_time = time.time()
        
        # Get screen dimensions - use all monitors
        screen = self.get_screen()
        self.width = screen.get_width()
        self.height = screen.get_height()
        
        # Set window properties for fullscreen overlay
        self.set_title("ALARM OVERLAY")
        self.set_default_size(self.width, self.height)
        self.set_position(Gtk.WindowPosition.CENTER)
        self.set_decorated(False)  # No window decorations
        self.set_keep_above(True)  # Always on top
        self.set_skip_taskbar_hint(True)  # Don't show in taskbar
        self.set_skip_pager_hint(True)  # Don't show in pager
        self.set_accept_focus(True)  # Accept focus
        self.set_modal(False)  # Not modal (but still on top)
        self.set_type_hint(Gdk.WindowTypeHint.SPLASHSCREEN)  # Splash screen type for overlay
        
        # Make window fullscreen
        self.fullscreen()
        
        # Set window to stay on top using X11 hints
        try:
            self.set_urgency_hint(True)  # Urgent hint
        except:
            pass
        
        # Set up the overlay
        self.setup_overlay()
        
        # Color cycling
        self.colors = [
            ('#ff0000', '#ffffff'),  # Red bg, white text
            ('#ffff00', '#000000'),  # Yellow bg, black text
            ('#ff00ff', '#ffffff'),  # Magenta bg, white text
            ('#000000', '#ff0000'),  # Black bg, red text
        ]
        self.color_index = 0
        self.is_flashing = True
        
        # Start color cycling
        GLib.timeout_add(150, self.cycle_colors)  # Change every 150ms for faster flashing
        
        # Auto-dismiss after duration
        GLib.timeout_add(self.duration * 1000, self.auto_dismiss)
        
        # Handle key press to dismiss
        self.connect('key-press-event', self.on_key_press)
        self.connect('button-press-event', self.on_button_press)
        
        # Handle window close
        self.connect('delete-event', self.on_delete)
        
        # Make sure window is on top
        self.set_keep_above(True)
        
    def setup_overlay(self):
        # Create main container - make it clickable
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        box.set_homogeneous(True)
        box.connect('button-press-event', self.on_button_press)
        self.add(box)
        
        # Create label with alarm message
        self.label = Gtk.Label()
        self.label.set_text("🚨 AGGRESSIVE ALARM! 🚨\n\nIMMEDIATE ACTION REQUIRED!\n\nClick anywhere or wait " + str(self.duration) + " seconds")
        self.label.set_justify(Gtk.Justification.CENTER)
        self.label.set_line_wrap(True)
        self.label.set_halign(Gtk.Align.CENTER)
        self.label.set_valign(Gtk.Align.CENTER)
        
        # Style the label
        self.update_label_style()
        
        box.pack_start(self.label, True, True, 0)
        
    def update_label_style(self):
        bg_color, text_color = self.colors[self.color_index]
        
        # Parse colors
        bg_rgba = Gdk.RGBA()
        text_rgba = Gdk.RGBA()
        bg_rgba.parse(bg_color)
        text_rgba.parse(text_color)
        
        # Set window background
        self.override_background_color(Gtk.StateType.NORMAL, bg_rgba)
        
        # Set label text color
        self.label.override_color(Gtk.StateType.NORMAL, text_rgba)
        
        # Set label font using Pango
        font_desc = Pango.FontDescription()
        font_desc.set_family("Sans")
        font_desc.set_size(96 * Pango.SCALE)  # Larger font - 96pt
        font_desc.set_weight(Pango.Weight.BOLD)
        self.label.override_font(font_desc)
        
    def cycle_colors(self):
        if self.is_flashing:
            self.color_index = (self.color_index + 1) % len(self.colors)
            self.update_label_style()
        return True  # Continue timeout
        
    def auto_dismiss(self):
        # Auto-dismiss after duration
        self.dismiss()
        return False  # Don't repeat
        
    def on_key_press(self, widget, event):
        # Any key dismisses the overlay
        self.dismiss()
        return True
        
    def on_button_press(self, widget, event):
        # Any click dismisses the overlay
        self.dismiss()
        return True
        
    def on_delete(self, widget, event):
        self.dismiss()
        return True
        
    def dismiss(self):
        self.is_flashing = False
        Gtk.main_quit()

def force_window_on_top(window_id=None):
    """Use wmctrl and xdotool to force window to stay on top"""
    if window_id is None:
        # Try to find the window by title
        try:
            result = subprocess.run(['wmctrl', '-l'], capture_output=True, text=True, timeout=2)
            for line in result.stdout.split('\n'):
                if 'ALARM OVERLAY' in line:
                    window_id = line.split()[0]
                    break
        except:
            pass
    
    if window_id:
        try:
            # Make window always on top
            subprocess.run(['wmctrl', '-i', '-r', window_id, '-b', 'add,above'], timeout=1, check=False)
            subprocess.run(['wmctrl', '-i', '-r', window_id, '-b', 'add,fullscreen'], timeout=1, check=False)
            # Also use xdotool to activate the window
            subprocess.run(['xdotool', 'search', '--name', 'ALARM OVERLAY', 'windowactivate'], timeout=1, check=False)
        except:
            pass

def main():
    # Parse duration from command line (default 5 seconds)
    duration = 5
    if len(sys.argv) > 1:
        try:
            duration = int(sys.argv[1])
        except:
            pass
    
    # Create and show window
    overlay = AlarmOverlay(duration=duration)
    overlay.show_all()
    
    # Make sure it's on top - do this multiple times to ensure it works
    overlay.set_keep_above(True)
    overlay.present()
    overlay.set_keep_above(True)
    
    # Force window to front and grab focus
    overlay.set_focus_on_map(True)
    overlay.set_accept_focus(True)
    
    # Get window ID for wmctrl/xdotool after window is realized
    def setup_window_control():
        overlay.realize()
        window = overlay.get_window()
        if window:
            xid = window.get_xid()
            # Use wmctrl to force window on top
            force_window_on_top(hex(xid))
            # Also try xdotool
            try:
                subprocess.run(['xdotool', 'search', '--name', 'ALARM OVERLAY', 'windowactivate', '--sync'], timeout=1, check=False)
            except:
                pass
    
    # Setup window control after a short delay to ensure window is created
    GLib.timeout_add(100, setup_window_control)
    GLib.timeout_add(300, setup_window_control)
    GLib.timeout_add(500, setup_window_control)
    
    # Use GLib to ensure window stays on top periodically
    def ensure_on_top():
        overlay.set_keep_above(True)
        overlay.present()
        # Also try wmctrl
        try:
            subprocess.run(['wmctrl', '-a', 'ALARM OVERLAY'], timeout=0.5, check=False)
        except:
            pass
        return True  # Continue repeating
    
    GLib.timeout_add(500, ensure_on_top)  # Check every 500ms
    
    # Start GTK main loop
    Gtk.main()

if __name__ == '__main__':
    # Handle SIGTERM gracefully
    signal.signal(signal.SIGTERM, lambda s, f: Gtk.main_quit())
    signal.signal(signal.SIGINT, lambda s, f: Gtk.main_quit())
    
    main()
