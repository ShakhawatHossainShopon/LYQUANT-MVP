
import sys
import time
import subprocess
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

process = None


def start_server():
    global process

    if process:
        process.terminate()
        process.wait()

    print("\n[WATCHER] Starting server...")
    process = subprocess.Popen([sys.executable, "app.py"])


class ChangeHandler(FileSystemEventHandler):
    def on_any_event(self, event):
        if event.is_directory:
            return

        if not event.src_path.endswith(".py"):
            return

        if "__pycache__" in event.src_path:
            return

        print(f"\n[WATCHER] Changed: {event.src_path}")
        time.sleep(0.5)
        start_server()


if __name__ == "__main__":
    start_server()

    observer = Observer()
    observer.schedule(ChangeHandler(), ".", recursive=True)
    observer.start()

    print("[WATCHER] Monitoring project files...")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        if process:
            process.terminate()

    observer.join()
