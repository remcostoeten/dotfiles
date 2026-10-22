use rustix::termios::{
    LocalModes, OptionalActions, SpecialCodeIndex, Termios, tcgetattr, tcsetattr,
};
use std::io::{IsTerminal, Read};
use std::thread;

pub struct Keys {
    saved: Termios,
}

impl Keys {
    pub fn enable() -> Option<Keys> {
        if !std::io::stdin().is_terminal() {
            return None;
        }
        let fd = rustix::stdio::stdin();
        let saved = tcgetattr(fd).ok()?;
        let mut mode = saved.clone();
        mode.local_modes
            .remove(LocalModes::ICANON | LocalModes::ECHO);
        mode.special_codes[SpecialCodeIndex::VMIN] = 1;
        mode.special_codes[SpecialCodeIndex::VTIME] = 0;
        tcsetattr(fd, OptionalActions::Now, &mode).ok()?;
        Some(Keys { saved })
    }
}

impl Drop for Keys {
    fn drop(&mut self) {
        tcsetattr(rustix::stdio::stdin(), OptionalActions::Now, &self.saved).ok();
    }
}

pub fn read_keys(on_key: impl Fn(u8) -> bool + Send + 'static) {
    thread::spawn(move || {
        let mut buffer = [0u8; 32];
        let mut stdin = std::io::stdin();
        loop {
            match stdin.read(&mut buffer) {
                Ok(0) => return,
                Ok(count) => {
                    for byte in &buffer[..count] {
                        if !on_key(*byte) {
                            return;
                        }
                    }
                }
                Err(error) if error.kind() == std::io::ErrorKind::Interrupted => continue,
                Err(_) => return,
            }
        }
    });
}
