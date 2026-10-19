# FFmpeg Runtime Sources

Giga Stream includes separate FFmpeg 9.0.1 runtime payloads for Windows x64 and Linux x64.

- FFmpeg source: `https://ffmpeg.org/releases/ffmpeg-9.0.1.tar.xz`
- Build scripts: `scripts/ffmpeg/` in the Giga Stream source repository
- Exact source checksum: each payload's `bin/source-sha256.txt`
- Exact dependency revisions and configure command: each payload's `bin/library-revisions.txt` and `bin/configure.log`

The Windows payload is GPL version 2 or later. The Linux payload statically links x264, OpenSSL and zlib and is GPL
version 3 or later. The corresponding GPL license texts are beside this file.

Dependency sources are available from their upstream projects and the package revisions recorded with each payload:

- x264: `https://code.videolan.org/videolan/x264`
- OpenSSL: `https://www.openssl.org/source/`
- zlib: `https://zlib.net/`
- Windows payload libraries: their upstream projects are named in `library-revisions.txt` and `configure.log`.
