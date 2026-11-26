"""Python-level guard for scripts Omer runs inside Blender.

This is a guard rail, not a sandbox. It uses a Python audit hook (cannot be removed once installed)
to stop an AI-written script from, at the Python level:
  - starting other programs (subprocess, os.system, os.exec*, os.startfile)
  - using the network (unless allow_network)
  - loading native libraries through ctypes
  - writing, deleting or renaming files outside the allowed folders

It does NOT cover writes made by Blender's own C code (for example a bpy export operator given an
arbitrary filepath). That is why run_script also needs user approval before first use.
"""

import os
import sys

_WRITE_FLAGS = sum(getattr(os, name, 0) for name in ("O_WRONLY", "O_RDWR", "O_APPEND", "O_CREAT", "O_TRUNC"))

_PROCESS_EVENTS = {
    "subprocess.Popen", "os.system", "os.exec", "os.posix_spawn", "os.spawn", "os.startfile",
    "ctypes.dlopen", "ctypes.dlsym",
}
_NETWORK_EVENTS = {
    "socket.connect", "socket.bind", "socket.sendto", "socket.getaddrinfo",
    "socket.gethostbyname", "socket.gethostbyaddr", "socket.getnameinfo",
}
# event -> which argument positions are paths that get modified
_MUTATING = {
    "os.remove": (0,), "os.rmdir": (0,), "os.mkdir": (0,), "os.chmod": (0,), "os.chown": (0,),
    "os.truncate": (0,), "os.utime": (0,), "os.mkfifo": (0,), "os.mknod": (0,),
    "os.rename": (0, 1), "os.symlink": (1,), "os.link": (1,),
    "shutil.rmtree": (0,), "shutil.move": (0, 1), "shutil.copyfile": (1,),
    "shutil.copymode": (1,), "shutil.copystat": (1,), "shutil.copytree": (1,),
}


def _to_text(value):
    if isinstance(value, (bytes, bytearray)):
        return os.fsdecode(value)
    if isinstance(value, (str, os.PathLike)):
        return os.fspath(value)
    return None  # file descriptors and anything else are not paths


def _canon(path):
    return os.path.normcase(os.path.realpath(path))


def install(allowed_dirs, allow_network=False):
    """Install the guard. `allowed_dirs` are the only folders scripts may modify.

    The system temp folder is deliberately not allowed; blender_server.py points TEMP/TMP at a
    folder inside the project, so tempfile keeps working without opening up the whole machine.
    """
    allowed = [_canon(d) for d in allowed_dirs]

    def inside(path):
        text = _to_text(path)
        if text is None:
            return True
        target = _canon(text)
        for root in allowed:
            try:
                if os.path.commonpath([root, target]) == root:
                    return True
            except ValueError:  # different drives
                continue
        return False

    def deny(event, detail=""):
        raise PermissionError(f"Omer's script guard blocked {event}{': ' + detail if detail else ''}")

    def hook(event, args):
        if event in _PROCESS_EVENTS:
            deny(event, "scripts may not start other programs")
        if event in _NETWORK_EVENTS and not allow_network:
            deny(event, "this agent has no network permission")
        if event == "open":
            path, mode, flags = (tuple(args) + (None, None, None))[:3]
            writing = (isinstance(mode, str) and any(c in mode for c in "wax+")) or \
                      (isinstance(flags, int) and flags & _WRITE_FLAGS)
            if writing and not inside(path):
                deny(event, f"writing outside the project folder ({_to_text(path)})")
            return
        positions = _MUTATING.get(event)
        if positions:
            for i in positions:
                if i < len(args) and not inside(args[i]):
                    deny(event, f"changing files outside the project folder ({_to_text(args[i])})")

    sys.addaudithook(hook)
